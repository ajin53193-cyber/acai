"""Wallet top-up checkout: Stripe (emergentintegrations), PayPal Orders v2, manual bank transfer with proof review."""
import base64
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

from admin_api import current_admin
from clerk_auth import require_user

logger = logging.getLogger("payments")
router = APIRouter(prefix="/api")
db = None
current_member = None
settle = None


async def _member(user: dict = Depends(require_user)) -> dict:
    return await current_member(user)

wallet = None
upload_b64 = None
new_id = None
now_iso = None

MANUAL_PROVIDERS = ("manual", "other", "alipay", "wechat")


class CheckoutIn(BaseModel):
    amount_usd: float
    method_id: str
    origin_url: str = ""


class ProofIn(BaseModel):
    image_b64: str
    image_name: str = "proof.jpg"
    note: str = ""
    payer_name: str = ""


class RejectIn(BaseModel):
    reason: str = ""


def _stripe(request: Request) -> StripeCheckout:
    key = os.environ.get("STRIPE_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Stripe 尚未設定")
    return StripeCheckout(api_key=key, webhook_url=f"{str(request.base_url).rstrip('/')}/api/webhook/stripe")


def _paypal_cfg(cfg: dict) -> dict:
    """DB config wins; blank fields fall back to PAYPAL_* env."""
    cfg = cfg or {}
    return {"client_id": cfg.get("client_id") or cfg.get("merchant_id") or os.environ.get("PAYPAL_CLIENT_ID", ""),
            "api_secret": cfg.get("api_secret") or os.environ.get("PAYPAL_CLIENT_SECRET", ""),
            "env": cfg.get("env") or os.environ.get("PAYPAL_ENV") or "sandbox",
            "webhook_id": cfg.get("webhook_id") or os.environ.get("PAYPAL_WEBHOOK_ID", "")}


def _paypal_base(cfg: dict) -> str:
    return "https://api-m.paypal.com" if (cfg.get("env") or "sandbox") == "live" else "https://api-m.sandbox.paypal.com"


async def _paypal_token(cfg: dict) -> str:
    cfg = _paypal_cfg(cfg)
    cid, sec = cfg["client_id"], cfg["api_secret"]
    if not (cid and sec):
        raise HTTPException(status_code=503, detail="PayPal 尚未設定 Client ID / Secret")
    auth = base64.b64encode(f"{cid}:{sec}".encode()).decode()
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(f"{_paypal_base(cfg)}/v1/oauth2/token", data={"grant_type": "client_credentials"}, headers={"Authorization": f"Basic {auth}"})
    if r.status_code != 200:
        logger.warning("paypal token error %s %s", r.status_code, r.text[:200])
        raise HTTPException(status_code=502, detail="PayPal 憑證無效（Client ID / Secret 錯誤或環境不符）")
    return r.json()["access_token"]


async def _paypal(cfg: dict, method: str, path: str, body: Optional[dict] = None) -> dict:
    cfg = _paypal_cfg(cfg)
    token = await _paypal_token(cfg)
    async with httpx.AsyncClient(timeout=25) as c:
        r = await c.request(method, f"{_paypal_base(cfg)}{path}", json=body, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "Prefer": "return=representation"})
    if r.status_code >= 400:
        logger.warning("paypal %s %s -> %s %s", method, path, r.status_code, r.text[:300])
        raise HTTPException(status_code=502, detail="PayPal 請求失敗，請稍後再試")
    return r.json() if r.content else {}


async def _paypal_method_cfg(t: dict) -> dict:
    pm = await db.payment_methods.find_one({"id": t.get("method_id")}, {"_id": 0}) or {}
    return pm.get("config") or {}


async def _paypal_capture_and_settle(t: dict, cfg: dict) -> dict:
    o = await _paypal(cfg, "GET", f"/v2/checkout/orders/{t['paypal_order_id']}")
    if o.get("status") == "APPROVED":
        o = await _paypal(cfg, "POST", f"/v2/checkout/orders/{t['paypal_order_id']}/capture", {})
    if o.get("status") == "COMPLETED":
        cap = (((o.get("purchase_units") or [{}])[0].get("payments") or {}).get("captures") or [{}])[0]
        return await settle(t, {"paid_at": now_iso(), "tx_id": cap.get("id", "")})
    if o.get("status") in ("VOIDED",):
        await db.topup_orders.update_one({"id": t["id"], "status": "pending"}, {"$set": {"status": "cancelled"}})
        t["status"] = "cancelled"
    return t


@router.post("/me/wallet/topup/checkout")
async def topup_checkout(body: CheckoutIn, request: Request, member: dict = Depends(_member)):
    pm = await db.payment_methods.find_one({"id": body.method_id, "active": True}, {"_id": 0})
    if not pm:
        raise HTTPException(status_code=400, detail="支付方式無效或已停用")
    lo, hi = float(pm.get("min_usd") or 1), float(pm.get("max_usd") or 10000)
    amount = round(float(body.amount_usd), 2)
    if amount < lo or amount > hi:
        raise HTTPException(status_code=400, detail=f"此支付方式單次充值金額需介於 USD${lo:g} ~ USD${hi:g}")
    origin = (body.origin_url or request.headers.get("origin") or os.environ.get("APP_PUBLIC_URL") or "").rstrip("/")
    provider, cfg = pm.get("provider"), pm.get("config") or {}
    tid = new_id()
    out_trade_no = f"TU{tid[:12].upper()}"
    fee = round(amount * float(pm.get("fee_percent") or 0) / 100, 2)
    doc = {"id": tid, "user_id": member["user_id"], "method_id": pm["id"], "method_name": pm["name"], "provider": provider, "amount_usd": amount, "fee_usd": fee,
           "pay_amount": round(amount + fee, 2), "status": "pending", "out_trade_no": out_trade_no, "created_at": now_iso(), "network": "", "pay_url": ""}
    success = f"{origin}/account/wallet/topups?topup={tid}"
    cancel = f"{origin}/account/wallet/topup?cancelled={tid}"
    if provider == "stripe":
        sc = _stripe(request)
        session = await sc.create_checkout_session(CheckoutSessionRequest(
            amount=float(doc["pay_amount"]), currency="usd", success_url=success + "&session_id={CHECKOUT_SESSION_ID}", cancel_url=cancel,
            metadata={"topup_id": tid, "user_id": member["user_id"], "kind": "wallet_topup"}))
        doc.update({"session_id": session.session_id, "pay_url": session.url, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()})
    elif provider == "paypal":
        order = await _paypal(cfg, "POST", "/v2/checkout/orders", {
            "intent": "CAPTURE",
            "purchase_units": [{"reference_id": tid, "custom_id": tid, "description": f"gogo589 wallet top-up USD {amount:.2f}", "amount": {"currency_code": "USD", "value": f"{doc['pay_amount']:.2f}"}}],
            "payment_source": {"paypal": {"experience_context": {"user_action": "PAY_NOW", "return_url": success + "&paypal=1", "cancel_url": cancel, "brand_name": "GOGO589"}}}})
        approve = next((l["href"] for l in order.get("links", []) if l.get("rel") in ("payer-action", "approve")), "")
        doc.update({"paypal_order_id": order.get("id"), "pay_url": approve, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()})
    elif provider in MANUAL_PROVIDERS:
        doc.update({"status": "pending", "reference_code": f"GG{tid[:6].upper()}", "bank": {k: cfg.get(k, "") for k in ("bank_name", "account_name", "account_no", "swift", "bank_note", "account_info")},
                    "expires_at": (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()})
    else:
        raise HTTPException(status_code=400, detail="此支付方式請使用對應的充值入口")
    await db.topup_orders.insert_one({**doc})
    return doc


@router.post("/me/wallet/topup/{tid}/proof")
async def topup_proof(tid: str, body: ProofIn, member: dict = Depends(_member)):
    t = await db.topup_orders.find_one({"id": tid, "user_id": member["user_id"]}, {"_id": 0})
    if not t or t.get("provider") not in MANUAL_PROVIDERS:
        raise HTTPException(status_code=404, detail="充值單不存在")
    if t["status"] not in ("pending", "reviewing", "rejected"):
        raise HTTPException(status_code=409, detail="此充值單已結束")
    url = await upload_b64("gogo589/topup-proofs", body.image_b64, body.image_name, max_mb=5)
    await db.topup_orders.update_one({"id": tid}, {"$set": {"status": "reviewing", "proof_image": url, "proof_note": body.note[:500], "payer_name": body.payer_name[:80], "proof_at": now_iso(), "reject_reason": ""}})
    return await db.topup_orders.find_one({"id": tid}, {"_id": 0})


async def refresh_status(t: dict, request: Optional[Request] = None) -> dict:
    """Pull latest status from Stripe / PayPal for a pending top-up and settle if paid."""
    if t.get("status") != "pending":
        return t
    try:
        if t.get("provider") == "stripe" and t.get("session_id") and request is not None:
            st = await _stripe(request).get_checkout_status(t["session_id"])
            if st.payment_status == "paid":
                return await settle(t, {"paid_at": now_iso(), "tx_id": t["session_id"]})
            if st.status == "expired":
                await db.topup_orders.update_one({"id": t["id"], "status": "pending"}, {"$set": {"status": "expired"}})
                t["status"] = "expired"
        elif t.get("provider") == "paypal" and t.get("paypal_order_id"):
            return await _paypal_capture_and_settle(t, await _paypal_method_cfg(t))
    except HTTPException as e:
        logger.info("refresh_status skipped: %s", e.detail)
    return t


@router.post("/webhook/paypal")
async def paypal_webhook(request: Request):
    ev = await request.json()
    res = ev.get("resource") or {}
    tid = res.get("custom_id") or ((res.get("purchase_units") or [{}])[0].get("custom_id")) or ""
    order_id = res.get("id") if ev.get("event_type") == "CHECKOUT.ORDER.APPROVED" else ((res.get("supplementary_data") or {}).get("related_ids") or {}).get("order_id")
    q = {"provider": "paypal", "$or": [{"id": tid}, {"paypal_order_id": order_id or "-"}]}
    t = await db.topup_orders.find_one(q, {"_id": 0})
    if not t:
        return {"status": "ignored"}
    cfg = _paypal_cfg(await _paypal_method_cfg(t))
    if cfg["webhook_id"]:
        h = request.headers
        body = {"auth_algo": h.get("paypal-auth-algo"), "cert_url": h.get("paypal-cert-url"), "transmission_id": h.get("paypal-transmission-id"), "transmission_sig": h.get("paypal-transmission-sig"),
                "transmission_time": h.get("paypal-transmission-time"), "webhook_id": cfg["webhook_id"], "webhook_event": ev}
        v = await _paypal(cfg, "POST", "/v1/notifications/verify-webhook-signature", body)
        if v.get("verification_status") != "SUCCESS":
            logger.warning("paypal webhook signature failed for %s", t["id"])
            raise HTTPException(status_code=400, detail="invalid webhook signature")
    if t["status"] == "pending":
        await _paypal_capture_and_settle(t, cfg)
    return {"status": "ok"}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    try:
        ev = await _stripe(request).handle_webhook(body, request.headers.get("Stripe-Signature"))
    except Exception as e:
        logger.warning("stripe webhook rejected: %s", e)
        raise HTTPException(status_code=400, detail="invalid webhook")
    if ev.payment_status == "paid" and ev.session_id:
        t = await db.topup_orders.find_one({"session_id": ev.session_id}, {"_id": 0})
        if t and t["status"] == "pending":
            await settle(t, {"paid_at": now_iso(), "tx_id": ev.session_id})
    return {"status": "ok"}


# ----------------------------- Admin review (bank transfer) -----------------------------
@router.post("/admin/payment-methods/{mid}/test")
async def admin_payment_method_test(mid: str, request: Request, admin: dict = Depends(current_admin)):
    pm = await db.payment_methods.find_one({"id": mid}, {"_id": 0})
    if not pm:
        raise HTTPException(status_code=404, detail="不存在")
    if pm.get("provider") == "paypal":
        cfg = _paypal_cfg(pm.get("config") or {})
        source = "db" if (pm.get("config") or {}).get("client_id") else ("env" if os.environ.get("PAYPAL_CLIENT_ID") else "none")
        await _paypal_token(cfg)
        return {"ok": True, "provider": "paypal", "env": cfg["env"], "source": source, "webhook_url": f"{str(request.base_url).rstrip('/')}/api/webhook/paypal", "webhook_verified": bool(cfg["webhook_id"])}
    if pm.get("provider") == "stripe":
        _stripe(request)
        return {"ok": True, "provider": "stripe", "source": "env", "webhook_url": f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"}
    raise HTTPException(status_code=400, detail="此支付方式無需連線測試")


@router.post("/admin/topups/{tid}/approve")
async def admin_topup_approve(tid: str, admin: dict = Depends(current_admin)):
    t = await db.topup_orders.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="充值單不存在")
    if t["status"] == "paid":
        raise HTTPException(status_code=409, detail="此充值單已入帳")
    await db.topup_orders.update_one({"id": tid}, {"$set": {"status": "pending"}})
    r = await settle({**t, "status": "pending"}, {"paid_at": now_iso(), "tx_id": t.get("reference_code", "")})
    await db.topup_orders.update_one({"id": tid}, {"$set": {"reviewed_by": admin.get("email") or admin["user_id"], "reviewed_at": now_iso()}})
    return r


@router.post("/admin/topups/{tid}/reject")
async def admin_topup_reject(tid: str, body: RejectIn, admin: dict = Depends(current_admin)):
    t = await db.topup_orders.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="充值單不存在")
    if t["status"] == "paid":
        raise HTTPException(status_code=409, detail="已入帳的充值單無法駁回")
    await db.topup_orders.update_one({"id": tid}, {"$set": {"status": "rejected", "reject_reason": body.reason[:300], "reviewed_by": admin.get("email") or admin["user_id"], "reviewed_at": now_iso()}})
    return await db.topup_orders.find_one({"id": tid}, {"_id": 0})
