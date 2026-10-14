"""
Backend tests for gift-card PRODUCT flow:
- GET /api/products/giftcard-shkp-hkd (is_giftcard, specs, delivery_fields)
- POST /api/orders + pay-wallet → 32-digit gift_trade_nos (YYYYMMDD + 24)
- quantity=2 generates 2 distinct trade numbers
- Admin GET /api/admin/gift-card-orders rows / counts / q search / status filter
"""
import os
import re
import subprocess
from datetime import datetime, timezone

import pyotp
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
UA = {"User-Agent": "gogo589-test/1.0"}
TESTER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
ADMIN_EMAIL = "admin@gogo589.com"
ADMIN_PW = "Gg589!kVTEyEy16n"
ADMIN_UID = "user_3Kfh24fwfGJl8aUhmiiLZwTc4BL"
ADMIN_TOTP_SECRET = "2FAI3HWF6WYDNSQC7DNSUGKZ4HWQBMOH"


def _mint_token(uid):
    out = subprocess.check_output(["python3", "/app/tests/mint_token.py", uid], text=True)
    return out.strip()


@pytest.fixture(scope="module")
def member_token():
    return _mint_token(TESTER_UID)


@pytest.fixture(scope="module")
def member_headers(member_token):
    return {**UA, "Authorization": f"Bearer {member_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_headers():
    # 1) Clerk Bearer for admin user
    bearer = _mint_token(ADMIN_UID)
    # 2) Admin 2FA → X-Admin-Token
    s = requests.Session()
    s.headers.update(UA)
    r = s.post(f"{BASE}/api/admin/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    pre = r.json()["pre_token"]
    code = pyotp.TOTP(ADMIN_TOTP_SECRET).now()
    r = s.post(f"{BASE}/api/admin/auth/totp", json={"pre_token": pre, "code": code})
    assert r.status_code == 200, r.text
    admin_token = r.json()["admin_token"]
    return {**UA, "Authorization": f"Bearer {bearer}", "X-Admin-Token": admin_token}


# --- Product tests ---
def test_giftcard_product_shape():
    r = requests.get(f"{BASE}/api/products/giftcard-shkp-hkd", headers=UA)
    assert r.status_code == 200
    p = r.json()
    assert p["is_giftcard"] is True
    assert [s["id"] for s in p["specs"]] == ["s500", "s1000", "s5000"]
    names = [f.get("name") for f in p.get("delivery_fields") or []]
    assert "AlipayHK 帳號" in names


# --- Order + wallet pay flow ---
def _place_and_pay(headers, qty):
    body = {
        "items": [{"product_id": "giftcard-shkp-hkd", "spec_id": "s500", "quantity": qty}],
        "currency": "USD",
        "recharge_account": "98900111",
        "delivery_info": {"giftcard-shkp-hkd": {"AlipayHK 帳號": "98900111"}},
    }
    r = requests.post(f"{BASE}/api/orders", headers=headers, json=body)
    assert r.status_code == 200, r.text
    oid = r.json()["id"]
    r2 = requests.post(f"{BASE}/api/orders/{oid}/pay-wallet", headers=headers)
    assert r2.status_code == 200, r2.text
    # Re-fetch via /api/orders/{id} (dispatch_giftcards persisted after pay-wallet return)
    g = requests.get(f"{BASE}/api/orders/{oid}", headers=headers)
    assert g.status_code == 200, g.text
    order = g.json()
    return order, oid


def test_order_qty1_generates_one_trade_no(member_headers):
    order, oid = _place_and_pay(member_headers, 1)
    assert order.get("is_giftcard_order") is True
    nos = order.get("gift_trade_nos") or []
    assert len(nos) == 1
    tn = nos[0]["trade_no"]
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    assert re.fullmatch(r"\d{32}", tn), tn
    assert tn.startswith(today)
    assert order.get("gift_trade_no") == tn
    # verify via GET /api/orders list
    g = requests.get(f"{BASE}/api/orders", headers=member_headers).json()
    row = next((o for o in g if o["id"] == oid), None)
    assert row and row.get("gift_trade_nos") and row["gift_trade_nos"][0]["trade_no"] == tn
    pytest.qty1_order_id = oid
    pytest.qty1_trade_no = tn


def test_order_qty2_generates_two_distinct_trade_nos(member_headers):
    order, oid = _place_and_pay(member_headers, 2)
    nos = order.get("gift_trade_nos") or []
    assert len(nos) == 2
    assert nos[0]["trade_no"] != nos[1]["trade_no"]
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    for n in nos:
        assert re.fullmatch(r"\d{32}", n["trade_no"])
        assert n["trade_no"].startswith(today)
    pytest.qty2_order_id = oid
    pytest.qty2_trade_no = nos[0]["trade_no"]


# --- Admin tests ---
def test_admin_gift_card_orders_list(admin_headers):
    r = requests.get(f"{BASE}/api/admin/gift-card-orders", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert "rows" in data and "counts" in data
    rows = data["rows"]
    assert len(rows) >= 2
    ids = {r["id"] for r in rows}
    assert pytest.qty1_order_id in ids
    assert pytest.qty2_order_id in ids
    sample = next(r for r in rows if r["id"] == pytest.qty1_order_id)
    assert sample.get("account_no")
    assert sample.get("items")
    assert sample.get("gift_trade_nos")
    assert sample.get("delivery_info")


def test_admin_gift_card_orders_status_filter(admin_headers):
    r = requests.get(f"{BASE}/api/admin/gift-card-orders", headers=admin_headers, params={"status": "paid"})
    assert r.status_code == 200
    rows = r.json()["rows"]
    assert all(r["status"] == "paid" for r in rows)


def test_admin_gift_card_orders_q_search_by_trade_no(admin_headers):
    tn = pytest.qty1_trade_no
    r = requests.get(f"{BASE}/api/admin/gift-card-orders", headers=admin_headers, params={"q": tn})
    assert r.status_code == 200
    rows = r.json()["rows"]
    assert any(any(n.get("trade_no") == tn for n in (row.get("gift_trade_nos") or [])) for row in rows)
