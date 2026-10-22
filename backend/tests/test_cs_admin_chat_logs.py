"""Backend tests for iteration_11:
- Admin CS sessions list + messages viewer
- Visitor FAQ increments unread_agent
- Status-log date-range params (agent + admin)
"""
import os
import time as pytime
import pytest
import requests
from urllib.parse import quote

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"


# ---------- auth fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"username": "admin", "password": "Heying@2026"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def agent_token():
    r = requests.post(f"{API}/cs/agent/login", json={"username": "agent01", "password": "Pass@123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def ah(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- /api/admin/cs/sessions ----------
class TestAdminSessionsList:
    def test_requires_auth(self):
        r = requests.get(f"{API}/admin/cs/sessions", timeout=10)
        assert r.status_code in (401, 403)

    def test_bad_agent_token_rejected(self, agent_token):
        r = requests.get(f"{API}/admin/cs/sessions", headers=ah(agent_token), timeout=10)
        assert r.status_code in (401, 403)

    def test_basic_shape(self, admin_token):
        r = requests.get(f"{API}/admin/cs/sessions", headers=ah(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("sessions", "total", "page", "size"):
            assert k in d
        assert isinstance(d["sessions"], list)
        assert isinstance(d["total"], int)
        if d["sessions"]:
            s = d["sessions"][0]
            for k in ("id", "agent_name", "msg_total", "msg_visitor", "last_message_at"):
                assert k in s, f"missing {k} in session row"

    def test_invalid_date_returns_400(self, admin_token):
        r = requests.get(f"{API}/admin/cs/sessions", headers=ah(admin_token), params={"start": "not-a-date"}, timeout=10)
        assert r.status_code == 400

    def test_agent_filter(self, admin_token, agent_token):
        # find agent01 id via /cs/agent/me
        me = requests.get(f"{API}/cs/agent/me", headers=ah(agent_token), timeout=10).json()
        agid = me["id"]
        r = requests.get(f"{API}/admin/cs/sessions", headers=ah(admin_token), params={"agent_id": agid, "size": 100}, timeout=15)
        assert r.status_code == 200
        for s in r.json()["sessions"]:
            assert s.get("agent_id") == agid or s.get("agent_name") == me["name"]

    def test_q_unicode_filter_url_encoded(self, admin_token):
        # URL-encoded Chinese must not 403 and must return a valid shape
        q = quote("越南")
        r = requests.get(f"{API}/admin/cs/sessions?q={q}", headers=ah(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "sessions" in d and isinstance(d["total"], int)

    def test_date_range_shape(self, admin_token):
        r = requests.get(f"{API}/admin/cs/sessions", headers=ah(admin_token), params={"start": "2026-01-01", "end": "2026-12-31"}, timeout=15)
        assert r.status_code == 200
        assert "sessions" in r.json()

    def test_pagination_size2(self, admin_token):
        p1 = requests.get(f"{API}/admin/cs/sessions", headers=ah(admin_token), params={"size": 2, "page": 1}, timeout=15).json()
        p2 = requests.get(f"{API}/admin/cs/sessions", headers=ah(admin_token), params={"size": 2, "page": 2}, timeout=15).json()
        assert p1["size"] == 2 and p1["page"] == 1
        assert p2["page"] == 2
        if p1["total"] > 2:
            ids1 = {s["id"] for s in p1["sessions"]}
            ids2 = {s["id"] for s in p2["sessions"]}
            assert ids1.isdisjoint(ids2), "pagination returned overlapping ids"


# ---------- /api/admin/cs/sessions/{id}/messages ----------
class TestAdminSessionMessages:
    def test_unknown_id_404(self, admin_token):
        r = requests.get(f"{API}/admin/cs/sessions/does-not-exist-xxx/messages", headers=ah(admin_token), timeout=10)
        assert r.status_code == 404

    def test_messages_shape_and_order(self, admin_token):
        lst = requests.get(f"{API}/admin/cs/sessions", headers=ah(admin_token), params={"size": 5}, timeout=15).json()
        if not lst["sessions"]:
            pytest.skip("no sessions in DB")
        sid = lst["sessions"][0]["id"]
        r = requests.get(f"{API}/admin/cs/sessions/{sid}/messages", headers=ah(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "session" in d and "agent" in d and "messages" in d
        ts = [m["created_at"] for m in d["messages"]]
        assert ts == sorted(ts), "messages must be ordered by created_at asc"


# ---------- FAQ increments unread_agent ----------
class TestVisitorFaqUnread:
    def test_faq_increments_unread_agent(self, agent_token):
        import uuid as _u
        sid = f"TEST_FAQ_{_u.uuid4().hex[:12]}"
        start = requests.post(f"{API}/cs/start", json={"session_id": sid, "source": "test", "slug": "TEST_FAQ"}, timeout=15)
        assert start.status_code in (200, 201), start.text
        # Pick first FAQ
        pub = requests.get(f"{API}/cs/config", timeout=10).json()
        assert pub.get("faqs"), "no FAQs configured"
        before = _unread_for(agent_token, sid)
        r = requests.post(f"{API}/cs/{sid}/faq", json={"index": 0}, timeout=15)
        assert r.status_code in (200, 201), r.text
        # small delay to let any async writes settle
        pytime.sleep(0.3)
        after = _unread_for(agent_token, sid)
        assert after >= before + 1, f"unread_agent did not increment: before={before} after={after}"


def _unread_for(agent_token, sid):
    rows = requests.get(f"{API}/cs/agent/sessions", headers=ah(agent_token), timeout=15).json().get("sessions", [])
    for s in rows:
        if s["id"] == sid:
            return int(s.get("unread_agent", 0))
    return 0


# ---------- status-log date range ----------
class TestStatusLogDateRange:
    def test_agent_status_log_future_range_empty(self, agent_token):
        r = requests.get(f"{API}/cs/agent/status-log", headers=ah(agent_token), params={"start": "2026-10-01", "end": "2026-10-21"}, timeout=15)
        assert r.status_code == 200, r.text
        days = r.json()["days"]
        # Should be empty or contain only dates within range
        for row in days:
            d = row.get("date", "")
            assert "2026-10-01" <= d <= "2026-10-21", f"out-of-range date {d}"

    def test_agent_status_log_bad_start_400(self, agent_token):
        r = requests.get(f"{API}/cs/agent/status-log", headers=ah(agent_token), params={"start": "bad"}, timeout=10)
        assert r.status_code == 400

    def test_admin_status_log_with_range_and_agent(self, admin_token, agent_token):
        me = requests.get(f"{API}/cs/agent/me", headers=ah(agent_token), timeout=10).json()
        agid = me["id"]
        r = requests.get(f"{API}/admin/cs/status-log", headers=ah(admin_token),
                        params={"start": "2026-01-01", "end": "2026-12-31", "agent_id": agid}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "days" in d and "online_now" in d


# ---------- import_from_live.py ONLY_CS syntax check ----------
class TestImportScriptSyntax:
    def test_syntax_ok(self):
        import py_compile
        p = "/app/deploy/baota/import_from_live.py"
        if not os.path.exists(p):
            pytest.skip("script missing")
        py_compile.compile(p, doraise=True)

    def test_only_cs_token_present(self):
        p = "/app/deploy/baota/import_from_live.py"
        if not os.path.exists(p):
            pytest.skip("script missing")
        with open(p, "r", encoding="utf-8") as f:
            src = f.read()
        assert "ONLY_CS" in src
