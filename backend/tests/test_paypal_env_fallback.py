"""Iteration 24 — PayPal env-fallback checkout + admin test endpoint + webhook."""
import json
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")
UA = {"User-Agent": "pytest-iter24"}


def _load(path):
    try:
        return open(path).read().strip()
    except Exception:
        return ""


@pytest.fixture(scope="module")
def member_hdr():
    tok = _load("/tmp/jwt_member")
    assert tok, "no /tmp/jwt_member"
    return {**UA, "Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_hdr():
    tok = _load("/tmp/jwt_admin")
    xat = _load("/tmp/xat")
    assert tok and xat
    return {**UA, "Authorization": f"Bearer {tok}", "X-Admin-Token": xat}


@pytest.fixture(scope="module")
def pm_ids():
    r = requests.get(f"{BASE}/api/payment-methods", headers=UA, timeout=15)
    assert r.status_code == 200
    out = {}
    for m in r.json():
        out.setdefault(m["provider"], m["id"])
        if m["provider"] == "manual":
            out["manual"] = m["id"]
    assert "paypal" in out and "stripe" in out and "manual" in out
    return out


# ---- Checkout: PayPal unconfigured → 503 ----
def test_checkout_paypal_unconfigured_503(member_hdr, pm_ids):
    r = requests.post(f"{BASE}/api/me/wallet/topup/checkout", headers=member_hdr,
                      json={"amount_usd": 60, "method_id": pm_ids["paypal"], "origin_url": "https://x.test"}, timeout=20)
    assert r.status_code == 503, r.text
    assert "PayPal 尚未" in r.text or "尚未設定" in r.text or "尚未设定" in r.text


# ---- Admin test endpoint ----
def test_admin_test_paypal_unconfigured_503(admin_hdr, pm_ids):
    r = requests.post(f"{BASE}/api/admin/payment-methods/{pm_ids['paypal']}/test", headers=admin_hdr, timeout=20)
    assert r.status_code == 503, r.text
    assert "尚未" in r.text


def test_admin_test_stripe_ok(admin_hdr, pm_ids):
    r = requests.post(f"{BASE}/api/admin/payment-methods/{pm_ids['stripe']}/test", headers=admin_hdr, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("ok") is True
    assert d.get("provider") == "stripe"
    assert d.get("webhook_url", "").endswith("/api/webhook/stripe")


def test_admin_test_manual_400(admin_hdr, pm_ids):
    r = requests.post(f"{BASE}/api/admin/payment-methods/{pm_ids['manual']}/test", headers=admin_hdr, timeout=20)
    assert r.status_code == 400, r.text


def test_admin_test_notfound_404(admin_hdr):
    r = requests.post(f"{BASE}/api/admin/payment-methods/does-not-exist/test", headers=admin_hdr, timeout=20)
    assert r.status_code == 404, r.text


def test_admin_test_unauth(pm_ids):
    r = requests.post(f"{BASE}/api/admin/payment-methods/{pm_ids['paypal']}/test", headers=UA, timeout=20)
    assert r.status_code in (401, 403), r.text


# ---- Set invalid creds, re-test → 502 ----
def test_paypal_invalid_creds_returns_502(admin_hdr, member_hdr, pm_ids):
    paypal_id = pm_ids["paypal"]
    # fetch current pm to preserve other fields
    cur = requests.get(f"{BASE}/api/payment-methods", headers=UA, timeout=15).json()
    pm = next(m for m in cur if m["id"] == paypal_id)
    put_body = {
        "name": pm["name"], "category": pm["category"], "provider": pm["provider"],
        "description": pm.get("description", ""), "image": pm.get("image", ""),
        "min_usd": pm.get("min_usd", 50), "max_usd": pm.get("max_usd", 10000),
        "fee_percent": pm.get("fee_percent", 0), "sort_order": pm.get("sort_order", 4),
        "active": True,
        "config": {"client_id": "AbcTest", "api_secret": "wrongsecret", "env": "sandbox"},
    }
    r = requests.put(f"{BASE}/api/admin/payment-methods/{paypal_id}", headers=admin_hdr, json=put_body, timeout=20)
    assert r.status_code in (200, 201), r.text

    try:
        # Hit backend directly via localhost to inspect actual FastAPI JSON body
        # (public ingress rewrites upstream 502 into CloudFlare HTML).
        local = "http://localhost:8001"
        r2 = requests.post(f"{local}/api/admin/payment-methods/{paypal_id}/test", headers=admin_hdr, timeout=25)
        assert r2.status_code == 502, r2.text
        assert "PayPal 憑證無效" in r2.text or "憑證" in r2.text or "无效" in r2.text

        r3 = requests.post(f"{local}/api/me/wallet/topup/checkout", headers=member_hdr,
                           json={"amount_usd": 60, "method_id": paypal_id, "origin_url": "https://x.test"}, timeout=25)
        assert r3.status_code == 502, r3.text
    finally:
        # Reset creds to empty
        put_body["config"] = {"client_id": "", "api_secret": "", "env": "sandbox"}
        rr = requests.put(f"{BASE}/api/admin/payment-methods/{paypal_id}", headers=admin_hdr, json=put_body, timeout=20)
        assert rr.status_code in (200, 201), rr.text

    # Confirm restored to 503
    r4 = requests.post(f"{BASE}/api/admin/payment-methods/{paypal_id}/test", headers=admin_hdr, timeout=20)
    assert r4.status_code == 503, r4.text


# ---- Webhook endpoint ----
def test_webhook_paypal_ignored_for_unknown():
    r = requests.post(f"{BASE}/api/webhook/paypal", headers={**UA, "Content-Type": "application/json"},
                      data=json.dumps({"event_type": "PAYMENT.CAPTURE.COMPLETED", "resource": {"custom_id": "nope"}}), timeout=20)
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "ignored"


def test_webhook_paypal_bad_body_does_not_kill_service():
    r = requests.post(f"{BASE}/api/webhook/paypal", headers={**UA, "Content-Type": "application/json"}, data=b"", timeout=20)
    assert r.status_code in (400, 422, 500)
    r2 = requests.post(f"{BASE}/api/webhook/paypal", headers={**UA, "Content-Type": "text/plain"}, data=b"not-json", timeout=20)
    assert r2.status_code in (400, 415, 422, 500)
    # service still alive
    r3 = requests.get(f"{BASE}/api/payment-methods", headers=UA, timeout=15)
    assert r3.status_code == 200
