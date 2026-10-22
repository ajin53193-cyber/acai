"""Backend tests for iter_10: agent online/offline status, status-log reports, auto-offline,
assignment preference for online agents, admin status-log + stats online flag, and agent-side
quick-reply library CRUD (shared library with creator tracking).

Credentials: admin/Heying@2026, agent01/Pass@123. BASE_URL from REACT_APP_BACKEND_URL.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


# -------- fixtures --------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"username": "admin", "password": "Heying@2026"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def agent_token():
    r = requests.post(f"{API}/cs/agent/login", json={"username": "agent01", "password": "Pass@123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def agent_h(agent_token):
    return {"Authorization": f"Bearer {agent_token}"}


@pytest.fixture(scope="module")
def agent_id(agent_h):
    r = requests.get(f"{API}/cs/agent/me", headers=agent_h)
    assert r.status_code == 200
    return r.json()["id"]


# -------- 1. Status toggle + persistence + heartbeat --------
class TestAgentStatus:
    def test_set_online(self, agent_h):
        r = requests.post(f"{API}/cs/agent/status", json={"online": True}, headers=agent_h)
        assert r.status_code == 200
        assert r.json()["online"] is True

    def test_me_returns_online_true(self, agent_h):
        r = requests.get(f"{API}/cs/agent/me", headers=agent_h)
        assert r.status_code == 200
        assert r.json()["online"] is True

    def test_sessions_returns_online_flag_and_heartbeat(self, agent_h):
        r = requests.get(f"{API}/cs/agent/sessions", headers=agent_h)
        assert r.status_code == 200
        data = r.json()
        assert data.get("online") is True
        assert "sessions" in data

    def test_duplicate_online_no_extra_log(self, agent_h):
        # before count
        r0 = requests.get(f"{API}/cs/agent/status-log?days=1", headers=agent_h)
        before = sum(len(d["segments"]) for d in r0.json()["days"])
        # same state twice
        requests.post(f"{API}/cs/agent/status", json={"online": True}, headers=agent_h)
        requests.post(f"{API}/cs/agent/status", json={"online": True}, headers=agent_h)
        r1 = requests.get(f"{API}/cs/agent/status-log?days=1", headers=agent_h)
        after = sum(len(d["segments"]) for d in r1.json()["days"])
        assert after == before, f"segments count changed {before}->{after} on duplicate online"

    def test_status_log_shape(self, agent_h):
        r = requests.get(f"{API}/cs/agent/status-log?days=7", headers=agent_h)
        assert r.status_code == 200
        days = r.json()["days"]
        # API returns one row per (date, agent) with activity; may be < 7
        assert isinstance(days, list)
        if days:
            d0 = days[0]
            for k in ["date", "first_online", "last_offline", "online_minutes", "segments", "online_now"]:
                assert k in d0, f"missing key {k}"
            assert isinstance(d0["segments"], list)


# -------- 2. Auto-offline when stale --------
def test_auto_offline_when_stale_sync(agent_h, agent_id):
    # ensure online first
    r = requests.post(f"{API}/cs/agent/status", json={"online": True}, headers=agent_h)
    assert r.status_code == 200 and r.json()["online"] is True

    async def _mutate():
        cli = AsyncIOMotorClient(MONGO_URL)
        try:
            stale = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
            res = await cli[DB_NAME].cs_agents.update_one({"id": agent_id}, {"$set": {"last_seen_at": stale}})
            assert res.matched_count == 1
        finally:
            cli.close()
    asyncio.run(_mutate())

    r = requests.get(f"{API}/cs/agent/me", headers=agent_h)
    assert r.status_code == 200
    assert r.json()["online"] is False, "should auto-offline after 5m stale"

    # Verify an auto:true offline entry was inserted into the raw log collection
    async def _check():
        cli = AsyncIOMotorClient(MONGO_URL)
        try:
            logs = await cli[DB_NAME].cs_agent_status_log.find(
                {"agent_id": agent_id, "action": "offline", "auto": True}
            ).to_list(50)
            return logs
        finally:
            cli.close()
    auto_logs = asyncio.run(_check())
    assert len(auto_logs) >= 1, f"no auto:true offline log inserted (got {auto_logs})"


# -------- 3. Assignment: prefer online agent, fallback to any enabled --------
class TestAssignment:
    @pytest.fixture
    def temp_agent(self, admin_h):
        payload = {"name": "TEST_online_agent", "avatar": "", "username": "TEST_agent_online",
                   "password": "Pass@123", "weight": 1, "enabled": True, "remark": "tmp"}
        r = requests.post(f"{API}/admin/cs/agents", json=payload, headers=admin_h)
        assert r.status_code == 201, r.text
        aid = r.json()["id"]
        yield aid, "TEST_agent_online"
        requests.delete(f"{API}/admin/cs/agents/{aid}", headers=admin_h)

    def test_fallback_when_no_online_agent(self, agent_h):
        # force agent01 offline
        requests.post(f"{API}/cs/agent/status", json={"online": False}, headers=agent_h)
        sid = "test-" + uuid.uuid4().hex
        r = requests.post(f"{API}/cs/start", json={"session_id": sid})
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("agent") is not None, "no fallback agent assigned"

    def test_prefer_online_agent(self, admin_h, agent_h, temp_agent):
        aid, uname = temp_agent
        # agent01 offline, temp agent online
        requests.post(f"{API}/cs/agent/status", json={"online": False}, headers=agent_h)
        r = requests.post(f"{API}/cs/agent/login", json={"username": uname, "password": "Pass@123"})
        tok = r.json()["token"]
        th = {"Authorization": f"Bearer {tok}"}
        r = requests.post(f"{API}/cs/agent/status", json={"online": True}, headers=th)
        assert r.status_code == 200

        # start 3 sessions - all should go to the only online agent
        assigned = []
        for _ in range(3):
            sid = "test-" + uuid.uuid4().hex
            r = requests.post(f"{API}/cs/start", json={"session_id": sid})
            assert r.status_code in (200, 201)
            assigned.append(r.json()["agent"]["id"])
        assert all(a == aid for a in assigned), f"expected all->{aid} got {assigned}"


# -------- 4. Admin status-log + stats --------
class TestAdminStatus:
    def test_admin_status_log_requires_auth(self):
        r = requests.get(f"{API}/admin/cs/status-log?days=7")
        assert r.status_code in (401, 403)  # FastAPI HTTPBearer returns 403 when missing

    def test_admin_status_log_shape(self, admin_h):
        r = requests.get(f"{API}/admin/cs/status-log?days=7", headers=admin_h)
        assert r.status_code == 200
        data = r.json()
        assert "days" in data and "online_now" in data
        assert isinstance(data["days"], list) and isinstance(data["online_now"], list)

    def test_admin_stats_contains_online_flag(self, admin_h):
        r = requests.get(f"{API}/admin/cs/stats", headers=admin_h)
        assert r.status_code == 200
        agents = r.json()["agents"]
        assert len(agents) >= 1
        for a in agents:
            assert "online" in a and isinstance(a["online"], bool)


# -------- 5. Agent quick-reply library --------
class TestAgentQRLibrary:
    created_id = None

    def test_create_requires_text_or_image(self, agent_h):
        r = requests.post(f"{API}/cs/agent/quick-replies",
                          json={"group": "TEST_grp", "text": "", "image": ""}, headers=agent_h)
        assert r.status_code == 400

    def test_create_own(self, agent_h):
        r = requests.post(f"{API}/cs/agent/quick-replies",
                          json={"group": "TEST_grp", "text": "TEST hello"}, headers=agent_h)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["text"] == "TEST hello"
        assert data["group"] == "TEST_grp"
        assert "created_by" in data
        TestAgentQRLibrary.created_id = data["id"]

    def test_list_shows_own_item_with_me(self, agent_h):
        r = requests.get(f"{API}/cs/agent/quick-replies", headers=agent_h)
        assert r.status_code == 200
        data = r.json()
        assert "replies" in data and "me" in data
        ids = [x["id"] for x in data["replies"]]
        assert TestAgentQRLibrary.created_id in ids

    def test_cannot_delete_admin_item(self, agent_h, admin_h):
        # create admin item
        r = requests.post(f"{API}/admin/cs/quick-replies",
                          json={"group": "TEST_admin_grp", "text": "admin item"}, headers=admin_h)
        assert r.status_code == 201
        admin_id = r.json()["id"]
        # agent attempts delete
        r = requests.delete(f"{API}/cs/agent/quick-replies/{admin_id}", headers=agent_h)
        assert r.status_code == 403
        # cleanup via admin
        requests.delete(f"{API}/admin/cs/quick-replies/{admin_id}", headers=admin_h)

    def test_delete_own(self, agent_h):
        assert TestAgentQRLibrary.created_id
        r = requests.delete(f"{API}/cs/agent/quick-replies/{TestAgentQRLibrary.created_id}",
                            headers=agent_h)
        assert r.status_code == 200


# -------- 6. Leave agent01 ONLINE at the end (per instructions) --------
def test_zz_leave_agent_online(agent_h):
    r = requests.post(f"{API}/cs/agent/status", json={"online": True}, headers=agent_h)
    assert r.status_code == 200
    assert r.json()["online"] is True
