"""Admin console: create admin, create test account, toggle test flag, dashboard excludes test users.

Covers:
- POST /api/admin/admins/create (success + validation errors)
- POST /api/admin/admins/promote (404 for unknown email)
- POST /api/admin/members/create-test (success + is_test flag)
- POST /api/admin/members/{uid}/test-flag (toggle)
- GET  /api/admin/dashboard excludes is_test users from totals.users
"""
import os, time, json, base64, hmac, hashlib
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://crossborder-topup.preview.emergentagent.com"
SK = os.environ["CLERK_SECRET_KEY"]
ADMIN_UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"  # admin+clerk_test@shop.com (super admin w/ TOTP)
UA = "gogo589-test/1.0"


def _sign_admin_token(uid: str, ttl: int = 3600) -> str:
    body = json.dumps({"uid": uid, "exp": int(time.time()) + ttl}, separators=(",", ":")).encode()
    sig = hmac.new(SK.encode(), body, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(body).decode().rstrip("=") + "." + base64.urlsafe_b64encode(sig).decode().rstrip("=")


@pytest.fixture(scope="module")
def admin_headers():
    h = {"Authorization": f"Bearer {SK}", "User-Agent": UA, "Content-Type": "application/json"}
    s = requests.post("https://api.clerk.com/v1/sessions", headers=h, json={"user_id": ADMIN_UID}, timeout=20).json()
    jwt = requests.post(f"https://api.clerk.com/v1/sessions/{s['id']}/tokens", headers=h, json={"expires_in_seconds": 3600}, timeout=20).json()["jwt"]
    return {
        "Authorization": f"Bearer {jwt}",
        "X-Admin-Token": _sign_admin_token(ADMIN_UID),
        "User-Agent": UA,
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="module")
def created_uids():
    # collect uids to clean up at module teardown
    uids = []
    yield uids
    # cleanup: delete Clerk users created during tests
    h = {"Authorization": f"Bearer {SK}", "User-Agent": UA}
    for uid in uids:
        try:
            requests.delete(f"https://api.clerk.com/v1/users/{uid}", headers=h, timeout=15)
        except Exception:
            pass


# --------------------------- auth sanity ---------------------------
def test_auth_requires_admin_token(admin_headers):
    r = requests.get(f"{BASE}/api/admin/dashboard", headers={**admin_headers, "X-Admin-Token": "bogus"}, timeout=30)
    assert r.status_code == 401
    assert "admin_2fa" in (r.json().get("detail") or "")


def test_dashboard_ok_with_admin_token(admin_headers):
    r = requests.get(f"{BASE}/api/admin/dashboard", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "totals" in j and "users" in j["totals"]
    assert isinstance(j["totals"]["users"], int)


# --------------------------- /admins/create ---------------------------
def test_create_admin_success(admin_headers, created_uids):
    email = f"e2e-admin-{int(time.time())}@shop.com"
    r = requests.post(f"{BASE}/api/admin/admins/create", headers=admin_headers,
                      json={"email": email, "password": "Test1234!", "role_id": ""}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    assert data["user_id"].startswith("user_")
    created_uids.append(data["user_id"])

    # verify appears in admins list
    lst = requests.get(f"{BASE}/api/admin/admins", headers=admin_headers, timeout=30).json()
    emails = [a.get("email", "").lower() for a in lst]
    assert email in emails, f"new admin not in list: {emails[:5]}..."


def test_create_admin_invalid_password_422(admin_headers):
    # Empty password -> Pydantic may 422 or endpoint may 400; both acceptable, must NOT 200
    r = requests.post(f"{BASE}/api/admin/admins/create", headers=admin_headers,
                      json={"email": f"e2e-admin-bad-{int(time.time())}@shop.com", "password": "", "role_id": ""}, timeout=30)
    assert r.status_code in (400, 422), r.text


def test_create_admin_weak_password_400(admin_headers):
    r = requests.post(f"{BASE}/api/admin/admins/create", headers=admin_headers,
                      json={"email": f"e2e-admin-weak-{int(time.time())}@shop.com", "password": "123", "role_id": ""}, timeout=30)
    assert r.status_code == 400
    assert "密碼" in (r.json().get("detail") or "")


# --------------------------- /admins/promote ---------------------------
def test_promote_unknown_email_404(admin_headers):
    r = requests.post(f"{BASE}/api/admin/admins/promote", headers=admin_headers,
                      json={"email": f"no-such-{int(time.time())}@nope.com", "role_id": ""}, timeout=30)
    assert r.status_code == 404
    assert "找不到該用戶" in (r.json().get("detail") or "")


# --------------------------- /members/create-test and /test-flag ---------------------------
def test_create_test_account_and_toggle_flag(admin_headers, created_uids):
    email = f"e2e-test-{int(time.time())}@shop.com"
    # baseline user count (totals.users excludes test)
    base_users = requests.get(f"{BASE}/api/admin/dashboard", headers=admin_headers, timeout=30).json()["totals"]["users"]

    # create test account
    r = requests.post(f"{BASE}/api/admin/members/create-test", headers=admin_headers,
                      json={"email": email, "password": "Test1234!"}, timeout=30)
    assert r.status_code == 200, r.text
    uid = r.json()["user_id"]
    created_uids.append(uid)

    # appears in members list with is_test True
    lst = requests.get(f"{BASE}/api/admin/members?q={email}", headers=admin_headers, timeout=30).json()
    row = next((u for u in lst if u["user_id"] == uid), None)
    assert row is not None, "test account not in members list"
    assert row.get("is_test") is True

    # dashboard totals.users should NOT have grown (test user excluded)
    after_users = requests.get(f"{BASE}/api/admin/dashboard", headers=admin_headers, timeout=30).json()["totals"]["users"]
    assert after_users == base_users, f"test user leaked into totals.users ({base_users}->{after_users})"

    # toggle test-flag -> false
    r = requests.post(f"{BASE}/api/admin/members/{uid}/test-flag", headers=admin_headers,
                      json={"is_test": False}, timeout=30)
    assert r.status_code == 200 and r.json()["is_test"] is False

    # now dashboard totals.users should include it
    now_users = requests.get(f"{BASE}/api/admin/dashboard", headers=admin_headers, timeout=30).json()["totals"]["users"]
    assert now_users == base_users + 1, f"after un-flag: {base_users}+1 expected, got {now_users}"

    # toggle back to is_test=True
    r = requests.post(f"{BASE}/api/admin/members/{uid}/test-flag", headers=admin_headers,
                      json={"is_test": True}, timeout=30)
    assert r.status_code == 200 and r.json()["is_test"] is True


def test_create_test_account_weak_password_400(admin_headers):
    r = requests.post(f"{BASE}/api/admin/members/create-test", headers=admin_headers,
                      json={"email": f"e2e-tbad-{int(time.time())}@shop.com", "password": "123"}, timeout=30)
    assert r.status_code == 400
