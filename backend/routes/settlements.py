"""Settlement domain routes: reconciliation summary + merchant/agent payouts.

Extracted from server.py following the orders-domain split. Infra (db) via core,
deps via deps, cross-cutting helpers (record_ledger, audit) via shared.
"""
from bson import ObjectId
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel

from core import db
from utils import serialize, iso, now_utc
from deps import get_current_user, require_roles, merchant_ids_for_scope
from shared import record_ledger, audit

router = APIRouter(prefix="/api")


@router.get("/settlements/reconciliation")
async def reconciliation(user: dict = Depends(get_current_user)):
    scope = await merchant_ids_for_scope(user)
    q = {"status": "paid"}
    if scope is not None:
        q["merchant_id"] = {"$in": [str(i) for i in scope]}
    orders = await db.orders.find(q).to_list(5000)

    by_merchant: dict = {}
    for o in orders:
        m = by_merchant.setdefault(o["merchant_id"], {
            "merchant_id": o["merchant_id"], "merchant_name": o["merchant_name"],
            "order_count": 0, "total_amount": 0.0, "total_fee": 0.0,
            "total_receive": 0.0, "total_commission": 0.0, "total_platform": 0.0,
        })
        m["order_count"] += 1
        m["total_amount"] += o["amount_usdt"]
        m["total_fee"] += o.get("fee", 0)
        m["total_receive"] += o.get("merchant_receive", 0)
        m["total_commission"] += o.get("agent_commission", 0)
        m["total_platform"] += o.get("platform_profit", 0)
    rows = []
    for m in by_merchant.values():
        for k in ["total_amount", "total_fee", "total_receive", "total_commission", "total_platform"]:
            m[k] = round(m[k], 2)
        rows.append(m)
    rows.sort(key=lambda x: x["total_amount"], reverse=True)
    return rows


@router.get("/settlements/payouts")
async def list_payouts(user: dict = Depends(get_current_user)):
    scope = await merchant_ids_for_scope(user)
    q: dict = {}
    if scope is not None:
        q["merchant_id"] = {"$in": [str(i) for i in scope]}
    payouts = await db.payouts.find(q).sort("created_at", -1).to_list(500)
    return [serialize(p) for p in payouts]


class PayoutCreate(BaseModel):
    amount: float


@router.post("/settlements/payouts")
async def request_payout(data: PayoutCreate, user: dict = Depends(get_current_user)):
    if user["role"] not in ["merchant", "agent"]:
        raise HTTPException(status_code=403, detail="仅商户/代理可提现")
    if data.amount <= 0 or data.amount > user.get("balance", 0):
        raise HTTPException(status_code=400, detail="余额不足")
    amt = round(data.amount, 2)
    doc = {
        "merchant_id": str(user["_id"]),
        "merchant_name": user["name"],
        "amount": amt,
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    r = await db.users.update_one({"_id": user["_id"], "balance": {"$gte": amt}},
                                  {"$inc": {"balance": -amt, "frozen_balance": amt}})
    if r.modified_count != 1:
        raise HTTPException(status_code=400, detail="余额不足")
    res = await db.payouts.insert_one(doc)
    doc["_id"] = res.inserted_id
    _u = await db.users.find_one({"_id": user["_id"]})
    await record_ledger(str(user["_id"]), "payout_freeze", -amt,
                        _u.get("balance", 0), _u.get("frozen_balance", 0),
                        "payout", res.inserted_id, remark="提现申请，冻结待审核")
    return serialize(doc)


@router.post("/settlements/payouts/{payout_id}/approve")
async def approve_payout(payout_id: str, request: Request, user: dict = Depends(require_roles("admin"))):
    p = await db.payouts.find_one_and_update({"_id": ObjectId(payout_id), "status": "pending"},
                                             {"$set": {"status": "approved", "approved_at": iso(now_utc())}})
    if not p:
        raise HTTPException(status_code=400, detail="提现单不存在或已处理")
    await db.users.update_one({"_id": ObjectId(p["merchant_id"])},
                              {"$inc": {"frozen_balance": -p["amount"]}})
    _u = await db.users.find_one({"_id": ObjectId(p["merchant_id"])})
    await record_ledger(p["merchant_id"], "payout_done", 0.0,
                        _u.get("balance", 0), _u.get("frozen_balance", 0),
                        "payout", payout_id, remark=f"提现 {p['amount']} USDT 已放款", operator=user["email"])
    await audit(user, "payout.approve", "payout", payout_id,
                {"merchant_name": p["merchant_name"], "amount": p["amount"]}, request)
    return {"ok": True}


@router.post("/settlements/payouts/{payout_id}/reject")
async def reject_payout(payout_id: str, request: Request, user: dict = Depends(require_roles("admin"))):
    p = await db.payouts.find_one_and_update({"_id": ObjectId(payout_id), "status": "pending"},
                                             {"$set": {"status": "rejected"}})
    if not p:
        raise HTTPException(status_code=400, detail="提现单不存在或已处理")
    await db.users.update_one({"_id": ObjectId(p["merchant_id"])},
                              {"$inc": {"balance": p["amount"], "frozen_balance": -p["amount"]}})
    _u = await db.users.find_one({"_id": ObjectId(p["merchant_id"])})
    await record_ledger(p["merchant_id"], "payout_reject", round(p["amount"], 2),
                        _u.get("balance", 0), _u.get("frozen_balance", 0),
                        "payout", payout_id, remark="提现被驳回，退回余额", operator=user["email"])
    await audit(user, "payout.reject", "payout", payout_id,
                {"merchant_name": p["merchant_name"], "amount": p["amount"]}, request)
    return {"ok": True}
