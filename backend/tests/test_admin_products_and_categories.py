"""Iteration 19 — Admin products module (CRUD, patch, badges, search, pagination) + Categories CRUD."""
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

# tiny 1x1 transparent PNG
TINY_PNG_B64 = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


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
def created_product_ids():
    ids: list[str] = []
    yield ids
    hdr = {
        "Authorization": f"Bearer {_mint_jwt()}",
        "X-Admin-Token": _mint_xat(),
        "User-Agent": UA,
    }
    for pid in ids:
        requests.delete(f"{BASE_URL}/api/admin/products/{pid}", headers=hdr, timeout=20)


@pytest.fixture(scope="session")
def created_category_ids():
    ids: list[str] = []
    yield ids
    hdr = {
        "Authorization": f"Bearer {_mint_jwt()}",
        "X-Admin-Token": _mint_xat(),
        "User-Agent": UA,
    }
    for cid in ids:
        requests.delete(f"{BASE_URL}/api/admin/categories/{cid}", headers=hdr, timeout=20)


# -------- Admin auth / list ---------------------------------------------------


class TestAdminProductsList:
    def test_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/products", headers={"User-Agent": UA}, timeout=20)
        assert r.status_code in (401, 403), r.text

    def test_list_pagination_and_shape(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/products?page=1&size=30", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total" in data and "rows" in data
        assert data["total"] > 2000, f"expected ~2498 products, got {data['total']}"
        assert len(data["rows"]) == 30
        row0 = data["rows"][0]
        for excluded in ("content_html", "description", "tutorial", "delivery_fields"):
            assert excluded not in row0, f"{excluded} should be excluded from list"

        r2 = requests.get(f"{BASE_URL}/api/admin/products?page=2&size=30", headers=headers, timeout=30)
        assert r2.status_code == 200
        ids1 = {row["id"] for row in data["rows"]}
        ids2 = {row["id"] for row in r2.json()["rows"]}
        assert ids1.isdisjoint(ids2), "page 2 overlaps page 1"

    def test_search_q(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/products?q=抖音&size=30", headers=headers, timeout=30)
        assert r.status_code == 200
        rows = r.json()["rows"]
        assert len(rows) > 0
        assert all(("抖音" in row["name"]) or ("抖音" in row.get("brand", "")) for row in rows)

    def test_filter_category_and_active(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/products?category=games&size=5", headers=headers, timeout=30)
        assert r.status_code == 200
        for row in r.json()["rows"]:
            assert row["category"] == "games"

        r2 = requests.get(f"{BASE_URL}/api/admin/products?active=false&size=5", headers=headers, timeout=30)
        assert r2.status_code == 200
        for row in r2.json()["rows"]:
            assert row["active"] is False

    def test_ids_filter(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/products?ids=7814&size=5", headers=headers, timeout=30)
        assert r.status_code == 200
        rows = r.json()["rows"]
        assert len(rows) == 1 and rows[0]["id"] == "7814"

    def test_badges_endpoint(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/products/badges", headers=headers, timeout=30)
        assert r.status_code == 200
        badges = r.json()
        assert isinstance(badges, list) and 1 <= len(badges) <= 40
        for b in badges:
            assert isinstance(b, str) and b.strip() == b and b

    def test_get_full_product_with_related(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/products/7814", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        p = r.json()
        for key in ("content_html", "delivery_fields", "specs"):
            assert key in p, f"missing {key}"
        if p.get("related_ids"):
            assert "related" in p and isinstance(p["related"], list)
            for item in p["related"]:
                assert set(item.keys()) >= {"id", "name", "image"}


# -------- Product create / update / patch / delete ---------------------------


class TestAdminProductCRUD:
    def test_create_product_full(self, headers, created_product_ids):
        payload = {
            "name": "测试商品A",
            "category": "games",
            "brand": "测试",
            "subtitle": "副标题",
            "image": TINY_PNG_B64,
            "specs": [{
                "id": "new-1", "label": "100 钻石",
                "price_usd": 9.9, "sale_price_usd": 12.9,
                "badge": "每日一单", "in_stock": True,
            }],
            "delivery_fields": [{
                "code": "account", "name": "游戏账号", "required": True,
                "placeholder": "", "tips": "提示", "type": "select",
                "options": ["安卓", "iOS"],
            }],
            "tags": ["热销"],
            "related_ids": ["7814"],
            "sales_count": 0, "rating": 5.0, "sort_order": -5, "active": True,
        }
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        p = r.json()
        pid = p["id"]
        created_product_ids.append(pid)

        # Traditional conversion
        assert p["name"] == "測試商品A"
        assert p["tags"] == ["熱銷"]
        # spec id replaced
        assert p["specs"][0]["id"] != "new-1" and len(p["specs"][0]["id"]) >= 8
        assert p["specs"][0]["label"] == "100 鑽石"
        assert p["specs"][0]["badge"] == "每日一單"
        # image uploaded
        assert p["image"].startswith("/api/img/"), p["image"]
        # account label == delivery_fields[0].name (traditional)
        assert p["account_field_label"] == p["delivery_fields"][0]["name"]
        assert p["delivery_fields"][0]["name"] == "遊戲賬號" or p["delivery_fields"][0]["name"] == "遊戲帳號"

        # Public GET works
        r2 = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=20)
        assert r2.status_code == 200
        pub = r2.json()
        assert pub["id"] == pid

        # Public list by category (zh-TW)
        r3 = requests.get(f"{BASE_URL}/api/products?category=games", headers={"X-Lang": "zh-TW"}, timeout=30)
        assert r3.status_code == 200
        assert any(row["id"] == pid for row in r3.json())

        # daily-limit should respond 200 because badge is 每日一單 (member auth)
        r4 = requests.get(f"{BASE_URL}/api/products/{pid}/daily-limit",
                          headers={"Authorization": headers["Authorization"], "User-Agent": UA}, timeout=20)
        assert r4.status_code == 200, r4.text

    def test_update_add_spec_and_deactivate(self, headers, created_product_ids):
        pid = created_product_ids[0]
        # fetch, mutate
        g = requests.get(f"{BASE_URL}/api/admin/products/{pid}", headers=headers, timeout=20).json()
        body = {
            "name": g["name"] + " V2",
            "category": g["category"],
            "brand": g.get("brand", ""),
            "subtitle": g.get("subtitle", ""),
            "image": g.get("image", ""),
            "description": g.get("description", ""),
            "content_html": g.get("content_html", ""),
            "tutorial": g.get("tutorial", ""),
            "specs": g["specs"] + [{
                "id": "new-2", "label": "200 鑽石",
                "price_usd": 19.9, "sale_price_usd": 24.9,
                "badge": "", "in_stock": True,
            }],
            "delivery_fields": g.get("delivery_fields", []),
            "tags": g.get("tags", []),
            "related_ids": g.get("related_ids", []),
            "sales_count": g.get("sales_count", 0),
            "rating": g.get("rating", 5.0),
            "sort_order": g.get("sort_order", 0),
            "active": False,
        }
        r = requests.put(f"{BASE_URL}/api/admin/products/{pid}", headers=headers, json=body, timeout=30)
        assert r.status_code == 200, r.text
        upd = r.json()
        assert len(upd["specs"]) == 2
        assert upd["active"] is False
        assert upd["name"].endswith("V2")

        # Not in public listing
        r2 = requests.get(f"{BASE_URL}/api/products?category=games", timeout=30)
        assert r2.status_code == 200
        assert not any(row["id"] == pid for row in r2.json())

    def test_patch_active_and_sort(self, headers, created_product_ids):
        pid = created_product_ids[0]
        r = requests.patch(f"{BASE_URL}/api/admin/products/{pid}", headers=headers, json={"active": True}, timeout=20)
        assert r.status_code == 200 and r.json()["active"] is True
        r2 = requests.patch(f"{BASE_URL}/api/admin/products/{pid}", headers=headers, json={"sort_order": 3}, timeout=20)
        assert r2.status_code == 200 and r2.json()["sort_order"] == 3

    def test_patch_no_allowed_keys_400(self, headers, created_product_ids):
        pid = created_product_ids[0]
        r = requests.patch(f"{BASE_URL}/api/admin/products/{pid}", headers=headers, json={"name": "nope"}, timeout=20)
        assert r.status_code == 400

    def test_delete_then_404(self, headers, created_product_ids):
        pid = created_product_ids[0]
        r = requests.delete(f"{BASE_URL}/api/admin/products/{pid}", headers=headers, timeout=20)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=20)
        assert r2.status_code == 404
        created_product_ids.remove(pid)


# -------- Categories ----------------------------------------------------------


class TestAdminCategories:
    def test_list_11_rows(self, headers):
        r = requests.get(f"{BASE_URL}/api/admin/categories", headers=headers, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 10
        for row in rows:
            assert "product_count" in row
            assert "active" in row

    def test_create_normalizes_id_and_traditional_name(self, headers, created_category_ids):
        payload = {"id": "Test Cat", "name": "测试分类", "image": "", "sort_order": 99, "active": True}
        r = requests.post(f"{BASE_URL}/api/admin/categories", headers=headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        cat = r.json()
        assert cat["id"] == "test-cat"
        assert cat["name"] == "測試分類"
        created_category_ids.append(cat["id"])

        # duplicate -> 409
        r2 = requests.post(f"{BASE_URL}/api/admin/categories", headers=headers, json=payload, timeout=20)
        assert r2.status_code == 409

    def test_update_toggle_visibility(self, headers, created_category_ids):
        cid = created_category_ids[0]
        r = requests.put(f"{BASE_URL}/api/admin/categories/{cid}", headers=headers,
                         json={"id": cid, "name": "測試分類", "image": "", "sort_order": 99, "active": False},
                         timeout=20)
        assert r.status_code == 200 and r.json()["active"] is False

        # public /api/categories should NOT include it
        pub = requests.get(f"{BASE_URL}/api/categories", timeout=20).json()
        assert not any(c["id"] == cid for c in pub)

        # home by_category also excludes it
        home = requests.get(f"{BASE_URL}/api/products/home", timeout=30).json()
        bc = home.get("by_category") or {}
        assert cid not in bc

        # re-enable
        r2 = requests.put(f"{BASE_URL}/api/admin/categories/{cid}", headers=headers,
                          json={"id": cid, "name": "測試分類", "image": "", "sort_order": 99, "active": True},
                          timeout=20)
        assert r2.status_code == 200 and r2.json()["active"] is True
        pub2 = requests.get(f"{BASE_URL}/api/categories", timeout=20).json()
        assert any(c["id"] == cid for c in pub2)

    def test_delete_blocked_when_products_exist(self, headers):
        r = requests.delete(f"{BASE_URL}/api/admin/categories/games", headers=headers, timeout=20)
        assert r.status_code == 409, r.text
        assert "商品" in r.text or "products" in r.text.lower()

    def test_delete_empty_category_ok(self, headers, created_category_ids):
        cid = created_category_ids[0]
        r = requests.delete(f"{BASE_URL}/api/admin/categories/{cid}", headers=headers, timeout=20)
        assert r.status_code == 200
        created_category_ids.remove(cid)

    def test_unauth_cannot_write(self):
        r = requests.post(f"{BASE_URL}/api/admin/categories", headers={"User-Agent": UA},
                          json={"id": "x", "name": "x"}, timeout=20)
        assert r.status_code in (401, 403)
