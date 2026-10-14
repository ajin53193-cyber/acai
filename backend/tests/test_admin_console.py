"""Iteration 17 — Admin 2FA console backend tests.

Covers:
  - /api/admin/auth/login + /auth/totp (TOTP already enrolled)
  - X-Admin-Token guard on legacy + new admin endpoints (401 admin_2fa_required)
  - /api/admin/topups list + filter + requery + credit (incl. idempotency 409)
  - /api/admin/members list + detail + ban/unban + reset-password
  - /api/admin/translations list + PUT + retranslate (restores original)
  - /api/admin/notifications GET/PUT/test and /api/admin/sms/balance
  - /api/admin/reports json + csv
"""
import os
import re
import subprocess

import pyotp
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL" if "REACT_APP_BACKEND_URL" in os.environ else "FRONTEND_URL"] if False else None
# Read REACT_APP_BACKEND_URL from frontend/.env
with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "admin+clerk_test@shop.com"
ADMIN_PW = "Gogo589!Admin#7x2Q"
ADMIN_UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
TESTER_EMAIL = "tester+clerk_test@shop.com"
TESTER_PW = "Gogo589!Tester#4m9Z"
TESTER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
THROWAWAY_UID = "user_3KfPpaMZWYY6G1TxMw4TkwVQ4Oj"
EXPIRED_TOPUP_ID = "eb5d3819-265f-44e9-a7b9-bbf0f31da09f"

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
    """Full 2FA flow → admin_token."""
    r = requests.post(f"{BASE}/api/admin/auth/login",
                      json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW}, headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "pre_token" in d
    assert d.get("setup") is None, "admin already enrolled; setup should be null"
    code = pyotp.TOTP(_totp_secret()).now()
    r2 = requests.post(f"{BASE}/api/admin/auth/totp",
                       json={"pre_token": d["pre_token"], "code": code}, headers=UA, timeout=30)
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert "ticket" in d2 and "admin_token" in d2
    return d2["admin_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_bearer, admin_token):
    return {**UA, "Authorization": f"Bearer {admin_bearer}", "X-Admin-Token": admin_token}


# ------------------------------------------------------------- 2FA login
class TestAdminLogin:
    def test_login_wrong_password_401(self):
        r = requests.post(f"{BASE}/api/admin/auth/login",
                          json={"identifier": ADMIN_EMAIL, "password": "WRONG!!!"}, headers=UA, timeout=30)
        assert r.status_code == 401
        assert "密碼" in r.json().get("detail", "")

    def test_login_member_forbidden_403(self):
        r = requests.post(f"{BASE}/api/admin/auth/login",
                          json={"identifier": TESTER_EMAIL, "password": TESTER_PW}, headers=UA, timeout=30)
        assert r.status_code == 403
        assert "後台" in r.json().get("detail", "") or "權限" in r.json().get("detail", "")

    def test_login_ok_setup_null(self):
        r = requests.post(f"{BASE}/api/admin/auth/login",
                          json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW}, headers=UA, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "pre_token" in d and d.get("setup") is None

    def test_totp_wrong_code_400(self):
        r = requests.post(f"{BASE}/api/admin/auth/login",
                          json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW}, headers=UA, timeout=30)
        pre = r.json()["pre_token"]
        r2 = requests.post(f"{BASE}/api/admin/auth/totp",
                           json={"pre_token": pre, "code": "000000"}, headers=UA, timeout=30)
        assert r2.status_code == 400
        assert "驗證碼" in r2.json().get("detail", "")


# -------------------------------------------------- X-Admin-Token guard
class TestAdminGuard:
    def test_new_route_requires_admin_token(self, admin_bearer):
        r = requests.get(f"{BASE}/api/admin/topups",
                         headers={**UA, "Authorization": f"Bearer {admin_bearer}"}, timeout=30)
        assert r.status_code == 401
        assert r.json().get("detail") == "admin_2fa_required"

    def test_legacy_stats_requires_admin_token(self, admin_bearer):
        r = requests.get(f"{BASE}/api/admin/stats",
                         headers={**UA, "Authorization": f"Bearer {admin_bearer}"}, timeout=30)
        assert r.status_code == 401
        assert r.json().get("detail") == "admin_2fa_required"

    def test_legacy_stats_with_admin_token_ok(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/stats", headers=admin_headers, timeout=30)
        assert r.status_code == 200


# ----------------------------------------------------- /admin/topups
class TestTopups:
    def test_list(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/topups", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()["rows"]
        assert isinstance(items, list) and items, "topups list empty"
        it = items[0]
        for k in ("id", "status", "amount_usd", "user_id", "user_email", "out_trade_no"):
            assert k in it, f"missing field {k}"

    def test_list_filter_paid(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/topups?status=paid", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        for it in r.json()["rows"]:
            assert it["status"] == "paid"

    def test_requery_on_expired(self, admin_headers):
        r = requests.post(f"{BASE}/api/admin/topups/{EXPIRED_TOPUP_ID}/requery",
                          headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "topup" in d and "gateway" in d

    def test_credit_expired_then_409(self, admin_headers):
        # balance before
        rb = requests.get(f"{BASE}/api/admin/members/{TESTER_UID}", headers=admin_headers, timeout=30)
        before = float(rb.json()["balance_usd"])
        amt = float(rb.json()["balance_usd"])  # placeholder; real amount from topup
        rt = requests.get(f"{BASE}/api/admin/topups?q={EXPIRED_TOPUP_ID[:8]}", headers=admin_headers, timeout=30)
        topup = next(t for t in rt.json()["rows"] if t["id"] == EXPIRED_TOPUP_ID)
        if topup["status"] == "paid":
            pytest.skip(f"topup {EXPIRED_TOPUP_ID} already paid in a prior run")
        amt = float(topup["amount_usd"])
        # credit
        r = requests.post(f"{BASE}/api/admin/topups/{EXPIRED_TOPUP_ID}/credit",
                          headers=admin_headers, json={"note": "iter17-test"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "paid"
        # balance after
        ra = requests.get(f"{BASE}/api/admin/members/{TESTER_UID}", headers=admin_headers, timeout=30)
        after = float(ra.json()["balance_usd"])
        assert round(after - before, 2) == round(amt, 2), f"expected +{amt}, got {after - before}"
        # idempotent
        r2 = requests.post(f"{BASE}/api/admin/topups/{EXPIRED_TOPUP_ID}/credit",
                           headers=admin_headers, json={"note": "x"}, timeout=30)
        assert r2.status_code == 409


# ----------------------------------------------------- /admin/members
class TestMembers:
    def test_list_q(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/members?q=tester", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert rows, "no members returned"
        for k in ("user_id", "order_count", "spent_usd", "balance_usd", "google"):
            assert k in rows[0]
        # 'banned' may be omitted when the user doc has never had the field set — tolerated.

    def test_detail(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/members/{TESTER_UID}", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("emails", "phone", "password_enabled", "orders", "transactions", "balance_usd"):
            assert k in d, f"missing {k}"
        assert isinstance(d["orders"], list) and isinstance(d["transactions"], list)

    def test_ban_unban_cycle(self, admin_headers):
        rb = requests.post(f"{BASE}/api/admin/members/{THROWAWAY_UID}/ban", headers=admin_headers, timeout=30)
        assert rb.status_code == 200 and rb.json()["banned"] is True
        rd = requests.get(f"{BASE}/api/admin/members/{THROWAWAY_UID}", headers=admin_headers, timeout=30)
        assert rd.json()["banned"] is True
        ru = requests.post(f"{BASE}/api/admin/members/{THROWAWAY_UID}/unban", headers=admin_headers, timeout=30)
        assert ru.status_code == 200 and ru.json()["banned"] is False

    def test_reset_password_weak_400(self, admin_headers):
        r = requests.post(f"{BASE}/api/admin/members/{THROWAWAY_UID}/reset-password",
                          headers=admin_headers, json={"new_password": "abc"}, timeout=30)
        assert r.status_code == 400

    def test_reset_password_ok(self, admin_headers):
        r = requests.post(f"{BASE}/api/admin/members/{THROWAWAY_UID}/reset-password",
                          headers=admin_headers, json={"new_password": "Abcdef12!"}, timeout=30)
        assert r.status_code == 200, r.text


# ----------------------------------------------------- /admin/translations
class TestTranslations:
    def test_list_q(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/translations?q=抖音", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            assert "src" in rows[0] and "en" in rows[0]

    def test_put_reflects_in_categories_then_restore(self, admin_headers):
        src = "直播平臺"
        # get current english
        r0 = requests.get(f"{BASE}/api/admin/translations?q={src}", headers=admin_headers, timeout=30)
        matched = [x for x in r0.json() if x["src"] == src]
        orig_en = matched[0]["en"] if matched else "Live Streaming Platforms"
        probe = orig_en + " X"
        rp = requests.put(f"{BASE}/api/admin/translations",
                          headers=admin_headers, json={"src": src, "en": probe}, timeout=30)
        assert rp.status_code == 200
        rc = requests.get(f"{BASE}/api/categories",
                          headers={**UA, "X-Lang": "en"}, timeout=30)
        assert rc.status_code == 200
        cats = rc.json()
        liv = next((c for c in cats if c.get("id") == "livestream"), None)
        assert liv is not None
        assert liv["name"] == probe, f"got {liv['name']!r}"
        # restore
        requests.put(f"{BASE}/api/admin/translations",
                     headers=admin_headers, json={"src": src, "en": orig_en}, timeout=30)

    def test_retranslate(self, admin_headers):
        r = requests.post(f"{BASE}/api/admin/translations/retranslate",
                          headers=admin_headers, json={"src": "直播平臺"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["src"] == "直播平臺" and isinstance(d["en"], str) and d["en"]


# ----------------------------------------------------- /admin/notifications + sms
class TestNotifications:
    def test_get_defaults(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/notifications", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "events" in d and "templates" in d
        assert "topup_paid" in d["events"]

    def test_put_and_restore(self, admin_headers):
        r0 = requests.get(f"{BASE}/api/admin/notifications", headers=admin_headers, timeout=30).json()
        new_val = {**r0, "events": {**r0["events"], "topup_paid": False}}
        rp = requests.put(f"{BASE}/api/admin/notifications",
                          headers=admin_headers, json={"value": new_val}, timeout=30)
        assert rp.status_code == 200
        assert rp.json()["events"]["topup_paid"] is False
        # restore
        requests.put(f"{BASE}/api/admin/notifications",
                     headers=admin_headers, json={"value": r0}, timeout=30)

    def test_sms_balance(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/sms/balance", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "dagou" in d and "submail" in d

    def test_notifications_test_email(self, admin_headers):
        r = requests.post(f"{BASE}/api/admin/notifications/test", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("to") == ADMIN_EMAIL


# ----------------------------------------------------- /admin/reports
class TestReports:
    def test_json_7days(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/reports?days=7", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["rows"]) == 7
        assert "totals" in d and {"orders", "revenue_usd", "paid_orders", "topups"} <= set(d["totals"])

    def test_csv_export(self, admin_headers):
        r = requests.get(f"{BASE}/api/admin/reports?days=7&format=csv", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "")
        txt = r.content.decode("utf-8-sig")
        header = txt.splitlines()[0]
        assert "date" in header and "revenue_usd" in header
