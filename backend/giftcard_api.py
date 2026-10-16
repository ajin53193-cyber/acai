"""Gift card module: number pool, auto-review settings, transaction numbers, redemption (admin + external API)."""
import csv
import io
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
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


DEFAULT_SETTINGS = {"auto_review_enabled": True, "auto_delay_min": 0.5, "auto_delay_max": 1.0, "api_key": ""}


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
            "amount_usd": round(float(it.get("unit_price_usd") or 0), 2),
            "phone": phone, "recipient_name": name, "redeemed": False, "created_at": now_iso()}}, upsert=True)


def _amount_from_label(label: str) -> float:
    m = re.search(r"(\d+(?:\.\d+)?)", label or "")
    return float(m.group(1)) if m else 0.0


# ----------------------------- settings -----------------------------
class SettingsIn(BaseModel):
    auto_review_enabled: bool = True
    auto_delay_min: float = 0.5
    auto_delay_max: float = 1.0


@router.get("/settings")
async def settings_get(admin: dict = Depends(admin_api.current_admin)):
    return await get_settings()


@router.put("/settings")
async def settings_put(body: SettingsIn, admin: dict = Depends(admin_api.current_admin)):
    cur = await get_settings()
    lo, hi = max(0.0, round(float(body.auto_delay_min), 2)), max(0.0, round(float(body.auto_delay_max), 2))
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


# ----------------------------- badge & audit report -----------------------------
async def gift_base_cond() -> dict:
    gift_ids = [p["id"] async for p in db.products.find({"is_giftcard": True}, {"_id": 0, "id": 1})]
    return {"$or": [{"is_giftcard_order": True}, {"items.product_id": {"$in": gift_ids}}], "status": {"$ne": "pending_payment"}}


@router.get("/badge")
async def badge(admin: dict = Depends(admin_api.current_admin)):
    base = await gift_base_cond()
    return {"manual": await db.orders.count_documents({**base, "status": "processing", "gift_manual": True})}


def _parse_range(date_from: str, date_to: str, tz_offset: int):
    off = timedelta(minutes=max(-840, min(840, tz_offset)))
    now_local = datetime.now(timezone.utc) - off
    try:
        d_to = datetime.strptime(date_to, "%Y-%m-%d") if date_to else now_local.replace(tzinfo=None)
        d_from = datetime.strptime(date_from, "%Y-%m-%d") if date_from else d_to
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式錯誤")
    d_from, d_to = d_from.replace(hour=0, minute=0, second=0, microsecond=0), d_to.replace(hour=0, minute=0, second=0, microsecond=0)
    if d_from > d_to:
        d_from, d_to = d_to, d_from
    ndays = min((d_to - d_from).days + 1, 366)
    d_to = d_from + timedelta(days=ndays - 1)
    start = (d_from.replace(tzinfo=timezone.utc) + off).isoformat()
    end = (d_to.replace(tzinfo=timezone.utc) + off + timedelta(days=1)).isoformat()
    days = [(d_from + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(ndays)]
    return off, start, end, days


def _day_of(ts: str, off: timedelta) -> str:
    try:
        return (datetime.fromisoformat(ts.replace("Z", "+00:00")) - off).strftime("%Y-%m-%d")
    except Exception:
        return ""


async def build_report(date_from: str, date_to: str, tz_offset: int) -> dict:
    off, start, end, days = _parse_range(date_from, date_to, tz_offset)
    base = await gift_base_cond()
    rows = {d: {"date": d, "sold": 0, "sold_usd": 0.0, "completed": 0, "completed_usd": 0.0, "redeemed": 0, "redeemed_usd": 0.0} for d in days}
    async for o in db.orders.find({**base, "status": {"$nin": ["pending_payment", "cancelled"]}, "created_at": {"$gte": start, "$lt": end}}, {"_id": 0, "created_at": 1, "total_usd": 1}):
        r = rows.get(_day_of(o["created_at"], off))
        if r:
            r["sold"] += 1
            r["sold_usd"] += float(o.get("total_usd") or 0)
    async for o in db.orders.find({**base, "status": "completed", "completed_at": {"$gte": start, "$lt": end}}, {"_id": 0, "completed_at": 1, "total_usd": 1}):
        r = rows.get(_day_of(o["completed_at"], off))
        if r:
            r["completed"] += 1
            r["completed_usd"] += float(o.get("total_usd") or 0)
    txns = await db.giftcard_txns.find({"redeemed": True, "redeemed_at": {"$gte": start, "$lt": end}}, {"_id": 0, "redeemed_at": 1, "amount_usd": 1, "order_id": 1, "product_name": 1, "spec_label": 1}).to_list(50000)
    missing = {t["order_id"] for t in txns if t.get("amount_usd") is None}
    unit_map = {}
    if missing:
        async for o in db.orders.find({"id": {"$in": list(missing)}}, {"_id": 0, "id": 1, "items": 1}):
            for it in o.get("items", []):
                unit_map[(o["id"], it.get("product_name"), it.get("spec_label"))] = float(it.get("unit_price_usd") or 0)
    for t in txns:
        r = rows.get(_day_of(t["redeemed_at"], off))
        if r:
            r["redeemed"] += 1
            r["redeemed_usd"] += float(t["amount_usd"]) if t.get("amount_usd") is not None else unit_map.get((t["order_id"], t.get("product_name"), t.get("spec_label")), 0.0)
    out_rows = [{**r, "sold_usd": round(r["sold_usd"], 2), "completed_usd": round(r["completed_usd"], 2), "redeemed_usd": round(r["redeemed_usd"], 2)} for r in rows.values()]
    summary = {k: round(sum(r[k] for r in out_rows), 2) for k in ("sold", "sold_usd", "completed", "completed_usd", "redeemed", "redeemed_usd")}
    summary["manual_pending"] = await db.orders.count_documents({**base, "status": "processing", "gift_manual": True})
    summary["unredeemed"] = await db.giftcard_txns.count_documents({"redeemed": False})
    return {"date_from": days[0], "date_to": days[-1], "days": len(days), "summary": summary, "rows": out_rows}


@router.get("/report")
async def report(date_from: str = "", date_to: str = "", tz_offset: int = 0, admin: dict = Depends(admin_api.current_admin)):
    return await build_report(date_from, date_to, tz_offset)


@router.get("/report/export")
async def report_export(date_from: str = "", date_to: str = "", tz_offset: int = 0, admin: dict = Depends(admin_api.current_admin)):
    data = await build_report(date_from, date_to, tz_offset)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["日期", "售出筆數", "售出金額(USD)", "完成筆數", "完成金額(USD)", "核銷筆數", "核銷金額(USD)"])
    for r in data["rows"]:
        w.writerow([r["date"], r["sold"], f"{r['sold_usd']:.2f}", r["completed"], f"{r['completed_usd']:.2f}", r["redeemed"], f"{r['redeemed_usd']:.2f}"])
    s = data["summary"]
    w.writerow(["合計", s["sold"], f"{s['sold_usd']:.2f}", s["completed"], f"{s['completed_usd']:.2f}", s["redeemed"], f"{s['redeemed_usd']:.2f}"])
    return StreamingResponse(iter(["\ufeff" + buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=giftcard_audit_{data['date_from']}_{data['date_to']}.csv"})


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
    amount: float
    phone: str = ""


def _ext_txn(t: dict) -> dict:
    return {"transactionNo": t["trade_no"], "amount": t.get("amount"), "currency": t.get("currency"), "phone": t.get("phone"), "alipayHK": t.get("phone"),
            "product": t.get("product_name"), "spec": t.get("spec_label"), "redeemed": bool(t.get("redeemed")), "redeemedAt": t.get("redeemed_at", ""), "createdAt": t.get("created_at", "")}


async def _ext_auth(x_api_key: str):
    cfg = await get_settings()
    if not x_api_key or x_api_key != cfg["api_key"]:
        raise HTTPException(status_code=401, detail="無效的 API Key")


@ext_router.get("/txn/query")
async def query_ext(no: str = "", x_api_key: str = Header("", alias="X-API-Key")):
    await _ext_auth(x_api_key)
    t = await db.giftcard_txns.find_one({"trade_no": re.sub(r"\D", "", no or "")}, {"_id": 0})
    if not t:
        return JSONResponse(status_code=404, content={"code": 404, "message": "查無此交易號"})
    return {"code": 0, "message": "ok", "data": _ext_txn(t)}


@ext_router.post("/txn/redeem")
async def redeem_ext(body: ExtRedeemIn, x_api_key: str = Header("", alias="X-API-Key")):
    await _ext_auth(x_api_key)
    try:
        t = await _redeem(body.transactionNo, body.phone, body.amount, "api", strict=False)
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"code": e.status_code, "message": e.detail})
    return {"code": 0, "message": "核銷成功", "data": _ext_txn(t)}
