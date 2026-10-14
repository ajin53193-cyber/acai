"""Iteration 18 — CMS site-config + Activities (articles) CRUD + public visibility rules."""
import os
import base64
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")

# A 1x1 transparent PNG base64 data-url
PNG_B64 = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


@pytest.fixture(scope="session")
def jwt_token():
    return open("/tmp/jwt").read().strip()


@pytest.fixture(scope="session")
def admin_token():
    return open("/tmp/xat").read().strip()


@pytest.fixture(scope="session")
def admin_headers(jwt_token, admin_token):
    return {
        "Authorization": f"Bearer {jwt_token}",
        "X-Admin-Token": admin_token,
        "User-Agent": "pytest/iter18",
        "Content-Type": "application/json",
    }


# ------------------ site-config ------------------
class TestSiteConfig:
    def test_public_get_returns_defaults_keys(self):
        r = requests.get(f"{BASE_URL}/api/site-config", headers={"X-Lang": "zh-TW"})
        assert r.status_code == 200
        data = r.json()
        for k in ("logo", "top_promo", "hero", "announcement", "promo_banners", "detail_banners", "features", "register"):
            assert k in data, f"missing key {k}"
        assert isinstance(data["promo_banners"], list)
        assert "title" in data["hero"]

    def test_put_requires_auth(self):
        r = requests.put(f"{BASE_URL}/api/admin/site-config", json={"hero": {"title": "x"}})
        assert r.status_code in (401, 403)

    def test_put_hero_converts_to_traditional(self, admin_headers):
        payload = {"hero": {"title": "测试主标题", "highlight": "8%", "subtitle": "子标题"}}
        r = requests.put(f"{BASE_URL}/api/admin/site-config", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["hero"]["title"] == "測試主標題", data["hero"]
        assert data["hero"]["highlight"] == "8%"

        # verify via GET with zh-TW (admin middleware skip returns stored, which is already traditional)
        g = requests.get(f"{BASE_URL}/api/site-config", headers={"X-Lang": "zh-TW"})
        assert g.json()["hero"]["title"] == "測試主標題"

    def test_put_uploads_data_url_image(self, admin_headers):
        payload = {"logo": {"image": PNG_B64}}
        r = requests.put(f"{BASE_URL}/api/admin/site-config", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        url = r.json()["logo"]["image"]
        assert url.startswith("/api/img/") or url.startswith("http"), f"unexpected logo url: {url}"
        # restore via reset
        requests.post(f"{BASE_URL}/api/admin/site-config/reset", json={"section": "logo"}, headers=admin_headers)

    def test_reset_hero(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/site-config/reset", json={"section": "hero"}, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["hero"]["title"] == "低價氪金 戰力超神"

    def test_reset_unknown_section_400(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/site-config/reset", json={"section": "nope_xx"}, headers=admin_headers)
        assert r.status_code == 400


# ------------------ articles ------------------
future_iso = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
past_iso = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
far_future_iso = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()


@pytest.fixture(scope="class")
def created_ids(admin_headers):
    ids = []
    yield ids
    for aid in ids:
        requests.delete(f"{BASE_URL}/api/admin/articles/{aid}", headers=admin_headers)


class TestArticles:
    def test_admin_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/articles?page=1&size=5", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data and "rows" in data
        for row in data["rows"]:
            assert row["status"] in {"live", "scheduled", "expired", "inactive"}

    def test_create_blank_title_400(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/articles",
                          json={"title": "   ", "type": "promo"}, headers=admin_headers)
        assert r.status_code == 400

    def test_create_invalid_type_400(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/articles",
                          json={"title": "TEST_x", "type": "bogus"}, headers=admin_headers)
        assert r.status_code == 400

    def test_full_crud_live(self, admin_headers, created_ids):
        # Create a live article with sort_order=-1 to float to top
        body = {
            "title": "TEST_自动化活动直播",
            "type": "promo",
            "summary": "TEST 摘要",
            "content_html": "<p>TEST 內容</p>",
            "link": "https://example.com/test",
            "end_at": far_future_iso,
            "sort_order": -1,
            "active": True,
        }
        r = requests.post(f"{BASE_URL}/api/admin/articles", json=body, headers=admin_headers)
        assert r.status_code == 200, r.text
        a = r.json()
        aid = a["id"]
        created_ids.append(aid)
        assert a["status"] == "live"
        # title should be traditionalised
        assert "自動化活動直播" in a["title"]

        # GET details with content_html
        g = requests.get(f"{BASE_URL}/api/admin/articles/{aid}", headers=admin_headers)
        assert g.status_code == 200
        assert "content_html" in g.json()
        assert g.json()["link"] == "https://example.com/test"

        # Public GET /api/articles should include it under promo
        p = requests.get(f"{BASE_URL}/api/articles?type=promo", headers={"X-Lang": "zh-TW"})
        assert p.status_code == 200
        pdata = p.json()
        rows = pdata.get("rows") if isinstance(pdata, dict) else pdata
        assert any(x.get("id") == aid for x in rows), "created live article not listed publicly"

        # Public GET detail returns link
        pd = requests.get(f"{BASE_URL}/api/articles/{aid}")
        assert pd.status_code == 200
        assert pd.json().get("link") == "https://example.com/test"

        # UPDATE
        upd = {**body, "title": "TEST_已更新标题"}
        u = requests.put(f"{BASE_URL}/api/admin/articles/{aid}", json=upd, headers=admin_headers)
        assert u.status_code == 200
        assert "已更新標題" in u.json()["title"]

    def test_create_expired_not_public(self, admin_headers, created_ids):
        body = {"title": "TEST_已过期活动", "type": "promo", "end_at": past_iso, "active": True}
        r = requests.post(f"{BASE_URL}/api/admin/articles", json=body, headers=admin_headers)
        assert r.status_code == 200
        aid = r.json()["id"]
        created_ids.append(aid)
        assert r.json()["status"] == "expired"
        p = requests.get(f"{BASE_URL}/api/articles?type=promo&size=200")
        rows = p.json().get("rows") if isinstance(p.json(), dict) else p.json()
        assert all(x.get("id") != aid for x in rows), "expired article should not be public"

    def test_create_scheduled_not_public(self, admin_headers, created_ids):
        body = {"title": "TEST_未来活动", "type": "news", "start_at": future_iso, "active": True}
        r = requests.post(f"{BASE_URL}/api/admin/articles", json=body, headers=admin_headers)
        aid = r.json()["id"]
        created_ids.append(aid)
        assert r.json()["status"] == "scheduled"
        p = requests.get(f"{BASE_URL}/api/articles?type=news&size=200")
        rows = p.json().get("rows") if isinstance(p.json(), dict) else p.json()
        assert all(x.get("id") != aid for x in rows)

    def test_create_inactive_not_public(self, admin_headers, created_ids):
        body = {"title": "TEST_停用活动", "type": "tutorial", "active": False}
        r = requests.post(f"{BASE_URL}/api/admin/articles", json=body, headers=admin_headers)
        aid = r.json()["id"]
        created_ids.append(aid)
        assert r.json()["status"] == "inactive"
        p = requests.get(f"{BASE_URL}/api/articles?type=tutorial&size=200")
        rows = p.json().get("rows") if isinstance(p.json(), dict) else p.json()
        assert all(x.get("id") != aid for x in rows)

    def test_delete_missing_404(self, admin_headers):
        r = requests.delete(f"{BASE_URL}/api/admin/articles/nonexistent-xyz-id", headers=admin_headers)
        assert r.status_code == 404

    def test_upload_image(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/articles/upload",
            json={"image_b64": PNG_B64, "image_name": "t.png"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/img/")
        g = requests.get(f"{BASE_URL}{url}")
        assert g.status_code == 200
        assert g.content[:4] == b"\x89PNG"
