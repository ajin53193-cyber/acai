#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
写入「推广图文」：合赢项目社 · 平台介绍（独立分享页 /p/about）。
用法：
  cd /www/wwwroot/heying && backend/.venv/bin/python deploy/baota/seed_promo_about.py
幂等：按固定 slug=about 做 upsert，可重复执行。
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


def H(t):    return {"type": "heading", "text": t, "image": "", "link": ""}
def T(t):    return {"type": "text", "text": t, "image": "", "link": ""}
def I(u, c=""): return {"type": "image", "text": c, "image": u, "link": ""}
def B(t, u): return {"type": "button", "text": t, "image": "", "link": u}


S = "https://static.prod-images.emergentagent.com/jobs/dd977e8b-1776-4e0e-b7ca-f75b73af51cb/images"
COVER = f"{S}/1c34e2083c19d104c46c883d38581d772b51abce0e03f2577e76ac08103b0b04.jpeg"   # 品牌横幅A
IMG_SECTORS = f"{S}/367d19930c81986ed0cceaa08c4a470cac2ef4c3ce280e9e99a04784ecb8340d.jpeg"  # 多元赛道
IMG_RECRUIT = f"https://customer-assets-v7afamib.emergentagent.net/job_corporate-web-95/artifacts/e2456e9f0e29c401_image.webp"  # 团队长招募横幅（用户最新上传）

PROMO = {
    "slug": "about",
    "title": "合赢项目社 · 平台介绍",
    "subtitle": "聚力项目，合作共赢 · 四重体系把关 · 平台 0 费用 · 正规合规",
    "cover": COVER,
    "tool_slugs": ["__hidden__"],  # 不存在的 slug，用于隐藏底部「热门工具」栏
    "published": True,
    "blocks": [
        T("在这个信息爆炸的时代，好项目难找、真假难辨、弯路太多。合赢项目社，就是为解决这个问题而生——一个专注筛选与对接「可靠项目资源」的社区，帮你减少信息差、少踩坑、抓住经得起验证的机会。"),

        H("四重专业体系 · 层层把关"),
        T("专业审核 → 综合评估 → 多维整合 → 持续跟踪。\n每个进入社区的项目都经过严格筛选，只交付靠谱、合规、可持续的机会。不碰高风险，不玩虚的。"),

        H("四大核心服务"),
        T("① 合赢项目收录：优质项目方案投稿至社区，经专业评估正式录用后，激励奖金最高 18.8 万。\n\n② 合赢供需对接：有资源、找项目？统一收集、评估、整合，高效对接、精准匹配，减少信息差。\n\n③ 合赢项目分享：持续更新经筛选的优质项目资讯，官方群同步，成员第一时间掌握一手机会。\n\n④ 招募团队长·合作共赢：平台提供多层筛选过的项目资源，资源互通、全程扶持，带你和团队一起把盘子做大。"),

        H("多元赛道 · 优质项目（持续更新）"),
        I(IMG_SECTORS, "科技 · 商业 · 实体 · 能源 多元赛道"),
        T("🔬 科技创新：智链AI数据服务平台、慧眼智能安防系统\n🛒 商业渠道：云仓优选社区团购、星链跨境电商孵化、礼品卡合作项目\n🏭 实体产业：沃野生态农业基地、康年大健康连锁、牧歌冷链物流网络\n🌱 绿色能源：绿源光伏社区电站、峰行新能源充电桩\n\n覆盖全国及各大区，科技、商业、实体、能源一网打尽。"),

        H("为什么选择合赢"),
        T("· 平台不收取任何费用 —— 不赚你的钱，只帮你对接好项目\n· 正规合规项目 —— 合规运营，透明可查\n· 稳定可持续 —— 只做长期能做的事，拒绝割韭菜\n· 全程扶持 —— 选品、物流、系统、运营一站式对接支持"),

        H("招募团队长 · 合作共赢"),
        I(IMG_RECRUIT, "资源互通 · 多层筛选 · 合作共赢"),
        T("有人脉、有资源、想带团队一起干的伙伴，欢迎成为合赢团队长。平台提供经多层筛选的项目资源与全程扶持，资源互通、合作共赢。"),

        H("汇聚多方项目，提供可靠项目资源"),
        T("合赢团队，期待与各位伙伴携手同行，共创未来！\n\n官方网站：www.合赢项目社.com\n对接 / 投稿 / 合作，请联系官方负责人。"),

        B("浏览全部项目", "/"),

        H("温馨提示"),
        T("项目信息仅供参考，请理性评估、自行判断；平台不收费、不承诺收益；只认官方客服，谨防假冒与私下转账。"),
    ],
}


def main():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    now = datetime.now(timezone.utc).isoformat()
    existing = db.promos.find_one({"slug": PROMO["slug"]})
    if existing:
        db.promos.update_one({"slug": PROMO["slug"]}, {"$set": {**PROMO, "updated_at": now}})
        action = "更新"
    else:
        db.promos.insert_one({"id": str(uuid.uuid4()), **PROMO, "views": 0, "created_at": now, "updated_at": now})
        action = "新增"
    client.close()
    print(f"[{action}] {PROMO['title']}  (slug={PROMO['slug']}, {len(PROMO['blocks'])} 区块)  ->  /p/{PROMO['slug']}")
    print("完成。")


if __name__ == "__main__":
    main()
