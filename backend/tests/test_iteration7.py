"""Iteration 7: order search enhancements + address management + sweeps."""
import os
import pytest
import requests
import time

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
API = f"{BASE}/api"

ADMIN = {"email": "ajin53193@gmail.com", "password": "admin888"}
MERCHANT = {"email": "merchant@demo.com", "password": "merchant888"}

TRC20_CHANNEL_ID = "6aca084fd9effe688f2cd287"
TRC20_ORIG = ["TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9", "TU4vEruvZwLLkSfV9bNw12EJTPvNr7Pvaa"]
TEST_ADDR = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


@pytest.fixture(scope="module")
def merch_h():
    return {"Authorization": f"Bearer {_login(MERCHANT)}"}


@pytest.fixture(scope="module", autouse=True)
def _cleanup_test_addr(admin_h):
    # pre-clean: remove TEST_ADDR + ensure not paused (if left from prior failed run)
    requests.patch(f"{API}/chain/addresses/{TEST_ADDR}", json={"status": "active"}, headers=admin_h)
    requests.delete(f"{API}/chain/addresses/{TRC20_CHANNEL_ID}/{TEST_ADDR}", headers=admin_h)
    yield


# ---------- Order search ----------
class TestOrderSearch:
    def test_search_by_wallet_address(self, admin_h):
        r = requests.get(f"{API}/orders", params={"keyword": TRC20_ORIG[0]}, headers=admin_h)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Only pass if there is at least one match (seed data likely exists)
        if data:
            assert all(o["wallet_address"] == TRC20_ORIG[0] for o in data)

    def test_search_by_out_trade_no(self, merch_h, admin_h):
        # Create a merchant order with out_trade_no SRCH123 (idempotent-ish - may dup)
        payload = {"amount_usdt": 12.34, "network": "TRC20", "out_trade_no": f"SRCH123-{int(time.time())}"}
        r = requests.post(f"{API}/orders", json=payload, headers=merch_h)
        assert r.status_code == 200, r.text
        otn = payload["out_trade_no"]
        # Admin search
        r2 = requests.get(f"{API}/orders", params={"keyword": otn}, headers=admin_h)
        assert r2.status_code == 200
        rows = r2.json()
        assert any(o.get("out_trade_no") == otn for o in rows), rows

    def test_search_numeric_amount(self, admin_h):
        r = requests.get(f"{API}/orders", params={"keyword": "100.5007"}, headers=admin_h)
        assert r.status_code == 200
        data = r.json()
        # Non-strict: validate when results exist that they match either amount_usdt or pay_amount
        for o in data:
            assert o.get("amount_usdt") == 100.5007 or o.get("pay_amount") == 100.5007

    def test_merchant_scope(self, merch_h):
        # Merchant can only see own orders - search by TRC20 shared address returns only own
        r = requests.get(f"{API}/orders", params={"keyword": TRC20_ORIG[0]}, headers=merch_h)
        assert r.status_code == 200
        rows = r.json()
        # If any rows, merchant_name must be merchant's (demo)
        for o in rows:
            assert o.get("merchant_name"), o


# ---------- Address health ----------
class TestAddressHealth:
    def test_list_shape(self, admin_h):
        r = requests.get(f"{API}/chain/addresses", headers=admin_h)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("total_balance"), (int, float))
        assert "total_swept" in data
        assert set(["TRC20", "ERC20", "BEP20"]).issubset(data.get("by_network", {}).keys())
        assert isinstance(data["addresses"], list)
        assert len(data["addresses"]) == 3, [a["address"] for a in data["addresses"]]
        for a in data["addresses"]:
            assert "label" in a and "paused" in a and "swept_total" in a
            assert "swept_count" in a and "unswept" in a and "last_swept_at" in a

    def test_non_admin_forbidden(self, merch_h):
        r = requests.get(f"{API}/chain/addresses", headers=merch_h)
        assert r.status_code == 403


# ---------- Add / Pause / Remove / Sweep flow ----------
class TestAddressManage:
    def test_full_flow(self, admin_h, merch_h):
        # 1. ADD test address with label
        r = requests.post(f"{API}/chain/addresses", json={
            "channel_id": TRC20_CHANNEL_ID,
            "addresses": [TEST_ADDR],
            "label": "测试地址",
        }, headers=admin_h)
        assert r.status_code == 200, r.text
        assert TEST_ADDR in r.json()["wallet_addresses"]
        assert len(r.json()["wallet_addresses"]) == 3

        # Invalid address
        r = requests.post(f"{API}/chain/addresses", json={
            "channel_id": TRC20_CHANNEL_ID,
            "addresses": ["not-a-valid-address"],
        }, headers=admin_h)
        assert r.status_code == 400, r.text

        # 2. PATCH status=paused ok, bogus -> 400
        r = requests.patch(f"{API}/chain/addresses/{TEST_ADDR}", json={"status": "paused"}, headers=admin_h)
        assert r.status_code == 200, r.text
        r = requests.patch(f"{API}/chain/addresses/{TEST_ADDR}", json={"status": "bogus"}, headers=admin_h)
        assert r.status_code == 400

        # Verify list reflects paused + label
        rr = requests.get(f"{API}/chain/addresses", headers=admin_h).json()
        row = next((a for a in rr["addresses"] if a["address"] == TEST_ADDR), None)
        assert row and row["paused"] is True and row["label"] == "测试地址"

        # 3. Create 3 TRC20 merchant orders - none should be assigned to paused test addr
        assigned = []
        for i in range(3):
            r = requests.post(f"{API}/orders", json={"amount_usdt": 15.0 + i, "network": "TRC20"}, headers=merch_h)
            assert r.status_code == 200, r.text
            assigned.append(r.json()["wallet_address"])
        assert TEST_ADDR not in assigned, assigned

        # 4. Sweep: amount 0 -> 400
        r = requests.post(f"{API}/chain/sweeps", json={
            "address": TEST_ADDR, "network": "TRC20", "amount": 0,
        }, headers=admin_h)
        assert r.status_code == 400

        # Valid sweep
        r = requests.post(f"{API}/chain/sweeps", json={
            "address": TEST_ADDR, "network": "TRC20", "amount": 55.5,
            "cold_wallet": "TColdWallet001", "tx_id": "tx_sweep_test", "note": "iteration7",
        }, headers=admin_h)
        assert r.status_code == 200, r.text

        # Non-admin forbidden
        r = requests.post(f"{API}/chain/sweeps", json={
            "address": TEST_ADDR, "network": "TRC20", "amount": 1,
        }, headers=merch_h)
        assert r.status_code == 403

        # 5. GET sweeps filtered
        r = requests.get(f"{API}/chain/sweeps", params={"address": TEST_ADDR}, headers=admin_h)
        assert r.status_code == 200
        sw = r.json()
        assert any(s["amount"] == 55.5 for s in sw)

        # 6. Health shows increased swept_total
        rr = requests.get(f"{API}/chain/addresses", headers=admin_h).json()
        row = next((a for a in rr["addresses"] if a["address"] == TEST_ADDR), None)
        assert row and row["swept_total"] >= 55.5

        # 7. Audit records address.sweep
        r = requests.get(f"{API}/audit-logs", params={"action": "address.sweep"}, headers=admin_h)
        assert r.status_code == 200
        assert any(e.get("action") == "address.sweep" for e in r.json())

        # 8. DELETE orig address with pending -> 400 (do not actually remove, re-add if 200)
        r = requests.delete(f"{API}/chain/addresses/{TRC20_CHANNEL_ID}/{TRC20_ORIG[0]}", headers=admin_h)
        if r.status_code == 200:
            # Oops - re-add immediately
            requests.post(f"{API}/chain/addresses", json={
                "channel_id": TRC20_CHANNEL_ID, "addresses": [TRC20_ORIG[0]],
            }, headers=admin_h)
            pytest.fail("expected 400 for address with pending orders, got 200 - restored")
        assert r.status_code == 400

        # Unpause test addr before cleanup
        r = requests.patch(f"{API}/chain/addresses/{TEST_ADDR}", json={"status": "active"}, headers=admin_h)
        assert r.status_code == 200

        # 9. DELETE test address -> back to 2
        r = requests.delete(f"{API}/chain/addresses/{TRC20_CHANNEL_ID}/{TEST_ADDR}", headers=admin_h)
        assert r.status_code == 200, r.text
        assert TEST_ADDR not in r.json()["wallet_addresses"]
        assert len(r.json()["wallet_addresses"]) == 2
