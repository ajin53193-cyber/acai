import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
import asyncio
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


class ContactInfo(BaseModel):
    hotline: str = "400-888-6888"
    wechat: str = "heyingkefu"
    hours: str = "9:00 - 21:00"
    email: str = "contact@heying.com"


class TeamMember(BaseModel):
    role: str = Field(min_length=1, max_length=30)
    person: str = Field(min_length=1, max_length=30)
    image: str = ""


class SiteSettings(BaseModel):
    contact: ContactInfo = ContactInfo()
    team: List[TeamMember] = Field(default_factory=list)


PROJECTS_SEED = [
    {
        "title": "绿源光伏社区电站",
        "category": "绿色能源",
        "status": "对接中",
        "investment": "50-200万",
        "region": "华东大区",
        "description": "分布式光伏电站社区共建项目，与国家电网并网合作，收益稳定，适合长期持有。",
        "highlights": ["并网收益保障", "20年长期回报", "专业运维团队"],
        "image": "https://images.unsplash.com/photo-1509391366360-2e959784a276?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "title": "智链AI数据服务平台",
        "category": "科技创新",
        "status": "资金筹备",
        "investment": "100-500万",
        "region": "深圳",
        "description": "面向中小企业的AI数据标注与模型训练服务平台，已签约多家头部客户。",
        "highlights": ["头部客户背书", "技术团队成熟", "现金流稳定"],
        "image": "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "title": "云仓优选社区团购",
        "category": "商业渠道",
        "status": "招募团长",
        "investment": "5-20万",
        "region": "全国",
        "description": "供应链直供社区团购项目，开放城市团长席位，提供选品、物流、系统全扶持。",
        "highlights": ["零库存模式", "总部全程扶持", "高频刚需品类"],
        "image": "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "title": "沃野生态农业基地",
        "category": "实体产业",
        "status": "对接中",
        "investment": "30-100万",
        "region": "西南大区",
        "description": "千亩生态果蔬种植基地，订单农业模式，与连锁商超签订长期供货协议。",
        "highlights": ["订单农业保障", "绿色认证资质", "基地实地考察"],
        "image": "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "title": "峰行新能源充电桩",
        "category": "绿色能源",
        "status": "资金筹备",
        "investment": "80-300万",
        "region": "珠三角",
        "description": "城市快充桩网络建设项目，政府补贴支持，点位资源已锁定核心商圈。",
        "highlights": ["政策补贴支持", "核心商圈点位", "智能运营系统"],
        "image": "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "title": "星链跨境电商孵化",
        "category": "商业渠道",
        "status": "招募团长",
        "investment": "10-50万",
        "region": "全国",
        "description": "跨境电商供应链孵化项目，提供海外仓、物流、运营一站式解决方案。",
        "highlights": ["海外仓资源", "一站式孵化", "成熟供应链"],
        "image": "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "title": "慧眼智能安防系统",
        "category": "科技创新",
        "status": "对接中",
        "investment": "60-200万",
        "region": "京津冀",
        "description": "AI视觉安防整体解决方案，覆盖园区、社区、商超场景，渠道合伙人招募中。",
        "highlights": ["自研AI算法", "多场景落地", "渠道分成模式"],
        "image": "https://images.unsplash.com/photo-1555255707-c07966088b7b?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "title": "康年大健康连锁",
        "category": "实体产业",
        "status": "资金筹备",
        "investment": "100-800万",
        "region": "长三角",
        "description": "社区健康管理连锁品牌，标准化门店模型已验证，开放区域合伙与单店合作。",
        "highlights": ["标准化门店模型", "区域保护政策", "银发经济赛道"],
        "image": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
    {
        "title": "牧歌冷链物流网络",
        "category": "实体产业",
        "status": "对接中",
        "investment": "150-600万",
        "region": "华中大区",
        "description": "生鲜冷链城配网络，已签约多家生鲜电商与连锁餐饮，干线+城配一体化运营。",
        "highlights": ["长期客户合约", "资产收益清晰", "行业高速增长"],
        "image": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    },
]


@app.on_event("startup")
async def startup():
    try:
        await asyncio.to_thread(init_storage)
    except Exception as e:
        print(f"Storage init failed: {e}")
    await db.users.create_index("username", unique=True)
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


@api_router.get("/")
async def root():
    return {"message": "合赢项目社 API"}


@api_router.get("/projects")
async def list_projects(category: Optional[str] = None):
    query = {"published": {"$ne": False}}
    if category and category != "全部":
        query["category"] = category
    projects = await db.projects.find(query, {"_id": 0}).to_list(100)
    return {"projects": projects}


@api_router.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"key": "site"}, {"_id": 0, "key": 0})
    if not doc:
        return {"contact": ContactInfo().model_dump(), "team": []}
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


@api_router.delete("/admin/projects/{project_id}")
async def delete_project(project_id: str, _: str = Depends(require_admin)):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"message": "项目已删除"}


@api_router.put("/admin/settings")
async def update_settings(data: SiteSettings, _: str = Depends(require_admin)):
    await db.settings.update_one(
        {"key": "site"},
        {"$set": {**data.model_dump(), "key": "site"}},
        upsert=True,
    )
    return {"message": "设置已保存"}


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@api_router.post("/admin/upload", status_code=201)
async def admin_upload(file: UploadFile = File(...), _: str = Depends(require_admin)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="仅支持 JPG / PNG / WEBP / GIF 图片")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过 5MB")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "png"
    path = f"{APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
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


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="文件不存在")
    data, content_type = await asyncio.to_thread(get_object, path)
    return Response(content=data, media_type=record.get("content_type", content_type))


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
