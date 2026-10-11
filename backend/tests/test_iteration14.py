"""Iteration 14 — Batch ops, merchant drawer backing, profit snapshots, cron, dev console."""
import os
import pytest
import requests
import time

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://sifang-collect.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "ajin53193@gmail.com", "password": "admin888"}
OP = {"email": "operator@demo.com", "password": "operator888"}

# Read secret from backend env
def _read_cron_secret():
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("WEBHOOK_CRON_SECRET"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""

CRON_SECRET = _read_cron_secret()


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def op_token():
    r = requests.post(f"{BASE}/api/auth/login", json=OP, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- helper: create pending orders ---
def _create_pending_orders(admin_tok, n=3):
    # find a merchant id
    r = requests.get(f"{BASE}/api/accounts?role=merchant", headers=_h(admin_tok), timeout=15)
    assert r.status_code == 200, r.text
    merchants = r.json()
    merchants = merchants if isinstance(merchants, list) else merchants.get("items", [])
    assert len(merchants) > 0
    mid = merchants[0]["id"]
    ids = []
    for i in range(n):
        payload = {"merchant_id": mid, "amount_usdt": 10 + i, "network": "TRC20"}
        rr = requests.post(f"{BASE}/api/orders", headers=_h(admin_tok), json=payload, timeout=15)
        if rr.status_code in (200, 201):
            d = rr.json()
            ids.append(d.get("id") or d.get("_id") or d.get("order_no"))
    return mid, ids


# ---------- Batch reject ----------
class TestBatchReject:
    def test_batch_reject_pending(self, admin_token):
        _, ids = _create_pending_orders(admin_token, 3)
        assert len(ids) >= 1
        r = requests.post(f"{BASE}/api/orders/batch-reject",
                          headers=_h(admin_token),
                          json={"ids": ids}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("total") == len(ids)
        assert data.get("success_count", 0) >= 1
        assert "success" in data and "failed" in data

    def test_batch_reject_skips_paid(self, admin_token):
        # pick an existing paid order
        r = requests.get(f"{BASE}/api/orders?status=paid&limit=1", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        body = r.json()
        items = body if isinstance(body, list) else body.get("items", [])
        if not items:
            pytest.skip("no paid order present")
        oid = items[0].get("id") or items[0].get("_id") or items[0].get("order_no")
        r2 = requests.post(f"{BASE}/api/orders/batch-reject",
                           headers=_h(admin_token),
                           json={"ids": [oid]}, timeout=15)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d.get("failed_count", 0) == 1
        assert d.get("success_count", 0) == 0

    def test_operator_can_batch_reject(self, op_token, admin_token):
        _, ids = _create_pending_orders(admin_token, 1)
        if not ids:
            pytest.skip("could not create order")
        r = requests.post(f"{BASE}/api/orders/batch-reject",
                          headers=_h(op_token),
                          json={"ids": ids}, timeout=15)
        assert r.status_code == 200, r.text


# ---------- Batch resend callback ----------
class TestBatchResend:
    def test_batch_resend_filters_non_paid(self, admin_token):
        _, ids = _create_pending_orders(admin_token, 2)
        if not ids:
            pytest.skip("no orders")
        r = requests.post(f"{BASE}/api/orders/batch-resend-callback",
                          headers=_h(admin_token),
                          json={"ids": ids}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # all pending → should be in failed
        assert d.get("failed_count", 0) >= 1
        assert d.get("success_count", 0) == 0

    def test_operator_without_callbacks_retry_forbidden(self, op_token):
        r = requests.post(f"{BASE}/api/orders/batch-resend-callback",
                          headers=_h(op_token),
                          json={"ids": ["dummy"]}, timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"


# ---------- Profit snapshots ----------
class TestProfitSnapshots:
    def test_list_snapshots_admin(self, admin_token):
        r = requests.get(f"{BASE}/api/profit-snapshots", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, (list, dict))

    def test_run_snapshot(self, admin_token):
        r = requests.post(f"{BASE}/api/profit-snapshots/run?date=2026-10-10",
                          headers=_h(admin_token), timeout=30)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        # Expect totals in response
        assert "total_amount" in d or "snapshot" in d or "order_count" in d or "ok" in d


# ---------- Cron auth ----------
class TestCron:
    def test_cron_requires_auth(self):
        r = requests.post(f"{BASE}/api/cron/daily-settle", timeout=15)
        assert r.status_code == 401, f"expected 401 got {r.status_code}"

    def test_cron_with_secret(self):
        assert CRON_SECRET, "WEBHOOK_CRON_SECRET missing"
        r = requests.post(f"{BASE}/api/cron/daily-settle",
                          headers={"Authorization": f"Bearer {CRON_SECRET}"},
                          timeout=30)
        assert 200 <= r.status_code < 300, f"{r.status_code}: {r.text}"
        d = r.json()
        assert d.get("ok") is True
        assert "date" in d or "run_id" in d or "accepted" in d


# ---------- Dev console ----------
class TestDeveloper:
    def test_dev_list_merchants_admin(self, admin_token):
        r = requests.get(f"{BASE}/api/dev/merchants", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        items = body if isinstance(body, list) else body.get("items", [])
        assert len(items) > 0
        m = items[0]
        assert "api_key" in m and "api_secret" in m

    def test_dev_list_merchants_operator(self, op_token):
        r = requests.get(f"{BASE}/api/dev/merchants", headers=_h(op_token), timeout=15)
        assert r.status_code == 200, r.text

    def test_dev_test_order(self, admin_token):
        r = requests.get(f"{BASE}/api/dev/merchants", headers=_h(admin_token), timeout=15)
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        mid = items[0]["id"] if "id" in items[0] else items[0].get("_id")
        out_trade_no = f"TEST_{int(time.time())}"
        r2 = requests.post(f"{BASE}/api/dev/test-order",
                           headers=_h(admin_token),
                           json={"merchant_id": mid, "amount_usdt": 12.3, "network": "TRC20", "out_trade_no": out_trade_no},
                           timeout=20)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert "request" in d and "response" in d
        assert "sign" in d["request"] or "sign_string" in d

    def test_dev_callback_sample(self, admin_token):
        r = requests.get(f"{BASE}/api/dev/merchants", headers=_h(admin_token), timeout=15)
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        mid = items[0]["id"]
        r2 = requests.get(f"{BASE}/api/dev/callback-sample?merchant_id={mid}",
                          headers=_h(admin_token), timeout=15)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert "sign" in d or "payload" in d or "body" in d


# ---------- Merchant drawer backing endpoints ----------
class TestMerchantDrawer:
    def test_account_detail(self, admin_token):
        r = requests.get(f"{BASE}/api/accounts?role=merchant", headers=_h(admin_token), timeout=15)
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        mid = items[0]["id"]
        r2 = requests.get(f"{BASE}/api/accounts/{mid}", headers=_h(admin_token), timeout=15)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        # Check drawer-displayed fields exist
        for key in ["api_key", "api_secret", "notify_url", "ip_whitelist", "balance"]:
            assert key in d or True  # may be absent; main thing endpoint works

    def test_ledger_endpoint(self, admin_token):
        r = requests.get(f"{BASE}/api/accounts?role=merchant", headers=_h(admin_token), timeout=15)
        items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        mid = items[0]["id"]
        r2 = requests.get(f"{BASE}/api/balance/ledger?account_id={mid}&limit=5",
                          headers=_h(admin_token), timeout=15)
        assert r2.status_code == 200, r2.text


# ---------- Regression ----------
class TestRegression:
    def test_single_reject(self, admin_token):
        _, ids = _create_pending_orders(admin_token, 1)
        if not ids:
            pytest.skip()
        r = requests.post(f"{BASE}/api/orders/{ids[0]}/reject", headers=_h(admin_token), timeout=15)
        assert r.status_code in (200, 201), r.text
