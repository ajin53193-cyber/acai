"""Order domain routes: create / list / public view / pay simulation /
admin verify-reject-callback / batch ops / merchant Open API (v1).

Business logic lives in services.py; cross-cutting infra in shared.py; the few
Open-API signing helpers stay in server.py and are imported late (this router is
included at the bottom of server.py, after server is fully defined).
"""
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Request, Query, HTTPException
from pydantic import BaseModel

from core import db
from utils import iso, now_utc, serialize
from deps import get_current_user, require_roles, merchant_ids_for_scope
from models import OrderCreate, ApiOrderCreate, ApiOrderQuery
from services import build_order, mark_paid
from shared import enqueue_callback, deliver_callback, audit
from server import api_pay_url, verify_api_request, api_order_view

router = APIRouter(prefix="/api")


@router.post("/orders")
async def create_order(data: OrderCreate, user: dict = Depends(get_current_user)):
    if user["role"] == "merchant":
        merchant = user
    else:
        if not data.merchant_id:
            raise HTTPException(status_code=400, detail="请选择商户")
        merchant = await db.users.find_one({"_id": ObjectId(data.merchant_id), "role": "merchant"})
        if not merchant:
            raise HTTPException(status_code=404, detail="商户不存在")
    order = await build_order(merchant, data.amount_usdt, data.network, data.remark, data.notify_url, data.out_trade_no)
    return serialize(order)


@router.post("/v1/orders")
async def api_create_order(data: ApiOrderCreate, request: Request):
    body = data.model_dump()
    merchant = await verify_api_request(body, request)
    dup = await db.orders.find_one({"merchant_id": str(merchant["_id"]), "out_trade_no": data.out_trade_no})
    if dup:
        return {"code": 0, "msg": "duplicate", "data": api_order_view(dup)}
    order = await build_order(merchant, data.amount_usdt, data.network, data.remark, data.notify_url, data.out_trade_no)
    return {"code": 0, "msg": "success", "data": api_order_view(order)}


@router.post("/v1/orders/query")
async def api_query_order(data: ApiOrderQuery, request: Request):
    body = data.model_dump()
    merchant = await verify_api_request(body, request)
    q: dict = {"merchant_id": str(merchant["_id"])}
    if data.order_no:
        q["order_no"] = data.order_no
    elif data.out_trade_no:
        q["out_trade_no"] = data.out_trade_no
    else:
        raise HTTPException(status_code=400, detail="需提供 order_no 或 out_trade_no")
    o = await db.orders.find_one(q)
    if not o:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {"code": 0, "msg": "success", "data": api_order_view(o)}


@router.get("/notifications/paid")
async def paid_notifications(since: str, user: dict = Depends(get_current_user)):
    scope = await merchant_ids_for_scope(user)
    q: dict = {"status": "paid", "paid_at": {"$gt": since}}
    if scope is not None:
        q["merchant_id"] = {"$in": [str(i) for i in scope]}
    orders = await db.orders.find(q).sort("paid_at", -1).to_list(20)
    return {"now": iso(now_utc()), "orders": [
        {"order_no": o["order_no"], "amount_usdt": o["amount_usdt"], "merchant_name": o["merchant_name"],
         "network": o["network"], "live": o.get("live", False), "paid_at": o["paid_at"]} for o in orders]}


@router.get("/orders")
async def list_orders(user: dict = Depends(get_current_user),
                      status: Optional[str] = None, network: Optional[str] = None,
                      keyword: Optional[str] = None, merchant_id: Optional[str] = None,
                      date: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None,
                      limit: int = Query(200, le=1000)):
    scope = await merchant_ids_for_scope(user)
    q: dict = {}
    if scope is not None:
        q["merchant_id"] = {"$in": [str(i) for i in scope]}
    if merchant_id and (scope is None or ObjectId(merchant_id) in scope):
        q["merchant_id"] = str(merchant_id)
    if start and end:
        try:
            ds = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            de = datetime.strptime(end, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")
        q["created_at"] = {"$gte": iso(ds), "$lt": iso(de)}
    elif date:
        try:
            ds = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="date 格式应为 YYYY-MM-DD")
        q["created_at"] = {"$gte": iso(ds), "$lt": iso(ds + timedelta(days=1))}
    if status:
        q["status"] = status
    if network:
        q["network"] = network
    if keyword:
        kw = keyword.strip()
        q["$or"] = [{"order_no": {"$regex": kw, "$options": "i"}},
                    {"tx_id": {"$regex": kw, "$options": "i"}},
                    {"out_trade_no": {"$regex": kw, "$options": "i"}},
                    {"wallet_address": {"$regex": kw, "$options": "i"}},
                    {"merchant_name": {"$regex": kw, "$options": "i"}}]
        if re.fullmatch(r"\d+(\.\d+)?", kw):
            q["$or"] += [{"amount_usdt": float(kw)}, {"pay_amount": float(kw)}]
    orders = await db.orders.find(q).sort("created_at", -1).to_list(limit)
    return [serialize(o) for o in orders]


@router.get("/orders/{order_no}/public")
async def get_order_public(order_no: str):
    order = await db.orders.find_one({"order_no": order_no})
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    # auto-expire
    if order["status"] == "pending" and datetime.fromisoformat(order["expires_at"]) < now_utc():
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "expired"}})
        order["status"] = "expired"
    net = order["network"]
    explorer = f"https://tronscan.org/#/address/{order['wallet_address']}"
    tx_url = None
    if order.get("tx_id") and order.get("live"):
        tx_url = f"https://tronscan.org/#/transaction/{order['tx_id']}"
    return {
        "order_no": order["order_no"],
        "amount_usdt": order["amount_usdt"],
        "pay_amount": order.get("pay_amount", order["amount_usdt"]),
        "live": order.get("live", False),
        "network": net,
        "wallet_address": order["wallet_address"],
        "status": order["status"],
        "merchant_name": order["merchant_name"],
        "created_at": order["created_at"],
        "expires_at": order["expires_at"],
        "tx_id": order.get("tx_id"),
        "explorer_url": explorer,
        "tx_url": tx_url,
    }


@router.post("/orders/{order_no}/simulate-pay")
async def simulate_pay(order_no: str):
    order = await db.orders.find_one({"order_no": order_no})
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order["status"] == "paid":
        return {"ok": True, "status": "paid"}
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="订单状态不可支付")
    if order.get("live"):
        raise HTTPException(status_code=400, detail="真实链上订单不支持模拟支付，请向收款地址转账")
    await mark_paid(order)
    return {"ok": True, "status": "paid"}


@router.post("/orders/{order_id}/verify")
async def manual_verify(order_id: str, request: Request, user: dict = Depends(require_roles("admin"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order["status"] == "paid":
        raise HTTPException(status_code=400, detail="订单已支付")
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "pending"}})
    order["status"] = "pending"
    await mark_paid(order)
    await audit(user, "order.manual_verify", "order", order["order_no"],
                {"amount_usdt": order["amount_usdt"]}, request)
    return {"ok": True}


@router.post("/orders/{order_id}/reject")
async def reject_order(order_id: str, request: Request, user: dict = Depends(require_roles("admin"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order["status"] == "paid":
        raise HTTPException(status_code=400, detail="订单已支付，无法驳回")
    if order["status"] == "rejected":
        return {"ok": True, "status": "rejected"}
    await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "rejected", "rejected_at": iso(now_utc())}})
    await audit(user, "order.reject", "order", order["order_no"], {"amount_usdt": order["amount_usdt"]}, request)
    return {"ok": True, "status": "rejected"}


@router.post("/orders/{order_id}/resend-callback")
async def resend_callback(order_id: str, request: Request, user: dict = Depends(require_roles("admin"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order["status"] != "paid":
        raise HTTPException(status_code=400, detail="仅已支付订单可手动回调")
    if not order.get("notify_url"):
        raise HTTPException(status_code=400, detail="该订单未配置回调地址")
    await enqueue_callback(order)
    cb = await db.callbacks.find_one({"order_no": order["order_no"]}, sort=[("created_at", -1)])
    if cb:
        await deliver_callback(cb)
        cb = await db.callbacks.find_one({"_id": cb["_id"]})
    await audit(user, "order.resend_callback", "order", order["order_no"], {}, request)
    return {"ok": True, "callback": serialize(cb) if cb else None}


class BatchOrderIds(BaseModel):
    ids: List[str]


@router.post("/orders/batch-reject")
async def batch_reject_orders(data: BatchOrderIds, request: Request, user: dict = Depends(require_roles("admin"))):
    success, failed = [], []
    for oid in data.ids:
        try:
            order = await db.orders.find_one({"_id": ObjectId(oid)})
            if not order:
                failed.append({"id": oid, "reason": "订单不存在"}); continue
            if order["status"] == "paid":
                failed.append({"id": oid, "order_no": order["order_no"], "reason": "已支付，无法驳回"}); continue
            if order["status"] == "rejected":
                success.append({"id": oid, "order_no": order["order_no"]}); continue
            await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "rejected", "rejected_at": iso(now_utc())}})
            await audit(user, "order.reject", "order", order["order_no"], {"amount_usdt": order["amount_usdt"], "batch": True}, request)
            success.append({"id": oid, "order_no": order["order_no"]})
        except Exception as e:
            failed.append({"id": oid, "reason": str(e)[:100]})
    return {"ok": True, "total": len(data.ids), "success_count": len(success), "failed_count": len(failed),
            "success": success, "failed": failed}


@router.post("/orders/batch-resend-callback")
async def batch_resend_callback(data: BatchOrderIds, request: Request, user: dict = Depends(require_roles("admin"))):
    success, failed = [], []
    for oid in data.ids:
        try:
            order = await db.orders.find_one({"_id": ObjectId(oid)})
            if not order:
                failed.append({"id": oid, "reason": "订单不存在"}); continue
            if order["status"] != "paid":
                failed.append({"id": oid, "order_no": order["order_no"], "reason": "仅已支付订单可回调"}); continue
            if not order.get("notify_url"):
                failed.append({"id": oid, "order_no": order["order_no"], "reason": "未配置回调地址"}); continue
            await enqueue_callback(order)
            cb = await db.callbacks.find_one({"order_no": order["order_no"]}, sort=[("created_at", -1)])
            if cb:
                await deliver_callback(cb)
            await audit(user, "order.resend_callback", "order", order["order_no"], {"batch": True}, request)
            success.append({"id": oid, "order_no": order["order_no"]})
        except Exception as e:
            failed.append({"id": oid, "reason": str(e)[:100]})
    return {"ok": True, "total": len(data.ids), "success_count": len(success), "failed_count": len(failed),
            "success": success, "failed": failed}
