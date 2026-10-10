"""Iteration 11 backend tests.

Covers:
- Dashboard today_* stats (today_orders / today_paid / today_success_rate)
- /api/chain/txs admin-only, with ?address= and ?order_no= filters, explorer field
- /api/security/policy GET (admin & operator) and PUT (admin only; others 403)
- Security headers on every /api response
- Rate limit (>300 requests/60s/IP => HTTP 429) — runs LAST
- Login new-device email is fire-and-forget (login not broken)
- Regression on orders/ledger/operators/audit-logs
- Final cleanup: policy reset and admin 2FA DISABLED.
"""
import os
import time
import pytest
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
def tokens():
    out = {}
    for key, cred in [("admin", ADMIN), ("merchant", MERCHANT), ("agent", AGENT), ("operator", OPERATOR)]:
        r = login(*cred)
        assert r.status_code == 200, f"{key} login failed: {r.status_code} {r.text}"
        out[key] = r.json()["token"]
    return out


# ---------------------------------------------------------------------------
# Regression (quick smoke)
# ---------------------------------------------------------------------------
class TestRegression:
    def test_me(self, tokens):
        for role in ("admin", "merchant", "agent", "operator"):
            r = requests.get(f"{API}/auth/me", headers=hdr(tokens[role]))
            assert r.status_code == 200, f"{role} /me: {r.text}"

    def test_orders_list(self, tokens):
        r = requests.get(f"{API}/orders", headers=hdr(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_ledger_merchant(self, tokens):
        r = requests.get(f"{API}/balance/ledger", headers=hdr(tokens["merchant"]))
        assert r.status_code == 200
        assert "entries" in r.json()

    def test_ledger_month_filter(self, tokens):
        r = requests.get(f"{API}/balance/ledger?month=2020-01", headers=hdr(tokens["merchant"]))
        assert r.status_code == 200
        assert r.json()["entries"] == []

    def test_operators_admin(self, tokens):
        r = requests.get(f"{API}/operators", headers=hdr(tokens["admin"]))
        assert r.status_code == 200

    def test_audit_logs(self, tokens):
        r = requests.get(f"{API}/audit-logs", headers=hdr(tokens["admin"]))
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Dashboard today_* stats
# ---------------------------------------------------------------------------
class TestDashboardToday:
    def test_admin_today_fields(self, tokens):
        r = requests.get(f"{API}/dashboard/stats", headers=hdr(tokens["admin"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("today_orders", "today_paid", "today_success_rate"):
            assert k in d, f"missing {k} in {list(d.keys())}"
        assert isinstance(d["today_orders"], int)
        assert isinstance(d["today_paid"], int)
        assert isinstance(d["today_success_rate"], (int, float))
        if d["today_orders"]:
            expected = round(d["today_paid"] / d["today_orders"] * 100, 1)
            assert d["today_success_rate"] == expected
        else:
            assert d["today_success_rate"] == 0.0

    def test_merchant_today_fields(self, tokens):
        r = requests.get(f"{API}/dashboard/stats", headers=hdr(tokens["merchant"]))
        assert r.status_code == 200
        d = r.json()
        assert "today_orders" in d and "today_paid" in d and "today_success_rate" in d

    def test_agent_today_fields(self, tokens):
        r = requests.get(f"{API}/dashboard/stats", headers=hdr(tokens["agent"]))
        assert r.status_code == 200
        d = r.json()
        assert "today_orders" in d and "today_paid" in d and "today_success_rate" in d


# ---------------------------------------------------------------------------
# /api/chain/txs admin-only
# ---------------------------------------------------------------------------
class TestChainTxs:
    def test_admin_can_list(self, tokens):
        r = requests.get(f"{API}/chain/txs", headers=hdr(tokens["admin"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            # explorer url present and matches network
            assert "explorer" in row and row["explorer"].startswith("http")
            for f in ("tx_id", "network", "to"):
                assert f in row

    def test_merchant_forbidden(self, tokens):
        r = requests.get(f"{API}/chain/txs", headers=hdr(tokens["merchant"]))
        assert r.status_code == 403, r.text

    def test_agent_forbidden(self, tokens):
        r = requests.get(f"{API}/chain/txs", headers=hdr(tokens["agent"]))
        assert r.status_code == 403, r.text

    def test_operator_forbidden(self, tokens):
        # Per request: operator lacks channels.manage so expected 403 (current impl: role-only, 403)
        r = requests.get(f"{API}/chain/txs", headers=hdr(tokens["operator"]))
        assert r.status_code == 403, r.text

    def test_address_filter(self, tokens):
        # Find any chain-tx addr from admin list, then re-filter
        r = requests.get(f"{API}/chain/txs", headers=hdr(tokens["admin"]))
        assert r.status_code == 200
        rows = r.json()
        if not rows:
            pytest.skip("no chain_txs data to filter")
        addr = rows[0]["to"]
        r2 = requests.get(f"{API}/chain/txs", headers=hdr(tokens["admin"]), params={"address": addr})
        assert r2.status_code == 200
        for row in r2.json():
            assert row["to"].lower() == addr.lower()

    def test_order_no_filter_empty_ok(self, tokens):
        r = requests.get(f"{API}/chain/txs", headers=hdr(tokens["admin"]),
                         params={"order_no": "NO_SUCH_ORDER_123"})
        assert r.status_code == 200
        assert r.json() == []


# ---------------------------------------------------------------------------
# /api/security/policy
# ---------------------------------------------------------------------------
class TestSecurityPolicy:
    def test_admin_get(self, tokens):
        r = requests.get(f"{API}/security/policy", headers=hdr(tokens["admin"]))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("enforce_admin_2fa", "enforce_operator_2fa", "login_alert", "enforced_for_me"):
            assert k in d

    def test_operator_get(self, tokens):
        r = requests.get(f"{API}/security/policy", headers=hdr(tokens["operator"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "enforce_operator_2fa" in d

    def test_merchant_put_forbidden(self, tokens):
        r = requests.put(f"{API}/security/policy", headers=hdr(tokens["merchant"]),
                         json={"enforce_admin_2fa": True, "enforce_operator_2fa": False, "login_alert": True})
        assert r.status_code == 403

    def test_operator_put_forbidden(self, tokens):
        r = requests.put(f"{API}/security/policy", headers=hdr(tokens["operator"]),
                         json={"enforce_admin_2fa": True, "enforce_operator_2fa": False, "login_alert": True})
        assert r.status_code == 403

    def test_admin_put_updates(self, tokens):
        # Set to all True first
        r = requests.put(f"{API}/security/policy", headers=hdr(tokens["admin"]),
                         json={"enforce_admin_2fa": True, "enforce_operator_2fa": True, "login_alert": True})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["enforce_admin_2fa"] is True
        assert d["enforce_operator_2fa"] is True

        # Verify via GET
        rg = requests.get(f"{API}/security/policy", headers=hdr(tokens["admin"]))
        assert rg.status_code == 200
        d2 = rg.json()
        assert d2["enforce_admin_2fa"] is True
        assert d2["enforced_for_me"] is True  # admin + enforce_admin_2fa

    def test_zzz_reset_policy(self, tokens):
        """Reset to defaults (as per request)."""
        r = requests.put(f"{API}/security/policy", headers=hdr(tokens["admin"]),
                         json={"enforce_admin_2fa": False, "enforce_operator_2fa": False, "login_alert": True})
        assert r.status_code == 200
        d = r.json()
        assert d["enforce_admin_2fa"] is False
        assert d["enforce_operator_2fa"] is False
        assert d["login_alert"] is True


# ---------------------------------------------------------------------------
# Security headers on every /api response
# ---------------------------------------------------------------------------
class TestSecurityHeaders:
    def test_headers_on_me(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=hdr(tokens["admin"]))
        h = {k.lower(): v for k, v in r.headers.items()}
        assert h.get("x-frame-options") == "DENY"
        assert h.get("x-content-type-options") == "nosniff"
        assert "referrer-policy" in h
        assert "strict-transport-security" in h
        assert "permissions-policy" in h

    def test_headers_on_error_response(self):
        r = requests.get(f"{API}/auth/me")  # no auth -> 401
        h = {k.lower(): v for k, v in r.headers.items()}
        assert h.get("x-frame-options") == "DENY"
        assert h.get("x-content-type-options") == "nosniff"


# ---------------------------------------------------------------------------
# Login new-device email fire-and-forget: login still returns token promptly
# ---------------------------------------------------------------------------
class TestLoginFireAndForget:
    def test_merchant_login_fast(self):
        t0 = time.time()
        r = login(*MERCHANT)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        assert "token" in r.json()
        assert elapsed < 5.0, f"login too slow: {elapsed}s (new-device email must be background)"


# ---------------------------------------------------------------------------
# Rate limit — runs LAST (window resets after 60s)
# ---------------------------------------------------------------------------
class TestZZZZRateLimit:
    def test_rate_limit_trips_at_300(self, tokens):
        """Burst ~320 lightweight GETs to /api/auth/me to trip 429."""
        headers = hdr(tokens["admin"])
        got_429 = False
        detail = None
        s = requests.Session()
        s.headers.update(headers)
        # Use a benign endpoint; count both normal & rate-limited responses
        for i in range(320):
            r = s.get(f"{API}/auth/me")
            if r.status_code == 429:
                got_429 = True
                try:
                    detail = r.json().get("detail")
                except Exception:
                    detail = r.text
                break
        assert got_429, "Expected HTTP 429 within 320 requests"
        assert detail and "频繁" in detail, f"unexpected 429 detail: {detail}"
        # Wait for rate-limit window to reset so later tests (final admin login) succeed
        time.sleep(62)


# ---------------------------------------------------------------------------
# SAFETY (final): admin can password-login & 2FA still disabled & policy default
# ---------------------------------------------------------------------------
def test_zzz_final_admin_ok_and_policy_default():
    # Login
    r = login(*ADMIN)
    assert r.status_code == 200, f"CRITICAL: admin login broken: {r.status_code} {r.text}"
    tok = r.json()["token"]
    me = requests.get(f"{API}/auth/me", headers=hdr(tok))
    assert me.status_code == 200
    assert me.json().get("totp_enabled") is not True, "Admin 2FA must be disabled at end"

    # Policy must be default
    pol = requests.get(f"{API}/security/policy", headers=hdr(tok))
    assert pol.status_code == 200
    d = pol.json()
    assert d["enforce_admin_2fa"] is False
    assert d["enforce_operator_2fa"] is False
    assert d["login_alert"] is True
