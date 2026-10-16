"""Iter47 regression: orders hub merge + ALL_PERMISSIONS cleanup."""
import os
import subprocess
import asyncio

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


def _totp_secret():
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        r = await c[os.environ["DB_NAME"]].admin_2fa.find_one({"user_id": ADMIN_UID})
        return r["secret"]
    return asyncio.get_event_loop().run_until_complete(go())


def _mint(uid):
    return subprocess.check_output(["python3", "/app/tests/mint_token.py", uid]).decode().strip()


@pytest.fixture(scope="module")
def headers():
    bearer = _mint(ADMIN_UID)
    r = requests.post(f"{BASE}/api/admin/auth/login",
                      json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW}, headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    pre = r.json()["pre_token"]
    code = pyotp.TOTP(_totp_secret()).now()
    r2 = requests.post(f"{BASE}/api/admin/auth/totp",
                       json={"pre_token": pre, "code": code}, headers=UA, timeout=30)
    assert r2.status_code == 200, r2.text
    tok = r2.json()["admin_token"]
    return {**UA, "Authorization": f"Bearer {bearer}", "X-Admin-Token": tok}


def test_admin_me_permissions(headers):
    r = requests.get(f"{BASE}/api/admin/me", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    all_perms = data.get("all_permissions") or []
    assert "orders" not in all_perms, f"'orders' should be removed; got {all_perms}"
    assert "giftcard-orders" in all_perms, f"'giftcard-orders' missing"


def test_admin_orders_list(headers):
    r = requests.get(f"{BASE}/api/admin/orders",
                     params={"status": "all", "page": 1, "size": 30}, headers=headers, timeout=30)
    assert r.status_code == 200, r.text


def test_admin_giftcard_orders_list(headers):
    r = requests.get(f"{BASE}/api/admin/giftcard/orders", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
