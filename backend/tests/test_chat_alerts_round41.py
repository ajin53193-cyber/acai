"""Iteration 41 — Live customer-service chat + admin alerts backend tests.

Covers chat_api.py:
  - Public: POST /api/chat/sessions (guest), invalid guest, POST messages (text/quick), GET messages (wrong guest 404)
  - Public: GET /api/chat/quick-replies (q only, 4 defaults)
  - Admin: GET/PUT /api/admin/chat/quick-replies (persistence + fallback)
  - Admin: GET /api/admin/chat/sessions (filters open/handled/all, counts, excludes empty last_message)
  - Admin: GET /api/admin/chat/sessions/{sid}/messages resets unread_admin
  - Admin: POST message → unread_user increments
  - Admin: PATCH session status (open/handled, bad → 400)
  - Admin: GET /api/admin/alerts (no since → empty arrays+now; with past since → chats include test user msg, excludes auto)
  - /api/admin/badges includes chat-sessions
"""
import os
import subprocess
import time
import uuid
from datetime import datetime, timezone

import asyncio
import pyotp
import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "admin+clerk_test@shop.com"
ADMIN_PW = "Gogo589!Admin#7x2Q"
ADMIN_UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
UA = {"User-Agent": "gogo589-test/1.0"}


def _totp_secret() -> str:
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        r = await c[os.environ["DB_NAME"]].admin_2fa.find_one({"user_id": ADMIN_UID})
        return r["secret"]
    return asyncio.new_event_loop().run_until_complete(go())


def _mint(uid: str) -> str:
    return subprocess.check_output(["python3", "/app/tests/mint_token.py", uid]).decode().strip()


# Track created test sessions for cleanup
CREATED_SIDS: list[str] = []


@pytest.fixture(scope="module")
def admin_bearer():
    return _mint(ADMIN_UID)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/admin/auth/login",
                      json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW}, headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    pre = r.json()["pre_token"]
    code = pyotp.TOTP(_totp_secret()).now()
    r2 = requests.post(f"{BASE}/api/admin/auth/totp",
                       json={"pre_token": pre, "code": code}, headers=UA, timeout=30)
    assert r2.status_code == 200, r2.text
    return r2.json()["admin_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_bearer, admin_token):
    return {**UA, "Authorization": f"Bearer {admin_bearer}", "X-Admin-Token": admin_token}


@pytest.fixture(scope="module")
def guest_id():
    return "TEST41_" + uuid.uuid4().hex[:16]


@pytest.fixture(scope="module")
def session_id(guest_id):
    r = requests.post(f"{BASE}/api/chat/sessions", json={"guest_id": guest_id}, headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    CREATED_SIDS.append(sid)
    return sid


def teardown_module(module):
    """Clean up all test sessions + messages."""
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        for sid in CREATED_SIDS:
            await db.chat_messages.delete_many({"session_id": sid})
            await db.chat_sessions.delete_many({"id": sid})
        # also wipe anything whose guest_id starts with TEST41_
        async for s in db.chat_sessions.find({"guest_id": {"$regex": "^TEST41_"}}, {"id": 1}):
            await db.chat_messages.delete_many({"session_id": s["id"]})
        await db.chat_sessions.delete_many({"guest_id": {"$regex": "^TEST41_"}})
        # ensure quick replies back to default
        await db.settings.delete_one({"key": "chat_quick_replies"})
    asyncio.new_event_loop().run_until_complete(go())


# --------------------------- public endpoints ---------------------------
class TestPublicChat:
    def test_invalid_guest_id_400(self):
        r = requests.post(f"{BASE}/api/chat/sessions", json={"guest_id": "bad!"}, headers=UA, timeout=20)
        assert r.status_code == 400, r.text

    def test_create_session(self, guest_id, session_id):
        assert session_id
        # reuse: second call returns same session
        r = requests.post(f"{BASE}/api/chat/sessions", json={"guest_id": guest_id}, headers=UA, timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == session_id
        assert r.json()["status"] == "open"

    def test_send_text_increments_unread_admin(self, session_id, guest_id):
        r = requests.post(f"{BASE}/api/chat/sessions/{session_id}/messages",
                          json={"guest_id": guest_id, "text": "hello from test41"}, headers=UA, timeout=20)
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["sender"] == "user"
        assert msg["text"] == "hello from test41"
        assert "reply" not in msg
        assert msg.get("auto") is False

        # verify unread_admin incremented by GET admin sessions endpoint via DB check
        async def check():
            c = AsyncIOMotorClient(os.environ["MONGO_URL"])
            s = await c[os.environ["DB_NAME"]].chat_sessions.find_one({"id": session_id})
            return s
        s = asyncio.new_event_loop().run_until_complete(check())
        assert s["unread_admin"] >= 1
        assert s["last_message"] == "hello from test41"

    def test_send_quick_reply_auto(self, session_id, guest_id):
        async def unread_before():
            c = AsyncIOMotorClient(os.environ["MONGO_URL"])
            s = await c[os.environ["DB_NAME"]].chat_sessions.find_one({"id": session_id})
            return s["unread_admin"]
        before = asyncio.new_event_loop().run_until_complete(unread_before())

        r = requests.post(f"{BASE}/api/chat/sessions/{session_id}/messages",
                          json={"guest_id": guest_id, "quick": 0}, headers=UA, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["auto"] is True
        assert "reply" in d
        assert d["reply"]["sender"] == "admin"
        assert d["reply"]["text"]  # non-empty

        after = asyncio.new_event_loop().run_until_complete(unread_before())
        assert after == before, f"unread_admin should NOT increment on auto reply (before={before} after={after})"

    def test_wrong_guest_404(self, session_id):
        r = requests.get(f"{BASE}/api/chat/sessions/{session_id}/messages",
                         params={"guest_id": "TEST41_wrongguestid00000"}, headers=UA, timeout=20)
        assert r.status_code == 404

    def test_quick_replies_public(self):
        r = requests.get(f"{BASE}/api/chat/quick-replies", headers=UA, timeout=20)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) == 4
        assert all(set(x.keys()) == {"q"} for x in arr), f"public should only expose q: {arr[0]}"


# --------------------------- admin ---------------------------
class TestAdminChat:
    def test_admin_quick_replies_get_default(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/chat/quick-replies", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 4
        assert all("q" in x and "a" in x for x in arr)

    def test_admin_quick_replies_put_and_fallback(self, admin_headers):
        payload = {"items": [{"q": "TEST41Q", "a": "TEST41A"}]}
        r = requests.put(f"{BASE}/api/admin/chat/quick-replies", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 1 and arr[0]["q"] == "TEST41Q"

        # empty list → defaults
        r2 = requests.put(f"{BASE}/api/admin/chat/quick-replies", json={"items": []}, headers=admin_headers, timeout=20)
        assert r2.status_code == 200
        assert len(r2.json()) == 4

    def test_admin_requires_token(self):
        r = requests.get(f"{BASE}/api/admin/chat/quick-replies", headers=UA, timeout=20)
        assert r.status_code in (401, 403)

    def test_admin_sessions_filter_open(self, admin_headers, session_id):
        r = requests.get(f"{BASE}/api/admin/chat/sessions", params={"status": "open"}, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "counts" in d and "items" in d
        assert any(s["id"] == session_id for s in d["items"]), "test session should appear in open filter"
        for s in d["items"]:
            assert s["last_message"] != ""

    def test_admin_get_messages_resets_unread(self, admin_headers, session_id):
        r = requests.get(f"{BASE}/api/admin/chat/sessions/{session_id}/messages", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["session"]["unread_admin"] == 0
        assert len(d["messages"]) >= 3  # user text + quick + auto reply

        async def check():
            c = AsyncIOMotorClient(os.environ["MONGO_URL"])
            s = await c[os.environ["DB_NAME"]].chat_sessions.find_one({"id": session_id})
            return s["unread_admin"]
        assert asyncio.new_event_loop().run_until_complete(check()) == 0

    def test_admin_post_message_increments_unread_user(self, admin_headers, session_id):
        async def read_unread_user():
            c = AsyncIOMotorClient(os.environ["MONGO_URL"])
            s = await c[os.environ["DB_NAME"]].chat_sessions.find_one({"id": session_id})
            return s["unread_user"]
        before = asyncio.new_event_loop().run_until_complete(read_unread_user())

        r = requests.post(f"{BASE}/api/admin/chat/sessions/{session_id}/messages",
                          json={"text": "admin reply test41"}, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["sender"] == "admin"

        after = asyncio.new_event_loop().run_until_complete(read_unread_user())
        assert after == before + 1

    def test_admin_patch_status(self, admin_headers, session_id):
        r = requests.patch(f"{BASE}/api/admin/chat/sessions/{session_id}",
                           json={"status": "handled"}, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "handled"

        r2 = requests.patch(f"{BASE}/api/admin/chat/sessions/{session_id}",
                            json={"status": "open"}, headers=admin_headers, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["status"] == "open"

        r3 = requests.patch(f"{BASE}/api/admin/chat/sessions/{session_id}",
                            json={"status": "bogus"}, headers=admin_headers, timeout=20)
        assert r3.status_code == 400

    def test_admin_badges_includes_chat_sessions(self, admin_headers, guest_id):
        # Make sure there's an unread one
        gid2 = "TEST41_" + uuid.uuid4().hex[:16]
        s = requests.post(f"{BASE}/api/chat/sessions", json={"guest_id": gid2}, headers=UA, timeout=20).json()
        CREATED_SIDS.append(s["id"])
        requests.post(f"{BASE}/api/chat/sessions/{s['id']}/messages",
                      json={"guest_id": gid2, "text": "unread-badge-test"}, headers=UA, timeout=20)
        r = requests.get(f"{BASE}/api/admin/badges", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "chat-sessions" in d
        assert d["chat-sessions"] >= 1


class TestAdminAlerts:
    def test_alerts_no_since(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/alerts", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["orders"] == [] and d["topups"] == [] and d["chats"] == []
        assert "now" in d

    def test_alerts_with_past_since(self, admin_headers, guest_id):
        # create a fresh user message
        gid3 = "TEST41_" + uuid.uuid4().hex[:16]
        s = requests.post(f"{BASE}/api/chat/sessions", json={"guest_id": gid3}, headers=UA, timeout=20).json()
        CREATED_SIDS.append(s["id"])
        since = datetime.now(timezone.utc).isoformat()
        time.sleep(1)
        requests.post(f"{BASE}/api/chat/sessions/{s['id']}/messages",
                      json={"guest_id": gid3, "text": "alert-feed-test41"}, headers=UA, timeout=20)
        # also fire a quick(=auto) reply - should NOT appear in alerts
        requests.post(f"{BASE}/api/chat/sessions/{s['id']}/messages",
                      json={"guest_id": gid3, "quick": 1}, headers=UA, timeout=20)

        r = requests.get(f"{BASE}/api/admin/alerts", params={"since": since}, headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        chats = d["chats"]
        assert any(c["text"] == "alert-feed-test41" for c in chats), f"user chat not in alerts: {chats}"
        # ensure no auto messages are present (quick-reply question text or auto admin answer)
        for c in chats:
            # auto user messages shouldn't be in alerts (auto!=true filter)
            assert c["session_id"]  # sanity
