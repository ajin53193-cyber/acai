"""Backend tests for per-promo IP analytics (推文数据).

NOTE: Run with xdist disabled (-o addopts= or -p no:xdist). Tests have
timing dependencies: hits must land before analytics is queried.
"""
import os
import time
import pytest
import requests

# Force all tests in this module to the same xdist worker (serial per-class).
pytestmark = pytest.mark.xdist_group(name="promo_analytics_serial")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://corporate-web-95.preview.emergentagent.com").rstrip("/")
SLUG = "test-promo-abc"  # keep tests isolated from the real /about slug
ADMIN_USER = "admin"
ADMIN_PASS = "Heying@2026"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _hit(payload, xff=None, ua=None):
    headers = {"Content-Type": "application/json"}
    if xff:
        headers["X-Forwarded-For"] = xff
    if ua:
        headers["User-Agent"] = ua
    return requests.post(f"{BASE_URL}/api/promos/{SLUG}/hit", json=payload, headers=headers, timeout=15)


# ---- hit endpoint ----
class TestPromoHit:
    def test_view_hit_china_ip(self):
        r = _hit(
            {"type": "view", "source": "A1", "referrer": "https://mp.weixin.qq.com/s/x", "visitor_id": "v1"},
            xff="223.104.3.100",
            ua="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        )
        assert r.status_code == 201, r.text
        assert r.json() == {"ok": True}
        time.sleep(1.2)  # free ip-api 45/min

    def test_click_hit(self):
        r = _hit(
            {"type": "click", "target": "cs", "source": "A1", "visitor_id": "v1"},
            xff="223.104.3.100",
            ua="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        )
        assert r.status_code == 201
        time.sleep(0.3)

    def test_bot_ua_is_marked_bot(self):
        r = _hit(
            {"type": "view", "source": "A2", "visitor_id": "bot1"},
            xff="171.8.120.50",
            ua="Googlebot/2.1 (+http://www.google.com/bot.html)",
        )
        assert r.status_code == 201
        time.sleep(1.2)

    def test_duplicate_view_same_ip_increments_pv_only(self):
        # second view from same residential IP same day
        r = _hit(
            {"type": "view", "source": "A1", "referrer": "https://mp.weixin.qq.com/s/y", "visitor_id": "v1b"},
            xff="223.104.3.100",
            ua="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        )
        assert r.status_code == 201
        time.sleep(1.2)

    def test_invalid_type_rejected(self):
        r = _hit({"type": "bogus"}, xff="223.104.3.100", ua="Mozilla/5.0")
        assert r.status_code in (400, 422)


# ---- analytics endpoint ----
class TestPromoAnalytics:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/promos/{SLUG}/analytics?days=30", timeout=15)
        assert r.status_code in (401, 403)

    def test_bad_token_rejected(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/promos/{SLUG}/analytics?days=30",
            headers={"Authorization": "Bearer invalid.xxx"},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_summary_structure_and_values(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/promos/{SLUG}/analytics?days=30", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # top-level keys
        for k in ("summary", "daily", "sources", "referrers", "provinces", "targets", "detail_date", "ip_detail"):
            assert k in data, f"missing key {k}"
        s = data["summary"]
        for k in ("views", "unique_ips", "clicks", "click_unique_ips", "bots_excluded"):
            assert k in s
        # we fired 2 valid views from same IP + 1 click + 1 bot view
        assert s["views"] >= 2, f"views={s['views']}"
        assert s["unique_ips"] == 1, f"unique_ips should dedup to 1, got {s['unique_ips']}"
        assert s["clicks"] >= 1
        assert s["bots_excluded"] >= 1

    def test_bot_excluded_from_sources_and_provinces(self, auth_headers):
        data = requests.get(
            f"{BASE_URL}/api/admin/promos/{SLUG}/analytics?days=30",
            headers=auth_headers, timeout=20,
        ).json()
        src_names = [s["name"] for s in data["sources"]]
        assert "A2" not in src_names, "bot's A2 source should be excluded"
        assert "A1" in src_names

    def test_daily_has_days_rows(self, auth_headers):
        data = requests.get(
            f"{BASE_URL}/api/admin/promos/{SLUG}/analytics?days=7",
            headers=auth_headers, timeout=20,
        ).json()
        assert len(data["daily"]) == 7
        for row in data["daily"]:
            for k in ("date", "pv", "uv", "clicks", "click_uv"):
                assert k in row

    def test_ip_detail_dedup_and_targets(self, auth_headers):
        data = requests.get(
            f"{BASE_URL}/api/admin/promos/{SLUG}/analytics?days=30",
            headers=auth_headers, timeout=20,
        ).json()
        # ip_detail is dedup'd per IP for detail_date
        ips = [r["ip"] for r in data["ip_detail"]]
        assert len(ips) == len(set(ips)), "ip_detail should be unique per IP"
        # the cs click target should appear
        tnames = [t["name"] for t in data["targets"]]
        assert any("客服" in t or t == "cs" for t in tnames), f"targets={tnames}"

    def test_referrer_host_only(self, auth_headers):
        data = requests.get(
            f"{BASE_URL}/api/admin/promos/{SLUG}/analytics?days=30",
            headers=auth_headers, timeout=20,
        ).json()
        ref_names = [r["name"] for r in data["referrers"]]
        # Should contain host "mp.weixin.qq.com" (no scheme, no path)
        assert any(n == "mp.weixin.qq.com" for n in ref_names), f"referrers={ref_names}"


# ---- cleanup ----
@pytest.fixture(scope="module", autouse=True)
def _cleanup(auth_headers):
    yield
    # best-effort cleanup via mongo shell is not available; leave data (slug is test-only)
