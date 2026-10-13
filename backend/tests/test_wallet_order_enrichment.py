"""Test GET /api/me/wallet enriches payment txs with order items."""
import os, subprocess, requests, pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")
MEMBER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"


@pytest.fixture(scope="module")
def member_token():
    r = subprocess.run(["python", "/app/tests/mint_token.py", MEMBER_UID], capture_output=True, text=True, timeout=30)
    assert r.returncode == 0, r.stderr
    return r.stdout.strip()


@pytest.fixture(scope="module")
def auth_headers(member_token):
    return {"Authorization": f"Bearer {member_token}", "User-Agent": "gogo589-test/1.0"}


def test_wallet_endpoint_200(auth_headers):
    r = requests.get(f"{BASE_URL}/api/me/wallet", headers=auth_headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "balance_usd" in data
    assert "transactions" in data
    assert isinstance(data["transactions"], list)


def test_payment_tx_has_order_items(auth_headers):
    r = requests.get(f"{BASE_URL}/api/me/wallet", headers=auth_headers, timeout=20)
    data = r.json()
    payment_txs = [t for t in data["transactions"] if t.get("kind") == "payment"]
    assert len(payment_txs) > 0, "member should have at least one payment transaction"
    enriched = [t for t in payment_txs if t.get("order")]
    assert len(enriched) > 0, "at least one payment tx must be enriched with 'order'"
    for t in enriched:
        o = t["order"]
        assert "id" in o and "order_no" in o and "status" in o and "items" in o
        assert isinstance(o["items"], list) and len(o["items"]) > 0
        it = o["items"][0]
        for k in ("product_name", "spec_label", "quantity", "image"):
            assert k in it, f"missing {k} in order item: {it}"


def test_topup_tx_has_no_order(auth_headers):
    r = requests.get(f"{BASE_URL}/api/me/wallet", headers=auth_headers, timeout=20)
    data = r.json()
    topups = [t for t in data["transactions"] if t.get("kind") == "topup"]
    if not topups:
        pytest.skip("no topup transactions for this member")
    for t in topups:
        assert "order" not in t or t.get("order") is None, f"topup tx should not have order: {t}"
