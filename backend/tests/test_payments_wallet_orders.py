"""Iteration 4: payment methods CRUD + wallet topup via method_id + order filters."""
import os, subprocess, pytest, requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
ADMIN_UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
MEMBER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"


def _mint(uid):
    return subprocess.check_output(["python3", "/app/tests/mint_token.py", uid], text=True).strip()


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_mint(ADMIN_UID)}", "User-Agent": "qa-tests/1.0"}


@pytest.fixture(scope="module")
def member_h():
    return {"Authorization": f"Bearer {_mint(MEMBER_UID)}", "User-Agent": "qa-tests/1.0"}


# ---- public payment methods ----
def test_public_payment_methods_no_config():
    r = requests.get(f"{API}/payment-methods", headers={"User-Agent": "qa/1"})
    assert r.status_code == 200, r.text
    arr = r.json()
    assert isinstance(arr, list) and len(arr) >= 5
    names = [m["name"] for m in arr]
    for n in ["信用卡", "PayPal", "USDT", "銀行轉帳"]:
        assert any(n in x for x in names), f"missing seeded {n}: {names}"
    # Apple Pay / Google Pay seed
    assert any("Apple Pay" in n or "Google Pay" in n for n in names), names
    for m in arr:
        assert "config" not in m, f"config leaked: {m}"
        assert m.get("active") is True


# ---- admin CRUD ----
@pytest.fixture(scope="module")
def created_pm(admin_h):
    body = {
        "name": "TEST_QA_METHOD",
        "category": "ewallet",
        "provider": "other",
        "description": "qa 付款說明",
        "config": {"merchant_id": "M1", "api_key": "sk_live_abcdef123456"},
        "min_usd": 5,
        "max_usd": 500,
    }
    r = requests.post(f"{API}/admin/payment-methods", headers=admin_h, json=body)
    assert r.status_code in (200, 201), r.text
    pm = r.json()
    yield pm
    # cleanup
    requests.delete(f"{API}/admin/payment-methods/{pm['id']}", headers=admin_h)


def test_create_masks_secret(created_pm):
    cfg = created_pm.get("config") or {}
    assert "api_key" in cfg
    masked = cfg["api_key"]
    assert "sk_live_abcdef123456" != masked, "secret not masked"
    assert "•" in masked or "*" in masked, f"not masked style: {masked}"
    # starts with sk_l and ends with 56 per spec
    assert masked.startswith("sk_l") and masked.endswith("56"), masked


def test_put_with_masked_secret_preserved(admin_h, created_pm, member_h):
    pid = created_pm["id"]
    masked = created_pm["config"]["api_key"]
    # PUT echoing the masked value back
    r = requests.put(f"{API}/admin/payment-methods/{pid}", headers=admin_h, json={
        "config": {"merchant_id": "M2", "api_key": masked},
        "description": "qa updated",
    })
    assert r.status_code == 200, r.text
    # admin GET still masked
    r2 = requests.get(f"{API}/admin/payment-methods", headers=admin_h)
    assert r2.status_code == 200
    found = [x for x in r2.json() if x["id"] == pid][0]
    assert "•" in found["config"]["api_key"] or "*" in found["config"]["api_key"]
    # And secret still works for topup
    tr = requests.post(f"{API}/me/wallet/topup", headers=member_h, json={"amount_usd": 10, "method_id": pid})
    assert tr.status_code == 200, tr.text


def test_bad_category(admin_h):
    r = requests.post(f"{API}/admin/payment-methods", headers=admin_h, json={
        "name": "TEST_X", "category": "foo", "provider": "other"})
    assert r.status_code == 400


def test_bad_provider(admin_h):
    r = requests.post(f"{API}/admin/payment-methods", headers=admin_h, json={
        "name": "TEST_X", "category": "ewallet", "provider": "foo"})
    assert r.status_code == 400


def test_missing_name(admin_h):
    r = requests.post(f"{API}/admin/payment-methods", headers=admin_h, json={
        "category": "ewallet", "provider": "other"})
    assert r.status_code in (400, 422)


def test_member_forbidden(member_h):
    r = requests.post(f"{API}/admin/payment-methods", headers=member_h, json={
        "name": "nope", "category": "ewallet", "provider": "other"})
    assert r.status_code == 403


# ---- wallet topup via method_id ----
def test_topup_below_min(member_h, created_pm):
    r = requests.post(f"{API}/me/wallet/topup", headers=member_h,
                      json={"amount_usd": 1, "method_id": created_pm["id"]})
    assert r.status_code == 400
    txt = (r.json().get("detail") or "") if r.headers.get("content-type", "").startswith("application/json") else r.text
    assert ("min" in str(txt).lower() or "最" in str(txt) or "5" in str(txt)), txt


def test_topup_valid_and_last_method(member_h, created_pm):
    pid = created_pm["id"]
    w0 = requests.get(f"{API}/me/wallet", headers=member_h).json()
    bal0 = float(w0["balance_usd"])
    r = requests.post(f"{API}/me/wallet/topup", headers=member_h,
                      json={"amount_usd": 25, "method_id": pid})
    assert r.status_code == 200, r.text
    w1 = requests.get(f"{API}/me/wallet", headers=member_h).json()
    assert float(w1["balance_usd"]) == pytest.approx(bal0 + 25, abs=0.01)
    assert w1.get("last_method_id") == pid
    assert "TEST_QA_METHOD" in (w1["transactions"][0].get("note") or "")


def test_topup_unknown_method(member_h):
    r = requests.post(f"{API}/me/wallet/topup", headers=member_h,
                      json={"amount_usd": 10, "method_id": "nope"})
    assert r.status_code == 400


def test_topup_inactive_method(admin_h, member_h, created_pm):
    pid = created_pm["id"]
    r = requests.put(f"{API}/admin/payment-methods/{pid}", headers=admin_h, json={"active": False})
    assert r.status_code == 200
    r2 = requests.post(f"{API}/me/wallet/topup", headers=member_h,
                       json={"amount_usd": 10, "method_id": pid})
    assert r2.status_code == 400
    # re-enable so other tests work
    requests.put(f"{API}/admin/payment-methods/{pid}", headers=admin_h, json={"active": True})


# ---- order filters ----
def test_order_filter_awaiting_info(member_h):
    r = requests.get(f"{API}/orders?status=awaiting_info", headers=member_h)
    assert r.status_code == 200
    for o in r.json():
        assert o["status"] == "paid" and o.get("info_submitted") is False


def test_order_filter_waiting(member_h):
    r = requests.get(f"{API}/orders?status=waiting", headers=member_h)
    assert r.status_code == 200
    for o in r.json():
        if o["status"] == "paid":
            assert o.get("info_submitted") is not False
        else:
            assert o["status"] in ("processing", "shipped")


def test_order_filter_completed(member_h):
    r = requests.get(f"{API}/orders?status=completed", headers=member_h)
    assert r.status_code == 200
    for o in r.json():
        assert o["status"] == "completed"


def test_order_filter_pending_payment(member_h):
    r = requests.get(f"{API}/orders?status=pending_payment", headers=member_h)
    assert r.status_code == 200
    for o in r.json():
        assert o["status"] == "pending_payment"


def test_pm_delete(admin_h):
    # create+delete isolated method to confirm 200/204
    r = requests.post(f"{API}/admin/payment-methods", headers=admin_h, json={
        "name": "TEST_DEL", "category": "card", "provider": "manual"})
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    d = requests.delete(f"{API}/admin/payment-methods/{pid}", headers=admin_h)
    assert d.status_code in (200, 204)
