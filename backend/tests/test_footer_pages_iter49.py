"""Iter49 — Footer management, pages CMS, settings cs_qr_image."""
import asyncio
import base64
import os
import subprocess

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
TEST_PAGE_ID = "test-page-x"

PNG_1x1 = (
    "data:image/png;base64,"
    + base64.b64encode(bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
        "0000000D49444154789C6360000000000500010D0A2DB40000000049454E44AE426082"
    )).decode()
)


def _mint(uid):
    return subprocess.check_output(["python3", "/app/tests/mint_token.py", uid]).decode().strip()


def _totp_secret():
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        r = await c[os.environ["DB_NAME"]].admin_2fa.find_one({"user_id": ADMIN_UID})
        return r["secret"]
    return asyncio.new_event_loop().run_until_complete(go())


@pytest.fixture(scope="module")
def admin_headers():
    bearer = _mint(ADMIN_UID)
    r = requests.post(f"{BASE}/api/admin/auth/login",
                      json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW}, headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    pre = r.json()["pre_token"]
    code = pyotp.TOTP(_totp_secret()).now()
    r2 = requests.post(f"{BASE}/api/admin/auth/totp",
                       json={"pre_token": pre, "code": code}, headers=UA, timeout=30)
    assert r2.status_code == 200, r2.text
    return {**UA, "Authorization": f"Bearer {bearer}", "X-Admin-Token": r2.json()["admin_token"]}


# ----------------------------- public /footer & /settings -----------------------------
def test_footer_public_default():
    r = requests.get(f"{BASE}/api/footer", headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "cols" in d
    assert isinstance(d["cols"], list)
    assert len(d["cols"]) == 3
    for col in d["cols"]:
        assert "title" in col and isinstance(col["title"], str)
        assert "links" in col and isinstance(col["links"], list)
        for link in col["links"]:
            assert set(link.keys()) >= {"label", "to", "hot"}


def test_settings_has_cs_qr_image():
    r = requests.get(f"{BASE}/api/settings", headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "cs_qr_image" in d


# ----------------------------- admin footer -----------------------------
def test_admin_footer_put_and_reset(admin_headers):
    # Save current state via GET first
    initial = requests.get(f"{BASE}/api/footer", headers=UA, timeout=30).json()["cols"]

    # Put 4 cols with 4th being 測試欄
    cols = [{"title": c["title"], "links": c["links"]} for c in initial]
    cols.append({"title": "測試欄", "links": [{"label": "Google", "to": "https://google.com", "hot": True}]})
    r = requests.put(f"{BASE}/api/admin/footer", json={"cols": cols}, headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    saved = r.json()["cols"]
    assert len(saved) == 4
    assert saved[3]["title"] == "測試欄"
    assert saved[3]["links"][0]["label"] == "Google"
    assert saved[3]["links"][0]["to"] == "https://google.com"
    assert saved[3]["links"][0]["hot"] is True

    # Public GET matches
    pub = requests.get(f"{BASE}/api/footer", headers=UA, timeout=30).json()["cols"]
    assert len(pub) == 4
    assert pub[3]["title"] == "測試欄"

    # Reset
    r2 = requests.post(f"{BASE}/api/admin/footer/reset", headers=admin_headers, timeout=30)
    assert r2.status_code == 200
    reset_cols = r2.json()["cols"]
    assert len(reset_cols) == 3
    pub2 = requests.get(f"{BASE}/api/footer", headers=UA, timeout=30).json()["cols"]
    assert len(pub2) == 3


# ----------------------------- admin pages -----------------------------
def test_admin_pages_list(admin_headers):
    r = requests.get(f"{BASE}/api/admin/articles/pages", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    rows = r.json()["rows"]
    assert isinstance(rows, list)
    assert len(rows) >= 10, f"expected >=10 pages, got {len(rows)}"
    for row in rows:
        assert "id" in row
        assert "title" in row
        assert "active" in row
        assert "content_html" not in row  # list excludes content


def test_admin_page_create_update_delete(admin_headers):
    # cleanup leftover
    requests.delete(f"{BASE}/api/admin/articles/{TEST_PAGE_ID}", headers=admin_headers, timeout=30)

    # CREATE
    r = requests.post(f"{BASE}/api/admin/articles/pages",
                     json={"id": TEST_PAGE_ID, "title": "測試頁", "content_html": "<p>hi</p>", "active": True},
                     headers=admin_headers, timeout=30)
    assert r.status_code in (200, 201), r.text
    d = r.json()
    assert d["id"] == TEST_PAGE_ID
    assert d["page"] is True

    # Public article GET
    g = requests.get(f"{BASE}/api/articles/{TEST_PAGE_ID}", headers=UA, timeout=30)
    assert g.status_code == 200, g.text
    ga = g.json()
    assert ga.get("page") is True
    assert "hi" in (ga.get("content_html") or "")

    # Duplicate -> 409
    rd = requests.post(f"{BASE}/api/admin/articles/pages",
                      json={"id": TEST_PAGE_ID, "title": "x", "content_html": "<p>y</p>", "active": True},
                      headers=admin_headers, timeout=30)
    assert rd.status_code == 409, rd.text

    # PUT update title + active=False without content_html => content preserved
    ru = requests.put(f"{BASE}/api/admin/articles/pages/{TEST_PAGE_ID}",
                     json={"title": "測試頁2", "active": False},
                     headers=admin_headers, timeout=30)
    assert ru.status_code == 200, ru.text

    # verify content preserved via admin GET
    ag = requests.get(f"{BASE}/api/admin/articles/{TEST_PAGE_ID}", headers=admin_headers, timeout=30)
    assert ag.status_code == 200, ag.text
    agd = ag.json()
    assert agd["active"] is False
    assert "hi" in (agd.get("content_html") or ""), f"content_html lost: {agd.get('content_html')}"

    # DELETE cleanup
    rdel = requests.delete(f"{BASE}/api/admin/articles/{TEST_PAGE_ID}", headers=admin_headers, timeout=30)
    assert rdel.status_code in (200, 204), rdel.text
    # confirm gone
    g2 = requests.get(f"{BASE}/api/articles/{TEST_PAGE_ID}", headers=UA, timeout=30)
    assert g2.status_code == 404


# ----------------------------- admin settings cs_qr_image upload -----------------------------
def test_admin_settings_cs_qr_image_upload(admin_headers):
    # upload PNG
    r = requests.put(f"{BASE}/api/admin/settings", json={"cs_qr_image": PNG_1x1},
                     headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    url = d.get("cs_qr_image")
    assert url and url.startswith("/api/img/"), f"got {url}"

    # URL reachable
    ig = requests.get(f"{BASE}{url}", headers=UA, timeout=30)
    assert ig.status_code == 200, ig.text

    # Public GET /settings reflects
    pub = requests.get(f"{BASE}/api/settings", headers=UA, timeout=30).json()
    assert pub["cs_qr_image"] == url

    # Clear
    r2 = requests.put(f"{BASE}/api/admin/settings", json={"cs_qr_image": ""},
                      headers=admin_headers, timeout=30)
    assert r2.status_code == 200
    assert r2.json().get("cs_qr_image", "") == ""
