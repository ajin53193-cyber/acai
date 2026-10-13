"""
Backend tests for iteration 3 admin features:
- Wallet management (/api/admin/wallets, adjust, tx)
- Verification admin review (image + status update)
- Feedback admin (list + resolve/reopen)
And member-side sync (/api/me/wallet, /api/me/verifications).
"""
import os
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crossborder-topup.preview.emergentagent.com").rstrip("/")
ADMIN_UID = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"
TESTER_UID = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"


def _mint(uid: str) -> str:
    out = subprocess.check_output(["python3", "/app/tests/mint_token.py", uid], text=True)
    return out.strip()


@pytest.fixture(scope="module")
def admin_token():
    return _mint(ADMIN_UID)


@pytest.fixture(scope="module")
def tester_token():
    return _mint(TESTER_UID)


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "User-Agent": "gogo589-test/1.0", "Content-Type": "application/json"}


# ---------------- Wallet admin ----------------

def test_admin_wallets_list(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/wallets", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) >= 1
    item = data[0]
    for k in ("user_id", "email", "balance_usd", "total_in_usd", "total_out_usd", "tx_count"):
        assert k in item, f"missing {k}"


def test_admin_wallets_search_filter(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/wallets", headers=_h(admin_token), params={"q": "tester"}, timeout=30)
    assert r.status_code == 200
    rows = r.json()
    assert any("tester" in (x.get("email") or "").lower() for x in rows)


def test_admin_wallets_member_forbidden(tester_token):
    r = requests.get(f"{BASE_URL}/api/admin/wallets", headers=_h(tester_token), timeout=30)
    assert r.status_code == 403, r.text


def test_wallet_adjust_credit_debit_refund_and_sync(admin_token, tester_token):
    # starting balance
    r0 = requests.get(f"{BASE_URL}/api/me/wallet", headers=_h(tester_token), timeout=30)
    assert r0.status_code == 200, r0.text
    start = float(r0.json()["balance_usd"])

    url = f"{BASE_URL}/api/admin/wallets/{TESTER_UID}/adjust"

    # credit +10
    r = requests.post(url, headers=_h(admin_token), json={"kind": "credit", "amount_usd": 10, "note": "QA"}, timeout=30)
    assert r.status_code == 200, r.text
    assert float(r.json()["balance_usd"]) == pytest.approx(start + 10, abs=0.01)

    # debit -3
    r = requests.post(url, headers=_h(admin_token), json={"kind": "debit", "amount_usd": 3, "note": "QA"}, timeout=30)
    assert r.status_code == 200, r.text
    assert float(r.json()["balance_usd"]) == pytest.approx(start + 7, abs=0.01)

    # refund +1
    r = requests.post(url, headers=_h(admin_token), json={"kind": "refund", "amount_usd": 1, "note": "QA"}, timeout=30)
    assert r.status_code == 200, r.text
    final = float(r.json()["balance_usd"])
    assert final == pytest.approx(start + 8, abs=0.01)

    # Member GET /api/me/wallet reflects
    r2 = requests.get(f"{BASE_URL}/api/me/wallet", headers=_h(tester_token), timeout=30)
    assert r2.status_code == 200
    body = r2.json()
    assert float(body["balance_usd"]) == pytest.approx(final, abs=0.01)
    kinds = [t.get("kind") for t in body.get("transactions", [])]
    assert "admin_credit" in kinds and "admin_debit" in kinds and "admin_refund" in kinds
    # note prefix check
    for t in body["transactions"]:
        if t.get("kind") == "admin_credit":
            assert (t.get("note") or "").startswith("後台加款"), t
            break

    # admin tx endpoint
    r3 = requests.get(f"{BASE_URL}/api/admin/wallets/{TESTER_UID}/transactions", headers=_h(admin_token), timeout=30)
    assert r3.status_code == 200
    txs = r3.json()
    assert isinstance(txs, list) and len(txs) >= 3


def test_wallet_adjust_debit_over_balance_402(admin_token):
    url = f"{BASE_URL}/api/admin/wallets/{TESTER_UID}/adjust"
    # Use amount within cap (<=100000) but definitely over balance (~$556)
    r = requests.post(url, headers=_h(admin_token), json={"kind": "debit", "amount_usd": 99999, "note": "QA"}, timeout=30)
    assert r.status_code == 402, r.text


def test_wallet_adjust_invalid_amount_and_kind(admin_token):
    url = f"{BASE_URL}/api/admin/wallets/{TESTER_UID}/adjust"
    r = requests.post(url, headers=_h(admin_token), json={"kind": "credit", "amount_usd": 0, "note": "QA"}, timeout=30)
    assert r.status_code == 400, r.text
    r2 = requests.post(url, headers=_h(admin_token), json={"kind": "foo", "amount_usd": 1}, timeout=30)
    assert r2.status_code == 400, r2.text


def test_wallet_adjust_unknown_user_404(admin_token):
    url = f"{BASE_URL}/api/admin/wallets/user_doesnotexist_xxx/adjust"
    r = requests.post(url, headers=_h(admin_token), json={"kind": "credit", "amount_usd": 1}, timeout=30)
    assert r.status_code == 404, r.text


# ---------------- Verifications ----------------

def test_admin_verifications_flow(admin_token, tester_token):
    r = requests.get(f"{BASE_URL}/api/admin/verifications", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    if not items:
        pytest.skip("no verifications seeded")
    vid = items[0]["id"]

    # Image
    ri = requests.get(f"{BASE_URL}/api/admin/verifications/{vid}/image", headers=_h(admin_token), timeout=30)
    assert ri.status_code == 200, ri.text
    img = ri.json()
    assert "data_url" in img and img["data_url"].startswith("data:image/")

    # Approve
    ru = requests.put(f"{BASE_URL}/api/admin/verifications/{vid}",
                     headers=_h(admin_token),
                     json={"status": "approved", "admin_note": "QA approve"}, timeout=30)
    assert ru.status_code == 200, ru.text
    assert ru.json().get("status") == "approved"

    # Member sees it
    rm = requests.get(f"{BASE_URL}/api/me/verifications", headers=_h(tester_token), timeout=30)
    assert rm.status_code == 200
    mine = rm.json()
    found = next((x for x in mine if x["id"] == vid), None)
    assert found and found["status"] == "approved"
    assert found.get("admin_note") == "QA approve"

    # Invalid status
    rb = requests.put(f"{BASE_URL}/api/admin/verifications/{vid}",
                     headers=_h(admin_token), json={"status": "weird"}, timeout=30)
    assert rb.status_code == 400, rb.text


def test_admin_verifications_member_forbidden(tester_token):
    r = requests.get(f"{BASE_URL}/api/admin/verifications", headers=_h(tester_token), timeout=30)
    assert r.status_code == 403


# ---------------- Feedback ----------------

def test_admin_feedback_resolve_reopen(admin_token, tester_token):
    r = requests.get(f"{BASE_URL}/api/admin/feedback", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200
    items = r.json()
    if not items:
        # Create one via tester
        rc = requests.post(f"{BASE_URL}/api/me/feedback", headers=_h(tester_token),
                           json={"kind": "suggestion", "topic": "QA", "content": "test", "contact": "qa@x.com"}, timeout=30)
        assert rc.status_code in (200, 201), rc.text
        r = requests.get(f"{BASE_URL}/api/admin/feedback", headers=_h(admin_token), timeout=30)
        items = r.json()
    assert items
    fid = items[0]["id"]

    # resolve
    r1 = requests.put(f"{BASE_URL}/api/admin/feedback/{fid}",
                     headers=_h(admin_token), json={"status": "resolved", "admin_note": "QA done"}, timeout=30)
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body.get("status") == "resolved"
    assert body.get("admin_note") == "QA done"
    assert body.get("handled_by") and body.get("handled_at")

    # reopen
    r2 = requests.put(f"{BASE_URL}/api/admin/feedback/{fid}",
                     headers=_h(admin_token), json={"status": "open"}, timeout=30)
    assert r2.status_code == 200
    assert r2.json().get("status") == "open"

    # invalid
    r3 = requests.put(f"{BASE_URL}/api/admin/feedback/{fid}",
                     headers=_h(admin_token), json={"status": "weird"}, timeout=30)
    assert r3.status_code == 400


def test_admin_feedback_member_forbidden(tester_token):
    r = requests.get(f"{BASE_URL}/api/admin/feedback", headers=_h(tester_token), timeout=30)
    assert r.status_code == 403
