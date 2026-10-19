#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
写入「推广图文」：成为代理 · 躺赚两级佣金（闲礼会馆分佣招募）。
用法：
  cd /www/wwwroot/heying && backend/.venv/bin/python deploy/baota/seed_promo_agent.py
幂等：按固定 slug=agent-recruit 做 upsert，可重复执行（刷新内容、保留浏览计数）。
分享链接：/p/agent-recruit
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
def B(t, u): return {"type": "button", "text": t, "image": "", "link": u}


COVER = "https://static.prod-images.emergentagent.com/jobs/dd977e8b-1776-4e0e-b7ca-f75b73af51cb/images/fd96475bc92df75003a983086e4a443ce859e8506bb09fc1e571a77f9e6fcf76.jpeg"
SELL_URL = "https://lzmur.com/?ref=LD4QSU"     # 闲礼会馆（含专属邀请码）
GIFTCARD_URL = "/p/giftcard-project"            # 站内：搬砖教程

PROMO = {
    "slug": "agent-recruit",
    "title": "成为代理 · 躺赚两级佣金",
    "subtitle": "分享即赚 · 一级 0.7% · 二级 0.3% · 零成本躺赚被动收入",
    "cover": COVER,
    "tool_slugs": ["okx-guide", "binance"],
    "published": True,
    "blocks": [
        T("把好项目分享出去，你就能持续躺赚。只要好友通过你的专属邀请码在「闲礼会馆」注册并核销礼品卡，你就能长期获得两级佣金分成。不囤货、不压资金、零成本躺赚被动收入。"),

        H("一、佣金机制"),
        T("· 一级佣金 0.7%：你直接邀请的好友，每核销一笔，你得核销金额的 0.7%\n· 二级佣金 0.3%：好友再邀请来的人核销，你得 0.3%\n佣金由平台自动结算，长期有效。"),

        H("二、收益举例"),
        T("按核销金额计算：\n· 好友核销 10,000 → 你得一级佣金 70\n· 好友核销 100,000 → 你得一级佣金 700\n· 若团队（含二级）月核销 100 万 → 一级 + 二级佣金相当可观\n邀请越多、团队越大，被动收入越稳定。"),

        H("三、为什么值得做"),
        T("· 零成本：不囤卡、不压资金，只需分享邀请码；\n· 躺赚：好友持续核销，你持续拿佣金，睡后收入；\n· 稳定：依托正规核销平台，佣金自动结算；\n· 可裂变：发展二级团队，收入可指数级增长。"),

        H("四、三步成为代理"),

        H("第一步 · 注册并获取专属邀请码"),
        T("通过下方「立即注册成为代理」按钮注册闲礼会馆，登录后在「我的 / 我的回收」里找到你的专属邀请码与推广链接。"),

        H("第二步 · 分享给好友"),
        T("把邀请码 / 推广链接分享给有需求的朋友，提醒他们务必通过你的链接注册（邀请码会自动带入），才能绑定上下级关系。"),

        H("第三步 · 坐等佣金到账"),
        T("好友每完成一笔核销，你即可获得对应比例的佣金，平台自动结算，可随时提现。"),

        H("⚠️ 温馨提示"),
        T("· 佣金比例与结算规则以平台实时政策为准；\n· 必须让好友通过你的专属链接 / 邀请码注册，否则无法绑定上下级；\n· 合赢项目社不收取任何费用，与你共享平台返佣。"),

        B("立即注册成为代理（含邀请码）", SELL_URL),
        B("先看《礼品卡搬砖教程》", GIFTCARD_URL),
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
    print(f"[{action}] {PROMO['title']}  (slug={PROMO['slug']}, {len(PROMO['blocks'])} 区块)  ->  分享链接 /p/{PROMO['slug']}")
    print("完成。")


if __name__ == "__main__":
    main()
