"""Iteration 5 tests: checkout settings tutorials/branding + chain refresh/sync + BEP20 RPC fallback."""
import os
import re
import time
import pytest
import requests
from pathlib import Path

# Load REACT_APP_BACKEND_URL from frontend/.env if not set
if not os.environ.get("REACT_APP_BACKEND_URL"):
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for ln in env_path.read_text().splitlines():
            if ln.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = ln.split("=", 1)[1].strip()

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = BASE + "/api"

# Legacy suite: BEP20 RPC fallback + merchant login removed; covered by iteration13-17.
pytestmark = pytest.mark.skip(reason="legacy: merchant-login/EVM/fixed-seed removed; covered by iteration13-17")

ADMIN = {"email": "ajin53193@gmail.com", "password": "admin888"}
MERCH = {"email": "merchant@demo.com", "password": "merchant888"}

BEP20_ADDR = "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3"
TRC20_ENERGY = "TW1vPSPr5FvmfgV1vF3abQs2e5fCTJprQ1"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def merch_h():
    return {"Authorization": f"Bearer {_login(MERCH)}"}


# --- Checkout settings: tutorial_links + brand_subtitle ---------------------
class TestCheckoutSettings:
    def test_put_and_get_tutorial(self, admin_h):
        payload = {
            "energy_enabled": True,
            "energy_trx_address": TRC20_ENERGY,
            "energy_price_text": "2TRX/笔（即每65500能量只需2TRX）",
            "support_url": "",
            "tutorial_links": [{"title": "测试教程", "url": "", "content": "第一行\nhttps://example.com"}],
            "energy_rules": [],
            "logo_url": "",
            "brand_subtitle": "测试副标题",
            "brand_subtitle_tw": "USDT 安全收款",
            "brand_subtitle_en": "Secure USDT Payment",
        }
        r = requests.put(f"{API}/checkout/settings", json=payload, headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text

        g = requests.get(f"{API}/checkout/settings", timeout=15).json()
        assert g["brand_subtitle"] == "测试副标题"
        assert len(g["tutorial_links"]) == 1
        assert g["tutorial_links"][0]["title"] == "测试教程"
        assert "example.com" in g["tutorial_links"][0]["content"]
        assert g["energy_enabled"] is True
        assert g["energy_trx_address"] == TRC20_ENERGY

    def test_restore_settings(self, admin_h):
        payload = {
            "energy_enabled": True,
            "energy_trx_address": TRC20_ENERGY,
            "energy_price_text": "2TRX/笔（即每65500能量只需2TRX）",
            "support_url": "",
            "tutorial_links": [],
            "energy_rules": [],
            "logo_url": "",
            "brand_subtitle": "USDT 安全收款",
            "brand_subtitle_tw": "USDT 安全收款",
            "brand_subtitle_en": "Secure USDT Payment",
        }
        r = requests.put(f"{API}/checkout/settings", json=payload, headers=admin_h, timeout=15)
        assert r.status_code == 200
        g = requests.get(f"{API}/checkout/settings", timeout=15).json()
        assert g["tutorial_links"] == []
        assert g["brand_subtitle"] == "USDT 安全收款"

    def test_non_admin_forbidden(self, merch_h):
        r = requests.put(f"{API}/checkout/settings", json={"brand_subtitle": "x"}, headers=merch_h, timeout=15)
        assert r.status_code in (401, 403)


# --- Chain addresses refresh / sync (BEP20 RPC fallback) --------------------
class TestChain:
    def test_refresh_addresses(self, admin_h):
        r = requests.post(f"{API}/chain/addresses/refresh", headers=admin_h, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "ok" in data and "errors" in data
        # errors may contain TronGrid 429 but should not contain ETHERSCAN missing
        joined = " ".join(data.get("errors", []))
        assert "ETHERSCAN" not in joined and "Free API" not in joined, f"errors: {data['errors']}"

    def test_bep20_balance_ok(self, admin_h):
        r = requests.get(f"{API}/chain/addresses", headers=admin_h, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        bep = [x for x in rows if x["network"] == "BEP20" and x["address"].lower() == BEP20_ADDR.lower()]
        assert bep, f"BEP20 address not found; got {[(x['network'], x['address']) for x in rows]}"
        row = bep[0]
        assert row["balance_error"] in (None, ""), f"balance_error: {row['balance_error']}"
        assert isinstance(row["balance"], (int, float)), f"balance not numeric: {row['balance']}"
        assert row["balance"] >= 0, f"balance negative: {row['balance']}"
        # status should be ok after refresh set balance_at
        assert row["status"] == "ok", f"status={row['status']} row={row}"

    def test_chain_sync(self, admin_h):
        r = requests.post(f"{API}/chain/sync", headers=admin_h, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "scanned" in data and "matched" in data and "errors" in data
        bad = [e for e in data["errors"] if "ETHERSCAN" in e or "Free API" in e]
        assert not bad, f"unexpected errors: {bad}"


# --- Public checkout page data ----------------------------------------------
class TestCheckoutPublic:
    @pytest.fixture(scope="class")
    def live_order(self, merch_h):
        # Find a TRC20 channel
        r = requests.get(f"{API}/channels", headers=merch_h, timeout=15)
        assert r.status_code == 200
        chans = [c for c in r.json() if c["network"] == "TRC20" and c.get("wallet_addresses")]
        assert chans, "no live TRC20 channel"
        ch = chans[0]
        # Create order
        payload = {"network": "TRC20", "amount_usdt": 12.34,
                   "out_trade_no": f"TEST_i5_{int(time.time())}"}
        r = requests.post(f"{API}/orders", json=payload, headers=merch_h, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_public_order_has_merchant_name(self, live_order):
        r = requests.get(f"{API}/orders/{live_order['order_no']}/public", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["network"] == "TRC20"
        assert d["merchant_name"]
        assert d.get("live") is True
