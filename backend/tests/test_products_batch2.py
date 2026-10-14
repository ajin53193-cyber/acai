"""Iteration 37 — BATCH 2 商品管理 backend tests.

Covers (super-admin only endpoints):
  - GET /api/admin/inventory (flatten; q=; only_low=true excludes null stock)
  - PUT /api/admin/inventory (in_stock toggle; stock='' → null unlimited; stock=N persists)
  - GET/POST/PUT/DELETE /api/admin/spec-templates
  - 401 without auth
  - Product create/edit still round-trips spec.stock
"""
import os
import subprocess
import time

import pyotp
import pytest
import requests

with open("/app/frontend/.env") as f:
    BASE = next(l.split("=", 1)[1].strip().rstrip("/") for l in f if l.startswith("REACT_APP_BACKEND_URL="))

ADMIN_EMAIL = "admin+clerk_test@shop.com"
ADMIN_PW = "Gogo589!Admin#7x2Q"
ADMIN_UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
UA = {"User-Agent": "gogo589-test/1.0"}


def _totp_secret() -> str:
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")

    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        r = await c[os.environ["DB_NAME"]].admin_2fa.find_one({"user_id": ADMIN_UID})
        return r["secret"]

    return asyncio.get_event_loop().run_until_complete(go())


def _mint(uid: str) -> str:
    return subprocess.check_output(["python3", "/app/tests/mint_token.py", uid]).decode().strip()


@pytest.fixture(scope="module")
def admin_bearer():
    return _mint(ADMIN_UID)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/admin/auth/login",
                      json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW}, headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    pre = r.json()["pre_token"]
    code = pyotp.TOTP(_totp_secret()).now()
    r2 = requests.post(f"{BASE}/api/admin/auth/totp",
                       json={"pre_token": pre, "code": code}, headers=UA, timeout=30)
    assert r2.status_code == 200, r2.text
    return r2.json()["admin_token"]


@pytest.fixture(scope="module")
def H(admin_bearer, admin_token):
    return {**UA, "Authorization": f"Bearer {admin_bearer}", "X-Admin-Token": admin_token}


# =========================================================== Inventory
class TestInventory:
    def test_list_flatten(self, H):
        r = requests.get(f"{BASE}/api/admin/inventory", headers=H, timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        row = rows[0]
        for k in ("product_id", "product_name", "spec_id", "label", "price_usd", "in_stock", "stock"):
            assert k in row

    def test_search_filter(self, H):
        r = requests.get(f"{BASE}/api/admin/inventory", headers=H, params={"q": "zzz_no_match"}, timeout=30)
        assert r.status_code == 200
        assert r.json() == []

    def test_update_stock_and_persist(self, H):
        rows = requests.get(f"{BASE}/api/admin/inventory", headers=H, timeout=30).json()
        target = rows[0]
        pid, sid = target["product_id"], target["spec_id"]

        # Set stock = 3
        r = requests.put(f"{BASE}/api/admin/inventory", headers=H,
                         json={"product_id": pid, "spec_id": sid, "stock": 3}, timeout=30)
        assert r.status_code == 200
        assert r.json()["ok"] is True

        rows2 = requests.get(f"{BASE}/api/admin/inventory", headers=H, timeout=30).json()
        row2 = next(x for x in rows2 if x["spec_id"] == sid)
        assert row2["stock"] == 3

        # only_low=true should include this spec (stock<=5)
        low = requests.get(f"{BASE}/api/admin/inventory", headers=H, params={"only_low": "true"}, timeout=30).json()
        assert any(x["spec_id"] == sid for x in low)
        # null-stock rows must NOT be in low
        assert all(x["stock"] is not None for x in low)

        # Clear to unlimited (stock = '')
        r = requests.put(f"{BASE}/api/admin/inventory", headers=H,
                         json={"product_id": pid, "spec_id": sid, "stock": ""}, timeout=30)
        assert r.status_code == 200
        rows3 = requests.get(f"{BASE}/api/admin/inventory", headers=H, timeout=30).json()
        row3 = next(x for x in rows3 if x["spec_id"] == sid)
        assert row3["stock"] is None

    def test_toggle_in_stock(self, H):
        rows = requests.get(f"{BASE}/api/admin/inventory", headers=H, timeout=30).json()
        target = rows[0]
        pid, sid = target["product_id"], target["spec_id"]
        original = target["in_stock"]

        r = requests.put(f"{BASE}/api/admin/inventory", headers=H,
                         json={"product_id": pid, "spec_id": sid, "in_stock": not original}, timeout=30)
        assert r.status_code == 200
        rows2 = requests.get(f"{BASE}/api/admin/inventory", headers=H, timeout=30).json()
        row2 = next(x for x in rows2 if x["spec_id"] == sid)
        assert row2["in_stock"] is (not original)

        # restore
        requests.put(f"{BASE}/api/admin/inventory", headers=H,
                     json={"product_id": pid, "spec_id": sid, "in_stock": original}, timeout=30)

    def test_update_missing_params(self, H):
        r = requests.put(f"{BASE}/api/admin/inventory", headers=H, json={"product_id": "x"}, timeout=30)
        assert r.status_code == 400

    def test_unauth_401(self):
        r = requests.get(f"{BASE}/api/admin/inventory", headers=UA, timeout=30)
        assert r.status_code == 401
        r = requests.put(f"{BASE}/api/admin/inventory", headers=UA, json={"product_id": "x", "spec_id": "y", "stock": 1}, timeout=30)
        assert r.status_code == 401


# =========================================================== Spec templates
class TestSpecTemplates:
    created_id = None

    def test_01_create(self, H):
        body = {"name": "TEST_tpl_qa", "specs": [
            {"label": "60日", "price_usd": 5.99, "badge": "熱賣"},
            {"label": "180日", "price_usd": 15.99},
        ]}
        r = requests.post(f"{BASE}/api/admin/spec-templates", headers=H, json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_tpl_qa"
        assert len(d["specs"]) == 2
        assert d["id"]
        TestSpecTemplates.created_id = d["id"]

    def test_02_list(self, H):
        r = requests.get(f"{BASE}/api/admin/spec-templates", headers=H, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert any(x["id"] == TestSpecTemplates.created_id for x in rows)

    def test_03_update(self, H):
        body = {"name": "TEST_tpl_qa2", "specs": [{"label": "30日", "price_usd": 2.99}]}
        r = requests.put(f"{BASE}/api/admin/spec-templates/{TestSpecTemplates.created_id}",
                         headers=H, json=body, timeout=30)
        assert r.status_code == 200
        rows = requests.get(f"{BASE}/api/admin/spec-templates", headers=H, timeout=30).json()
        row = next(x for x in rows if x["id"] == TestSpecTemplates.created_id)
        assert row["name"] == "TEST_tpl_qa2"
        assert len(row["specs"]) == 1

    def test_04_delete(self, H):
        r = requests.delete(f"{BASE}/api/admin/spec-templates/{TestSpecTemplates.created_id}",
                            headers=H, timeout=30)
        assert r.status_code == 200
        rows = requests.get(f"{BASE}/api/admin/spec-templates", headers=H, timeout=30).json()
        assert not any(x["id"] == TestSpecTemplates.created_id for x in rows)

    def test_05_unauth_401(self):
        r = requests.get(f"{BASE}/api/admin/spec-templates", headers=UA, timeout=30)
        assert r.status_code == 401
        r = requests.post(f"{BASE}/api/admin/spec-templates", headers=UA, json={"name": "x"}, timeout=30)
        assert r.status_code == 401


# =========================================================== Product spec.stock round-trip
class TestProductSpecStockRoundtrip:
    created_pid = None

    def test_01_create_product_with_stock(self, H):
        # Fetch categories
        cats = requests.get(f"{BASE}/api/categories", headers=UA, timeout=30).json()
        assert cats, "no categories seeded"
        cat_id = cats[0].get("id") or cats[0].get("slug") or cats[0].get("name")

        body = {
            "name": "TEST_qa_product_batch2",
            "category": cat_id,
            "image": "https://via.placeholder.com/100",
            "specs": [
                {"label": "小包", "price_usd": 1.99, "stock": 10, "in_stock": True},
                {"label": "大包", "price_usd": 9.99, "stock": None, "in_stock": True},
            ],
            "active": True,
        }
        r = requests.post(f"{BASE}/api/admin/products", headers=H, json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        TestProductSpecStockRoundtrip.created_pid = d["id"]
        assert len(d["specs"]) == 2
        s0 = next(s for s in d["specs"] if s["label"] == "小包")
        s1 = next(s for s in d["specs"] if s["label"] == "大包")
        assert s0["stock"] == 10
        assert s1["stock"] is None

    def test_02_edit_product_updates_stock(self, H):
        pid = TestProductSpecStockRoundtrip.created_pid
        assert pid
        # fetch current
        r = requests.get(f"{BASE}/api/products/{pid}", headers=UA, timeout=30)
        assert r.status_code == 200, r.text
        prod = r.json()
        for s in prod["specs"]:
            if s["label"] == "小包":
                s["stock"] = 7
        body = {"name": prod["name"], "category": prod["category"], "specs": prod["specs"], "image": prod.get("image", "")}
        r = requests.put(f"{BASE}/api/admin/products/{pid}", headers=H, json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        s0 = next(s for s in d["specs"] if s["label"] == "小包")
        assert s0["stock"] == 7

    def test_03_cleanup(self, H):
        pid = TestProductSpecStockRoundtrip.created_pid
        if pid:
            requests.delete(f"{BASE}/api/admin/products/{pid}", headers=H, timeout=30)
