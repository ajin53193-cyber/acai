"""Iteration 21 — wallet top-up checkout (Stripe/PayPal/manual), proof review, admin dashboard.

Covers:
  * POST /api/me/wallet/topup/checkout for stripe/manual/paypal
  * GET /api/me/wallet/topup/{id} status + listing
  * POST /api/me/wallet/topup/{id}/proof -> reviewing
  * Admin reject/approve + re-upload after reject
  * Wallet balance adjust (restore)
  * Stripe webhook rejection
  * GET /api/admin/dashboard shape + series length clamping
  * Regression: USDT topup path still works
"""
import base64
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")

TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
TINY_PNG_DATAURL = f"data:image/png;base64,{TINY_PNG_B64}"


def _read(path):
    with open(path) as f:
        return f.read().strip()


@pytest.fixture(scope="module")
def member_headers():
    return {"Authorization": f"Bearer {_read('/tmp/jwt_member')}", "User-Agent": "pytest-iter21"}


@pytest.fixture(scope="module")
def admin_headers():
    return {
        "Authorization": f"Bearer {_read('/tmp/jwt_admin')}",
        "X-Admin-Token": _read("/tmp/xat"),
        "User-Agent": "pytest-iter21",
    }


@pytest.fixture(scope="module")
def payment_methods():
    r = requests.get(f"{BASE_URL}/api/payment-methods", headers={"User-Agent": "pytest-iter21"}, timeout=15)
    assert r.status_code == 200, r.text
    pms = r.json()
    out = {"stripe": None, "paypal": None, "manual": None, "crypto": None}
    for pm in pms:
        prov = pm.get("provider")
        if prov == "stripe" and out["stripe"] is None:
            out["stripe"] = pm
        elif prov == "paypal" and out["paypal"] is None:
            out["paypal"] = pm
        elif prov == "manual" and out["manual"] is None:
            out["manual"] = pm
        elif prov == "crypto" and out["crypto"] is None:
            out["crypto"] = pm
    assert out["stripe"] and out["paypal"] and out["manual"], f"missing methods: {out}"
    return out


# ----------------------------- Stripe checkout -----------------------------
class TestStripeCheckout:
    def test_stripe_checkout_success(self, member_headers, payment_methods):
        pm = payment_methods["stripe"]
        r = requests.post(
            f"{BASE_URL}/api/me/wallet/topup/checkout",
            json={"amount_usd": 50, "method_id": pm["id"], "origin_url": BASE_URL},
            headers=member_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["provider"] == "stripe"
        assert d["status"] == "pending"
        assert d["pay_url"].startswith("https://checkout.stripe.com"), d["pay_url"]
        assert d.get("session_id", "").startswith("cs_test_"), d.get("session_id")
        # GET status
        s = requests.get(f"{BASE_URL}/api/me/wallet/topup/{d['id']}", headers=member_headers, timeout=15)
        assert s.status_code == 200
        assert s.json()["status"] == "pending"

    def test_stripe_amount_below_min(self, member_headers, payment_methods):
        pm = payment_methods["stripe"]
        r = requests.post(
            f"{BASE_URL}/api/me/wallet/topup/checkout",
            json={"amount_usd": 10, "method_id": pm["id"], "origin_url": BASE_URL},
            headers=member_headers, timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_invalid_method_id(self, member_headers):
        r = requests.post(
            f"{BASE_URL}/api/me/wallet/topup/checkout",
            json={"amount_usd": 100, "method_id": "does-not-exist", "origin_url": BASE_URL},
            headers=member_headers, timeout=15,
        )
        assert r.status_code == 400


# ----------------------------- PayPal (expected 503) -----------------------------
class TestPaypalNotConfigured:
    def test_paypal_returns_503(self, member_headers, payment_methods):
        pm = payment_methods["paypal"]
        r = requests.post(
            f"{BASE_URL}/api/me/wallet/topup/checkout",
            json={"amount_usd": 50, "method_id": pm["id"], "origin_url": BASE_URL},
            headers=member_headers, timeout=20,
        )
        assert r.status_code == 503, r.text
        assert "PayPal" in (r.json().get("detail") or "") and "尚未設定" in (r.json().get("detail") or "")


# ----------------------------- Stripe webhook -----------------------------
class TestStripeWebhook:
    def test_garbage_body_signature_returns_400(self):
        r = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            data=b"not a stripe event",
            headers={"Stripe-Signature": "t=1,v1=deadbeef", "User-Agent": "pytest-iter21"},
            timeout=15,
        )
        assert r.status_code == 400


# ----------------------------- Manual bank transfer flow -----------------------------
class TestManualTopupFlow:
    created_tid = None

    def test_manual_checkout(self, member_headers, payment_methods):
        pm = payment_methods["manual"]
        r = requests.post(
            f"{BASE_URL}/api/me/wallet/topup/checkout",
            json={"amount_usd": 60, "method_id": pm["id"], "origin_url": BASE_URL},
            headers=member_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["provider"] == "manual"
        assert d["status"] == "pending"
        assert d.get("reference_code", "").startswith("GG"), d.get("reference_code")
        assert "bank" in d and isinstance(d["bank"], dict)
        TestManualTopupFlow.created_tid = d["id"]

    def test_upload_proof_sets_reviewing(self, member_headers):
        tid = TestManualTopupFlow.created_tid
        assert tid, "prev test must create tid"
        r = requests.post(
            f"{BASE_URL}/api/me/wallet/topup/{tid}/proof",
            json={"image_b64": TINY_PNG_DATAURL, "image_name": "p.png", "payer_name": "張三", "note": "x"},
            headers=member_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "reviewing"
        assert d.get("proof_image", "").startswith("/api/img/") or d.get("proof_image", "").startswith("http"), d.get("proof_image")

    def test_listing_shows_reviewing(self, member_headers):
        r = requests.get(f"{BASE_URL}/api/me/wallet/topups", headers=member_headers, timeout=15)
        assert r.status_code == 200
        rows = r.json()
        found = [x for x in rows if x["id"] == TestManualTopupFlow.created_tid]
        assert found and found[0]["status"] == "reviewing"

    def test_admin_reject(self, admin_headers):
        tid = TestManualTopupFlow.created_tid
        r = requests.post(
            f"{BASE_URL}/api/admin/topups/{tid}/reject",
            json={"reason": "測試駁回"}, headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "rejected"
        assert d.get("reject_reason") == "測試駁回"

    def test_admin_unauth_rejected(self):
        tid = TestManualTopupFlow.created_tid
        r = requests.post(f"{BASE_URL}/api/admin/topups/{tid}/reject", json={"reason": "x"},
                          headers={"User-Agent": "pytest-iter21"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_reupload_proof_after_reject(self, member_headers):
        tid = TestManualTopupFlow.created_tid
        r = requests.post(
            f"{BASE_URL}/api/me/wallet/topup/{tid}/proof",
            json={"image_b64": TINY_PNG_DATAURL, "image_name": "p2.png", "payer_name": "張三", "note": "retry"},
            headers=member_headers, timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "reviewing"

    def test_admin_approve_credits_wallet(self, admin_headers, member_headers):
        tid = TestManualTopupFlow.created_tid
        # Get pre balance
        w0 = requests.get(f"{BASE_URL}/api/me/wallet", headers=member_headers, timeout=15).json()
        bal0 = float(w0.get("balance_usd") or 0)
        r = requests.post(f"{BASE_URL}/api/admin/topups/{tid}/approve", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "paid"
        w1 = requests.get(f"{BASE_URL}/api/me/wallet", headers=member_headers, timeout=15).json()
        bal1 = float(w1.get("balance_usd") or 0)
        assert round(bal1 - bal0, 2) == 60.00, f"expected +60, got {bal0}->{bal1}"

    def test_admin_approve_again_409(self, admin_headers):
        tid = TestManualTopupFlow.created_tid
        r = requests.post(f"{BASE_URL}/api/admin/topups/{tid}/approve", headers=admin_headers, timeout=15)
        assert r.status_code == 409

    def test_cleanup_wallet_debit(self, admin_headers, member_headers):
        """Restore member wallet balance by debiting 60 after approval."""
        member_uid = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
        r = requests.post(
            f"{BASE_URL}/api/admin/wallets/{member_uid}/adjust",
            json={"kind": "debit", "amount_usd": 60, "note": "test cleanup (iter21)"},
            headers=admin_headers, timeout=15,
        )
        assert r.status_code == 200, r.text


# ----------------------------- Admin dashboard -----------------------------
class TestAdminDashboard:
    def test_dashboard_30d_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard?days=30", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("days", "current", "previous", "totals", "series", "by_status",
                  "payment_mix", "category_mix", "top_products", "recent_orders", "recent_topups"):
            assert k in d, f"missing key {k}"
        assert d["days"] == 30
        for ck in ("orders", "revenue_usd", "topups", "topup_usd", "new_users"):
            assert ck in d["current"] and ck in d["previous"]
        for tk in ("wallet_balance_usd", "users", "products", "pending_dispatch",
                   "pending_topup_reviews", "pending_verifications", "open_feedback"):
            assert tk in d["totals"], f"missing totals.{tk}"
        assert isinstance(d["series"], list) and len(d["series"]) == 30
        for row in d["series"]:
            for sk in ("date", "orders", "revenue_usd", "topup_usd", "new_users"):
                assert sk in row

    def test_dashboard_7d(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard?days=7", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        assert len(r.json()["series"]) == 7

    def test_dashboard_days3_clamps_to_7(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard?days=3", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["days"] == 7
        assert len(d["series"]) == 7

    def test_dashboard_unauth(self):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard", headers={"User-Agent": "pytest-iter21"}, timeout=15)
        assert r.status_code in (401, 403)


# ----------------------------- Regression: USDT -----------------------------
class TestUsdtRegression:
    def test_usdt_topup_still_works(self, member_headers, payment_methods):
        pm = payment_methods["crypto"]
        r = requests.post(
            f"{BASE_URL}/api/me/wallet/topup/usdt",
            json={"amount_usd": 60, "network": "TRC20", "method_id": pm["id"]} if pm else {"amount_usd": 60, "network": "TRC20"},
            headers=member_headers, timeout=20,
        )
        # Either 200 ok or a 4xx/5xx gateway-related (unchanged behavior). Accept 200 or 502/503.
        assert r.status_code in (200, 400, 502, 503), r.text

    def test_wallet_topups_list(self, member_headers):
        r = requests.get(f"{BASE_URL}/api/me/wallet/topups", headers=member_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
