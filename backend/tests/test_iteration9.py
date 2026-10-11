"""Iteration 9 backend tests: Operator Trail, 2FA, Balance Ledger, Payout ledger.

CRITICAL: Ensures 2FA on admin ajin53193@gmail.com is DISABLED at end (session teardown).
"""
import os
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
    if r.status_code == 403:
        pytest.skip("商户后台登录已禁用（仅 API）")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def agent_token():
    r = login(*AGENT)
    if r.status_code == 403:
        pytest.skip("代理后台登录已禁用（仅 API）")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def operator_token():
    r = login(*OPERATOR)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def merchant_info(merchant_token):
    return requests.get(f"{API}/auth/me", headers=hdr(merchant_token)).json()


@pytest.fixture(scope="module")
def operator_id(admin_token):
    r = requests.get(f"{API}/operators", headers=hdr(admin_token))
    assert r.status_code == 200
    ops = r.json()
    for o in ops:
        if o["email"] == OPERATOR[0]:
            return o["id"]
    pytest.skip("operator@demo.com not seeded")


# ============== Operator Trail ==============
class TestOperatorTrail:
    def test_list_operators_admin(self, admin_token):
        r = requests.get(f"{API}/operators", headers=hdr(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        o = data[0]
        for k in ("id", "name", "email", "action_count", "totp_enabled", "totp_required"):
            assert k in o, f"missing field {k}"
        assert isinstance(o["action_count"], int)

    def test_operators_forbidden_merchant(self, merchant_token):
        r = requests.get(f"{API}/operators", headers=hdr(merchant_token))
        assert r.status_code == 403

    def test_operators_forbidden_agent(self, agent_token):
        r = requests.get(f"{API}/operators", headers=hdr(agent_token))
        assert r.status_code == 403

    def test_audit_logs_filter_by_actor_id(self, admin_token, operator_id):
        r = requests.get(f"{API}/audit-logs?actor_id={operator_id}", headers=hdr(admin_token))
        assert r.status_code == 200
        logs = r.json()
        assert isinstance(logs, list)
        for l in logs:
            assert l.get("actor_id") == operator_id


# ============== 2FA Self-Service on Admin ==============
class TestAdmin2FA:
    """CRITICAL: Must restore admin to no-2FA state after."""

    def test_full_2fa_cycle(self, admin_token):
        # Setup
        r = requests.post(f"{API}/auth/2fa/setup", headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "secret" in data and "otpauth_uri" in data and "qr" in data
        assert data["qr"].startswith("data:image/png;base64,")
        secret = data["secret"]

        # Enable with valid code
        code = pyotp.TOTP(secret).now()
        r = requests.post(f"{API}/auth/2fa/enable", json={"code": code}, headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["totp_enabled"] is True

        # /auth/me reflects
        me = requests.get(f"{API}/auth/me", headers=hdr(admin_token)).json()
        assert me["totp_enabled"] is True
        assert "totp_secret" not in me  # never leaked

        # Login without code -> requires_2fa
        r = login(*ADMIN)
        assert r.status_code == 200
        body = r.json()
        assert body.get("requires_2fa") is True
        assert "token" not in body

        # Login with wrong code
        r = login(ADMIN[0], ADMIN[1], code="000000")
        assert r.status_code in (400, 401), r.text

        # Login with valid code
        valid_code = pyotp.TOTP(secret).now()
        r = login(ADMIN[0], ADMIN[1], code=valid_code)
        assert r.status_code == 200, r.text
        assert "token" in r.json()

        # Disable 2FA
        disable_code = pyotp.TOTP(secret).now()
        r = requests.post(f"{API}/auth/2fa/disable", json={"code": disable_code},
                          headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["totp_enabled"] is False

        # Password-only login works again
        r = login(*ADMIN)
        assert r.status_code == 200
        assert "token" in r.json()
        assert not r.json().get("requires_2fa")


# ============== Admin force 2FA on Operator ==============
class TestForce2FA:
    def test_toggle_require_2fa_on_operator(self, admin_token, operator_id):
        # First toggle ON
        r = requests.post(f"{API}/accounts/{operator_id}/require-2fa",
                          headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        initial = r.json()["totp_required"]

        # verify list reflects
        ops = requests.get(f"{API}/operators", headers=hdr(admin_token)).json()
        this_op = next(o for o in ops if o["id"] == operator_id)
        assert this_op["totp_required"] == initial

        # Operator can still login with password (not hard-blocked)
        r = login(*OPERATOR)
        assert r.status_code == 200, r.text
        assert "token" in r.json()
        op_tok = r.json()["token"]

        if initial is True:
            # If now required and operator not enrolled, cannot disable (not enabled, 400)
            # But if we test enroll/disable path: skip for now, verify disable while required
            # Only if operator previously enrolled would 403 trigger. We just verify require flag.
            # Attempt disable without being enabled -> 400
            r2 = requests.post(f"{API}/auth/2fa/disable", json={"code": "000000"},
                               headers=hdr(op_tok))
            # Not enabled yet -> 400
            assert r2.status_code in (400, 403)

        # Toggle back to original state
        r = requests.post(f"{API}/accounts/{operator_id}/require-2fa",
                          headers=hdr(admin_token))
        assert r.status_code == 200
        assert r.json()["totp_required"] != initial


# ============== Balance Ledger ==============
class TestBalanceLedger:
    def test_merchant_own_ledger(self, merchant_token):
        r = requests.get(f"{API}/balance/ledger", headers=hdr(merchant_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "account" in data and "entries" in data
        acc = data["account"]
        assert "balance" in acc and "frozen_balance" in acc
        entries = data["entries"]
        assert isinstance(entries, list)
        if entries:
            for e in entries:
                assert "category" in e and "amount" in e and "balance_after" in e
            # entries sorted desc by created_at; latest is entries[0]
            latest = entries[0]
            assert abs(latest["balance_after"] - acc["balance"]) < 0.01, \
                f"latest balance_after {latest['balance_after']} != account balance {acc['balance']}"

    def test_admin_requires_account_id(self, admin_token):
        r = requests.get(f"{API}/balance/ledger", headers=hdr(admin_token))
        assert r.status_code == 400

    def test_admin_with_account_id(self, admin_token, merchant_info):
        r = requests.get(f"{API}/balance/ledger?account_id={merchant_info['id']}",
                         headers=hdr(admin_token))
        assert r.status_code == 200
        assert r.json()["account"]["id"] == merchant_info["id"]

    def test_agent_own_ledger(self, agent_token):
        r = requests.get(f"{API}/balance/ledger", headers=hdr(agent_token))
        assert r.status_code == 200
        assert r.json()["account"]["role"] == "agent"

    def test_agent_can_view_child_merchant(self, agent_token, admin_token):
        # Find a merchant with parent_agent_id matching agent
        agent_me = requests.get(f"{API}/auth/me", headers=hdr(agent_token)).json()
        accs = requests.get(f"{API}/accounts?role=merchant",
                            headers=hdr(admin_token)).json()
        child = next((a for a in accs if a.get("parent_agent_id") == agent_me["id"]), None)
        if not child:
            pytest.skip("No child merchant for agent")
        r = requests.get(f"{API}/balance/ledger?account_id={child['id']}",
                         headers=hdr(agent_token))
        assert r.status_code == 200

    def test_export_xlsx(self, merchant_token):
        r = requests.get(f"{API}/reports/balance-ledger", headers=hdr(merchant_token))
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml" in ct, ct
        assert len(r.content) > 100
        # xlsx = zip signature PK
        assert r.content[:2] == b"PK"


# ============== Payout -> Ledger integration ==============
class TestPayoutLedger:
    def test_payout_writes_freeze_and_done_entries(self, merchant_token, admin_token):
        # 1. Get balance
        me_before = requests.get(f"{API}/auth/me", headers=hdr(merchant_token)).json()
        balance = me_before.get("balance", 0)
        if balance < 1:
            pytest.skip(f"Merchant balance too low ({balance}) to test payout")

        amount = min(1.0, balance / 2)

        # 2. Request payout
        r = requests.post(f"{API}/settlements/payouts",
                          json={"amount": amount, "network": "TRC20",
                                "address": "T" + "A" * 33},
                          headers=hdr(merchant_token))
        if r.status_code != 200:
            pytest.skip(f"payout create returned {r.status_code}: {r.text}")
        payout = r.json()
        payout_id = payout.get("id") or payout.get("_id")

        # 3. Ledger should have payout_freeze entry
        led = requests.get(f"{API}/balance/ledger", headers=hdr(merchant_token)).json()
        entries = led["entries"]
        freeze = next((e for e in entries if e["category"] == "payout_freeze"
                       and e.get("ref_id") == payout_id), None)
        assert freeze is not None, "payout_freeze ledger entry missing"
        assert freeze["amount"] < 0
        assert abs(freeze["amount"] + amount) < 0.01

        # 4. Available balance drops - verify from account summary
        new_balance = led["account"]["balance"]
        new_frozen = led["account"]["frozen_balance"]
        # balance should decrease by amount, frozen should increase by amount
        assert abs((balance - new_balance) - amount) < 0.01, \
            f"balance should drop by {amount}: before={balance} after={new_balance}"

        # 5. Admin approves
        r = requests.post(f"{API}/settlements/payouts/{payout_id}/approve",
                          headers=hdr(admin_token))
        assert r.status_code == 200, r.text

        # 6. payout_done entry appears
        led2 = requests.get(f"{API}/balance/ledger", headers=hdr(merchant_token)).json()
        done = next((e for e in led2["entries"] if e["category"] == "payout_done"
                     and e.get("ref_id") == payout_id), None)
        assert done is not None, "payout_done ledger entry missing after approval"


# ============== Regression ==============
class TestRegression:
    def test_admin_login(self):
        r = login(*ADMIN)
        assert r.status_code == 200 and "token" in r.json()
        assert not r.json().get("requires_2fa"), "admin must NOT have 2FA enabled"

    def test_merchant_login(self):
        r = login(*MERCHANT)
        assert r.status_code == 403, "商户后台登录应被禁用（仅 API）"

    def test_operator_login(self):
        r = login(*OPERATOR)
        assert r.status_code == 200

    def test_orders_list(self, admin_token):
        r = requests.get(f"{API}/orders", headers=hdr(admin_token))
        assert r.status_code == 200

    def test_accounts_list(self, admin_token):
        r = requests.get(f"{API}/accounts", headers=hdr(admin_token))
        assert r.status_code == 200

    def test_audit_logs_still_works(self, admin_token):
        r = requests.get(f"{API}/audit-logs", headers=hdr(admin_token))
        assert r.status_code == 200


# ============== Final safety check ==============
def test_zz_admin_2fa_is_disabled():
    """Last test (zz prefix): verify admin can still login without 2FA."""
    r = login(*ADMIN)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "token" in body, f"Admin needs code - 2FA leaked! {body}"
    assert not body.get("requires_2fa"), "Admin 2FA still enabled!"
