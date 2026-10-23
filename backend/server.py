import os
import io
import re
import uuid
import mimetypes
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, time, date
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, model_validator, field_validator
from PIL import Image
from zoneinfo import ZoneInfo
import asyncio
import logging
import requests
from site_copy import SiteCopy

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
# 自托管（宝塔/ECS）模式：LOCAL_STORAGE=1 时文件存本地磁盘 UPLOAD_DIR，不依赖 Emergent 对象存储
LOCAL_STORAGE = os.environ.get("LOCAL_STORAGE", "") == "1"
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", str(ROOT_DIR / "uploads")))


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
    if LOCAL_STORAGE:
        dest = UPLOAD_DIR / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return {"path": path, "size": len(data)}
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
    if LOCAL_STORAGE:
        dest = UPLOAD_DIR / path
        if not dest.is_file():
            raise HTTPException(status_code=404, detail="文件不存在")
        return dest.read_bytes(), mimetypes.guess_type(dest.name)[0] or "application/octet-stream"
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
    tutorial_link: str = Field(default="", max_length=300)  # 项目教程链接（站内 /tutorials/slug 或外链）


class PublishUpdate(BaseModel):
    published: bool


class FeaturedUpdate(BaseModel):
    featured: bool


class ContactInfo(BaseModel):
    hotline: str = Field(default="", max_length=40)
    wechat: str = Field(default="", max_length=40)
    hours: str = "9:00 - 21:00"
    email: str = "contact@heying.com"
    mp_qr_image: str = ""  # 官方微信服务号二维码
    mp_name: str = Field(default="官方微信服务号", max_length=40)


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
    {"text": "你们有什么项目？", "answer": "平台每月发布安全稳定的优质项目，涵盖绿色能源、科技创新、商业渠道、实体产业等类别。您可以到「项目中心」查看在架项目详情，或点击上方「加入海鸥官方群」按钮进群获取最新项目清单。"},
    {"text": "怎么合作？", "answer": "合作方式有团长合作、项目方合作、资源方合作。请点击上方「加入海鸥官方群」按钮按教程进群，或留下您的姓名和电话，人工客服会尽快与您一对一对接。"},
    {"text": "合作模式是怎样的？", "answer": "平台采用团队协作激励机制，多劳多得——团队规模越大、运营越用心，可获得的协作激励层级越高（基础 / 进阶 / 合伙）。平台不设任何收益承诺，具体权益以正式合作协议为准，欢迎点击上方「加入海鸥官方群」按钮进群详细了解。"},
    {"text": "怎么联系客服？", "answer": "您可以直接在本窗口留言（请留下姓名和电话），人工客服会在工作时间 9:00-21:00 内尽快回复；也可以点击上方「加入海鸥官方群」按钮进群咨询。"},
]


class QuestionCard(BaseModel):
    text: str = Field(min_length=1, max_length=50)
    image: str = ""
    answer: str = ""
    link: str = Field(default="", max_length=300)


class StepButton(BaseModel):
    label: str = Field(default="", max_length=40)
    link: str = Field(default="", max_length=500)


class TutorialStep(BaseModel):
    title: str = Field(default="", max_length=80)
    text: str = Field(default="", max_length=3000)
    image: str = ""
    video_url: str = Field(default="", max_length=500)
    copy_label: str = Field(default="", max_length=40)  # 可复制信息的名称，如「官方群 ID」
    copy_text: str = Field(default="", max_length=200)   # 可复制的内容，如群 ID
    buttons: List[StepButton] = Field(default_factory=list)
    # 兼容旧字段：单个按钮
    button_label: str = Field(default="", max_length=40)
    button_link: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def _merge_legacy_button(self):
        if self.button_link and not any(b.link == self.button_link for b in self.buttons):
            self.buttons.insert(0, StepButton(label=self.button_label, link=self.button_link))
        self.button_label = ""
        self.button_link = ""
        return self


class TutorialInput(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=60, pattern=r"^[a-z0-9-]+$")
    summary: str = Field(default="", max_length=300)
    cover: str = ""
    video_url: str = Field(default="", max_length=500)
    steps: List[TutorialStep] = Field(default_factory=list)
    cta_label: str = Field(default="", max_length=40)
    cta_link: str = Field(default="", max_length=500)
    back_label: str = Field(default="返回首页", max_length=40)
    back_link: str = Field(default="/", max_length=300)


class QrCodeItem(BaseModel):
    image: str = ""
    label: str = ""
    group_id: str = Field(default="", max_length=60)  # 海鸥群 ID，供搜索加群
    uploaded_at: str = ""
    active: bool = True


class ChatConfig(BaseModel):
    welcome: str = "您好，欢迎来到合赢项目社！最新优质项目与合作资料都会第一时间在海鸥官方群内发布，点击下方按钮加入官方群抢先获取；有任何问题也可直接留言，客服会尽快回复您。"
    welcome_tutorial_label: str = Field(default="查看最新项目", max_length=40)
    welcome_tutorial_link: str = Field(default="/tutorials/gift-card", max_length=300)
    welcome_group_label: str = Field(default="立即加入项目交流群", max_length=40)
    welcome_group_link: str = Field(default="/tutorials/join-group", max_length=300)
    ai_enabled: bool = True
    cs_url: str = Field(default="", max_length=300)  # 推广页/工具页「第三方客服链接」，留空则不显示该客服按钮
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
# 访问统计只记录中国 IP（含港澳台）；本地 / 查询失败的记录保留，避免 ip-api 不可用时丢数据
CHINA_COUNTRIES = {"中国", "香港", "澳门", "台湾", "中华人民共和国"}
REGION_KEEP_PREFIXES = tuple(CHINA_COUNTRIES) + ("本地访问", "未知地区")


def lookup_region(ip: str) -> str:
    """返回地区文本（国家 省 市）。本地 IP → 本地访问；查询失败 → 未知地区。"""
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


def is_china_region(region: str) -> bool:
    return region.startswith(REGION_KEEP_PREFIXES)


class TrackInput(BaseModel):
    path: str = Field(min_length=1, max_length=200)
    source: str = Field(default="", max_length=50)


class PromoHitInput(BaseModel):
    type: str = Field(pattern=r"^(view|click)$")
    target: str = Field(default="", max_length=40)
    source: str = Field(default="", max_length=50)
    referrer: str = Field(default="", max_length=300)
    visitor_id: str = Field(default="", max_length=64)


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


# ---- 推文 IP 统计：爬虫识别 + 带数据中心/代理标记的地理查询 ----
BOT_UA_KEYWORDS = (
    "bot", "spider", "crawl", "slurp", "crawler", "scrapy", "python-requests",
    "curl", "wget", "headless", "phantomjs", "facebookexternalhit", "bingpreview",
    "baiduspider", "yisouspider", "sogou", "360spider", "bytespider", "petalbot",
    "ahrefs", "semrush", "mj12bot", "dotbot", "applebot", "googlebot", "yandex",
    "duckduckbot", "embedly", "preview", "monitor", "uptimerobot", "go-http-client",
)


def is_bot_ua(ua: str) -> bool:
    u = (ua or "").lower()
    if not u:
        return True  # 无 UA 视为爬虫/非正常访问
    return any(k in u for k in BOT_UA_KEYWORDS)


_geo_full_cache = {}


def lookup_geo_full(ip: str) -> dict:
    """返回 {region, hosting, proxy}。用于推文统计的爬虫/数据中心识别。"""
    if ip in _geo_full_cache:
        return _geo_full_cache[ip]
    if ip.startswith(("10.", "192.168.", "127.", "172.")) or ip in ("::1", "localhost", "unknown", ""):
        res = {"region": "本地访问", "hosting": False, "proxy": False}
        _geo_full_cache[ip] = res
        return res
    try:
        resp = requests.get(
            f"http://ip-api.com/json/{ip}?lang=zh-CN&fields=status,country,regionName,city,proxy,hosting",
            timeout=5,
        )
        d = resp.json()
        if d.get("status") == "success":
            region = " ".join(x for x in [d.get("country"), d.get("regionName"), d.get("city")] if x)
            res = {"region": region or "未知地区", "hosting": bool(d.get("hosting")), "proxy": bool(d.get("proxy"))}
        else:
            res = {"region": "未知地区", "hosting": False, "proxy": False}
    except Exception:
        res = {"region": "未知地区", "hosting": False, "proxy": False}
    _geo_full_cache[ip] = res
    return res


def referrer_host(referrer: str) -> str:
    """从完整 referrer URL 中解析出域名（去掉协议/路径）。"""
    r = (referrer or "").strip()
    if not r:
        return ""
    try:
        from urllib.parse import urlparse
        host = urlparse(r).netloc or r
        return host.split(":")[0][:120]
    except Exception:
        return r[:120]


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
        "description": "礼品卡项目，项目合规，平台全程对接支持，团队长带队协作共进。",
        "highlights": ["项目合规", "平台全程对接", "灵活参与", "团队长直招"],
        "image": "/images/projects/project-giftcard.webp",
        "featured": True,
    },
    {
        "title": "绿源光伏社区电站",
        "category": "绿色能源",
        "status": "对接中",
        "investment": "50-200万",
        "region": "华东大区",
        "description": "分布式光伏电站社区共建项目，与国家电网并网合作，合规运营，适合长期参与。",
        "highlights": ["并网合作模式", "长期运营项目", "专业运维团队"],
        "image": "/images/projects/project-1.webp",
    },
    {
        "title": "智链AI数据服务平台",
        "category": "科技创新",
        "status": "资金筹备",
        "investment": "100-500万",
        "region": "深圳",
        "description": "面向中小企业的AI数据标注与模型训练服务平台，已签约多家头部客户。",
        "highlights": ["头部客户背书", "技术团队成熟", "经营稳健"],
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
    if LOCAL_STORAGE:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    else:
        try:
            await asyncio.to_thread(init_storage)
        except Exception as e:
            print(f"Storage init failed: {e}")
    await db.users.create_index("username", unique=True)
    await db.visits.create_index([("date", 1), ("ip", 1)], unique=False)
    await db.promo_hits.create_index([("slug", 1), ("date", 1), ("type", 1)], unique=False)
    await db.promo_hits.create_index([("slug", 1), ("ip", 1), ("date", 1)], unique=False)
    await db.cs_agents.create_index("username", unique=True)
    await db.cs_sessions.create_index([("agent_id", 1), ("last_message_at", -1)], unique=False)
    await db.cs_messages.create_index([("session_id", 1), ("created_at", 1)], unique=False)
    # 客服聊天数据 3 天后自动清除（MongoDB TTL，按最后活动时间）
    await db.cs_messages.create_index("created_at_dt", expireAfterSeconds=259200)
    await db.cs_sessions.create_index("last_activity_dt", expireAfterSeconds=259200)
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

    if await db.tutorials.count_documents({}) == 0:
        await db.tutorials.insert_one({
            "id": str(uuid.uuid4()),
            **GIFT_CARD_TUTORIAL_SEED,
            "published": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    if not await db.tutorials.find_one({"slug": "join-group"}):
        await db.tutorials.insert_one({
            "id": str(uuid.uuid4()),
            **JOIN_GROUP_TUTORIAL_SEED,
            "published": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

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

    # 一次性文案升级：把存量的旧默认进群按钮文案升级为新文案（用户自定义过的其它文案保留不动）
    await db.settings.update_one(
        {"key": "site", "chat.welcome_group_label": {"$in": ["加入海鸥官方群", "立即加入官方群 · 抢先获取一手项目"]}},
        {"$set": {"chat.welcome_group_label": "立即加入项目交流群"}},
    )

    # 一次性清理：加入海鸥官方群教程的「下载 / 注册」等非二维码步骤不需要图片，清空其 image（用 migrations 标记，仅执行一次，之后用户可自由再配图）
    try:
        if not await db.migrations.find_one({"key": "join_group_clear_step_images"}):
            tut = await db.tutorials.find_one({"slug": "join-group"})
            if tut:
                steps = tut.get("steps") or []
                changed = False
                for s in steps:
                    if not isinstance(s, dict):
                        continue
                    is_qr_step = "二维码" in (s.get("text") or "") or "群 ID" in (s.get("copy_label") or "") or "群ID" in (s.get("copy_label") or "")
                    if not is_qr_step and s.get("image"):
                        s["image"] = ""
                        changed = True
                if changed:
                    await db.tutorials.update_one({"slug": "join-group"}, {"$set": {"steps": steps}})
            await db.migrations.insert_one({"key": "join_group_clear_step_images", "at": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        print(f"[migration] join_group_clear_step_images failed (skipped): {e}")

    # 合规整改（一次性）：去除公开数据中的「月入X万 / 高收益 / 稳定收益」等表述，改为团队协作激励口径，避免微信外链内容风控拦截
    try:
        if not await db.migrations.find_one({"key": "income_compliance_v1"}):
            site = await db.settings.find_one({"key": "site"}, {"_id": 0, "tiers": 1, "chat": 1})
            if site:
                tiers = site.get("tiers") or []
                if any(isinstance(t, dict) and "万" in str(t.get("income", "")) for t in tiers):
                    await db.settings.update_one({"key": "site"}, {"$set": {"tiers": [
                        {"count": "10人团队", "income": "基础激励", "featured": False},
                        {"count": "20人团队", "income": "进阶激励", "featured": True},
                        {"count": "50人团队", "income": "合伙激励", "featured": False},
                    ]}})
                questions = (site.get("chat") or {}).get("questions") or []
                changed_q = False
                for q in questions:
                    if isinstance(q, dict) and any(k in (q.get("answer") or "") for k in ("月收入", "月入", "10万", "20万", "50万")):
                        q["text"] = "合作模式是怎样的？"
                        q["answer"] = "平台采用团队协作激励机制，多劳多得——团队规模越大、运营越用心，可获得的协作激励层级越高（基础 / 进阶 / 合伙）。平台不设任何收益承诺，具体权益以正式合作协议为准，欢迎进群详细了解。"
                        changed_q = True
                if changed_q:
                    await db.settings.update_one({"key": "site"}, {"$set": {"chat.questions": questions}})
            repl = {
                "收益稳定": "合规运营", "稳定收益": "合规运营", "共享收益": "协作共进",
                "20年长期回报": "长期运营项目", "并网收益保障": "并网合作模式",
                "现金流稳定": "经营稳健", "持续收益": "协作成长", "高收益": "多劳多得",
            }
            projects_all = await db.projects.find({}).to_list(length=None)
            for p in projects_all:
                desc = p.get("description") or ""
                hls = p.get("highlights") or []
                new_desc = desc
                for a, b in repl.items():
                    new_desc = new_desc.replace(a, b)
                new_hls = [h for h in hls]
                for idx, h in enumerate(new_hls):
                    if isinstance(h, str):
                        for a, b in repl.items():
                            new_hls[idx] = new_hls[idx].replace(a, b)
                if new_desc != desc or new_hls != hls:
                    await db.projects.update_one({"id": p.get("id")}, {"$set": {"description": new_desc, "highlights": new_hls}})
            await db.migrations.insert_one({"key": "income_compliance_v1", "at": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        print(f"[migration] income_compliance_v1 failed (skipped): {e}")

    # 一次性清理：访问统计只保留中国 IP（含港澳台）、本地访问与未知地区，删除历史海外访问记录
    try:
        if not await db.migrations.find_one({"key": "visits_china_only_v1"}):
            keep = "|".join(REGION_KEEP_PREFIXES)
            res = await db.visits.delete_many({"region": {"$not": {"$regex": f"^({keep})"}}})
            print(f"[migration] visits_china_only_v1: removed {res.deleted_count} overseas visits")
            await db.migrations.insert_one({"key": "visits_china_only_v1", "at": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        print(f"[migration] visits_china_only_v1 failed (skipped): {e}")

    # 一次性清理：去掉早期写死的占位电话/微信号（现改为后台填写，留空则前台不显示）
    await db.settings.update_one({"key": "site", "contact.hotline": "400-888-6888"}, {"$set": {"contact.hotline": ""}})
    await db.settings.update_one({"key": "site", "contact.wechat": "heyingkefu"}, {"$set": {"contact.wechat": ""}})


@api_router.get("/")
async def root():
    return {"message": "合赢项目社 API"}


@api_router.get("/projects")
async def list_projects(category: Optional[str] = None):
    query = {"published": {"$ne": False}}
    if category and category != "全部":
        query["category"] = category
    projects = await db.projects.find(query, {"_id": 0}).sort([("featured", -1), ("created_at", 1)]).to_list(100)
    hot_ids, _ = await hot_project_ids()
    for p in projects:
        p["hot"] = is_hot(p, hot_ids)
    return {"projects": projects}


def is_hot(p: dict, auto_hot_ids: set) -> bool:
    """hot_mode: auto（默认，按近 7 天进群点击自动）/ on（常驻热门）/ off（不显示）。"""
    mode = p.get("hot_mode") or "auto"
    return mode == "on" or (mode == "auto" and p["id"] in auto_hot_ids)


async def hot_project_ids(days: int = 7, top_n: int = 3):
    """近 N 天「加入官方交流群」点击最多的前 top_n 个项目（至少 1 次点击）→ 前台自动标「热门」。返回 (热门 id 集合, {id: 点击数})。"""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = await db.project_events.aggregate([
        {"$match": {"type": "group", "created_at": {"$gte": since}}},
        {"$group": {"_id": "$project_id", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
    ]).to_list(1000)
    counts = {r["_id"]: r["n"] for r in rows}
    return {r["_id"] for r in rows[:top_n]}, counts


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
        return {"contact": ContactInfo().model_dump(), "team": [], "chat": ChatConfig().model_dump(), "copy": SiteCopy().model_dump()}
    doc["copy"] = SiteCopy(**(doc.get("copy") or {})).model_dump()
    doc.setdefault("chat", ChatConfig().model_dump())
    doc["chat"].setdefault("ai_enabled", True)
    for k in ("welcome_tutorial_label", "welcome_tutorial_link", "welcome_group_label", "welcome_group_link"):
        doc["chat"].setdefault(k, ChatConfig.model_fields[k].default)
    if "questions" not in doc["chat"]:
        doc["chat"]["questions"] = ChatConfig().model_dump()["questions"]
    else:
        doc["chat"]["questions"] = [
            {"text": q, "image": "", "answer": "", "link": ""} if isinstance(q, str) else {"text": q.get("text", ""), "image": q.get("image", ""), "answer": q.get("answer", ""), "link": q.get("link", "")}
            for q in doc["chat"]["questions"]
        ]
    doc["chat"] = sync_active_qr(migrate_qr_codes(doc["chat"]))
    return doc


GIFT_CARD_TUTORIAL_SEED = {
    "title": "礼品卡项目教程",
    "slug": "gift-card",
    "summary": "从开通账号到首单成交，图文 + 视频手把手带你跑通礼品卡项目全流程。",
    "cover": "",
    "video_url": "",
    "cta_label": "",
    "cta_link": "",
    "back_label": "返回首页",
    "back_link": "/",
    "steps": [
        {"title": "第一步：了解项目模式", "text": "礼品卡项目通过正规渠道获取品牌礼品卡货源，由团队长组织成员进行分销与回收，赚取差价与渠道返点。项目合法合规、门槛低、回款周期短，适合 10 人以上团队起步。", "image": ""},
        {"title": "第二步：开通账号与认证", "text": "扫描客服发送的海鸥官方群二维码进群后，由专属对接人协助完成平台账号注册与实名认证，一般 1 个工作日内完成审核。", "image": ""},
        {"title": "第三步：选品与下单", "text": "在平台「项目中心」查看当前在架的礼品卡品类与折扣，根据团队资源选择 2-3 个主推品类，小批量首单测试。", "image": ""},
        {"title": "第四步：分销与回款", "text": "通过团队渠道完成分销，平台 T+1 结算；团队长可在后台实时查看成员业绩与返点明细。", "image": ""},
        {"title": "常见问题", "text": "Q：需要押金或加盟费吗？\nA：不需要，平台不收取任何加盟费、服务费。\n\nQ：没有经验能做吗？\nA：可以，进群后有专人一对一带教，并提供话术与素材包。", "image": ""},
    ],
}


JOIN_GROUP_TUTORIAL_SEED = {
    "title": "加入海鸥官方群教程",
    "slug": "join-group",
    "summary": "三步加入海鸥官方群，最新项目与合作资料第一时间群内同步。",
    "cover": "",
    "video_url": "",
    "cta_label": "",
    "cta_link": "",
    "back_label": "返回首页",
    "back_link": "/",
    "steps": [
        {
            "title": "第一步：下载海鸥 App",
            "text": "海鸥官方群需在海鸥 App 内加入。请先点击下方按钮下载并安装海鸥 App（iOS / 安卓均支持）。",
            "image": "",
            "video_url": "",
            "copy_label": "",
            "copy_text": "",
            "buttons": [{"label": "下载海鸥 App", "link": "https://www.haiou.com/download"}],
        },
        {
            "title": "第二步：注册并登录",
            "text": "打开海鸥 App，使用手机号注册并登录账号，完成后即可加入群聊。",
            "image": "",
            "video_url": "",
            "copy_label": "",
            "copy_text": "",
            "buttons": [],
        },
        {
            "title": "第三步：扫码或搜索群 ID 进群",
            "text": "方式一：长按保存下方群二维码，在海鸥 App「扫一扫 → 相册」识别进群。\n方式二：复制下方官方群 ID，在海鸥 App 搜索群 ID 加入。",
            "image": "",
            "video_url": "",
            "copy_label": "官方群 ID",
            "copy_text": "",
            "buttons": [],
        },
    ],
}


@api_router.get("/tutorials")
async def list_tutorials():
    docs = await db.tutorials.find({"published": {"$ne": False}}, {"_id": 0, "steps": 0}).sort("created_at", -1).to_list(50)
    return {"tutorials": docs}


class TutorialEventInput(BaseModel):
    type: str = Field(pattern=r"^(view|cta)$")
    visitor_id: str = Field(min_length=4, max_length=64)


class ProjectEventInput(BaseModel):
    type: str = Field(pattern=r"^(open|group)$")
    visitor_id: str = Field(min_length=4, max_length=64)


@api_router.post("/projects/{project_id}/events", status_code=201)
async def project_event(project_id: str, data: ProjectEventInput):
    """项目卡片弹窗埋点：open = 打开弹窗，group = 点击「加入官方交流群」。"""
    await db.project_events.insert_one({
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "type": data.type,
        "visitor_id": data.visitor_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@api_router.post("/tutorials/{slug}/events", status_code=201)
async def tutorial_event(slug: str, data: TutorialEventInput):
    """教程页浏览 / 跳转按钮点击埋点。同一访客 30 秒内重复浏览同一教程只记一次（防刷新/重复触发）。"""
    if data.type == "view":
        since = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
        dup = await db.tutorial_events.find_one(
            {"slug": slug, "type": "view", "visitor_id": data.visitor_id, "created_at": {"$gte": since}}, {"_id": 1}
        )
        if dup:
            return {"ok": True, "deduped": True}
    await db.tutorial_events.insert_one({
        "id": str(uuid.uuid4()),
        "slug": slug,
        "type": data.type,
        "visitor_id": data.visitor_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@api_router.get("/tutorials/{slug}")
async def get_tutorial(slug: str):
    doc = await db.tutorials.find_one({"slug": slug, "published": {"$ne": False}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="教程不存在或已下架")
    # 「加入海鸥官方群教程」：自动把客服设置里的群二维码填到讲二维码的那一步（后台换码即同步，无需手动维护）
    if slug == "join-group":
        settings = await db.settings.find_one({"key": "site"}, {"_id": 0, "chat": 1})
        chat_cfg = sync_active_qr(migrate_qr_codes(dict((settings or {}).get("chat") or {})))
        active_codes = [
            {"image": q.get("image", ""), "label": q.get("label", ""), "group_id": q.get("group_id", "")}
            for q in (chat_cfg.get("qr_codes") or []) if q.get("active") and q.get("image")
        ]
        if active_codes:
            steps = doc.get("steps") or []
            # 二维码只注入到真正讲二维码/群 ID 的那一步；若未找到则不注入（绝不回退到第一步，避免误把二维码塞进下载/注册步骤）
            target = next(
                (s for s in steps if isinstance(s, dict)
                 and ("二维码" in (s.get("text") or "") or "群 ID" in (s.get("copy_label") or "") or "群ID" in (s.get("copy_label") or ""))),
                None,
            )
            if target is not None:
                target["qr_codes"] = active_codes
                # 多码卡片已包含二维码与群 ID，避免再把同一张码当作步骤大图重复展示
                if target.get("image") in {q["image"] for q in active_codes}:
                    target["image"] = ""
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


SITE_URL = os.environ.get("SITE_URL", "https://eztyv.com").rstrip("/")


@api_router.get("/sitemap.xml")
async def sitemap_xml():
    """动态站点地图：静态页面 + 已发布新闻 + 已发布教程。生产 nginx 将 /sitemap.xml 代理到这里。"""
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat()
    urls = [
        ("/", today, "weekly", "1.0"),
        ("/projects", today, "weekly", "0.9"),
        ("/cooperation", today, "monthly", "0.9"),
        ("/news", today, "weekly", "0.8"),
        ("/about", today, "monthly", "0.6"),
        ("/contact", today, "monthly", "0.6"),
    ]
    articles = await db.articles.find({"published": {"$ne": False}}, {"_id": 0, "id": 1, "created_at": 1}).to_list(500)
    for a in articles:
        urls.append((f"/news/{a['id']}", str(a.get("created_at", today))[:10], "monthly", "0.7"))
    tutorials = await db.tutorials.find({"published": {"$ne": False}}, {"_id": 0, "slug": 1, "created_at": 1}).to_list(100)
    for t in tutorials:
        urls.append((f"/tutorials/{t['slug']}", str(t.get("created_at", today))[:10], "monthly", "0.7"))
    body = "".join(
        f"<url><loc>{SITE_URL}{path}</loc><lastmod>{mod}</lastmod><changefreq>{freq}</changefreq><priority>{pri}</priority></url>"
        for path, mod, freq, pri in urls
    )
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'
    return Response(content=xml, media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})


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
        # 新会话：欢迎语 + 两个按钮（查看教程 / 加入海鸥官方群）
        welcome = (chat_cfg.get("welcome") or "").strip() or "您好，欢迎来到合赢项目社！"
        defaults = ChatConfig().model_dump()
        group_link = chat_cfg.get("welcome_group_link", defaults["welcome_group_link"])
        actions = []
        # 仅保留「加入海鸥官方群」按钮；优先跳转进群教程页（可在后台配置），未配置时回退为直接推送群二维码
        if group_link:
            actions.append({"type": "group-link", "label": chat_cfg.get("welcome_group_label") or defaults["welcome_group_label"], "link": group_link})
        elif chat_cfg.get("qr_image"):
            actions.append({"type": "qr", "label": chat_cfg.get("welcome_group_label") or defaults["welcome_group_label"]})
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.chat_messages.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": data.session_id,
            "sender": "admin",
            "via": "auto",
            "text": welcome,
            "image": "",
            "actions": actions,
            "created_at": now_iso,
        })
        await db.chat_sessions.update_one(
            {"id": data.session_id},
            {"$set": {"last_message_at": now_iso, "last_message": welcome[:50]}},
        )
    return {"session_id": data.session_id, "welcome": chat_cfg.get("welcome", "")}


@api_router.post("/chat/{session_id}/join-group", status_code=201)
async def chat_join_group(session_id: str):
    """访客点击「加入海鸥官方群」按钮：记录点击并推送当前群二维码。"""
    if not await db.chat_sessions.find_one({"id": session_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="会话不存在")
    settings = await db.settings.find_one({"key": "site"}, {"_id": 0, "chat": 1})
    chat_cfg = sync_active_qr(migrate_qr_codes(dict((settings or {}).get("chat") or {})))
    qr_image = chat_cfg.get("qr_image", "")
    if not qr_image:
        raise HTTPException(status_code=404, detail="暂未配置海鸥官方群二维码")
    now_iso = datetime.now(timezone.utc).isoformat()
    label = chat_cfg.get("welcome_group_label") or "加入海鸥官方群"
    qr_label = next((q.get("label", "") for q in (chat_cfg.get("qr_codes") or []) if q.get("image") == qr_image), "")
    await db.chat_messages.insert_many([
        {"id": str(uuid.uuid4()), "session_id": session_id, "sender": "visitor", "text": label, "image": "", "created_at": now_iso},
        {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "sender": "admin",
            "via": "auto",
            "text": "欢迎加入合赢项目社！请保存下方二维码，打开海鸥 App 扫一扫加入官方群，最新项目与合作信息第一时间在群内分享。",
            "image": qr_image,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ])
    await db.qr_pushes.insert_one({"id": str(uuid.uuid4()), "session_id": session_id, "image": qr_image, "label": qr_label, "created_at": now_iso})
    await db.question_clicks.insert_one({"id": str(uuid.uuid4()), "question": label, "kind": "welcome_action", "session_id": session_id, "created_at": now_iso})
    await db.chat_sessions.update_one({"id": session_id}, {"$set": {"last_message_at": now_iso, "last_message": "[海鸥官方群二维码]"}})
    return {"ok": True}


class ActionClickInput(BaseModel):
    label: str = Field(min_length=1, max_length=40)
    link: str = Field(default="", max_length=300)


@api_router.post("/chat/{session_id}/action-click", status_code=201)
async def chat_action_click(session_id: str, data: ActionClickInput):
    """记录访客点击欢迎语下方按钮（如「查看最新项目」）。"""
    await db.question_clicks.insert_one({
        "id": str(uuid.uuid4()),
        "question": data.label.strip(),
        "kind": "welcome_action",
        "link": data.link,
        "session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@api_router.post("/chat/{session_id}/end")
async def chat_end(session_id: str):
    """访客关闭客服超过 2 分钟后前端自动结束会话；标记后管理端显示「已结束」。"""
    await db.chat_sessions.update_one({"id": session_id}, {"$set": {"ended_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


@api_router.get("/chat/{session_id}/messages")
async def chat_messages(session_id: str):
    messages = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"messages": messages}


AI_FALLBACK_TEXT = "已收到您的留言！人工客服会尽快回复（工作时间 9:00-21:00）。为方便联系您，请留下姓名和电话；也可以点击欢迎语下方「加入海鸥官方群」按钮查看进群教程，最新项目群内第一时间分享。"


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


async def _ai_complete(system: str, user_text: str, session_id: str) -> str:
    """AI 供应商切换：配置了 AI_API_KEY 时走 OpenAI 兼容接口（DeepSeek/通义千问等，自托管用），否则走 Emergent 通用密钥。"""
    ai_key = os.environ.get("AI_API_KEY", "").strip()
    if ai_key:
        from openai import AsyncOpenAI

        client_ai = AsyncOpenAI(api_key=ai_key, base_url=os.environ.get("AI_BASE_URL", "https://api.deepseek.com").strip() or None)
        resp = await client_ai.chat.completions.create(
            model=os.environ.get("AI_MODEL", "deepseek-chat").strip() or "deepseek-chat",
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user_text}],
            max_tokens=300,
            temperature=0.5,
        )
        return (resp.choices[0].message.content or "").strip()

    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"kefu-{session_id}-{uuid.uuid4()}",
        system_message=system,
    ).with_model("openai", "gpt-5.4-mini")
    reply = ""
    async for event in chat.stream_message(UserMessage(text=user_text)):
        if isinstance(event, TextDelta):
            reply += event.content
        elif isinstance(event, StreamDone):
            break
    return reply.strip()


async def generate_ai_reply(session_id: str, chat_cfg: dict):
    """访客自由留言未命中规则时，由 AI 生成回复（Emergent 通用密钥 GPT-5.4-mini，或自托管 OpenAI 兼容模型）。"""
    try:
        history = await db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", -1).to_list(12)
        history.reverse()
        transcript = "\n".join(f"{'访客' if m['sender'] == 'visitor' else '客服'}: {m['text']}" for m in history if m.get("text"))

        projects = await db.projects.find({"published": {"$ne": False}}, {"_id": 0, "id": 0, "created_at": 0, "published": 0}).to_list(50)
        kb = "\n".join(
            f"· {p['title']}（{p['category']}｜{p.get('region', '')}｜{p.get('status', '')}）：{p.get('description', '')}"
            + (f" 亮点：{'、'.join(p.get('highlights', []))}" if p.get("highlights") else "")
            for p in projects
        )
        faq = "\n".join(
            f"Q：{q.get('text')}\nA：{q.get('answer')}" for q in (chat_cfg.get("questions") or []) if isinstance(q, dict) and q.get("answer")
        )
        tutorials = await db.tutorials.find({"published": {"$ne": False}}, {"_id": 0, "title": 1, "slug": 1, "summary": 1, "steps": 1}).to_list(20)
        tutorial_kb = "\n".join(
            f"【{t['title']}】（教程页 /tutorials/{t['slug']}）{t.get('summary', '')}\n"
            + "\n".join(f"- {st.get('title', '')}：{(st.get('text') or '')[:300]}" for st in (t.get("steps") or []))
            for t in tutorials
        )
        system = (
            "你是「合赢项目社」的在线客服助手。平台主要面向全国招募团队长（团长），为团队长提供稳定项目；"
            "团队通过专业的项目审核、项目评估、项目整合，保障项目稳定可靠；平台每个月都会发布安全、稳定、合法的项目供团队长合作，"
            "并在海鸥官方群内同步分享最新项目；平台不收取任何加盟费、服务费等费用。"
            "平台采用团队协作激励机制，团队规模越大、运营越用心，可获得的协作激励层级越高（基础 / 进阶 / 合伙），多劳多得；"
            "平台不设任何收益承诺，具体权益以正式合作协议为准。"
            "合作方式：团长合作、项目方合作、资源方合作。工作时间 9:00-21:00。\n"
            f"常见问题标准答案（优先参考）：\n{faq}\n"
            f"项目教程内容（回答项目玩法、收益、返佣、注册流程等问题时以此为准）：\n{tutorial_kb}\n"
            f"平台当前在架项目（回答项目相关问题时以此为准）：\n{kb}\n"
            "回答规则：全程使用中文；语气专业热情；回答控制在80字以内；不使用 Markdown 符号；"
            "访客询问怎么合作、怎么加入、联系方式或人工客服时，引导其点击聊天中的「加入海鸥官方群」按钮查看进群教程（下载海鸥 App → 注册 → 扫码或搜索群 ID 进群），人工客服会尽快一对一对接，不要编造微信号或电话；"
            "知识库中没有的信息不要编造，引导访客留下姓名和电话，人工客服会尽快跟进。"
        )
        reply = await _ai_complete(system, f"最近对话记录：\n{transcript}\n\n请回复访客的最后一条消息。", session_id)
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
    matched_link = ""
    for q in chat_cfg.get("questions") or []:
        q_text = q if isinstance(q, str) else q.get("text", "")
        if q_text and q_text == data.text:
            matched_q = q_text
            if not isinstance(q, str):
                matched_img = q.get("image", "")
                matched_answer = q.get("answer", "")
                matched_link = q.get("link", "")
            break
    answered = False
    if matched_q:
        await db.question_clicks.insert_one({
            "id": str(uuid.uuid4()),
            "question": matched_q,
            "session_id": session_id,
            "created_at": now,
        })
        if matched_answer or matched_img or matched_link:
            card_now = datetime.now(timezone.utc).isoformat()
            await db.chat_messages.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "sender": "admin",
                "via": "auto",
                "text": matched_answer or ("点击下方按钮查看图文视频教程：" if matched_link else "这是相关介绍图，供您参考："),
                "image": matched_img,
                "link": matched_link,
                "created_at": card_now,
            })
            await db.chat_sessions.update_one(
                {"id": session_id},
                {"$set": {"last_message_at": card_now, "last_message": (matched_answer or "[介绍图片]")[:50]}},
            )
            answered = True
    # 自由留言（非卡片点击）且 AI 开启：由 AI 作答；进群规则负责补发「加入海鸥官方群」按钮（未配教程链接时回退为二维码）
    use_ai = bool(chat_cfg.get("ai_enabled", True)) and not matched_q
    group_link = chat_cfg.get("welcome_group_link", "")
    group_label = chat_cfg.get("welcome_group_label") or "加入海鸥官方群"
    if (group_link or qr_image) and any(k in data.text for k in QR_KEYWORDS):
        recent_msgs = await db.chat_messages.find(
            {"session_id": session_id}, {"_id": 0, "sender": 1, "image": 1, "actions": 1}
        ).sort("created_at", -1).to_list(5)
        qr_sent_recently = any(
            m.get("sender") == "admin" and ((qr_image and m.get("image") == qr_image) or any(a.get("type") == "group-link" for a in (m.get("actions") or [])))
            for m in recent_msgs
        )
        qr_now = datetime.now(timezone.utc).isoformat()
        if qr_sent_recently and use_ai:
            pass  # AI 会在回复中引导点击上方按钮，不再重复发提醒
        elif qr_sent_recently:
            # 刚推送过，仅文字提醒，避免刷屏
            await db.chat_messages.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "sender": "admin",
                "via": "auto",
                "text": "「加入海鸥官方群」按钮就在上方聊天记录里，点击即可查看进群教程；需要人工服务请留下姓名和电话，客服会尽快与您对接。" if group_link else "海鸥官方群二维码就在上方聊天记录里，保存后打开海鸥 App 扫一扫即可进群；需要人工服务请留下姓名和电话，客服会尽快与您对接。",
                "image": "",
                "created_at": qr_now,
            })
        elif group_link:
            await db.chat_messages.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "sender": "admin",
                "via": "auto",
                "text": "欢迎加入合赢项目社！点击下方按钮查看进群教程，加入海鸥官方群后，最新项目与合作信息第一时间在群内分享，客服也会尽快与您一对一对接。",
                "image": "",
                "actions": [{"type": "group-link", "label": group_label, "link": group_link}],
                "created_at": qr_now,
            })
        else:
            await db.chat_messages.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "sender": "admin",
                "via": "auto",
                "text": "欢迎加入合赢项目社！请保存下方二维码，打开海鸥 App 扫一扫加入官方群，最新项目与合作信息第一时间在群内分享，进群后客服会尽快与您一对一对接。",
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
                {"$set": {"last_message_at": qr_now, "last_message": "[加入海鸥官方群]" if group_link else "[海鸥官方群二维码]"}},
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
    hot_ids, counts = await hot_project_ids()
    for p in projects:
        p["hot_mode"] = p.get("hot_mode") or "auto"
        p["hot"] = is_hot(p, hot_ids)
        p["hot_auto"] = p["id"] in hot_ids
        p["group_clicks_7d"] = counts.get(p["id"], 0)
    return {"projects": projects}


class HotModeUpdate(BaseModel):
    hot_mode: str = Field(pattern=r"^(auto|on|off)$")


@api_router.patch("/admin/projects/{project_id}/hot")
async def set_project_hot_mode(project_id: str, data: HotModeUpdate, _: str = Depends(require_admin)):
    result = await db.projects.update_one({"id": project_id}, {"$set": {"hot_mode": data.hot_mode}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"message": {"auto": "已切换为自动热门", "on": "已设为常驻热门", "off": "已关闭热门标签"}[data.hot_mode]}


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


@api_router.put("/admin/settings/copy")
async def update_site_copy(data: SiteCopy, _: str = Depends(require_admin)):
    await db.settings.update_one({"key": "site"}, {"$set": {"copy": data.model_dump(), "key": "site"}}, upsert=True)
    return {"ok": True, "copy": data.model_dump()}


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


async def save_image_upload(file: UploadFile) -> dict:
    """校验+转 webp+存储+登记，返回 {url, path}。供后台与客服图片上传复用。"""
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


@api_router.post("/admin/upload", status_code=201)
async def admin_upload(file: UploadFile = File(...), _: str = Depends(require_admin)):
    return await save_image_upload(file)


@api_router.get("/files/{path:path}")
async def serve_file(path: str, request: Request):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="文件不存在")
    data, content_type = await asyncio.to_thread(get_object, path)
    media_type = record.get("content_type", content_type)
    total = len(data)
    range_header = request.headers.get("range")
    if range_header and media_type.startswith("video/"):
        # iOS Safari 等播放视频必须支持 Range（206）
        try:
            start_s, end_s = range_header.replace("bytes=", "").split("-")
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else total - 1
        except ValueError:
            raise HTTPException(status_code=416, detail="Range 不合法")
        end = min(end, total - 1)
        if start > end:
            raise HTTPException(status_code=416, detail="Range 不合法")
        return Response(
            content=data[start:end + 1],
            status_code=206,
            media_type=media_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{total}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(end - start + 1),
            },
        )
    return Response(content=data, media_type=media_type, headers={"Accept-Ranges": "bytes"} if media_type.startswith("video/") else None)


ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}


@api_router.post("/admin/upload-video", status_code=201)
async def admin_upload_video(file: UploadFile = File(...), _: str = Depends(require_admin)):
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="仅支持 MP4 / WEBM / MOV 视频")
    data = await file.read()
    if len(data) > 60 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="视频大小不能超过 60MB，建议先压缩或粘贴外部视频链接")
    ext = {"video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov"}[file.content_type]
    path = f"{APP_NAME}/videos/{uuid.uuid4()}.{ext}"
    result = await asyncio.to_thread(put_object, path, data, file.content_type)
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result["size"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": f"/api/files/{result['path']}", "path": result["path"]}


@api_router.get("/admin/tutorials")
async def admin_list_tutorials(_: str = Depends(require_admin)):
    docs = await db.tutorials.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"tutorials": docs}


@api_router.post("/admin/tutorials", status_code=201)
async def create_tutorial(data: TutorialInput, _: str = Depends(require_admin)):
    if await db.tutorials.find_one({"slug": data.slug}):
        raise HTTPException(status_code=400, detail="该链接标识已被使用，请换一个")
    doc = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "published": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tutorials.insert_one(doc)
    return {"message": "教程已发布", "id": doc["id"]}


@api_router.put("/admin/tutorials/{tutorial_id}")
async def update_tutorial(tutorial_id: str, data: TutorialInput, _: str = Depends(require_admin)):
    if await db.tutorials.find_one({"slug": data.slug, "id": {"$ne": tutorial_id}}):
        raise HTTPException(status_code=400, detail="该链接标识已被使用，请换一个")
    result = await db.tutorials.update_one({"id": tutorial_id}, {"$set": data.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="教程不存在")
    return {"message": "教程已更新"}


@api_router.patch("/admin/tutorials/{tutorial_id}/publish")
async def publish_tutorial(tutorial_id: str, data: PublishUpdate, _: str = Depends(require_admin)):
    result = await db.tutorials.update_one({"id": tutorial_id}, {"$set": {"published": data.published}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="教程不存在")
    return {"message": "已上架" if data.published else "已下架"}


@api_router.delete("/admin/tutorials/{tutorial_id}")
async def delete_tutorial(tutorial_id: str, _: str = Depends(require_admin)):
    result = await db.tutorials.delete_one({"id": tutorial_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="教程不存在")
    return {"message": "教程已删除"}


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
    if not is_china_region(region):
        return {"ok": True, "skipped": "overseas"}
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


PROVINCES = [
    "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江", "安徽", "福建", "江西",
    "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃",
    "青海", "宁夏", "新疆", "台湾", "香港", "澳门",
]


def province_of(region: str) -> Optional[str]:
    """从「国家 省 市」地区文本中解析出省级短名（与前端 china.json 省名前缀一致）。"""
    parts = (region or "").split()
    if not parts:
        return None
    candidates = parts[1:2] if parts[0] in ("中国", "中华人民共和国") else parts[:1]
    for token in candidates:
        for p in PROVINCES:
            if token.startswith(p):
                return p
    return None


@api_router.get("/admin/stats/provinces")
async def stats_provinces(days: int = 30, _: str = Depends(require_admin)):
    """近 N 天各省访客分布（按独立 IP 去重），供后台中国地图热力图使用。"""
    days = max(1, min(days, 365))
    start = (datetime.now(CN_TZ) - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    rows = await db.visits.aggregate([
        {"$match": {"date": {"$gte": start}}},
        {"$group": {"_id": {"region": "$region", "ip": "$ip"}}},
        {"$group": {"_id": "$_id.region", "n": {"$sum": 1}}},
    ]).to_list(5000)
    counts: dict = {}
    unknown = 0
    for r in rows:
        p = province_of(r["_id"])
        if p:
            counts[p] = counts.get(p, 0) + r["n"]
        else:
            unknown += r["n"]
    provinces = sorted(({"name": k, "count": v} for k, v in counts.items()), key=lambda x: x["count"], reverse=True)
    return {"days": days, "provinces": provinces, "total": sum(counts.values()), "unknown": unknown}


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


@api_router.get("/admin/stats/welcome-actions")
async def stats_welcome_actions(days: int = 14, _: str = Depends(require_admin)):
    """欢迎语按钮（查看最新项目 / 加入海鸥官方群）每日点击次数与点击人数（按会话去重）。"""
    days = max(1, min(days, 90))
    today = datetime.now(CN_TZ)
    start_utc = (today - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()
    settings = await db.settings.find_one({"key": "site"}, {"_id": 0, "chat": 1})
    chat_cfg = (settings or {}).get("chat") or {}
    defaults = ChatConfig().model_dump()
    labels = [
        chat_cfg.get("welcome_tutorial_label") or defaults["welcome_tutorial_label"],
        chat_cfg.get("welcome_group_label") or defaults["welcome_group_label"],
    ]
    clicks = await db.question_clicks.find(
        {"kind": "welcome_action", "created_at": {"$gte": start_utc}},
        {"_id": 0, "question": 1, "session_id": 1, "created_at": 1},
    ).to_list(50000)
    for c in clicks:
        if c["question"] not in labels:
            labels.append(c["question"])
    by_day = {}
    sessions = {}
    for c in clicks:
        d = datetime.fromisoformat(c["created_at"]).astimezone(CN_TZ).strftime("%Y-%m-%d")
        by_day.setdefault(d, {}).setdefault(c["question"], {"clicks": 0, "sessions": set()})
        by_day[d][c["question"]]["clicks"] += 1
        by_day[d][c["question"]]["sessions"].add(c.get("session_id"))
        sessions.setdefault(c["question"], set()).add(c.get("session_id"))
    result = []
    for i in range(days):
        d = (today - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        row = {"date": d}
        for lb in labels:
            cell = by_day.get(d, {}).get(lb)
            row[lb] = {"clicks": cell["clicks"] if cell else 0, "visitors": len(cell["sessions"]) if cell else 0}
        result.append(row)
    totals = {lb: {"clicks": sum(r[lb]["clicks"] for r in result), "visitors": len(sessions.get(lb, set()))} for lb in labels}
    return {"labels": labels, "days": result, "totals": totals}


@api_router.get("/admin/stats/tutorials")
async def stats_tutorials(days: int = 14, _: str = Depends(require_admin)):
    """每个教程：浏览次数 / 浏览人数 / 跳转按钮点击次数 / 点击人数 / 转化率（近 N 天）。"""
    days = max(1, min(days, 90))
    today = datetime.now(CN_TZ)
    start_utc = (today - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()
    tutorials = await db.tutorials.find({}, {"_id": 0, "slug": 1, "title": 1, "cta_label": 1, "published": 1}).to_list(100)
    events = await db.tutorial_events.find({"created_at": {"$gte": start_utc}}, {"_id": 0, "slug": 1, "type": 1, "visitor_id": 1}).to_list(100000)
    agg = {}
    for e in events:
        a = agg.setdefault(e["slug"], {"views": 0, "view_visitors": set(), "cta": 0, "cta_visitors": set()})
        if e["type"] == "view":
            a["views"] += 1
            a["view_visitors"].add(e["visitor_id"])
        else:
            a["cta"] += 1
            a["cta_visitors"].add(e["visitor_id"])
    titles = {t["slug"]: t for t in tutorials}
    rows = []
    for slug in list(titles) + [s for s in agg if s not in titles]:
        a = agg.get(slug, {"views": 0, "view_visitors": set(), "cta": 0, "cta_visitors": set()})
        vv = len(a["view_visitors"])
        cv = len(a["cta_visitors"])
        t = titles.get(slug, {})
        rows.append({
            "slug": slug,
            "title": t.get("title", slug),
            "cta_label": t.get("cta_label", ""),
            "published": t.get("published", True),
            "views": a["views"],
            "view_visitors": vv,
            "cta_clicks": a["cta"],
            "cta_visitors": cv,
            "cta_rate": round(cv / vv * 100, 1) if vv else 0,
        })
    rows.sort(key=lambda r: r["views"], reverse=True)
    return {"days": days, "tutorials": rows}


@api_router.get("/admin/stats/projects")
async def stats_projects(days: int = 14, _: str = Depends(require_admin)):
    """每个项目：弹窗打开次数 / 人数、「加入官方交流群」点击次数 / 人数、转化率（近 N 天）。"""
    days = max(1, min(days, 90))
    today = datetime.now(CN_TZ)
    start_utc = (today - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()
    projects = await db.projects.find({}, {"_id": 0, "id": 1, "title": 1}).to_list(500)
    events = await db.project_events.find({"created_at": {"$gte": start_utc}}, {"_id": 0, "project_id": 1, "type": 1, "visitor_id": 1}).to_list(100000)
    agg = {}
    for e in events:
        a = agg.setdefault(e["project_id"], {"opens": 0, "open_visitors": set(), "group": 0, "group_visitors": set()})
        if e["type"] == "open":
            a["opens"] += 1
            a["open_visitors"].add(e["visitor_id"])
        else:
            a["group"] += 1
            a["group_visitors"].add(e["visitor_id"])
    titles = {p["id"]: p["title"] for p in projects}
    rows = []
    for pid in list(titles) + [k for k in agg if k not in titles]:
        a = agg.get(pid, {"opens": 0, "open_visitors": set(), "group": 0, "group_visitors": set()})
        ov, gv = len(a["open_visitors"]), len(a["group_visitors"])
        rows.append({
            "id": pid,
            "title": titles.get(pid, "（已删除项目）"),
            "opens": a["opens"],
            "open_visitors": ov,
            "group_clicks": a["group"],
            "group_visitors": gv,
            "group_rate": round(gv / ov * 100, 1) if ov else 0,
        })
    rows.sort(key=lambda r: (r["group_clicks"], r["opens"]), reverse=True)
    return {"days": days, "projects": rows}


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


# ======================= 推广图文页（白底，后台生成分享链接 /p/{slug}） =======================
class PromoBlock(BaseModel):
    type: str = Field(pattern=r"^(heading|text|image|button|calculator)$")
    text: str = Field(default="", max_length=3000)   # heading/text 内容；button 为按钮文字；image 为图片说明
    image: str = Field(default="", max_length=500)   # image 图片地址
    link: str = Field(default="", max_length=500)    # button 跳转地址（站内 /tutorials/xxx 或外链）


class PromoInput(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    subtitle: str = Field(default="", max_length=300)
    cover: str = Field(default="", max_length=500)
    blocks: List[PromoBlock] = Field(default_factory=list)
    tool_slugs: List[str] = Field(default_factory=list)  # 本篇推广页底部展示的热门工具（空=展示全部）
    published: bool = True


class PromoPublish(BaseModel):
    published: bool


def _promo_slug() -> str:
    return uuid.uuid4().hex[:8]


@api_router.get("/promos/{slug}")
async def get_promo(slug: str):
    doc = await db.promos.find_one({"slug": slug, "published": {"$ne": False}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="页面不存在或已下线")
    return doc


@api_router.post("/promos/{slug}/view", status_code=201)
async def promo_view(slug: str):
    await db.promos.update_one({"slug": slug}, {"$inc": {"views": 1}})
    return {"ok": True}


# 推文独立 IP 统计：记录每次浏览 / 引导按钮点击（含来源渠道、referrer、地区、爬虫标记）
TARGET_LABELS = {
    "banner_join": "立即加入横幅",
    "recruit_join": "团队长招募·立即加入",
    "learn": "了解项目详情",
    "cs": "联系客服按钮",
    "cs_float": "悬浮客服按钮",
}


@api_router.post("/promos/{slug}/hit", status_code=201)
async def promo_hit(slug: str, data: PromoHitInput, request: Request):
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )
    now = datetime.now(timezone.utc)
    date_str = now.astimezone(CN_TZ).strftime("%Y-%m-%d")
    ua = request.headers.get("user-agent", "")[:300]
    geo = await asyncio.to_thread(lookup_geo_full, ip)
    region = geo["region"]
    is_bot = is_bot_ua(ua) or geo["hosting"] or geo["proxy"]
    bot_reason = ""
    if is_bot:
        bot_reason = "UA" if is_bot_ua(ua) else ("数据中心" if geo["hosting"] else "代理")
    device, browser = parse_ua(ua)
    await db.promo_hits.insert_one({
        "id": str(uuid.uuid4()),
        "slug": slug,
        "type": data.type,
        "target": data.target.strip(),
        "ip": ip,
        "region": region,
        "province": province_of(region) or "",
        "source": data.source.strip(),
        "referrer": referrer_host(data.referrer),
        "referrer_full": (data.referrer or "")[:300],
        "visitor_id": data.visitor_id.strip(),
        "ua": ua,
        "device": device,
        "browser": browser,
        "is_bot": is_bot,
        "bot_reason": bot_reason,
        "date": date_str,
        "created_at": now.isoformat(),
    })
    return {"ok": True}


@api_router.get("/admin/promos/{slug}/analytics")
async def promo_analytics(slug: str, days: int = 30, date: str = "", _: str = Depends(require_admin)):
    """推文独立 IP 统计：汇总 / 每日趋势 / 来源渠道(A链接) / 来源网站 / 省份分布 / 指定日 IP 明细。默认排除爬虫。"""
    days = max(1, min(days, 365))
    today = datetime.now(CN_TZ)
    start = (today - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    base = {"slug": slug, "date": {"$gte": start}, "is_bot": {"$ne": True}}

    # 汇总
    views = await db.promo_hits.count_documents({**base, "type": "view"})
    clicks = await db.promo_hits.count_documents({**base, "type": "click"})
    view_ips = await db.promo_hits.distinct("ip", {**base, "type": "view"})
    click_ips = await db.promo_hits.distinct("ip", {**base, "type": "click"})
    bots = await db.promo_hits.count_documents({"slug": slug, "date": {"$gte": start}, "is_bot": True})

    # 每日趋势（访问量 PV / 去重 UV / 点击 / 点击去重 IP）
    async def daily_group(hit_type):
        rows = await db.promo_hits.aggregate([
            {"$match": {**base, "type": hit_type}},
            {"$group": {"_id": "$date", "n": {"$sum": 1}, "ips": {"$addToSet": "$ip"}}},
        ]).to_list(400)
        return {r["_id"]: r for r in rows}

    vmap = await daily_group("view")
    cmap = await daily_group("click")
    daily = []
    for i in range(days):
        d = (today - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        vr, cr = vmap.get(d), cmap.get(d)
        daily.append({
            "date": d,
            "pv": vr["n"] if vr else 0,
            "uv": len(vr["ips"]) if vr else 0,
            "clicks": cr["n"] if cr else 0,
            "click_uv": len(cr["ips"]) if cr else 0,
        })

    # 来源渠道（A 链接 ?from= 标记）与 来源网站（referrer 域名）
    # source 按「第一个 / 之前的基础标记」归并，例如 微信服务号/contact、微信服务号/projects 统一计入「微信服务号」
    async def breakdown(field, normalize=False):
        pipeline = [{"$match": {**base, "type": "view"}}]
        group_key = f"${field}"
        if normalize:
            pipeline.append({"$addFields": {"_base": {"$arrayElemAt": [{"$split": [{"$ifNull": [f"${field}", ""]}, "/"]}, 0]}}})
            group_key = "$_base"
        pipeline += [
            {"$group": {"_id": group_key, "visits": {"$sum": 1}, "ips": {"$addToSet": "$ip"}}},
            {"$sort": {"visits": -1}},
            {"$limit": 50},
        ]
        rows = await db.promo_hits.aggregate(pipeline).to_list(50)
        out = []
        for r in rows:
            name = r["_id"] or ""
            out.append({"name": name or ("直接访问" if field == "source" else "直接进入/无来源"), "visits": r["visits"], "uv": len(r["ips"])})
        return out

    sources = await breakdown("source", normalize=True)
    referrers = await breakdown("referrer")

    # 省份分布（按独立 IP 去重）
    prows = await db.promo_hits.aggregate([
        {"$match": {**base, "type": "view"}},
        {"$group": {"_id": {"p": "$province", "ip": "$ip"}}},
        {"$group": {"_id": "$_id.p", "n": {"$sum": 1}}},
    ]).to_list(100)
    provinces = sorted(
        ({"name": r["_id"], "count": r["n"]} for r in prows if r["_id"]),
        key=lambda x: x["count"], reverse=True,
    )
    prov_total = sum(p["count"] for p in provinces)
    prov_unknown = sum(r["n"] for r in prows if not r["_id"])

    # 点击按钮分布
    trows = await db.promo_hits.aggregate([
        {"$match": {**base, "type": "click"}},
        {"$group": {"_id": "$target", "n": {"$sum": 1}, "ips": {"$addToSet": "$ip"}}},
        {"$sort": {"n": -1}},
    ]).to_list(20)
    targets = [{"name": TARGET_LABELS.get(r["_id"], r["_id"] or "其他"), "clicks": r["n"], "uv": len(r["ips"])} for r in trows]

    # 指定日 IP 明细（去重，含访问/点击次数、地区、来源）
    detail_date = date or today.strftime("%Y-%m-%d")
    hits = await db.promo_hits.find(
        {"slug": slug, "date": detail_date, "is_bot": {"$ne": True}},
        {"_id": 0, "ip": 1, "region": 1, "source": 1, "referrer": 1, "type": 1, "target": 1, "device": 1, "browser": 1, "created_at": 1},
    ).to_list(20000)
    ip_map: dict = {}
    for h in hits:
        row = ip_map.setdefault(h["ip"], {
            "ip": h["ip"], "region": h.get("region", ""), "source": (h.get("source", "") or "").split("/")[0],
            "referrer": h.get("referrer", ""), "device": h.get("device", ""), "browser": h.get("browser", ""),
            "views": 0, "clicks": 0, "first_seen": h.get("created_at", ""),
        })
        if h["type"] == "view":
            row["views"] += 1
        else:
            row["clicks"] += 1
        if h.get("created_at", "") < row["first_seen"]:
            row["first_seen"] = h["created_at"]
    ip_rows = sorted(ip_map.values(), key=lambda r: (r["clicks"], r["views"]), reverse=True)
    for r in ip_rows:
        try:
            r["first_seen"] = datetime.fromisoformat(r["first_seen"]).astimezone(CN_TZ).strftime("%H:%M")
        except Exception:
            r["first_seen"] = ""

    return {
        "slug": slug,
        "days": days,
        "summary": {
            "views": views, "unique_ips": len(view_ips),
            "clicks": clicks, "click_unique_ips": len(click_ips),
            "bots_excluded": bots,
        },
        "daily": daily,
        "sources": sources,
        "referrers": referrers,
        "provinces": {"provinces": provinces, "total": prov_total, "unknown": prov_unknown},
        "targets": targets,
        "detail_date": detail_date,
        "ip_detail": ip_rows,
    }


@api_router.get("/admin/promos")
async def admin_list_promos(_: str = Depends(require_admin)):
    promos = await db.promos.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)
    return {"promos": promos}


@api_router.post("/admin/promos", status_code=201)
async def admin_create_promo(data: PromoInput, _: str = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": str(uuid.uuid4()), "slug": _promo_slug(), **data.model_dump(), "views": 0, "created_at": now, "updated_at": now}
    await db.promos.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/promos/{promo_id}")
async def admin_update_promo(promo_id: str, data: PromoInput, _: str = Depends(require_admin)):
    result = await db.promos.update_one(
        {"id": promo_id}, {"$set": {**data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="页面不存在")
    return await db.promos.find_one({"id": promo_id}, {"_id": 0})


@api_router.patch("/admin/promos/{promo_id}/publish")
async def admin_publish_promo(promo_id: str, data: PromoPublish, _: str = Depends(require_admin)):
    result = await db.promos.update_one({"id": promo_id}, {"$set": {"published": data.published}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="页面不存在")
    return {"message": "已上线" if data.published else "已下线"}


@api_router.delete("/admin/promos/{promo_id}")
async def admin_delete_promo(promo_id: str, _: str = Depends(require_admin)):
    result = await db.promos.delete_one({"id": promo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="页面不存在")
    return {"message": "已删除"}



# ======================= 热门工具（白底分享页 /tools 列表 + /tools/{slug} 教程页） =======================
class ToolInput(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    icon: str = Field(default="", max_length=500)          # App 图标
    tagline: str = Field(default="", max_length=200)       # 一句话简介
    download_link: str = Field(default="", max_length=500) # 下载地址
    download_text: str = Field(default="立即下载", max_length=20)
    blocks: List[PromoBlock] = Field(default_factory=list) # 图文教学
    published: bool = True
    sort: int = 0                                          # 越小越靠前


class ToolEventInput(BaseModel):
    type: str = Field(pattern=r"^(view|download)$")


@api_router.get("/tools")
async def list_tools():
    tools = await db.tools.find(
        {"published": {"$ne": False}},
        {"_id": 0, "slug": 1, "name": 1, "icon": 1, "tagline": 1, "sort": 1, "views": 1},
    ).sort([("sort", 1), ("created_at", -1)]).to_list(200)
    return {"tools": tools}


@api_router.get("/tools/{slug}")
async def get_tool(slug: str):
    doc = await db.tools.find_one({"slug": slug, "published": {"$ne": False}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="工具不存在或已下线")
    return doc


@api_router.post("/tools/{slug}/events", status_code=201)
async def tool_event(slug: str, data: ToolEventInput):
    field = "views" if data.type == "view" else "downloads"
    await db.tools.update_one({"slug": slug}, {"$inc": {field: 1}})
    return {"ok": True}


@api_router.get("/admin/tools")
async def admin_list_tools(_: str = Depends(require_admin)):
    tools = await db.tools.find({}, {"_id": 0}).sort([("sort", 1), ("created_at", -1)]).to_list(300)
    return {"tools": tools}


@api_router.post("/admin/tools", status_code=201)
async def admin_create_tool(data: ToolInput, _: str = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": str(uuid.uuid4()), "slug": _promo_slug(), **data.model_dump(), "views": 0, "downloads": 0, "created_at": now, "updated_at": now}
    await db.tools.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/tools/{tool_id}")
async def admin_update_tool(tool_id: str, data: ToolInput, _: str = Depends(require_admin)):
    result = await db.tools.update_one(
        {"id": tool_id}, {"$set": {**data.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="工具不存在")
    return await db.tools.find_one({"id": tool_id}, {"_id": 0})


@api_router.patch("/admin/tools/{tool_id}/publish")
async def admin_publish_tool(tool_id: str, data: PromoPublish, _: str = Depends(require_admin)):
    result = await db.tools.update_one({"id": tool_id}, {"$set": {"published": data.published}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="工具不存在")
    return {"message": "已上线" if data.published else "已下线"}


@api_router.delete("/admin/tools/{tool_id}")
async def admin_delete_tool(tool_id: str, _: str = Depends(require_admin)):
    result = await db.tools.delete_one({"id": tool_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="工具不存在")
    return {"message": "已删除"}


# ---------------- USDT / 人民币 实时汇率（每日自动刷新 · 带缓存） ----------------
_usdt_cny_cache = {"rate": None, "updated_at": None, "source": None}
_USDT_CNY_FALLBACK = 6.65
_USDT_CNY_TTL = 12 * 3600  # 秒；超过则重新拉取（约每日自动更新）


async def _fetch_usdt_cny() -> float:
    def _get():
        # 多源回退：优先 currency-api(含 USDT→CNY，最接近实价)，再退 USD→CNY 代理，再退 CoinGecko
        sources = [
            ("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usdt.json",
             lambda j: j["usdt"]["cny"]),
            ("https://latest.currency-api.pages.dev/v1/currencies/usdt.json",
             lambda j: j["usdt"]["cny"]),
            ("https://open.er-api.com/v6/latest/USD",
             lambda j: j["rates"]["CNY"]),
            ("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=cny",
             lambda j: j["tether"]["cny"]),
        ]
        last_err = None
        for url, pick in sources:
            try:
                resp = requests.get(url, timeout=10)
                resp.raise_for_status()
                val = float(pick(resp.json()))
                if val > 0:
                    return val
            except Exception as e:  # noqa: BLE001
                last_err = e
                continue
        raise RuntimeError(f"all rate sources failed: {last_err}")
    return await asyncio.to_thread(_get)


@api_router.get("/rates/usdt-cny")
async def usdt_cny_rate():
    now = datetime.now(timezone.utc)
    cached_at = _usdt_cny_cache["updated_at"]
    fresh = cached_at is not None and (now - cached_at).total_seconds() < _USDT_CNY_TTL
    if not fresh:
        try:
            rate = await _fetch_usdt_cny()
            _usdt_cny_cache.update({"rate": round(rate, 4), "updated_at": now, "source": "live"})
        except Exception as e:
            logging.getLogger(__name__).warning("usdt-cny fetch failed: %s", e)
            if _usdt_cny_cache["rate"] is None:
                _usdt_cny_cache.update({"rate": _USDT_CNY_FALLBACK, "updated_at": now, "source": "fallback"})
    return {
        "rate": _usdt_cny_cache["rate"],
        "updated_at": _usdt_cny_cache["updated_at"].isoformat() if _usdt_cny_cache["updated_at"] else None,
        "source": _usdt_cny_cache["source"],
    }



# ============================================================
# 站内多坐席客服系统（推文页/工具页专用，替代单个外链）
# ============================================================

class AgentLogin(BaseModel):
    username: str
    password: str


class CSAgentInput(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    avatar: str = Field(default="", max_length=500)
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(default="", max_length=128)  # 编辑时留空=不改密码
    weight: int = Field(default=1, ge=1, le=100)
    enabled: bool = True
    remark: str = Field(default="", max_length=200)


class CSFaq(BaseModel):
    q: str = Field(min_length=1, max_length=100)
    a: str = Field(min_length=1, max_length=1000)


OFFLINE_REPLY_DEFAULT = (
    "您好，当前人工客服暂时不在线，您的留言我们已收到，客服上线后会第一时间回复您。\n\n"
    "👉 您可以先点击上方欢迎语下方的「常见问题」，快速了解礼品卡项目、收益、风险和开始方式；\n"
    "👉 也可以点击下方教程卡片，3 分钟加入蝙蝠官方群，最新项目资料都在群里。\n\n"
    "温馨提示：我们不收取任何费用，请勿向任何个人转账。\n"
    "有其他问题请直接留言。"
)
OFFLINE_REPLY_COOLDOWN_SEC = 180  # 访客连续留言：3 分钟内只自动回一次
OFFLINE_REOPEN_COOLDOWN_SEC = 6 * 3600  # 重新打开聊天窗：6 小时内只自动发一次
AUTO_REPLY_COOLDOWN_SEC = 180  # 全自动模式：访客连续留言 3 分钟内只回一次引导
AUTO_REPLY_DEFAULT = (
    "您好，这里是合赢项目社自动回复助手。项目详情由【项目负责人】在蝙蝠上一对一为您介绍：\n"
    "① 下载「蝙蝠」聊天 App（应用商店搜索「蝙蝠」，或点下方教程里的下载按钮）\n"
    "② 用手机号注册并登录蝙蝠\n"
    "③ 在蝙蝠搜索负责人 ID：{蝙蝠ID}，添加好友并备注「礼品卡」\n\n"
    "添加后，负责人会为您详细介绍礼品卡等最新项目，并邀请您加入官方项目交流群，群里每天发布最新项目。\n"
    "您也可以点击上方常见问题快速了解。"
)


class CSConfigInput(BaseModel):
    welcome: str = Field(default="您好，很高兴为您服务，请问有什么可以帮您？", max_length=1000)
    enabled: bool = True
    faqs: list[CSFaq] = Field(default_factory=list, max_length=20)
    offline_enabled: bool = True
    offline_reply: str = Field(default=OFFLINE_REPLY_DEFAULT, max_length=2000)
    offline_image: str = Field(default="", max_length=500)
    offline_tutorial: str = Field(default="join-group", max_length=60)  # 随离线回复一起发送的站内教程 slug（卡片）
    # 全自动回复模式（无人工客服）：欢迎语 + 常见问题 + 访客任意留言自动回复引导添加项目负责人
    mode: str = Field(default="manual", pattern="^(auto|manual)$")  # manual=人工客服+离线自动回复（默认）；auto=全自动
    bot_name: str = Field(default="合赢项目社 · 智能助手", max_length=40)
    owner_bat_id: str = Field(default="", max_length=60)
    auto_reply: str = Field(default="", max_length=2000)
    auto_tutorial: str = Field(default="join-group", max_length=60)


class CSFaqPick(BaseModel):
    index: int = Field(ge=0, le=19)


class CSStart(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    slug: str = Field(default="", max_length=60)
    source: str = Field(default="", max_length=50)
    referrer: str = Field(default="", max_length=300)
    visitor_id: str = Field(default="", max_length=64)


class CSMessageInput(BaseModel):
    text: str = Field(default="", max_length=2000)
    image: str = Field(default="", max_length=500)


class CSAgentReplyInput(CSMessageInput):
    tutorial: str = Field(default="", max_length=60)  # 站内教程 slug：以卡片形式发送（引流到蝙蝠群）


async def tutorial_link_card(slug: str) -> dict | None:
    tut = await db.tutorials.find_one({"slug": slug, "published": {"$ne": False}}, {"_id": 0, "title": 1, "summary": 1, "cover": 1, "slug": 1, "steps": 1})
    if not tut:
        return None
    return {"url": f"/tutorials/{tut['slug']}", "title": tut["title"], "desc": tut.get("summary") or f"{len(tut.get('steps', []))} 个步骤 · 点击查看", "cover": tut.get("cover", "")}


class QuickRepliesInput(BaseModel):
    replies: List[str] = Field(default_factory=list)


class QRLibraryInput(BaseModel):
    """后台统一话术库：分组 + 文本 + 图片 + 可选教程卡片（文本/图片/教程至少一项）"""
    group: str = Field(default="默认", max_length=30)
    text: str = Field(default="", max_length=1000)
    image: str = Field(default="", max_length=500)
    tutorial: str = Field(default="", max_length=60)


class QRGroupRename(BaseModel):
    old: str = Field(min_length=1, max_length=30)
    new: str = Field(min_length=1, max_length=30)


def create_agent_token(agent_id: str, username: str) -> str:
    payload = {
        "sub": agent_id,
        "username": username,
        "role": "agent",
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def require_agent(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("role") != "agent":
            raise HTTPException(status_code=401, detail="无权限")
        agent = await db.cs_agents.find_one({"id": payload["sub"]})
        if not agent or not agent.get("enabled", True):
            raise HTTPException(status_code=401, detail="坐席账号不存在或已停用")
        return agent
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效的登录凭证")


async def get_cs_config() -> dict:
    doc = await db.cs_config.find_one({"key": "cs"}) or {}
    return {
        "welcome": doc.get("welcome", CSConfigInput.model_fields["welcome"].default),
        "enabled": doc.get("enabled", True),
        "faqs": doc.get("faqs", []),
        "offline_enabled": doc.get("offline_enabled", True),
        "offline_reply": doc.get("offline_reply", OFFLINE_REPLY_DEFAULT),
        "offline_image": doc.get("offline_image", ""),
        "offline_tutorial": doc.get("offline_tutorial", "join-group"),
        "mode": doc.get("mode", "manual"),
        "bot_name": doc.get("bot_name", "合赢项目社 · 智能助手"),
        "owner_bat_id": doc.get("owner_bat_id", ""),
        "auto_reply": doc.get("auto_reply") or AUTO_REPLY_DEFAULT,
        "auto_tutorial": doc.get("auto_tutorial", "join-group"),
    }


def cs_tpl(text: str, cfg: dict) -> str:
    """话术模板变量：{蝙蝠ID} → 后台配置的项目负责人蝙蝠 ID"""
    return (text or "").replace("{蝙蝠ID}", cfg.get("owner_bat_id") or "（请在后台填写负责人蝙蝠ID）")


def cs_bot_public(cfg: dict) -> dict:
    return {"id": "bot", "name": cfg["bot_name"], "avatar": ""}


def cs_faqs_public(cfg: dict) -> list:
    return [{"q": f["q"], "a": cs_tpl(f["a"], cfg)} for f in cfg["faqs"]]


async def maybe_send_auto_reply(sess: dict, cfg: dict) -> bool:
    """全自动模式：访客任意留言 → 自动回复引导（文字 + 教程卡片），3 分钟冷却"""
    now = datetime.now(timezone.utc)
    last = sess.get("auto_reply_at")
    if last:
        try:
            if (now - datetime.fromisoformat(last)).total_seconds() < AUTO_REPLY_COOLDOWN_SEC:
                return False
        except ValueError:
            pass
    base = {"session_id": sess["id"], "sender": "agent", "via": "auto", "agent_id": sess.get("agent_id", "")}
    docs = [{**base, "id": str(uuid.uuid4()), "text": cs_tpl(cfg["auto_reply"], cfg), "image": "", "created_at": (now + timedelta(milliseconds=2)).isoformat(), "created_at_dt": now}]
    link = await tutorial_link_card(cfg["auto_tutorial"]) if cfg.get("auto_tutorial") else None
    if link:
        docs.append({**base, "id": str(uuid.uuid4()), "text": f"📖 图文教程：{link['title']}", "image": "", "link": link, "created_at": (now + timedelta(milliseconds=3)).isoformat(), "created_at_dt": now})
    await db.cs_messages.insert_many(docs)
    await db.cs_sessions.update_one({"id": sess["id"]}, {"$set": {"auto_reply_at": now.isoformat(), "last_message": "[自动回复] 引导添加负责人"}, "$inc": {"unread_visitor": len(docs)}})
    return True


async def maybe_send_offline_reply(sess: dict, cfg: dict | None = None, cooldown_sec: int = OFFLINE_REPLY_COOLDOWN_SEC) -> bool:
    """全部坐席都不在线时，自动回复引导（点常见问题 + 教程卡片 + 可选二维码图片）。同一会话有冷却时间。"""
    cfg = cfg or await get_cs_config()
    if not cfg["offline_enabled"] or not (cfg["offline_reply"].strip() or cfg["offline_image"] or cfg.get("offline_tutorial")):
        return False
    if await pick_online_agent():
        return False
    now = datetime.now(timezone.utc)
    last = sess.get("offline_reply_at")
    if last:
        try:
            if (now - datetime.fromisoformat(last)).total_seconds() < cooldown_sec:
                return False
        except ValueError:
            pass
    base = {"session_id": sess["id"], "sender": "agent", "via": "offline", "agent_id": sess.get("agent_id", "")}
    docs = []
    if cfg["offline_reply"].strip():
        docs.append({**base, "id": str(uuid.uuid4()), "text": cs_tpl(cfg["offline_reply"], cfg), "image": "", "created_at": (now + timedelta(milliseconds=2)).isoformat(), "created_at_dt": now})
    if cfg["offline_image"]:
        docs.append({**base, "id": str(uuid.uuid4()), "text": "", "image": cfg["offline_image"], "created_at": (now + timedelta(milliseconds=3)).isoformat(), "created_at_dt": now})
    if cfg.get("offline_tutorial"):
        link = await tutorial_link_card(cfg["offline_tutorial"])
        if link:
            docs.append({**base, "id": str(uuid.uuid4()), "text": f"📖 图文教程：{link['title']}", "image": "", "link": link,
                         "created_at": (now + timedelta(milliseconds=4)).isoformat(), "created_at_dt": now})
    if not docs:
        return False
    await db.cs_messages.insert_many(docs)
    await db.cs_sessions.update_one({"id": sess["id"]}, {"$set": {"offline_reply_at": now.isoformat(), "last_message": "[自动回复] 引导点常见问题/进群教程"}, "$inc": {"unread_visitor": len(docs)}})
    return True


ONLINE_TIMEOUT_SEC = 120  # 坐席超过 2 分钟无心跳视为掉线（自动记一条下线）


def agent_is_online(a: dict) -> bool:
    if not a.get("online"):
        return False
    seen = a.get("last_seen_at")
    if not seen:
        return False
    try:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(seen)).total_seconds() <= ONLINE_TIMEOUT_SEC
    except ValueError:
        return False


async def agent_status_log(agent: dict, action: str, at: datetime, auto: bool = False):
    await db.cs_agent_status_log.insert_one({
        "id": str(uuid.uuid4()), "agent_id": agent["id"], "agent_name": agent.get("name", ""),
        "action": action, "auto": auto, "at": at.isoformat(), "date": at.astimezone(CN_TZ).strftime("%Y-%m-%d"),
    })


async def agent_auto_offline_if_stale(agent: dict):
    """掉线补记：标记在线但心跳超时的坐席，按最后心跳时间记一条「自动下线」并置为离线，并把会话移交给在线坐席。"""
    if agent.get("online") and not agent_is_online(agent):
        try:
            at = datetime.fromisoformat(agent["last_seen_at"]) if agent.get("last_seen_at") else datetime.now(timezone.utc)
        except ValueError:
            at = datetime.now(timezone.utc)
        res = await db.cs_agents.update_one({"id": agent["id"], "online": True}, {"$set": {"online": False}})
        agent["online"] = False
        if res.modified_count:
            await agent_status_log(agent, "offline", at, auto=True)
            await handover_sessions(agent["id"])


HANDOVER_WINDOW_HOURS = 24  # 坐席下线时，移交最近 24 小时内有过消息的会话


async def pick_online_agent(exclude_id: str = ""):
    """在线坐席中按 已分配量/权重 选一位（不含 exclude_id）；无人在线返回 None。"""
    agents = await db.cs_agents.find({"enabled": True, "online": True, "id": {"$ne": exclude_id}}).to_list(200)
    online = [a for a in agents if agent_is_online(a)]
    if not online:
        return None
    online.sort(key=lambda a: (a.get("assigned_count", 0) / max(1, a.get("weight", 1)), a.get("last_assigned_at", "")))
    return online[0]


async def transfer_session(sess: dict, to_agent: dict, note: str = "") -> None:
    """把会话移交给 to_agent：改归属、计数、写一条系统提示，访客端头像/名称随之更新。"""
    now = datetime.now(timezone.utc)
    await db.cs_sessions.update_one({"id": sess["id"]}, {"$set": {"agent_id": to_agent["id"], "handover_from": sess.get("agent_id", ""), "handover_at": now.isoformat()}, "$inc": {"unread_visitor": 1}})
    await db.cs_agents.update_one({"id": to_agent["id"]}, {"$inc": {"assigned_count": 1}, "$set": {"last_assigned_at": now.isoformat()}})
    await db.cs_messages.insert_one({
        "id": str(uuid.uuid4()), "session_id": sess["id"], "sender": "agent", "via": "system", "agent_id": to_agent["id"],
        "text": note or f"客服「{to_agent.get('name', '客服')}」已接入，继续为您服务", "image": "", "created_at": now.isoformat(), "created_at_dt": now,
    })


async def handover_sessions(from_agent_id: str) -> int:
    """坐席下线：把其最近活跃的会话移交给在线坐席（轮流分配）。无人在线则保留，待访客再发消息时再移交。"""
    since = (datetime.now(timezone.utc) - timedelta(hours=HANDOVER_WINDOW_HOURS)).isoformat()
    sessions = await db.cs_sessions.find({"agent_id": from_agent_id, "last_message_at": {"$gte": since}}).to_list(500)
    moved = 0
    for sess in sessions:
        target = await pick_online_agent(exclude_id=from_agent_id)
        if not target:
            break
        await transfer_session(sess, target)
        moved += 1
    if moved:
        logging.info("CS handover: %s sessions moved from agent %s", moved, from_agent_id)
    return moved


async def ensure_online_agent(sess: dict) -> dict:
    """访客来消息时：若当前坐席不在线而有其他坐席在线，则当场移交。返回（可能已更新的）会话。"""
    cur = await db.cs_agents.find_one({"id": sess.get("agent_id")})
    if cur:
        await agent_auto_offline_if_stale(cur)
    if cur and agent_is_online(cur) and cur.get("enabled", True):
        return sess
    target = await pick_online_agent(exclude_id=sess.get("agent_id", ""))
    if not target:
        return sess
    await transfer_session(sess, target)
    return {**sess, "agent_id": target["id"]}


async def assign_cs_agent():
    """加权轮流：优先在线坐席；无人在线时退回所有启用坐席（访客仍可留言）。挑选 已分配量/权重 最小者并累加计数。"""
    agents = await db.cs_agents.find({"enabled": True}).to_list(200)
    if not agents:
        return None
    for a in agents:
        await agent_auto_offline_if_stale(a)
    online = [a for a in agents if agent_is_online(a)]
    pool = online or agents
    pool.sort(key=lambda a: (a.get("assigned_count", 0) / max(1, a.get("weight", 1)), a.get("last_assigned_at", "")))
    chosen = pool[0]
    await db.cs_agents.update_one(
        {"id": chosen["id"]},
        {"$inc": {"assigned_count": 1}, "$set": {"last_assigned_at": datetime.now(timezone.utc).isoformat()}},
    )
    return chosen


def agent_public(a: dict) -> dict:
    return {"id": a["id"], "name": a.get("name", "客服"), "avatar": a.get("avatar", "")}


# ---------- 访客端（无需登录） ----------
@api_router.get("/cs/config")
async def cs_public_config():
    cfg = await get_cs_config()
    has = await db.cs_agents.count_documents({"enabled": True})
    return {"enabled": bool(cfg["enabled"]) and (cfg["mode"] == "auto" or has > 0), "mode": cfg["mode"], "welcome": cs_tpl(cfg["welcome"], cfg), "faqs": cs_faqs_public(cfg)}


@api_router.post("/cs/start", status_code=201)
async def cs_start(data: CSStart, request: Request):
    cfg = await get_cs_config()
    if not cfg["enabled"]:
        return {"enabled": False}
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    auto = cfg["mode"] == "auto"
    pub = (lambda a: cs_bot_public(cfg)) if auto else (lambda a: agent_public(a) if a else None)
    base_resp = {"enabled": True, "session_id": data.session_id, "mode": cfg["mode"], "welcome": cs_tpl(cfg["welcome"], cfg), "faqs": cs_faqs_public(cfg)}
    existing = await db.cs_sessions.find_one({"id": data.session_id})
    if existing:
        agent = await db.cs_agents.find_one({"id": existing.get("agent_id")})
        if not agent or not agent.get("enabled", True):
            agent = await assign_cs_agent()
            if agent:
                await db.cs_sessions.update_one({"id": data.session_id}, {"$set": {"agent_id": agent["id"]}})
        # 老访客重新打开聊天窗：人工模式下若全员离线且冷却期已过，自动发进群教程
        if not auto:
            await maybe_send_offline_reply(existing, cfg, cooldown_sec=OFFLINE_REOPEN_COOLDOWN_SEC)
        return {**base_resp, "agent": pub(agent)}
    agent = await assign_cs_agent()
    if not agent and not auto:
        return {"enabled": False}
    agent_id = agent["id"] if agent else ""
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "unknown")
    geo = await asyncio.to_thread(lookup_geo_full, ip)
    # 原子创建会话，避免并发/重复请求（如 StrictMode、快速双击）产生重复会话与重复欢迎语
    res = await db.cs_sessions.update_one(
        {"id": data.session_id},
        {"$setOnInsert": {
            "id": data.session_id,
            "agent_id": agent_id,
            "slug": data.slug.strip(),
            "source": (data.source or "").split("/")[0],
            "referrer": referrer_host(data.referrer),
            "visitor_id": data.visitor_id.strip(),
            "ip": ip,
            "region": geo["region"],
            "created_at": now_iso,
            "last_message_at": now_iso,
            "last_activity_dt": now,
            "last_message": cfg["welcome"][:50],
            "unread_agent": 0,
            "unread_visitor": 1,
        }},
        upsert=True,
    )
    if res.upserted_id is None:
        # 并发竞争失败：会话已被另一请求创建，直接返回现有会话，不再重复插入欢迎语
        existing = await db.cs_sessions.find_one({"id": data.session_id})
        ag = await db.cs_agents.find_one({"id": existing.get("agent_id")}) if existing else None
        return {**base_resp, "agent": pub(ag or agent)}
    # 欢迎语用确定性 id，并发 upsert 保证只有一条
    await db.cs_messages.update_one(
        {"id": f"welcome-{data.session_id}"},
        {"$setOnInsert": {
            "id": f"welcome-{data.session_id}",
            "session_id": data.session_id,
            "sender": "agent",
            "agent_id": agent_id,
            "text": cs_tpl(cfg["welcome"], cfg),
            "image": "",
            "created_at": now_iso,
            "created_at_dt": now,
        }},
        upsert=True,
    )
    if not auto:
        await maybe_send_offline_reply({"id": data.session_id, "agent_id": agent_id}, cfg)
    return {**base_resp, "agent": pub(agent)}


def cs_preview(text: str, image: str) -> str:
    return (text[:50] if text else ("[图片]" if image else ""))


@api_router.post("/cs/{session_id}/message", status_code=201)
async def cs_visitor_message(session_id: str, data: CSMessageInput):
    if not data.text.strip() and not data.image.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")
    sess = await db.cs_sessions.find_one({"id": session_id})
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在")
    cfg = await get_cs_config()
    auto = cfg["mode"] == "auto"
    if not auto:
        sess = await ensure_online_agent(sess)
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    await db.cs_messages.insert_one({
        "id": str(uuid.uuid4()), "session_id": session_id, "sender": "visitor",
        "agent_id": sess.get("agent_id", ""), "text": data.text, "image": data.image,
        "created_at": now_iso, "created_at_dt": now,
    })
    await db.cs_sessions.update_one(
        {"id": session_id},
        {"$set": {"last_message_at": now_iso, "last_activity_dt": now, "last_message": cs_preview(data.text, data.image)}, "$inc": {"unread_agent": 1}},
    )
    if auto:
        await maybe_send_auto_reply(sess, cfg)
    else:
        await maybe_send_offline_reply(sess, cfg)
    return {"ok": True}


@api_router.post("/cs/{session_id}/faq", status_code=201)
async def cs_visitor_faq(session_id: str, data: CSFaqPick):
    """访客点击常见问题：写入一条访客提问 + 一条自动回复（坐席端同样可见）。"""
    sess = await db.cs_sessions.find_one({"id": session_id})
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在")
    cfg = await get_cs_config()
    if data.index >= len(cfg["faqs"]):
        raise HTTPException(status_code=404, detail="该问题不存在")
    faq = cfg["faqs"][data.index]
    auto = cfg["mode"] == "auto"
    if not auto:
        sess = await ensure_online_agent(sess)
    now = datetime.now(timezone.utc)
    base = {"session_id": session_id, "agent_id": sess.get("agent_id", ""), "image": ""}
    await db.cs_messages.insert_many([
        {**base, "id": str(uuid.uuid4()), "sender": "visitor", "text": faq["q"], "created_at": now.isoformat(), "created_at_dt": now},
        {**base, "id": str(uuid.uuid4()), "sender": "agent", "via": "faq", "text": cs_tpl(faq["a"], cfg),
         "created_at": (now + timedelta(milliseconds=1)).isoformat(), "created_at_dt": now + timedelta(milliseconds=1)},
    ])
    await db.cs_sessions.update_one(
        {"id": session_id},
        {"$set": {"last_message_at": now.isoformat(), "last_activity_dt": now, "last_message": cs_preview(faq["a"], "")}, "$inc": {"unread_agent": 1}},
    )
    if not auto:
        await maybe_send_offline_reply(sess, cfg)
    return {"ok": True}


@api_router.get("/cs/{session_id}/messages")
async def cs_visitor_messages(session_id: str, after: str = ""):
    sess = await db.cs_sessions.find_one({"id": session_id})
    if not sess:
        return {"messages": [], "agent": None}
    q = {"session_id": session_id}
    if after:
        q["created_at"] = {"$gt": after}
    msgs = await db.cs_messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)
    if not after:
        await db.cs_sessions.update_one({"id": session_id}, {"$set": {"unread_visitor": 0}})
    cfg = await get_cs_config()
    if cfg["mode"] == "auto":
        return {"messages": msgs, "agent": cs_bot_public(cfg), "online": True, "mode": "auto"}
    agent = await db.cs_agents.find_one({"id": sess.get("agent_id")})
    # 访客端显示客服是否在线：当前坐席在线，或任一坐席在线（会在访客发消息时接管）
    online = bool(agent and agent_is_online(agent)) or (await pick_online_agent()) is not None
    return {"messages": msgs, "agent": agent_public(agent) if agent else None, "online": online, "mode": "manual"}


# ---------- 坐席端 ----------
@api_router.post("/cs/agent/login")
async def cs_agent_login(data: AgentLogin):
    agent = await db.cs_agents.find_one({"username": data.username})
    if not agent or not verify_password(data.password, agent.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="账号或密码错误")
    if not agent.get("enabled", True):
        raise HTTPException(status_code=403, detail="该坐席账号已停用")
    return {"token": create_agent_token(agent["id"], agent["username"]), "agent": {**agent_public(agent), "quick_replies": agent.get("quick_replies", [])}}


@api_router.get("/cs/agent/me")
async def cs_agent_me(agent: dict = Depends(require_agent)):
    await agent_auto_offline_if_stale(agent)
    return {**agent_public(agent), "quick_replies": agent.get("quick_replies", []), "online": bool(agent.get("online"))}


class AgentStatusInput(BaseModel):
    online: bool


@api_router.post("/cs/agent/status")
async def cs_agent_set_status(data: AgentStatusInput, agent: dict = Depends(require_agent)):
    """坐席手动上线 / 下线，并记录日志"""
    await agent_auto_offline_if_stale(agent)
    now = datetime.now(timezone.utc)
    changed = bool(agent.get("online")) != data.online
    if changed:
        await agent_status_log(agent, "online" if data.online else "offline", now)
    await db.cs_agents.update_one({"id": agent["id"]}, {"$set": {"online": data.online, "last_seen_at": now.isoformat()}})
    moved = await handover_sessions(agent["id"]) if (changed and not data.online) else 0
    return {"online": data.online, "handover": moved}


@api_router.get("/cs/agent/status-log")
async def cs_agent_status_log_mine(days: int = 7, start: str = "", end: str = "", agent: dict = Depends(require_agent)):
    """坐席查看自己的上下线统计（最近 days 天，或 start/end 日期范围）"""
    return {"days": await build_status_report(days, agent_id=agent["id"], start=start, end=end)}


@api_router.put("/cs/agent/quick-replies")
async def cs_agent_quick_replies(data: QuickRepliesInput, agent: dict = Depends(require_agent)):
    cleaned = [r.strip()[:200] for r in data.replies if r.strip()][:50]
    await db.cs_agents.update_one({"id": agent["id"]}, {"$set": {"quick_replies": cleaned}})
    return {"replies": cleaned}


@api_router.get("/cs/agent/sessions")
async def cs_agent_sessions(agent: dict = Depends(require_agent)):
    # 工作台每 3 秒轮询一次，顺便作为在线心跳；心跳超时的会被判定掉线并自动补记下线
    await agent_auto_offline_if_stale(agent)
    if agent.get("online"):
        await db.cs_agents.update_one({"id": agent["id"]}, {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat()}})
    rows = await db.cs_sessions.find({"agent_id": agent["id"]}, {"_id": 0}).sort("last_message_at", -1).to_list(500)
    return {"sessions": rows, "online": bool(agent.get("online"))}


def parse_cn_date(s: str):
    try:
        return date.fromisoformat(s) if s else None
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")


async def build_status_report(days: int, agent_id: str = "", start: str = "", end: str = "") -> list:
    """按天汇总每位坐席的上下线：首次上线、最后下线、在线时长(分钟)、时段明细。跨天的在线段按天切分。
    可用 start/end（YYYY-MM-DD，北京时间）指定日期范围；未指定则取最近 days 天。"""
    days = max(1, min(days, 90))
    now = datetime.now(timezone.utc)
    today_cn = now.astimezone(CN_TZ).date()
    end_day = parse_cn_date(end) or today_cn
    start_day = parse_cn_date(start) or (end_day - timedelta(days=days - 1))
    if start_day > end_day:
        start_day, end_day = end_day, start_day
    if (end_day - start_day).days > 365:
        raise HTTPException(status_code=400, detail="查询范围最多 1 年")
    start_utc = datetime.combine(start_day, time.min, tzinfo=CN_TZ).astimezone(timezone.utc)
    end_utc = min(now, datetime.combine(end_day + timedelta(days=1), time.min, tzinfo=CN_TZ).astimezone(timezone.utc))
    q = {"at": {"$gte": start_utc.isoformat(), "$lt": end_utc.isoformat()}}
    if agent_id:
        q["agent_id"] = agent_id
    logs = await db.cs_agent_status_log.find(q, {"_id": 0}).sort("at", 1).to_list(20000)
    agents_q = {"id": agent_id} if agent_id else {}
    agents = {a["id"]: a for a in await db.cs_agents.find(agents_q, {"_id": 0, "password_hash": 0}).to_list(300)}
    # 起始时刻之前仍处于在线的坐席：补一个起始「上线」点
    by_agent: dict[str, list] = {aid: [] for aid in agents}
    for aid, a in agents.items():
        prev = await db.cs_agent_status_log.find_one({"agent_id": aid, "at": {"$lt": start_utc.isoformat()}}, sort=[("at", -1)])
        if prev and prev["action"] == "online":
            by_agent[aid].append({"action": "online", "at": start_utc.isoformat(), "auto": False})
    for lg in logs:
        by_agent.setdefault(lg["agent_id"], []).append(lg)
    # 配对成在线时段
    report: dict[str, dict] = {}  # key: date|agent
    for aid, items in by_agent.items():
        a = agents.get(aid, {})
        open_at = None
        segments = []
        for lg in items:
            at = datetime.fromisoformat(lg["at"])
            if lg["action"] == "online":
                if open_at is None:
                    open_at = at
            elif open_at is not None:
                segments.append((open_at, at, lg.get("auto", False)))
                open_at = None
        if open_at is not None:
            # 仍在线：算到查询范围结束（范围含今天则为当前时刻）；若实际已掉线但未记录，则忽略
            segments.append((open_at, end_utc if agent_is_online(a) or end_utc < now else open_at, None))
        for s_at, e_at, auto in segments:
            cur = s_at
            while cur < e_at:
                d = cur.astimezone(CN_TZ).date()
                day_end = datetime.combine(d + timedelta(days=1), time.min, tzinfo=CN_TZ).astimezone(timezone.utc)
                seg_end = min(e_at, day_end)
                key = f"{d.isoformat()}|{aid}"
                row = report.setdefault(key, {"date": d.isoformat(), "agent_id": aid, "agent_name": a.get("name", ""), "avatar": a.get("avatar", ""),
                                               "first_online": None, "last_offline": None, "online_minutes": 0, "segments": []})
                row["online_minutes"] += int((seg_end - cur).total_seconds() // 60)
                row["first_online"] = row["first_online"] or cur.astimezone(CN_TZ).strftime("%H:%M")
                still = seg_end == e_at and auto is None
                row["last_offline"] = None if still else (seg_end.astimezone(CN_TZ).strftime("%H:%M") if seg_end == e_at else "24:00")
                row["segments"].append({"from": cur.astimezone(CN_TZ).strftime("%H:%M"), "to": None if still else seg_end.astimezone(CN_TZ).strftime("%H:%M"), "auto": bool(auto)})
                cur = seg_end
    rows = sorted(report.values(), key=lambda r: (r["date"], r["agent_name"]), reverse=True)
    for r in rows:
        r["online_now"] = agent_is_online(agents.get(r["agent_id"], {})) and r["date"] == today_cn.isoformat()
    return rows


@api_router.get("/cs/agent/sessions/{session_id}/messages")
async def cs_agent_messages(session_id: str, after: str = "", agent: dict = Depends(require_agent)):
    sess = await db.cs_sessions.find_one({"id": session_id, "agent_id": agent["id"]})
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在")
    q = {"session_id": session_id}
    if after:
        q["created_at"] = {"$gt": after}
    msgs = await db.cs_messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)
    if not after:
        await db.cs_sessions.update_one({"id": session_id}, {"$set": {"unread_agent": 0}})
    return {"messages": msgs, "visitor": {"region": sess.get("region", ""), "source": sess.get("source", ""), "referrer": sess.get("referrer", ""), "ip": sess.get("ip", "")}}


@api_router.post("/cs/agent/sessions/{session_id}/read")
async def cs_agent_read(session_id: str, agent: dict = Depends(require_agent)):
    await db.cs_sessions.update_one({"id": session_id, "agent_id": agent["id"]}, {"$set": {"unread_agent": 0}})
    return {"ok": True}


@api_router.post("/cs/agent/sessions/{session_id}/reply", status_code=201)
async def cs_agent_reply(session_id: str, data: CSAgentReplyInput, agent: dict = Depends(require_agent)):
    link = await tutorial_link_card(data.tutorial.strip()) if data.tutorial.strip() else None
    if not data.text.strip() and not data.image.strip() and not link:
        raise HTTPException(status_code=400, detail="消息不能为空")
    sess = await db.cs_sessions.find_one({"id": session_id, "agent_id": agent["id"]})
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在")
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    doc = {"id": str(uuid.uuid4()), "session_id": session_id, "sender": "agent", "agent_id": agent["id"],
           "text": data.text, "image": data.image, "created_at": now_iso, "created_at_dt": now}
    if link:
        doc.update({"text": f"📖 图文教程：{link['title']}", "image": "", "link": link})
    await db.cs_messages.insert_one(doc)
    preview = f"[教程] {link['title']}" if link else cs_preview(data.text, data.image)
    await db.cs_sessions.update_one(
        {"id": session_id},
        {"$set": {"last_message_at": now_iso, "last_activity_dt": now, "last_message": preview, "unread_agent": 0}, "$inc": {"unread_visitor": 1}},
    )
    return {"ok": True}


@api_router.post("/cs/agent/upload", status_code=201)
async def cs_agent_upload(file: UploadFile = File(...), agent: dict = Depends(require_agent)):
    return await save_image_upload(file)


@api_router.post("/cs/{session_id}/upload", status_code=201)
async def cs_visitor_upload(session_id: str, file: UploadFile = File(...)):
    if not await db.cs_sessions.find_one({"id": session_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="会话不存在")
    return await save_image_upload(file)


# ---------- 后台管理（超级管理员） ----------
@api_router.get("/admin/cs/agents")
async def admin_cs_agents(_: str = Depends(require_admin)):
    rows = await db.cs_agents.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(200)
    return {"agents": rows}


@api_router.post("/admin/cs/agents", status_code=201)
async def admin_cs_create_agent(data: CSAgentInput, _: str = Depends(require_admin)):
    if await db.cs_agents.find_one({"username": data.username}):
        raise HTTPException(status_code=400, detail="该登录账号已存在")
    if not data.password:
        raise HTTPException(status_code=400, detail="请设置登录密码")
    doc = {
        "id": str(uuid.uuid4()), "name": data.name, "avatar": data.avatar,
        "username": data.username, "password_hash": hash_password(data.password),
        "weight": data.weight, "enabled": data.enabled, "remark": data.remark,
        "quick_replies": [], "assigned_count": 0, "last_assigned_at": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cs_agents.insert_one(doc)
    return {"id": doc["id"]}


@api_router.put("/admin/cs/agents/{agent_id}")
async def admin_cs_update_agent(agent_id: str, data: CSAgentInput, _: str = Depends(require_admin)):
    dup = await db.cs_agents.find_one({"username": data.username, "id": {"$ne": agent_id}})
    if dup:
        raise HTTPException(status_code=400, detail="该登录账号已被占用")
    upd = {
        "name": data.name, "avatar": data.avatar, "username": data.username,
        "weight": data.weight, "enabled": data.enabled, "remark": data.remark,
    }
    if data.password:
        upd["password_hash"] = hash_password(data.password)
    res = await db.cs_agents.update_one({"id": agent_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="坐席不存在")
    return {"ok": True}


@api_router.delete("/admin/cs/agents/{agent_id}")
async def admin_cs_delete_agent(agent_id: str, _: str = Depends(require_admin)):
    await db.cs_agents.delete_one({"id": agent_id})
    # 该坐席名下的会话整体移交给其他坐席（优先在线，其次任一启用坐席），避免访客无人接待
    target = await pick_online_agent(exclude_id=agent_id) or await db.cs_agents.find_one({"enabled": True, "id": {"$ne": agent_id}})
    moved = 0
    if target:
        res = await db.cs_sessions.update_many({"agent_id": agent_id}, {"$set": {"agent_id": target["id"], "handover_from": agent_id, "handover_at": datetime.now(timezone.utc).isoformat()}})
        moved = res.modified_count
    return {"ok": True, "handover": moved}


@api_router.get("/admin/cs/config")
async def admin_cs_get_config(_: str = Depends(require_admin)):
    return await get_cs_config()


@api_router.put("/admin/cs/config")
async def admin_cs_set_config(data: CSConfigInput, _: str = Depends(require_admin)):
    await db.cs_config.update_one({"key": "cs"}, {"$set": {"key": "cs", "welcome": data.welcome, "enabled": data.enabled, "faqs": [f.model_dump() for f in data.faqs],
                  "offline_enabled": data.offline_enabled, "offline_reply": data.offline_reply, "offline_image": data.offline_image, "offline_tutorial": data.offline_tutorial.strip(),
                  "mode": data.mode, "bot_name": data.bot_name.strip() or "智能助手", "owner_bat_id": data.owner_bat_id.strip(), "auto_reply": data.auto_reply, "auto_tutorial": data.auto_tutorial.strip()}}, upsert=True)
    return {"ok": True}


# ---------- 后台统一话术库（所有坐席共用，支持分组与图片） ----------
async def qr_library_list() -> list:
    return await db.cs_quick_replies.find({}, {"_id": 0}).sort([("group", 1), ("created_at", 1)]).to_list(500)


def qr_clean(data: QRLibraryInput) -> dict:
    text, image, group, tutorial = data.text.strip(), data.image.strip(), (data.group.strip() or "默认"), data.tutorial.strip()
    if not text and not image and not tutorial:
        raise HTTPException(status_code=400, detail="话术文本、图片、教程卡片至少填写一项")
    return {"group": group, "text": text, "image": image, "tutorial": tutorial}


@api_router.get("/admin/cs/quick-replies")
async def admin_qr_list(_: str = Depends(require_admin)):
    return {"replies": await qr_library_list()}


@api_router.post("/admin/cs/quick-replies", status_code=201)
async def admin_qr_create(data: QRLibraryInput, _: str = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **qr_clean(data), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.cs_quick_replies.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/cs/quick-replies/group")
async def admin_qr_rename_group(data: QRGroupRename, _: str = Depends(require_admin)):
    res = await db.cs_quick_replies.update_many({"group": data.old.strip()}, {"$set": {"group": data.new.strip()}})
    return {"ok": True, "updated": res.modified_count}


@api_router.put("/admin/cs/quick-replies/{qr_id}")
async def admin_qr_update(qr_id: str, data: QRLibraryInput, _: str = Depends(require_admin)):
    res = await db.cs_quick_replies.update_one({"id": qr_id}, {"$set": qr_clean(data)})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="话术不存在")
    return {"ok": True}


@api_router.delete("/admin/cs/quick-replies/{qr_id}")
async def admin_qr_delete(qr_id: str, _: str = Depends(require_admin)):
    res = await db.cs_quick_replies.delete_one({"id": qr_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="话术不存在")
    return {"ok": True}


@api_router.get("/cs/agent/quick-replies")
async def cs_agent_qr_library(agent: dict = Depends(require_agent)):
    # 一次性迁移：坐席旧的个人常用语并入话术库（分组「我的常用语」），之后统一在话术库维护
    old = [t for t in agent.get("quick_replies", []) if isinstance(t, str) and t.strip()]
    if old:
        now = datetime.now(timezone.utc).isoformat()
        await db.cs_quick_replies.insert_many([
            {"id": str(uuid.uuid4()), "group": "我的常用语", "text": t.strip(), "image": "", "created_by": agent["id"], "created_by_name": agent.get("name", ""), "created_at": now}
            for t in old
        ])
        await db.cs_agents.update_one({"id": agent["id"]}, {"$set": {"quick_replies": []}})
    return {"replies": await qr_library_list(), "me": agent["id"]}


@api_router.post("/cs/agent/quick-replies", status_code=201)
async def cs_agent_qr_create(data: QRLibraryInput, agent: dict = Depends(require_agent)):
    """坐席在工作台添加话术（进入共享话术库，记录创建人）"""
    doc = {"id": str(uuid.uuid4()), **qr_clean(data), "created_by": agent["id"], "created_by_name": agent.get("name", ""), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.cs_quick_replies.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/cs/agent/quick-replies/{qr_id}")
async def cs_agent_qr_update(qr_id: str, data: QRLibraryInput, agent: dict = Depends(require_agent)):
    """坐席可修改话术库任意话术（含后台配置的），记录最后修改人"""
    res = await db.cs_quick_replies.update_one({"id": qr_id}, {"$set": {**qr_clean(data), "updated_by_name": agent.get("name", ""), "updated_at": datetime.now(timezone.utc).isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="话术不存在")
    return {"ok": True}


@api_router.delete("/cs/agent/quick-replies/{qr_id}")
async def cs_agent_qr_delete(qr_id: str, _: dict = Depends(require_agent)):
    """坐席可删除话术库任意话术（含后台配置的）"""
    res = await db.cs_quick_replies.delete_one({"id": qr_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="话术不存在")
    return {"ok": True}


# ---------- 后台查看坐席聊天记录 ----------
@api_router.get("/admin/cs/sessions")
async def admin_cs_sessions(agent_id: str = "", start: str = "", end: str = "", q: str = "", page: int = 1, size: int = 30, _: str = Depends(require_admin)):
    """按坐席 / 日期（北京时间）/ 关键词（地区、IP、最后消息）分页列出会话"""
    size = max(1, min(size, 100))
    cond: dict = {}
    if agent_id:
        cond["agent_id"] = agent_id
    s_day, e_day = parse_cn_date(start), parse_cn_date(end)
    if s_day or e_day:
        rng = {}
        if s_day:
            rng["$gte"] = datetime.combine(s_day, time.min, tzinfo=CN_TZ).astimezone(timezone.utc).isoformat()
        if e_day:
            rng["$lt"] = datetime.combine(e_day + timedelta(days=1), time.min, tzinfo=CN_TZ).astimezone(timezone.utc).isoformat()
        cond["last_message_at"] = rng
    if q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        cond["$or"] = [{"region": rx}, {"ip": rx}, {"last_message": rx}, {"source": rx}]
    total = await db.cs_sessions.count_documents(cond)
    rows = await db.cs_sessions.find(cond, {"_id": 0, "last_activity_dt": 0}).sort("last_message_at", -1).skip((page - 1) * size).to_list(size)
    agents = {a["id"]: a for a in await db.cs_agents.find({}, {"_id": 0, "id": 1, "name": 1, "avatar": 1}).to_list(300)}
    ids = [r["id"] for r in rows]
    counts = {c["_id"]: c for c in await db.cs_messages.aggregate([
        {"$match": {"session_id": {"$in": ids}}},
        {"$group": {"_id": "$session_id", "total": {"$sum": 1}, "visitor": {"$sum": {"$cond": [{"$eq": ["$sender", "visitor"]}, 1, 0]}}}},
    ]).to_list(len(ids) or 1)}
    for r in rows:
        a = agents.get(r.get("agent_id"), {})
        r["agent_name"], r["agent_avatar"] = a.get("name", "（已删除坐席）"), a.get("avatar", "")
        c = counts.get(r["id"], {})
        r["msg_total"], r["msg_visitor"] = c.get("total", 0), c.get("visitor", 0)
    return {"sessions": rows, "total": total, "page": page, "size": size}


@api_router.get("/admin/cs/sessions/{session_id}/messages")
async def admin_cs_session_messages(session_id: str, _: str = Depends(require_admin)):
    sess = await db.cs_sessions.find_one({"id": session_id}, {"_id": 0, "last_activity_dt": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在")
    msgs = await db.cs_messages.find({"session_id": session_id}, {"_id": 0, "created_at_dt": 0}).sort("created_at", 1).to_list(2000)
    agent = await db.cs_agents.find_one({"id": sess.get("agent_id")})
    return {"session": sess, "agent": agent_public(agent) if agent else None, "messages": msgs}


@api_router.get("/admin/cs/status-log")
async def admin_cs_status_log(days: int = 7, start: str = "", end: str = "", agent_id: str = "", _: str = Depends(require_admin)):
    agents = await db.cs_agents.find({}, {"_id": 0, "password_hash": 0}).to_list(300)
    for a in agents:
        await agent_auto_offline_if_stale(a)
    return {"days": await build_status_report(days, agent_id=agent_id, start=start, end=end), "online_now": [agent_public(a) for a in agents if agent_is_online(a)]}


@api_router.get("/admin/cs/stats")
async def admin_cs_stats(days: int = 30, _: str = Depends(require_admin)):
    days = max(1, min(days, 365))
    start = (datetime.now(CN_TZ) - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    start_iso = f"{start}T00:00:00"
    agents = await db.cs_agents.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(200)
    sess_rows = await db.cs_sessions.aggregate([
        {"$match": {"created_at": {"$gte": start_iso}}},
        {"$group": {"_id": "$agent_id", "sessions": {"$sum": 1}}},
    ]).to_list(300)
    sess_map = {r["_id"]: r["sessions"] for r in sess_rows}
    msg_rows = await db.cs_messages.aggregate([
        {"$match": {"sender": "agent", "created_at": {"$gte": start_iso}}},
        {"$group": {"_id": "$agent_id", "replies": {"$sum": 1}}},
    ]).to_list(300)
    msg_map = {r["_id"]: r["replies"] for r in msg_rows}
    out = [{
        "id": a["id"], "name": a.get("name", ""), "avatar": a.get("avatar", ""),
        "enabled": a.get("enabled", True), "weight": a.get("weight", 1), "online": agent_is_online(a),
        "sessions": sess_map.get(a["id"], 0), "replies": msg_map.get(a["id"], 0),
    } for a in agents]
    out.sort(key=lambda x: x["sessions"], reverse=True)
    return {"days": days, "agents": out, "total_sessions": sum(sess_map.values())}


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
