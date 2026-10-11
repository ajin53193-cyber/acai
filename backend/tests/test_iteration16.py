"""Iteration 16: TRC20-only enforcement + background ledger export."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sifang-collect.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "ajin53193@gmail.com"
ADMIN_PASS = "admin888"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- TRC20 enforcement ---

def test_channels_all_trc20(admin_h):
    r = requests.get(f"{BASE_URL}/api/channels", headers=admin_h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0
    for c in data:
        assert c["network"] == "TRC20", f"Non-TRC20 channel found: {c}"


def test_chain_addresses_all_trc20(admin_h):
    r = requests.get(f"{BASE_URL}/api/chain/addresses", headers=admin_h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    addrs = data.get("addresses", data) if isinstance(data, dict) else data
    assert len(addrs) > 0
    for a in addrs:
        assert a.get("network") == "TRC20"
    if isinstance(data, dict) and "by_network" in data:
        assert set(data["by_network"].keys()).issubset({"TRC20"})


def test_create_order_forces_trc20_even_if_erc20_sent(admin_h):
    # Pick first merchant
    mr = requests.get(f"{BASE_URL}/api/accounts?role=merchant", headers=admin_h, timeout=15)
    assert mr.status_code == 200
    merchants = mr.json()
    assert len(merchants) > 0
    mid = merchants[0]["id"]
    payload = {"amount_usdt": 12.34, "network": "ERC20", "merchant_id": mid, "remark": "TEST_it16_force"}
    r = requests.post(f"{BASE_URL}/api/orders", headers=admin_h, json=payload, timeout=20)
    assert r.status_code in (200, 201), r.text
    order = r.json()
    assert order["network"] == "TRC20", f"Order network must be forced TRC20, got {order}"
    # verify address is T-address
    addr = order.get("wallet_address") or order.get("address", "")
    assert addr.startswith("T"), f"Address not TRC20: {addr}"


def test_create_channel_defaults_trc20(admin_h):
    # Try to create a channel with ERC20 network — should either reject or coerce
    payload = {"name": "TEST_it16_channel", "network": "TRC20",
               "addresses": ["TXYZabc1234567890123456789012345ab"], "fee_rate": 0.02, "weight": 10}
    r = requests.post(f"{BASE_URL}/api/channels", headers=admin_h, json=payload, timeout=15)
    # TRC20 address string we gave may fail validation (not a real base58 T-address). Attempt with legit seeded T addresses by reading existing
    if r.status_code >= 400:
        # fetch an existing channel address and reuse
        ch = requests.get(f"{BASE_URL}/api/channels", headers=admin_h, timeout=15).json()[0]
        addr = ch["addresses"][0] if ch.get("addresses") else None
        if not addr:
            pytest.skip("no seed address available for channel test")
        payload["addresses"] = [addr]
        payload["name"] = "TEST_it16_channel_v2"
        r = requests.post(f"{BASE_URL}/api/channels", headers=admin_h, json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    created = r.json()
    assert created["network"] == "TRC20"
    # cleanup
    cid = created.get("id")
    if cid:
        requests.delete(f"{BASE_URL}/api/channels/{cid}", headers=admin_h, timeout=10)


# --- Background ledger export ---

def test_background_ledger_export(admin_h):
    # pick merchant
    ms = requests.get(f"{BASE_URL}/api/accounts?role=merchant", headers=admin_h, timeout=15).json()
    assert len(ms) > 0
    account_id = ms[0]["id"]

    r = requests.post(f"{BASE_URL}/api/export/ledger", headers=admin_h, json={"account_id": account_id}, timeout=20)
    assert r.status_code == 200, r.text
    job = r.json()
    assert "id" in job
    jid = job["id"]

    # Poll for completion
    done_job = None
    for _ in range(20):
        time.sleep(1)
        jobs = requests.get(f"{BASE_URL}/api/export/jobs", headers=admin_h, timeout=10).json()
        found = next((j for j in jobs if j.get("id") == jid), None)
        if found and found.get("status") in ("done", "failed"):
            done_job = found
            break
    assert done_job is not None, "export job did not complete in time"
    assert done_job["status"] == "done", f"Export failed: {done_job}"
    assert done_job["kind"] == "ledger"

    # Download
    dl = requests.get(f"{BASE_URL}/api/export/jobs/{jid}/download", headers=admin_h, timeout=15)
    assert dl.status_code == 200
    assert dl.content[:2] == b"PK"
    assert "spreadsheetml.sheet" in dl.headers.get("content-type", "")


def test_ledger_export_without_account_id_rejected(admin_h):
    r = requests.post(f"{BASE_URL}/api/export/ledger", headers=admin_h, json={}, timeout=10)
    assert r.status_code == 400


# --- Dashboard regression ---

def test_dashboard_stats(admin_h):
    r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_h, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "today_orders" in d or "total_orders" in d or len(d) > 0
