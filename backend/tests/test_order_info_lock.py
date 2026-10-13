"""Iteration 8: order info submission lock + admin reject-info flow.

Flow under test:
1. Member creates order with empty delivery_info + empty recharge_account.
2. Member pays via wallet (ensure balance). Expect info_submitted=false after pay.
3. Member POST /orders/{id}/info with required 抖音帳號 -> 200, locked.
4. Second POST /orders/{id}/info -> 400 '已提交'.
5. Admin POST /admin/orders/{id}/reject-info -> 200, info_rejected=true, reason persisted, timeline entry.
6. Member re-submits info -> 200 and info_rejected=false.
7. Reject on completed order -> 400.
"""
import os
import subprocess
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
ADMIN_UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
MEMBER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
PRODUCT_ID = "7814"
# cheap spec to minimise wallet impact
SPEC_ID = "7814-74480"
UA = {"User-Agent": "qa-order-info-lock/1.0"}


def _mint(uid: str) -> str:
    return subprocess.check_output(["python3", "/app/tests/mint_token.py", uid], text=True).strip()


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_mint(ADMIN_UID)}", **UA}


@pytest.fixture(scope="module")
def member_h():
    return {"Authorization": f"Bearer {_mint(MEMBER_UID)}", **UA}


@pytest.fixture(scope="module")
def ensure_wallet(member_h):
    """Ensure member wallet has at least $10 by self-topup with a seeded method if needed."""
    w = requests.get(f"{API}/me/wallet", headers=member_h).json()
    if float(w["balance_usd"]) >= 10:
        return
    pms = requests.get(f"{API}/payment-methods", headers=UA).json()
    pm = next((m for m in pms if m.get("active")), None)
    assert pm, "no active payment method"
    r = requests.post(f"{API}/me/wallet/topup", headers=member_h,
                      json={"amount_usd": 50, "method_id": pm["id"]})
    assert r.status_code == 200, r.text


@pytest.fixture(scope="module")
def paid_order(member_h, ensure_wallet):
    """Create + pay a cheap order with EMPTY delivery info / recharge_account."""
    body = {
        "items": [{"product_id": PRODUCT_ID, "spec_id": SPEC_ID, "quantity": 1}],
        "currency": "USD",
        "recharge_account": "",
        "recharge_note": "",
        "contact": "",
        "delivery_info": {},
    }
    r = requests.post(f"{API}/orders", headers=member_h, json=body)
    assert r.status_code == 200, r.text
    o = r.json()
    oid = o["id"]
    # pay via wallet
    pr = requests.post(f"{API}/orders/{oid}/pay-wallet", headers=member_h)
    assert pr.status_code == 200, pr.text
    paid = pr.json()
    assert paid["status"] == "paid"
    # critical: empty info => info_submitted False
    assert paid.get("info_submitted") is False, f"expected info_submitted=False after pay with empty info, got {paid.get('info_submitted')}"
    return paid


def _refetch(member_h, oid):
    arr = requests.get(f"{API}/orders", headers=member_h).json()
    for o in arr:
        if o["id"] == oid:
            return o
    return None


def test_1_initial_state(paid_order):
    assert paid_order["status"] == "paid"
    assert paid_order.get("info_submitted") is False
    assert not paid_order.get("info_rejected")


def test_2_submit_info_success_and_lock(member_h, paid_order):
    oid = paid_order["id"]
    body = {
        "delivery_info": {PRODUCT_ID: {"抖音帳號": "qa_douyin_user_001"}},
        "recharge_note": "qa note",
        "contact": "qa@example.com",
    }
    r = requests.post(f"{API}/orders/{oid}/info", headers=member_h, json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("info_submitted") is True
    assert j.get("info_rejected") in (False, None) or j.get("info_rejected") is False
    assert j["delivery_info"][PRODUCT_ID]["抖音帳號"] == "qa_douyin_user_001"
    # verify persistence
    o = _refetch(member_h, oid)
    assert o["info_submitted"] is True
    assert o["recharge_account"] == "qa_douyin_user_001"


def test_3_second_submit_locked(member_h, paid_order):
    oid = paid_order["id"]
    body = {"delivery_info": {PRODUCT_ID: {"抖音帳號": "attempted_change"}}}
    r = requests.post(f"{API}/orders/{oid}/info", headers=member_h, json=body)
    assert r.status_code == 400, r.text
    detail = (r.json() or {}).get("detail", "")
    assert "已提交" in detail, f"expected 已提交 in detail, got: {detail}"
    # ensure original value unchanged
    o = _refetch(member_h, oid)
    assert o["delivery_info"][PRODUCT_ID]["抖音帳號"] == "qa_douyin_user_001"


def test_4_admin_reject_info(admin_h, member_h, paid_order):
    oid = paid_order["id"]
    r = requests.post(f"{API}/admin/orders/{oid}/reject-info", headers=admin_h,
                      json={"reason": "帳號錯誤"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("info_submitted") is False
    assert j.get("info_rejected") is True
    assert j.get("info_reject_reason") == "帳號錯誤"
    assert j["status"] == "paid"
    tl = j.get("timeline") or []
    assert any(e.get("status") == "info_rejected" for e in tl), tl
    # verify from member list too
    o = _refetch(member_h, oid)
    assert o["info_submitted"] is False
    assert o["info_rejected"] is True
    assert o["info_reject_reason"] == "帳號錯誤"


def test_5_member_resubmit_after_reject(member_h, paid_order):
    oid = paid_order["id"]
    body = {"delivery_info": {PRODUCT_ID: {"抖音帳號": "qa_douyin_user_002"}}}
    r = requests.post(f"{API}/orders/{oid}/info", headers=member_h, json=body)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("info_submitted") is True
    assert j.get("info_rejected") is False
    assert j["delivery_info"][PRODUCT_ID]["抖音帳號"] == "qa_douyin_user_002"


def test_6_reject_on_completed_order_400(admin_h, member_h, paid_order):
    """Mark order completed via admin confirm, then reject-info must 400."""
    oid = paid_order["id"]
    c = requests.post(f"{API}/admin/orders/{oid}/confirm", headers=admin_h)
    assert c.status_code == 200, c.text
    assert c.json()["status"] == "completed"
    r = requests.post(f"{API}/admin/orders/{oid}/reject-info", headers=admin_h,
                      json={"reason": "試圖駁回已完成"})
    assert r.status_code == 400, r.text
    detail = (r.json() or {}).get("detail", "")
    assert "付款" in detail or "完成" in detail or "處理中" in detail, detail


def test_7_reject_non_existent_order_404(admin_h):
    r = requests.post(f"{API}/admin/orders/nonexistent-id-xyz/reject-info",
                      headers=admin_h, json={"reason": "x"})
    assert r.status_code == 404


def test_8_reject_requires_admin(member_h, admin_h):
    """A member cannot call reject-info on anyone's order."""
    # pick an existing admin-created order id for realism; use any member order id
    orders = requests.get(f"{API}/orders", headers=member_h).json()
    assert orders, "need at least one order"
    oid = orders[0]["id"]
    r = requests.post(f"{API}/admin/orders/{oid}/reject-info",
                      headers=member_h, json={"reason": "x"})
    assert r.status_code in (401, 403), r.text
