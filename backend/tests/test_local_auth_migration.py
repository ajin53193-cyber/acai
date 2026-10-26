# Self-hosted auth (bcrypt + JWT) regression tests: register/login/OTP/reset/change pw, legacy lazy migration,
# admin 2FA login, admin member actions (ban/unban/reset/create-test), IP/region filtering.
import os
import random
import time

import pyotp
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
CODE = "424242"
ADMIN_EMAIL = "admin@gogo589.com"
ADMIN_PW = "Gg589!kVTEyEy16n"
TOTP_SECRET = "2FAI3HWF6WYDNSQC7DNSUGKZ4HWQBMOH"
LEGACY_EMAIL = "tester+clerk_test@shop.com"
LEGACY_PW = "Gogo589!Tester#4m9Z"
LEGACY_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
MEMBER_PHONE = "+12015556760"
MEMBER_PW = "Abc12345"


def _db():
    env = {}
    for line in open("/app/backend/.env"):
        if "=" in line and line.split("=", 1)[0] in ("MONGO_URL", "DB_NAME"):
            k, v = line.strip().split("=", 1)
            env[k] = v.strip('"')
    return MongoClient(env["MONGO_URL"])[env["DB_NAME"]]


def rand_phone():
    return "+1201555" + "".join(random.choice("0123456789") for _ in range(5))


def rand_email(prefix="qa"):
    return f"{prefix}{random.randint(100000, 999999)}+clerk_test@shop.com"


def bearer(t, extra=None):
    h = {"Authorization": f"Bearer {t}"}
    h.update(extra or {})
    return h


def phone_register(phone, pw="Abc12345"):
    r = requests.post(f"{API}/auth/email/phone/send-code", json={"phone": phone, "purpose": "register"})
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/auth/email/phone/register", json={"phone": phone, "code": CODE, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/admin/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    pre = r.json()["pre_token"]
    r = requests.post(f"{API}/admin/auth/totp", json={"pre_token": pre, "code": pyotp.TOTP(TOTP_SECRET).now()})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["token"] and d["admin_token"]
    return {"Authorization": f"Bearer {d['token']}", "X-Admin-Token": d["admin_token"]}


# ---------- registration ----------
class TestRegister:
    def test_phone_register_and_me(self):
        phone = rand_phone()
        d = phone_register(phone)
        assert d["token"] and d["user_id"].startswith("user_")
        h = bearer(d["token"])
        me = requests.get(f"{API}/auth/me", headers=h)
        assert me.status_code == 200 and me.json()["phone"] == phone and me.json()["user_id"] == d["user_id"]
        assert me.json()["password_enabled"] is True
        assert requests.get(f"{API}/me", headers=h).status_code == 200
        assert requests.get(f"{API}/me/profile", headers=h).status_code == 200

    def test_phone_register_duplicate(self):
        r = requests.post(f"{API}/auth/email/phone/send-code", json={"phone": MEMBER_PHONE, "purpose": "register"})
        assert r.status_code == 409

    def test_email_register_and_duplicate(self):
        email = rand_email()
        r = requests.post(f"{API}/auth/email/send-code", json={"email": email, "purpose": "register"})
        assert r.status_code == 200, r.text
        r = requests.post(f"{API}/auth/email/register", json={"email": email, "code": CODE, "password": "Abc12345"})
        assert r.status_code == 200, r.text
        tok = r.json()["token"]
        me = requests.get(f"{API}/auth/me", headers=bearer(tok)).json()
        assert me["email"] == email
        r = requests.post(f"{API}/auth/email/send-code", json={"email": email, "purpose": "register"})
        assert r.status_code == 409
        # password login with email
        r = requests.post(f"{API}/auth/email/password-login", json={"identifier": email.upper(), "password": "Abc12345"})
        assert r.status_code == 200, r.text

    def test_weak_password_rejected(self):
        phone = rand_phone()
        requests.post(f"{API}/auth/email/phone/send-code", json={"phone": phone, "purpose": "register"})
        r = requests.post(f"{API}/auth/email/phone/register", json={"phone": phone, "code": CODE, "password": "abcdefgh"})
        assert r.status_code == 400

    def test_wrong_code(self):
        phone = rand_phone()
        requests.post(f"{API}/auth/email/phone/send-code", json={"phone": phone, "purpose": "register"})
        r = requests.post(f"{API}/auth/email/phone/register", json={"phone": phone, "code": "000000", "password": "Abc12345"})
        assert r.status_code == 400


# ---------- password + OTP login ----------
class TestLogin:
    def test_phone_password_login(self):
        r = requests.post(f"{API}/auth/email/password-login", json={"identifier": MEMBER_PHONE, "password": MEMBER_PW})
        assert r.status_code == 200, r.text
        assert r.json()["user_id"] == "user_993de66017fb213aee3ef136"

    def test_wrong_password(self):
        r = requests.post(f"{API}/auth/email/password-login", json={"identifier": MEMBER_PHONE, "password": "Wrong1234"})
        assert r.status_code == 401 and r.json()["detail"] == "帳號或密碼錯誤"

    def test_unknown_account(self):
        r = requests.post(f"{API}/auth/email/password-login", json={"identifier": "nobody_zz+clerk_test@shop.com", "password": "Abc12345"})
        assert r.status_code == 401

    def test_email_otp_login(self):
        email = rand_email("otp")
        requests.post(f"{API}/auth/email/send-code", json={"email": email, "purpose": "register"})
        uid = requests.post(f"{API}/auth/email/register", json={"email": email, "code": CODE, "password": "Abc12345"}).json()["user_id"]
        r = requests.post(f"{API}/auth/email/send-code", json={"email": email, "purpose": "login"})
        assert r.status_code == 200, r.text
        r = requests.post(f"{API}/auth/email/verify", json={"email": email, "code": CODE})
        assert r.status_code == 200 and r.json()["user_id"] == uid
        assert requests.get(f"{API}/me", headers=bearer(r.json()["token"])).status_code == 200

    def test_phone_otp_login(self):
        phone = rand_phone()
        uid = phone_register(phone)["user_id"]
        r = requests.post(f"{API}/auth/email/phone/send-code", json={"phone": phone, "purpose": "login"})
        assert r.status_code == 200, r.text
        r = requests.post(f"{API}/auth/email/phone/verify", json={"phone": phone, "code": CODE})
        assert r.status_code == 200 and r.json()["user_id"] == uid

    def test_otp_login_unknown(self):
        r = requests.post(f"{API}/auth/email/send-code", json={"email": "nobody_zz2+clerk_test@shop.com", "purpose": "login"})
        assert r.status_code == 404

    def test_no_token_and_garbage(self):
        assert requests.get(f"{API}/me").status_code == 401
        assert requests.get(f"{API}/me", headers=bearer("garbage.token.x")).status_code == 401
        assert requests.get(f"{API}/auth/me").status_code == 401


# ---------- password reset / change ----------
class TestPasswordFlows:
    def test_email_reset_invalidates_old_token(self):
        email = rand_email("rst")
        requests.post(f"{API}/auth/email/send-code", json={"email": email, "purpose": "register"})
        old = requests.post(f"{API}/auth/email/register", json={"email": email, "code": CODE, "password": "Abc12345"}).json()["token"]
        assert requests.get(f"{API}/me", headers=bearer(old)).status_code == 200
        r = requests.post(f"{API}/auth/email/send-code", json={"email": email, "purpose": "reset"})
        assert r.status_code == 200, r.text
        r = requests.post(f"{API}/auth/email/reset-password", json={"email": email, "code": CODE, "new_password": "NewPw1234"})
        assert r.status_code == 200, r.text
        new = r.json()["token"]
        assert requests.get(f"{API}/me", headers=bearer(old)).status_code == 401
        assert requests.get(f"{API}/me", headers=bearer(new)).status_code == 200
        assert requests.post(f"{API}/auth/email/password-login", json={"identifier": email, "password": "NewPw1234"}).status_code == 200
        assert requests.post(f"{API}/auth/email/password-login", json={"identifier": email, "password": "Abc12345"}).status_code == 401

    def test_phone_reset(self):
        phone = rand_phone()
        old = phone_register(phone)["token"]
        requests.post(f"{API}/auth/email/phone/send-code", json={"phone": phone, "purpose": "reset"})
        r = requests.post(f"{API}/auth/email/phone/reset-password", json={"phone": phone, "code": CODE, "password": "NewPw1234"})
        assert r.status_code == 200, r.text
        assert requests.get(f"{API}/me", headers=bearer(old)).status_code == 401
        assert requests.post(f"{API}/auth/email/password-login", json={"identifier": phone, "password": "NewPw1234"}).status_code == 200

    def test_change_password_by_old(self):
        phone = rand_phone()
        tok = phone_register(phone)["token"]
        r = requests.post(f"{API}/auth/email/me/change-password-by-old", json={"current_password": "Wrong123", "new_password": "Chg12345"}, headers=bearer(tok))
        assert r.status_code == 400
        r = requests.post(f"{API}/auth/email/me/change-password-by-old", json={"current_password": "Abc12345", "new_password": "Chg12345"}, headers=bearer(tok))
        assert r.status_code == 200, r.text
        assert requests.post(f"{API}/auth/email/password-login", json={"identifier": phone, "password": "Chg12345"}).status_code == 200
        assert requests.post(f"{API}/auth/email/password-login", json={"identifier": phone, "password": "Abc12345"}).status_code == 401


# ---------- legacy lazy migration ----------
class TestLegacy:
    def test_legacy_login_migrates(self, admin_headers):
        r = requests.post(f"{API}/auth/email/password-login", json={"identifier": LEGACY_EMAIL, "password": LEGACY_PW})
        assert r.status_code == 200, r.text
        assert r.json()["user_id"] == LEGACY_UID
        doc = requests.get(f"{API}/admin/members/{LEGACY_UID}", headers=admin_headers).json()
        assert doc.get("password_enabled") is True
        if "password_hash" in doc:
            assert doc["password_hash"].startswith("$2"), "password_hash not stored"
        # second login works from bcrypt
        r = requests.post(f"{API}/auth/email/password-login", json={"identifier": LEGACY_EMAIL, "password": LEGACY_PW})
        assert r.status_code == 200
        assert requests.post(f"{API}/auth/email/password-login", json={"identifier": LEGACY_EMAIL, "password": "nope12345"}).status_code == 401


# ---------- admin ----------
class TestAdmin:
    def test_admin_endpoints(self, admin_headers):
        for p in ["/admin/members", "/admin/dashboard", "/admin/analytics/sales"]:
            r = requests.get(f"{API}{p}", headers=admin_headers)
            assert r.status_code == 200, f"{p}: {r.status_code} {r.text[:200]}"
        r = requests.get(f"{API}/admin/members/user_993de66017fb213aee3ef136", headers=admin_headers)
        assert r.status_code == 200 and r.json()["phone"] == MEMBER_PHONE

    def test_admin_without_admin_token(self, admin_headers):
        r = requests.get(f"{API}/admin/members", headers={"Authorization": admin_headers["Authorization"]})
        assert r.status_code == 401

    def test_member_not_admin(self):
        tok = requests.post(f"{API}/auth/email/password-login", json={"identifier": MEMBER_PHONE, "password": MEMBER_PW}).json()["token"]
        assert requests.get(f"{API}/admin/members", headers=bearer(tok)).status_code == 403

    def test_members_no_password_hash_leak(self, admin_headers):
        rows = requests.get(f"{API}/admin/members", headers=admin_headers).json()
        leaked = [r["user_id"] for r in rows if "password_hash" in r]
        assert not leaked, f"password_hash leaked in /admin/members for {len(leaked)} rows"

    def test_member_detail_no_password_hash_leak(self, admin_headers):
        d = requests.get(f"{API}/admin/members/user_993de66017fb213aee3ef136", headers=admin_headers).json()
        assert "password_hash" not in d, "password_hash leaked in member detail"

    def test_members_search_phone_plus(self, admin_headers):
        r = requests.get(f"{API}/admin/members", params={"q": MEMBER_PHONE}, headers=admin_headers)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        assert any(x["user_id"] == "user_993de66017fb213aee3ef136" for x in r.json())

    def test_ban_unban_reset(self, admin_headers):
        phone = rand_phone()
        d = phone_register(phone)
        uid, tok = d["user_id"], d["token"]
        r = requests.post(f"{API}/admin/members/{uid}/ban", json={"reason": "TEST"}, headers=admin_headers)
        assert r.status_code == 200
        st = requests.get(f"{API}/me", headers=bearer(tok)).status_code
        assert st in (401, 403), st
        assert requests.post(f"{API}/auth/email/password-login", json={"identifier": phone, "password": "Abc12345"}).status_code == 403
        r = requests.post(f"{API}/admin/members/{uid}/unban", headers=admin_headers)
        assert r.status_code == 200
        r = requests.post(f"{API}/auth/email/password-login", json={"identifier": phone, "password": "Abc12345"})
        assert r.status_code == 200
        assert requests.get(f"{API}/me", headers=bearer(r.json()["token"])).status_code == 200
        r = requests.post(f"{API}/admin/members/{uid}/reset-password", json={"new_password": "Adm12345"}, headers=admin_headers)
        assert r.status_code == 200
        assert requests.post(f"{API}/auth/email/password-login", json={"identifier": phone, "password": "Adm12345"}).status_code == 200

    def test_banned_token_gets_403(self, admin_headers):
        """Spec: banned user's token gets 403 on /api/me (ban bumps token_ver so we observe 401 instead)."""
        phone = rand_phone()
        d = phone_register(phone)
        requests.post(f"{API}/admin/members/{d['user_id']}/ban", json={}, headers=admin_headers)
        st = requests.get(f"{API}/me", headers=bearer(d["token"])).status_code
        requests.post(f"{API}/admin/members/{d['user_id']}/unban", headers=admin_headers)
        assert st == 403, f"expected 403 got {st}"

    def test_create_test_member(self, admin_headers):
        email = rand_email("qa-test")
        r = requests.post(f"{API}/admin/members/create-test", json={"email": email, "password": "Abc12345"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert requests.post(f"{API}/auth/email/password-login", json={"identifier": email, "password": "Abc12345"}).status_code == 200
        r = requests.post(f"{API}/admin/members/create-test", json={"email": email, "password": "Abc12345"}, headers=admin_headers)
        assert r.status_code == 409

    def test_ip_region(self, admin_headers):
        phone = rand_phone()
        d = phone_register(phone)
        r = requests.get(f"{API}/me", headers=bearer(d["token"], {"X-Forwarded-For": "113.108.0.1"}))
        assert r.status_code == 200
        time.sleep(4)
        row = next(x for x in requests.get(f"{API}/admin/members", params={"q": phone[1:]}, headers=admin_headers).json() if x["user_id"] == d["user_id"])
        print("last_ip", row.get("last_ip"), "region", row.get("last_ip_region"))
        assert row.get("last_ip"), "last_ip not set"
        ip = row["last_ip"]
        r = requests.get(f"{API}/admin/members", params={"q": ip}, headers=admin_headers)
        assert any(x["user_id"] == d["user_id"] for x in r.json())
        if row.get("last_ip_region"):
            r = requests.get(f"{API}/admin/members", params={"q": row["last_ip_region"].split()[-1]}, headers=admin_headers)
            assert any(x["user_id"] == d["user_id"] for x in r.json())
