"""Backend tests for 四方收款平台"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sifang-collect.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# --- Fixtures ---
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "ajin53193@gmail.com", "password": "admin888"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def agent_token():
    r = requests.post(f"{API}/auth/login", json={"email": "agent@demo.com", "password": "agent888"})
    if r.status_code == 403:
        pytest.skip("代理后台登录已禁用（仅 API）")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def merchant_token():
    r = requests.post(f"{API}/auth/login", json={"email": "merchant@demo.com", "password": "merchant888"})
    if r.status_code == 403:
        pytest.skip("商户后台登录已禁用（仅 API）")
    assert r.status_code == 200, r.text
    return r.json()["token"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- Auth ---
class TestAuth:
    def test_login_admin(self):
        r = requests.post(f"{API}/auth/login", json={"email": "ajin53193@gmail.com", "password": "admin888"})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and d["user"]["role"] == "admin"

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": "ajin53193@gmail.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=hdr(admin_token))
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# --- Dashboard ---
class TestDashboard:
    def test_admin_stats(self, admin_token):
        r = requests.get(f"{API}/dashboard/stats", headers=hdr(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("total_volume", "today_volume", "total_orders", "success_rate", "profit", "trend"):
            assert k in d
        assert len(d["trend"]) == 7
        assert d["profit_label"] == "平台利润"

    def test_merchant_stats_scope(self, merchant_token):
        r = requests.get(f"{API}/dashboard/stats", headers=hdr(merchant_token))
        assert r.status_code == 200
        assert r.json()["profit_label"] == "实收金额"


# --- Orders ---
class TestOrders:
    def test_list_orders_admin(self, admin_token):
        r = requests.get(f"{API}/orders", headers=hdr(admin_token))
        assert r.status_code == 200
        orders = r.json()
        assert isinstance(orders, list) and len(orders) > 0

    def test_merchant_sees_only_own(self, merchant_token, admin_token):
        me = requests.get(f"{API}/auth/me", headers=hdr(merchant_token)).json()
        r = requests.get(f"{API}/orders", headers=hdr(merchant_token))
        assert r.status_code == 200
        for o in r.json():
            assert o["merchant_id"] == me["id"]

    def test_create_and_simulate_pay(self, admin_token):
        # pick a merchant
        accs = requests.get(f"{API}/accounts?role=merchant", headers=hdr(admin_token)).json()
        mid = accs[0]["id"]
        payload = {"amount_usdt": 123.45, "network": "TRC20", "merchant_id": mid, "remark": "TEST_"}
        r = requests.post(f"{API}/orders", json=payload, headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "pending"
        order_no = order["order_no"]

        # public fetch
        pub = requests.get(f"{API}/orders/{order_no}/public")
        assert pub.status_code == 200
        assert pub.json()["amount_usdt"] == 123.45

        # simulate pay (only non-live demo orders support it; live orders need real on-chain pay)
        sp = requests.post(f"{API}/orders/{order_no}/simulate-pay")
        if order.get("live"):
            assert sp.status_code == 400
            return
        assert sp.status_code == 200
        assert sp.json()["status"] == "paid"

        # verify persisted
        pub2 = requests.get(f"{API}/orders/{order_no}/public")
        assert pub2.json()["status"] == "paid"
        assert pub2.json()["tx_id"]

    def test_order_filters(self, admin_token):
        r = requests.get(f"{API}/orders?status=paid&network=TRC20", headers=hdr(admin_token))
        assert r.status_code == 200
        for o in r.json():
            assert o["status"] == "paid" and o["network"] == "TRC20"


# --- Channels ---
class TestChannels:
    def test_list(self, admin_token):
        r = requests.get(f"{API}/channels", headers=hdr(admin_token))
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_merchant_forbidden_create(self, merchant_token):
        r = requests.post(f"{API}/channels", json={"name": "x", "network": "TRC20"}, headers=hdr(merchant_token))
        assert r.status_code == 403

    def test_create_and_update(self, admin_token):
        r = requests.post(f"{API}/channels",
                          json={"name": "TEST_Channel", "network": "TRC20", "fee_rate": 0.02,
                                "weight": 5, "min_amount": 1, "max_amount": 100, "status": "active"},
                          headers=hdr(admin_token))
        assert r.status_code == 200
        cid = r.json()["id"]
        up = requests.patch(f"{API}/channels/{cid}", json={"status": "inactive"}, headers=hdr(admin_token))
        assert up.status_code == 200 and up.json()["status"] == "inactive"


# --- Accounts ---
class TestAccounts:
    def test_admin_list_merchants(self, admin_token):
        r = requests.get(f"{API}/accounts?role=merchant", headers=hdr(admin_token))
        assert r.status_code == 200 and len(r.json()) >= 1

    def test_agent_list_only_own(self, agent_token):
        r = requests.get(f"{API}/accounts", headers=hdr(agent_token))
        assert r.status_code == 200
        agent_me = requests.get(f"{API}/auth/me", headers=hdr(agent_token)).json()
        for a in r.json():
            assert a["role"] == "merchant"
            assert a.get("parent_agent_id") == agent_me["id"]

    def test_merchant_forbidden_list(self, merchant_token):
        r = requests.get(f"{API}/accounts", headers=hdr(merchant_token))
        assert r.status_code == 403

    def test_create_merchant_and_adjust(self, admin_token):
        import uuid
        email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        r = requests.post(f"{API}/accounts",
                          json={"email": email, "password": "pass1234", "name": "TEST_M",
                                "role": "merchant", "rate": 0.03},
                          headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        acc = r.json()
        assert acc["api_key"].startswith("mk_")
        aid = acc["id"]
        adj = requests.post(f"{API}/accounts/{aid}/adjust",
                            json={"amount": 50, "action": "credit", "remark": "TEST_"},
                            headers=hdr(admin_token))
        assert adj.status_code == 200
        assert adj.json()["balance"] == 50.0

        tog = requests.post(f"{API}/accounts/{aid}/toggle-status", headers=hdr(admin_token))
        assert tog.status_code == 200 and tog.json()["status"] == "frozen"

        rk = requests.post(f"{API}/accounts/{aid}/reset-api-key", headers=hdr(admin_token))
        assert rk.status_code == 200 and rk.json()["api_key"] != acc["api_key"]


# --- Settlements ---
class TestSettlements:
    def test_reconciliation(self, admin_token):
        r = requests.get(f"{API}/settlements/reconciliation", headers=hdr(admin_token))
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            assert "total_amount" in rows[0]

    def test_payouts_list(self, admin_token):
        r = requests.get(f"{API}/settlements/payouts", headers=hdr(admin_token))
        assert r.status_code == 200

    def test_merchant_payout_insufficient(self, merchant_token):
        r = requests.post(f"{API}/settlements/payouts", json={"amount": 999999999},
                          headers=hdr(merchant_token))
        assert r.status_code == 400

    def test_admin_cannot_payout(self, admin_token):
        r = requests.post(f"{API}/settlements/payouts", json={"amount": 10}, headers=hdr(admin_token))
        assert r.status_code == 403
