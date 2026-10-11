"""Alerts domain routes: alert feed (read/unread) + alert threshold settings."""
from bson import ObjectId
from fastapi import APIRouter, Depends, Request, Query, HTTPException
from pydantic import BaseModel

from core import db
from utils import serialize
from deps import require_roles
from shared import alert_settings, audit

router = APIRouter(prefix="/api")


class AlertSettings(BaseModel):
    pct: float = 10.0
    min_abs: float = 100.0
    sync_minutes: int = 10
    sweep_threshold: float = 10000.0
    big_payment: float = 1000.0


@router.get("/alerts")
async def list_alerts(user: dict = Depends(require_roles("admin")), unread: bool = False, limit: int = Query(50, le=200)):
    q = {"read": False} if unread else {}
    rows = await db.alerts.find(q).sort("created_at", -1).to_list(limit)
    unread_count = await db.alerts.count_documents({"read": False})
    return {"unread": unread_count, "alerts": [serialize(r) for r in rows]}


@router.post("/alerts/read-all")
async def read_all_alerts(user: dict = Depends(require_roles("admin"))):
    await db.alerts.update_many({"read": False}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/alerts/{alert_id}/read")
async def read_alert(alert_id: str, user: dict = Depends(require_roles("admin"))):
    await db.alerts.update_one({"_id": ObjectId(alert_id)}, {"$set": {"read": True}})
    return {"ok": True}


@router.get("/alerts/settings")
async def get_alert_settings(user: dict = Depends(require_roles("admin"))):
    return await alert_settings()


@router.put("/alerts/settings")
async def put_alert_settings(data: AlertSettings, request: Request, user: dict = Depends(require_roles("admin"))):
    if data.pct <= 0 or data.min_abs < 0 or data.sync_minutes < 1 or data.sweep_threshold < 0 or data.big_payment < 0:
        raise HTTPException(status_code=400, detail="阈值不合法")
    await db.settings.update_one({"_id": "alerts"}, {"$set": data.model_dump()}, upsert=True)
    await audit(user, "settings.alerts", "settings", "alerts", data.model_dump(), request)
    return data.model_dump()
