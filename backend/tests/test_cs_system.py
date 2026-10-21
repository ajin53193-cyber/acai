"""
In-app multi-seat customer service (客服) system tests.
Covers: public config, start/round-robin, visitor/agent message round trip,
agent auth, agent sessions/messages isolation, per-agent quick replies,
admin CRUD + config + stats, fallback when disabled.
"""
import os
import uuid
import time
import pytest
import requests

def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return url.rstrip("/")


BASE_URL = _load_base_url()
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "Heying@2026"
AGENT_USER = "agent01"
AGENT_PASS = "Pass@123"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def agent_token():
    r = requests.post(f"{API}/cs/agent/login", json={"username": AGENT_USER, "password": AGENT_PASS}, timeout=15)
    assert r.status_code == 200, f"agent login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def agent_headers(agent_token):
    return {"Authorization": f"Bearer {agent_token}"}


@pytest.fixture(scope="module")
def created_agents(admin_headers):
    """Track agents created by tests so we can clean up."""
    ids = []
    yield ids
    for aid in ids:
        try:
            requests.delete(f"{API}/admin/cs/agents/{aid}", headers=admin_headers, timeout=10)
        except Exception:
            pass


def _sid():
    return "sess_" + uuid.uuid4().hex[:16]


# ---------- 1. Public config ----------
class TestPublicConfig:
    def test_cs_config_enabled(self):
        r = requests.get(f"{API}/cs/config", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["enabled"] is True
        assert isinstance(d["welcome"], str) and len(d["welcome"]) > 0


# ---------- 2. Visitor start + session persistence ----------
class TestVisitorStart:
    def test_start_creates_session_and_welcome(self):
        sid = _sid()
        r = requests.post(f"{API}/cs/start",
                          json={"session_id": sid, "slug": "about", "source": "promo", "referrer": "", "visitor_id": "v_test"},
                          headers={"X-Forwarded-For": "1.2.3.4"}, timeout=15)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["enabled"] is True
        assert d["session_id"] == sid
        assert d["agent"] and d["agent"].get("name")
        assert d["welcome"]
        # visitor messages should include welcome (as agent sender)
        r2 = requests.get(f"{API}/cs/{sid}/messages", timeout=10)
        assert r2.status_code == 200
        msgs = r2.json()["messages"]
        assert len(msgs) >= 1
        assert msgs[0]["sender"] == "agent"
        assert msgs[0]["text"] == d["welcome"]

    def test_start_same_session_returns_same_agent(self):
        sid = _sid()
        r1 = requests.post(f"{API}/cs/start", json={"session_id": sid, "slug": "about"}, timeout=10)
        assert r1.status_code == 201
        a1 = r1.json()["agent"]["id"]
        r2 = requests.post(f"{API}/cs/start", json={"session_id": sid, "slug": "about"}, timeout=10)
        assert r2.status_code in (200, 201)
        a2 = r2.json()["agent"]["id"]
        assert a1 == a2

    def test_start_short_session_id_rejected(self):
        r = requests.post(f"{API}/cs/start", json={"session_id": "short", "slug": "about"}, timeout=10)
        assert r.status_code == 422


# ---------- 3. Weighted round-robin ----------
class TestRoundRobin:
    def test_weighted_distribution(self, admin_headers, created_agents):
        # Create 2 extra agents with weights 1 and 3; disable all other agents temporarily.
        # Instead of toggling existing agents, we'll just measure proportional assignment across
        # all currently-enabled agents by creating 2 new ones that dominate assignment via weight.
        # To make assertion deterministic, disable agent01 for the duration.
        # 1. find agent01 id
        rl = requests.get(f"{API}/admin/cs/agents", headers=admin_headers, timeout=10)
        assert rl.status_code == 200
        agents = rl.json()["agents"]
        agent01 = next((a for a in agents if a["username"] == AGENT_USER), None)
        assert agent01

        # Disable agent01 (and all other currently-enabled agents) so only our 2 test agents receive.
        originally_enabled = [a for a in agents if a.get("enabled")]
        for a in originally_enabled:
            upd = {
                "name": a["name"], "avatar": a.get("avatar", ""), "username": a["username"],
                "password": "", "weight": a.get("weight", 1), "enabled": False, "remark": a.get("remark", ""),
            }
            requests.put(f"{API}/admin/cs/agents/{a['id']}", json=upd, headers=admin_headers, timeout=10)

        try:
            # Create two test agents
            def mk(name, uname, weight):
                r = requests.post(f"{API}/admin/cs/agents", headers=admin_headers, timeout=10, json={
                    "name": name, "avatar": "", "username": uname, "password": "TestPass@1",
                    "weight": weight, "enabled": True, "remark": "TEST_RR"
                })
                assert r.status_code == 201, r.text
                return r.json()["id"]

            uname_a = f"TEST_rr_a_{uuid.uuid4().hex[:6]}"
            uname_b = f"TEST_rr_b_{uuid.uuid4().hex[:6]}"
            id_a = mk("TEST_A_w1", uname_a, 1)
            id_b = mk("TEST_B_w3", uname_b, 3)
            created_agents.extend([id_a, id_b])

            counts = {id_a: 0, id_b: 0}
            N = 16
            for _ in range(N):
                sid = _sid()
                r = requests.post(f"{API}/cs/start", json={"session_id": sid, "slug": "about"}, timeout=10)
                assert r.status_code == 201, r.text
                aid = r.json()["agent"]["id"]
                if aid in counts:
                    counts[aid] += 1

            # Expect ~ 1:3 ratio => A should be ~4, B ~12. Allow slack.
            total = counts[id_a] + counts[id_b]
            assert total == N, f"not all assigned to test agents: {counts}"
            # B (weight 3) must receive strictly more than A
            assert counts[id_b] > counts[id_a], f"weighted assignment failed: {counts}"
            # B share roughly >= 60%
            assert counts[id_b] / N >= 0.6, f"B share too low: {counts}"
        finally:
            # Re-enable the originally enabled agents
            for a in originally_enabled:
                upd = {
                    "name": a["name"], "avatar": a.get("avatar", ""), "username": a["username"],
                    "password": "", "weight": a.get("weight", 1), "enabled": True, "remark": a.get("remark", ""),
                }
                requests.put(f"{API}/admin/cs/agents/{a['id']}", json=upd, headers=admin_headers, timeout=10)


# ---------- 4. Visitor <-> agent message round trip ----------
class TestMessageRoundTrip:
    def test_round_trip(self, agent_headers):
        sid = _sid()
        r = requests.post(f"{API}/cs/start", json={"session_id": sid, "slug": "about"}, timeout=10,
                          headers={"X-Forwarded-For": "9.9.9.9"})
        assert r.status_code == 201
        assigned_agent_id = r.json()["agent"]["id"]

        # Visitor sends
        r = requests.post(f"{API}/cs/{sid}/message", json={"text": "Hello from visitor"}, timeout=10)
        assert r.status_code == 201

        # Agent must be able to see it only if session is assigned to them.
        # Our hard-coded agent_headers is for agent01. If RR assigned to someone else,
        # we need to log in as that agent. Simplest: re-login agent01 only if they were assigned.
        # To avoid flakiness, we'll log in as the assigned agent via admin to get their info.
        # Simpler: skip if not agent01.
        me = requests.get(f"{API}/cs/agent/me", headers=agent_headers, timeout=10).json()
        if me["id"] != assigned_agent_id:
            pytest.skip("session assigned to a different agent; round-trip tested only when agent01 receives it")

        sess_resp = requests.get(f"{API}/cs/agent/sessions", headers=agent_headers, timeout=10)
        assert sess_resp.status_code == 200
        sess_ids = [s["id"] for s in sess_resp.json()["sessions"]]
        assert sid in sess_ids

        # unread_agent should be >=1 before agent reads
        session_row = next(s for s in sess_resp.json()["sessions"] if s["id"] == sid)
        assert session_row.get("unread_agent", 0) >= 1

        # Agent gets messages
        mresp = requests.get(f"{API}/cs/agent/sessions/{sid}/messages", headers=agent_headers, timeout=10)
        assert mresp.status_code == 200
        texts = [m["text"] for m in mresp.json()["messages"]]
        assert "Hello from visitor" in texts
        # visitor meta present
        assert "visitor" in mresp.json()
        assert "ip" in mresp.json()["visitor"]

        # Agent replies
        rr = requests.post(f"{API}/cs/agent/sessions/{sid}/reply", json={"text": "Hi, agent here"}, headers=agent_headers, timeout=10)
        assert rr.status_code == 201

        # Visitor fetches new messages
        vresp = requests.get(f"{API}/cs/{sid}/messages", timeout=10)
        assert vresp.status_code == 200
        v_msgs = vresp.json()["messages"]
        agent_texts = [m["text"] for m in v_msgs if m["sender"] == "agent"]
        assert "Hi, agent here" in agent_texts

        # No duplicates
        ids = [m["id"] for m in v_msgs]
        assert len(ids) == len(set(ids)), "duplicate message ids"


# ---------- 5. Agent auth ----------
class TestAgentAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/cs/agent/login", json={"username": AGENT_USER, "password": AGENT_PASS}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d
        assert d["agent"]["name"]

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/cs/agent/login", json={"username": AGENT_USER, "password": "wrong!!"}, timeout=10)
        assert r.status_code == 401

    def test_me_requires_token(self):
        r = requests.get(f"{API}/cs/agent/me", timeout=10)
        assert r.status_code in (401, 403)

    def test_me_invalid_token(self):
        r = requests.get(f"{API}/cs/agent/me", headers={"Authorization": "Bearer invalid.token.here"}, timeout=10)
        assert r.status_code == 401

    def test_me_ok(self, agent_headers):
        r = requests.get(f"{API}/cs/agent/me", headers=agent_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] and d["name"]
        assert "quick_replies" in d


# ---------- 6. Agent session isolation ----------
class TestAgentIsolation:
    def test_agent_cannot_read_others_session(self, admin_headers, agent_headers, created_agents):
        # Create another agent and a session assigned to them by disabling agent01 temporarily.
        rl = requests.get(f"{API}/admin/cs/agents", headers=admin_headers, timeout=10).json()["agents"]
        agent01 = next(a for a in rl if a["username"] == AGENT_USER)

        # disable all enabled except we create new
        originally_enabled = [a for a in rl if a.get("enabled")]
        for a in originally_enabled:
            upd = {"name": a["name"], "avatar": a.get("avatar", ""), "username": a["username"],
                   "password": "", "weight": a.get("weight", 1), "enabled": False, "remark": a.get("remark", "")}
            requests.put(f"{API}/admin/cs/agents/{a['id']}", json=upd, headers=admin_headers, timeout=10)

        try:
            uname = f"TEST_iso_{uuid.uuid4().hex[:6]}"
            cr = requests.post(f"{API}/admin/cs/agents", headers=admin_headers, json={
                "name": "TEST_iso", "avatar": "", "username": uname, "password": "TestPass@1",
                "weight": 1, "enabled": True, "remark": "TEST"
            }, timeout=10)
            assert cr.status_code == 201
            new_id = cr.json()["id"]
            created_agents.append(new_id)

            # create a session (will be assigned to the only enabled agent = new agent)
            sid = _sid()
            r = requests.post(f"{API}/cs/start", json={"session_id": sid, "slug": "about"}, timeout=10)
            assert r.status_code == 201
            assert r.json()["agent"]["id"] == new_id

            # Re-enable agent01 so it can log in
            upd01 = {"name": agent01["name"], "avatar": agent01.get("avatar", ""), "username": agent01["username"],
                     "password": "", "weight": agent01.get("weight", 1), "enabled": True, "remark": agent01.get("remark", "")}
            requests.put(f"{API}/admin/cs/agents/{agent01['id']}", json=upd01, headers=admin_headers, timeout=10)

            # agent01 should get 404 when trying to read other agent's session
            r = requests.get(f"{API}/cs/agent/sessions/{sid}/messages", headers=agent_headers, timeout=10)
            assert r.status_code == 404

            r2 = requests.post(f"{API}/cs/agent/sessions/{sid}/reply", headers=agent_headers,
                               json={"text": "should not work"}, timeout=10)
            assert r2.status_code == 404
        finally:
            for a in originally_enabled:
                upd = {"name": a["name"], "avatar": a.get("avatar", ""), "username": a["username"],
                       "password": "", "weight": a.get("weight", 1), "enabled": True, "remark": a.get("remark", "")}
                requests.put(f"{API}/admin/cs/agents/{a['id']}", json=upd, headers=admin_headers, timeout=10)


# ---------- 7. Per-agent quick replies ----------
class TestQuickReplies:
    def test_save_and_fetch(self, agent_headers):
        replies = ["你好，有什么可以帮您？", "请稍等，正在为您查询", "感谢您的咨询"]
        r = requests.put(f"{API}/cs/agent/quick-replies", json={"replies": replies}, headers=agent_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["replies"] == replies
        me = requests.get(f"{API}/cs/agent/me", headers=agent_headers, timeout=10).json()
        assert me["quick_replies"] == replies

    def test_requires_auth(self):
        r = requests.put(f"{API}/cs/agent/quick-replies", json={"replies": ["x"]}, timeout=10)
        assert r.status_code in (401, 403)


# ---------- 8. Admin agent CRUD ----------
class TestAdminAgentCRUD:
    def test_requires_admin_token(self):
        r = requests.get(f"{API}/admin/cs/agents", timeout=10)
        assert r.status_code in (401, 403)

    def test_list_no_password_hash(self, admin_headers):
        r = requests.get(f"{API}/admin/cs/agents", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        for a in r.json()["agents"]:
            assert "password_hash" not in a

    def test_create_duplicate_username_rejected(self, admin_headers, created_agents):
        uname = f"TEST_dup_{uuid.uuid4().hex[:6]}"
        r1 = requests.post(f"{API}/admin/cs/agents", headers=admin_headers, json={
            "name": "T", "avatar": "", "username": uname, "password": "TestPass@1",
            "weight": 1, "enabled": True, "remark": ""
        }, timeout=10)
        assert r1.status_code == 201
        created_agents.append(r1.json()["id"])
        r2 = requests.post(f"{API}/admin/cs/agents", headers=admin_headers, json={
            "name": "T2", "avatar": "", "username": uname, "password": "TestPass@1",
            "weight": 1, "enabled": True, "remark": ""
        }, timeout=10)
        assert r2.status_code == 400

    def test_update_empty_password_keeps(self, admin_headers, created_agents):
        uname = f"TEST_upd_{uuid.uuid4().hex[:6]}"
        r1 = requests.post(f"{API}/admin/cs/agents", headers=admin_headers, json={
            "name": "T", "avatar": "", "username": uname, "password": "OrigPass@1",
            "weight": 1, "enabled": True, "remark": ""
        }, timeout=10)
        assert r1.status_code == 201
        aid = r1.json()["id"]
        created_agents.append(aid)
        # update with empty password
        r2 = requests.put(f"{API}/admin/cs/agents/{aid}", headers=admin_headers, json={
            "name": "T_new", "avatar": "", "username": uname, "password": "",
            "weight": 2, "enabled": True, "remark": "r"
        }, timeout=10)
        assert r2.status_code == 200
        # original password still works
        lr = requests.post(f"{API}/cs/agent/login", json={"username": uname, "password": "OrigPass@1"}, timeout=10)
        assert lr.status_code == 200

    def test_delete(self, admin_headers):
        uname = f"TEST_del_{uuid.uuid4().hex[:6]}"
        r1 = requests.post(f"{API}/admin/cs/agents", headers=admin_headers, json={
            "name": "T", "avatar": "", "username": uname, "password": "TestPass@1",
            "weight": 1, "enabled": True, "remark": ""
        }, timeout=10)
        aid = r1.json()["id"]
        rd = requests.delete(f"{API}/admin/cs/agents/{aid}", headers=admin_headers, timeout=10)
        assert rd.status_code == 200
        # verify absent from list
        rl = requests.get(f"{API}/admin/cs/agents", headers=admin_headers, timeout=10).json()["agents"]
        assert not any(a["id"] == aid for a in rl)


# ---------- 9. Admin CS config + stats ----------
class TestAdminConfigStats:
    def test_get_config(self, admin_headers):
        r = requests.get(f"{API}/admin/cs/config", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "welcome" in d and "enabled" in d

    def test_set_config_roundtrip(self, admin_headers):
        orig = requests.get(f"{API}/admin/cs/config", headers=admin_headers, timeout=10).json()
        try:
            new_welcome = "测试欢迎语 TEST_" + uuid.uuid4().hex[:6]
            r = requests.put(f"{API}/admin/cs/config", headers=admin_headers,
                             json={"welcome": new_welcome, "enabled": True}, timeout=10)
            assert r.status_code == 200
            d = requests.get(f"{API}/admin/cs/config", headers=admin_headers, timeout=10).json()
            assert d["welcome"] == new_welcome
        finally:
            requests.put(f"{API}/admin/cs/config", headers=admin_headers,
                         json={"welcome": orig["welcome"], "enabled": orig["enabled"]}, timeout=10)

    def test_stats(self, admin_headers):
        r = requests.get(f"{API}/admin/cs/stats?days=30", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "agents" in d and "total_sessions" in d
        for a in d["agents"]:
            assert "sessions" in a and "replies" in a


# ---------- 10. Fallback when CS disabled ----------
class TestFallbackDisabled:
    def test_config_disabled_then_restore(self, admin_headers):
        orig = requests.get(f"{API}/admin/cs/config", headers=admin_headers, timeout=10).json()
        try:
            requests.put(f"{API}/admin/cs/config", headers=admin_headers,
                         json={"welcome": orig["welcome"], "enabled": False}, timeout=10)
            cfg = requests.get(f"{API}/cs/config", timeout=10).json()
            assert cfg["enabled"] is False
            # starting a new session returns {enabled:false}
            r = requests.post(f"{API}/cs/start", json={"session_id": _sid(), "slug": "about"}, timeout=10)
            # endpoint declares 201 default but body indicates enabled:false
            assert r.status_code in (200, 201)
            assert r.json().get("enabled") is False
        finally:
            requests.put(f"{API}/admin/cs/config", headers=admin_headers,
                         json={"welcome": orig["welcome"], "enabled": True}, timeout=10)
            cfg = requests.get(f"{API}/cs/config", timeout=10).json()
            assert cfg["enabled"] is True
