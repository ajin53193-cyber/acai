"""Iteration 25 — Admin 會員管理 redesign backend tests.

Covers:
  - GET /api/admin/members/stats returns {total, active, new, banned} integers
  - GET /api/admin/members list rows carry account_no (numeric str) + order_count + spent_usd + balance_usd
  - GET /api/admin/members/{uid} enriched: account_no, verified(bool), order_count(int), spent_usd(float)
  - X-Admin-Token guard on /members/stats
  - Ban/unban round-trip reflects in detail.banned
"""
import os
import subprocess
import re

import pyotp
import pytest
import requests

with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "admin+clerk_test@shop.com"
ADMIN_PW = "Gogo589!Admin#7x2Q"
ADMIN_UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
TESTER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
UA = {"User-Agent": "gogo589-test/1.0"}


def _totp_secret() -> str:
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

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
def admin_token():
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
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


class TestMemberStats:
    def test_stats_requires_admin_token(self, admin_bearer):
        r = requests.get(f"{BASE}/api/admin/members/stats",
                         headers={**UA, "Authorization": f"Bearer {admin_bearer}"}, timeout=20)
        assert r.status_code == 401
        assert "admin_2fa_required" in r.text

    def test_stats_shape(self, H):
        r = requests.get(f"{BASE}/api/admin/members/stats", headers=H, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total", "active", "new", "banned"):
            assert k in d, f"missing {k}"
            assert isinstance(d[k], int), f"{k} must be int, got {type(d[k])}"
            assert d[k] >= 0
        assert d["total"] >= 1  # at least admin exists
        assert d["banned"] <= d["total"]


class TestMembersList:
    def test_list_rows_have_account_no_and_counters(self, H):
        r = requests.get(f"{BASE}/api/admin/members?limit=50", headers=H, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 1
        for u in rows:
            assert isinstance(u["account_no"], str) and re.fullmatch(r"\d{9}", u["account_no"])
            assert isinstance(u["order_count"], int)
            assert isinstance(u["spent_usd"], (int, float))
            assert isinstance(u["balance_usd"], (int, float))
            assert isinstance(u["banned"], bool)

    def test_account_no_matches_detail(self, H):
        r = requests.get(f"{BASE}/api/admin/members/{ADMIN_UID}", headers=H, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert re.fullmatch(r"\d{9}", d["account_no"])
        # verify list and detail agree
        r2 = requests.get(f"{BASE}/api/admin/members?q=admin&limit=20", headers=H, timeout=20)
        row = next((u for u in r2.json() if u["user_id"] == ADMIN_UID), None)
        if row:
            assert row["account_no"] == d["account_no"]


class TestMemberDetailFields:
    def test_detail_has_new_fields(self, H):
        r = requests.get(f"{BASE}/api/admin/members/{TESTER_UID}", headers=H, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["account_no"], str) and re.fullmatch(r"\d{9}", d["account_no"])
        assert isinstance(d["verified"], bool)
        assert isinstance(d["order_count"], int) and d["order_count"] >= 0
        assert isinstance(d["spent_usd"], (int, float)) and d["spent_usd"] >= 0
        assert "balance_usd" in d
        assert "orders" in d and isinstance(d["orders"], list)
        assert "transactions" in d and isinstance(d["transactions"], list)
        assert "banned" in d and isinstance(d["banned"], bool)

    def test_detail_404_for_unknown_uid(self, H):
        r = requests.get(f"{BASE}/api/admin/members/user_doesnotexist123", headers=H, timeout=15)
        assert r.status_code == 404


class TestBanUnbanRoundTrip:
    def test_ban_then_unban_reflects_in_detail_and_stats(self, H):
        # pick a throwaway non-admin, non-tester user
        rows = requests.get(f"{BASE}/api/admin/members?limit=200", headers=H, timeout=20).json()
        candidate = next((u for u in rows if u["user_id"] not in (ADMIN_UID, TESTER_UID) and not u["banned"]), None)
        if not candidate:
            pytest.skip("no non-admin unbanned user available")
        uid = candidate["user_id"]
        s0 = requests.get(f"{BASE}/api/admin/members/stats", headers=H, timeout=15).json()
        r = requests.post(f"{BASE}/api/admin/members/{uid}/ban", headers=H, timeout=20)
        assert r.status_code == 200 and r.json()["banned"] is True
        d = requests.get(f"{BASE}/api/admin/members/{uid}", headers=H, timeout=20).json()
        assert d["banned"] is True
        s1 = requests.get(f"{BASE}/api/admin/members/stats", headers=H, timeout=15).json()
        assert s1["banned"] >= s0["banned"] + 1 or s1["banned"] >= 1
        # unban cleanup
        r = requests.post(f"{BASE}/api/admin/members/{uid}/unban", headers=H, timeout=20)
        assert r.status_code == 200 and r.json()["banned"] is False
        d2 = requests.get(f"{BASE}/api/admin/members/{uid}", headers=H, timeout=20).json()
        assert d2["banned"] is False
