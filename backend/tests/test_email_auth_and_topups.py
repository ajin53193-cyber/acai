"""Iteration 16: Email OTP auth (/api/auth/email/*) + wallet topups listing."""
import os
import random
import string
import subprocess
import time

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MEMBER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
MEMBER_EMAIL = "tester+clerk_test@shop.com"
MEMBER_PW = "Gogo589!Tester#4m9Z"
CODE = "424242"
UA = {"User-Agent": "gogo589-test/pytest"}


def _rand():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


@pytest.fixture(scope="module")
def member_token():
    out = subprocess.check_output(["python", "/app/tests/mint_token.py", MEMBER_UID], text=True).strip()
    assert out
    return out


@pytest.fixture
def auth_headers(member_token):
    return {"Authorization": f"Bearer {member_token}", **UA}


# ---------- /api/auth/email/send-code ----------
class TestSendCode:
    def test_send_code_login_ok(self):
        # Ensure no cooldown by using a fresh email for this test (login purpose allows unregistered)
        email = f"sendtest{_rand()}+clerk_test@shop.com"
        r = requests.post(f"{BASE}/api/auth/email/send-code",
                          json={"email": email, "purpose": "login"}, headers=UA)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["sent"] is True
        assert data["resend_after"] == 60
        assert data["expires_in"] == 600
        assert data["is_new"] is True  # unregistered

    def test_resend_cooldown(self):
        email = f"cooldown{_rand()}+clerk_test@shop.com"
        r1 = requests.post(f"{BASE}/api/auth/email/send-code",
                           json={"email": email, "purpose": "login"}, headers=UA)
        assert r1.status_code == 200
        r2 = requests.post(f"{BASE}/api/auth/email/send-code",
                           json={"email": email, "purpose": "login"}, headers=UA)
        assert r2.status_code == 429

    def test_reset_unregistered_404(self):
        email = f"nouser{_rand()}+clerk_test@shop.com"
        r = requests.post(f"{BASE}/api/auth/email/send-code",
                          json={"email": email, "purpose": "reset"}, headers=UA)
        assert r.status_code == 404
        assert "尚未註冊" in r.json()["detail"]

    def test_invalid_purpose(self):
        r = requests.post(f"{BASE}/api/auth/email/send-code",
                          json={"email": f"x{_rand()}+clerk_test@shop.com", "purpose": "bogus"}, headers=UA)
        assert r.status_code == 400


# ---------- /api/auth/email/verify ----------
class TestVerify:
    def test_verify_existing_user(self):
        # Member - use a fresh account to avoid cross-test cooldown
        email = MEMBER_EMAIL
        # Clean any prior send-code cooldown is per email+purpose; use "login" with a wait? Use different purpose email combo.
        # Just try; if 429, skip
        r = requests.post(f"{BASE}/api/auth/email/send-code",
                          json={"email": email, "purpose": "login"}, headers=UA)
        if r.status_code == 429:
            time.sleep(61)
            r = requests.post(f"{BASE}/api/auth/email/send-code",
                              json={"email": email, "purpose": "login"}, headers=UA)
        assert r.status_code == 200, r.text
        assert r.json()["is_new"] is False

        v = requests.post(f"{BASE}/api/auth/email/verify",
                          json={"email": email, "code": CODE}, headers=UA)
        assert v.status_code == 200, v.text
        data = v.json()
        assert "ticket" in data and data["ticket"]
        assert data["is_new"] is False

    def test_verify_wrong_code_then_consumed(self):
        email = f"wrongcode{_rand()}+clerk_test@shop.com"
        s = requests.post(f"{BASE}/api/auth/email/send-code",
                          json={"email": email, "purpose": "login"}, headers=UA)
        assert s.status_code == 200
        # Wrong code
        bad = requests.post(f"{BASE}/api/auth/email/verify",
                            json={"email": email, "code": "000000"}, headers=UA)
        assert bad.status_code == 400
        assert "驗證碼錯誤" in bad.json()["detail"]
        # Correct → consumes
        ok = requests.post(f"{BASE}/api/auth/email/verify",
                           json={"email": email, "code": CODE}, headers=UA)
        assert ok.status_code == 200
        assert ok.json()["is_new"] is True
        # Reuse → 400
        again = requests.post(f"{BASE}/api/auth/email/verify",
                              json={"email": email, "code": CODE}, headers=UA)
        assert again.status_code == 400


# ---------- /api/auth/email/password-login ----------
class TestPasswordLogin:
    def test_password_login_ok(self):
        r = requests.post(f"{BASE}/api/auth/email/password-login",
                          json={"identifier": MEMBER_EMAIL, "password": MEMBER_PW}, headers=UA)
        assert r.status_code == 200, r.text
        assert r.json().get("ticket")

    def test_password_login_wrong(self):
        r = requests.post(f"{BASE}/api/auth/email/password-login",
                          json={"identifier": MEMBER_EMAIL, "password": "WrongPass!123"}, headers=UA)
        assert r.status_code == 401
        assert "帳號或密碼錯誤" in r.json()["detail"]

    def test_password_login_unknown(self):
        r = requests.post(f"{BASE}/api/auth/email/password-login",
                          json={"identifier": f"ghost{_rand()}+clerk_test@shop.com", "password": "Whatever!123"},
                          headers=UA)
        assert r.status_code == 401


# ---------- /api/auth/email/reset-password ----------
class TestResetPassword:
    def test_reset_ok(self):
        # send reset code for existing member
        time.sleep(2)
        r = requests.post(f"{BASE}/api/auth/email/send-code",
                          json={"email": MEMBER_EMAIL, "purpose": "reset"}, headers=UA)
        if r.status_code == 429:
            time.sleep(61)
            r = requests.post(f"{BASE}/api/auth/email/send-code",
                              json={"email": MEMBER_EMAIL, "purpose": "reset"}, headers=UA)
        assert r.status_code == 200, r.text
        # Reset to same password (keep creds valid)
        rp = requests.post(f"{BASE}/api/auth/email/reset-password",
                           json={"email": MEMBER_EMAIL, "code": CODE, "new_password": MEMBER_PW}, headers=UA)
        assert rp.status_code == 200, rp.text
        assert rp.json().get("ticket")

    def test_reset_weak_password(self):
        r = requests.post(f"{BASE}/api/auth/email/reset-password",
                          json={"email": MEMBER_EMAIL, "code": CODE, "new_password": "abc"}, headers=UA)
        assert r.status_code == 400
        assert "8" in r.json()["detail"]


# ---------- /api/auth/email/me/* ----------
class TestMeEmail:
    def test_me_send_code_no_token(self):
        r = requests.post(f"{BASE}/api/auth/email/me/send-code", headers=UA)
        assert r.status_code == 401

    def test_me_send_and_change_password(self, auth_headers):
        # resend-cooldown-safe: wait before to prevent 429 with previous tests on same email+purpose="change_password"
        s = requests.post(f"{BASE}/api/auth/email/me/send-code", headers=auth_headers)
        if s.status_code == 429:
            time.sleep(61)
            s = requests.post(f"{BASE}/api/auth/email/me/send-code", headers=auth_headers)
        assert s.status_code == 200, s.text
        data = s.json()
        assert "***" in data.get("email", "")
        assert data["email"].startswith("te")  # te***@shop.com

        c = requests.post(f"{BASE}/api/auth/email/me/change-password",
                          json={"code": CODE, "new_password": MEMBER_PW}, headers=auth_headers)
        assert c.status_code == 200, c.text
        assert c.json().get("ok") is True


# ---------- /api/me/wallet/topups ----------
class TestWalletTopups:
    def test_requires_auth(self):
        r = requests.get(f"{BASE}/api/me/wallet/topups", headers=UA)
        assert r.status_code == 401

    def test_list(self, auth_headers):
        r = requests.get(f"{BASE}/api/me/wallet/topups", headers=auth_headers)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        # Validate required fields and sorting if items exist
        if items:
            required = {"id", "amount_usd", "pay_amount", "network", "status", "out_trade_no", "pay_url", "created_at"}
            missing = required - set(items[0].keys())
            assert not missing, f"missing fields: {missing}"
            # Sort check (desc)
            ts = [i["created_at"] for i in items]
            assert ts == sorted(ts, reverse=True)
            # No pending-past-expiry
            now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
            for t in items:
                if t["status"] == "pending" and t.get("expires_at"):
                    assert t["expires_at"] >= now, f"pending row {t['id']} should have been flipped to expired"
