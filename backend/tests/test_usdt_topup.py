"""Backend tests for USDT top-up + payment methods (iteration 14)."""
import os
import hmac
import hashlib
import subprocess
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://crossborder-topup.preview.emergentagent.com"
# fall back from backend/.env
if not os.environ.get("REACT_APP_BACKEND_URL"):
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

USDT_SECRET = os.environ.get("USDT_PAY_API_SECRET", "")
MEMBER_USER_ID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
UA = "gogo589-pytest/1.0"


def mint_token(uid=MEMBER_USER_ID):
    out = subprocess.run(["python", "/app/tests/mint_token.py", uid], capture_output=True, text=True)
    tok = out.stdout.strip().splitlines()[-1]
    assert tok.count(".") == 2, f"bad token: {out.stdout} {out.stderr}"
    return tok


@pytest.fixture(scope="session")
def token():
    return mint_token()


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}", "User-Agent": UA}


# ---------- payment methods ----------

def test_payment_methods_seeded_and_ordered():
    r = requests.get(f"{BASE_URL}/api/payment-methods", headers={"User-Agent": UA}, timeout=15)
    assert r.status_code == 200, r.text
    ms = r.json()
    assert len(ms) >= 5
    expected = [
        ("USDT 加密貨幣", "usdt", "crypto", "/payments/usdt.svg"),
        ("信用卡 / VISA / MasterCard", "card", "stripe", "/payments/visa-mastercard.svg"),
        ("Apple Pay / Google Pay", "ewallet", "stripe", "/payments/apple-google-pay.svg"),
        ("PayPal", "ewallet", "paypal", "/payments/paypal.svg"),
        ("銀行轉帳", "bank", "manual", "/payments/bank.svg"),
    ]
    by_name = {m["name"]: m for m in ms}
    for name, cat, prov, img in expected:
        assert name in by_name, f"missing {name}"
        m = by_name[name]
        assert m["category"] == cat, f"{name} category {m['category']}"
        assert m["provider"] == prov, f"{name} provider {m['provider']}"
        assert m["image"] == img, f"{name} image {m['image']}"
        # SVG asset reachable
        rr = requests.get(f"{BASE_URL}{img}", headers={"User-Agent": UA}, timeout=15)
        assert rr.status_code == 200, f"{img} -> {rr.status_code}"
        assert "svg" in rr.headers.get("content-type", "").lower(), rr.headers.get("content-type")


# ---------- sign helper (mirror server) ----------
def sign(params, secret):
    def fmt(v):
        if isinstance(v, bool):
            return "true" if v else "false"
        if isinstance(v, float) and v.is_integer():
            return str(int(v))
        return str(v)
    items = sorted((k, fmt(v)) for k, v in params.items() if k != "sign" and v is not None and v != "")
    s = "&".join(f"{k}={v}" for k, v in items)
    return hmac.new(secret.encode(), s.encode(), hashlib.sha256).hexdigest()


# ---------- topup/usdt ----------

@pytest.fixture(scope="session")
def pm_map():
    r = requests.get(f"{BASE_URL}/api/payment-methods", headers={"User-Agent": UA}, timeout=15)
    return {m["category"]: m for m in r.json()}


@pytest.fixture
def usdt_topup(auth, pm_map):
    pm = pm_map["usdt"]
    r = requests.post(f"{BASE_URL}/api/me/wallet/topup/usdt",
                      headers=auth,
                      json={"amount_usd": 10, "method_id": pm["id"]}, timeout=30)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    return r.json()


def test_usdt_topup_create(usdt_topup):
    t = usdt_topup
    assert t["status"] == "pending"
    assert t["out_trade_no"].startswith("TU")
    assert t.get("order_no")
    assert float(t.get("pay_amount") or 0) > 0
    assert t.get("wallet_address")
    assert t.get("pay_url", "").startswith("https://print8")
    assert t.get("expires_at")


def test_usdt_topup_invalid_method_id(auth, pm_map):
    card = pm_map["card"]
    r = requests.post(f"{BASE_URL}/api/me/wallet/topup/usdt",
                      headers=auth,
                      json={"amount_usd": 10, "method_id": card["id"]}, timeout=15)
    assert r.status_code == 400


def test_usdt_topup_amount_too_small(auth, pm_map):
    pm = pm_map["usdt"]
    r = requests.post(f"{BASE_URL}/api/me/wallet/topup/usdt",
                      headers=auth,
                      json={"amount_usd": 0.5, "method_id": pm["id"]}, timeout=15)
    assert r.status_code == 400


def test_wallet_topup_status_self(auth, usdt_topup):
    tid = usdt_topup["id"]
    r = requests.get(f"{BASE_URL}/api/me/wallet/topup/{tid}", headers=auth, timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["id"] == tid
    assert "balance_usd" in j


def test_wallet_topup_status_unknown(auth):
    r = requests.get(f"{BASE_URL}/api/me/wallet/topup/doesnotexist123", headers=auth, timeout=10)
    assert r.status_code == 404


# ---------- notify ----------

def test_notify_unknown_order():
    body = {"out_trade_no": "TUDOESNOTEXIST", "status": "paid", "amount_usdt": 10}
    body["sign"] = sign(body, USDT_SECRET)
    r = requests.post(f"{BASE_URL}/api/payments/usdt/notify", json=body, timeout=10,
                      headers={"User-Agent": UA})
    assert r.status_code == 404
    assert "order not found" in r.text.lower()


def test_notify_bad_sign(usdt_topup):
    body = {"out_trade_no": usdt_topup["out_trade_no"], "status": "paid",
            "amount_usdt": usdt_topup["pay_amount"], "sign": "deadbeef"}
    r = requests.post(f"{BASE_URL}/api/payments/usdt/notify", json=body, timeout=10,
                      headers={"User-Agent": UA})
    assert r.status_code == 400
    assert "invalid sign" in r.text.lower()


def _wallet_balance(auth):
    r = requests.get(f"{BASE_URL}/api/me/wallet", headers=auth, timeout=15)
    return float(r.json()["balance_usd"])


def test_notify_valid_idempotent(auth, usdt_topup):
    bal0 = _wallet_balance(auth)
    body = {"out_trade_no": usdt_topup["out_trade_no"], "status": "paid",
            "amount_usdt": usdt_topup["pay_amount"], "tx_id": "TXTEST001",
            "paid_at": "2026-01-15T00:00:00Z"}
    body["sign"] = sign(body, USDT_SECRET)
    r1 = requests.post(f"{BASE_URL}/api/payments/usdt/notify", json=body, timeout=15,
                       headers={"User-Agent": UA})
    assert r1.status_code == 200, r1.text
    assert r1.text.strip() == "success"
    bal1 = _wallet_balance(auth)
    assert round(bal1 - bal0, 2) == float(usdt_topup["amount_usd"]), f"{bal0}->{bal1}"
    # replay
    r2 = requests.post(f"{BASE_URL}/api/payments/usdt/notify", json=body, timeout=15,
                       headers={"User-Agent": UA})
    assert r2.status_code == 200
    assert r2.text.strip() == "success"
    bal2 = _wallet_balance(auth)
    assert bal2 == bal1, f"replay changed balance {bal1}->{bal2}"
    # status now paid
    g = requests.get(f"{BASE_URL}/api/me/wallet/topup/{usdt_topup['id']}", headers=auth, timeout=10)
    assert g.json()["status"] == "paid"


# ---------- legacy mock topup ----------

def test_legacy_topup_card_instant_credit(auth, pm_map):
    bal0 = _wallet_balance(auth)
    card = pm_map["card"]
    r = requests.post(f"{BASE_URL}/api/me/wallet/topup",
                      headers=auth,
                      json={"amount_usd": 1, "method_id": card["id"]}, timeout=15)
    assert r.status_code == 200, r.text
    assert round(r.json()["balance_usd"] - bal0, 2) == 1.0
