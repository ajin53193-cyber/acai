"""Iteration 3 backend tests: Open API HMAC, Multi-address pool, Brute-force lockout, Paid notifications."""
import os
import time
import uuid
import hmac
import hashlib
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

TRC20_CHANNEL_ID = "6aca084fd9effe688f2cd287"
WALLETS = ["TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9", "TU4vEruvZwLLkSfV9bNw12EJTPvNr7Pvaa"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def canon(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v)


def sign_body(body: dict, secret: str) -> str:
    items = sorted((k, v) for k, v in body.items() if k != "sign" and v is not None and v != "")
    raw = "&".join(f"{k}={canon(v)}" for k, v in items)
    return hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()


# ---------------- fixtures ----------------
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
def merchant_me(merchant_token):
    r = requests.get(f"{API}/auth/me", headers=hdr(merchant_token))
    return r.json()


# ---------------- Multi-address pool ----------------
class TestMultiAddress:
    def test_patch_two_addresses(self, admin_token):
        r = requests.patch(f"{API}/channels/{TRC20_CHANNEL_ID}",
                           json={"wallet_addresses": WALLETS}, headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["wallet_addresses"] == WALLETS
        assert isinstance(data["pending_by_address"], dict)

    def test_invalid_address_rejected(self, admin_token):
        r = requests.patch(f"{API}/channels/{TRC20_CHANNEL_ID}",
                           json={"wallet_addresses": [WALLETS[0], "BAD"]}, headers=hdr(admin_token))
        assert r.status_code == 400

    def test_orders_distributed_least_pending(self, merchant_token, admin_token):
        # Make sure channel has both addresses
        requests.patch(f"{API}/channels/{TRC20_CHANNEL_ID}",
                       json={"wallet_addresses": WALLETS}, headers=hdr(admin_token))
        used = set()
        for _ in range(6):
            r = requests.post(f"{API}/orders",
                              json={"amount_usdt": 12.34, "network": "TRC20", "remark": "TEST_pool"},
                              headers=hdr(merchant_token))
            assert r.status_code == 200, r.text
            o = r.json()
            assert o["live"] is True
            assert o["wallet_address"] in WALLETS
            # pay_amount suffix 0.0001-0.9999
            diff = round(o["pay_amount"] - o["amount_usdt"], 4)
            assert 0.0001 <= diff <= 0.9999, f"diff={diff}"
            used.add(o["wallet_address"])
        assert used == set(WALLETS), f"expected both addresses used, got {used}"

    def test_empty_list_falls_back_to_simulated(self, admin_token, merchant_token):
        r = requests.patch(f"{API}/channels/{TRC20_CHANNEL_ID}",
                           json={"wallet_addresses": []}, headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["wallet_addresses"] == []

        # amount 500 excludes TEST_Channel (max 100), only main TRC20 channel qualifies
        o = requests.post(f"{API}/orders",
                          json={"amount_usdt": 500.0, "network": "TRC20", "remark": "TEST_sim"},
                          headers=hdr(merchant_token)).json()
        assert o.get("live") is False, f"expected live=False, got {o}"

    def test_restore_addresses(self, admin_token):
        r = requests.patch(f"{API}/channels/{TRC20_CHANNEL_ID}",
                           json={"wallet_addresses": WALLETS}, headers=hdr(admin_token))
        assert r.status_code == 200
        assert r.json()["wallet_addresses"] == WALLETS


# ---------------- Open API ----------------
class TestOpenApi:
    def _body(self, me, amount, out_no, nonce=None, extra_ts=0):
        body = {
            "api_key": me["api_key"],
            "timestamp": int(time.time()) + extra_ts,
            "nonce": nonce or uuid.uuid4().hex,
            "amount_usdt": amount,
            "network": "TRC20",
            "out_trade_no": out_no,
            "remark": "TEST_api",
        }
        body["sign"] = sign_body(body, me["api_secret"])
        return body

    def test_create_order_valid(self, merchant_me, admin_token):
        # ensure addresses present
        requests.patch(f"{API}/channels/{TRC20_CHANNEL_ID}",
                       json={"wallet_addresses": WALLETS}, headers=hdr(admin_token))
        out_no = f"TEST_{uuid.uuid4().hex[:10]}"
        body = self._body(merchant_me, 50.0, out_no)
        r = requests.post(f"{API}/v1/orders", json=body)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["code"] == 0
        d = j["data"]
        assert d["pay_url"]
        assert d["out_trade_no"] == out_no
        assert d["pay_amount"] > d["amount_usdt"]
        # 4 decimals
        diff = round(d["pay_amount"] - d["amount_usdt"], 4)
        assert 0.0001 <= diff <= 0.9999
        assert d["wallet_address"] in WALLETS

        # Query by out_trade_no
        q = {"api_key": merchant_me["api_key"], "timestamp": int(time.time()),
             "nonce": uuid.uuid4().hex, "out_trade_no": out_no}
        q["sign"] = sign_body(q, merchant_me["api_secret"])
        qr = requests.post(f"{API}/v1/orders/query", json=q)
        assert qr.status_code == 200
        assert qr.json()["data"]["order_no"] == d["order_no"]

        # Query by order_no
        q2 = {"api_key": merchant_me["api_key"], "timestamp": int(time.time()),
              "nonce": uuid.uuid4().hex, "order_no": d["order_no"]}
        q2["sign"] = sign_body(q2, merchant_me["api_secret"])
        qr2 = requests.post(f"{API}/v1/orders/query", json=q2)
        assert qr2.status_code == 200
        assert qr2.json()["data"]["out_trade_no"] == out_no

    def test_replay_nonce(self, merchant_me):
        out_no = f"TEST_{uuid.uuid4().hex[:10]}"
        body = self._body(merchant_me, 11.0, out_no, nonce="repeat-" + uuid.uuid4().hex[:8])
        r1 = requests.post(f"{API}/v1/orders", json=body)
        assert r1.status_code == 200
        # Replay same nonce (resign because timestamp might change? Same body -> same sign)
        r2 = requests.post(f"{API}/v1/orders", json=body)
        assert r2.status_code == 401
        assert "nonce" in r2.json()["detail"]

    def test_duplicate_out_trade_no(self, merchant_me):
        out_no = f"TEST_dup_{uuid.uuid4().hex[:8]}"
        b1 = self._body(merchant_me, 15.0, out_no)
        r1 = requests.post(f"{API}/v1/orders", json=b1)
        assert r1.status_code == 200
        b2 = self._body(merchant_me, 15.0, out_no)
        r2 = requests.post(f"{API}/v1/orders", json=b2)
        assert r2.status_code == 200
        assert r2.json()["msg"] == "duplicate"
        assert r2.json()["data"]["order_no"] == r1.json()["data"]["order_no"]

    def test_bad_sign(self, merchant_me):
        body = self._body(merchant_me, 9.0, f"TEST_{uuid.uuid4().hex[:8]}")
        body["sign"] = "0" * 64
        r = requests.post(f"{API}/v1/orders", json=body)
        assert r.status_code == 401
        assert "签名" in r.json()["detail"] or "sign" in r.json()["detail"].lower()

    def test_stale_timestamp(self, merchant_me):
        body = self._body(merchant_me, 9.0, f"TEST_{uuid.uuid4().hex[:8]}", extra_ts=-1000)
        body["sign"] = sign_body(body, merchant_me["api_secret"])
        r = requests.post(f"{API}/v1/orders", json=body)
        assert r.status_code == 401
        assert "timestamp" in r.json()["detail"]

    def test_unknown_api_key(self, merchant_me):
        body = self._body(merchant_me, 9.0, f"TEST_{uuid.uuid4().hex[:8]}")
        body["api_key"] = "nope-not-real"
        body["sign"] = sign_body(body, "whatever")
        r = requests.post(f"{API}/v1/orders", json=body)
        assert r.status_code == 401
        assert "api_key" in r.json()["detail"]


# ---------------- Paid notifications ----------------
class TestPaidNotifications:
    def test_merchant_scoped(self, merchant_token, merchant_me):
        r = requests.get(f"{API}/notifications/paid",
                         params={"since": "2020-01-01T00:00:00+00:00"},
                         headers=hdr(merchant_token))
        assert r.status_code == 200
        data = r.json()
        assert "now" in data and "orders" in data
        for o in data["orders"]:
            # merchant can only see own
            # merchant_name is sufficient check
            assert o["merchant_name"] == merchant_me["name"]

    def test_admin_sees_all(self, admin_token):
        r = requests.get(f"{API}/notifications/paid",
                         params={"since": "2020-01-01T00:00:00+00:00"},
                         headers=hdr(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json()["orders"], list)

    def test_since_now_empty_then_new_paid(self, admin_token, merchant_token):
        # mark 'now'
        rnow = requests.get(f"{API}/notifications/paid",
                            params={"since": "2020-01-01T00:00:00+00:00"},
                            headers=hdr(admin_token)).json()
        snap = rnow["now"]
        time.sleep(1)
        empty = requests.get(f"{API}/notifications/paid",
                             params={"since": snap},
                             headers=hdr(admin_token)).json()
        assert empty["orders"] == []

        # create BEP20 (sim) order & simulate-pay
        oc = requests.post(f"{API}/orders",
                           json={"amount_usdt": 15.0, "network": "BEP20", "remark": "TEST_notif"},
                           headers=hdr(merchant_token))
        assert oc.status_code == 200
        order_no = oc.json()["order_no"]
        sp = requests.post(f"{API}/orders/{order_no}/simulate-pay")
        assert sp.status_code == 200

        time.sleep(2)
        after = requests.get(f"{API}/notifications/paid",
                             params={"since": snap},
                             headers=hdr(admin_token)).json()
        got = [o["order_no"] for o in after["orders"]]
        assert order_no in got, f"missing paid order; got={got}"


# ---------------- Brute-force lockout ----------------
LOCK_EMAIL = "shop2@demo.com"
LOCK_PASS = "merchant888"


class TestLockout:
    def test_full_lockout_flow(self, admin_token):
        # cleanup first
        requests.delete(f"{API}/auth/lockouts/{LOCK_EMAIL}", headers=hdr(admin_token))

        # 4 wrong -> 401
        for i in range(4):
            r = requests.post(f"{API}/auth/login", json={"email": LOCK_EMAIL, "password": "WRONG"})
            assert r.status_code == 401, f"attempt {i+1}: {r.status_code} {r.text}"

        # 5th -> 423 with specific message
        r5 = requests.post(f"{API}/auth/login", json={"email": LOCK_EMAIL, "password": "WRONG"})
        assert r5.status_code == 423, r5.text
        assert "连续 5 次" in r5.json()["detail"] or "锁定" in r5.json()["detail"]

        # Correct password still 423
        rok = requests.post(f"{API}/auth/login", json={"email": LOCK_EMAIL, "password": LOCK_PASS})
        assert rok.status_code == 423, rok.text
        assert "失败次数过多" in rok.json()["detail"] or "锁定" in rok.json()["detail"]

        # Admin sees lockout
        lk = requests.get(f"{API}/auth/lockouts", headers=hdr(admin_token))
        assert lk.status_code == 200
        rows = lk.json()
        row = next((x for x in rows if x.get("identifier") == LOCK_EMAIL), None)
        assert row and row["locked"] is True

        # Admin unlock
        du = requests.delete(f"{API}/auth/lockouts/{LOCK_EMAIL}", headers=hdr(admin_token))
        assert du.status_code == 200

        # Login works
        ok = requests.post(f"{API}/auth/login", json={"email": LOCK_EMAIL, "password": LOCK_PASS})
        assert ok.status_code == 200, ok.text

        # audit logs contain auth events
        logs = requests.get(f"{API}/audit-logs", params={"action": "auth"}, headers=hdr(admin_token)).json()
        actions = {l["action"] for l in logs}
        assert "auth.login_failed" in actions
        assert "auth.locked" in actions
        assert "auth.unlock" in actions
        # ip recorded
        auth_logs = [l for l in logs if l["action"].startswith("auth.")]
        assert any(l.get("ip") for l in auth_logs)

    def test_lockouts_merchant_forbidden(self, merchant_token):
        r = requests.get(f"{API}/auth/lockouts", headers=hdr(merchant_token))
        assert r.status_code == 403
