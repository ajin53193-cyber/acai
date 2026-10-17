"""Developer API console routes (admin/operator): 代商户查看凭证 / 对接文档 / 在线测试.

First domain extracted from server.py as part of the routes/ modularization.
Shared infra (db) comes from core; shared deps/services are imported from server
after definition (server includes this router at the bottom), avoiding circular imports.
"""
import secrets

from bson import ObjectId
from fastapi import APIRouter, Depends, Request, HTTPException

from core import db
from utils import now_utc, iso, canon, sign_payload
from models import DevTestOrder
from deps import get_current_user
from services import build_order
from shared import audit
from server import api_order_view

router = APIRouter(prefix="/api")


def _require_dev(user: dict):
    if user["role"] not in ("admin", "operator"):
        raise HTTPException(status_code=403, detail="无权限")


@router.get("/dev/merchants")
async def dev_list_merchants(user: dict = Depends(get_current_user)):
    _require_dev(user)
    ms = await db.users.find({"role": "merchant"}).sort("created_at", -1).to_list(500)
    return [{"id": str(m["_id"]), "name": m["name"], "email": m["email"],
             "status": m.get("status", "active"),
             "api_key": m.get("api_key", ""),
             "gateway_code": m.get("gateway_code", ""),
             "api_domain": m.get("api_domain", ""),
             "notify_url": m.get("notify_url") or "", "ip_whitelist": m.get("ip_whitelist") or []}
            for m in ms]


@router.post("/dev/test-order")
async def dev_test_order(data: DevTestOrder, request: Request, user: dict = Depends(get_current_user)):
    _require_dev(user)
    merchant = await db.users.find_one({"_id": ObjectId(data.merchant_id), "role": "merchant"})
    if not merchant:
        raise HTTPException(status_code=404, detail="商户不存在")
    out_no = data.out_trade_no or ("T" + str(int(now_utc().timestamp() * 1000)))
    body: dict = {"api_key": merchant.get("api_key", ""), "timestamp": int(now_utc().timestamp()),
                  "nonce": secrets.token_hex(6), "amount_usdt": data.amount_usdt,
                  "network": data.network or "TRC20", "out_trade_no": out_no}
    if data.notify_url:
        body["notify_url"] = data.notify_url
    if data.remark:
        body["remark"] = data.remark
    sign_string = "&".join(f"{k}={canon(v)}" for k, v in sorted(
        (k, v) for k, v in body.items() if v is not None and v != ""))
    body["sign"] = sign_payload(body, merchant.get("api_secret", ""))
    dup = await db.orders.find_one({"merchant_id": str(merchant["_id"]), "out_trade_no": out_no})
    if dup:
        resp = {"code": 0, "msg": "duplicate", "data": api_order_view(dup)}
    else:
        order = await build_order(merchant, data.amount_usdt, data.network, data.remark or "",
                                  data.notify_url, out_no, data.return_url)
        resp = {"code": 0, "msg": "success", "data": api_order_view(order)}
    await audit(user, "dev.test_order", "user", str(merchant["_id"]),
                {"merchant": merchant["name"], "out_trade_no": out_no, "amount_usdt": data.amount_usdt}, request)
    return {"request": body, "sign_string": sign_string, "response": resp}


@router.get("/dev/callback-sample")
async def dev_callback_sample(merchant_id: str, user: dict = Depends(get_current_user)):
    _require_dev(user)
    merchant = await db.users.find_one({"_id": ObjectId(merchant_id), "role": "merchant"})
    if not merchant:
        raise HTTPException(status_code=404, detail="商户不存在")
    sample = {"order_no": "SF20260601120000", "out_trade_no": "M1718000000", "amount_usdt": 100.0,
              "pay_amount": 100.0037, "network": "TRC20", "status": "paid", "tx_id": "a" * 64,
              "paid_at": iso(now_utc()), "remark": "", "timestamp": int(now_utc().timestamp())}
    items = sorted((k, v) for k, v in sample.items() if v is not None and v != "")
    sign_string = "&".join(f"{k}={canon(v)}" for k, v in items)
    sample["sign"] = sign_payload(sample, merchant.get("api_secret", ""))
    return {"payload": sample, "sign_string": sign_string,
            "algorithm": "HMAC-SHA256(api_secret, sign_string) -> hex"}
