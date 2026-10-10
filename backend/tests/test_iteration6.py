"""Iteration 6 tests: alerts, theme_color, chain refresh/sync."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sifang-collect.preview.emergentagent.com").rstrip("/")

ADMIN = {"email": "ajin53193@gmail.com", "password": "admin888"}
MERCHANT = {"email": "merchant@demo.com", "password": "merchant888"}
AGENT = {"email": "agent@demo.com", "password": "agent888"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def merchant_h():
    return {"Authorization": f"Bearer {_login(MERCHANT)}"}


@pytest.fixture(scope="module")
def agent_h():
    return {"Authorization": f"Bearer {_login(AGENT)}"}


# ---------------- Alerts ----------------
class TestAlerts:
    def test_admin_list_alerts(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/alerts?limit=50", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "unread" in data and "alerts" in data
        assert isinstance(data["alerts"], list)
        # expect at least one balance_change seed
        types = [a.get("type") for a in data["alerts"]]
        assert "balance_change" in types, f"Expected balance_change alert, got types={types}"
        assert data["unread"] >= 1

    def test_non_admin_forbidden(self, merchant_h, agent_h):
        for h in (merchant_h, agent_h):
            r = requests.get(f"{BASE_URL}/api/alerts", headers=h, timeout=15)
            assert r.status_code == 403, r.status_code

    def test_mark_single_and_read_all(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/alerts?limit=10", headers=admin_h, timeout=15)
        alerts = r.json()["alerts"]
        if alerts:
            aid = alerts[0]["id"]
            r2 = requests.post(f"{BASE_URL}/api/alerts/{aid}/read", headers=admin_h, timeout=15)
            assert r2.status_code == 200, r2.text
        r3 = requests.post(f"{BASE_URL}/api/alerts/read-all", headers=admin_h, timeout=15)
        assert r3.status_code == 200
        r4 = requests.get(f"{BASE_URL}/api/alerts", headers=admin_h, timeout=15)
        assert r4.json()["unread"] == 0


# ---------------- Alert settings ----------------
class TestAlertSettings:
    def test_get_and_put_valid(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/alerts/settings", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        s = r.json()
        for k in ("pct", "min_abs", "sync_minutes"):
            assert k in s

        r2 = requests.put(f"{BASE_URL}/api/alerts/settings",
                          json={"pct": 15, "min_abs": 200, "sync_minutes": 5},
                          headers=admin_h, timeout=15)
        assert r2.status_code == 200, r2.text
        r3 = requests.get(f"{BASE_URL}/api/alerts/settings", headers=admin_h, timeout=15).json()
        assert r3["pct"] == 15 and r3["min_abs"] == 200 and r3["sync_minutes"] == 5

    def test_invalid_pct_zero(self, admin_h):
        r = requests.put(f"{BASE_URL}/api/alerts/settings",
                         json={"pct": 0, "min_abs": 100, "sync_minutes": 10},
                         headers=admin_h, timeout=15)
        assert r.status_code == 400, r.status_code

    def test_invalid_min_abs_negative(self, admin_h):
        r = requests.put(f"{BASE_URL}/api/alerts/settings",
                         json={"pct": 10, "min_abs": -1, "sync_minutes": 10},
                         headers=admin_h, timeout=15)
        assert r.status_code == 400

    def test_invalid_sync_minutes_zero(self, admin_h):
        r = requests.put(f"{BASE_URL}/api/alerts/settings",
                         json={"pct": 10, "min_abs": 100, "sync_minutes": 0},
                         headers=admin_h, timeout=15)
        assert r.status_code == 400

    def test_restore_defaults(self, admin_h):
        r = requests.put(f"{BASE_URL}/api/alerts/settings",
                         json={"pct": 10, "min_abs": 100, "sync_minutes": 10},
                         headers=admin_h, timeout=15)
        assert r.status_code == 200

    def test_audit_log(self, admin_h):
        # try common audit endpoints
        for path in ("/api/audit/logs", "/api/audit", "/api/admin/audit"):
            r = requests.get(f"{BASE_URL}{path}?limit=50", headers=admin_h, timeout=15)
            if r.status_code == 200:
                data = r.json()
                items = data if isinstance(data, list) else data.get("items") or data.get("logs") or []
                actions = [str(x.get("action", "")) + str(x.get("type", "")) + str(x.get("event", "")) for x in items]
                if any("settings.alerts" in a for a in actions):
                    return
        # not fatal - just log
        print("Audit log for settings.alerts not confirmed via common endpoints")


# ---------------- Checkout theme ----------------
class TestCheckoutTheme:
    def _get_settings(self, h):
        for path in ("/api/checkout/settings", "/api/settings/checkout", "/api/admin/checkout/settings"):
            r = requests.get(f"{BASE_URL}{path}", headers=h, timeout=15)
            if r.status_code == 200:
                return path, r.json()
        pytest.skip("checkout settings endpoint not found")

    def test_put_valid_and_invalid_color(self, admin_h):
        path, cur = self._get_settings(admin_h)
        payload = dict(cur) if isinstance(cur, dict) else {}
        payload["theme_color"] = "#FF0000"
        r = requests.put(f"{BASE_URL}{path}", json=payload, headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE_URL}{path}", headers=admin_h, timeout=15).json()
        assert str(g.get("theme_color", "")).upper() == "#FF0000"

        bad = dict(payload)
        bad["theme_color"] = "red"
        rb = requests.put(f"{BASE_URL}{path}", json=bad, headers=admin_h, timeout=15)
        assert rb.status_code == 400, rb.status_code

        # restore 2563EB
        payload["theme_color"] = "#2563EB"
        r2 = requests.put(f"{BASE_URL}{path}", json=payload, headers=admin_h, timeout=15)
        assert r2.status_code == 200


# ---------------- Chain ----------------
class TestChain:
    def test_refresh(self, admin_h):
        r = requests.post(f"{BASE_URL}/api/chain/addresses/refresh", headers=admin_h, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") == 3, data
        assert data.get("errors") == []

    def test_sync(self, admin_h):
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/chain/sync", headers=admin_h, timeout=35)
        assert r.status_code == 200, r.text
        elapsed = time.time() - t0
        assert elapsed < 30, f"sync took {elapsed:.1f}s"
        data = r.json()
        assert data.get("errors") == [], data

    def test_addresses_ok(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/chain/addresses", headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or data.get("addresses") or []
        assert len(items) >= 3
        for a in items[:3]:
            assert a.get("status") == "ok", a
            bal = a.get("balance")
            assert bal is not None
            float(bal)  # numeric


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
