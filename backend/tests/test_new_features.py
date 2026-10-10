"""Backend tests for new features: TRC20 chain, Callbacks, Audit logs."""
import os
import time
import hmac
import hashlib
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "ajin53193@gmail.com", "password": "admin888"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def merchant_token():
    r = requests.post(f"{API}/auth/login", json={"email": "merchant@demo.com", "password": "merchant888"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def agent_token():
    r = requests.post(f"{API}/auth/login", json={"email": "agent@demo.com", "password": "agent888"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def merchant_info(merchant_token):
    r = requests.get(f"{API}/auth/me", headers=hdr(merchant_token))
    return r.json()


@pytest.fixture(scope="module")
def trc20_channel(admin_token):
    r = requests.get(f"{API}/channels", headers=hdr(admin_token))
    chs = r.json()
    for c in chs:
        if c["name"] == "TRC20 极速通道":
            return c
    pytest.skip("TRC20 极速通道 missing")


@pytest.fixture(scope="module")
def bep20_channel(admin_token):
    r = requests.get(f"{API}/channels", headers=hdr(admin_token))
    for c in r.json():
        if c["name"] == "BEP20 低费通道":
            return c
    pytest.skip("BEP20 低费通道 missing")


# ---------------- Channel wallet address ----------------
class TestChannelWallet:
    def test_invalid_trc20_address_rejected(self, admin_token, trc20_channel):
        r = requests.patch(f"{API}/channels/{trc20_channel['id']}",
                           json={"wallet_address": "invalid123"}, headers=hdr(admin_token))
        assert r.status_code == 400

    def test_valid_trc20_address_accepted_and_restored(self, admin_token, trc20_channel):
        orig = trc20_channel.get("wallet_address", "")
        new_addr = "T" + "A" * 33
        r = requests.patch(f"{API}/channels/{trc20_channel['id']}",
                           json={"wallet_address": new_addr}, headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["wallet_address"] == new_addr
        # restore
        rr = requests.patch(f"{API}/channels/{trc20_channel['id']}",
                            json={"wallet_address": orig}, headers=hdr(admin_token))
        assert rr.status_code == 200


# ---------------- Live TRC20 order ----------------
class TestLiveOrder:
    def test_create_trc20_live_order(self, merchant_token, trc20_channel):
        r = requests.post(f"{API}/orders",
                          json={"amount_usdt": 100.0, "network": "TRC20", "remark": "TEST_live"},
                          headers=hdr(merchant_token))
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["live"] is True
        assert o["pay_amount"] > o["amount_usdt"]
        # 4 decimals
        assert round(o["pay_amount"] * 10000) == o["pay_amount"] * 10000
        assert o["wallet_address"] == trc20_channel["wallet_address"]
        order_no = o["order_no"]

        # simulate pay rejected
        sp = requests.post(f"{API}/orders/{order_no}/simulate-pay")
        assert sp.status_code == 400

        # public endpoint includes pay_amount and live
        pub = requests.get(f"{API}/orders/{order_no}/public")
        assert pub.status_code == 200
        d = pub.json()
        assert d["live"] is True
        assert d["pay_amount"] == o["pay_amount"]


# ---------------- BEP20 simulated flow + callbacks ----------------
class TestCallbacksFlow:
    def test_merchant_sets_notify_and_full_flow(self, merchant_token, merchant_info, admin_token, bep20_channel):
        # 1. set notify url
        notify_url = f"{BASE_URL}/api/callbacks/test-receiver"
        r = requests.patch(f"{API}/accounts/me/notify",
                           json={"notify_url": notify_url}, headers=hdr(merchant_token))
        assert r.status_code == 200
        assert r.json()["notify_url"] == notify_url

        # 2. bad url rejected
        bad = requests.patch(f"{API}/accounts/me/notify",
                             json={"notify_url": "ftp://foo"}, headers=hdr(merchant_token))
        assert bad.status_code == 400

        # restore good URL
        requests.patch(f"{API}/accounts/me/notify",
                       json={"notify_url": notify_url}, headers=hdr(merchant_token))

        # 3. create BEP20 order
        r = requests.post(f"{API}/orders",
                          json={"amount_usdt": 55.5, "network": "BEP20", "remark": "TEST_cb"},
                          headers=hdr(merchant_token))
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["live"] is False
        order_no = order["order_no"]

        # 4. simulate pay
        sp = requests.post(f"{API}/orders/{order_no}/simulate-pay")
        assert sp.status_code == 200

        # 5. wait and check callback
        time.sleep(10)
        cbs = requests.get(f"{API}/callbacks", headers=hdr(merchant_token)).json()
        mine = [c for c in cbs if c["order_no"] == order_no]
        assert mine, "callback record missing"
        cb = mine[0]
        assert cb["status"] == "success", cb
        assert cb["attempts"] >= 1
        assert cb["last_code"] == 200

        # 6. check order callback_status
        orders = requests.get(f"{API}/orders", headers=hdr(merchant_token)).json()
        o = next(o for o in orders if o["order_no"] == order_no)
        assert o["callback_status"] == "success"

    def test_bad_url_retrying(self, merchant_token):
        bad_url = "http://127.0.0.1:9/x"
        requests.patch(f"{API}/accounts/me/notify",
                       json={"notify_url": bad_url}, headers=hdr(merchant_token))
        r = requests.post(f"{API}/orders",
                          json={"amount_usdt": 23.4, "network": "BEP20", "remark": "TEST_bad"},
                          headers=hdr(merchant_token))
        order_no = r.json()["order_no"]
        requests.post(f"{API}/orders/{order_no}/simulate-pay")
        time.sleep(10)
        cbs = requests.get(f"{API}/callbacks", headers=hdr(merchant_token)).json()
        mine = [c for c in cbs if c["order_no"] == order_no]
        assert mine
        cb = mine[0]
        assert cb["status"] == "retrying"
        assert cb["attempts"] >= 1
        assert cb["next_at"]

        # retry endpoint
        rr = requests.post(f"{API}/callbacks/{cb['id']}/retry", headers=hdr(merchant_token))
        assert rr.status_code == 200
        rd = rr.json()
        assert rd["attempts"] > cb["attempts"]

        # restore
        notify_url = f"{BASE_URL}/api/callbacks/test-receiver"
        requests.patch(f"{API}/accounts/me/notify",
                       json={"notify_url": notify_url}, headers=hdr(merchant_token))

    def test_admin_sees_all_merchant_sees_own(self, admin_token, merchant_token, merchant_info):
        all_cbs = requests.get(f"{API}/callbacks", headers=hdr(admin_token)).json()
        mine = requests.get(f"{API}/callbacks", headers=hdr(merchant_token)).json()
        mid = merchant_info["id"]
        for c in mine:
            assert c["merchant_id"] == mid
        assert len(all_cbs) >= len(mine)

    def test_test_receiver_public(self):
        r = requests.post(f"{API}/callbacks/test-receiver", json={"order_no": "x", "sign": "y"})
        assert r.status_code == 200
        assert r.text.strip() == "success"

    def test_sign_preview(self, merchant_token):
        r = requests.get(f"{API}/callbacks/sign-preview", headers=hdr(merchant_token))
        assert r.status_code == 200
        data = r.json()
        payload = data["payload"]
        sign_string = data["sign_string"]
        # get merchant secret
        me = requests.get(f"{API}/auth/me", headers=hdr(merchant_token)).json()
        secret = me["api_secret"]
        expected = hmac.new(secret.encode(), sign_string.encode(), hashlib.sha256).hexdigest()
        assert expected == payload["sign"]

    def test_sign_preview_admin_forbidden(self, admin_token):
        r = requests.get(f"{API}/callbacks/sign-preview", headers=hdr(admin_token))
        assert r.status_code == 403


# ---------------- Audit logs ----------------
class TestAuditLogs:
    def test_admin_actions_logged(self, admin_token):
        # pick a merchant
        accs = requests.get(f"{API}/accounts?role=merchant", headers=hdr(admin_token)).json()
        mid = accs[0]["id"]

        r1 = requests.post(f"{API}/accounts/{mid}/adjust",
                           json={"amount": 1, "action": "credit", "remark": "TEST_audit"},
                           headers=hdr(admin_token))
        assert r1.status_code == 200
        requests.post(f"{API}/accounts/{mid}/toggle-status", headers=hdr(admin_token))
        requests.post(f"{API}/accounts/{mid}/toggle-status", headers=hdr(admin_token))

        logs = requests.get(f"{API}/audit-logs", headers=hdr(admin_token)).json()
        assert isinstance(logs, list) and len(logs) > 0
        actions = {l["action"] for l in logs}
        assert any(a.startswith("balance.") for a in actions)
        assert "account.freeze" in actions or "account.unfreeze" in actions
        # fields
        l = logs[0]
        for k in ("actor_email", "action", "detail", "ip", "created_at"):
            assert k in l

    def test_filter_action_and_actor(self, admin_token):
        r = requests.get(f"{API}/audit-logs?action=balance", headers=hdr(admin_token))
        assert r.status_code == 200
        for l in r.json():
            assert l["action"].startswith("balance")

        r2 = requests.get(f"{API}/audit-logs?actor=ajin", headers=hdr(admin_token))
        assert r2.status_code == 200
        for l in r2.json():
            assert "ajin" in l["actor_email"].lower()

    def test_merchant_forbidden(self, merchant_token):
        r = requests.get(f"{API}/audit-logs", headers=hdr(merchant_token))
        assert r.status_code == 403

    def test_agent_forbidden(self, agent_token):
        r = requests.get(f"{API}/audit-logs", headers=hdr(agent_token))
        assert r.status_code == 403


# ---------------- Chain endpoints ----------------
class TestChain:
    def test_chain_sync_admin(self, admin_token):
        r = requests.post(f"{API}/chain/sync", headers=hdr(admin_token))
        # Expect 200 or 400 (TronGrid rate-limit) but NOT 5xx
        assert r.status_code in (200, 400), f"got {r.status_code}: {r.text}"
        assert r.status_code < 500

    def test_chain_sync_merchant_forbidden(self, merchant_token):
        r = requests.post(f"{API}/chain/sync", headers=hdr(merchant_token))
        assert r.status_code == 403

    def test_chain_txs_admin(self, admin_token):
        r = requests.get(f"{API}/chain/txs", headers=hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_chain_txs_merchant_forbidden(self, merchant_token):
        r = requests.get(f"{API}/chain/txs", headers=hdr(merchant_token))
        assert r.status_code == 403
