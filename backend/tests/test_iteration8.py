"""Iteration 8 backend tests: statement, notify, alerts, operator perms."""
import os
import io
import pytest
import requests

def _load_env():
    for p in ("/app/frontend/.env",):
        try:
            with open(p) as f:
                for ln in f:
                    if ln.startswith("REACT_APP_BACKEND_URL="):
                        return ln.split("=", 1)[1].strip()
        except FileNotFoundError:
            pass
    return os.environ.get("REACT_APP_BACKEND_URL", "")

BASE_URL = _load_env().rstrip("/")
assert BASE_URL, "backend URL not configured"

ADMIN = ("ajin53193@gmail.com", "admin888")
AGENT = ("agent@demo.com", "agent888")
MERCHANT = ("merchant@demo.com", "merchant888")
OPERATOR = ("operator@demo.com", "operator888")


def _login(email, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, (email, r.status_code, r.text)
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": _login(*ADMIN),
        "agent": _login(*AGENT),
        "merchant": _login(*MERCHANT),
        "operator": _login(*OPERATOR),
    }


# ------------------------------- Statement API -----------------------------
class TestStatement:
    def test_merchant_self_month(self, tokens):
        r = requests.get(f"{BASE_URL}/api/reports/merchant-statement?month=2026-10", headers=_h(tokens["merchant"]))
        assert r.status_code == 200, r.text
        assert "spreadsheetml" in r.headers.get("content-type", "")
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(r.content))
        for s in ["月度汇总", "收款明细", "提现记录", "余额调整"]:
            assert s in wb.sheetnames, wb.sheetnames

    def test_admin_without_merchant_id(self, tokens):
        r = requests.get(f"{BASE_URL}/api/reports/merchant-statement?month=2026-10", headers=_h(tokens["admin"]))
        assert r.status_code == 400

    def test_invalid_month(self, tokens):
        # merchant path is scoped to self but month validation only happens after merchant resolution; use admin+valid mid
        # Use merchant where it will reach parsing (merchant role skips mid check)
        r = requests.get(f"{BASE_URL}/api/reports/merchant-statement?month=2026-13", headers=_h(tokens["merchant"]))
        assert r.status_code == 400

    def test_operator_forbidden(self, tokens):
        # operator@demo doesn't have reports.export
        # First find any merchant id as admin
        rl = requests.get(f"{BASE_URL}/api/accounts?role=merchant", headers=_h(tokens["admin"]))
        mid = rl.json()[0]["id"]
        r = requests.get(f"{BASE_URL}/api/reports/merchant-statement?month=2026-10&merchant_id={mid}", headers=_h(tokens["operator"]))
        assert r.status_code == 403

    def test_agent_sub_merchant(self, tokens):
        # Find agent's sub-merchants
        rl = requests.get(f"{BASE_URL}/api/accounts", headers=_h(tokens["agent"]))
        assert rl.status_code == 200
        subs = rl.json()
        if not subs:
            pytest.skip("agent has no sub-merchants")
        mid = subs[0]["id"]
        r = requests.get(f"{BASE_URL}/api/reports/merchant-statement?month=2026-10&merchant_id={mid}", headers=_h(tokens["agent"]))
        assert r.status_code == 200, r.text

    def test_agent_non_sub_merchant_forbidden(self, tokens):
        # Get a merchant that doesn't belong to agent via admin list
        rl = requests.get(f"{BASE_URL}/api/accounts?role=merchant", headers=_h(tokens["admin"]))
        merchants = rl.json()
        # pick one whose parent_agent_id doesn't match agent id
        me_agent = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(tokens["agent"])).json()
        aid = me_agent["id"]
        outsider = [m for m in merchants if m.get("parent_agent_id") != aid]
        if not outsider:
            pytest.skip("no outsider merchant")
        r = requests.get(f"{BASE_URL}/api/reports/merchant-statement?month=2026-10&merchant_id={outsider[0]['id']}", headers=_h(tokens["agent"]))
        assert r.status_code == 403


# ------------------------------- Notify ------------------------------------
class TestNotify:
    def test_get_default_masked(self, tokens):
        r = requests.get(f"{BASE_URL}/api/notify/settings", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert d["telegram_bot_token"] == ""
        assert "telegram_bot_token_masked" in d

    def test_put_then_mask(self, tokens):
        payload = {
            "telegram_enabled": True,
            "telegram_bot_token": "123456:TESTTOKENabcdef",
            "telegram_chat_id": "-100123",
            "notify_alerts": True,
            "notify_big_payment": True,
            "notify_sweep": True,
        }
        r = requests.put(f"{BASE_URL}/api/notify/settings", json=payload, headers=_h(tokens["admin"]))
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/notify/settings", headers=_h(tokens["admin"])).json()
        assert g["telegram_bot_token"] == ""
        assert g["telegram_bot_token_masked"]
        prev_mask = g["telegram_bot_token_masked"]
        # PUT with empty token keeps masked token
        payload2 = {**payload, "telegram_bot_token": ""}
        requests.put(f"{BASE_URL}/api/notify/settings", json=payload2, headers=_h(tokens["admin"]))
        g2 = requests.get(f"{BASE_URL}/api/notify/settings", headers=_h(tokens["admin"])).json()
        assert g2["telegram_bot_token_masked"] == prev_mask

    def test_test_bad_token(self, tokens):
        r = requests.post(f"{BASE_URL}/api/notify/test", headers=_h(tokens["admin"]))
        assert r.status_code == 400
        assert "telegram" in r.text.lower() or "Bot" in r.text

    def test_log_list(self, tokens):
        r = requests.get(f"{BASE_URL}/api/notify/log", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_non_admin_forbidden(self, tokens):
        for who in ("operator", "merchant"):
            r = requests.get(f"{BASE_URL}/api/notify/settings", headers=_h(tokens[who]))
            assert r.status_code == 403, (who, r.status_code)

    def test_restore(self, tokens):
        payload = {"telegram_enabled": False, "telegram_bot_token": "",
                   "telegram_chat_id": "", "notify_alerts": True,
                   "notify_big_payment": True, "notify_sweep": True}
        r = requests.put(f"{BASE_URL}/api/notify/settings", json=payload, headers=_h(tokens["admin"]))
        assert r.status_code == 200


# ------------------------------- Alerts ------------------------------------
class TestAlerts:
    def test_settings_defaults(self, tokens):
        r = requests.get(f"{BASE_URL}/api/alerts/settings", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert "sweep_threshold" in d and "big_payment" in d

    def test_put_and_restore(self, tokens):
        r = requests.put(f"{BASE_URL}/api/alerts/settings",
                         json={"pct": 10, "min_abs": 100, "sync_minutes": 10, "sweep_threshold": 5000, "big_payment": 500},
                         headers=_h(tokens["admin"]))
        assert r.status_code == 200
        # restore
        r = requests.put(f"{BASE_URL}/api/alerts/settings",
                         json={"pct": 10, "min_abs": 100, "sync_minutes": 10, "sweep_threshold": 10000, "big_payment": 1000},
                         headers=_h(tokens["admin"]))
        assert r.status_code == 200

    def test_sweep_due_alert_after_refresh(self, tokens):
        rr = requests.post(f"{BASE_URL}/api/chain/addresses/refresh", headers=_h(tokens["admin"]))
        assert rr.status_code == 200
        al = requests.get(f"{BASE_URL}/api/alerts", headers=_h(tokens["admin"]))
        assert al.status_code == 200
        types = [a.get("type") for a in al.json().get("alerts", [])]
        assert "sweep_due" in types, types


# ------------------------------- Operator ----------------------------------
OP2_EMAIL = "op2@demo.com"
OP2_PASS = "op2pass888"


class TestOperator:
    def test_permissions_list(self, tokens):
        r = requests.get(f"{BASE_URL}/api/accounts/permissions", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        keys = r.json()
        for k in ["orders.view", "orders.verify", "payouts.review", "accounts.view",
                  "balance.adjust", "channels.manage", "callbacks.retry", "audit.view", "reports.export"]:
            assert k in keys

    def test_create_op2_bad_perm(self, tokens):
        r = requests.post(f"{BASE_URL}/api/accounts",
                          json={"email": "bad_op@demo.com", "password": "pass8888", "name": "bad", "role": "operator", "permissions": ["foo"]},
                          headers=_h(tokens["admin"]))
        assert r.status_code == 400

    def test_create_op2_and_check(self, tokens):
        # idempotent: cleanup if exists
        existing = requests.get(f"{BASE_URL}/api/accounts?role=operator", headers=_h(tokens["admin"])).json()
        for e in existing:
            if e["email"] == OP2_EMAIL:
                # already exists
                tokens["op2_id"] = e["id"]
                break
        else:
            r = requests.post(f"{BASE_URL}/api/accounts",
                              json={"email": OP2_EMAIL, "password": OP2_PASS, "name": "op2",
                                    "role": "operator", "permissions": ["orders.view", "accounts.view"]},
                              headers=_h(tokens["admin"]))
            assert r.status_code == 200, r.text
            tokens["op2_id"] = r.json()["id"]
        # login
        op2 = _login(OP2_EMAIL, OP2_PASS)
        tokens["op2"] = op2

        # /auth/me includes permissions
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(op2)).json()
        assert me["role"] == "operator"

        # orders.view
        assert requests.get(f"{BASE_URL}/api/orders", headers=_h(op2)).status_code == 200
        assert requests.get(f"{BASE_URL}/api/accounts", headers=_h(op2)).status_code == 200
        assert requests.get(f"{BASE_URL}/api/channels", headers=_h(op2)).status_code == 403
        assert requests.get(f"{BASE_URL}/api/audit-logs", headers=_h(op2)).status_code == 403
        assert requests.post(f"{BASE_URL}/api/accounts", json={"email": "x@x.com", "password": "p", "name": "x", "role": "merchant"}, headers=_h(op2)).status_code == 403
        assert requests.get(f"{BASE_URL}/api/auth/lockouts", headers=_h(op2)).status_code == 403

    def test_patch_perms_and_recheck(self, tokens):
        op2_id = tokens["op2_id"]
        r = requests.patch(f"{BASE_URL}/api/accounts/{op2_id}/permissions",
                           json={"permissions": ["orders.view", "audit.view"]},
                           headers=_h(tokens["admin"]))
        assert r.status_code == 200
        op2 = _login(OP2_EMAIL, OP2_PASS)
        assert requests.get(f"{BASE_URL}/api/audit-logs", headers=_h(op2)).status_code == 200
        assert requests.get(f"{BASE_URL}/api/accounts", headers=_h(op2)).status_code == 403

    def test_patch_perms_unknown(self, tokens):
        r = requests.patch(f"{BASE_URL}/api/accounts/{tokens['op2_id']}/permissions",
                          json={"permissions": ["foo"]}, headers=_h(tokens["admin"]))
        assert r.status_code == 400

    def test_operator_demo_forbidden_notify(self, tokens):
        r = requests.get(f"{BASE_URL}/api/notify/settings", headers=_h(tokens["operator"]))
        assert r.status_code == 403
