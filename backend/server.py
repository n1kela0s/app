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
    category: str = "neutral"  # ally | enemy | neutral

class OverlayRequest(BaseModel):
    url: str
    caption: str = ""

class InitiativeRequest(BaseModel):
    initiative: Optional[int] = None  # None per resettare

class TurnUpdate(BaseModel):
    round: int = 1
    active_id: Optional[str] = None
    round_end: bool = False
    active: bool = True  # False = exit turn mode

# --- 4. GESTORE CONNESSIONI WEBSOCKET ---
class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, List[dict]] = {}
        self.turn_state: Dict[str, dict] = {}  # ultimo stato turno per room

    async def connect(self, ws: WebSocket, room_code: str, role: str, cid: str):
        await ws.accept()
        self.rooms.setdefault(room_code, []).append({"ws": ws, "role": role, "id": cid})
        # Su connessione player, invia stato turno corrente (se presente)
        cached = self.turn_state.get(room_code)
        if cached:
            try:
                await ws.send_json({"type": "turn_state", "data": cached})
            except Exception:
                pass

    def disconnect(self, ws: WebSocket, room_code: str):
        if room_code in self.rooms:
            self.rooms[room_code] = [c for c in self.rooms[room_code] if c["ws"] is not ws]
            if not self.rooms[room_code]:
                del self.rooms[room_code]
                # NB: non rimuoviamo turn_state cache: i player che si riconnettono devono trovarlo

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
    images = await db.images.find({"room_code": code}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # Backfill default fields for legacy records
    for img in images:
        img.setdefault("category", "neutral")
        img.setdefault("active", True)
        img.setdefault("initiative", None)
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
    
    category = req.category if req.category in ("ally", "enemy", "neutral") else "neutral"
    image = {
        "id": str(uuid.uuid4()), 
        "room_code": code, 
        "url": req.url, 
        "caption": req.caption, 
        "source": req.source, 
        "category": category,
        "active": True,
        "initiative": None,
        "created_at": now_iso()
    }
    
    # Qui MongoDB inserisce forzatamente image["_id"] = ObjectId(...)
    await db.images.insert_one(image)
    
    # CANCELLIAMO l'ObjectId prima di inviarlo al broadcast e ritornarlo
    if "_id" in image:
        del image["_id"]
        
    await manager.broadcast(code, {"type": "image", "data": image})
    return image


@api_router.post("/rooms/{code}/images/{image_id}/remove")
async def remove_image_from_field(code: str, image_id: str, x_master_token: Optional[str] = Header(None)):
    """Rimuove un Pokémon dal campo (resta in cronologia come inattivo)."""
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room or room["master_token"] != x_master_token:
        raise HTTPException(403, "Accesso negato")
    result = await db.images.update_one(
        {"id": image_id, "room_code": code},
        {"$set": {"active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Pokémon non trovato")
    await manager.broadcast(code, {"type": "image_removed_field", "id": image_id})
    return {"ok": True, "id": image_id}


@api_router.delete("/rooms/{code}/images/{image_id}")
async def delete_image(code: str, image_id: str, x_master_token: Optional[str] = Header(None)):
    """Elimina completamente un Pokémon (campo e cronologia)."""
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room or room["master_token"] != x_master_token:
        raise HTTPException(403, "Accesso negato")
    result = await db.images.delete_one({"id": image_id, "room_code": code})
    if result.deleted_count == 0:
        raise HTTPException(404, "Pokémon non trovato")
    await manager.broadcast(code, {"type": "image_deleted", "id": image_id})
    return {"ok": True, "id": image_id}


@api_router.delete("/rooms/{code}/images")
async def clear_history(code: str, x_master_token: Optional[str] = Header(None)):
    """Pulisce tutta la cronologia e il campo."""
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room or room["master_token"] != x_master_token:
        raise HTTPException(403, "Accesso negato")
    await db.images.delete_many({"room_code": code})
    await manager.broadcast(code, {"type": "history_cleared"})
    return {"ok": True}


@api_router.patch("/rooms/{code}/images/{image_id}/initiative")
async def set_initiative(code: str, image_id: str, req: InitiativeRequest, x_master_token: Optional[str] = Header(None)):
    """Imposta o rimuove il valore di iniziativa di un Pokémon."""
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room or room["master_token"] != x_master_token:
        raise HTTPException(403, "Accesso negato")
    value = req.initiative
    if value is not None:
        try:
            value = int(value)
        except (TypeError, ValueError):
            raise HTTPException(400, "Iniziativa non valida")
    result = await db.images.update_one(
        {"id": image_id, "room_code": code},
        {"$set": {"initiative": value}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Pokémon non trovato")
    await manager.broadcast(code, {"type": "image_initiative_updated", "id": image_id, "initiative": value})
    return {"ok": True, "id": image_id, "initiative": value}


@api_router.post("/rooms/{code}/turn")
async def update_turn(code: str, req: TurnUpdate, x_master_token: Optional[str] = Header(None)):
    """Aggiorna lo stato del turno e fa broadcast a tutti i client."""
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room or room["master_token"] != x_master_token:
        raise HTTPException(403, "Accesso negato")
    payload = {
        "active": req.active,
        "round": max(1, int(req.round)),
        "active_id": req.active_id,
        "round_end": bool(req.round_end),
    }
    # Cache sul server per sync nuovi player
    if payload["active"]:
        manager.turn_state[code] = payload
    else:
        manager.turn_state.pop(code, None)
    await manager.broadcast(code, {"type": "turn_state", "data": payload})
    return {"ok": True, **payload}


@api_router.post("/rooms/{code}/overlay")
async def show_overlay(code: str, req: OverlayRequest, x_master_token: Optional[str] = Header(None)):
    """Mostra un'immagine overlay a tutti i giocatori (non persistita)."""
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room or room["master_token"] != x_master_token:
        raise HTTPException(403, "Accesso negato")
    if not req.url.strip():
        raise HTTPException(400, "URL mancante")
    payload = {
        "id": str(uuid.uuid4()),
        "url": req.url.strip(),
        "caption": req.caption,
        "created_at": now_iso(),
    }
    await manager.broadcast(code, {"type": "overlay_show", "data": payload})
    return payload


@api_router.delete("/rooms/{code}/overlay")
async def hide_overlay(code: str, x_master_token: Optional[str] = Header(None)):
    """Chiude l'overlay per tutti i giocatori."""
    code = code.upper()
    room = await db.rooms.find_one({"code": code})
    if not room or room["master_token"] != x_master_token:
        raise HTTPException(403, "Accesso negato")
    await manager.broadcast(code, {"type": "overlay_hide"})
    return {"ok": True}

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

# IL CORS VA MESSO PRIMA DI OGNI ALTRA COSA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True, # Aggiunto per stabilità
    allow_methods=["*"],
    allow_headers=["*"],
)

# Poi includi il router delle API
app.include_router(api_router)

# --- 9. INTEGRAZIONE FRONTEND ---
# Spostiamo il frontend alla fine di tutto
frontend_path = Path(__file__).resolve().parent.parent / "frontend" / "build"

if frontend_path.exists():
    # Mount delle cartelle statiche (js, css)
    app.mount("/static", StaticFiles(directory=str(frontend_path / "static")), name="static")
    
    # Gestione delle rotte frontend (SPA)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Se la rotta inizia con api o ws, non servire index.html (lascia gestire ai router sopra)
        if full_path.startswith("api"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        
        index_file = frontend_path / "index.html"
        return FileResponse(index_file)
else:
    logger.warning(f"Frontend non trovato in: {frontend_path}")

@app.on_event("startup")
async def startup():
    init_storage()

@app.on_event("shutdown")
async def shutdown():
    client.close()

@app.on_event("shutdown")
async def shutdown():
    client.close()
