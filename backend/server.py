import os
import io
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, field_validator
from PIL import Image
from zoneinfo import ZoneInfo
import asyncio
import logging
import requests

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

JWT_ALGORITHM = "HS256"

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "heying-project-club"
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(
        f"{STORAGE_URL}/init",
        json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")},
        timeout=30,
    )
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_admin_token(username: str) -> str:
    payload = {
        "sub": username,
        "role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def require_admin(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=401, detail="无权限")
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效的登录凭证")


class InquiryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=5, max_length=20)
    city: Optional[str] = ""
    inquiry_type: str = Field(default="项目合作")
    message: str = Field(min_length=1, max_length=2000)


class Inquiry(BaseModel):
    id: str
    name: str
    phone: str
    city: str
    inquiry_type: str
    message: str
    status: str
    created_at: str


class AdminLogin(BaseModel):
    username: str
    password: str


class StatusUpdate(BaseModel):
    status: str


class ProjectInput(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    category: str = Field(default="科技创新")
    status: str = Field(default="对接中")
    investment: str = Field(default="")
    region: str = Field(default="全国")
    description: str = Field(default="", max_length=2000)
    highlights: List[str] = Field(default_factory=list)
    image: str = Field(default="")


class PublishUpdate(BaseModel):
    published: bool


class FeaturedUpdate(BaseModel):
    featured: bool


class ContactInfo(BaseModel):
    hotline: str = "400-888-6888"
    wechat: str = "heyingkefu"
    hours: str = "9:00 - 21:00"
    email: str = "contact@heying.com"


class TeamMember(BaseModel):
    role: str = Field(min_length=1, max_length=30)
    person: str = Field(min_length=1, max_length=30)
    image: str = ""


class StatItem(BaseModel):
    num: str = Field(min_length=1, max_length=20)
    suffix: str = Field(default="", max_length=10)
    label: str = Field(min_length=1, max_length=20)


class TierItem(BaseModel):
    count: str = Field(min_length=1, max_length=30)
    income: str = Field(min_length=1, max_length=30)
    featured: bool = False


class EdgeItem(BaseModel):
    title: str = Field(min_length=1, max_length=30)
    desc: str = Field(default="", max_length=200)
    image: str = ""


class MilestoneItem(BaseModel):
    year: str = Field(min_length=1, max_length=10)
    title: str = Field(min_length=1, max_length=30)
    desc: str = Field(default="", max_length=200)


DEFAULT_CHAT_QUESTIONS = [
    {"text": "你们有什么项目？", "answer": "平台每月发布安全稳定的优质项目，涵盖绿色能源、科技创新、商业渠道、实体产业等类别。您可以到「项目中心」查看在架项目详情，或扫码进群获取最新项目清单。"},
    {"text": "怎么合作？", "answer": "合作方式有团长合作、项目方合作、资源方合作。请扫描上方微信群二维码进群，或留下您的姓名和电话，人工客服会尽快与您一对一对接。"},
    {"text": "收益怎么样？", "answer": "团队收益参考：10人团队月入约2-3万元，20人团队约5-6万元，50人团队10万元以上。收益与团队运营情况相关，不构成收益承诺，具体以正式合作协议为准。"},
    {"text": "怎么联系客服？", "answer": "您可以直接在本窗口留言（请留下姓名和电话），人工客服会在工作时间 9:00-21:00 内尽快回复；也可以扫描上方二维码进群咨询。"},
]


class QuestionCard(BaseModel):
    text: str = Field(min_length=1, max_length=50)
    image: str = ""
    answer: str = ""


class QrCodeItem(BaseModel):
    image: str = ""
    label: str = ""
    uploaded_at: str = ""
    active: bool = True


class ChatConfig(BaseModel):
    welcome: str = "您好，欢迎来到合赢项目社！请描述您想咨询的问题，客服会尽快回复您。"
    ai_enabled: bool = True
    qr_image: str = ""
    qr_updated_at: str = ""
    qr_codes: List[QrCodeItem] = Field(default_factory=list)
    questions: List[QuestionCard] = Field(default_factory=lambda: [QuestionCard(**q) for q in DEFAULT_CHAT_QUESTIONS])

    @field_validator("questions", mode="before")
    @classmethod
    def _coerce_questions(cls, v):
        return [{"text": q, "image": "", "answer": ""} if isinstance(q, str) else q for q in (v or [])]


class SiteSettings(BaseModel):
    contact: ContactInfo = ContactInfo()
    team: List[TeamMember] = Field(default_factory=list)
    stats: List[StatItem] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    chat: ChatConfig = ChatConfig()
    tiers: List[TierItem] = Field(default_factory=list)
    edges: List[EdgeItem] = Field(default_factory=list)
    milestones: List[MilestoneItem] = Field(default_factory=list)


class ArticleInput(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    summary: str = Field(default="", max_length=300)
    content: str = Field(default="")
    cover: str = Field(default="")


class ChatStart(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    name: str = Field(default="访客", max_length=30)
    source: str = Field(default="", max_length=50)


class ChatMessageInput(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


QR_KEYWORDS = ("怎么合作", "如何合作", "合作方式", "怎么加入", "如何加入", "怎么参与", "如何参与", "加入", "加盟", "代理", "团长", "联系方式", "人工", "微信", "二维码", "扫码", "进群", "加群")

CN_TZ = ZoneInfo("Asia/Shanghai")
_geo_cache = {}


def lookup_region(ip: str) -> str:
    if ip in _geo_cache:
        return _geo_cache[ip]
    if ip.startswith(("10.", "192.168.", "127.", "172.")) or ip in ("::1", "localhost", "unknown"):
        _geo_cache[ip] = "本地访问"
        return "本地访问"
    try:
        resp = requests.get(
            f"http://ip-api.com/json/{ip}?lang=zh-CN&fields=status,country,regionName,city",
            timeout=5,
        )
        d = resp.json()
        if d.get("status") == "success":
            region = " ".join(x for x in [d.get("country"), d.get("regionName"), d.get("city")] if x)
        else:
            region = "未知地区"
    except Exception:
        region = "未知地区"
    _geo_cache[ip] = region
    return region


class TrackInput(BaseModel):
    path: str = Field(min_length=1, max_length=200)
    source: str = Field(default="", max_length=50)


def parse_ua(ua: str):
    u = ua.lower()
    if "micromessenger" in u:
        browser = "微信内置"
    elif "edg" in u:
        browser = "Edge"
    elif "firefox" in u:
        browser = "Firefox"
    elif "chrome" in u:
        browser = "Chrome"
    elif "safari" in u:
        browser = "Safari"
    else:
        browser = "其他浏览器"
    if "ipad" in u or "tablet" in u:
        device = "平板"
    elif "mobile" in u or "iphone" in u or "android" in u:
        device = "手机"
    else:
        device = "电脑"
    return device, browser


ARTICLES_SEED = [
    {
        "title": "分布式光伏新政落地，社区能源项目迎发展机遇",
        "summary": "多地出台分布式光伏支持政策，社区共建电站模式成为绿色能源赛道的关注焦点。",
        "content": "近期，多地陆续出台分布式光伏支持政策，鼓励社区、园区场景下的光伏共建模式。\n\n对项目方而言，并网流程进一步简化，收益结算更加透明；对合作伙伴而言，社区电站具备投入灵活、回报周期清晰的特点，是绿色能源赛道中门槛相对友好的参与方式。\n\n合赢项目社已上线多个光伏社区电站合作项目，覆盖华东、珠三角等区域，感兴趣的伙伴可前往项目中心查看详情，或联系客服获取项目资料。",
        "cover": "/images/projects/news-1.png",
    },
    {
        "title": "社区团购进入精细化运营阶段，供应链能力成竞争关键",
        "summary": "行业从规模扩张转向精细化运营，产地直供与仓配一体化成为团长盈利的核心支撑。",
        "content": "社区团购行业正在从早期的规模扩张，进入精细化运营阶段。用户更关注商品品质与履约体验，团长的盈利能力越来越依赖背后的供应链实力。\n\n产地直供、仓配一体化、高频刚需品类组合，正在成为优质团购项目的标配。平台通过集中采购与智能调度，帮助团长降低库存风险、提升复购率。\n\n合赢项目社的社区团购类项目均经过供应链实地考察，团长合作席位持续开放中。",
        "cover": "/images/projects/news-2.png",
    },
    {
        "title": "合赢项目社合作伙伴突破120家，服务网络持续扩大",
        "summary": "平台合作伙伴数量突破120家，覆盖全国主要经济区，项目对接效率持续提升。",
        "content": "截至本月，合赢项目社合作伙伴数量正式突破120家，覆盖华东、华南、西南、华中等主要经济区域。\n\n目前平台在库优质项目36个以上，涵盖绿色能源、科技创新、商业渠道、实体产业四大赛道，客服团队保持30分钟内响应的服务标准。\n\n感谢每一位伙伴的信任。平台将持续严选项目、优化对接流程，与所有伙伴聚力共赢。",
        "cover": "/images/projects/news-3.png",
    },
]


PROJECTS_SEED = [
    {
        "title": "礼品卡合作项目",
        "category": "商业渠道",
        "status": "招募团长",
        "investment": "灵活投入",
        "region": "全国",
        "description": "礼品卡项目，收益稳定，项目合规，平台全程对接支持，团队长带队共享收益。",
        "highlights": ["收益稳定", "项目合规", "平台全程对接", "团队长直招"],
        "image": "/images/projects/project-giftcard.webp",
        "featured": True,
    },
    {
        "title": "绿源光伏社区电站",
        "category": "绿色能源",
        "status": "对接中",
        "investment": "50-200万",
        "region": "华东大区",
        "description": "分布式光伏电站社区共建项目，与国家电网并网合作，收益稳定，适合长期持有。",
        "highlights": ["并网收益保障", "20年长期回报", "专业运维团队"],
        "image": "/images/projects/project-1.webp",
    },
    {
        "title": "智链AI数据服务平台",
        "category": "科技创新",
        "status": "资金筹备",
        "investment": "100-500万",
        "region": "深圳",
        "description": "面向中小企业的AI数据标注与模型训练服务平台，已签约多家头部客户。",
        "highlights": ["头部客户背书", "技术团队成熟", "现金流稳定"],
        "image": "/images/projects/project-2.webp",
    },
    {
        "title": "云仓优选社区团购",
        "category": "商业渠道",
        "status": "招募团长",
        "investment": "5-20万",
        "region": "全国",
        "description": "供应链直供社区团购项目，开放城市团长席位，提供选品、物流、系统全扶持。",
        "highlights": ["零库存模式", "总部全程扶持", "高频刚需品类"],
        "image": "/images/projects/project-3.webp",
    },
    {
        "title": "沃野生态农业基地",
        "category": "实体产业",
        "status": "对接中",
        "investment": "30-100万",
        "region": "西南大区",
        "description": "千亩生态果蔬种植基地，订单农业模式，与连锁商超签订长期供货协议。",
        "highlights": ["订单农业保障", "绿色认证资质", "基地实地考察"],
        "image": "/images/projects/project-4.webp",
    },
    {
        "title": "峰行新能源充电桩",
        "category": "绿色能源",
        "status": "资金筹备",
        "investment": "80-300万",
        "region": "珠三角",
        "description": "城市快充桩网络建设项目，政府补贴支持，点位资源已锁定核心商圈。",
        "highlights": ["政策补贴支持", "核心商圈点位", "智能运营系统"],
        "image": "/images/projects/project-5.webp",
    },
    {
        "title": "星链跨境电商孵化",
        "category": "商业渠道",
        "status": "招募团长",
        "investment": "10-50万",
        "region": "全国",
        "description": "跨境电商供应链孵化项目，提供海外仓、物流、运营一站式解决方案。",
        "highlights": ["海外仓资源", "一站式孵化", "成熟供应链"],
        "image": "/images/projects/project-6.webp",
    },
    {
        "title": "慧眼智能安防系统",
        "category": "科技创新",
        "status": "对接中",
        "investment": "60-200万",
        "region": "京津冀",
        "description": "AI视觉安防整体解决方案，覆盖园区、社区、商超场景，渠道合伙人招募中。",
        "highlights": ["自研AI算法", "多场景落地", "渠道分成模式"],
        "image": "/images/projects/project-7.webp",
    },
    {
        "title": "康年大健康连锁",
        "category": "实体产业",
        "status": "资金筹备",
        "investment": "100-800万",
        "region": "长三角",
        "description": "社区健康管理连锁品牌，标准化门店模型已验证，开放区域合伙与单店合作。",
        "highlights": ["标准化门店模型", "区域保护政策", "银发经济赛道"],
        "image": "/images/projects/project-8.webp",
    },
    {
        "title": "牧歌冷链物流网络",
        "category": "实体产业",
        "status": "对接中",
        "investment": "150-600万",
        "region": "华中大区",
        "description": "生鲜冷链城配网络，已签约多家生鲜电商与连锁餐饮，干线+城配一体化运营。",
        "highlights": ["长期客户合约", "资产收益清晰", "行业高速增长"],
        "image": "/images/projects/project-9.webp",
    },
]


@app.on_event("startup")
async def startup():
    try:
        await asyncio.to_thread(init_storage)
    except Exception as e:
        print(f"Storage init failed: {e}")
    await db.users.create_index("username", unique=True)
    await db.visits.create_index([("date", 1), ("ip", 1)], unique=False)
    username = os.environ.get("ADMIN_USERNAME", "admin")
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"username": username})
    if existing is None:
        await db.users.insert_one({
            "username": username,
            "password_hash": hash_password(password),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    if await db.projects.count_documents({}) == 0:
        docs = []
        for p in PROJECTS_SEED:
            docs.append({"id": str(uuid.uuid4()), **p, "created_at": datetime.now(timezone.utc).isoformat()})
        await db.projects.insert_many(docs)

    if await db.articles.count_documents({}) == 0:
        docs = []
        for a in ARTICLES_SEED:
            docs.append({
                "id": str(uuid.uuid4()),
                **a,
                "published": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        await db.articles.insert_many(docs)


@api_router.get("/")
async def root():
    return {"message": "合赢项目社 API"}


@api_router.get("/projects")
async def list_projects(category: Optional[str] = None):
    query = {"published": {"$ne": False}}
    if category and category != "全部":
        query["category"] = category
    projects = await db.projects.find(query, {"_id": 0}).sort([("featured", -1), ("created_at", 1)]).to_list(100)
    return {"projects": projects}


def migrate_qr_codes(cfg: dict) -> dict:
    """旧的单二维码字段迁移为多码列表（活码管理）。"""
    if not cfg.get("qr_codes") and cfg.get("qr_image"):
        cfg["qr_codes"] = [{
            "image": cfg["qr_image"],
            "label": "1群",
            "uploaded_at": cfg.get("qr_updated_at") or datetime.now(timezone.utc).isoformat(),
            "active": True,
        }]
    return cfg


def sync_active_qr(cfg: dict) -> dict:
    """qr_image/qr_updated_at 始终同步为当前启用的群二维码，供聊天推送与联系页直接使用。"""
    codes = cfg.get("qr_codes") or []
    active = next((q for q in codes if q.get("active") and q.get("image")), None)
    if active:
        cfg["qr_image"] = active["image"]
        cfg["qr_updated_at"] = active.get("uploaded_at", "")
    elif codes:
        cfg["qr_image"] = ""
        cfg["qr_updated_at"] = ""
    return cfg


@api_router.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"key": "site"}, {"_id": 0, "key": 0})
    if not doc:
        return {"contact": ContactInfo().model_dump(), "team": [], "chat": ChatConfig().model_dump()}
    doc.setdefault("chat", ChatConfig().model_dump())
    doc["chat"].setdefault("ai_enabled", True)
    if "questions" not in doc["chat"]:
        doc["chat"]["questions"] = ChatConfig().model_dump()["questions"]
    else:
        doc["chat"]["questions"] = [
            {"text": q, "image": "", "answer": ""} if isinstance(q, str) else {"text": q.get("text", ""), "image": q.get("image", ""), "answer": q.get("answer", "")}
            for q in doc["chat"]["questions"]
        ]
    doc["chat"] = sync_active_qr(migrate_qr_codes(doc["chat"]))
    return doc


@api_router.get("/articles")
async def list_articles():
    articles = await db.articles.find(
        {"published": {"$ne": False}},
        {"_id": 0, "content": 0},
    ).sort("created_at", -1).to_list(100)
    return {"articles": articles}


@api_router.get("/articles/{article_id}")
async def get_article(article_id: str):
    doc = await db.articles.find_one({"id": article_id, "published": {"$ne": False}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="文章不存在")
    return doc


@api_router.post("/chat/start")
async def chat_start(data: ChatStart):
    now = datetime.now(timezone.utc).isoformat()
    res = await db.chat_sessions.update_one(
        {"id": data.session_id},
        {"$setOnInsert": {"id": data.session_id, "created_at": now, "source": data.source.strip()},
         "$set": {"name": data.name}},
        upsert=True,
    )
    settings = await db.settings.find_one({"key": "site"}, {"_id": 0, "chat": 1})
    chat_cfg = sync_active_qr(migrate_qr_codes(dict((settings or {}).get("chat") or ChatConfig().model_dump())))
    if res.upserted_id is not None:
        # 新会话：自动发送欢迎语 + 微信群二维码
        batch = []
        welcome = (chat_cfg.get("welcome") or "").strip()
        if welcome:
            batch.append({
                "id": str(uuid.uuid4()),
                "session_id": data.session_id,
                "sender": "admin",
                "via": "auto",
                "text": welcome,
                "image": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        qr_image = chat_cfg.get("qr_image", "")
        if qr_image:
            qr_label = next((q.get("label", "") for q in (chat_cfg.get("qr_codes") or []) if q.get("image") == qr_image), "")
            qr_now = datetime.now(timezone.utc).isoformat()
            batch.append({
                "id": str(uuid.uuid4()),
                "session_id": data.session_id,
                "sender": "admin",
                "via": "auto",
                "text": "欢迎加入合赢项目社！请长按或扫描下方二维码添加微信群，最新项目与合作信息第一时间在群内分享。",
                "image": qr_image,
                "created_at": qr_now,
            })
            await db.qr_pushes.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": data.session_id,
                "image": qr_image,
                "label": qr_label,
                "created_at": qr_now,
            })
        if batch:
            await db.chat_messages.insert_many(batch)
            await db.chat_sessions.update_one(
                {"id": data.session_id},
                {"$set": {"last_message_at": batch[-1]["created_at"], "last_message": batch[-1]["text"][:50]}},
            )
    return {"session_id": data.session_id, "welcome": chat_cfg.get("welcome", "")}


@api_router.get("/chat/{session_id}/messages")
async def chat_messages(session_id: str):
    messages = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"messages": messages}


AI_FALLBACK_TEXT = "已收到您的留言！人工客服会尽快回复（工作时间 9:00-21:00）。为方便联系您，请留下姓名和电话；也可以先扫描上方微信群二维码进群，最新项目群内第一时间分享。"


async def _append_admin_message(session_id: str, text: str, via: str):
    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "sender": "admin",
        "via": via,
        "text": text,
        "image": "",
        "created_at": now,
    })
    await db.chat_sessions.update_one(
        {"id": session_id},
        {"$set": {"last_message_at": now, "last_message": text[:50]}},
    )


async def generate_ai_reply(session_id: str, chat_cfg: dict):
    """访客自由留言未命中规则时，由 AI（Emergent 通用密钥，GPT-5.4-mini）生成回复。"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

        history = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", -1).to_list(12)
        history.reverse()
        transcript = "\n".join(f"{'访客' if m['sender'] == 'visitor' else '客服'}: {m['text']}" for m in history if m.get("text"))

        projects = await db.projects.find({"published": {"$ne": False}}, {"_id": 0, "id": 0, "created_at": 0, "published": 0}).to_list(50)
        kb = "\n".join(
            f"· {p['title']}（{p['category']}｜{p.get('region', '')}｜投入区间{p.get('investment') or '详询客服'}｜{p.get('status', '')}）：{p.get('description', '')}"
            + (f" 亮点：{'、'.join(p.get('highlights', []))}" if p.get("highlights") else "")
            for p in projects
        )
        faq = "\n".join(
            f"Q：{q.get('text')}\nA：{q.get('answer')}" for q in (chat_cfg.get("questions") or []) if isinstance(q, dict) and q.get("answer")
        )
        system = (
            "你是「合赢项目社」的在线客服助手。平台主要面向全国招募团队长（团长），为团队长提供稳定项目；"
            "团队通过专业的项目审核、项目评估、项目整合，保障项目稳定可靠；平台每个月都会发布安全、稳定、合法的项目供团队长合作，"
            "并在微信群内同步分享最新项目；平台不收取任何加盟费、服务费等费用。"
            "团队发展收益参考：10人团队月入约2-3万元，20人团队约5-6万元，50人团队10万元以上；"
            "收益与团队运营情况相关，不构成收益承诺，具体以正式合作协议为准。"
            "合作方式：团长合作、项目方合作、资源方合作。工作时间 9:00-21:00。\n"
            f"常见问题标准答案（优先参考）：\n{faq}\n"
            f"平台当前在架项目（回答项目相关问题时以此为准）：\n{kb}\n"
            "回答规则：全程使用中文；语气专业热情；回答控制在80字以内；不使用 Markdown 符号；"
            "访客询问怎么合作、怎么加入、联系方式或人工客服时，告知微信群二维码已在上方聊天记录中，请扫码进群，人工客服会尽快一对一对接，不要编造微信号或电话；"
            "知识库中没有的信息不要编造，引导访客留下姓名和电话，人工客服会尽快跟进。"
        )
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"kefu-{session_id}-{uuid.uuid4()}",
            system_message=system,
        ).with_model("openai", "gpt-5.4-mini")
        reply = ""
        async for event in chat.stream_message(UserMessage(text=f"最近对话记录：\n{transcript}\n\n请回复访客的最后一条消息。")):
            if isinstance(event, TextDelta):
                reply += event.content
            elif isinstance(event, StreamDone):
                break
        reply = reply.strip()
        if not reply:
            raise RuntimeError("empty AI reply")
        await _append_admin_message(session_id, reply, "ai")
    except Exception as e:
        logging.getLogger(__name__).exception("AI reply failed for %s: %s", session_id, e)
        await _append_admin_message(session_id, AI_FALLBACK_TEXT, "auto_fallback")


@api_router.post("/chat/{session_id}/messages", status_code=201)
async def chat_send(session_id: str, data: ChatMessageInput):
    session = await db.chat_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在，请先开始咨询")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "sender": "visitor",
        "text": data.text,
        "created_at": now,
    }
    await db.chat_messages.insert_one(doc)
    await db.chat_sessions.update_one(
        {"id": session_id},
        {"$set": {"last_message_at": now, "last_message": data.text[:50], "unread_admin": True}},
    )
    settings = await db.settings.find_one({"key": "site"}, {"_id": 0, "chat": 1})
    chat_cfg = sync_active_qr(migrate_qr_codes(dict((settings or {}).get("chat") or {})))
    qr_image = chat_cfg.get("qr_image", "")
    qr_label = next((q.get("label", "") for q in (chat_cfg.get("qr_codes") or []) if q.get("image") == qr_image), "")
    matched_q = None
    matched_img = ""
    matched_answer = ""
    for q in chat_cfg.get("questions") or []:
        q_text = q if isinstance(q, str) else q.get("text", "")
        if q_text and q_text == data.text:
            matched_q = q_text
            if not isinstance(q, str):
                matched_img = q.get("image", "")
                matched_answer = q.get("answer", "")
            break
    answered = False
    if matched_q:
        await db.question_clicks.insert_one({
            "id": str(uuid.uuid4()),
            "question": matched_q,
            "session_id": session_id,
            "created_at": now,
        })
        if matched_answer or matched_img:
            card_now = datetime.now(timezone.utc).isoformat()
            await db.chat_messages.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "sender": "admin",
                "via": "auto",
                "text": matched_answer or "这是相关介绍图，供您参考：",
                "image": matched_img,
                "created_at": card_now,
            })
            await db.chat_sessions.update_one(
                {"id": session_id},
                {"$set": {"last_message_at": card_now, "last_message": (matched_answer or "[介绍图片]")[:50]}},
            )
            answered = True
    # 自由留言（非卡片点击）且 AI 开启：由 AI 作答；二维码规则仅负责补发二维码图片
    use_ai = bool(chat_cfg.get("ai_enabled", True)) and not matched_q
    if qr_image and any(k in data.text for k in QR_KEYWORDS):
        recent_msgs = await db.chat_messages.find(
            {"session_id": session_id}, {"_id": 0, "sender": 1, "image": 1}
        ).sort("created_at", -1).to_list(5)
        qr_sent_recently = any(m.get("sender") == "admin" and m.get("image") == qr_image for m in recent_msgs)
        qr_now = datetime.now(timezone.utc).isoformat()
        if qr_sent_recently and use_ai:
            pass  # AI 会在回复中引导扫上方二维码，不再重复发提醒
        elif qr_sent_recently:
            # 二维码刚推送过，仅文字提醒，避免刷屏
            await db.chat_messages.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "sender": "admin",
                "via": "auto",
                "text": "微信群二维码就在上方聊天记录里，长按识别即可进群；需要人工服务请留下姓名和电话，客服会尽快与您对接。",
                "image": "",
                "created_at": qr_now,
            })
        else:
            await db.chat_messages.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "sender": "admin",
                "via": "auto",
                "text": "欢迎加入合赢项目社！请长按或扫描下方二维码添加微信群，最新项目与合作信息第一时间在群内分享，进群后客服会尽快与您一对一对接。",
                "image": qr_image,
                "created_at": qr_now,
            })
            await db.qr_pushes.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "image": qr_image,
                "label": qr_label,
                "created_at": qr_now,
            })
        if not (qr_sent_recently and use_ai):
            await db.chat_sessions.update_one(
                {"id": session_id},
                {"$set": {"last_message_at": qr_now, "last_message": "[微信群二维码]"}},
            )
        answered = True
    if use_ai:
        # 交给 AI 客服回复（后台异步，前台轮询拿结果）
        asyncio.create_task(generate_ai_reply(session_id, chat_cfg))
    elif not answered:
        # AI 关闭且未命中规则：转人工提示（每个会话仅发送一次）
        fallback_exists = await db.chat_messages.find_one(
            {"session_id": session_id, "via": "auto_fallback"}, {"_id": 1}
        )
        if not fallback_exists:
            await _append_admin_message(session_id, AI_FALLBACK_TEXT, "auto_fallback")
    doc.pop("_id", None)
    return doc


@api_router.post("/contact", status_code=201)
async def create_inquiry(data: InquiryCreate):
    doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "status": "待跟进",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.inquiries.insert_one(doc)
    return {"message": "提交成功，客服将尽快与您联系", "id": doc["id"]}


@api_router.post("/admin/login")
async def admin_login(data: AdminLogin):
    user = await db.users.find_one({"username": data.username})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {"token": create_admin_token(user["username"]), "username": user["username"]}


@api_router.get("/admin/inquiries", response_model=List[Inquiry])
async def list_inquiries(_: str = Depends(require_admin)):
    return await db.inquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.patch("/admin/inquiries/{inquiry_id}")
async def update_inquiry(inquiry_id: str, data: StatusUpdate, _: str = Depends(require_admin)):
    result = await db.inquiries.update_one({"id": inquiry_id}, {"$set": {"status": data.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="留言不存在")
    return {"message": "状态已更新"}


@api_router.get("/admin/projects")
async def admin_list_projects(_: str = Depends(require_admin)):
    projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"projects": projects}


@api_router.post("/admin/projects", status_code=201)
async def create_project(data: ProjectInput, _: str = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "published": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.projects.insert_one(doc)
    return {"message": "项目已发布", "id": doc["id"]}


@api_router.put("/admin/projects/{project_id}")
async def update_project(project_id: str, data: ProjectInput, _: str = Depends(require_admin)):
    result = await db.projects.update_one({"id": project_id}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"message": "项目已更新"}


@api_router.patch("/admin/projects/{project_id}/publish")
async def toggle_project_publish(project_id: str, data: PublishUpdate, _: str = Depends(require_admin)):
    result = await db.projects.update_one({"id": project_id}, {"$set": {"published": data.published}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"message": "已上架" if data.published else "已下架"}


@api_router.patch("/admin/projects/{project_id}/featured")
async def toggle_project_featured(project_id: str, data: FeaturedUpdate, _: str = Depends(require_admin)):
    result = await db.projects.update_one({"id": project_id}, {"$set": {"featured": data.featured}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"message": "已设为主打" if data.featured else "已取消主打"}


@api_router.delete("/admin/projects/{project_id}")
async def delete_project(project_id: str, _: str = Depends(require_admin)):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"message": "项目已删除"}


@api_router.put("/admin/settings")
async def update_settings(data: SiteSettings, _: str = Depends(require_admin)):
    old = await db.settings.find_one({"key": "site"}, {"_id": 0, "chat": 1})
    old_chat = migrate_qr_codes(dict((old or {}).get("chat") or {}))
    old_images = {q.get("image"): q.get("uploaded_at", "") for q in (old_chat.get("qr_codes") or [])}
    doc = data.model_dump()
    chat = migrate_qr_codes(doc["chat"])
    now_iso = datetime.now(timezone.utc).isoformat()
    for item in chat.get("qr_codes") or []:
        if not item.get("image"):
            continue
        # 新上传的图片打上当前时间戳；未换图的保留原上传时间
        item["uploaded_at"] = old_images.get(item["image"]) or now_iso
    doc["chat"] = sync_active_qr(chat)
    await db.settings.update_one(
        {"key": "site"},
        {"$set": {**doc, "key": "site"}},
        upsert=True,
    )
    return {"message": "设置已保存"}


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def to_webp(data: bytes) -> bytes:
    img = Image.open(io.BytesIO(data))
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
    else:
        img = img.convert("RGB")
    if max(img.size) > 1920:
        img.thumbnail((1920, 1920), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=82)
    return buf.getvalue()


@api_router.post("/admin/upload", status_code=201)
async def admin_upload(file: UploadFile = File(...), _: str = Depends(require_admin)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="仅支持 JPG / PNG / WEBP / GIF 图片")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过 5MB")
    content_type = file.content_type
    if content_type != "image/gif":
        try:
            data = await asyncio.to_thread(to_webp, data)
            content_type = "image/webp"
        except Exception:
            raise HTTPException(status_code=400, detail="图片文件损坏或无法解析")
    ext = "webp" if content_type == "image/webp" else "gif"
    path = f"{APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
    result = await asyncio.to_thread(put_object, path, data, content_type)
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result["size"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": f"/api/files/{result['path']}", "path": result["path"]}


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="文件不存在")
    data, content_type = await asyncio.to_thread(get_object, path)
    return Response(content=data, media_type=record.get("content_type", content_type))


@api_router.get("/admin/articles")
async def admin_list_articles(_: str = Depends(require_admin)):
    articles = await db.articles.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"articles": articles}


@api_router.post("/admin/articles", status_code=201)
async def create_article(data: ArticleInput, _: str = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "published": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.articles.insert_one(doc)
    return {"message": "文章已发布", "id": doc["id"]}


@api_router.put("/admin/articles/{article_id}")
async def update_article(article_id: str, data: ArticleInput, _: str = Depends(require_admin)):
    result = await db.articles.update_one({"id": article_id}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="文章不存在")
    return {"message": "文章已更新"}


@api_router.patch("/admin/articles/{article_id}/publish")
async def toggle_article_publish(article_id: str, data: PublishUpdate, _: str = Depends(require_admin)):
    result = await db.articles.update_one({"id": article_id}, {"$set": {"published": data.published}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="文章不存在")
    return {"message": "已发布" if data.published else "已下架"}


@api_router.delete("/admin/articles/{article_id}")
async def delete_article(article_id: str, _: str = Depends(require_admin)):
    result = await db.articles.delete_one({"id": article_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="文章不存在")
    return {"message": "文章已删除"}


@api_router.get("/admin/chat/sessions")
async def admin_chat_sessions(_: str = Depends(require_admin)):
    sessions = await db.chat_sessions.find({}, {"_id": 0}).sort("last_message_at", -1).to_list(200)
    return {"sessions": sessions}


@api_router.get("/admin/chat/question-stats")
async def admin_chat_question_stats(_: str = Depends(require_admin)):
    settings = await db.settings.find_one({"key": "site"}, {"_id": 0, "chat": 1})
    chat_cfg = (settings or {}).get("chat") or {}
    questions = [
        (q if isinstance(q, str) else q.get("text", ""))
        for q in chat_cfg.get("questions") or []
    ]
    questions = [q for q in questions if q]
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    clicks = await db.question_clicks.find({}, {"_id": 0, "question": 1, "created_at": 1}).to_list(10000)
    totals = {}
    recent = {}
    for c in clicks:
        q = c["question"]
        totals[q] = totals.get(q, 0) + 1
        if c["created_at"] >= since:
            recent[q] = recent.get(q, 0) + 1
    for q in list(totals):
        if q not in questions:
            questions.append(q)
    stats = [
        {"question": q, "total": totals.get(q, 0), "last7d": recent.get(q, 0)}
        for q in questions
    ]
    stats.sort(key=lambda x: -x["total"])
    return {"stats": stats}


CN_TZ = timezone(timedelta(hours=8))


@api_router.get("/admin/chat/qr-stats")
async def admin_chat_qr_stats(_: str = Depends(require_admin)):
    pushes = await db.qr_pushes.find({}, {"_id": 0, "created_at": 1, "image": 1, "label": 1}).to_list(100000)
    now_cn = datetime.now(CN_TZ)
    today = now_cn.strftime("%Y-%m-%d")
    days = [(now_cn - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(13, -1, -1)]
    buckets = {d: 0 for d in days}
    by_image = {}
    total = 0
    today_count = 0
    for p in pushes:
        total += 1
        img = p.get("image") or ""
        if img:
            slot = by_image.setdefault(img, {"image": img, "label": p.get("label", ""), "count": 0})
            slot["count"] += 1
            if p.get("label"):
                slot["label"] = p["label"]
        try:
            d = datetime.fromisoformat(p["created_at"]).astimezone(CN_TZ).strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            continue
        if d == today:
            today_count += 1
        if d in buckets:
            buckets[d] += 1
    return {
        "total": total,
        "today": today_count,
        "daily": [{"date": d, "count": buckets[d]} for d in days],
        "by_image": sorted(by_image.values(), key=lambda x: -x["count"]),
    }


@api_router.get("/admin/chat/{session_id}/messages")
async def admin_chat_messages(session_id: str, _: str = Depends(require_admin)):
    await db.chat_sessions.update_one({"id": session_id}, {"$set": {"unread_admin": False}})
    messages = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"messages": messages}


@api_router.post("/admin/chat/{session_id}/messages", status_code=201)
async def admin_chat_reply(session_id: str, data: ChatMessageInput, _: str = Depends(require_admin)):
    session = await db.chat_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "sender": "admin",
        "text": data.text,
        "created_at": now,
    }
    await db.chat_messages.insert_one(doc)
    await db.chat_sessions.update_one(
        {"id": session_id},
        {"$set": {"last_message_at": now, "last_message": data.text[:50]}},
    )
    doc.pop("_id", None)
    return doc


@api_router.post("/track", status_code=201)
async def track_visit(data: TrackInput, request: Request):
    path = data.path if data.path.startswith("/") else "/"
    if path.startswith("/admin"):
        return {"ok": True}
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )
    now = datetime.now(timezone.utc)
    date_str = now.astimezone(CN_TZ).strftime("%Y-%m-%d")
    recent = await db.visits.find_one({"ip": ip, "date": date_str}, {"_id": 1})
    if recent:
        return {"ok": True, "deduped": True}
    region = await asyncio.to_thread(lookup_region, ip)
    ua = request.headers.get("user-agent", "")[:200]
    device, browser = parse_ua(ua)
    await db.visits.insert_one({
        "id": str(uuid.uuid4()),
        "ip": ip,
        "region": region,
        "path": path,
        "source": data.source.strip(),
        "ua": ua,
        "device": device,
        "browser": browser,
        "date": date_str,
        "created_at": now.isoformat(),
    })
    return {"ok": True}


@api_router.get("/admin/stats/overview")
async def stats_overview(date: str, _: str = Depends(require_admin)):
    query = {"date": date}
    visits = await db.visits.count_documents(query)
    ips = await db.visits.distinct("ip", query)
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$path", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    pages = await db.visits.aggregate(pipeline).to_list(10)

    async def agg_field(field):
        rows = await db.visits.aggregate([
            {"$match": query},
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]).to_list(10)
        return [{"name": r["_id"] or "未知", "count": r["count"]} for r in rows]

    return {
        "date": date,
        "visits": visits,
        "unique_ips": len(ips),
        "top_pages": [{"path": p["_id"], "count": p["count"]} for p in pages],
        "devices": await agg_field("device"),
        "browsers": await agg_field("browser"),
        "sources": [
            {"name": ("直接访问" if s["name"] in ("未知", "") else s["name"]), "count": s["count"]}
            for s in await agg_field("source")
        ],
    }


@api_router.get("/admin/stats/daily")
async def stats_daily(days: int = 14, _: str = Depends(require_admin)):
    days = max(1, min(days, 90))
    today = datetime.now(CN_TZ)
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    pipeline = [
        {"$match": {"date": {"$gte": start}}},
        {"$group": {"_id": "$date", "visits": {"$sum": 1}, "ips": {"$addToSet": "$ip"}}},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.visits.aggregate(pipeline).to_list(90)
    by_date = {r["_id"]: r for r in rows}
    result = []
    for i in range(days):
        d = (today - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        row = by_date.get(d)
        result.append({
            "date": d,
            "visits": row["visits"] if row else 0,
            "unique_ips": len(row["ips"]) if row else 0,
        })
    return {"days": result}


@api_router.get("/admin/stats/funnel")
async def stats_funnel(days: int = 14, _: str = Depends(require_admin)):
    days = max(1, min(days, 90))
    today = datetime.now(CN_TZ)
    days_list = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days - 1, -1, -1)]
    start = days_list[0]
    visit_rows = await db.visits.aggregate([
        {"$match": {"date": {"$gte": start}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
    ]).to_list(90)
    visits_by_day = {r["_id"]: r["count"] for r in visit_rows}
    sessions = await db.chat_sessions.find({}, {"_id": 0, "created_at": 1}).to_list(100000)
    pushes = await db.qr_pushes.find({}, {"_id": 0, "created_at": 1}).to_list(100000)

    def bucket(docs):
        by_day = {}
        for d in docs:
            try:
                day = datetime.fromisoformat(d["created_at"]).astimezone(CN_TZ).strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                continue
            by_day[day] = by_day.get(day, 0) + 1
        return by_day

    chats_by_day = bucket(sessions)
    qr_by_day = bucket(pushes)
    daily = [
        {"date": d, "visits": visits_by_day.get(d, 0), "chats": chats_by_day.get(d, 0), "qr": qr_by_day.get(d, 0)}
        for d in days_list
    ]
    totals = {
        "visits": sum(x["visits"] for x in daily),
        "chats": sum(x["chats"] for x in daily),
        "qr": sum(x["qr"] for x in daily),
    }
    return {"daily": daily, "totals": totals}


@api_router.get("/admin/stats/channel-funnel")
async def stats_channel_funnel(days: int = 30, _: str = Depends(require_admin)):
    days = max(1, min(days, 90))
    today = datetime.now(CN_TZ)
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    visit_rows = await db.visits.aggregate([
        {"$match": {"date": {"$gte": start}}},
        {"$group": {"_id": {"$ifNull": ["$source", ""]}, "count": {"$sum": 1}}},
    ]).to_list(100)
    visits_by_src = {r["_id"] or "": r["count"] for r in visit_rows}
    sessions = await db.chat_sessions.find({}, {"_id": 0, "id": 1, "source": 1, "created_at": 1}).to_list(100000)
    session_src = {}
    chats_by_src = {}
    for s in sessions:
        session_src[s["id"]] = s.get("source", "") or ""
        try:
            day = datetime.fromisoformat(s["created_at"]).astimezone(CN_TZ).strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            continue
        if day >= start:
            src = s.get("source", "") or ""
            chats_by_src[src] = chats_by_src.get(src, 0) + 1
    pushes = await db.qr_pushes.find({}, {"_id": 0, "session_id": 1, "created_at": 1}).to_list(100000)
    qr_by_src = {}
    for p in pushes:
        try:
            day = datetime.fromisoformat(p["created_at"]).astimezone(CN_TZ).strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            continue
        if day < start:
            continue
        src = session_src.get(p.get("session_id"), "")
        qr_by_src[src] = qr_by_src.get(src, 0) + 1
    channels = []
    for src in set(visits_by_src) | set(chats_by_src) | set(qr_by_src):
        v = visits_by_src.get(src, 0)
        c = chats_by_src.get(src, 0)
        q = qr_by_src.get(src, 0)
        channels.append({
            "source": src or "直接访问",
            "visits": v,
            "chats": c,
            "qr": q,
            "chat_rate": round(c / v * 100) if v else None,
            "qr_rate": round(q / c * 100) if c else None,
            "full_rate": round(q / v * 100) if v else None,
        })
    channels.sort(key=lambda x: (-x["visits"], -x["chats"]))
    return {"channels": channels, "days": days}


@api_router.get("/admin/stats/visits")
async def stats_visits(date: str, _: str = Depends(require_admin)):
    visits = await db.visits.find({"date": date}, {"_id": 0, "ua": 0}).sort("created_at", -1).to_list(300)
    return {"visits": visits}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
