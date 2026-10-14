"""
Iteration 15: Multi-language (zh-CN / zh-TW / en) + 18-currency FX regression tests.
Covers:
  - GET /api/currencies (18 currencies, USD first, rate_to_usd present)
  - GET /api/categories with X-Lang: en / zh-CN / none (traditional default)
  - GET /api/products?q=... (English and Simplified search)
  - GET /api/i18n/stats
  - POST /api/cron/refresh-rates (auth, duplicate-webhook-id, rate_updated_at)
  - Admin: GET /api/admin/currencies, PUT manual-override + POST refresh preservation
"""
import os
import subprocess
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
CRON_SECRET = os.environ["WEBHOOK_CRON_SECRET"]
ADMIN_UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
UA = {"User-Agent": "iter15-test/1.0"}


@pytest.fixture(scope="session")
def admin_token():
    out = subprocess.check_output(["python", "/app/tests/mint_token.py", ADMIN_UID], text=True).strip()
    return out.splitlines()[-1]


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return {**UA, "Authorization": f"Bearer {admin_token}"}


# -------------------------- Currencies --------------------------
class TestCurrencies:
    def test_list_18_sorted_usd_first(self):
        r = requests.get(f"{BASE}/api/currencies", headers=UA, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 18, f"expected 18 currencies got {len(data)}: {[c['code'] for c in data]}"
        assert data[0]["code"] == "USD"
        codes = {c["code"] for c in data}
        for req in ["USD", "CNY", "SGD", "MYR", "THB", "KRW", "AUD", "CAD", "PHP", "IDR", "VND", "INR", "AED"]:
            assert req in codes, f"missing currency {req}"
        for c in data:
            assert "rate_to_usd" in c and isinstance(c["rate_to_usd"], (int, float))
            assert c.get("active") is True


# -------------------------- Categories localization --------------------------
class TestCategoriesI18n:
    def test_english_categories(self):
        r = requests.get(f"{BASE}/api/categories", headers={**UA, "X-Lang": "en"}, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        names = [c["name"] for c in rows]
        joined = " | ".join(names)
        # at least a couple of English names should appear
        assert any(n.isascii() and len(n) > 2 for n in names), f"no english names found: {joined}"

    def test_simplified_categories(self):
        r = requests.get(f"{BASE}/api/categories", headers={**UA, "X-Lang": "zh-CN"}, timeout=20)
        assert r.status_code == 200
        names = [c["name"] for c in r.json()]
        # simplified has 游 (not 遊) and 直播 (same). Look for simplification diff
        assert any("游戏" in n for n in names), f"expected simplified 游戏 in {names}"
        assert not any("遊戲" in n for n in names), f"traditional 遊戲 leaked into zh-CN: {names}"

    def test_default_traditional_categories(self):
        r = requests.get(f"{BASE}/api/categories", headers=UA, timeout=20)
        assert r.status_code == 200
        names = [c["name"] for c in r.json()]
        assert any("遊戲" in n or "平臺" in n for n in names), f"expected traditional names in default: {names}"


# -------------------------- Products search --------------------------
class TestProductsSearch:
    def test_search_english_douyin(self):
        r = requests.get(f"{BASE}/api/products", params={"q": "douyin"}, headers={**UA, "X-Lang": "en"}, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) > 0, "english 'douyin' search returned no results"

    def test_search_simplified_douyin(self):
        r = requests.get(f"{BASE}/api/products", params={"q": "抖音"}, headers={**UA, "X-Lang": "zh-CN"}, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) > 0, "simplified '抖音' search returned no results (DB names are traditional)"


# -------------------------- i18n stats --------------------------
class TestI18nStats:
    def test_stats_shape(self):
        r = requests.get(f"{BASE}/api/i18n/stats", headers=UA, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "cached" in d and "pending" in d
        assert isinstance(d["cached"], int) and isinstance(d["pending"], int)


# -------------------------- Cron refresh-rates --------------------------
class TestCronRefreshRates:
    def test_wrong_bearer_401(self):
        r = requests.post(f"{BASE}/api/cron/refresh-rates", headers={**UA, "Authorization": "Bearer wrong"}, timeout=10)
        assert r.status_code == 401

    def test_missing_bearer_401(self):
        r = requests.post(f"{BASE}/api/cron/refresh-rates", headers=UA, timeout=10)
        assert r.status_code == 401

    def test_valid_cron_ok_and_duplicate(self):
        wid = f"iter15-test-{int(time.time())}"
        h = {**UA, "Authorization": f"Bearer {CRON_SECRET}", "X-Webhook-Id": wid}
        r1 = requests.post(f"{BASE}/api/cron/refresh-rates", headers=h, timeout=15)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("ok") is True
        assert not d1.get("duplicate")
        # Replay same webhook id
        r2 = requests.post(f"{BASE}/api/cron/refresh-rates", headers=h, timeout=15)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2.get("ok") is True
        assert d2.get("duplicate") is True

    def test_rate_updated_at_after_refresh(self):
        # Trigger cron, give the background task some time, then check currencies
        wid = f"iter15-test-upd-{int(time.time())}"
        h = {**UA, "Authorization": f"Bearer {CRON_SECRET}", "X-Webhook-Id": wid}
        requests.post(f"{BASE}/api/cron/refresh-rates", headers=h, timeout=15)
        time.sleep(6)
        r = requests.get(f"{BASE}/api/currencies", headers=UA, timeout=20)
        cur = r.json()
        with_ts = [c for c in cur if c.get("rate_updated_at")]
        assert len(with_ts) >= 10, f"expected most currencies to have rate_updated_at, got {len(with_ts)}/{len(cur)}"


# -------------------------- Admin currency management --------------------------
class TestAdminCurrencies:
    def test_admin_list(self, admin_h):
        r = requests.get(f"{BASE}/api/admin/currencies", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert len(rows) == 18
        # auto_rate may be missing on legacy-seeded USD (treated as true); don't hard-fail
        missing = [c["code"] for c in rows if "auto_rate" not in c]
        print(f"currencies missing auto_rate field: {missing}")

    def test_manual_override_survives_refresh(self, admin_h):
        # PUT CNY with manual rate 7.5 and auto_rate=false
        body = {
            "code": "CNY", "symbol": "¥", "name": "人民幣", "flag": "🇨🇳",
            "rate_to_usd": 7.5, "active": True, "auto_rate": False, "sort_order": 1,
        }
        r = requests.put(f"{BASE}/api/admin/currencies/CNY", headers=admin_h, json=body, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rate_to_usd"] == 7.5
        assert d["auto_rate"] is False
        try:
            # Trigger admin refresh (synchronous)
            rr = requests.post(f"{BASE}/api/admin/currencies/refresh", headers=admin_h, timeout=30)
            assert rr.status_code == 200, rr.text
            # verify CNY stays at 7.5
            lst = requests.get(f"{BASE}/api/admin/currencies", headers=admin_h, timeout=15).json()
            cny = next(c for c in lst if c["code"] == "CNY")
            assert cny["rate_to_usd"] == 7.5, f"manual CNY override lost after refresh: {cny}"
            # at least one auto currency has rate_updated_at set
            others = [c for c in lst if c["code"] != "CNY" and c.get("rate_updated_at")]
            assert len(others) > 0, "no auto currencies updated"
        finally:
            # Restore CNY auto
            body["auto_rate"] = True
            requests.put(f"{BASE}/api/admin/currencies/CNY", headers=admin_h, json=body, timeout=15)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
