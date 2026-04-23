import os
import io
import json
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://passive-image-stream.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("http", "ws")


@pytest.fixture(scope="module")
def room():
    r = requests.post(f"{API}/rooms", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "room_code" in data and "master_token" in data
    assert len(data["room_code"]) == 6
    return data


def test_root():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200


def test_get_room_info_no_token_leak(room):
    r = requests.get(f"{API}/rooms/{room['room_code']}", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "room" in data and "players" in data and "images" in data
    assert "master_token" not in data["room"]


def test_get_room_invalid():
    r = requests.get(f"{API}/rooms/ZZZZZZ", timeout=10)
    assert r.status_code == 404


def test_join_invalid_code():
    r = requests.post(f"{API}/rooms/join", json={"code": "ZZZZZZ", "name": "Luca"}, timeout=10)
    assert r.status_code == 404


def test_join_empty_name(room):
    r = requests.post(f"{API}/rooms/join", json={"code": room["room_code"], "name": "  "}, timeout=10)
    assert r.status_code == 400


def test_join_success(room):
    r = requests.post(f"{API}/rooms/join", json={"code": room["room_code"], "name": "TEST_Luca"}, timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["room_code"] == room["room_code"]
    assert d["name"] == "TEST_Luca"
    assert "player_id" in d
    # verify persisted
    r2 = requests.get(f"{API}/rooms/{room['room_code']}", timeout=10).json()
    assert any(p["name"] == "TEST_Luca" for p in r2["players"])


def test_send_image_wrong_token(room):
    r = requests.post(
        f"{API}/rooms/{room['room_code']}/images",
        headers={"X-Master-Token": "wrong"},
        json={"url": "https://picsum.photos/600/400", "caption": "c", "source": "url"},
        timeout=10,
    )
    assert r.status_code == 403


def test_send_image_invalid_code(room):
    r = requests.post(
        f"{API}/rooms/ZZZZZZ/images",
        headers={"X-Master-Token": room["master_token"]},
        json={"url": "https://picsum.photos/600/400", "caption": "c", "source": "url"},
        timeout=10,
    )
    assert r.status_code == 404


def test_send_image_success_and_persist(room):
    payload = {"url": "https://picsum.photos/600/400", "caption": "hello", "source": "url"}
    r = requests.post(
        f"{API}/rooms/{room['room_code']}/images",
        headers={"X-Master-Token": room["master_token"]},
        json=payload, timeout=15,
    )
    assert r.status_code == 200, r.text
    img = r.json()
    assert img["caption"] == "hello"
    assert img["source"] == "url"
    # verify in history
    hist = requests.get(f"{API}/rooms/{room['room_code']}", timeout=10).json()["images"]
    assert any(i["id"] == img["id"] for i in hist)


def test_upload_and_download(room):
    # 1x1 PNG
    png = bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C636000010000000500010D0A2DB40000000049454E44AE426082"
    )
    files = {"file": ("test.png", png, "image/png")}
    r = requests.post(
        f"{API}/rooms/{room['room_code']}/upload",
        headers={"X-Master-Token": room["master_token"]},
        files=files, timeout=60,
    )
    assert r.status_code == 200, r.text
    sp = r.json()["storage_path"]
    # download
    r2 = requests.get(f"{API}/files/{sp}", timeout=30)
    assert r2.status_code == 200
    assert "image" in r2.headers.get("Content-Type", "")
    assert len(r2.content) > 0


def test_upload_wrong_token(room):
    files = {"file": ("a.png", b"x", "image/png")}
    r = requests.post(
        f"{API}/rooms/{room['room_code']}/upload",
        headers={"X-Master-Token": "bad"},
        files=files, timeout=30,
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_websocket_image_broadcast(room):
    code = room["room_code"]
    url = f"{WS_BASE}/api/ws/{code}?role=player&id=tester"
    async with websockets.connect(url) as ws:
        # Wait briefly for presence messages
        await asyncio.sleep(0.5)
        # Master posts an image
        def _post():
            return requests.post(
                f"{API}/rooms/{code}/images",
                headers={"X-Master-Token": room["master_token"]},
                json={"url": "https://picsum.photos/300/200", "caption": "ws", "source": "url"},
                timeout=15,
            )
        loop = asyncio.get_event_loop()
        fut = loop.run_in_executor(None, _post)
        got_image = False
        try:
            for _ in range(15):
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                msg = json.loads(raw)
                if msg.get("type") == "image":
                    assert msg["data"]["caption"] == "ws"
                    got_image = True
                    break
        finally:
            await fut
        assert got_image


def test_close_room_wrong_token(room):
    r = requests.post(f"{API}/rooms/{room['room_code']}/close", headers={"X-Master-Token": "bad"}, timeout=10)
    assert r.status_code == 403


def test_close_room_success(room):
    r = requests.post(f"{API}/rooms/{room['room_code']}/close", headers={"X-Master-Token": room["master_token"]}, timeout=10)
    assert r.status_code == 200
    # join should now fail
    r2 = requests.post(f"{API}/rooms/join", json={"code": room["room_code"], "name": "After"}, timeout=10)
    assert r2.status_code == 404
