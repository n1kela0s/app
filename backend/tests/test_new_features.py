"""Tests for new Proietta features:
   - category categorisation (ally/neutral/enemy)
   - remove-from-field (active=false)
   - delete image
   - clear history
   - WebSocket broadcasts for these ops
   - master-token protection
"""
import os
import json
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://6f33ddd6-9f3e-497f-a4ba-99ef811367e3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"

PIKACHU_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png"


# ---------- Fixtures ----------
@pytest.fixture
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def room(session):
    r = session.post(f"{API}/rooms")
    assert r.status_code == 200
    data = r.json()
    return data["room_code"], data["master_token"]


def _send(session, code, token, category="neutral", caption="TEST_P"):
    return session.post(
        f"{API}/rooms/{code}/images",
        json={"url": PIKACHU_URL, "caption": caption, "source": "pokemon", "category": category},
        headers={"X-Master-Token": token},
    )


# ---------- Create room ----------
def test_create_room(session):
    r = session.post(f"{API}/rooms")
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d.get("room_code"), str) and len(d["room_code"]) == 6
    assert isinstance(d.get("master_token"), str) and len(d["master_token"]) > 10


# ---------- send_image with category ----------
@pytest.mark.parametrize("cat", ["ally", "neutral", "enemy"])
def test_send_image_with_category(session, room, cat):
    code, token = room
    r = _send(session, code, token, category=cat)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["category"] == cat
    assert d["active"] is True
    assert d["url"] == PIKACHU_URL
    assert "id" in d

    # Verify persistence via GET
    g = session.get(f"{API}/rooms/{code}")
    assert g.status_code == 200
    images = g.json()["images"]
    assert any(i["id"] == d["id"] and i["category"] == cat and i["active"] is True for i in images)


def test_send_image_invalid_category_defaults_neutral(session, room):
    code, token = room
    r = _send(session, code, token, category="bogus")
    assert r.status_code == 200
    assert r.json()["category"] == "neutral"


def test_send_image_requires_master_token(session, room):
    code, _ = room
    r = session.post(
        f"{API}/rooms/{code}/images",
        json={"url": PIKACHU_URL, "caption": "x", "source": "pokemon", "category": "ally"},
    )
    assert r.status_code == 403

    r2 = session.post(
        f"{API}/rooms/{code}/images",
        json={"url": PIKACHU_URL, "caption": "x", "source": "pokemon", "category": "ally"},
        headers={"X-Master-Token": "wrong"},
    )
    assert r2.status_code == 403


# ---------- remove-from-field ----------
def test_remove_from_field_sets_inactive(session, room):
    code, token = room
    img = _send(session, code, token, category="ally").json()
    r = session.post(f"{API}/rooms/{code}/images/{img['id']}/remove", headers={"X-Master-Token": token})
    assert r.status_code == 200
    assert r.json()["ok"] is True

    g = session.get(f"{API}/rooms/{code}").json()
    found = [i for i in g["images"] if i["id"] == img["id"]]
    assert len(found) == 1
    assert found[0]["active"] is False  # still present


def test_remove_requires_master_token(session, room):
    code, token = room
    img = _send(session, code, token).json()
    r = session.post(f"{API}/rooms/{code}/images/{img['id']}/remove")
    assert r.status_code == 403
    r2 = session.post(f"{API}/rooms/{code}/images/{img['id']}/remove", headers={"X-Master-Token": "bad"})
    assert r2.status_code == 403


def test_remove_missing_image_returns_404(session, room):
    code, token = room
    r = session.post(f"{API}/rooms/{code}/images/nonexistent/remove", headers={"X-Master-Token": token})
    assert r.status_code == 404


# ---------- delete image ----------
def test_delete_image_removes_completely(session, room):
    code, token = room
    img = _send(session, code, token, category="enemy").json()
    r = session.delete(f"{API}/rooms/{code}/images/{img['id']}", headers={"X-Master-Token": token})
    assert r.status_code == 200
    g = session.get(f"{API}/rooms/{code}").json()
    assert not any(i["id"] == img["id"] for i in g["images"])


def test_delete_requires_master_token(session, room):
    code, token = room
    img = _send(session, code, token).json()
    r = session.delete(f"{API}/rooms/{code}/images/{img['id']}")
    assert r.status_code == 403


def test_delete_missing_returns_404(session, room):
    code, token = room
    r = session.delete(f"{API}/rooms/{code}/images/nope", headers={"X-Master-Token": token})
    assert r.status_code == 404


# ---------- clear history ----------
def test_clear_history_empties_room(session, room):
    code, token = room
    for c in ("ally", "neutral", "enemy"):
        _send(session, code, token, category=c)
    g = session.get(f"{API}/rooms/{code}").json()
    assert len(g["images"]) == 3

    r = session.delete(f"{API}/rooms/{code}/images", headers={"X-Master-Token": token})
    assert r.status_code == 200

    g2 = session.get(f"{API}/rooms/{code}").json()
    assert g2["images"] == []


def test_clear_history_requires_master_token(session, room):
    code, _ = room
    r = session.delete(f"{API}/rooms/{code}/images")
    assert r.status_code == 403


# ---------- GET backfill for legacy records ----------
def test_get_room_backfills_category_and_active(session, room):
    code, token = room
    img = _send(session, code, token, category="ally").json()
    g = session.get(f"{API}/rooms/{code}").json()
    for i in g["images"]:
        assert "category" in i
        assert "active" in i


# ---------- WebSocket broadcasts ----------
@pytest.mark.asyncio
async def test_websocket_broadcasts_all_events():
    """Create room, connect as player via WS, then perform: send, remove, delete, clear.
    Verify each broadcast type is received in order."""
    s = requests.Session()
    r = s.post(f"{API}/rooms")
    code = r.json()["room_code"]
    token = r.json()["master_token"]

    uri = f"{WS_BASE}/{code}?role=player&id=TESTWS"
    async with websockets.connect(uri) as ws:
        # Consume the presence_count broadcast that happens on connect
        try:
            first = json.loads(await asyncio.wait_for(ws.recv(), 3))
            assert first["type"] == "presence_count"
        except asyncio.TimeoutError:
            pass

        # --- 1) send_image -> "image" with category
        r1 = s.post(
            f"{API}/rooms/{code}/images",
            json={"url": PIKACHU_URL, "caption": "ws-test", "source": "pokemon", "category": "ally"},
            headers={"X-Master-Token": token, "Content-Type": "application/json"},
        )
        assert r1.status_code == 200
        img_id = r1.json()["id"]

        msg = json.loads(await asyncio.wait_for(ws.recv(), 5))
        assert msg["type"] == "image"
        assert msg["data"]["category"] == "ally"
        assert msg["data"]["active"] is True
        assert msg["data"]["id"] == img_id

        # --- 2) remove -> "image_removed_field"
        r2 = s.post(f"{API}/rooms/{code}/images/{img_id}/remove",
                    headers={"X-Master-Token": token})
        assert r2.status_code == 200
        msg2 = json.loads(await asyncio.wait_for(ws.recv(), 5))
        assert msg2["type"] == "image_removed_field"
        assert msg2["id"] == img_id

        # --- 3) delete -> "image_deleted"
        r3 = s.delete(f"{API}/rooms/{code}/images/{img_id}",
                      headers={"X-Master-Token": token})
        assert r3.status_code == 200
        msg3 = json.loads(await asyncio.wait_for(ws.recv(), 5))
        assert msg3["type"] == "image_deleted"
        assert msg3["id"] == img_id

        # --- 4) clear -> "history_cleared"
        # seed one more so clear actually has impact
        s.post(
            f"{API}/rooms/{code}/images",
            json={"url": PIKACHU_URL, "caption": "x", "source": "pokemon", "category": "enemy"},
            headers={"X-Master-Token": token, "Content-Type": "application/json"},
        )
        await asyncio.wait_for(ws.recv(), 5)  # drain the 'image' event
        r4 = s.delete(f"{API}/rooms/{code}/images", headers={"X-Master-Token": token})
        assert r4.status_code == 200
        msg4 = json.loads(await asyncio.wait_for(ws.recv(), 5))
        assert msg4["type"] == "history_cleared"
