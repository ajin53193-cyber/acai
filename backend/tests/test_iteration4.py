"""Iteration 4 backend tests: checkout settings, address health, chain/sync, IP whitelist, commission report, public order."""
import os
import hmac
import hashlib
import io
import time
import uuid
from datetime import datetime, timezone

import pytest
import requests
from openpyxl import load_workbook

def _read_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""


BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env()).rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL not set"
API = f"{BASE}/api"

ADMIN = ("ajin53193@gmail.com", "admin888")
AGENT = ("agent@demo.com", "agent888")
MERCHANT = ("merchant@demo.com", "merchant888")

TRC20_CHANNEL_ID = "6aca084fd9effe688f2cd287"
BEP20_CHANNEL_ID = "6aca084fd9effe688f2cd289"
TRC20_ADDRS = ["TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9", "TU4vEruvZwLLkSfV9bNw12EJTPvNr7Pvaa"]
BEP20_ADDRS = ["0x8894E0a0c962CB723c1976a4421c95949bE2D4E3"]
ENERGY_ADDR = "TW1vPSPr5FvmfgV1vF3abQs2e5fCTJprQ1"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_tok():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def agent_tok():
    return _login(*AGENT)


@pytest.fixture(scope="module")
def merchant_tok():
    return _login(*MERCHANT)


@pytest.fixture(scope="module")
def merchant_keys(merchant_tok):
    r = requests.get(f"{API}/auth/me", headers=_auth(merchant_tok), timeout=10).json()
    return r["api_key"], r["api_secret"], str(r["_id"] if "_id" in r else r.get("id", ""))


def canon(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v)


def sign_payload(payload, secret):
    items = sorted((k, v) for k, v in payload.items() if k != "sign" and v is not None and v != "")
    raw = "&".join(f"{k}={canon(v)}" for k, v in items)
    return hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()


# ---------- Checkout settings ----------
class TestCheckoutSettings:
    def test_merchant_put_forbidden(self, merchant_tok):
        r = requests.put(f"{API}/checkout/settings", headers=_auth(merchant_tok),
                         json={"energy_enabled": True}, timeout=10)
        assert r.status_code == 403

    def test_admin_put_invalid_trx(self, admin_tok):
        r = requests.put(f"{API}/checkout/settings", headers=_auth(admin_tok),
                         json={"energy_enabled": True, "energy_trx_address": "not-a-trx"}, timeout=10)
        assert r.status_code == 400

    def test_admin_put_valid_and_public_get(self, admin_tok):
        payload = {
            "energy_enabled": True,
            "energy_trx_address": ENERGY_ADDR,
            "energy_price_text": "2 TRX/笔 (test)",
            "support_url": "https://support.example.com",
            "tutorial_links": [{"title": "教程1", "url": "https://doc.example.com/1"}],
        }
        r = requests.put(f"{API}/checkout/settings", headers=_auth(admin_tok), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/checkout/settings", timeout=10)
        assert g.status_code == 200
        data = g.json()
        assert data["energy_enabled"] is True
        assert data["energy_trx_address"] == ENERGY_ADDR
        assert data["support_url"] == "https://support.example.com"
        assert len(data["tutorial_links"]) == 1

    def test_audit_has_settings_checkout(self, admin_tok):
        r = requests.get(f"{API}/audit-logs?action=settings.checkout&limit=5",
                         headers=_auth(admin_tok), timeout=10)
        assert r.status_code == 200
        logs = r.json()
        assert any(l["action"] == "settings.checkout" for l in logs)


# ---------- Public order endpoint ----------
class TestPublicOrder:
    @pytest.fixture(scope="class")
    def pending_trc_order(self, merchant_tok):
        r = requests.post(f"{API}/orders", headers=_auth(merchant_tok),
                          json={"amount_usdt": 50.0, "network": "TRC20", "remark": "TEST_i4"}, timeout=10)
        assert r.status_code == 200, r.text
        return r.json()

    def test_public_contains_explorer_and_created_at(self, pending_trc_order):
        r = requests.get(f"{API}/orders/{pending_trc_order['order_no']}/public", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["network"] == "TRC20"
        assert d["status"] == "pending"
        assert "tronscan.org" in d["explorer_url"]
        assert "created_at" in d and d["created_at"]
        assert "tx_url" in d

    def test_public_bep20_explorer(self, merchant_tok):
        r = requests.post(f"{API}/orders", headers=_auth(merchant_tok),
                          json={"amount_usdt": 60.0, "network": "BEP20", "remark": "TEST_i4b"}, timeout=10)
        assert r.status_code == 200
        o = r.json()
        g = requests.get(f"{API}/orders/{o['order_no']}/public", timeout=10).json()
        assert "bscscan.com" in g["explorer_url"]


# ---------- Address health ----------
class TestAddressHealth:
    def test_list_forbidden_for_non_admin(self, merchant_tok, agent_tok):
        for tok in (merchant_tok, agent_tok):
            r = requests.get(f"{API}/chain/addresses", headers=_auth(tok), timeout=10)
            assert r.status_code == 403

    def test_list_as_admin(self, admin_tok):
        r = requests.get(f"{API}/chain/addresses", headers=_auth(admin_tok), timeout=15)
        assert r.status_code == 200
        rows = r.json()
        addrs = {row["address"] for row in rows}
        for a in TRC20_ADDRS + BEP20_ADDRS:
            assert a in addrs, f"missing {a} in {addrs}"
        bep_row = next(r for r in rows if r["network"] == "BEP20")
        assert bep_row["status"] in ("error", "idle")
        # Will be error after refresh (next test); accept idle initially.

    def test_refresh_returns_errors_for_bep20(self, admin_tok):
        r = requests.post(f"{API}/chain/addresses/refresh", headers=_auth(admin_tok), timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "ok" in body and "errors" in body
        # BEP20 should error due to missing ETHERSCAN key
        joined = " ".join(body["errors"])
        assert "ETHERSCAN" in joined or "etherscan" in joined.lower() or "BEP20" in joined

    def test_bep20_row_has_etherscan_error(self, admin_tok):
        r = requests.get(f"{API}/chain/addresses", headers=_auth(admin_tok), timeout=10)
        rows = r.json()
        bep = next(x for x in rows if x["network"] == "BEP20")
        err = (bep.get("balance_error") or "") + " " + (bep.get("sync_error") or "")
        assert "ETHERSCAN" in err.upper() or bep["status"] == "error"

    def test_refresh_forbidden_non_admin(self, merchant_tok):
        r = requests.post(f"{API}/chain/addresses/refresh", headers=_auth(merchant_tok), timeout=10)
        assert r.status_code == 403


# ---------- chain/sync ----------
class TestChainSync:
    def test_sync_returns_200_with_errors_array(self, admin_tok):
        r = requests.post(f"{API}/chain/sync", headers=_auth(admin_tok), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("channels", "addresses", "scanned", "matched", "errors"):
            assert k in d, f"missing {k}"
        assert isinstance(d["errors"], list)


# ---------- IP whitelist ----------
class TestIpWhitelist:
    def test_patch_invalid_ip(self, merchant_tok):
        r = requests.patch(f"{API}/accounts/me/ip-whitelist", headers=_auth(merchant_tok),
                           json={"ips": ["abc"]}, timeout=10)
        assert r.status_code == 400

    def test_get_my_ip(self, merchant_tok):
        r = requests.get(f"{API}/accounts/me/ip", headers=_auth(merchant_tok), timeout=10)
        assert r.status_code == 200
        assert "ip" in r.json()

    def test_set_whitelist_blocks_openapi(self, merchant_tok, merchant_keys, admin_tok):
        api_key, api_secret, _ = merchant_keys
        # Set whitelist to a bogus IP
        pr = requests.patch(f"{API}/accounts/me/ip-whitelist", headers=_auth(merchant_tok),
                            json={"ips": ["1.2.3.4"]}, timeout=10)
        assert pr.status_code == 200
        assert pr.json()["ip_whitelist"] == ["1.2.3.4"]
        try:
            # Create signed order request -> expect 403
            body = {
                "api_key": api_key, "amount_usdt": 10.0, "network": "TRC20",
                "out_trade_no": f"TEST_i4_{uuid.uuid4().hex[:10]}",
                "nonce": uuid.uuid4().hex, "timestamp": int(time.time()),
            }
            body["sign"] = sign_payload(body, api_secret)
            r = requests.post(f"{API}/v1/orders", json=body, timeout=10)
            assert r.status_code == 403
            assert "白名单" in r.text or "IP" in r.text
            # audit log for api.ip_rejected
            time.sleep(0.5)
            a = requests.get(f"{API}/audit-logs?action=api.ip_rejected&limit=5",
                             headers=_auth(admin_tok), timeout=10).json()
            assert any(isinstance(l, dict) and l.get("action") == "api.ip_rejected" for l in a)
        finally:
            # Clear whitelist
            cr = requests.patch(f"{API}/accounts/me/ip-whitelist", headers=_auth(merchant_tok),
                                json={"ips": []}, timeout=10)
            assert cr.status_code == 200
            assert cr.json()["ip_whitelist"] == []

    def test_api_works_after_clearing(self, merchant_tok, merchant_keys):
        api_key, api_secret, _ = merchant_keys
        body = {
            "api_key": api_key, "amount_usdt": 10.0, "network": "TRC20",
            "out_trade_no": f"TEST_i4clear_{uuid.uuid4().hex[:10]}",
            "nonce": uuid.uuid4().hex, "timestamp": int(time.time()),
        }
        body["sign"] = sign_payload(body, api_secret)
        r = requests.post(f"{API}/v1/orders", json=body, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["code"] == 0


# ---------- Commission report ----------
class TestCommissionReport:
    def _month(self):
        return datetime.now(timezone.utc).strftime("%Y-%m")

    def test_merchant_forbidden(self, merchant_tok):
        r = requests.get(f"{API}/reports/agent-commission?month={self._month()}",
                         headers=_auth(merchant_tok), timeout=15)
        assert r.status_code == 403

    def test_invalid_month(self, agent_tok):
        r = requests.get(f"{API}/reports/agent-commission?month=2026-13",
                         headers=_auth(agent_tok), timeout=10)
        assert r.status_code == 400

    def test_admin_without_agent_id(self, admin_tok):
        r = requests.get(f"{API}/reports/agent-commission?month={self._month()}",
                         headers=_auth(admin_tok), timeout=10)
        assert r.status_code == 400

    def test_agent_download(self, agent_tok):
        r = requests.get(f"{API}/reports/agent-commission?month={self._month()}",
                         headers=_auth(agent_tok), timeout=30)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")
        wb = load_workbook(io.BytesIO(r.content))
        assert set(wb.sheetnames) == {"月度汇总", "按商户明细", "逐单明细"}
        ws = wb["月度汇总"]
        found = False
        for row in ws.iter_rows(values_only=True):
            if row and row[0] == "代理分润合计 (USDT)":
                found = True
                break
        assert found, "代理分润合计 row missing"

    def test_admin_with_agent_id(self, admin_tok):
        # find an agent id
        accs = requests.get(f"{API}/accounts?role=agent", headers=_auth(admin_tok), timeout=10).json()
        assert accs, "no agents found"
        aid = accs[0].get("id") or accs[0].get("_id")
        r = requests.get(f"{API}/reports/agent-commission?month={self._month()}&agent_id={aid}",
                         headers=_auth(admin_tok), timeout=30)
        assert r.status_code == 200, r.text


# ---------- Simulate-pay flow with channel without addresses ----------
class TestSimulatePayFlow:
    def test_bep20_simulate_after_clearing_addresses(self, admin_tok, merchant_tok):
        # Save current addrs & clear
        try:
            pr = requests.patch(f"{API}/channels/{BEP20_CHANNEL_ID}",
                                headers=_auth(admin_tok),
                                json={"wallet_addresses": []}, timeout=10)
            assert pr.status_code == 200, pr.text
            # Create BEP20 order
            cr = requests.post(f"{API}/orders", headers=_auth(merchant_tok),
                               json={"amount_usdt": 20.0, "network": "BEP20", "remark": "TEST_i4sim"}, timeout=10)
            assert cr.status_code == 200, cr.text
            order = cr.json()
            assert order.get("live") in (False, None)
            # Public endpoint shows pending
            pub = requests.get(f"{API}/orders/{order['order_no']}/public", timeout=10).json()
            assert pub["status"] == "pending"
            # Simulate payment
            sp = requests.post(f"{API}/orders/{order['order_no']}/simulate-pay", timeout=10)
            assert sp.status_code == 200, sp.text
            # Verify paid
            pub2 = requests.get(f"{API}/orders/{order['order_no']}/public", timeout=10).json()
            assert pub2["status"] == "paid"
        finally:
            rr = requests.patch(f"{API}/channels/{BEP20_CHANNEL_ID}",
                                headers=_auth(admin_tok),
                                json={"wallet_addresses": BEP20_ADDRS}, timeout=10)
            assert rr.status_code == 200, rr.text


# ---------- Cleanup: restore state ----------
def test_zz_cleanup(admin_tok, merchant_tok):
    # Restore TRC20 addresses
    requests.patch(f"{API}/channels/{TRC20_CHANNEL_ID}", headers=_auth(admin_tok),
                   json={"wallet_addresses": TRC20_ADDRS}, timeout=10)
    requests.patch(f"{API}/channels/{BEP20_CHANNEL_ID}", headers=_auth(admin_tok),
                   json={"wallet_addresses": BEP20_ADDRS}, timeout=10)
    # Clear merchant whitelist
    requests.patch(f"{API}/accounts/me/ip-whitelist", headers=_auth(merchant_tok),
                   json={"ips": []}, timeout=10)
    # Reset checkout settings energy_enabled to initial-like state but keep for frontend test
