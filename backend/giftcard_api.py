"""Gift card module: number pool, auto-review settings, transaction numbers, redemption (admin + external API)."""
import csv
import io
import re
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import admin_api

db = None
dispatch_giftcards = None
wallet_tx = None
notify_user = None
order_ctx = None

router = APIRouter(prefix="/admin/giftcard")
ext_router = APIRouter(prefix="/ext")
current_admin = lambda: admin_api.current_admin  # noqa: E731


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def norm_phone(v: str) -> str:
    return re.sub(r"\D", "", str(v or ""))


def norm_key(v: str) -> str:
    """Pool key: strip all whitespace, lowercase. Exact match only."""
    return re.sub(r"\s+", "", str(v or "")).lower()


def phone_match(a: str, b: str) -> bool:
    a, b = norm_phone(a), norm_phone(b)
    return bool(a and b) and (a == b or (len(a) >= 8 and len(b) >= 8 and a[-8:] == b[-8:]))


DEFAULT_SETTINGS = {"auto_review_enabled": True, "auto_delay_min": 2, "auto_delay_max": 5, "api_key": ""}


async def get_settings() -> dict:
    doc = await db.settings.find_one({"key": "giftcard"}, {"_id": 0})
    val = {**DEFAULT_SETTINGS, **((doc or {}).get("value") or {})}
    if not val["api_key"]:
        val["api_key"] = "gck_" + secrets.token_hex(20)
        await db.settings.update_one({"key": "giftcard"}, {"$set": {"key": "giftcard", "value": val}}, upsert=True)
    return val


async def pool_hit(values: List[str]) -> Optional[dict]:
    cands = list({norm_key(v) for v in values if norm_key(v)})
    if not cands:
        return None
    hit = await db.giftcard_numbers.find_one({"key": {"$in": cands}}, {"_id": 0})
    if hit:
        await db.giftcard_numbers.update_one({"key": hit["key"]}, {"$inc": {"hitCount": 1}, "$set": {"lastHitAt": now_iso()}})
    return hit


async def add_numbers(lines: str, note: str, by: str):
    added = skipped = 0
    for raw in re.split(r"[\s,，;；|]+", lines or ""):
        raw = raw.strip()
        key = norm_key(raw)
        if not key:
            continue
        r = await db.giftcard_numbers.update_one({"key": key}, {"$setOnInsert": {"id": uuid.uuid4().hex, "key": key, "raw": raw, "note": note, "hitCount": 0, "lastHitAt": None,
                                                                                 "createdAt": now_iso(), "addedBy": by}}, upsert=True)
        if r.upserted_id:
            added += 1
        else:
            skipped += 1
    return added, skipped


async def op_log(email: str, text: str, status: int = 200):
    await admin_api.record_admin_log("", email or "system", "GIFTCARD", text, status)


async def create_txns(order: dict, nos: list):
    """Persist one giftcard_txns doc per 交易號 for redemption."""
    info_vals = [v for f in (order.get("delivery_info") or {}).values() for v in (f or {}).values()]
    phone = next((norm_phone(v) for v in info_vals if len(norm_phone(v)) >= 8), "")
    name = next((v for k, f in (order.get("delivery_info") or {}).items() for kk, v in (f or {}).items() if any(x in kk for x in ("姓名", "name", "Name"))), "")
    for n in nos:
        it = next((i for i in order.get("items", []) if i.get("product_name") == n.get("product_name") and i.get("spec_label") == n.get("spec_label")), {})
        p = await db.products.find_one({"id": it.get("product_id")}, {"_id": 0, "price_currency": 1, "specs": 1}) or {}
        spec = next((s for s in p.get("specs", []) if s.get("id") == it.get("spec_id")), {})
        amount = spec.get("giftcard_value_local") or spec.get("sale_price_local") or spec.get("price_local") or _amount_from_label(n.get("spec_label", ""))
        await db.giftcard_txns.update_one({"trade_no": n["trade_no"]}, {"$setOnInsert": {
            "id": uuid.uuid4().hex, "trade_no": n["trade_no"], "order_id": order["id"], "order_no": order.get("order_no", ""), "user_id": order.get("user_id", ""),
            "product_name": n.get("product_name", ""), "spec_label": n.get("spec_label", ""), "amount": float(amount or 0), "currency": p.get("price_currency") or "HKD",
            "phone": phone, "recipient_name": name, "redeemed": False, "created_at": now_iso()}}, upsert=True)


def _amount_from_label(label: str) -> float:
    m = re.search(r"(\d+(?:\.\d+)?)", label or "")
    return float(m.group(1)) if m else 0.0


# ----------------------------- settings -----------------------------
class SettingsIn(BaseModel):
    auto_review_enabled: bool = True
    auto_delay_min: int = 2
    auto_delay_max: int = 5


@router.get("/settings")
async def settings_get(admin: dict = Depends(admin_api.current_admin)):
    return await get_settings()


@router.put("/settings")
async def settings_put(body: SettingsIn, admin: dict = Depends(admin_api.current_admin)):
    cur = await get_settings()
    lo, hi = max(0, body.auto_delay_min), max(0, body.auto_delay_max)
    if hi < lo:
        lo, hi = hi, lo
    val = {**cur, "auto_review_enabled": body.auto_review_enabled, "auto_delay_min": lo, "auto_delay_max": hi}
    await db.settings.update_one({"key": "giftcard"}, {"$set": {"value": val}}, upsert=True)
    return val


@router.post("/api-key/regenerate")
async def api_key_regen(admin: dict = Depends(admin_api.current_admin)):
    cur = await get_settings()
    val = {**cur, "api_key": "gck_" + secrets.token_hex(20)}
    await db.settings.update_one({"key": "giftcard"}, {"$set": {"value": val}}, upsert=True)
    return val


# ----------------------------- number pool -----------------------------
class NumbersIn(BaseModel):
    lines: str = ""
    note: str = ""


@router.get("/numbers")
async def numbers_list(q: str = "", unmatched: str = "", page: int = 1, size: int = 50, admin: dict = Depends(admin_api.current_admin)):
    cond: dict = {}
    if q:
        cond["$or"] = [{"key": {"$regex": re.escape(norm_key(q))}}, {"note": {"$regex": q, "$options": "i"}}]
    if unmatched == "1":
        cond["hitCount"] = {"$in": [0, None]}
    total = await db.giftcard_numbers.count_documents(cond)
    rows = await db.giftcard_numbers.find(cond, {"_id": 0}).sort("createdAt", -1).skip((page - 1) * size).to_list(size)
    unmatched_n = await db.giftcard_numbers.count_documents({"hitCount": {"$in": [0, None]}})
    return {"rows": rows, "total": total, "unmatched": unmatched_n}


@router.post("/numbers")
async def numbers_add(body: NumbersIn, admin: dict = Depends(admin_api.current_admin)):
    added, skipped = await add_numbers(body.lines, body.note, admin.get("email", ""))
    await op_log(admin.get("email", ""), f"號碼庫批量新增 {added} 筆，重複略過 {skipped} 筆")
    return {"added": added, "skipped": skipped}


@router.delete("/numbers/unmatched")
async def numbers_clear_unmatched(admin: dict = Depends(admin_api.current_admin)):
    r = await db.giftcard_numbers.delete_many({"hitCount": {"$in": [0, None]}})
    await op_log(admin.get("email", ""), f"號碼庫一鍵清理未命中 {r.deleted_count} 筆")
    return {"deleted": r.deleted_count}


@router.delete("/numbers/{nid}")
async def numbers_delete(nid: str, admin: dict = Depends(admin_api.current_admin)):
    n = await db.giftcard_numbers.find_one({"id": nid}, {"_id": 0, "key": 1})
    await db.giftcard_numbers.delete_one({"id": nid})
    await op_log(admin.get("email", ""), f"號碼庫刪除 {(n or {}).get('key', nid)}")
    return {"ok": True}


# ----------------------------- transactions & redemption -----------------------------
@router.get("/txns")
async def txns_list(q: str = "", redeemed: str = "", date_from: str = "", date_to: str = "", page: int = 1, size: int = 50, admin: dict = Depends(admin_api.current_admin)):
    cond: dict = {}
    if q:
        cond["$or"] = [{"trade_no": {"$regex": q}}, {"order_no": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": norm_phone(q) or q}}]
    if redeemed in ("0", "1"):
        cond["redeemed"] = redeemed == "1"
    key = "redeemed_at" if redeemed == "1" else "created_at"
    if date_from:
        cond.setdefault(key, {})["$gte"] = date_from
    if date_to:
        cond.setdefault(key, {})["$lte"] = date_to + "T23:59:59"
    total = await db.giftcard_txns.count_documents(cond)
    rows = await db.giftcard_txns.find(cond, {"_id": 0}).sort("created_at", -1).skip((page - 1) * size).to_list(size)
    for r in rows:
        r["account_no"] = admin_api.account_no(r.get("user_id", ""))
    return {"rows": rows, "total": total}


@router.get("/txns/export")
async def txns_export(date_from: str = "", date_to: str = "", redeemed: str = "1", admin: dict = Depends(admin_api.current_admin)):
    data = await txns_list(q="", redeemed=redeemed, date_from=date_from, date_to=date_to, page=1, size=20000, admin=admin)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["交易號", "訂單號", "商品", "規格", "面額", "幣別", "手機號", "收禮人", "已核銷", "核銷時間", "核銷人", "生成時間"])
    for r in data["rows"]:
        w.writerow([r["trade_no"], r.get("order_no"), r.get("product_name"), r.get("spec_label"), r.get("amount"), r.get("currency"), r.get("phone"), r.get("recipient_name"),
                    "是" if r.get("redeemed") else "否", r.get("redeemed_at", ""), r.get("redeemed_by", ""), r.get("created_at")])
    return StreamingResponse(iter(["\ufeff" + buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=giftcard_redemptions.csv"})


class RedeemIn(BaseModel):
    trade_no: str
    phone: str = ""
    amount: Optional[float] = None


async def _redeem(trade_no: str, phone: str, amount: Optional[float], by: str, strict: bool):
    t = await db.giftcard_txns.find_one({"trade_no": re.sub(r"\D", "", trade_no or "")}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="查無此交易號")
    if strict or phone or amount is not None:
        if (strict or phone) and not phone_match(phone, t.get("phone", "")):
            raise HTTPException(status_code=422, detail="信息不符或交易號錯誤")
        if (strict or amount is not None) and abs(float(amount or 0) - float(t.get("amount") or 0)) > 0.009:
            raise HTTPException(status_code=422, detail="信息不符或交易號錯誤")
    if t.get("redeemed"):
        raise HTTPException(status_code=409, detail="該交易號已核銷")
    upd = {"redeemed": True, "redeemed_at": now_iso(), "redeemed_by": by}
    await db.giftcard_txns.update_one({"trade_no": t["trade_no"]}, {"$set": upd})
    left = await db.giftcard_txns.count_documents({"order_id": t["order_id"], "redeemed": False})
    if left == 0:
        await db.orders.update_one({"id": t["order_id"]}, {"$set": {"redeemed": True, "redeemed_at": upd["redeemed_at"]}})
    return {**t, **upd}


@router.post("/redeem")
async def redeem_admin(body: RedeemIn, admin: dict = Depends(admin_api.current_admin)):
    return await _redeem(body.trade_no, body.phone, body.amount, admin.get("email", "admin"), strict=False)


class ExtRedeemIn(BaseModel):
    transactionNo: str
    phone: str
    amount: float


@ext_router.post("/txn/redeem")
async def redeem_ext(body: ExtRedeemIn, x_api_key: str = Header("", alias="X-API-Key")):
    cfg = await get_settings()
    if not x_api_key or x_api_key != cfg["api_key"]:
        raise HTTPException(status_code=401, detail="無效的 API Key")
    try:
        t = await _redeem(body.transactionNo, body.phone, body.amount, "api", strict=True)
    except HTTPException as e:
        return {"code": e.status_code, "message": e.detail}
    return {"code": 0, "message": "核銷成功", "data": {"transactionNo": t["trade_no"], "amount": t["amount"], "currency": t.get("currency"), "phone": t.get("phone"),
                                                   "product": t.get("product_name"), "spec": t.get("spec_label"), "redeemedAt": t["redeemed_at"]}}
