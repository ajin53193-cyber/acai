"""Backend tests for agent session handover feature (iter_12).

Covers:
- Manual offline -> handover count + system message + agent swap on GET messages
- Lazy handover via POST /cs/{sid}/message when assigned agent offline
- Lazy handover via POST /cs/{sid}/faq
- No-online-agent case: no handover
- Auto-offline via stale last_seen_at + cs/agent/me call
- Admin DELETE agent reassigns sessions
- Agent library edit/delete without created_by restriction
"""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_USER = "admin"
ADMIN_PASS = "Heying@2026"
AGENT01_USER = "agent01"
AGENT01_PASS = "Pass@123"

TMP_SUFFIX = uuid.uuid4().hex[:6]
TMP_AGENT_USERNAME = f"tmp_{TMP_SUFFIX}"
TMP_AGENT_PASS = "Pass@123"


# ------------------------- fixtures -------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def mongo_db():
    cli = MongoClient(MONGO_URL)
    yield cli[DB_NAME]
    cli.close()


@pytest.fixture(scope="module")
def temp_agent(admin_h, mongo_db):
    body = {"name": f"临时客服{TMP_SUFFIX}", "username": TMP_AGENT_USERNAME,
            "password": TMP_AGENT_PASS, "avatar": "", "enabled": True, "weight": 1}
    r = requests.post(f"{API}/admin/cs/agents", json=body, headers=admin_h, timeout=15)
    assert r.status_code == 201, r.text
    data = r.json()
    tmp_id = data.get("id") or data.get("agent", {}).get("id")
    if not tmp_id:
        doc = mongo_db.cs_agents.find_one({"username": TMP_AGENT_USERNAME})
        assert doc, "temp agent not persisted"
        tmp_id = doc["id"]
    yield tmp_id
    # cleanup: delete the temp agent at module teardown (if still present)
    requests.delete(f"{API}/admin/cs/agents/{tmp_id}", headers=admin_h, timeout=15)
    # ensure agent01 is online at end
    tok = _agent_login(AGENT01_USER, AGENT01_PASS)
    requests.post(f"{API}/cs/agent/status", json={"online": True},
                  headers={"Authorization": f"Bearer {tok}"}, timeout=15)


def _agent_login(user, pw):
    r = requests.post(f"{API}/cs/agent/login", json={"username": user, "password": pw}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _agent_set_online(token, online=True):
    r = requests.post(f"{API}/cs/agent/status", json={"online": online},
                      headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _start_session(sid=None):
    sid = sid or f"TEST_HO_{uuid.uuid4().hex[:16]}"
    body = {"session_id": sid, "slug": "", "source": "test", "referrer": "", "visitor_id": "vhandover"}
    r = requests.post(f"{API}/cs/start", json=body, timeout=15)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data.get("enabled") is True
    return sid, data["agent"]


def _get_messages(sid):
    r = requests.get(f"{API}/cs/{sid}/messages", timeout=15)
    assert r.status_code == 200
    return r.json()


# ------------------------- tests -------------------------
class TestHandover:
    def test_01_setup_temp_agent_and_logins(self, temp_agent):
        """Temp agent is created and both agents can login."""
        tok_a = _agent_login(AGENT01_USER, AGENT01_PASS)
        tok_t = _agent_login(TMP_AGENT_USERNAME, TMP_AGENT_PASS)
        assert tok_a and tok_t
        _agent_set_online(tok_a, True)
        _agent_set_online(tok_t, True)

    def test_02_manual_offline_handover(self, temp_agent):
        """Take the assigned agent offline -> handover>=1, agent swapped, system msg inserted."""
        tok_a = _agent_login(AGENT01_USER, AGENT01_PASS)
        tok_t = _agent_login(TMP_AGENT_USERNAME, TMP_AGENT_PASS)
        _agent_set_online(tok_a, True); _agent_set_online(tok_t, True)

        sid, agent = _start_session()
        assigned_id = agent["id"]
        # offline the assigned agent
        if assigned_id == temp_agent:
            offline_tok = tok_t; other_id = None  # agent01
        else:
            offline_tok = tok_a; other_id = temp_agent

        res = requests.post(f"{API}/cs/agent/status", json={"online": False},
                            headers={"Authorization": f"Bearer {offline_tok}"}, timeout=15).json()
        assert res["handover"] >= 1, f"expected handover>=1 got {res}"

        msgs = _get_messages(sid)
        assert msgs["agent"] is not None
        assert msgs["agent"]["id"] != assigned_id, "agent must swap"
        system_msgs = [m for m in msgs["messages"] if m.get("via") == "system"]
        assert system_msgs, "system handover message expected"
        assert "继续为您服务" in system_msgs[-1]["text"]

        # new agent should see the session in /cs/agent/sessions
        new_agent_tok = tok_a if msgs["agent"]["id"] != temp_agent else tok_t
        r = requests.get(f"{API}/cs/agent/sessions",
                         headers={"Authorization": f"Bearer {new_agent_tok}"}, timeout=15)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json().get("sessions", [])]
        assert sid in ids
        # bring offline agent back online for next tests
        _agent_set_online(offline_tok, True)

    def test_03_lazy_handover_on_visitor_message(self, temp_agent):
        tok_a = _agent_login(AGENT01_USER, AGENT01_PASS)
        tok_t = _agent_login(TMP_AGENT_USERNAME, TMP_AGENT_PASS)
        _agent_set_online(tok_a, True); _agent_set_online(tok_t, True)
        sid, agent = _start_session()
        assigned_id = agent["id"]

        # Take the assigned one offline WITHOUT triggering immediate handover:
        # the status endpoint runs handover_sessions on explicit offline too, so we expect it to move.
        # To test LAZY handover we instead flip the agent offline directly in Mongo (no handover run).
        # But we don't have direct DB handle here except via fixture; use fixture.
        pytest.skip("covered by test_03b using direct DB flip")

    def test_03b_lazy_handover_visitor_msg(self, temp_agent, mongo_db):
        tok_a = _agent_login(AGENT01_USER, AGENT01_PASS)
        tok_t = _agent_login(TMP_AGENT_USERNAME, TMP_AGENT_PASS)
        _agent_set_online(tok_a, True); _agent_set_online(tok_t, True)
        sid, agent = _start_session()
        assigned_id = agent["id"]
        other_id = temp_agent if assigned_id != temp_agent else _agent01_id(mongo_db)

        # Directly flip assigned agent offline in DB (bypass handover endpoint)
        mongo_db.cs_agents.update_one({"id": assigned_id}, {"$set": {"online": False}})

        # Visitor sends a message - lazy handover should trigger inside ensure_online_agent
        r = requests.post(f"{API}/cs/{sid}/message", json={"text": "你好 lazy", "image": ""}, timeout=15)
        assert r.status_code == 201, r.text

        msgs = _get_messages(sid)
        assert msgs["agent"]["id"] == other_id, f"expected swap to {other_id}, got {msgs['agent']['id']}"
        assert any(m.get("via") == "system" for m in msgs["messages"])

        # new agent sees unread_agent >=1
        new_tok = tok_a if other_id != temp_agent else tok_t
        r = requests.get(f"{API}/cs/agent/sessions",
                         headers={"Authorization": f"Bearer {new_tok}"}, timeout=15)
        row = next((s for s in r.json().get("sessions", []) if s["id"] == sid), None)
        assert row and row.get("unread_agent", 0) >= 1

        # restore both online
        mongo_db.cs_agents.update_one({"id": assigned_id}, {"$set": {"online": True, "last_seen_at": datetime.now(timezone.utc).isoformat()}})

    def test_04_lazy_handover_faq_click(self, temp_agent, mongo_db):
        tok_a = _agent_login(AGENT01_USER, AGENT01_PASS)
        tok_t = _agent_login(TMP_AGENT_USERNAME, TMP_AGENT_PASS)
        _agent_set_online(tok_a, True); _agent_set_online(tok_t, True)

        # ensure at least one FAQ configured
        cfg = requests.get(f"{API}/admin/cs/config",
                           headers={"Authorization": f"Bearer {_admin_tok()}"}, timeout=15).json()
        if not cfg.get("faqs"):
            pytest.skip("no faqs configured; skipping")

        sid, agent = _start_session()
        assigned_id = agent["id"]
        other_id = temp_agent if assigned_id != temp_agent else _agent01_id(mongo_db)
        mongo_db.cs_agents.update_one({"id": assigned_id}, {"$set": {"online": False}})

        r = requests.post(f"{API}/cs/{sid}/faq", json={"index": 0}, timeout=15)
        assert r.status_code == 201, r.text

        msgs = _get_messages(sid)
        assert msgs["agent"]["id"] == other_id
        assert any(m.get("via") == "system" for m in msgs["messages"])
        mongo_db.cs_agents.update_one({"id": assigned_id}, {"$set": {"online": True, "last_seen_at": datetime.now(timezone.utc).isoformat()}})

    def test_05_no_online_agent_no_handover(self, temp_agent, mongo_db):
        tok_a = _agent_login(AGENT01_USER, AGENT01_PASS)
        tok_t = _agent_login(TMP_AGENT_USERNAME, TMP_AGENT_PASS)
        _agent_set_online(tok_a, True); _agent_set_online(tok_t, True)
        sid, agent = _start_session()
        assigned_id = agent["id"]

        # flip BOTH offline directly in DB
        mongo_db.cs_agents.update_many({"id": {"$in": [temp_agent, _agent01_id(mongo_db)]}},
                                       {"$set": {"online": False}})
        msgs_before = _get_messages(sid)
        before_sys = sum(1 for m in msgs_before["messages"] if m.get("via") == "system")

        r = requests.post(f"{API}/cs/{sid}/message", json={"text": "nobody online", "image": ""}, timeout=15)
        assert r.status_code == 201
        msgs_after = _get_messages(sid)
        assert msgs_after["agent"]["id"] == assigned_id, "agent should NOT change when no one online"
        after_sys = sum(1 for m in msgs_after["messages"] if m.get("via") == "system")
        assert after_sys == before_sys, "no new system handover message expected"
        # restore
        mongo_db.cs_agents.update_many({"id": {"$in": [temp_agent, _agent01_id(mongo_db)]}},
                                       {"$set": {"online": True, "last_seen_at": datetime.now(timezone.utc).isoformat()}})

    def test_06_auto_offline_stale_heartbeat(self, temp_agent, mongo_db):
        tok_a = _agent_login(AGENT01_USER, AGENT01_PASS)
        tok_t = _agent_login(TMP_AGENT_USERNAME, TMP_AGENT_PASS)
        _agent_set_online(tok_a, True); _agent_set_online(tok_t, True)
        sid, agent = _start_session()
        assigned_id = agent["id"]
        other_id = temp_agent if assigned_id != temp_agent else _agent01_id(mongo_db)

        # force assigned agent's last_seen_at to 10 minutes ago
        stale = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        mongo_db.cs_agents.update_one({"id": assigned_id}, {"$set": {"last_seen_at": stale}})

        # Trigger auto-offline by hitting /cs/agent/me with assigned agent's token
        if assigned_id == temp_agent:
            tok = tok_t
        else:
            tok = tok_a
        r = requests.get(f"{API}/cs/agent/me",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 200
        # after auto-offline + handover, session should belong to other_id
        time.sleep(0.5)
        msgs = _get_messages(sid)
        assert msgs["agent"]["id"] == other_id, f"auto-offline handover failed: {msgs['agent']['id']}"
        assert any(m.get("via") == "system" for m in msgs["messages"])
        # restore the previously stale agent back online for the next test (login refreshes heartbeat)
        _agent_set_online(tok, True)

    def test_07_admin_delete_agent_reassigns(self, admin_h, mongo_db):
        """Create a one-off temp agent, give it a session, delete it, verify sessions reassigned."""
        tmp2_user = f"tmp2_{uuid.uuid4().hex[:5]}"
        body = {"name": f"二号客服{tmp2_user}", "username": tmp2_user, "password": "Pass@123",
                "avatar": "", "enabled": True, "weight": 1}
        r = requests.post(f"{API}/admin/cs/agents", json=body, headers=admin_h, timeout=15)
        assert r.status_code == 201
        tmp2_id = (r.json().get("id") or
                   (mongo_db.cs_agents.find_one({"username": tmp2_user}) or {}).get("id"))
        assert tmp2_id

        # bring agent01 offline so tmp2 is the only online -> session will get assigned to tmp2
        tok_a = _agent_login(AGENT01_USER, AGENT01_PASS)
        tok_2 = _agent_login(tmp2_user, "Pass@123")
        _agent_set_online(tok_2, True)
        mongo_db.cs_agents.update_one({"id": _agent01_id(mongo_db)}, {"$set": {"online": False}})

        sid, agent = _start_session()
        assert agent["id"] == tmp2_id, f"expected tmp2 to pick, got {agent['id']}"

        # bring agent01 back online so delete can reassign; make it the ONLY other online agent
        _agent_set_online(tok_a, True)
        # take the module-level temp_agent offline (via Mongo flip, no handover) so only agent01 remains online
        mongo_db.cs_agents.update_one({"username": TMP_AGENT_USERNAME}, {"$set": {"online": False}})

        r = requests.delete(f"{API}/admin/cs/agents/{tmp2_id}", headers=admin_h, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("handover", 0) >= 1

        # verify session reassigned to agent01 via Mongo (admin/cs/sessions is paginated)
        sess_doc = mongo_db.cs_sessions.find_one({"id": sid})
        assert sess_doc and sess_doc["agent_id"] == _agent01_id(mongo_db), \
            f"session not reassigned to agent01: {sess_doc.get('agent_id') if sess_doc else None}"
        # restore module temp_agent online for cleanup
        tok_t = _agent_login(TMP_AGENT_USERNAME, TMP_AGENT_PASS)
        _agent_set_online(tok_t, True)

    def test_08_agent_edit_delete_any_qr(self, admin_h, mongo_db):
        tok_a = _agent_login(AGENT01_USER, AGENT01_PASS)
        agent_h = {"Authorization": f"Bearer {tok_a}"}

        # pick an admin-created (no created_by) item
        qrs = requests.get(f"{API}/cs/agent/quick-replies", headers=agent_h, timeout=15).json()["replies"]
        admin_qr = next((q for q in qrs if not q.get("created_by") and q.get("text")), None)
        if not admin_qr:
            # create one from admin to test edit
            r = requests.post(f"{API}/admin/cs/quick-replies",
                              json={"group": "测试", "text": "iter12_原始", "image": ""},
                              headers=admin_h, timeout=15)
            assert r.status_code == 201
            admin_qr = r.json()
            created_for_test = True
        else:
            created_for_test = False

        original = {"group": admin_qr["group"], "text": admin_qr["text"], "image": admin_qr.get("image", "")}
        new_text = original["text"] + "_edited"
        r = requests.put(f"{API}/cs/agent/quick-replies/{admin_qr['id']}",
                         json={"group": original["group"], "text": new_text, "image": original["image"]},
                         headers=agent_h, timeout=15)
        assert r.status_code == 200, r.text
        # verify
        qrs2 = requests.get(f"{API}/cs/agent/quick-replies", headers=agent_h, timeout=15).json()["replies"]
        row = next(q for q in qrs2 if q["id"] == admin_qr["id"])
        assert row["text"] == new_text
        # restore (or delete if we created)
        if created_for_test:
            r = requests.delete(f"{API}/cs/agent/quick-replies/{admin_qr['id']}", headers=agent_h, timeout=15)
            assert r.status_code == 200
        else:
            r = requests.put(f"{API}/cs/agent/quick-replies/{admin_qr['id']}",
                             json=original, headers=agent_h, timeout=15)
            assert r.status_code == 200

        # agent creates then deletes own item
        r = requests.post(f"{API}/cs/agent/quick-replies",
                          json={"group": "测试", "text": "iter12_tmp", "image": ""},
                          headers=agent_h, timeout=15)
        assert r.status_code == 201
        tmp_qr_id = r.json()["id"]
        r = requests.delete(f"{API}/cs/agent/quick-replies/{tmp_qr_id}", headers=agent_h, timeout=15)
        assert r.status_code == 200

        # unknown id -> 404
        r = requests.delete(f"{API}/cs/agent/quick-replies/does-not-exist-{uuid.uuid4().hex[:4]}",
                            headers=agent_h, timeout=15)
        assert r.status_code == 404

    def test_09_final_cleanup_agent01_online(self, temp_agent, mongo_db):
        tok_a = _agent_login(AGENT01_USER, AGENT01_PASS)
        _agent_set_online(tok_a, True)
        # only check orphans among sessions created by THIS test run (TEST_HO_ prefix)
        orphan_agent_ids = set()
        agent_ids = {a["id"] for a in mongo_db.cs_agents.find({}, {"_id": 0, "id": 1})}
        for s in mongo_db.cs_sessions.find({"id": {"$regex": "^TEST_HO_"}}, {"_id": 0, "id": 1, "agent_id": 1}):
            aid = s.get("agent_id")
            if aid and aid not in agent_ids:
                orphan_agent_ids.add(aid)
        assert not orphan_agent_ids, f"TEST_HO_* sessions point to deleted agents: {orphan_agent_ids}"


# helpers
def _admin_tok():
    r = requests.post(f"{API}/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    return r.json()["token"]


def _agent01_id(db):
    doc = db.cs_agents.find_one({"username": AGENT01_USER})
    assert doc, "agent01 not found"
    return doc["id"]
