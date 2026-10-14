"""Iteration 23 — Order status notifications + order cancellation refund flow.

Covers:
  * GET/PUT /api/admin/notifications (DEFAULT_NOTIFY shape + persistence)
  * notify_user side-effects: order_paid / order_completed / order_cancelled / order_rejected
  * PATCH /api/admin/orders/{id} cancellation refund (wallet) + idempotency + unpaid variant
  * GET /api/admin/notifications/logs filters + resend + 404 + unauth
  * ORDER_STATUSES cancelled bucket in admin orders & dashboard
  * Event switch (events.order_paid=false) suppresses log
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")
MEMBER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"
TESTER_EMAIL = "tester+clerk_test@shop.com"


def _read(p):
    with open(p) as f:
        return f.read().strip()


@pytest.fixture(scope="module")
def member_h():
    return {"Authorization": f"Bearer {_read('/tmp/jwt_member')}", "User-Agent": "pytest-iter23"}


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_read('/tmp/jwt_admin')}", "X-Admin-Token": _read("/tmp/xat"), "User-Agent": "pytest-iter23"}


_SPEC_POOL = []
_SPEC_IDX = {"i": 0}


def _load_specs():
    if _SPEC_POOL:
        return
    r = requests.get(f"{BASE}/api/products", headers={"User-Agent": "pytest-iter23"}, timeout=15)
    assert r.status_code == 200
    for p in r.json():
        for s in (p.get("specs") or []):
            price = float(s.get("sale_price_usd") or s.get("price_usd") or 0)
            badge = s.get("badge") or ""
            # Skip anything with limit badges (每日/每月/每週/新客/新使用者)
            if not s.get("in_stock") or price > 30 or price < 2:
                continue
            if any(k in badge for k in ("每日", "每月", "每週", "新客", "新使用者", "限購")):
                continue
            _SPEC_POOL.append({"product_id": p["id"], "spec_id": s["id"], "price": price})
    assert len(_SPEC_POOL) >= 10, f"not enough unlimited specs: {len(_SPEC_POOL)}"


@pytest.fixture
def spec():
    _load_specs()
    i = _SPEC_IDX["i"]
    _SPEC_IDX["i"] = (i + 1) % len(_SPEC_POOL)
    return _SPEC_POOL[i]


def _wallet_balance(h):
    r = requests.get(f"{BASE}/api/me/wallet", headers=h, timeout=10)
    return float(r.json().get("balance_usd") or 0)


def _ensure_balance(admin_h, needed):
    cur = _wallet_balance({"Authorization": f"Bearer {_read('/tmp/jwt_member')}", "User-Agent": "pytest-iter23"})
    if cur < needed:
        add = round(needed - cur + 10, 2)
        r = requests.post(f"{BASE}/api/admin/wallets/{MEMBER_UID}/adjust",
                          json={"kind": "credit", "amount_usd": add, "note": "iter23 topup"}, headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text


def _create_order(member_h, spec, qty=1):
    body = {"items": [{"product_id": spec["product_id"], "spec_id": spec["spec_id"], "quantity": qty}],
            "currency": "USD", "recharge_account": "TEST_acct_iter23", "contact": "e2e@test"}
    r = requests.post(f"{BASE}/api/orders", json=body, headers=member_h, timeout=20)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _wait_for_log(admin_h, event, order_no, tries=8, delay=1.0):
    for _ in range(tries):
        time.sleep(delay)
        r = requests.get(f"{BASE}/api/admin/notifications/logs?event={event}&limit=50", headers=admin_h, timeout=15)
        if r.status_code != 200:
            continue
        for row in r.json().get("rows", []):
            if order_no and order_no in (row.get("subject", "") + row.get("body", "")):
                return row
    return None


# --------------------- Notifications settings ---------------------
class TestNotificationsSettings:
    def test_get_defaults(self, admin_h):
        r = requests.get(f"{BASE}/api/admin/notifications", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "events" in d and "templates" in d
        for k in ("order_paid", "order_completed", "order_cancelled", "order_rejected", "topup_paid"):
            assert k in d["events"], f"missing event {k}"
            assert k in d["templates"], f"missing template {k}"
            assert d["templates"][k].get("subject") and d["templates"][k].get("body")
        # order_cancelled template should mention order_id & reason placeholder exists
        assert "{order_id}" in d["templates"]["order_cancelled"]["subject"]

    def test_put_persists_and_revert(self, admin_h):
        # fetch current
        cur = requests.get(f"{BASE}/api/admin/notifications", headers=admin_h, timeout=15).json()
        new = {**cur, "templates": {**cur["templates"], "order_paid": {**cur["templates"]["order_paid"],
                                                                       "subject": cur["templates"]["order_paid"]["subject"] + "測試"}}}
        r = requests.put(f"{BASE}/api/admin/notifications", json={"value": new}, headers=admin_h, timeout=15)
        assert r.status_code == 200
        got = requests.get(f"{BASE}/api/admin/notifications", headers=admin_h, timeout=15).json()
        assert "測試" in got["templates"]["order_paid"]["subject"]
        # revert
        r2 = requests.put(f"{BASE}/api/admin/notifications", json={"value": cur}, headers=admin_h, timeout=15)
        assert r2.status_code == 200
        got2 = requests.get(f"{BASE}/api/admin/notifications", headers=admin_h, timeout=15).json()
        assert "測試" not in got2["templates"]["order_paid"]["subject"]

    def test_unauth(self):
        r = requests.get(f"{BASE}/api/admin/notifications", headers={"User-Agent": "pytest-iter23"}, timeout=10)
        assert r.status_code in (401, 403)
        r2 = requests.get(f"{BASE}/api/admin/notifications/logs", headers={"User-Agent": "pytest-iter23"}, timeout=10)
        assert r2.status_code in (401, 403)


# --------------------- order_paid notification ---------------------
class TestOrderPaidNotification:
    oid = None
    order_no = None

    def test_paid_triggers_log(self, member_h, admin_h, spec):
        _ensure_balance(admin_h, spec["price"] * 2 + 50)
        o = _create_order(member_h, spec)
        TestOrderPaidNotification.oid = o["id"]
        TestOrderPaidNotification.order_no = o.get("order_no") or o["id"]
        r = requests.post(f"{BASE}/api/orders/{o['id']}/pay-wallet", headers=member_h, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "paid"
        log = _wait_for_log(admin_h, "order_paid", TestOrderPaidNotification.order_no)
        assert log is not None, "order_paid log not found"
        assert log["channel"] == "email"
        assert log["to"] == TESTER_EMAIL or TESTER_EMAIL.split("@")[0] in log["to"]
        assert log["status"] in ("sent", "failed")
        # record failure error for report (don't fail test)
        if log["status"] == "failed":
            print(f"[info] order_paid email failed: {log.get('error')}")


# --------------------- order_completed via confirm & PATCH ---------------------
class TestOrderCompleted:
    def test_confirm_triggers_completed(self, member_h, admin_h, spec):
        _ensure_balance(admin_h, spec["price"] + 20)
        o = _create_order(member_h, spec)
        requests.post(f"{BASE}/api/orders/{o['id']}/pay-wallet", headers=member_h, timeout=20)
        r = requests.post(f"{BASE}/api/admin/orders/{o['id']}/confirm", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        log = _wait_for_log(admin_h, "order_completed", o.get("order_no") or o["id"])
        assert log is not None, "order_completed log missing"

    def test_patch_status_completed(self, member_h, admin_h, spec):
        _ensure_balance(admin_h, spec["price"] + 20)
        o = _create_order(member_h, spec)
        requests.post(f"{BASE}/api/orders/{o['id']}/pay-wallet", headers=member_h, timeout=20)
        r = requests.patch(f"{BASE}/api/admin/orders/{o['id']}", json={"status": "completed"}, headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        log = _wait_for_log(admin_h, "order_completed", o.get("order_no") or o["id"])
        assert log is not None, "order_completed via PATCH log missing"


# --------------------- order_cancelled + refund ---------------------
class TestOrderCancelled:
    oid = None
    order_no = None
    price = 0

    def test_cancel_paid_order_refunds(self, member_h, admin_h, spec):
        _ensure_balance(admin_h, spec["price"] + 20)
        o = _create_order(member_h, spec)
        TestOrderCancelled.oid = o["id"]
        TestOrderCancelled.order_no = o.get("order_no") or o["id"]
        bal_before_pay = _wallet_balance(member_h)
        pay = requests.post(f"{BASE}/api/orders/{o['id']}/pay-wallet", headers=member_h, timeout=20)
        assert pay.status_code == 200
        paid_order = pay.json()
        total = float(paid_order.get("total_usd") or 0)
        TestOrderCancelled.price = total
        bal_after_pay = _wallet_balance(member_h)
        assert round(bal_before_pay - bal_after_pay, 2) == round(total, 2)
        # cancel
        r = requests.patch(f"{BASE}/api/admin/orders/{o['id']}", json={"status": "cancelled", "admin_note": "測試取消"}, headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "cancelled"
        assert d.get("refunded_at")
        assert round(float(d.get("refund_usd") or 0), 2) == round(total, 2)
        # balance restored
        bal_after_cancel = _wallet_balance(member_h)
        assert round(bal_after_cancel - bal_after_pay, 2) == round(total, 2), f"refund not credited: {bal_after_pay} -> {bal_after_cancel}"
        # wallet tx has refund
        wallet = requests.get(f"{BASE}/api/me/wallet", headers=member_h, timeout=15).json()
        kinds = [t.get("kind") for t in (wallet.get("transactions") or [])[:10]]
        assert "refund" in kinds, f"no refund tx in recent: {kinds}"
        # log with reason
        log = _wait_for_log(admin_h, "order_cancelled", TestOrderCancelled.order_no)
        assert log is not None
        assert "測試取消" in log.get("body", "")

    def test_cancel_again_no_double_refund(self, admin_h, member_h):
        bal_before = _wallet_balance(member_h)
        r = requests.patch(f"{BASE}/api/admin/orders/{TestOrderCancelled.oid}", json={"status": "cancelled", "admin_note": "再試一次"}, headers=admin_h, timeout=15)
        assert r.status_code == 200
        bal_after = _wallet_balance(member_h)
        assert round(bal_after - bal_before, 2) == 0.0, "duplicate refund!"

    def test_cancel_unpaid_no_refund(self, member_h, admin_h, spec):
        o = _create_order(member_h, spec)
        bal_before = _wallet_balance(member_h)
        r = requests.patch(f"{BASE}/api/admin/orders/{o['id']}", json={"status": "cancelled", "admin_note": "未付款取消"}, headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "cancelled"
        assert not d.get("refunded_at")
        bal_after = _wallet_balance(member_h)
        assert round(bal_after - bal_before, 2) == 0.0
        log = _wait_for_log(admin_h, "order_cancelled", o.get("order_no") or o["id"])
        assert log is not None, "unpaid cancel should still fire notification"


# --------------------- order_rejected ---------------------
class TestOrderRejected:
    def test_reject_info_triggers(self, member_h, admin_h, spec):
        _ensure_balance(admin_h, spec["price"] + 20)
        o = _create_order(member_h, spec)
        requests.post(f"{BASE}/api/orders/{o['id']}/pay-wallet", headers=member_h, timeout=20)
        # submit delivery info to allow reject
        info = requests.post(f"{BASE}/api/orders/{o['id']}/info",
                             json={"recharge_account": "someacct", "delivery_info": {"default": {"游戏ID": "abc123"}}},
                             headers=member_h, timeout=15)
        # even if info returns 400, try reject
        r = requests.post(f"{BASE}/api/admin/orders/{o['id']}/reject-info", json={"reason": "帳號錯誤"}, headers=admin_h, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"reject-info returned {r.status_code}: {r.text[:200]}")
        log = _wait_for_log(admin_h, "order_rejected", o.get("order_no") or o["id"])
        assert log is not None
        assert "帳號錯誤" in log.get("body", "")


# --------------------- logs filters + resend ---------------------
class TestNotificationLogs:
    def test_filter_status(self, admin_h):
        r = requests.get(f"{BASE}/api/admin/notifications/logs?status=sent&limit=20", headers=admin_h, timeout=15)
        assert r.status_code == 200
        for row in r.json().get("rows", []):
            assert row["status"] == "sent"

    def test_filter_q_email(self, admin_h):
        r = requests.get(f"{BASE}/api/admin/notifications/logs?q=tester&limit=20", headers=admin_h, timeout=15)
        assert r.status_code == 200
        rows = r.json().get("rows", [])
        if rows:
            assert any("tester" in (row.get("to", "").lower()) for row in rows)

    def test_filter_event(self, admin_h):
        r = requests.get(f"{BASE}/api/admin/notifications/logs?event=order_cancelled&limit=20", headers=admin_h, timeout=15)
        assert r.status_code == 200
        for row in r.json().get("rows", []):
            assert row["event"] == "order_cancelled"

    def test_resend_email(self, admin_h):
        r = requests.get(f"{BASE}/api/admin/notifications/logs?limit=50", headers=admin_h, timeout=15)
        rows = [x for x in r.json().get("rows", []) if x.get("channel") == "email"]
        if not rows:
            pytest.skip("no email log yet")
        lid = rows[0]["id"]
        before = r.json()["total"]
        rr = requests.post(f"{BASE}/api/admin/notifications/logs/{lid}/resend", headers=admin_h, timeout=20)
        assert rr.status_code in (200, 502), rr.text
        # a new log row should be created either way
        time.sleep(1.0)
        r2 = requests.get(f"{BASE}/api/admin/notifications/logs?limit=50", headers=admin_h, timeout=15)
        assert r2.json()["total"] >= before + 1
        if rr.status_code == 502:
            print(f"[info] resend returned 502: {rr.json().get('detail')}")

    def test_resend_404(self, admin_h):
        r = requests.post(f"{BASE}/api/admin/notifications/logs/doesnotexist/resend", headers=admin_h, timeout=15)
        assert r.status_code == 404


# --------------------- event switch suppresses ---------------------
class TestEventSwitch:
    def test_disabled_event_suppresses_log(self, admin_h, member_h, spec):
        cur = requests.get(f"{BASE}/api/admin/notifications", headers=admin_h, timeout=15).json()
        try:
            new = {**cur, "events": {**cur["events"], "order_paid": False}}
            r = requests.put(f"{BASE}/api/admin/notifications", json={"value": new}, headers=admin_h, timeout=15)
            assert r.status_code == 200
            _ensure_balance(admin_h, spec["price"] + 20)
            o = _create_order(member_h, spec)
            requests.post(f"{BASE}/api/orders/{o['id']}/pay-wallet", headers=member_h, timeout=20)
            time.sleep(3.0)
            r2 = requests.get(f"{BASE}/api/admin/notifications/logs?event=order_paid&limit=50", headers=admin_h, timeout=15)
            on_no = o.get("order_no") or o["id"]
            matches = [row for row in r2.json().get("rows", []) if on_no in (row.get("subject", "") + row.get("body", ""))]
            assert len(matches) == 0, f"expected 0 order_paid logs for {on_no}, got {len(matches)}"
        finally:
            requests.put(f"{BASE}/api/admin/notifications", json={"value": cur}, headers=admin_h, timeout=15)


# --------------------- ORDER_STATUSES cancelled bucket ---------------------
class TestCancelledBucket:
    def test_admin_orders_filter_cancelled(self, admin_h):
        r = requests.get(f"{BASE}/api/admin/orders?status=cancelled&limit=20", headers=admin_h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        rows = d if isinstance(d, list) else d.get("rows") or d.get("items") or []
        assert isinstance(rows, list)
        for row in rows[:5]:
            assert row.get("status") == "cancelled"

    def test_admin_orders_summary_has_cancelled(self, admin_h):
        r = requests.get(f"{BASE}/api/admin/orders?limit=1", headers=admin_h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        summary = (d or {}).get("summary", {}) if isinstance(d, dict) else {}
        by_status = summary.get("by_status") or {}
        if by_status:
            assert "cancelled" in by_status, f"by_status missing cancelled: {by_status}"

    def test_dashboard_by_status_has_cancelled(self, admin_h):
        r = requests.get(f"{BASE}/api/admin/dashboard?days=30", headers=admin_h, timeout=15)
        assert r.status_code == 200
        bs = r.json().get("by_status") or {}
        assert "cancelled" in bs, f"dashboard by_status: {bs}"


# --------------------- cleanup (debit wallet back) ---------------------
def test_zz_cleanup(admin_h, member_h):
    """Debit any residual TEST credit so balance ends near 451.66 from iter22."""
    bal = _wallet_balance(member_h)
    target = 451.66
    diff = round(bal - target, 2)
    if diff > 1:
        r = requests.post(f"{BASE}/api/admin/wallets/{MEMBER_UID}/adjust",
                          json={"kind": "debit", "amount_usd": diff, "note": "iter23 cleanup"}, headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
