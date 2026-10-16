"""Iter48 — Auto reviews feature: public endpoints, admin endpoints, order review."""
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
TESTER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
PRODUCT_ID = "75642883-bad1-47eb-ab1a-37ef091a903d"
UA = {"User-Agent": "gogo589-test/1.0"}

AREAS_EXPECTED = {"香港", "澳門", "中國台灣", "中國", "馬來西亞", "新加坡"}


def _mint(uid):
    return subprocess.check_output(["python3", "/app/tests/mint_token.py", uid]).decode().strip()


def _totp_secret():
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        r = await c[os.environ["DB_NAME"]].admin_2fa.find_one({"user_id": ADMIN_UID})
        return r["secret"]
    return asyncio.new_event_loop().run_until_complete(go())


@pytest.fixture(scope="module")
def tester_bearer():
    return _mint(TESTER_UID)


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


# ----------------------------- public reviews -----------------------------
def test_reviews_stats_public():
    r = requests.get(f"{BASE}/api/reviews/stats", params={"product_id": PRODUCT_ID}, headers=UA, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert set(d.keys()) >= {"count", "avg", "areas"}
    assert d["count"] >= 1849, f"expected >=1849 reviews, got {d['count']}"
    assert isinstance(d["avg"], (int, float))
    assert d["areas"] >= 1


def test_reviews_list_public():
    r = requests.get(f"{BASE}/api/reviews", params={"product_id": PRODUCT_ID}, headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) <= 300
    assert len(rows) > 0
    # desc order by created_at
    ts = [x.get("created_at", "") for x in rows]
    assert ts == sorted(ts, reverse=True), "reviews should be sorted created_at desc"
    # areas within expected
    for row in rows:
        if row.get("area"):
            assert row["area"] in AREAS_EXPECTED, f"unexpected area {row['area']}"


# ----------------------------- admin auto -----------------------------
def test_admin_auto_get(admin_headers):
    r = requests.get(f"{BASE}/api/admin/reviews/auto", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("enabled", "daily_min", "daily_max", "product_id", "seed_total", "seed_from", "auto_after_days"):
        assert k in d, f"missing {k}"
    assert "stats" in d
    for k in ("seeded", "daily_total", "today_planned", "today_done", "order_auto", "user_reviews"):
        assert k in d["stats"], f"stats missing {k}"
    assert d["stats"]["seeded"] >= 1849


def test_admin_auto_put_update_range(admin_headers):
    # read current
    cur = requests.get(f"{BASE}/api/admin/reviews/auto", headers=admin_headers, timeout=30).json()
    body = {"enabled": cur["enabled"], "daily_min": 40, "daily_max": 80, "product_id": cur["product_id"],
            "seed_total": cur["seed_total"], "seed_from": cur["seed_from"], "auto_after_days": cur["auto_after_days"]}
    r = requests.put(f"{BASE}/api/admin/reviews/auto", json=body, headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["daily_min"] == 40 and d["daily_max"] == 80
    # verify persistence via GET
    g = requests.get(f"{BASE}/api/admin/reviews/auto", headers=admin_headers, timeout=30).json()
    assert g["daily_min"] == 40 and g["daily_max"] == 80
    # restore
    body["daily_min"], body["daily_max"] = 30, 100
    r2 = requests.put(f"{BASE}/api/admin/reviews/auto", json=body, headers=admin_headers, timeout=30)
    assert r2.status_code == 200
    assert r2.json()["daily_min"] == 30 and r2.json()["daily_max"] == 100


def test_admin_auto_seed_already_filled_409(admin_headers):
    r = requests.post(f"{BASE}/api/admin/reviews/auto/seed", headers=admin_headers, timeout=30)
    assert r.status_code == 409, r.text


def test_admin_auto_run_now(admin_headers):
    r = requests.post(f"{BASE}/api/admin/reviews/auto/run-now", headers=admin_headers, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "stats" in d


# ----------------------------- order review -----------------------------
def _tester_order_for_review():
    """Find a completed order of tester, reset reviewed flag so we can submit a review."""
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        order = await db.orders.find_one(
            {"user_id": TESTER_UID, "status": "completed"},
            {"_id": 0, "id": 1, "items": 1},
        )
        if not order:
            return None, None
        oid = order["id"]
        pid = next((it.get("product_id") for it in order.get("items", []) if it.get("product_id")), None)
        # delete prior reviews for this order (if any) and reset the order flag
        await db.reviews.delete_many({"order_id": oid})
        await db.orders.update_one({"id": oid}, {"$set": {"reviewed": False}, "$unset": {"review": "", "review_ids": "", "review_auto": "", "review_skipped": ""}})
        return oid, pid
    return asyncio.new_event_loop().run_until_complete(go())


PNG_1x1 = (
    "data:image/png;base64,"
    + base64.b64encode(bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
        "0000000D49444154789C6360000000000500010D0A2DB40000000049454E44AE426082"
    )).decode()
)


def test_order_review_non_completed_400(tester_bearer):
    """Non-completed order -> 400 (or 404 if not found)."""
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        o = await db.orders.find_one({"user_id": TESTER_UID, "status": {"$ne": "completed"}}, {"_id": 0, "id": 1})
        return (o or {}).get("id")
    oid = asyncio.new_event_loop().run_until_complete(go())
    if not oid:
        pytest.skip("no non-completed order for tester")
    r = requests.post(f"{BASE}/api/orders/{oid}/review",
                      headers={**UA, "Authorization": f"Bearer {tester_bearer}"},
                      json={"rating": 5, "content": "x", "images": []}, timeout=30)
    assert r.status_code == 400, r.text


def test_order_review_submit_and_duplicate_409(tester_bearer):
    oid, pid = _tester_order_for_review()
    if not oid:
        pytest.skip("tester has no completed order")
    body = {"rating": 5, "content": "測試評價",
            "images": [{"image_b64": PNG_1x1, "image_name": "a.png"}]}
    hdr = {**UA, "Authorization": f"Bearer {tester_bearer}"}
    r = requests.post(f"{BASE}/api/orders/{oid}/review", headers=hdr, json=body, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("ok") is True
    rev = d["review"]
    assert rev["rating"] == 5 and rev["content"] == "測試評價"
    assert isinstance(rev["images"], list) and len(rev["images"]) == 1
    img_url = rev["images"][0]
    assert img_url.startswith("/api/img/"), img_url
    ig = requests.get(f"{BASE}{img_url}", headers=UA, timeout=30)
    assert ig.status_code == 200, ig.text
    # duplicate -> 409
    r2 = requests.post(f"{BASE}/api/orders/{oid}/review", headers=hdr, json=body, timeout=30)
    assert r2.status_code == 409, r2.text
    # review appears in GET /api/reviews
    if pid:
        g = requests.get(f"{BASE}/api/reviews", params={"product_id": pid}, headers=UA, timeout=30)
        assert g.status_code == 200
        ids = {row.get("order_id") for row in g.json()}
        assert oid in ids, "submitted order review not found in /reviews listing"
