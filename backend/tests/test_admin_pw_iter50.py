"""Iter50 — Admin password change (self) + super admin reset + hidden admin path (/admin → 404)."""
import asyncio
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


def _mint(uid):
    return subprocess.check_output(["python3", "/app/tests/mint_token.py", uid]).decode().strip()


def _totp_secret(uid):
    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        r = await c[os.environ["DB_NAME"]].admin_2fa.find_one({"user_id": uid})
        return r["secret"] if r else None
    return asyncio.new_event_loop().run_until_complete(go())


@pytest.fixture(scope="module")
def admin_headers():
    bearer = _mint(ADMIN_UID)
    r = requests.post(f"{BASE}/api/admin/auth/login",
                      json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW}, headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    pre = r.json()["pre_token"]
    code = pyotp.TOTP(_totp_secret(ADMIN_UID)).now()
    r2 = requests.post(f"{BASE}/api/admin/auth/totp",
                       json={"pre_token": pre, "code": code}, headers=UA, timeout=30)
    assert r2.status_code == 200, r2.text
    return {**UA, "Authorization": f"Bearer {bearer}", "X-Admin-Token": r2.json()["admin_token"]}


# --------- POST /api/admin/me/password ---------
def test_me_password_wrong_old_401(admin_headers):
    """Valid new password but wrong old password -> 401 舊密碼錯誤 (safe, won't change pw)."""
    r = requests.post(f"{BASE}/api/admin/me/password",
                      json={"old_password": "WrongPw#999999", "new_password": "NewTestPw#1234"},
                      headers=admin_headers, timeout=30)
    assert r.status_code == 401, r.text
    assert "舊密碼" in r.json().get("detail", "")


def test_me_password_bad_new_400(admin_headers):
    """new_password='short' -> 400 (rule check runs before verify_password → safe)."""
    r = requests.post(f"{BASE}/api/admin/me/password",
                      json={"old_password": "whatever", "new_password": "short"},
                      headers=admin_headers, timeout=30)
    assert r.status_code == 400, r.text
    assert "8~32" in r.json().get("detail", "") or "字母" in r.json().get("detail", "")


def test_me_password_same_as_old_400(admin_headers):
    """old == new (both pass rule) -> 400 新密碼不可與舊密碼相同 (no clerk call yet → safe)."""
    pw = "SamePwTest#1234"
    r = requests.post(f"{BASE}/api/admin/me/password",
                      json={"old_password": pw, "new_password": pw},
                      headers=admin_headers, timeout=30)
    assert r.status_code == 400, r.text
    assert "相同" in r.json().get("detail", "")


# --------- POST /api/admin/admins/{uid}/password ---------
def test_reset_pw_nonexistent_uid_404(admin_headers):
    r = requests.post(f"{BASE}/api/admin/admins/user_nonexist/password",
                      json={"new_password": "NewTestPw#1234"},
                      headers=admin_headers, timeout=30)
    assert r.status_code == 404, r.text


def test_reset_pw_bad_new_400(admin_headers):
    r = requests.post(f"{BASE}/api/admin/admins/{ADMIN_UID}/password",
                      json={"new_password": "short"},
                      headers=admin_headers, timeout=30)
    assert r.status_code == 400, r.text


def test_reset_pw_same_value_then_login_still_works(admin_headers):
    """Reset test admin's password to the SAME current value; Clerk accepts no-op. Then verify login still works."""
    r = requests.post(f"{BASE}/api/admin/admins/{ADMIN_UID}/password",
                      json={"new_password": ADMIN_PW},
                      headers=admin_headers, timeout=60)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    # Confirm login still succeeds with the same password
    r2 = requests.post(f"{BASE}/api/admin/auth/login",
                       json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW},
                       headers=UA, timeout=30)
    assert r2.status_code == 200, r2.text
    assert "pre_token" in r2.json()


# --------- Hidden admin path (frontend) — just verify API-level 404 is NOT about these backend routes ---------
# (All the hidden-path assertions are on the frontend; nothing specific to backend to assert.)
