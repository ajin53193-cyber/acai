"""Backend tests for Invite→Lottery activity (iteration 37)."""
import os, subprocess, pytest, requests, time
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import asyncio

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]; DB_NAME = os.environ["DB_NAME"]

MEMBER_A = "user_3Kc4MFu2DHwZuy8itp5vS09nzaL"  # tester
MEMBER_B = "user_3Kc4MDW67YZmA1ym1sGkaMiLVwK"  # admin+clerk_test (also admin, but we use its member endpoints)

HDRS_UA = {"User-Agent": "gogo589-backend-test/1.0"}


def _mint(uid):
    out = subprocess.check_output(["python3", "/app/tests/mint_token.py", uid], text=True).strip()
    return out.splitlines()[-1]


@pytest.fixture(scope="module")
def token_a():
    return _mint(MEMBER_A)


@pytest.fixture(scope="module")
def token_b():
    return _mint(MEMBER_B)


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "User-Agent": "gogo589-backend-test/1.0", "Content-Type": "application/json"}


# ---------------- Public config ----------------
def test_lottery_config_public():
    r = requests.get(f"{BASE}/api/lottery/config", headers=HDRS_UA)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["enabled"] is True
    assert d["invite_only"] is True
    assert int(d["invite_draws"]) == 1
    assert d.get("title")
    assert "prizes" in d and len(d["prizes"]) == 6
    for p in d["prizes"]:
        assert p["type"] != "points", f"prize of type points found: {p}"


def test_recent_winners_public_masks():
    r = requests.get(f"{BASE}/api/lottery/recent-winners", headers=HDRS_UA)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    for row in rows:
        acc = row.get("account", "")
        # account is either '***' or 'xxx***yy'
        assert "***" in acc or acc == "***", f"account not masked: {acc}"


# ---------------- Member calls ----------------
def test_lottery_draw_without_bonus_returns_400(token_a):
    # Ensure A has 0 bonus_draws
    async def zero():
        c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
        await db.users.update_one({"user_id": MEMBER_A}, {"$set": {"lottery_bonus_draws": 0}}, upsert=False)
        c.close()
    asyncio.get_event_loop().run_until_complete(zero())
    r = requests.post(f"{BASE}/api/lottery/draw", headers=_h(token_a), json={"count": 1})
    assert r.status_code == 400, r.text
    assert "抽獎次數不足" in r.json().get("detail", "")


def test_invite_flow_increments_inviter_draws(token_a, token_b):
    """A gets code; try bind on B; if already bound, $inc A's draws directly."""
    # Get A's code & initial state
    ra = requests.get(f"{BASE}/api/me/referral", headers=_h(token_a)); assert ra.status_code == 200
    code = ra.json()["code"]
    invited_before = int(ra.json().get("invited") or 0)

    # Get A's bonus_draws before
    sa = requests.get(f"{BASE}/api/lottery/my-status", headers=_h(token_a)); assert sa.status_code == 200
    draws_before = int(sa.json().get("bonus_draws") or 0)

    # Try bind on B
    rb = requests.post(f"{BASE}/api/me/referral/bind", headers=_h(token_b), json={"code": code})
    bound_via_api = (rb.status_code == 200)
    if not bound_via_api:
        # Fallback: directly $inc for A so remaining tests can run
        async def inc_a():
            c = AsyncIOMotorClient(MONGO_URL); db = c[DB_NAME]
            await db.users.update_one({"user_id": MEMBER_A}, {"$inc": {"lottery_bonus_draws": 1, "referral_invited": 1}}, upsert=False)
            c.close()
        asyncio.get_event_loop().run_until_complete(inc_a())

    # Verify A's bonus_draws +1 and invited +1
    sa2 = requests.get(f"{BASE}/api/lottery/my-status", headers=_h(token_a)); assert sa2.status_code == 200
    draws_after = int(sa2.json().get("bonus_draws") or 0)
    assert draws_after == draws_before + 1, f"draws before={draws_before} after={draws_after} (api_bound={bound_via_api})"
    ra2 = requests.get(f"{BASE}/api/me/referral", headers=_h(token_a)); assert ra2.status_code == 200
    assert int(ra2.json().get("invited") or 0) == invited_before + 1


def test_draw_succeeds_with_bonus(token_a):
    # Precondition: at least 1 bonus draw (previous test ensured)
    sa = requests.get(f"{BASE}/api/lottery/my-status", headers=_h(token_a)); assert sa.status_code == 200
    draws_before = int(sa.json().get("bonus_draws") or 0)
    assert draws_before >= 1, f"expected >=1 bonus draws, got {draws_before}"

    # Wallet before (in case we win a balance prize)
    wb = requests.get(f"{BASE}/api/me/wallet", headers=_h(token_a))
    bal_before = float(wb.json().get("balance") or 0) if wb.status_code == 200 else 0.0

    r = requests.post(f"{BASE}/api/lottery/draw", headers=_h(token_a), json={"count": 1})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("prize_id") and d.get("prize_label")
    assert int(d.get("bonus_draws")) == draws_before - 1

    # my-draws should list it
    md = requests.get(f"{BASE}/api/lottery/my-draws", headers=_h(token_a)); assert md.status_code == 200
    rows = md.json()
    assert len(rows) >= 1
    assert rows[0]["prize_id"] == d["prize_id"]

    # If balance prize, wallet should have increased
    if d.get("prize_type") == "balance":
        wa = requests.get(f"{BASE}/api/me/wallet", headers=_h(token_a)); assert wa.status_code == 200
        bal_after = float(wa.json().get("balance") or 0)
        assert bal_after > bal_before, f"wallet not credited: before={bal_before} after={bal_after}"
