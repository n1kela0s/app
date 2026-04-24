from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect, Query, Header, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import string
import json
import asyncio
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone

# --- 1. CONFIGURAZIONE INIZIALE ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'proietta')]

# Variabili Storage
STORAGE_URL = os.environ.get("STORAGE_URL")
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME", "proietta")
storage_key: Optional[str] = None

# --- 2. HELPERS STORAGE ---
def init_storage():
    global storage_key
    if storage_key: return storage_key
    if not EMERGENT_KEY or not STORAGE_URL:
        logger.warning("Storage credentials missing, upload will not work.")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=10)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key: raise HTTPException(500, "Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    if not key: raise HTTPException(500, "Storage not initialized")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# --- 3. MODELLI DATI ---
class CreateRoomResponse(BaseModel):
    room_code: str
    master_token: str

class JoinRoomRequest(BaseModel):
    code: str
    name: str

class JoinRoomResponse(BaseModel):
    player_id: str
    room_code: str
    name: str

class SendImageRequest(BaseModel):
    url: str
    caption: str = ""
    source: str = "url"

# --- 4. GESTORE CONNESSIONI WEBSOCKET ---
class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, List[dict]] = {}

    async def connect(self, ws: WebSocket, room_code: str, role: str, cid: str):
        await ws.accept()
        self.rooms.setdefault(room_code, []).append({"ws": ws, "role": role, "id": cid})

    def disconnect(self, ws: WebSocket, room_code: str):
        if room_code in self.rooms:
            self.rooms[room_code] = [c for c in self.rooms[room_code] if c["ws"] is not ws]
            if not self.rooms[room_code]: del self.rooms[room_code]

    async def broadcast(self, room_code: str, message: dict):
        conns = self.rooms.get(room_code, [])
        for c in conns:
            try: await c["ws"].send_json(message)
            except: pass

manager = ConnectionManager()

def gen_code() -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# --- 5. INIZIALIZZAZIONE APP ---
app = FastAPI()
api_router = APIRouter(prefix="/api")

# --- 6. ROTTE API ---
@api_router.get("/")
async def api_root():
    return {"message": "Proietta API Online"}

@api_router.post("/rooms", response_model=CreateRoomResponse)
async def create_room():
    for _ in range(10):
        code = gen_code()
        if not await db.rooms.find_one({"code": code}): break
    else: raise HTTPException(500, "Unique code error")
    
    room = {"id": str(uuid.uuid4()), "code": code, "master_token": str(uuid.uuid4()), "created_at": now_iso(), "active": True}
    await db.rooms.insert_one(room)
    
    # Rimuoviamo l'ObjectId generato da MongoDB per evitare errori di serializzazione
    if "_id" in room: del room["_id"]
    
    return CreateRoomResponse(room_code=code, master_token=room["master_token"])

@api_router.get("/rooms/{code}")
async def get_room(code: str):
    code = code.upper()
    room = await db.rooms.find_one({"code": code}, {"_id": 0, "master_token": 0})
    if not room: raise HTTPException(404, "Stanza non trovata")
    players = await db.players.find({"room_code": code}, {"_id": 0}).to_list(100)
    images = await db.images.find({"room_code": code}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return {"room": room, "players": players, "images": images}

@api_router.post("/rooms/join", response_model=JoinRoomResponse)
async def join_room(req: JoinRoomRequest):
    code, name = req.code.upper().strip(), req.name.strip()
    room = await db.rooms.find_one({"code": code, "active": True})
    if not room: raise HTTPException(404, "Stanza non trovata")
    player = {"id": str(uuid.uuid4()), "room_code": code, "name": name, "joined_at": now_iso(), "online": True}
    await db.players.insert_one(player)
    
    # Pulizia post-inserimento
    if "_id" in player: del player["_id"]
    
    return JoinRoomResponse(player_id=player["id"], room_code=code, name=name)

@api_router.post("/rooms/{code}/images")
async def send_image(code: str, req: SendImageRequest, x_master_token: Optional[str] = Header(None)):
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room or room["master_token"] != x_master_token: 
        raise HTTPException(403, "Accesso negato")
    
    image = {
        "id": str(uuid.uuid4()), 
        "room_code": code, 
        "url": req.url, 
        "caption": req.caption, 
        "source": req.source, 
        "created_at": now_iso()
    }
    
    # Qui MongoDB inserisce forzatamente image["_id"] = ObjectId(...)
    await db.images.insert_one(image)
    
    # CANCELLIAMO l'ObjectId prima di inviarlo al broadcast e ritornarlo
    if "_id" in image:
        del image["_id"]
        
    await manager.broadcast(code, {"type": "image", "data": image})
    return image

# --- 7. WEBSOCKET ---
@app.websocket("/api/ws/{code}")
async def websocket_endpoint(websocket: WebSocket, code: str, role: str = Query("player"), id: str = Query("")):
    code = code.upper()
    await manager.connect(websocket, code, role, id)
    online = len([c for c in manager.rooms.get(code, []) if c["role"] == "player"])
    await manager.broadcast(code, {"type": "presence_count", "players": online})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, code)
        online = len([c for c in manager.rooms.get(code, []) if c["role"] == "player"])
        await manager.broadcast(code, {"type": "presence_count", "players": online})

# --- 8. MIDDLEWARE E ROUTER ---
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 9. INTEGRAZIONE FRONTEND (IN FONDO) ---
frontend_path = Path(__file__).resolve().parent.parent / "frontend" / "build"

if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
    
    @app.exception_handler(404)
    async def fallback(request, exc):
        if request.url.path.startswith("/api"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        return FileResponse(frontend_path / "index.html")

@app.on_event("startup")
async def startup():
    init_storage()

@app.on_event("shutdown")
async def shutdown():
    client.close()
