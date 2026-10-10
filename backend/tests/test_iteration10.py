"""Iteration 10 backend tests.

Covers:
- 2FA failed-code lockout (brute-force counter counts bad TOTP codes)
- Balance ledger month filter (?month=YYYY-MM, 400 on invalid)
- 2FA enable/disable security emails are fire-and-forget (no 500, no error log)
- Regression after email_utils.py extraction
- Admin ajin53193@gmail.com must end with 2FA disabled (safety).
"""
import os
import time
import uuid
import pytest
import pyotp
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("ajin53193@gmail.com", "admin888")
MERCHANT = ("merchant@demo.com", "merchant888")
AGENT = ("agent@demo.com", "agent888")
OPERATOR = ("operator@demo.com", "operator888")


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def login(email, password, code=None):
    body = {"email": email, "password": password}
    if code:
        body["code"] = code
    return requests.post(f"{API}/auth/login", json=body)


@pytest.fixture(scope="module")
def admin_token():
    r = login(*ADMIN)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def merchant_token():
    r = login(*MERCHANT)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------------------------------------------------------------------------
# Regression: core endpoints after email_utils.py extraction
# ---------------------------------------------------------------------------
class TestRegression:
    def test_admin_login(self, admin_token):
        assert admin_token

    def test_merchant_login(self, merchant_token):
        assert merchant_token

    def test_agent_login(self):
        r = login(*AGENT)
        assert r.status_code == 200, r.text

    def test_operator_login(self):
        r = login(*OPERATOR)
        assert r.status_code == 200, r.text

    def test_me(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=hdr(admin_token))
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN[0]

    def test_orders_list(self, admin_token):
        r = requests.get(f"{API}/orders", headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), (list, dict))

    def test_balance_ledger_merchant(self, merchant_token):
        r = requests.get(f"{API}/balance/ledger", headers=hdr(merchant_token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "account" in body and "entries" in body

    def test_operators_admin(self, admin_token):
        r = requests.get(f"{API}/operators", headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_audit_logs_admin(self, admin_token):
        r = requests.get(f"{API}/audit-logs", headers=hdr(admin_token))
        assert r.status_code == 200, r.text

    def test_2fa_setup_qr(self, admin_token):
        r = requests.post(f"{API}/auth/2fa/setup", headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "secret" in data and "qr" in data
        assert data["qr"].startswith("data:image/png;base64,")


# ---------------------------------------------------------------------------
# Balance ledger month filter
# ---------------------------------------------------------------------------
class TestLedgerMonthFilter:
    def test_no_month_returns_all(self, merchant_token):
        r = requests.get(f"{API}/balance/ledger", headers=hdr(merchant_token))
        assert r.status_code == 200
        self.all_count = len(r.json()["entries"])
        TestLedgerMonthFilter._all = self.all_count

    def test_october_2026_subset(self, merchant_token):
        r = requests.get(f"{API}/balance/ledger", headers=hdr(merchant_token), params={"month": "2026-10"})
        assert r.status_code == 200, r.text
        entries = r.json()["entries"]
        # All entries must be in October 2026
        for e in entries:
            assert e["created_at"].startswith("2026-10"), f"entry outside month: {e['created_at']}"
        # subset of all
        assert len(entries) <= getattr(TestLedgerMonthFilter, "_all", len(entries) + 1)

    def test_old_month_zero(self, merchant_token):
        r = requests.get(f"{API}/balance/ledger", headers=hdr(merchant_token), params={"month": "2020-01"})
        assert r.status_code == 200
        assert r.json()["entries"] == []

    def test_invalid_month_400(self, merchant_token):
        r = requests.get(f"{API}/balance/ledger", headers=hdr(merchant_token), params={"month": "2026-13"})
        assert r.status_code == 400, r.text

    def test_report_month_filter(self, merchant_token):
        r = requests.get(f"{API}/reports/balance-ledger", headers=hdr(merchant_token), params={"month": "2020-01"})
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "").lower() or r.headers.get("content-type", "").startswith("application/")

    def test_report_invalid_month(self, merchant_token):
        r = requests.get(f"{API}/reports/balance-ledger", headers=hdr(merchant_token), params={"month": "bad"})
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# 2FA failed-code lockout (throwaway operator account)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def throwaway_op(admin_token):
    """Create a throwaway operator and enable 2FA on it."""
    email = f"test_2fa_{uuid.uuid4().hex[:8]}@demo.com"
    password = "ThrowAway888!"
    # Create operator
    r = requests.post(f"{API}/accounts", headers=hdr(admin_token), json={
        "email": email, "password": password, "name": "TEST 2FA Lockout",
        "role": "operator", "permissions": ["orders.view"],
    })
    assert r.status_code == 200, r.text
    # Login as operator (no 2FA yet)
    rl = login(email, password)
    assert rl.status_code == 200, rl.text
    op_token = rl.json()["token"]
    # Setup 2FA
    rs = requests.post(f"{API}/auth/2fa/setup", headers=hdr(op_token))
    assert rs.status_code == 200, rs.text
    secret = rs.json()["secret"]
    # Enable with current code
    code = pyotp.TOTP(secret).now()
    re = requests.post(f"{API}/auth/2fa/enable", headers=hdr(op_token), json={"code": code})
    assert re.status_code == 200, re.text
    yield {"email": email, "password": password, "secret": secret, "token": op_token}
    # Teardown: clear any lockout
    requests.delete(f"{API}/auth/lockouts/{email}", headers=hdr(admin_token))


class TestTwoFALockout:
    def test_wrong_code_locks_after_5(self, throwaway_op, admin_token):
        email = throwaway_op["email"]; pw = throwaway_op["password"]
        # Pre-clear any lockout from prior runs
        requests.delete(f"{API}/auth/lockouts/{email}", headers=hdr(admin_token))

        statuses = []
        for _ in range(5):
            r = login(email, pw, code="000000")
            statuses.append(r.status_code)
        # First attempts 401, final (5th) 423
        assert statuses[-1] == 423, f"Expected lockout 423, got {statuses}"
        assert all(s in (401, 423) for s in statuses), statuses

        # 6th should still be 423 (locked)
        r = login(email, pw, code="000000")
        assert r.status_code == 423

        # Clear lockout via admin
        rd = requests.delete(f"{API}/auth/lockouts/{email}", headers=hdr(admin_token))
        assert rd.status_code in (200, 204)

        # Now a correct code should log in
        correct = pyotp.TOTP(throwaway_op["secret"]).now()
        r = login(email, pw, code=correct)
        assert r.status_code == 200, r.text

    def test_failed_2fa_does_not_break_response(self, throwaway_op, admin_token):
        """A failed 2FA login must return 401 (or 423) promptly; email is fire-and-forget."""
        requests.delete(f"{API}/auth/lockouts/{throwaway_op['email']}", headers=hdr(admin_token))
        t0 = time.time()
        r = login(throwaway_op["email"], throwaway_op["password"], code="111111")
        elapsed = time.time() - t0
        assert r.status_code in (401, 423)
        assert elapsed < 5.0, f"login too slow: {elapsed}s (email must be background)"
        requests.delete(f"{API}/auth/lockouts/{throwaway_op['email']}", headers=hdr(admin_token))


# ---------------------------------------------------------------------------
# 2FA enable/disable security emails: non-blocking, no error raised
# ---------------------------------------------------------------------------
class TestSecurityEmails:
    def test_enable_disable_does_not_break_response(self, throwaway_op, admin_token):
        """Enable then disable 2FA on throwaway op — endpoints must return 200 fast."""
        email = throwaway_op["email"]; pw = throwaway_op["password"]
        requests.delete(f"{API}/auth/lockouts/{email}", headers=hdr(admin_token))

        # Login with valid code
        secret = throwaway_op["secret"]
        rlog = login(email, pw, code=pyotp.TOTP(secret).now())
        assert rlog.status_code == 200
        op_tok = rlog.json()["token"]

        # Disable 2FA — must succeed with notify_security scheduled
        t0 = time.time()
        rd = requests.post(f"{API}/auth/2fa/disable", headers=hdr(op_tok), json={"code": pyotp.TOTP(secret).now()})
        assert rd.status_code == 200, rd.text
        assert rd.json().get("totp_enabled") is False
        assert time.time() - t0 < 5.0

        # Re-enable 2FA (so cleanup fixture is consistent) — setup fresh
        rs = requests.post(f"{API}/auth/2fa/setup", headers=hdr(op_tok))
        assert rs.status_code == 200
        new_secret = rs.json()["secret"]
        t0 = time.time()
        re = requests.post(f"{API}/auth/2fa/enable", headers=hdr(op_tok), json={"code": pyotp.TOTP(new_secret).now()})
        assert re.status_code == 200, re.text
        assert re.json().get("totp_enabled") is True
        assert time.time() - t0 < 5.0


# ---------------------------------------------------------------------------
# SAFETY: admin ajin53193@gmail.com must end with 2FA DISABLED
# ---------------------------------------------------------------------------
def test_zzz_admin_2fa_disabled_at_end():
    """Final safeguard: ensure admin can password-login (2FA must be disabled)."""
    r = login(*ADMIN)
    assert r.status_code == 200, (
        f"CRITICAL: admin password login broken! status={r.status_code} body={r.text}"
    )
    me = requests.get(f"{API}/auth/me", headers=hdr(r.json()["token"]))
    assert me.status_code == 200
    assert me.json().get("totp_enabled") is not True, "Admin 2FA must be disabled at end of tests"
