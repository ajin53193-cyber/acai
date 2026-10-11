"""Notification domain routes: Telegram push settings, test, daily report, log."""
import httpx
from fastapi import APIRouter, Depends, Request, Query, HTTPException
from pydantic import BaseModel

from core import db
from utils import serialize, iso, now_utc
from deps import require_roles
from shared import notify_settings, send_telegram, audit
from server import build_profit_snapshot, snapshot_report_text

router = APIRouter(prefix="/api")


class NotifySettingsIn(BaseModel):
    telegram_enabled: bool = False
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    notify_alerts: bool = True
    notify_big_payment: bool = True
    notify_sweep: bool = True
    export_notify_threshold: int = 500
    export_retain_days: int = 7


@router.get("/notify/settings")
async def get_notify_settings(user: dict = Depends(require_roles("admin"))):
    cfg = await notify_settings()
    tok = cfg["telegram_bot_token"]
    cfg["telegram_bot_token_masked"] = (tok[:6] + "…" + tok[-4:]) if len(tok) > 12 else ("已设置" if tok else "")
    cfg["telegram_bot_token"] = ""
    return cfg


@router.put("/notify/settings")
async def put_notify_settings(data: NotifySettingsIn, request: Request, user: dict = Depends(require_roles("admin"))):
    old = await notify_settings()
    doc = data.model_dump()
    if not doc["telegram_bot_token"]:
        doc["telegram_bot_token"] = old["telegram_bot_token"]
    doc["telegram_chat_id"] = doc["telegram_chat_id"].strip()
    await db.settings.update_one({"_id": "notify"}, {"$set": doc}, upsert=True)
    await audit(user, "settings.notify", "settings", "notify", {k: v for k, v in doc.items() if k != "telegram_bot_token"}, request)
    return {"ok": True}


@router.post("/notify/test")
async def test_notify(user: dict = Depends(require_roles("admin"))):
    cfg = await notify_settings()
    if not cfg["telegram_bot_token"] or not cfg["telegram_chat_id"]:
        raise HTTPException(status_code=400, detail="请先填写 Bot Token 与 Chat ID")
    try:
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.post(f"https://api.telegram.org/bot{cfg['telegram_bot_token']}/sendMessage",
                              json={"chat_id": cfg["telegram_chat_id"], "text": f"✅ 四方收款平台 Telegram 推送测试成功\n{iso(now_utc())[:19]}", "parse_mode": "HTML"})
            body = r.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"请求 Telegram 失败: {e}")
    if not body.get("ok"):
        raise HTTPException(status_code=400, detail=f"Telegram 返回错误: {body.get('description', body)}")
    return {"ok": True}


@router.post("/notify/daily-report")
async def send_daily_report(date: str = None, user: dict = Depends(require_roles("admin"))):
    day = date or now_utc().strftime("%Y-%m-%d")
    if day > now_utc().strftime("%Y-%m-%d"):
        raise HTTPException(status_code=400, detail="不能预览未来日期")
    snap = await db.profit_snapshots.find_one({"date": day}) or await build_profit_snapshot(day)
    text = snapshot_report_text(snap)
    cfg = await notify_settings()
    configured = bool(cfg["telegram_bot_token"] and cfg["telegram_chat_id"])
    sent = bool(await send_telegram(text, "report")) if configured else False
    return {"text": text, "telegram_configured": configured, "sent": sent, "date": day}


@router.get("/notify/log")
async def notify_log(user: dict = Depends(require_roles("admin")), limit: int = Query(50, le=200)):
    rows = await db.notify_log.find().sort("created_at", -1).to_list(limit)
    return [serialize(r) for r in rows]
