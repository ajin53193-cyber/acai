#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
写入「推广图文」：新地礼品卡搬砖项目（85折买卡 → 9折核销，赚差价 + 代理佣金）。
用法：
  cd /www/wwwroot/heying && backend/.venv/bin/python deploy/baota/seed_promo_giftcard.py
幂等：按固定 slug=giftcard-project 做 upsert，可重复执行（刷新内容、保留浏览计数）。
分享链接：/p/giftcard-project
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


COVER = "https://static.prod-images.emergentagent.com/jobs/dd977e8b-1776-4e0e-b7ca-f75b73af51cb/images/2a81bab66828d74a278f32c8626d267ef10a6320fdd37e9795c405d43b030641.jpeg"
BUY_URL = "https://www.gogo589.com"            # 买卡平台
SELL_URL = "https://lzmur.com/?ref=LD4QSU"     # 闲礼会馆（核销平台，含专属邀请码）
INVITE_CODE = "LD4QSU"

PROMO = {
    "slug": "giftcard-project",
    "title": "新地礼品卡搬砖项目 ｜ 零风险稳定赚差价",
    "subtitle": "85折买卡 · 9折核销 · 稳赚 5% 差价 · 平台 0 费用 · 邀请好友再赚佣金",
    "cover": COVER,
    "tool_slugs": ["okx-guide", "binance"],  # 需要 USDT，底部展示买币教程
    "published": True,
    "blocks": [
        T("这是一个低买高卖的礼品卡「搬砖」项目：在买卡平台用 85 折买入「新地商场礼品卡」，再到闲礼会馆以 9 折核销，稳赚中间 5% 的差价。全程不碰行情、不押币价方向，当天买、当天核销，是真正的零风险稳定项目。合赢项目社不收取你任何费用。"),

        H("一、项目收益一目了然"),
        T("· 买入折扣：85 折（面值 × 85%）\n· 核销折扣：9 折（面值 × 90%）\n· 你的净收益：面值 × 5%\n收益来源清晰、固定，不受币价涨跌影响。买得越多、周转越快，收益越高。"),

        H("二、买一张 8000 的卡能赚多少 USDT？"),
        T("以一张面值 8,000 港币（HKD）的新地礼品卡为例（汇率按 1 USDT ≈ 7.8 HKD 估算，实际以平台实时汇率为准）：\n· 买卡成本：8000 × 85% = 6,800 港币 ≈ 872 USDT\n· 核销到账：8000 × 90% = 7,200 港币 ≈ 923 USDT\n· 净赚差价：400 港币 ≈ 约 51 USDT\n也就是说，买一张 8,000 的卡，当天即可净赚约 51 USDT。"),

        H("三、准备工作"),
        T("① 一个买卡平台账号（gogo589 环球充值 www.gogo589.com）；\n② 一个闲礼会馆（核销平台）账号——注册时务必填写我们的专属邀请码；\n③ 用于支付的 USDT——没有 USDT？点下方按钮查看充值教程，或参考本页底部的「欧易 / 币安」买币教程。"),
        B("不会充值 USDT？查看充值教程", "/p/usdt-recharge"),

        H("四、操作流程"),

        H("第一步 · 在买卡平台 85 折买新地礼品卡"),
        T("打开买卡平台 www.gogo589.com，注册登录 → 搜索「新地商场礼品卡 (HKD)」→ 选择面值（如 8000）→ 以 85 折价格下单，用 USDT 支付 → 支付成功后获得卡号 / 卡密，请立即截图保存。"),

        H("第二步 · 用我们的邀请码注册闲礼会馆"),
        T(f"点击下方「注册闲礼会馆（含邀请码）」按钮，通过专属链接注册，邀请码 {INVITE_CODE} 会自动带入，完成注册即可。务必通过此链接注册，后续才能享受佣金分成与专属客服保障。"),

        H("第三步 · 9 折核销，USDT 到账"),
        T("登录闲礼会馆 → 进入「卡券回收」→ 选择对应的外区 / 新地礼品卡卡种 → 粘贴卡号 / 卡密提交核销 → 系统按 9 折回收。可在「卡券订单」查看「核销中 / 待到账 / 已结算」状态，结算后即可提现 USDT。"),

        H("五、邀请好友，躺赚佣金"),
        T("你还可以把专属邀请码分享给朋友，发展自己的团队，长期躺赚佣金（平台二级代理分佣）：\n· 一级佣金 0.7%：你直接邀请的好友每核销一笔，你得核销金额的 0.7%\n· 二级佣金 0.3%：好友再邀请来的人核销，你得 0.3%\n举例：你直接邀请的好友核销了 10,000 面值的卡，你即可获得 70 的一级佣金。邀请越多、团队越大，被动收入越稳定。"),

        H("六、为什么说零风险、稳定？"),
        T("· 差价固定：买 85 折、卖 9 折，利润锁定在 5%，不赌币价涨跌；\n· 当天结算：买入即可核销，资金周转快；\n· 平台 0 费用：合赢项目社不收你任何服务费，只赚平台返给我们的代理佣金，你我利益一致；\n· 流程透明：买卡平台覆盖 500+ 正版 APP 充值，核销平台专业回收，订单状态随时可查。"),

        H("⚠️ 温馨提示"),
        T("· 折扣与汇率会随市场小幅浮动，实际收益以平台下单 / 核销时的实时价格为准；\n· 首次操作建议先小额跑通整个流程，确认到账无误后再加大投入；\n· 全程保存卡号 / 卡密与订单截图，便于核对与售后；\n· 务必通过本页邀请码注册闲礼会馆，否则无法享受佣金与专属客服。"),

        B("① 前往买卡平台（gogo589）", BUY_URL),
        B("② 注册闲礼会馆（含邀请码）", SELL_URL),
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
