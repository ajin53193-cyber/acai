"""Tests for new features: stats/provinces, track CN-only, promos CRUD, tools CRUD."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"username": "admin", "password": "Heying@2026"}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ===== stats/provinces =====
def test_stats_provinces(admin_headers):
    r = requests.get(f"{API}/admin/stats/provinces?days=30", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["days"] == 30
    assert isinstance(data["provinces"], list)
    assert isinstance(data["total"], int)
    assert isinstance(data["unknown"], int)
    for p in data["provinces"]:
        assert "name" in p and "count" in p


# ===== track =====
def test_track_overseas_skipped():
    r = requests.post(f"{API}/track", json={"path": "/", "source": ""},
                      headers={"X-Forwarded-For": "8.8.8.8"}, timeout=30)
    assert r.status_code == 201
    body = r.json()
    assert body["ok"] is True
    assert body.get("skipped") == "overseas"


def test_track_china_recorded():
    r = requests.post(f"{API}/track", json={"path": "/", "source": ""},
                      headers={"X-Forwarded-For": "114.114.114.114"}, timeout=30)
    assert r.status_code == 201
    body = r.json()
    assert body["ok"] is True
    assert "skipped" not in body
    # cleanup via mongo
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    async def cleanup():
        c = AsyncIOMotorClient(mongo_url)
        await c[db_name].visits.delete_many({"ip": "114.114.114.114"})
        c.close()
    asyncio.run(cleanup())


# ===== promos CRUD =====
def test_promos_crud(admin_headers):
    payload = {
        "title": "TEST_测试图文",
        "subtitle": "s",
        "cover": "",
        "blocks": [
            {"type": "heading", "text": "标题"},
            {"type": "text", "text": "段落"},
            {"type": "image", "image": "/images/ui/service-publish.webp", "text": "说明"},
            {"type": "button", "text": "加入群", "link": "/tutorials/join-group"},
        ],
    }
    r = requests.post(f"{API}/admin/promos", json=payload, headers=admin_headers, timeout=30)
    assert r.status_code == 201, r.text
    created = r.json()
    assert "slug" in created and "id" in created
    slug = created["slug"]
    pid = created["id"]

    # public GET
    r = requests.get(f"{API}/promos/{slug}", timeout=30)
    assert r.status_code == 200
    assert r.json()["title"] == "TEST_测试图文"

    # view counter
    r = requests.post(f"{API}/promos/{slug}/view", timeout=30)
    assert r.status_code == 201

    # update title
    payload2 = {**payload, "title": "TEST_已更新"}
    r = requests.put(f"{API}/admin/promos/{pid}", json=payload2, headers=admin_headers, timeout=30)
    assert r.status_code == 200
    assert r.json()["title"] == "TEST_已更新"

    # unpublish -> 404 on public
    r = requests.patch(f"{API}/admin/promos/{pid}/publish", json={"published": False},
                       headers=admin_headers, timeout=30)
    assert r.status_code == 200
    r = requests.get(f"{API}/promos/{slug}", timeout=30)
    assert r.status_code == 404

    # delete
    r = requests.delete(f"{API}/admin/promos/{pid}", headers=admin_headers, timeout=30)
    assert r.status_code == 200


def test_promos_invalid_block_type(admin_headers):
    payload = {"title": "TEST_bad", "blocks": [{"type": "video", "text": "x"}]}
    r = requests.post(f"{API}/admin/promos", json=payload, headers=admin_headers, timeout=30)
    assert r.status_code == 422


# ===== tools CRUD =====
def test_tools_crud(admin_headers):
    payload = {
        "name": "TEST_工具",
        "icon": "",
        "tagline": "一句话",
        "download_link": "https://example.com/app.apk",
        "download_text": "立即下载",
        "blocks": [
            {"type": "heading", "text": "第一步"},
            {"type": "text", "text": "打开 App"},
        ],
        "sort": 1,
    }
    r = requests.post(f"{API}/admin/tools", json=payload, headers=admin_headers, timeout=30)
    assert r.status_code == 201, r.text
    created = r.json()
    slug = created["slug"]
    tid = created["id"]

    # public list contains it with only limited fields
    r = requests.get(f"{API}/tools", timeout=30)
    assert r.status_code == 200
    tools = r.json()["tools"]
    found = next((t for t in tools if t["slug"] == slug), None)
    assert found is not None
    allowed = {"slug", "name", "icon", "tagline", "sort", "views"}
    assert set(found.keys()).issubset(allowed), found

    # detail
    r = requests.get(f"{API}/tools/{slug}", timeout=30)
    assert r.status_code == 200
    assert r.json()["download_link"] == "https://example.com/app.apk"

    # events
    requests.post(f"{API}/tools/{slug}/events", json={"type": "view"}, timeout=30)
    requests.post(f"{API}/tools/{slug}/events", json={"type": "download"}, timeout=30)
    r = requests.get(f"{API}/admin/tools", headers=admin_headers, timeout=30)
    admin_tool = next((t for t in r.json()["tools"] if t["id"] == tid), None)
    assert admin_tool is not None
    assert admin_tool.get("views", 0) >= 1
    assert admin_tool.get("downloads", 0) >= 1

    # unpublish -> list excludes
    r = requests.patch(f"{API}/admin/tools/{tid}/publish", json={"published": False},
                       headers=admin_headers, timeout=30)
    assert r.status_code == 200
    r = requests.get(f"{API}/tools", timeout=30)
    assert all(t["slug"] != slug for t in r.json()["tools"])

    # delete
    r = requests.delete(f"{API}/admin/tools/{tid}", headers=admin_headers, timeout=30)
    assert r.status_code == 200
