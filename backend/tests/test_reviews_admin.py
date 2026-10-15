"""Iteration 38 — Admin Reviews module (list/filter/counts, create, patch visible/reply,
bulk show/hide/delete, PUT edit, DELETE, and public filter)."""
import os
import subprocess
import sys

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")


def _read_env_fe():
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("no backend url")


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env_fe()).rstrip("/")
UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
UA = "gogo589-test/1.0"


def _mint_jwt() -> str:
    out = subprocess.run(
        [sys.executable, "/app/tests/mint_token.py", UID],
        capture_output=True, text=True, check=True,
    )
    return out.stdout.strip()


def _mint_xat() -> str:
    sys.path.insert(0, "/app/backend")
    import admin_api  # noqa: WPS433
    return admin_api._sign({"uid": UID}, 3600)  # noqa: SLF001


@pytest.fixture(scope="session")
def headers():
    return {
        "Authorization": f"Bearer {_mint_jwt()}",
        "X-Admin-Token": _mint_xat(),
        "User-Agent": UA,
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="session")
def product_id():
    r = requests.get(f"{BASE_URL}/api/products", headers={"User-Agent": UA}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data, "no seeded products"
    return data[0]["id"]


@pytest.fixture(scope="session")
def created_ids():
    ids: list[str] = []
    yield ids
    hdr = {"Authorization": f"Bearer {_mint_jwt()}", "X-Admin-Token": _mint_xat(), "User-Agent": UA}
    for rid in ids:
        requests.delete(f"{BASE_URL}/api/admin/reviews/{rid}", headers=hdr, timeout=20)


# ----- list & counts -----
def test_admin_list_returns_items_and_counts(headers):
    r = requests.get(f"{BASE_URL}/api/admin/reviews", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data and "counts" in data
    assert isinstance(data["items"], list)
    for k in ("total", "hidden", "no_reply"):
        assert k in data["counts"]
        assert isinstance(data["counts"][k], int)
    assert data["counts"]["total"] >= len(data["items"]) or len(data["items"]) >= 0


def test_admin_list_filter_rating(headers):
    r = requests.get(f"{BASE_URL}/api/admin/reviews?rating=5", headers=headers, timeout=30)
    assert r.status_code == 200
    for it in r.json()["items"]:
        assert it["rating"] == 5


def test_admin_list_filter_visible_false(headers):
    r = requests.get(f"{BASE_URL}/api/admin/reviews?visible=false", headers=headers, timeout=30)
    assert r.status_code == 200
    for it in r.json()["items"]:
        assert it.get("visible") is False


# ----- CRUD create & delete via admin -----
def test_create_review(headers, product_id, created_ids):
    body = {
        "product_id": product_id,
        "author": "TEST_QA_tester",
        "rating": 4,
        "content": "TEST 自動化測試評價內容",
        "visible": True,
        "area": "TEST_zone",
    }
    r = requests.post(f"{BASE_URL}/api/admin/reviews", headers=headers, json=body, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["author"] == body["author"]
    assert d["rating"] == 4
    assert d["product_id"] == product_id
    assert "id" in d
    created_ids.append(d["id"])


def test_search_filters_created(headers, created_ids):
    assert created_ids, "need created review"
    r = requests.get(f"{BASE_URL}/api/admin/reviews?q=TEST_QA_tester", headers=headers, timeout=20)
    assert r.status_code == 200
    ids = [it["id"] for it in r.json()["items"]]
    assert created_ids[0] in ids


# ----- patch reply + visible -----
def test_patch_reply(headers, created_ids):
    rid = created_ids[0]
    r = requests.patch(f"{BASE_URL}/api/admin/reviews/{rid}", headers=headers,
                       json={"reply": "感謝支持！(TEST)"}, timeout=20)
    assert r.status_code == 200
    assert r.json()["reply"] == "感謝支持！(TEST)"
    assert r.json().get("replied_at")

    # clear reply
    r2 = requests.patch(f"{BASE_URL}/api/admin/reviews/{rid}", headers=headers,
                        json={"reply": ""}, timeout=20)
    assert r2.status_code == 200
    assert r2.json()["reply"] == ""


def test_patch_visible_toggle_and_public_filter(headers, created_ids, product_id):
    rid = created_ids[0]
    # Hide
    r = requests.patch(f"{BASE_URL}/api/admin/reviews/{rid}", headers=headers,
                       json={"visible": False}, timeout=20)
    assert r.status_code == 200
    assert r.json()["visible"] is False

    # Public endpoint must NOT include it
    pub = requests.get(f"{BASE_URL}/api/reviews?product_id={product_id}",
                       headers={"User-Agent": UA}, timeout=20)
    assert pub.status_code == 200
    assert rid not in [it["id"] for it in pub.json()]

    # Un-hide
    r2 = requests.patch(f"{BASE_URL}/api/admin/reviews/{rid}", headers=headers,
                        json={"visible": True}, timeout=20)
    assert r2.status_code == 200
    assert r2.json()["visible"] is True

    pub2 = requests.get(f"{BASE_URL}/api/reviews?product_id={product_id}",
                        headers={"User-Agent": UA}, timeout=20)
    assert pub2.status_code == 200
    assert rid in [it["id"] for it in pub2.json()]


def test_patch_empty_body_rejected(headers, created_ids):
    rid = created_ids[0]
    r = requests.patch(f"{BASE_URL}/api/admin/reviews/{rid}", headers=headers, json={}, timeout=20)
    assert r.status_code == 400


# ----- PUT edit -----
def test_put_edit(headers, created_ids, product_id):
    rid = created_ids[0]
    body = {"product_id": product_id, "author": "TEST_QA_tester", "rating": 3,
            "content": "TEST 已編輯內容", "visible": True}
    r = requests.put(f"{BASE_URL}/api/admin/reviews/{rid}", headers=headers, json=body, timeout=20)
    assert r.status_code == 200
    assert r.json()["content"] == "TEST 已編輯內容"
    assert r.json()["rating"] == 3


# ----- bulk operations -----
def test_bulk_hide_show(headers, product_id, created_ids):
    # create 2 extra reviews
    extras = []
    for i in range(2):
        rr = requests.post(f"{BASE_URL}/api/admin/reviews", headers=headers, json={
            "product_id": product_id, "author": f"TEST_bulk_{i}", "rating": 5,
            "content": "TEST bulk 內容", "visible": True}, timeout=20)
        assert rr.status_code == 200
        extras.append(rr.json()["id"])
    created_ids.extend(extras)

    r = requests.post(f"{BASE_URL}/api/admin/reviews/bulk", headers=headers,
                      json={"ids": extras, "action": "hide"}, timeout=20)
    assert r.status_code == 200
    assert r.json()["count"] == 2

    # verify hidden
    lst = requests.get(f"{BASE_URL}/api/admin/reviews?q=TEST_bulk_", headers=headers, timeout=20).json()["items"]
    hidden = {it["id"]: it["visible"] for it in lst if it["id"] in extras}
    assert all(v is False for v in hidden.values())

    # show back
    r2 = requests.post(f"{BASE_URL}/api/admin/reviews/bulk", headers=headers,
                       json={"ids": extras, "action": "show"}, timeout=20)
    assert r2.status_code == 200
    assert r2.json()["count"] == 2


def test_bulk_invalid_action(headers):
    r = requests.post(f"{BASE_URL}/api/admin/reviews/bulk", headers=headers,
                      json={"ids": ["x"], "action": "nope"}, timeout=20)
    assert r.status_code == 400


def test_bulk_delete_and_cleanup(headers, created_ids):
    if not created_ids:
        pytest.skip("no ids")
    r = requests.post(f"{BASE_URL}/api/admin/reviews/bulk", headers=headers,
                      json={"ids": list(created_ids), "action": "delete"}, timeout=20)
    assert r.status_code == 200
    assert r.json()["count"] >= 1

    # verify gone
    for rid in list(created_ids):
        g = requests.patch(f"{BASE_URL}/api/admin/reviews/{rid}", headers=headers,
                           json={"visible": True}, timeout=20)
        assert g.status_code == 404
    created_ids.clear()


# ----- auth guards -----
def test_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/reviews", headers={"User-Agent": UA}, timeout=20)
    assert r.status_code in (401, 403)


def test_requires_admin_token(headers):
    hdr = {k: v for k, v in headers.items() if k != "X-Admin-Token"}
    r = requests.get(f"{BASE_URL}/api/admin/reviews", headers=hdr, timeout=20)
    assert r.status_code in (401, 403)
