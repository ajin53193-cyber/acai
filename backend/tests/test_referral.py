"""Referral (邀請返利) admin + member backend tests."""
import os
import subprocess
import asyncio

import pyotp
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

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
def admin_headers(admin_bearer, admin_token):
    return {**UA, "Authorization": f"Bearer {admin_bearer}", "X-Admin-Token": admin_token}


# --------------------------------------------------- Admin: Config
class TestReferralConfig:
    def test_requires_admin_token(self, admin_bearer):
        r = requests.get(f"{BASE}/api/admin/referral/config",
                         headers={**UA, "Authorization": f"Bearer {admin_bearer}"}, timeout=30)
        assert r.status_code == 401

    def test_get_defaults_or_persisted(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/referral/config", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("enabled", "referrer_points", "referee_points", "poster_title", "poster_subtitle"):
            assert k in d

    def test_update_persists(self, admin_headers):
        payload = {"enabled": True, "referrer_points": 555, "referee_points": 222,
                   "poster_title": "測試標題X", "poster_subtitle": "測試副標題X"}
        r = requests.put(f"{BASE}/api/admin/referral/config", headers=admin_headers,
                         json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        g = requests.get(f"{BASE}/api/admin/referral/config", headers=admin_headers, timeout=30).json()
        assert g["referrer_points"] == 555
        assert g["referee_points"] == 222
        assert g["poster_title"] == "測試標題X"
        assert g["poster_subtitle"] == "測試副標題X"


# --------------------------------------------------- Admin: Stats / Records / Leaderboard
class TestReferralReads:
    def test_stats(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/referral/stats", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_bound", "total_rewarded", "total_inviters", "points_granted"):
            assert k in d and isinstance(d[k], int)

    def test_records_empty_or_list(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/referral/records", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_records_filter(self, admin_headers):
        for rw in ("yes", "no", ""):
            r = requests.get(f"{BASE}/api/admin/referral/records",
                             headers=admin_headers, params={"rewarded": rw}, timeout=30)
            assert r.status_code == 200
            assert isinstance(r.json(), list)

    def test_leaderboard(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/referral/leaderboard", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --------------------------------------------------- Admin: Posters CRUD
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII="
)


class TestReferralPosters:
    created_id = None

    def test_list_has_seeded(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/referral/posters", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 2

    def test_create_with_b64(self, admin_headers):
        payload = {"name": "TEST_poster", "image_b64": TINY_PNG_B64, "image_name": "t.png",
                   "active": True, "sort": 99}
        r = requests.post(f"{BASE}/api/admin/referral/posters", headers=admin_headers,
                          json=payload, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_poster"
        assert d["image"].startswith("/api/img/") or d["image"].startswith("http")
        TestReferralPosters.created_id = d["id"]

    def test_update(self, admin_headers):
        pid = TestReferralPosters.created_id
        assert pid
        r = requests.put(f"{BASE}/api/admin/referral/posters/{pid}", headers=admin_headers,
                         json={"name": "TEST_poster_v2", "image": "/api/img/x.png",
                               "active": False, "sort": 50}, timeout=30)
        assert r.status_code == 200
        rows = requests.get(f"{BASE}/api/admin/referral/posters", headers=admin_headers,
                            timeout=30).json()
        got = [x for x in rows if x["id"] == pid][0]
        assert got["name"] == "TEST_poster_v2"
        assert got["active"] is False

    def test_delete(self, admin_headers):
        pid = TestReferralPosters.created_id
        r = requests.delete(f"{BASE}/api/admin/referral/posters/{pid}", headers=admin_headers,
                            timeout=30)
        assert r.status_code == 200
        rows = requests.get(f"{BASE}/api/admin/referral/posters", headers=admin_headers,
                            timeout=30).json()
        assert all(x["id"] != pid for x in rows)


# --------------------------------------------------- Member endpoint
class TestMemberReferral:
    def test_me_referral(self, tester_bearer):
        r = requests.get(f"{BASE}/api/me/referral",
                         headers={**UA, "Authorization": f"Bearer {tester_bearer}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("code") and isinstance(d["code"], str) and len(d["code"]) >= 4
        assert "posters" in d and isinstance(d["posters"], list)
        # Seeded 2 active templates must flow through to the member payload
        assert len(d["posters"]) >= 2
        for p in d["posters"]:
            assert p.get("image", "").startswith("/api/img/") or p.get("image", "").startswith("http")
        assert "poster_title" in d and "poster_subtitle" in d
        assert isinstance(d["enabled"], bool)
        assert isinstance(d["referrer_points"], int)

    def test_bind_bad_code(self, tester_bearer):
        r = requests.post(f"{BASE}/api/me/referral/bind",
                          headers={**UA, "Authorization": f"Bearer {tester_bearer}"},
                          json={"code": "ZZZZZZZZ"}, timeout=30)
        # Either 400 (already bound / after top-up) or 404 (not found) — both acceptable negative
        assert r.status_code in (400, 404), r.text
