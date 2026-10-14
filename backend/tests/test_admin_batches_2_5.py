"""Batches 2-5 admin endpoint sanity.
Mints Clerk JWT via Clerk Backend API + crafts X-Admin-Token (HMAC) for admin@gogo589.com.
"""
import os, time, json, base64, hmac, hashlib, pytest, requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")
CLERK_SK = os.environ["CLERK_SECRET_KEY"]
ADMIN_UID = "user_3Kfh24fwfGJl8aUhmiiLZwTc4BL"  # admin@gogo589.com
UA = {"User-Agent": "gogo589-test/1.0"}


def _sign(payload, ttl=3600):
    body = json.dumps({**payload, "exp": int(time.time()) + ttl}, separators=(",", ":")).encode()
    sig = hmac.new(CLERK_SK.encode(), body, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(body).decode().rstrip("=") + "." + base64.urlsafe_b64encode(sig).decode().rstrip("=")


@pytest.fixture(scope="module")
def auth_headers():
    h = {"Authorization": f"Bearer {CLERK_SK}", "Content-Type": "application/json", **UA}
    s = requests.post("https://api.clerk.com/v1/sessions", headers=h, json={"user_id": ADMIN_UID}, timeout=30).json()
    jwt = requests.post(f"https://api.clerk.com/v1/sessions/{s['id']}/tokens", headers=h, json={"expires_in_seconds": 3600}, timeout=30).json()["jwt"]
    return {"Authorization": f"Bearer {jwt}", "X-Admin-Token": _sign({"uid": ADMIN_UID}), **UA}


# ---- Batch 2: inventory & specs ----
def test_inventory_list(auth_headers):
    r = requests.get(f"{BASE}/api/admin/inventory?page=1&size=5", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)

def test_inventory_only_low(auth_headers):
    r = requests.get(f"{BASE}/api/admin/inventory?only_low=1", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_spec_templates(auth_headers):
    r = requests.get(f"{BASE}/api/admin/spec-templates", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---- Batch 3: finance ----
def test_settlement(auth_headers):
    r = requests.get(f"{BASE}/api/admin/finance/settlement", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "rows" in data

def test_reconciliation(auth_headers):
    r = requests.get(f"{BASE}/api/admin/finance/reconciliation", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "topups" in data or "orders" in data

def test_finance_reports(auth_headers):
    r = requests.get(f"{BASE}/api/admin/reports", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "rows" in data


# ---- Batch 4: dashboard ----
def test_analytics_sales(auth_headers):
    r = requests.get(f"{BASE}/api/admin/analytics/sales", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    assert "top_products" in r.json()

def test_analytics_realtime(auth_headers):
    r = requests.get(f"{BASE}/api/admin/analytics/realtime", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "orders_today" in d


# ---- Batch 5: users ----
def test_user_reports(auth_headers):
    r = requests.get(f"{BASE}/api/admin/user-reports", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "total_users" in d
    assert "levels" in d

def test_users_batch_noop(auth_headers):
    # action=tag with no selected users is a safe no-op
    r = requests.post(f"{BASE}/api/admin/users/batch", headers=auth_headers,
                      json={"user_ids": [], "action": "tag", "value": "TEST_batch_noop"}, timeout=30)
    # endpoint might require user_ids; accept either 200 or 400 but not 500
    assert r.status_code in (200, 400, 422), r.text


# ---- 401 unauth ----
@pytest.mark.parametrize("path", [
    "/api/admin/inventory", "/api/admin/spec-templates",
    "/api/admin/finance/settlement", "/api/admin/finance/reconciliation",
    "/api/admin/reports", "/api/admin/analytics/sales",
    "/api/admin/analytics/realtime", "/api/admin/user-reports",
])
def test_unauth_401(path):
    r = requests.get(f"{BASE}{path}", headers=UA, timeout=30)
    assert r.status_code in (401, 403), f"{path} returned {r.status_code}"
