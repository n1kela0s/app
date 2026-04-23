from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect, Query, Header, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
# --- INTEGRAZIONE FRONTEND MIGLIORATA ---
import os

# Proviamo a localizzare la cartella build  in modo dinamico
base_path = Path(__file__).resolve().parent.parent
frontend_dist_path = base_path / "frontend" / "build"

# LOG DI DEBUG (Vedrai questo nei log di Render)
print(f"DEBUG: Cerco il frontend in: {frontend_dist_path}")
print(f"DEBUG: La cartella esiste? {frontend_dist_path.exists()}")

if frontend_dist_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist_path), html=True), name="frontend")
    
    @app.exception_handler(404)
    async def fallback_to_index(request, exc):
        return FileResponse(frontend_dist_path / "index.html")
else:
    # Se non la trova, creiamo una rotta di emergenza per capire cosa succede
    @app.get("/")
    async def debug_root():
        files = [str(f) for f in base_path.rglob("*") if "node_modules" not in str(f)]
        return {
            "error": "Frontend non trovato",
            "search_path": str(frontend_dist_path),
            "current_dir": os.getcwd(),
            "files_found": files[:20] # Vediamo i primi 20 file per capire la struttura
        }
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ------------- Object Storage helpers -------------
STORAGE_URL = os.environ.get("STORAGE_URL")
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME")
storage_key: Optional[str] = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ------------- Models -------------
class Room(BaseModel):
    id: str
    code: str
    master_token: str
    created_at: str
    active: bool = True


class Player(BaseModel):
    id: str
    room_code: str
    name: str
    joined_at: str
    online: bool = True


class ImageMessage(BaseModel):
    id: str
    room_code: str
    url: str
    caption: str = ""
    source: str  # "upload" | "url"
    created_at: str


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


# ------------- Connection Manager -------------
class ConnectionManager:
    def __init__(self):
        # room_code -> list of (ws, role, id)
        self.rooms: Dict[str, List[dict]] = {}

    async def connect(self, ws: WebSocket, room_code: str, role: str, cid: str):
        await ws.accept()
        self.rooms.setdefault(room_code, []).append({"ws": ws, "role": role, "id": cid})

    def disconnect(self, ws: WebSocket, room_code: str):
        if room_code in self.rooms:
            self.rooms[room_code] = [c for c in self.rooms[room_code] if c["ws"] is not ws]
            if not self.rooms[room_code]:
                del self.rooms[room_code]

    async def broadcast(self, room_code: str, message: dict):
        conns = self.rooms.get(room_code, [])
        dead = []
        for c in conns:
            try:
                await c["ws"].send_json(message)
            except Exception:
                dead.append(c)
        for d in dead:
            if room_code in self.rooms and d in self.rooms[room_code]:
                self.rooms[room_code].remove(d)


manager = ConnectionManager()


def gen_code() -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------- Routes -------------
@api_router.get("/")
async def root():
    return {"message": "Proietta API"}


@api_router.post("/rooms", response_model=CreateRoomResponse)
async def create_room():
    # ensure unique code
    for _ in range(10):
        code = gen_code()
        existing = await db.rooms.find_one({"code": code})
        if not existing:
            break
    else:
        raise HTTPException(500, "Cannot generate unique room code")

    room = {
        "id": str(uuid.uuid4()),
        "code": code,
        "master_token": str(uuid.uuid4()),
        "created_at": now_iso(),
        "active": True,
    }
    await db.rooms.insert_one(dict(room))
    return CreateRoomResponse(room_code=code, master_token=room["master_token"])


@api_router.get("/rooms/{code}")
async def get_room(code: str):
    room = await db.rooms.find_one({"code": code.upper()}, {"_id": 0, "master_token": 0})
    if not room:
        raise HTTPException(404, "Stanza non trovata")
    players = await db.players.find(
        {"room_code": code.upper()},
        {"_id": 0, "id": 1, "name": 1, "joined_at": 1, "online": 1},
    ).to_list(500)
    images = await db.images.find(
        {"room_code": code.upper()},
        {"_id": 0, "id": 1, "url": 1, "caption": 1, "source": 1, "created_at": 1, "room_code": 1},
    ).sort("created_at", 1).to_list(1000)
    return {"room": room, "players": players, "images": images}


@api_router.post("/rooms/join", response_model=JoinRoomResponse)
async def join_room(req: JoinRoomRequest):
    code = req.code.upper().strip()
    name = req.name.strip()
    if not name:
        raise HTTPException(400, "Nome richiesto")
    room = await db.rooms.find_one({"code": code, "active": True})
    if not room:
        raise HTTPException(404, "Stanza non trovata o chiusa")
    player = {
        "id": str(uuid.uuid4()),
        "room_code": code,
        "name": name,
        "joined_at": now_iso(),
        "online": True,
    }
    await db.players.insert_one(dict(player))
    return JoinRoomResponse(player_id=player["id"], room_code=code, name=name)


@api_router.post("/rooms/{code}/images")
async def send_image(code: str, req: SendImageRequest, x_master_token: Optional[str] = Header(None)):
    code = code.upper()
    room = await db.rooms.find_one({"code": code, "active": True})
    if not room:
        raise HTTPException(404, "Stanza non trovata")
    if room["master_token"] != x_master_token:
        raise HTTPException(403, "Non autorizzato")
    image = {
        "id": str(uuid.uuid4()),
        "room_code": code,
        "url": req.url,
        "caption": req.caption or "",
        "source": req.source or "url",
        "created_at": now_iso(),
    }
    await db.images.insert_one(dict(image))
    await manager.broadcast(code, {"type": "image", "data": image})
    return image


@api_router.post("/rooms/{code}/upload")
async def upload_image(code: str, file: UploadFile = File(...), x_master_token: Optional[str] = Header(None)):
    code = code.upper()
    room = await db.rooms.find_one({"code": code, "active": True})
    if not room:
        raise HTTPException(404, "Stanza non trovata")
    if room["master_token"] != x_master_token:
        raise HTTPException(403, "Non autorizzato")

    ext = (file.filename or "file").split(".")[-1].lower() if "." in (file.filename or "") else "bin"
    allowed = {"jpg", "jpeg", "png", "gif", "webp"}
    if ext not in allowed:
        raise HTTPException(400, "Formato non supportato")
    path = f"{APP_NAME}/rooms/{code}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(400, "File troppo grande (max 15MB)")
    result = put_object(path, data, file.content_type or f"image/{ext}")
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "room_code": code,
        "original_filename": file.filename,
        "content_type": file.content_type or f"image/{ext}",
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": now_iso(),
    })
    return {"storage_path": result["path"]}


@api_router.get("/files/{path:path}")
async def download_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File non trovato")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type", content_type))


@api_router.post("/rooms/{code}/close")
async def close_room(code: str, x_master_token: Optional[str] = Header(None)):
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room:
        raise HTTPException(404, "Stanza non trovata")
    if room["master_token"] != x_master_token:
        raise HTTPException(403, "Non autorizzato")
    await db.rooms.update_one({"code": code}, {"$set": {"active": False}})
    await manager.broadcast(code, {"type": "room_closed"})
    return {"ok": True}


# ------------- WebSocket -------------
@app.websocket("/api/ws/{code}")
async def websocket_endpoint(websocket: WebSocket, code: str, role: str = Query("player"), id: str = Query("")):
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room:
        await websocket.close(code=4404)
        return
    await manager.connect(websocket, code, role, id)
    # notify presence
    await manager.broadcast(code, {"type": "presence_join", "role": role, "id": id})
    # send current online count
    online = len([c for c in manager.rooms.get(code, []) if c["role"] == "player"])
    await manager.broadcast(code, {"type": "presence_count", "players": online})
    try:
        while True:
            msg = await websocket.receive_text()
            # optional ping
            try:
                data = json.loads(msg)
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, code)
        online = len([c for c in manager.rooms.get(code, []) if c["role"] == "player"])
        await manager.broadcast(code, {"type": "presence_leave", "role": role, "id": id})
        await manager.broadcast(code, {"type": "presence_count", "players": online})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# ... (tutto il tuo codice precedente) ...

# --- INTEGRAZIONE FRONTEND ---
# 1. Definiamo il percorso della cartella 'dist' che verrà creata dal build del frontend
frontend_dist_path = Path(__file__).parent.parent / "frontend" / "build"

# 2. Serviamo i file statici (JS, CSS, Immagini)
# Importante: va messo DOPO app.include_router(api_router) così non sovrascrive le API
if frontend_dist_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist_path), html=True), name="frontend")

    # 3. Gestiamo il "Fallback": se l'utente ricarica una pagina del frontend, 
    # FastAPI deve mandargli index.html invece di dare 404
    @app.exception_handler(404)
    async def fallback_to_index(request, exc):
        return FileResponse(frontend_dist_path / "index.html")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
