"""Iteration 20: bulk product ops, admin orders search/export, spec purchase limits."""
import os
import pytest
import requests
from datetime import datetime

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")
API = BASE + "/api"
UA = {"User-Agent": "gogo589-test/1.0"}


def _read(p):
    with open(p) as f:
        return f.read().strip()


JWT_ADMIN = _read("/tmp/jwt_admin")
JWT_MEMBER = _read("/tmp/jwt_member")
XAT = _read("/tmp/xat")

H_ADMIN = {**UA, "Authorization": f"Bearer {JWT_ADMIN}", "X-Admin-Token": XAT}
H_MEMBER = {**UA, "Authorization": f"Bearer {JWT_MEMBER}"}


# ----------------- Fixtures -----------------
@pytest.fixture(scope="module")
def test_product():
    """Create a fresh test product with the 5 limited specs; delete at end."""
    body = {
        "name": "测试限购商品Z20",
        "brand": "QA",
        "category": "games",
        "image": "",
        "image_data_url": "",
        "tags": ["測試"],
        "sort_order": -9,
        "active": True,
        "specs": [
            {"id": "new-A", "label": "限購A", "price_usd": 1, "badge": "", "limit": "daily", "limit_count": 1},
            {"id": "new-B", "label": "限購B", "price_usd": 1, "badge": "", "limit": "lifetime", "limit_count": 2},
            {"id": "new-C", "label": "限購C", "price_usd": 1, "badge": "每日一單", "limit": "none"},
            {"id": "new-D", "label": "新客D", "price_usd": 1, "badge": "", "limit": "newcomer"},
            {"id": "new-E", "label": "周E", "price_usd": 1, "badge": "", "limit": "weekly", "limit_count": 1},
        ],
        "delivery_fields": [{"name": "充值帳號", "type": "text", "required": True, "placeholder": ""}],
        "account_field_label": "充值帳號",
        "content_html": "<p>test</p>",
        "tutorial": "",
        "description": "",
        "related_ids": [],
    }
    r = requests.post(f"{API}/admin/products", json=body, headers=H_ADMIN)
    assert r.status_code in (200, 201), r.text
    p = r.json()
    yield p
    requests.delete(f"{API}/admin/products/{p['id']}", headers=H_ADMIN)


# ----------------- Bulk product ops -----------------
class TestBulkProducts:
    @pytest.fixture(scope="class")
    def ids(self):
        # Create 2 throwaway products for bulk ops (don't touch real ones)
        made = []
        for i in range(2):
            r = requests.post(f"{API}/admin/products", headers=H_ADMIN, json={
                "name": f"測試bulk{i}", "brand": "QA", "category": "games", "image": "", "image_data_url": "",
                "tags": [], "sort_order": -9, "active": True,
                "specs": [{"id": f"n{i}", "label": "s", "price_usd": 1}],
                "delivery_fields": [{"name": "帳號", "type": "text", "required": True}],
                "account_field_label": "帳號", "content_html": "", "tutorial": "", "description": "", "related_ids": [],
            })
            assert r.status_code in (200, 201), r.text
            made.append(r.json()["id"])
        yield made
        for pid in made:
            requests.delete(f"{API}/admin/products/{pid}", headers=H_ADMIN)

    def test_empty_ids_400(self):
        r = requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": [], "action": "set_active", "value": True})
        assert r.status_code == 400

    def test_unknown_action_400(self, ids):
        r = requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": ids, "action": "nope"})
        assert r.status_code == 400

    def test_unauth(self, ids):
        r = requests.post(f"{API}/admin/products/bulk", headers=UA, json={"ids": ids, "action": "set_active", "value": True})
        assert r.status_code in (401, 403)

    def test_set_active_false_then_true(self, ids):
        r = requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": ids, "action": "set_active", "value": False})
        assert r.status_code == 200 and r.json()["count"] == 2
        for pid in ids:
            d = requests.get(f"{API}/admin/products/{pid}", headers=H_ADMIN).json()
            assert d["active"] is False
        requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": ids, "action": "set_active", "value": True})

    def test_set_category_invalid(self, ids):
        r = requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": ids, "action": "set_category", "value": "no-such-cat"})
        assert r.status_code == 400

    def test_set_category_valid(self, ids):
        r = requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": ids, "action": "set_category", "value": "social"})
        assert r.status_code == 200 and r.json()["count"] == 2
        d = requests.get(f"{API}/admin/products/{ids[0]}", headers=H_ADMIN).json()
        assert d["category"] == "social"
        requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": ids, "action": "set_category", "value": "games"})

    def test_add_tags_traditional_dedup(self, ids):
        r = requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": ids, "action": "add_tags", "value": "测试标签"})
        assert r.status_code == 200
        d = requests.get(f"{API}/admin/products/{ids[0]}", headers=H_ADMIN).json()
        assert "測試標籤" in d["tags"]
        # add again - should not duplicate
        requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": ids, "action": "add_tags", "value": "测试标签"})
        d2 = requests.get(f"{API}/admin/products/{ids[0]}", headers=H_ADMIN).json()
        assert d2["tags"].count("測試標籤") == 1

    def test_remove_tags(self, ids):
        r = requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": ids, "action": "remove_tags", "value": "测试标签"})
        assert r.status_code == 200
        d = requests.get(f"{API}/admin/products/{ids[0]}", headers=H_ADMIN).json()
        assert "測試標籤" not in d["tags"]

    def test_delete(self, ids):
        # Delete only ids[1] here (ids[0] handled by teardown)
        pid = ids[1]
        r = requests.post(f"{API}/admin/products/bulk", headers=H_ADMIN, json={"ids": [pid], "action": "delete"})
        assert r.status_code == 200 and r.json()["count"] == 1
        g = requests.get(f"{API}/api/products/{pid}") if False else requests.get(f"{API}/products/{pid}")
        assert g.status_code == 404


# ----------------- Admin orders list / export -----------------
class TestAdminOrders:
    def test_list_basic(self):
        r = requests.get(f"{API}/admin/orders?page=1&size=5", headers=H_ADMIN)
        assert r.status_code == 200
        j = r.json()
        assert "total" in j and "rows" in j and "summary" in j
        assert "total_usd" in j["summary"] and "paid_usd" in j["summary"] and "by_status" in j["summary"]
        assert len(j["rows"]) <= 5

    def test_pagination_size_2(self):
        r = requests.get(f"{API}/admin/orders?page=1&size=2", headers=H_ADMIN)
        assert r.status_code == 200
        assert len(r.json()["rows"]) <= 2

    def test_status_filter(self):
        r = requests.get(f"{API}/admin/orders?status=completed&size=10", headers=H_ADMIN)
        assert r.status_code == 200
        for row in r.json()["rows"]:
            assert row["status"] == "completed"

    def test_awaiting_info(self):
        r = requests.get(f"{API}/admin/orders?status=awaiting_info&size=10", headers=H_ADMIN)
        assert r.status_code == 200
        for row in r.json()["rows"]:
            assert row["status"] == "paid"
            assert row.get("info_submitted", False) is False

    def test_date_range(self):
        today = datetime.utcnow().strftime("%Y-%m-%d")
        r = requests.get(f"{API}/admin/orders?date_from=2020-01-01&date_to={today}&size=5", headers=H_ADMIN)
        assert r.status_code == 200

    def test_q_search(self):
        # search by status completed first row's order_no if exists
        r = requests.get(f"{API}/admin/orders?size=1", headers=H_ADMIN)
        rows = r.json()["rows"]
        if rows:
            no = rows[0]["order_no"]
            r2 = requests.get(f"{API}/admin/orders?q={no}", headers=H_ADMIN)
            assert r2.status_code == 200
            ords = r2.json()["rows"]
            assert any(o["order_no"] == no for o in ords)

    def test_unauth(self):
        r = requests.get(f"{API}/admin/orders", headers=UA)
        assert r.status_code in (401, 403)

    def test_export_csv_unfiltered(self):
        r = requests.get(f"{API}/admin/orders/export", headers=H_ADMIN)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "")
        body = r.content.decode("utf-8")
        assert body.startswith("\ufeff")
        assert "訂單編號" in body and "建立時間" in body

    def test_export_csv_filtered_completed(self):
        r = requests.get(f"{API}/admin/orders/export?status=completed", headers=H_ADMIN)
        assert r.status_code == 200
        body = r.content.decode("utf-8")
        # Header + 已完成 rows only (or just header if none)
        lines = [l for l in body.split("\n") if l.strip()]
        for line in lines[1:]:
            # Status column is the 3rd column
            parts = next(__import__("csv").reader([line]))
            assert parts[2] in ("已完成", "狀態")  # tolerate CSV quirks


# ----------------- Spec limits -----------------
class TestSpecLimits:
    def test_product_saved_with_limits(self, test_product):
        p = test_product
        specs = {s["label"]: s for s in p["specs"]}
        assert specs["限購A"]["limit"] == "daily" and specs["限購A"]["limit_count"] == 1
        assert specs["限購B"]["limit"] == "lifetime" and specs["限購B"]["limit_count"] == 2
        assert specs["限購C"]["limit"] == "none"
        assert specs["新客D"]["limit"] == "newcomer"
        assert specs["周E"]["limit"] == "weekly" and specs["周E"]["limit_count"] == 1

    def test_daily_limit_initial(self, test_product):
        r = requests.get(f"{API}/products/{test_product['id']}/daily-limit", headers=H_MEMBER)
        assert r.status_code == 200
        j = r.json()
        assert j["is_new_customer"] is False
        assert j["used_spec_ids"] == []
        specs = {s["label"]: s["id"] for s in test_product["specs"]}
        assert j["remaining"][specs["限購A"]] == 1
        assert j["remaining"][specs["限購B"]] == 2
        assert j["remaining"][specs["周E"]] == 1

    @pytest.fixture(scope="class")
    def spec_ids(self, test_product):
        return {s["label"]: s["id"] for s in test_product["specs"]}

    @pytest.fixture(scope="class")
    def _created_orders(self):
        return []

    def _mk_order(self, pid, sid, qty):
        return {
            "items": [{"product_id": pid, "spec_id": sid, "quantity": qty}],
            "currency": "USD", "recharge_account": "x", "recharge_note": "",
            "contact": "", "delivery_info": {}, "promo_code": None,
        }

    def test_A_daily_qty2_blocked(self, test_product, spec_ids):
        r = requests.post(f"{API}/orders", headers=H_MEMBER, json=self._mk_order(test_product["id"], spec_ids["限購A"], 2))
        assert r.status_code == 409
        assert "每日" in r.json().get("detail", "")

    def test_A_daily_qty1_ok(self, test_product, spec_ids, _created_orders):
        r = requests.post(f"{API}/orders", headers=H_MEMBER, json=self._mk_order(test_product["id"], spec_ids["限購A"], 1))
        assert r.status_code in (200, 201), r.text
        o = r.json()
        assert o["status"] == "pending_payment"
        _created_orders.append(o["id"])

    def test_daily_limit_after_A(self, test_product, spec_ids):
        r = requests.get(f"{API}/products/{test_product['id']}/daily-limit", headers=H_MEMBER)
        j = r.json()
        assert spec_ids["限購A"] in j["used_spec_ids"]
        assert j["remaining"][spec_ids["限購A"]] == 0

    def test_A_second_blocked(self, test_product, spec_ids):
        r = requests.post(f"{API}/orders", headers=H_MEMBER, json=self._mk_order(test_product["id"], spec_ids["限購A"], 1))
        assert r.status_code == 409

    def test_B_lifetime_qty2_ok(self, test_product, spec_ids, _created_orders):
        r = requests.post(f"{API}/orders", headers=H_MEMBER, json=self._mk_order(test_product["id"], spec_ids["限購B"], 2))
        assert r.status_code in (200, 201), r.text
        _created_orders.append(r.json()["id"])

    def test_B_lifetime_more_blocked(self, test_product, spec_ids):
        r = requests.post(f"{API}/orders", headers=H_MEMBER, json=self._mk_order(test_product["id"], spec_ids["限購B"], 1))
        assert r.status_code == 409

    def test_C_badge_but_none_no_limit(self, test_product, spec_ids, _created_orders):
        r = requests.post(f"{API}/orders", headers=H_MEMBER, json=self._mk_order(test_product["id"], spec_ids["限購C"], 3))
        assert r.status_code in (200, 201), r.text
        _created_orders.append(r.json()["id"])

    def test_D_newcomer_blocked(self, test_product, spec_ids):
        r = requests.post(f"{API}/orders", headers=H_MEMBER, json=self._mk_order(test_product["id"], spec_ids["新客D"], 1))
        assert r.status_code == 409
        assert "新用戶" in r.json().get("detail", "") or "新客" in r.json().get("detail", "")

    def test_E_weekly_ok_then_blocked(self, test_product, spec_ids, _created_orders):
        r1 = requests.post(f"{API}/orders", headers=H_MEMBER, json=self._mk_order(test_product["id"], spec_ids["周E"], 1))
        assert r1.status_code in (200, 201), r1.text
        _created_orders.append(r1.json()["id"])
        r2 = requests.post(f"{API}/orders", headers=H_MEMBER, json=self._mk_order(test_product["id"], spec_ids["周E"], 1))
        assert r2.status_code == 409

    def test_zz_cleanup_orders(self, _created_orders):
        for oid in _created_orders:
            r = requests.delete(f"{API}/orders/{oid}", headers=H_MEMBER)
            assert r.status_code == 200, r.text
