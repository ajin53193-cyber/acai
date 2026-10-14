"""Round 35 referral additions: milestones, weekly rewards, poster style, cron."""
import os
import subprocess
import asyncio
import uuid

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
CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")

DEFAULT_CFG = {
    "enabled": True, "referrer_points": 500, "referee_points": 200,
    "poster_title": "邀請好友 · 一起賺積分",
    "poster_subtitle": "掃碼註冊並完成首充，雙方立得積分獎勵",
    "weekly_enabled": True,
    "weekly_rewards": [
        {"rank": 1, "type": "points", "value": 2000, "coupon_code": ""},
        {"rank": 2, "type": "points", "value": 1000, "coupon_code": ""},
        {"rank": 3, "type": "points", "value": 500, "coupon_code": ""},
    ],
    "milestones_enabled": True,
    "milestones": [
        {"count": 3, "type": "points", "value": 300, "coupon_code": ""},
        {"count": 5, "type": "points", "value": 800, "coupon_code": ""},
        {"count": 10, "type": "points", "value": 2000, "coupon_code": ""},
    ],
}


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


# ---------------- Config new fields round-trip ----------------
class TestConfigNewFields:
    def test_defaults_have_new_fields(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/referral/config", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("weekly_enabled", "weekly_rewards", "milestones_enabled", "milestones"):
            assert k in d, f"missing {k}"
        assert isinstance(d["weekly_rewards"], list)
        assert isinstance(d["milestones"], list)

    def test_edit_milestones_and_weekly(self, admin_headers):
        edited = {**DEFAULT_CFG,
                  "milestones": DEFAULT_CFG["milestones"] + [
                      {"count": 4, "type": "points", "value": 400, "coupon_code": ""}],
                  "weekly_rewards": [
                      {"rank": 1, "type": "points", "value": 2500, "coupon_code": ""},
                      {"rank": 2, "type": "points", "value": 1000, "coupon_code": ""},
                      {"rank": 3, "type": "points", "value": 500, "coupon_code": ""},
                  ]}
        r = requests.put(f"{BASE}/api/admin/referral/config", headers=admin_headers,
                         json=edited, timeout=30)
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE}/api/admin/referral/config", headers=admin_headers, timeout=30).json()
        assert any(int(m.get("count")) == 4 and int(m.get("value")) == 400 for m in g["milestones"])
        assert g["weekly_rewards"][0]["value"] == 2500

    def test_restore_defaults(self, admin_headers):
        r = requests.put(f"{BASE}/api/admin/referral/config", headers=admin_headers,
                         json=DEFAULT_CFG, timeout=30)
        assert r.status_code == 200
        g = requests.get(f"{BASE}/api/admin/referral/config", headers=admin_headers, timeout=30).json()
        assert len(g["milestones"]) == 3
        assert g["milestones"][0]["count"] == 3
        assert g["weekly_rewards"][0]["value"] == 2000


# ---------------- Weekly settle manual + awards ----------------
class TestWeeklyAdmin:
    def test_run_weekly(self, admin_headers):
        r = requests.post(f"{BASE}/api/admin/referral/weekly/run",
                          headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_weekly_awards_list(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/referral/weekly/awards",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        for row in rows[:3]:
            # non-fatal shape check if any awards exist
            assert "user_id" in row or "label" in row or "account" in row or "reward_label" in row


# ---------------- Cron auth gate ----------------
class TestCronAuth:
    def test_cron_no_auth_401(self):
        r = requests.post(f"{BASE}/api/cron/referral-weekly", headers=UA, timeout=30)
        assert r.status_code == 401

    def test_cron_with_secret_ok(self):
        assert CRON_SECRET, "WEBHOOK_CRON_SECRET missing in backend/.env"
        hid = f"test-{uuid.uuid4()}"
        r = requests.post(f"{BASE}/api/cron/referral-weekly",
                          headers={**UA, "Authorization": f"Bearer {CRON_SECRET}",
                                   "X-Webhook-Id": hid}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        # Duplicate id -> duplicate True
        r2 = requests.post(f"{BASE}/api/cron/referral-weekly",
                           headers={**UA, "Authorization": f"Bearer {CRON_SECRET}",
                                    "X-Webhook-Id": hid}, timeout=60)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("duplicate") is True


# ---------------- /api/me/referral new fields ----------------
class TestMeReferralNew:
    def test_me_has_milestones_and_poster_style(self, tester_bearer):
        r = requests.get(f"{BASE}/api/me/referral",
                         headers={**UA, "Authorization": f"Bearer {tester_bearer}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "milestones_enabled" in d
        assert isinstance(d.get("milestones"), list)
        assert isinstance(d.get("milestones_granted"), list)
        assert isinstance(d.get("posters"), list) and len(d["posters"]) >= 1
        for p in d["posters"]:
            assert "style" in p, f"poster missing style: {p}"
            assert isinstance(p["style"], dict)


# ---------------- Poster style persistence ----------------
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII="
)


class TestPosterStyle:
    created_id = None

    def test_create_with_style(self, admin_headers):
        style = {"title_color": "#ff0066", "subtitle_color": "#00aa88",
                 "code_color": "#112233", "align": "left",
                 "title_pos": {"x": 0.3, "y": 0.2},
                 "card_pos": {"x": 0.5, "y": 0.7}}
        payload = {"name": "TEST_style_poster", "image_b64": TINY_PNG_B64,
                   "image_name": "p.png", "active": True, "sort": 55, "style": style}
        r = requests.post(f"{BASE}/api/admin/referral/posters",
                          headers=admin_headers, json=payload, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("style", {}).get("title_color") == "#ff0066"
        TestPosterStyle.created_id = d["id"]

    def test_update_style_persists(self, admin_headers):
        pid = TestPosterStyle.created_id
        assert pid
        style = {"title_color": "#abcdef", "subtitle_color": "#111111",
                 "code_color": "#222222", "align": "center",
                 "title_pos": {"x": 0.1, "y": 0.1},
                 "card_pos": {"x": 0.9, "y": 0.9}}
        r = requests.put(f"{BASE}/api/admin/referral/posters/{pid}",
                         headers=admin_headers,
                         json={"name": "TEST_style_poster_v2", "active": True,
                               "sort": 55, "style": style}, timeout=30)
        assert r.status_code == 200, r.text
        rows = requests.get(f"{BASE}/api/admin/referral/posters",
                            headers=admin_headers, timeout=30).json()
        got = [x for x in rows if x["id"] == pid][0]
        assert got["style"]["title_color"] == "#abcdef"
        assert got["style"]["align"] == "center"
        assert got["style"]["card_pos"]["x"] == 0.9

    def test_cleanup(self, admin_headers):
        pid = TestPosterStyle.created_id
        if pid:
            r = requests.delete(f"{BASE}/api/admin/referral/posters/{pid}",
                                headers=admin_headers, timeout=30)
            assert r.status_code == 200
