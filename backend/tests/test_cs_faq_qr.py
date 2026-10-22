"""Tests for new iter_9 features:
   - CS config FAQs CRUD + visitor FAQ pick endpoint
   - Admin quick-reply library CRUD + group rename
   - Agent-side quick-reply library read
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_USER = "admin"
ADMIN_PASS = "Heying@2026"
AGENT_USER = "agent01"
AGENT_PASS = "Pass@123"


# ----------------------------- fixtures -----------------------------

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def agent_token():
    r = requests.post(f"{BASE_URL}/api/cs/agent/login", json={"username": AGENT_USER, "password": AGENT_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def agent_headers(agent_token):
    return {"Authorization": f"Bearer {agent_token}"}


@pytest.fixture(scope="module")
def preserved_config(admin_headers):
    """Snapshot config to restore after tests."""
    r = requests.get(f"{BASE_URL}/api/admin/cs/config", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    original = r.json()
    yield original
    # restore
    payload = {
        "welcome": original.get("welcome", ""),
        "enabled": original.get("enabled", True),
        "faqs": original.get("faqs", []),
    }
    requests.put(f"{BASE_URL}/api/admin/cs/config", json=payload, headers=admin_headers, timeout=10)


def _qr_list(resp):
    data = resp.json()
    return data["replies"] if isinstance(data, dict) and "replies" in data else data


# --------------------------- CS Config / FAQs ---------------------------

class TestCSFaqs:
    def test_get_admin_config_has_faqs(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/cs/config", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "faqs" in data
        assert isinstance(data["faqs"], list)

    def test_put_config_accepts_faqs(self, admin_headers, preserved_config):
        faqs = [
            {"q": "TEST_Q1", "a": "TEST_A1"},
            {"q": "TEST_Q2 项目介绍？", "a": "我们是合赢项目社，专注项目孵化。"},
        ]
        payload = {
            "welcome": preserved_config.get("welcome", "您好"),
            "enabled": preserved_config.get("enabled", True),
            "faqs": faqs,
        }
        r = requests.put(f"{BASE_URL}/api/admin/cs/config", json=payload, headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text

        # GET persisted
        r2 = requests.get(f"{BASE_URL}/api/admin/cs/config", headers=admin_headers, timeout=10)
        data = r2.json()
        assert len(data["faqs"]) == 2
        assert data["faqs"][0]["q"] == "TEST_Q1"
        assert data["faqs"][1]["a"].startswith("我们是合赢")

    def test_put_config_reject_too_many_faqs(self, admin_headers):
        faqs = [{"q": f"q{i}", "a": f"a{i}"} for i in range(21)]
        payload = {"welcome": "x", "enabled": True, "faqs": faqs}
        r = requests.put(f"{BASE_URL}/api/admin/cs/config", json=payload, headers=admin_headers, timeout=10)
        assert r.status_code == 422

    def test_cs_start_returns_faqs(self):
        sid = f"TESTsess{uuid.uuid4().hex[:12]}"
        r = requests.post(f"{BASE_URL}/api/cs/start", json={"session_id": sid}, timeout=15)
        assert r.status_code in (200, 201)
        data = r.json()
        assert "faqs" in data
        assert isinstance(data["faqs"], list)

    def test_cs_visitor_faq_pick_ok(self):
        sid = f"TESTsess{uuid.uuid4().hex[:12]}"
        r = requests.post(f"{BASE_URL}/api/cs/start", json={"session_id": sid}, timeout=15)
        assert r.status_code in (200, 201)
        faqs = r.json().get("faqs", [])
        if not faqs:
            pytest.skip("No faqs configured")

        r2 = requests.post(f"{BASE_URL}/api/cs/{sid}/faq", json={"index": 0}, timeout=15)
        assert r2.status_code == 201, r2.text

        # Fetch messages
        r3 = requests.get(f"{BASE_URL}/api/cs/{sid}/messages", timeout=15)
        assert r3.status_code == 200
        msgs = r3.json().get("messages", [])
        # Expect at least a visitor q + agent a (plus welcome)
        texts = [m.get("text", "") for m in msgs]
        assert any(faqs[0]["q"] in t for t in texts)
        assert any(faqs[0]["a"] in t for t in texts)
        # agent reply should have via=faq
        assert any(m.get("via") == "faq" for m in msgs)

    def test_cs_visitor_faq_bad_index(self):
        sid = f"TESTsess{uuid.uuid4().hex[:12]}"
        requests.post(f"{BASE_URL}/api/cs/start", json={"session_id": sid}, timeout=15)
        r = requests.post(f"{BASE_URL}/api/cs/{sid}/faq", json={"index": 19}, timeout=15)
        assert r.status_code == 404

    def test_cs_visitor_faq_unknown_session(self):
        r = requests.post(f"{BASE_URL}/api/cs/NOT_EXIST_SESSION/faq", json={"index": 0}, timeout=15)
        assert r.status_code == 404


# --------------------------- Admin QR Library ---------------------------

class TestAdminQRLibrary:
    created_ids: list = []

    def test_requires_admin_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/cs/quick-replies", timeout=10)
        assert r.status_code in (401, 403)

    def test_list_initial(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/cs/quick-replies", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        assert isinstance(_qr_list(r), list)

    def test_create_requires_text_or_image(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/cs/quick-replies",
                          json={"group": "TEST_grp", "text": "", "image": ""},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 400

    def test_create_and_persist(self, admin_headers):
        payload = {"group": "TEST_grp", "text": "TEST_quick_reply_text"}
        r = requests.post(f"{BASE_URL}/api/admin/cs/quick-replies", json=payload, headers=admin_headers, timeout=10)
        assert r.status_code == 201, r.text
        item = r.json()
        assert item["text"] == "TEST_quick_reply_text"
        assert item["group"] == "TEST_grp"
        assert "id" in item
        TestAdminQRLibrary.created_ids.append(item["id"])

        # GET verify persisted
        r2 = requests.get(f"{BASE_URL}/api/admin/cs/quick-replies", headers=admin_headers, timeout=10)
        ids = [x["id"] for x in _qr_list(r2)]
        assert item["id"] in ids

    def test_update(self, admin_headers):
        assert TestAdminQRLibrary.created_ids, "need created item"
        qr_id = TestAdminQRLibrary.created_ids[0]
        r = requests.put(f"{BASE_URL}/api/admin/cs/quick-replies/{qr_id}",
                         json={"group": "TEST_grp", "text": "TEST_updated_text"},
                         headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text

        # verify
        r2 = requests.get(f"{BASE_URL}/api/admin/cs/quick-replies", headers=admin_headers, timeout=10)
        matched = [x for x in _qr_list(r2) if x["id"] == qr_id]
        assert matched and matched[0]["text"] == "TEST_updated_text"

    def test_rename_group(self, admin_headers):
        # Create another TEST_grp item then rename
        r = requests.post(f"{BASE_URL}/api/admin/cs/quick-replies",
                         json={"group": "TEST_grp", "text": "TEST_second_item"},
                         headers=admin_headers, timeout=10)
        assert r.status_code == 201
        TestAdminQRLibrary.created_ids.append(r.json()["id"])

        r = requests.put(f"{BASE_URL}/api/admin/cs/quick-replies/group",
                         json={"old": "TEST_grp", "new": "TEST_grp2"},
                         headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("updated", 0) >= 2

        r2 = requests.get(f"{BASE_URL}/api/admin/cs/quick-replies", headers=admin_headers, timeout=10)
        for qid in TestAdminQRLibrary.created_ids:
            matched = [x for x in _qr_list(r2) if x["id"] == qid]
            assert matched and matched[0]["group"] == "TEST_grp2"

    def test_agent_sees_same_list(self, agent_headers, admin_headers):
        r_admin = requests.get(f"{BASE_URL}/api/admin/cs/quick-replies", headers=admin_headers, timeout=10)
        r_agent = requests.get(f"{BASE_URL}/api/cs/agent/quick-replies", headers=agent_headers, timeout=10)
        assert r_agent.status_code == 200
        admin_ids = sorted(x["id"] for x in _qr_list(r_admin))
        agent_ids = sorted(x["id"] for x in _qr_list(r_agent))
        assert admin_ids == agent_ids

    def test_zz_cleanup_delete(self, admin_headers):
        for qid in TestAdminQRLibrary.created_ids:
            r = requests.delete(f"{BASE_URL}/api/admin/cs/quick-replies/{qid}", headers=admin_headers, timeout=10)
            assert r.status_code in (200, 204)
        # verify none left
        r2 = requests.get(f"{BASE_URL}/api/admin/cs/quick-replies", headers=admin_headers, timeout=10)
        remaining = [x for x in _qr_list(r2) if x["id"] in TestAdminQRLibrary.created_ids]
        assert remaining == []
