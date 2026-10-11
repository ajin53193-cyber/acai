"""Iteration 17: Backend refactor regression + scheduled exports + notify threshold + merchant open API."""
import os
import time
import hmac
import hashlib
import json
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sifang-collect.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "ajin53193@gmail.com"
ADMIN_PASS = "admin888"
MERCHANT_EMAIL = "merchant@demo.com"
MERCHANT_PASS = "merchant888"


def _read_cron_secret():
    try:
        with open("/app/backend/.env", "r") as f:
            for line in f:
                if line.strip().startswith("WEBHOOK_CRON_SECRET"):
                    v = line.split("=", 1)[1].strip().strip('"').strip("'")
                    return v
    except Exception:
        return ""
    return ""


CRON_SECRET = _read_cron_secret()


# --- Auth / fixtures ---

@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def merchant_api(admin_h):
    """Admin fetches an active merchant's api_key/secret for Open API HMAC test."""
    r = requests.get(f"{BASE_URL}/api/accounts?role=merchant", headers=admin_h, timeout=15)
    assert r.status_code == 200
    for m in r.json():
        if m.get("status") == "active" and m.get("api_key") and m.get("api_secret"):
            return m["api_key"], m["api_secret"]
    pytest.skip("No active merchant with API keys found")


# --- Regression: admin login + basic endpoints ---

def test_admin_login_ok(admin_h):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_h, timeout=15)
    assert r.status_code == 200


def test_dashboard_stats(admin_h):
    r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_h, timeout=15)
    assert r.status_code == 200


def test_orders_list_and_filters(admin_h):
    r = requests.get(f"{BASE_URL}/api/orders", headers=admin_h, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), (list, dict))
    r2 = requests.get(f"{BASE_URL}/api/orders?status=pending&keyword=SF", headers=admin_h, timeout=15)
    assert r2.status_code == 200


def test_create_order_from_admin(admin_h):
    merchants = requests.get(f"{BASE_URL}/api/accounts?role=merchant", headers=admin_h, timeout=15)
    assert merchants.status_code == 200
    ml = merchants.json()
    assert len(ml) > 0
    mid = ml[0]["id"]
    payload = {"merchant_id": mid, "amount_usdt": 10.0, "network": "TRC20", "remark": "TEST_iter17"}
    r = requests.post(f"{BASE_URL}/api/orders", json=payload, headers=admin_h, timeout=20)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data.get("network") == "TRC20"
    assert "order_no" in data or "id" in data
    oid = data.get("id") or data.get("_id") or data.get("order_no")
    if oid:
        g = requests.get(f"{BASE_URL}/api/orders/{data.get('order_no')}/public", timeout=15)
        assert g.status_code == 200


# --- Merchant Open API HMAC order creation ---

def _canon(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v)


def _sign_body(payload: dict, secret: str) -> str:
    items = sorted((k, v) for k, v in payload.items() if k != "sign" and v is not None and v != "")
    raw = "&".join(f"{k}={_canon(v)}" for k, v in items)
    return hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()


def test_merchant_open_api_create_order(merchant_api):
    ak, sk = merchant_api
    payload = {
        "api_key": ak,
        "timestamp": int(time.time()),
        "nonce": uuid.uuid4().hex,
        "out_trade_no": f"TEST_{uuid.uuid4().hex[:12]}",
        "amount_usdt": 10.5,
        "network": "TRC20",
        "notify_url": "https://example.com/cb",
    }
    payload["sign"] = _sign_body(payload, sk)
    r = requests.post(f"{BASE_URL}/api/v1/orders", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("code") == 0, j
    data = j.get("data") or j
    assert data.get("network") == "TRC20"


# --- Notify settings threshold ---

def test_notify_settings_threshold_persists(admin_h):
    g = requests.get(f"{BASE_URL}/api/notify/settings", headers=admin_h, timeout=15)
    assert g.status_code == 200
    original = g.json().get("export_notify_threshold", 500)
    new_val = 777
    p = requests.put(f"{BASE_URL}/api/notify/settings", headers=admin_h,
                     json={"export_notify_threshold": new_val}, timeout=15)
    assert p.status_code == 200, p.text
    g2 = requests.get(f"{BASE_URL}/api/notify/settings", headers=admin_h, timeout=15)
    assert g2.status_code == 200
    assert g2.json().get("export_notify_threshold") == new_val
    # restore
    requests.put(f"{BASE_URL}/api/notify/settings", headers=admin_h,
                 json={"export_notify_threshold": original}, timeout=15)


# --- Export schedules CRUD + validation ---

@pytest.fixture
def cleanup_schedules(admin_h):
    created = []
    yield created
    for sid in created:
        requests.delete(f"{BASE_URL}/api/export-schedules/{sid}", headers=admin_h, timeout=15)


def test_create_order_schedule_daily(admin_h, cleanup_schedules):
    r = requests.post(f"{BASE_URL}/api/export-schedules", headers=admin_h,
                      json={"kind": "orders", "freq": "daily"}, timeout=15)
    assert r.status_code in (200, 201), r.text
    sid = r.json().get("id") or r.json().get("_id")
    assert sid
    cleanup_schedules.append(sid)
    lst = requests.get(f"{BASE_URL}/api/export-schedules", headers=admin_h, timeout=15).json()
    assert any((x.get("id") == sid) for x in lst)
    # toggle
    t = requests.patch(f"{BASE_URL}/api/export-schedules/{sid}/toggle", headers=admin_h, timeout=15)
    assert t.status_code == 200
    assert t.json().get("enabled") is False


def test_ledger_schedule_requires_account(admin_h):
    r = requests.post(f"{BASE_URL}/api/export-schedules", headers=admin_h,
                      json={"kind": "ledger", "freq": "daily"}, timeout=15)
    assert r.status_code == 400, r.text


def test_ledger_schedule_with_account(admin_h, cleanup_schedules):
    merchants = requests.get(f"{BASE_URL}/api/accounts?role=merchant", headers=admin_h, timeout=15).json()
    mid = merchants[0]["id"]
    r = requests.post(f"{BASE_URL}/api/export-schedules", headers=admin_h,
                      json={"kind": "ledger", "freq": "weekly", "account_id": mid}, timeout=15)
    assert r.status_code in (200, 201), r.text
    sid = r.json().get("id")
    cleanup_schedules.append(sid)


# --- Cron run-exports ---

def test_cron_run_exports_unauthorized():
    r = requests.post(f"{BASE_URL}/api/cron/run-exports", timeout=15)
    assert r.status_code == 401


def test_cron_run_exports_authorized_creates_job(admin_h, cleanup_schedules):
    assert CRON_SECRET, "WEBHOOK_CRON_SECRET missing from /app/backend/.env"
    # Create an enabled daily orders schedule so cron has something to run
    cr = requests.post(f"{BASE_URL}/api/export-schedules", headers=admin_h,
                       json={"kind": "orders", "freq": "daily"}, timeout=15)
    assert cr.status_code in (200, 201)
    sid = cr.json().get("id")
    cleanup_schedules.append(sid)

    jobs_before = requests.get(f"{BASE_URL}/api/export/jobs", headers=admin_h, timeout=15)
    before_count = len(jobs_before.json()) if jobs_before.status_code == 200 else 0

    r = requests.post(f"{BASE_URL}/api/cron/run-exports",
                      headers={"Authorization": f"Bearer {CRON_SECRET}"}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    # Background task — poll jobs list for a few seconds
    found = False
    for _ in range(10):
        time.sleep(1.0)
        jl = requests.get(f"{BASE_URL}/api/export/jobs", headers=admin_h, timeout=15)
        if jl.status_code == 200:
            for j in jl.json():
                cb = (j.get("created_email") or "") + " " + str(j.get("created_by") or "")
                if "定时导出" in cb and "每日" in cb:
                    found = True
                    break
        if found:
            break
    assert found, "No scheduled '定时导出·每日' export job appeared"


# --- Channels regression (TRC20) ---

def test_channels_still_trc20(admin_h):
    r = requests.get(f"{BASE_URL}/api/channels", headers=admin_h, timeout=15)
    assert r.status_code == 200
    for c in r.json():
        assert c["network"] == "TRC20"
