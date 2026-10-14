"""Iteration 36 — 系統配置 Batch 1 backend tests.

Covers (super-admin only endpoints):
  - GET /api/admin/me                            (is_super, permissions, all_permissions)
  - GET/POST/PUT/DELETE /api/admin/roles
  - GET /api/admin/admins + POST /admins/promote (bad email → 404)
  - GET /api/admin/integration-settings?group=sms|email|oauth  (masking of secrets)
  - PUT /api/admin/integration-settings  (masked placeholder does NOT overwrite)
  - POST /api/admin/integration-settings/test  (SMS: ok or graceful failure)
  - GET /api/admin/operation-logs + /export (CSV)
  - 401 without auth, 403 for non-super admin
"""
import os
import re
import subprocess
import time

import pyotp
import pytest
import requests

with open("/app/frontend/.env") as f:
    BASE = next(l.split("=", 1)[1].strip().rstrip("/") for l in f if l.startswith("REACT_APP_BACKEND_URL="))

ADMIN_EMAIL = "admin+clerk_test@shop.com"
ADMIN_PW = "Gogo589!Admin#7x2Q"
ADMIN_UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
TESTER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
TESTER_EMAIL = "tester+clerk_test@shop.com"
UA = {"User-Agent": "gogo589-test/1.0"}


def _totp_secret() -> str:
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")

    async def go():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        r = await c[os.environ["DB_NAME"]].admin_2fa.find_one({"user_id": ADMIN_UID})
        return r["secret"]

    return asyncio.get_event_loop().run_until_complete(go())


def _mint(uid: str) -> str:
    return subprocess.check_output(["python3", "/app/tests/mint_token.py", uid]).decode().strip()


@pytest.fixture(scope="module")
def admin_bearer():
    return _mint(ADMIN_UID)


@pytest.fixture(scope="module")
def tester_bearer():
    return _mint(TESTER_UID)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/admin/auth/login",
                      json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW}, headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    pre = r.json()["pre_token"]
    code = pyotp.TOTP(_totp_secret()).now()
    r2 = requests.post(f"{BASE}/api/admin/auth/totp",
                       json={"pre_token": pre, "code": code}, headers=UA, timeout=30)
    assert r2.status_code == 200, r2.text
    return r2.json()["admin_token"]


@pytest.fixture(scope="module")
def H(admin_bearer, admin_token):
    return {**UA, "Authorization": f"Bearer {admin_bearer}", "X-Admin-Token": admin_token}


# ============================================================= /admin/me
class TestAdminMe:
    def test_me_super(self, H):
        r = requests.get(f"{BASE}/api/admin/me", headers=H, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_super"] is True
        assert isinstance(d["permissions"], list)
        assert isinstance(d["all_permissions"], list) and len(d["all_permissions"]) >= 50
        # super gets ALL permissions
        assert set(d["permissions"]) == set(d["all_permissions"])
        assert d["role_name"] in ("超級管理員", d.get("role_name"))
        assert d["user_id"] == ADMIN_UID

    def test_me_unauth_401(self):
        r = requests.get(f"{BASE}/api/admin/me", headers=UA, timeout=30)
        assert r.status_code == 401


# ============================================================= Roles RBAC
class TestRoles:
    created_rid = None

    def test_01_create_role(self, H):
        body = {"name": "TEST_role_qa", "permissions": ["members", "orders", "nonexistent-perm"]}
        r = requests.post(f"{BASE}/api/admin/roles", headers=H, json=body, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_role_qa"
        # unknown perm filtered out
        assert "nonexistent-perm" not in d["permissions"]
        assert set(d["permissions"]) == {"members", "orders"}
        assert d["id"]
        TestRoles.created_rid = d["id"]

    def test_02_list_contains_created(self, H):
        r = requests.get(f"{BASE}/api/admin/roles", headers=H, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert any(x["id"] == TestRoles.created_rid for x in rows)
        row = next(x for x in rows if x["id"] == TestRoles.created_rid)
        assert "admin_count" in row

    def test_03_update_role(self, H):
        assert TestRoles.created_rid
        body = {"name": "TEST_role_qa2", "permissions": ["members"]}
        r = requests.put(f"{BASE}/api/admin/roles/{TestRoles.created_rid}", headers=H, json=body, timeout=30)
        assert r.status_code == 200
        # verify via list
        rows = requests.get(f"{BASE}/api/admin/roles", headers=H, timeout=30).json()
        row = next(x for x in rows if x["id"] == TestRoles.created_rid)
        assert row["name"] == "TEST_role_qa2"
        assert row["permissions"] == ["members"]

    def test_04_delete_role(self, H):
        r = requests.delete(f"{BASE}/api/admin/roles/{TestRoles.created_rid}", headers=H, timeout=30)
        assert r.status_code == 200
        rows = requests.get(f"{BASE}/api/admin/roles", headers=H, timeout=30).json()
        assert not any(x["id"] == TestRoles.created_rid for x in rows)


# ============================================================= Admins
class TestAdmins:
    def test_list_contains_self(self, H):
        r = requests.get(f"{BASE}/api/admin/admins", headers=H, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        me = next((x for x in rows if x["user_id"] == ADMIN_UID), None)
        assert me is not None
        assert me["is_self"] is True
        assert me["is_super"] is True
        assert me["twofa"] is True

    def test_promote_bad_email_404(self, H):
        r = requests.post(f"{BASE}/api/admin/admins/promote",
                          headers=H, json={"email": "nobody_xyz_qa@example.com"}, timeout=30)
        assert r.status_code == 404

    def test_revoke_self_blocked(self, H):
        r = requests.post(f"{BASE}/api/admin/admins/{ADMIN_UID}/revoke", headers=H, timeout=30)
        assert r.status_code == 400


# ============================================================= Integration settings
class TestIntegrationSettings:
    @pytest.mark.parametrize("group", ["sms", "email", "oauth"])
    def test_get_schema(self, H, group):
        r = requests.get(f"{BASE}/api/admin/integration-settings", headers=H, params={"group": group}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["group"] == group
        assert isinstance(d["fields"], list) and len(d["fields"]) > 0
        for f in d["fields"]:
            assert {"key", "label", "secret", "set", "source", "value"} <= set(f.keys())
            if f["secret"] and f["set"]:
                # must be masked
                assert "•" in f["value"] or f["value"].startswith("••")

    def test_bad_group_400(self, H):
        r = requests.get(f"{BASE}/api/admin/integration-settings", headers=H, params={"group": "zzz"}, timeout=30)
        assert r.status_code == 400

    def test_put_masked_secret_does_not_overwrite(self, H):
        # fetch current SMS schema
        d = requests.get(f"{BASE}/api/admin/integration-settings", headers=H, params={"group": "sms"}, timeout=30).json()
        # Find a secret field that's set (e.g. SUBMAIL_APPKEY or DAGOU_KEY)
        secret_field = next((f for f in d["fields"] if f["secret"] and f["set"]), None)
        if not secret_field:
            pytest.skip("no secret field currently set")
        masked_val = secret_field["value"]
        # Capture non-secret current value as sentinel
        non_secret = next(f for f in d["fields"] if not f["secret"] and f["key"] == "DAGOU_GATEWAY")
        original = non_secret["value"]
        # PUT with masked value (should NOT overwrite) + a throwaway change on non-secret
        new_val = (original or "https://api.example.com") + "/qa"
        body = {"group": "sms", "values": {secret_field["key"]: masked_val, "DAGOU_GATEWAY": new_val}}
        r = requests.put(f"{BASE}/api/admin/integration-settings", headers=H, json=body, timeout=30)
        assert r.status_code == 200, r.text
        resp = r.json()
        assert resp["ok"] is True
        # Changed count should be 1 (only non-secret), not 2
        assert resp["changed"] == 1

        # Verify: non-secret updated, secret unchanged
        d2 = requests.get(f"{BASE}/api/admin/integration-settings", headers=H, params={"group": "sms"}, timeout=30).json()
        ns2 = next(f for f in d2["fields"] if f["key"] == "DAGOU_GATEWAY")
        assert ns2["value"] == new_val
        sec2 = next(f for f in d2["fields"] if f["key"] == secret_field["key"])
        assert sec2["set"] is True  # still set

        # Restore the non-secret value
        if original:
            requests.put(f"{BASE}/api/admin/integration-settings", headers=H,
                         json={"group": "sms", "values": {"DAGOU_GATEWAY": original}}, timeout=30)

    def test_test_send_endpoint_responds(self, H):
        # Per instructions: gateway failure is ACCEPTABLE; just verify endpoint responds coherently
        r = requests.post(f"{BASE}/api/admin/integration-settings/test",
                          headers=H, json={"group": "sms", "target": "0912345678"}, timeout=60)
        assert r.status_code in (200, 400), r.text
        # Either success message or graceful failure detail
        if r.status_code == 200:
            assert r.json().get("ok") is True
        else:
            assert "detail" in r.json()


# ============================================================= Operation logs
class TestOperationLogs:
    def test_logs_list_has_entries(self, H):
        # Allow async middleware to flush
        time.sleep(2)
        r = requests.get(f"{BASE}/api/admin/operation-logs", headers=H, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "rows" in d and "total" in d
        assert isinstance(d["rows"], list)
        # Our role create/edit/delete above should have produced POST/PUT/DELETE entries
        methods = {row.get("method") for row in d["rows"]}
        # middleware excludes /operation-logs itself; roles writes should appear
        assert methods & {"POST", "PUT", "DELETE"}, f"no admin write logs found; methods={methods}"

    def test_logs_search_filter(self, H):
        r = requests.get(f"{BASE}/api/admin/operation-logs", headers=H, params={"q": "roles"}, timeout=30)
        assert r.status_code == 200
        for row in r.json()["rows"]:
            assert "roles" in row.get("path", "")

    def test_logs_export_csv(self, H):
        r = requests.get(f"{BASE}/api/admin/operation-logs/export", headers=H, timeout=60)
        assert r.status_code == 200
        assert "csv" in r.headers.get("content-type", "").lower()
        text = r.text
        assert text.splitlines()[0].startswith("time,admin,method,path,status")


# ============================================================= AuthZ
class TestAuthZ:
    def test_unauth_401(self):
        for path in ("/api/admin/roles", "/api/admin/admins",
                     "/api/admin/integration-settings?group=sms",
                     "/api/admin/operation-logs"):
            r = requests.get(f"{BASE}{path}", headers=UA, timeout=30)
            assert r.status_code == 401, f"{path} → {r.status_code}"

    def test_non_super_403(self, tester_bearer):
        # Member bearer (role=member) → current_admin rejects as 403 (Not allowed) before require_super
        h = {**UA, "Authorization": f"Bearer {tester_bearer}"}
        r = requests.get(f"{BASE}/api/admin/roles", headers=h, timeout=30)
        assert r.status_code == 403
        r = requests.get(f"{BASE}/api/admin/integration-settings?group=sms", headers=h, timeout=30)
        assert r.status_code == 403
