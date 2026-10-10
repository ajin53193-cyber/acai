from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Annotated, Any
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import logging
import random
import string
import secrets
import bcrypt
import jwt

# ---------------------------------------------------------------------------
# DB & app setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="四方收款平台 API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("sifang")

JWT_ALGORITHM = "HS256"
NETWORKS = ["TRC20", "ERC20", "BEP20"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": now_utc() + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def gen_order_no() -> str:
    return "SF" + now_utc().strftime("%Y%m%d%H%M%S") + "".join(random.choices(string.digits, k=5))


def gen_wallet_address(network: str) -> str:
    if network == "TRC20":
        return "T" + "".join(random.choices(string.ascii_letters + string.digits, k=33))
    return "0x" + "".join(random.choices("abcdef" + string.digits, k=40))


def gen_txid(network: str) -> str:
    if network == "TRC20":
        return "".join(random.choices("abcdef" + string.digits, k=64))
    return "0x" + "".join(random.choices("abcdef" + string.digits, k=64))


def gen_api_key() -> str:
    return "mk_" + secrets.token_hex(16)


def gen_api_secret() -> str:
    return "sk_" + secrets.token_hex(24)


def clean_user(u: dict) -> dict:
    u = dict(u)
    u["id"] = str(u.pop("_id"))
    u.pop("password_hash", None)
    return u


def serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="无效的令牌类型")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="用户不存在")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="登录已过期")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效的令牌")


def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="无权限访问")
        return user
    return checker


async def merchant_ids_for_scope(user: dict) -> Optional[List[ObjectId]]:
    """Return list of merchant ObjectIds the user can see, or None for all (admin)."""
    role = user["role"]
    if role == "admin":
        return None
    if role == "merchant":
        return [user["_id"]]
    # agent: merchants whose parent_agent_id == agent id
    cursor = db.users.find({"role": "merchant", "parent_agent_id": str(user["_id"])}, {"_id": 1})
    ids = [m["_id"] async for m in cursor]
    return ids


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class AccountCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # agent | merchant
    rate: float = 0.03
    parent_agent_id: Optional[str] = None


class BalanceAdjust(BaseModel):
    amount: float
    action: str  # credit | debit | freeze | unfreeze
    remark: Optional[str] = ""


class ChannelCreate(BaseModel):
    name: str
    network: str
    fee_rate: float = 0.02
    weight: int = 10
    min_amount: float = 10
    max_amount: float = 50000
    status: str = "active"


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    fee_rate: Optional[float] = None
    weight: Optional[int] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    status: Optional[str] = None


class OrderCreate(BaseModel):
    amount_usdt: float
    network: Optional[str] = None
    merchant_id: Optional[str] = None  # admin/agent may specify
    remark: Optional[str] = ""


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    if user.get("status") == "frozen":
        raise HTTPException(status_code=403, detail="账号已被冻结")
    token = create_access_token(str(user["_id"]), user["email"], user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")
    return {"token": token, "user": clean_user(user)}


@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return clean_user(user)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    scope = await merchant_ids_for_scope(user)
    q: dict = {}
    if scope is not None:
        q["merchant_id"] = {"$in": [str(i) for i in scope]}

    today_start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    all_orders = await db.orders.find(q).to_list(5000)

    total_volume = sum(o["amount_usdt"] for o in all_orders if o["status"] == "paid")
    today_volume = sum(o["amount_usdt"] for o in all_orders
                       if o["status"] == "paid" and datetime.fromisoformat(o["created_at"]) >= today_start)
    total_orders = len(all_orders)
    paid_orders = len([o for o in all_orders if o["status"] == "paid"])
    pending_orders = len([o for o in all_orders if o["status"] == "pending"])
    success_rate = round(paid_orders / total_orders * 100, 1) if total_orders else 0.0

    if user["role"] == "admin":
        profit = sum(o.get("platform_profit", 0) for o in all_orders if o["status"] == "paid")
        profit_label = "平台利润"
    elif user["role"] == "agent":
        profit = sum(o.get("agent_commission", 0) for o in all_orders if o["status"] == "paid")
        profit_label = "分润收益"
    else:
        profit = sum(o.get("merchant_receive", 0) for o in all_orders if o["status"] == "paid")
        profit_label = "实收金额"

    # 7-day trend
    trend = []
    for i in range(6, -1, -1):
        day = (today_start - timedelta(days=i))
        day_end = day + timedelta(days=1)
        vol = sum(o["amount_usdt"] for o in all_orders
                  if o["status"] == "paid" and day <= datetime.fromisoformat(o["created_at"]) < day_end)
        cnt = len([o for o in all_orders if day <= datetime.fromisoformat(o["created_at"]) < day_end])
        trend.append({"date": day.strftime("%m-%d"), "volume": round(vol, 2), "orders": cnt})

    active_channels = await db.channels.count_documents({"status": "active"})
    balance = round(user.get("balance", 0), 2)

    return {
        "total_volume": round(total_volume, 2),
        "today_volume": round(today_volume, 2),
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "success_rate": success_rate,
        "profit": round(profit, 2),
        "profit_label": profit_label,
        "active_channels": active_channels,
        "balance": balance,
        "trend": trend,
    }


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------
async def pick_channel(network: Optional[str], amount: float) -> Optional[dict]:
    q = {"status": "active"}
    if network:
        q["network"] = network
    channels = await db.channels.find(q).to_list(100)
    channels = [c for c in channels if c["min_amount"] <= amount <= c["max_amount"]]
    if not channels:
        return None
    # weighted random
    total = sum(c["weight"] for c in channels)
    r = random.uniform(0, total)
    upto = 0
    for c in channels:
        upto += c["weight"]
        if r <= upto:
            return c
    return channels[0]


@api_router.post("/orders")
async def create_order(data: OrderCreate, user: dict = Depends(get_current_user)):
    # determine merchant
    if user["role"] == "merchant":
        merchant = user
    else:
        if not data.merchant_id:
            raise HTTPException(status_code=400, detail="请选择商户")
        merchant = await db.users.find_one({"_id": ObjectId(data.merchant_id), "role": "merchant"})
        if not merchant:
            raise HTTPException(status_code=404, detail="商户不存在")

    network = data.network or random.choice(NETWORKS)
    channel = await pick_channel(network, data.amount_usdt)
    if not channel:
        raise HTTPException(status_code=400, detail="没有可用的收款通道")

    expires = now_utc() + timedelta(minutes=15)
    order = {
        "order_no": gen_order_no(),
        "merchant_id": str(merchant["_id"]),
        "merchant_name": merchant["name"],
        "amount_usdt": round(data.amount_usdt, 2),
        "network": network,
        "wallet_address": gen_wallet_address(network),
        "tx_id": None,
        "status": "pending",
        "channel_id": str(channel["_id"]),
        "channel_name": channel["name"],
        "remark": data.remark or "",
        "created_at": iso(now_utc()),
        "paid_at": None,
        "expires_at": iso(expires),
    }
    res = await db.orders.insert_one(order)
    order["_id"] = res.inserted_id
    return serialize(order)


@api_router.get("/orders")
async def list_orders(user: dict = Depends(get_current_user),
                      status: Optional[str] = None, network: Optional[str] = None,
                      keyword: Optional[str] = None, limit: int = Query(200, le=1000)):
    scope = await merchant_ids_for_scope(user)
    q: dict = {}
    if scope is not None:
        q["merchant_id"] = {"$in": [str(i) for i in scope]}
    if status:
        q["status"] = status
    if network:
        q["network"] = network
    if keyword:
        q["$or"] = [{"order_no": {"$regex": keyword, "$options": "i"}},
                    {"tx_id": {"$regex": keyword, "$options": "i"}},
                    {"merchant_name": {"$regex": keyword, "$options": "i"}}]
    orders = await db.orders.find(q).sort("created_at", -1).to_list(limit)
    return [serialize(o) for o in orders]


@api_router.get("/orders/{order_no}/public")
async def get_order_public(order_no: str):
    order = await db.orders.find_one({"order_no": order_no})
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    # auto-expire
    if order["status"] == "pending" and datetime.fromisoformat(order["expires_at"]) < now_utc():
        await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "expired"}})
        order["status"] = "expired"
    return {
        "order_no": order["order_no"],
        "amount_usdt": order["amount_usdt"],
        "network": order["network"],
        "wallet_address": order["wallet_address"],
        "status": order["status"],
        "merchant_name": order["merchant_name"],
        "expires_at": order["expires_at"],
        "tx_id": order.get("tx_id"),
    }


async def settle_order(order: dict):
    """Compute fee/commission split and credit balances."""
    merchant = await db.users.find_one({"_id": ObjectId(order["merchant_id"])})
    channel = await db.channels.find_one({"_id": ObjectId(order["channel_id"])})
    amount = order["amount_usdt"]
    merchant_rate = merchant.get("rate", 0.03)
    channel_rate = channel.get("fee_rate", 0.02) if channel else 0.02

    fee = round(amount * merchant_rate, 4)
    merchant_receive = round(amount - fee, 4)

    agent_commission = 0.0
    agent_id = merchant.get("parent_agent_id")
    if agent_id:
        agent = await db.users.find_one({"_id": ObjectId(agent_id)})
        if agent:
            agent_rate = agent.get("rate", channel_rate)
            agent_commission = round(amount * max(merchant_rate - agent_rate, 0), 4)
            await db.users.update_one({"_id": agent["_id"]},
                                      {"$inc": {"balance": agent_commission}})
    platform_profit = round(fee - agent_commission, 4)

    await db.users.update_one({"_id": merchant["_id"]}, {"$inc": {"balance": merchant_receive}})
    return fee, merchant_receive, agent_commission, platform_profit


async def mark_paid(order: dict) -> dict:
    fee, merchant_receive, agent_commission, platform_profit = await settle_order(order)
    update = {
        "status": "paid",
        "tx_id": gen_txid(order["network"]),
        "paid_at": iso(now_utc()),
        "fee": fee,
        "merchant_receive": merchant_receive,
        "agent_commission": agent_commission,
        "platform_profit": platform_profit,
        "callback_status": "success",
    }
    await db.orders.update_one({"_id": order["_id"]}, {"$set": update})
    order.update(update)
    return order


@api_router.post("/orders/{order_no}/simulate-pay")
async def simulate_pay(order_no: str):
    order = await db.orders.find_one({"order_no": order_no})
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order["status"] == "paid":
        return {"ok": True, "status": "paid"}
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="订单状态不可支付")
    await mark_paid(order)
    return {"ok": True, "status": "paid"}


@api_router.post("/orders/{order_id}/verify")
async def manual_verify(order_id: str, user: dict = Depends(require_roles("admin"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order["status"] == "paid":
        raise HTTPException(status_code=400, detail="订单已支付")
    await mark_paid(order)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Channels
# ---------------------------------------------------------------------------
@api_router.get("/channels")
async def list_channels(user: dict = Depends(get_current_user)):
    channels = await db.channels.find().sort("created_at", -1).to_list(200)
    return [serialize(c) for c in channels]


@api_router.post("/channels")
async def create_channel(data: ChannelCreate, user: dict = Depends(require_roles("admin"))):
    if data.network not in NETWORKS:
        raise HTTPException(status_code=400, detail="不支持的网络")
    doc = data.model_dump()
    doc["success_rate"] = round(random.uniform(95, 99.5), 1)
    doc["wallet_balance"] = round(random.uniform(10000, 80000), 2)
    doc["created_at"] = iso(now_utc())
    res = await db.channels.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@api_router.patch("/channels/{channel_id}")
async def update_channel(channel_id: str, data: ChannelUpdate, user: dict = Depends(require_roles("admin"))):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="无更新内容")
    await db.channels.update_one({"_id": ObjectId(channel_id)}, {"$set": upd})
    c = await db.channels.find_one({"_id": ObjectId(channel_id)})
    return serialize(c)


# ---------------------------------------------------------------------------
# Accounts (merchants & agents)
# ---------------------------------------------------------------------------
@api_router.get("/accounts")
async def list_accounts(user: dict = Depends(get_current_user), role: Optional[str] = None):
    q: dict = {}
    if user["role"] == "admin":
        q["role"] = role if role else {"$in": ["agent", "merchant"]}
    elif user["role"] == "agent":
        q = {"role": "merchant", "parent_agent_id": str(user["_id"])}
    else:
        raise HTTPException(status_code=403, detail="无权限")
    accounts = await db.users.find(q).sort("created_at", -1).to_list(500)
    return [clean_user(a) for a in accounts]


@api_router.post("/accounts")
async def create_account(data: AccountCreate, user: dict = Depends(require_roles("admin", "agent"))):
    if data.role not in ["agent", "merchant"]:
        raise HTTPException(status_code=400, detail="角色不合法")
    if user["role"] == "agent" and data.role != "merchant":
        raise HTTPException(status_code=403, detail="代理只能创建商户")
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="邮箱已存在")

    parent = data.parent_agent_id
    if user["role"] == "agent":
        parent = str(user["_id"])

    doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "rate": data.rate,
        "parent_agent_id": parent,
        "balance": 0.0,
        "frozen_balance": 0.0,
        "status": "active",
        "created_at": iso(now_utc()),
    }
    if data.role == "merchant":
        doc["api_key"] = gen_api_key()
        doc["api_secret"] = gen_api_secret()
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return clean_user(doc)


@api_router.get("/accounts/{account_id}")
async def get_account(account_id: str, user: dict = Depends(get_current_user)):
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc:
        raise HTTPException(status_code=404, detail="账户不存在")
    if user["role"] == "agent" and acc.get("parent_agent_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="无权限")
    if user["role"] == "merchant" and acc["_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="无权限")
    return clean_user(acc)


@api_router.post("/accounts/{account_id}/adjust")
async def adjust_balance(account_id: str, data: BalanceAdjust,
                         user: dict = Depends(require_roles("admin"))):
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc:
        raise HTTPException(status_code=404, detail="账户不存在")
    amt = round(data.amount, 4)
    if data.action == "credit":
        await db.users.update_one({"_id": acc["_id"]}, {"$inc": {"balance": amt}})
    elif data.action == "debit":
        await db.users.update_one({"_id": acc["_id"]}, {"$inc": {"balance": -amt}})
    elif data.action == "freeze":
        await db.users.update_one({"_id": acc["_id"]},
                                  {"$inc": {"balance": -amt, "frozen_balance": amt}})
    elif data.action == "unfreeze":
        await db.users.update_one({"_id": acc["_id"]},
                                  {"$inc": {"balance": amt, "frozen_balance": -amt}})
    else:
        raise HTTPException(status_code=400, detail="非法操作")
    await db.balance_logs.insert_one({
        "account_id": account_id, "action": data.action, "amount": amt,
        "remark": data.remark, "operator": user["email"], "created_at": iso(now_utc()),
    })
    updated = await db.users.find_one({"_id": acc["_id"]})
    return clean_user(updated)


@api_router.post("/accounts/{account_id}/toggle-status")
async def toggle_status(account_id: str, user: dict = Depends(require_roles("admin"))):
    acc = await db.users.find_one({"_id": ObjectId(account_id)})
    if not acc:
        raise HTTPException(status_code=404, detail="账户不存在")
    new_status = "frozen" if acc.get("status") == "active" else "active"
    await db.users.update_one({"_id": acc["_id"]}, {"$set": {"status": new_status}})
    return {"status": new_status}


@api_router.post("/accounts/{account_id}/reset-api-key")
async def reset_api_key(account_id: str, user: dict = Depends(require_roles("admin", "agent"))):
    acc = await db.users.find_one({"_id": ObjectId(account_id), "role": "merchant"})
    if not acc:
        raise HTTPException(status_code=404, detail="商户不存在")
    if user["role"] == "agent" and acc.get("parent_agent_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="无权限")
    key, sec = gen_api_key(), gen_api_secret()
    await db.users.update_one({"_id": acc["_id"]}, {"$set": {"api_key": key, "api_secret": sec}})
    return {"api_key": key, "api_secret": sec}


# ---------------------------------------------------------------------------
# Settlements / reconciliation
# ---------------------------------------------------------------------------
@api_router.get("/settlements/reconciliation")
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


@api_router.get("/settlements/payouts")
async def list_payouts(user: dict = Depends(get_current_user)):
    scope = await merchant_ids_for_scope(user)
    q: dict = {}
    if scope is not None:
        q["merchant_id"] = {"$in": [str(i) for i in scope]}
    payouts = await db.payouts.find(q).sort("created_at", -1).to_list(500)
    return [serialize(p) for p in payouts]


class PayoutCreate(BaseModel):
    amount: float


@api_router.post("/settlements/payouts")
async def request_payout(data: PayoutCreate, user: dict = Depends(get_current_user)):
    if user["role"] not in ["merchant", "agent"]:
        raise HTTPException(status_code=403, detail="仅商户/代理可提现")
    if data.amount <= 0 or data.amount > user.get("balance", 0):
        raise HTTPException(status_code=400, detail="余额不足")
    doc = {
        "merchant_id": str(user["_id"]),
        "merchant_name": user["name"],
        "amount": round(data.amount, 2),
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.users.update_one({"_id": user["_id"]},
                              {"$inc": {"balance": -data.amount, "frozen_balance": data.amount}})
    res = await db.payouts.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@api_router.post("/settlements/payouts/{payout_id}/approve")
async def approve_payout(payout_id: str, user: dict = Depends(require_roles("admin"))):
    p = await db.payouts.find_one({"_id": ObjectId(payout_id)})
    if not p or p["status"] != "pending":
        raise HTTPException(status_code=400, detail="提现单不存在或已处理")
    await db.payouts.update_one({"_id": p["_id"]},
                                {"$set": {"status": "approved", "approved_at": iso(now_utc())}})
    await db.users.update_one({"_id": ObjectId(p["merchant_id"])},
                              {"$inc": {"frozen_balance": -p["amount"]}})
    return {"ok": True}


@api_router.post("/settlements/payouts/{payout_id}/reject")
async def reject_payout(payout_id: str, user: dict = Depends(require_roles("admin"))):
    p = await db.payouts.find_one({"_id": ObjectId(payout_id)})
    if not p or p["status"] != "pending":
        raise HTTPException(status_code=400, detail="提现单不存在或已处理")
    await db.payouts.update_one({"_id": p["_id"]}, {"$set": {"status": "rejected"}})
    await db.users.update_one({"_id": ObjectId(p["merchant_id"])},
                              {"$inc": {"balance": p["amount"], "frozen_balance": -p["amount"]}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
async def seed():
    await db.users.create_index("email", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin = await db.users.find_one({"email": admin_email})
    if admin is None:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "平台管理员", "role": "admin", "balance": 0.0,
            "frozen_balance": 0.0, "status": "active", "created_at": iso(now_utc()),
        })
    elif not verify_password(admin_password, admin["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

    if await db.channels.count_documents({}) == 0:
        base = [
            {"name": "TRC20 极速通道", "network": "TRC20", "fee_rate": 0.02, "weight": 50,
             "min_amount": 10, "max_amount": 50000, "status": "active"},
            {"name": "ERC20 高速通道", "network": "ERC20", "fee_rate": 0.03, "weight": 20,
             "min_amount": 50, "max_amount": 100000, "status": "active"},
            {"name": "BEP20 低费通道", "network": "BEP20", "fee_rate": 0.015, "weight": 30,
             "min_amount": 10, "max_amount": 30000, "status": "active"},
        ]
        for c in base:
            c["success_rate"] = round(random.uniform(96, 99.5), 1)
            c["wallet_balance"] = round(random.uniform(20000, 90000), 2)
            c["created_at"] = iso(now_utc())
        await db.channels.insert_many(base)

    # demo agent + merchants
    if await db.users.count_documents({"role": "agent"}) == 0:
        agent_res = await db.users.insert_one({
            "email": "agent@demo.com", "password_hash": hash_password("agent888"),
            "name": "华东一级代理", "role": "agent", "rate": 0.015,
            "parent_agent_id": None, "balance": 0.0, "frozen_balance": 0.0,
            "status": "active", "created_at": iso(now_utc()),
        })
        agent_id = str(agent_res.inserted_id)
        merchants = [
            {"email": "merchant@demo.com", "name": "星辰科技", "rate": 0.03, "parent": agent_id},
            {"email": "shop2@demo.com", "name": "云端商城", "rate": 0.028, "parent": agent_id},
            {"email": "shop3@demo.com", "name": "极光支付", "rate": 0.035, "parent": None},
        ]
        m_ids = []
        for m in merchants:
            r = await db.users.insert_one({
                "email": m["email"], "password_hash": hash_password("merchant888"),
                "name": m["name"], "role": "merchant", "rate": m["rate"],
                "parent_agent_id": m["parent"], "balance": 0.0, "frozen_balance": 0.0,
                "status": "active", "api_key": gen_api_key(), "api_secret": gen_api_secret(),
                "created_at": iso(now_utc()),
            })
            m_ids.append((str(r.inserted_id), m["name"]))

        # demo orders across last 7 days
        channels = await db.channels.find({"status": "active"}).to_list(10)
        for _ in range(120):
            mid, mname = random.choice(m_ids)
            ch = random.choice(channels)
            amount = round(random.uniform(50, 3000), 2)
            created = now_utc() - timedelta(days=random.randint(0, 6),
                                            hours=random.randint(0, 23),
                                            minutes=random.randint(0, 59))
            paid = random.random() < 0.8
            order = {
                "order_no": gen_order_no(), "merchant_id": mid, "merchant_name": mname,
                "amount_usdt": amount, "network": ch["network"],
                "wallet_address": gen_wallet_address(ch["network"]), "tx_id": None,
                "status": "pending", "channel_id": str(ch["_id"]), "channel_name": ch["name"],
                "remark": "", "created_at": iso(created), "paid_at": None,
                "expires_at": iso(created + timedelta(minutes=15)),
            }
            res = await db.orders.insert_one(order)
            order["_id"] = res.inserted_id
            if paid:
                await mark_paid(order)
            elif random.random() < 0.5:
                await db.orders.update_one({"_id": order["_id"]}, {"$set": {"status": "expired"}})
    logger.info("Seed complete.")


@app.on_event("startup")
async def on_startup():
    await seed()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_methods=["*"],
    allow_headers=["*"],
)
