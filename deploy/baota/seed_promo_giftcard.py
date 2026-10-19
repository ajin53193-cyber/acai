#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
写入「推广图文」：新地礼品卡搬砖项目（gogo589 85折买卡 → 闲礼会馆 9折核销）。
含 12 张真实流程截图 + 两级代理佣金说明。
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
AGENT_URL = "/p/agent-recruit"                  # 站内：成为代理教程
RECHARGE_URL = "/p/usdt-recharge"               # 站内：USDT 充值教程

# 真实流程截图（公开地址）
A = "https://customer-assets-v7afamib.emergentagent.net/job_corporate-web-95/artifacts"
IMG_GOODS   = f"{A}/cee7cf3de6f53ce2_telegram-cloud-photo-size-1-5093647367440895363-w.webp"  # gogo589 商品页
IMG_CART    = f"{A}/d225729e98ba4a46_telegram-cloud-photo-size-1-5093647367440895364-w.webp"  # gogo589 购物车付款
IMG_ORDER   = f"{A}/0dc4dc6e924272d1_telegram-cloud-photo-size-1-5093647367440895365-w.webp"  # gogo589 订单待填 AlipayHK
IMG_SEL     = f"{A}/ea184a524966eab3_telegram-cloud-photo-size-1-5093647367440895366-w.webp"  # 闲礼会馆 选面值
IMG_SEL1000 = f"{A}/fa37a4c91c419740_telegram-cloud-photo-size-1-5093647367440895367-w.webp"  # 闲礼会馆 已选1000
IMG_ACCT    = f"{A}/7a81276b65747bae_telegram-cloud-photo-size-1-5093647367440895368-w.webp"  # 闲礼会馆 转赠账户+交易号框
IMG_FILL    = f"{A}/deceb778f9bf0573_telegram-cloud-photo-size-1-5093647367440895369-w.webp"  # gogo589 填入65159201
IMG_CONFIRM = f"{A}/5f06d63903de1ce4_telegram-cloud-photo-size-1-5093647367440895370-w.webp"  # gogo589 核对弹窗
IMG_SENDING = f"{A}/55045ee4c747baec_telegram-cloud-photo-size-1-5093647367440895371-w.webp"  # gogo589 系统转赠中
IMG_SUCCESS = f"{A}/45821f1b2afefc72_telegram-cloud-photo-size-1-5093647367440895372-w.webp"  # 转赠成功弹窗
IMG_TXN     = f"{A}/8a19ce91e79d5f88_telegram-cloud-photo-size-1-5093647367440895373-w.webp"  # gogo589 已完成·交易号
IMG_REDEEM  = f"{A}/f6a8a83b6d39fd02_telegram-cloud-photo-size-1-5093647367440895374-w.webp"  # 闲礼会馆 提交核销

PROMO = {
    "slug": "giftcard-project",
    "title": "新地礼品卡搬砖项目 ｜ 低买高卖赚价差",
    "subtitle": "gogo589 85折买卡 · 闲礼会馆 9折核销 · 约 5% 价差 · 最快 3 分钟到账 · 全程图文实拍 · 平台 0 费用",
    "cover": COVER,
    "tool_slugs": ["okx-guide", "binance"],
    "published": True,
    "blocks": [
        T("这是一个礼品卡「低买高卖」项目：在买卡平台 gogo589 以 85 折买入「新地商场礼品卡(HKD)」，再到核销平台「闲礼会馆」以 9 折核销，赚取买卖价差。两个平台通过「AlipayHK 转赠账户 + 交易号」自动打通，你无需拥有自己的 AlipayHK 钱包，当天即可完成。合赢项目社不收取你任何费用。"),

        H("真实价格参考（约 5% 价差 · 以平台实时价为准）"),
        T("买入 85 折、核销 9 折，赚取约 5% 的买卖价差，核销最快 3 分钟内完成。以新地商场礼品卡为例：\n· HK$1000：gogo589 买入约 $108.70 USDT；闲礼会馆核销实得 ¥765.06\n· HK$8000：gogo589 买入约 $869.60 USDT；闲礼会馆核销实得 ¥6120.47\n核销实得为人民币，港元卡按实时汇率结算（1 HKD ≈ ¥0.8501 × 9折）。买入用 USDT、核销得人民币，约 5% 价差会随汇率小幅浮动，请以操作当时的实时价格为准。"),

        {"type": "calculator", "text": "", "image": "", "link": ""},

        H("准备工作"),
        T("① 买卡平台 gogo589 账号（www.gogo589.com），钱包里备好 USDT；\n② 核销平台「闲礼会馆」账号——请通过本页专属邀请码注册；\n③ 无需自己的 AlipayHK！转赠账户由闲礼会馆提供，你照着填即可。"),
        B("不会充值 USDT？查看充值教程", RECHARGE_URL),

        H("第一步 · 在闲礼会馆选卡种与面值，获取转赠账户"),
        T("打开闲礼会馆，进入「卡券回收」→ 选择卡种「新地(DQ)礼品卡」→ 选择要操作的面值（如 HK$1000），页面会显示实得人民币。"),
        I(IMG_SEL, "① 选择卡种与面值（全部 9 折）"),
        I(IMG_SEL1000, "② 选中 HK$1000，实得 ¥765.06"),
        T("点击「获取转赠账户」，页面会给出一个 AlipayHK 转赠账户（示例 65159201），并出现「填写转账交易号」输入框。请记下这个转赠账户，下一步要用。"),
        I(IMG_ACCT, "③ 获取 AlipayHK 转赠账户（示例 65159201）"),
        T("⚠️ 注意：截图中的转赠账户 65159201 仅为示例。每次操作闲礼会馆都会生成对应的转赠账户，请务必以你当时页面实际显示的账户为准，切勿照抄本文截图里的号码。"),

        H("第二步 · 在 gogo589 以 85 折买同面值新地礼品卡"),
        T("打开 gogo589（www.gogo589.com）→ 找到「新地商场礼品卡(HKD)」→ 选择与上一步相同的面值（如 1000HKD 85折，每账号每日限购 12 份）→ 立即购买。"),
        I(IMG_GOODS, "① 选择 1000HKD 85折"),
        T("在购物车确认金额（1000HKD 卡约 $108.70），用「钱包余额（USDT）」付款，勾选同意条款后点「立即支付」。"),
        I(IMG_CART, "② 钱包余额付款，立即支付 $108.70"),

        H("第三步 · 订单「AlipayHK 帐号」填入闲礼会馆的转赠账户"),
        T("付款后进入「我的订单」→ 订单详情显示「等待中」→ 在「请填写充值数据」里，把 AlipayHK 帐号填成第一步闲礼会馆给你的转赠账户（示例 65159201）。⚠️ 提交后无法修改，务必核对一致。"),
        I(IMG_ORDER, "① 订单待填写充值数据"),
        I(IMG_FILL, "② 填入转赠账户 65159201，提交"),
        I(IMG_CONFIRM, "③ 核对无误，确认提交"),

        H("第四步 · 等待系统转赠，获取交易号"),
        T("提交后订单进入「充值中」，系统自动转赠（约 1-2 分钟），请勿关闭页面。完成后弹出「转赠成功」，订单变为「已完成」，并显示一串 28-36 位「交易号」，点「拷贝」复制它。"),
        I(IMG_SENDING, "① 系统转赠中，请耐心等待"),
        I(IMG_SUCCESS, "② 转赠成功，礼品卡已转入该 AlipayHK 账户"),
        I(IMG_TXN, "③ 订单已完成，复制「交易号」"),

        H("第五步 · 回闲礼会馆填交易号，提交核销"),
        T("回到闲礼会馆第一步的页面，把刚复制的「交易号」粘贴到「填写转账交易号」框，点「提交核销」。平台审核通过后，按 9 折结算人民币到账（HK$1000 → ¥765.06）。可在「卡券订单」查看 核销中 / 待到账 / 已结算 状态。"),
        I(IMG_REDEEM, "① 粘贴交易号，提交核销"),

        H("邀请好友，躺赚两级佣金"),
        T("把你的专属邀请码分享给朋友，长期躺赚平台返佣：\n· 一级佣金 0.7%：你直接邀请的好友每核销一笔，你得核销金额的 0.7%\n· 二级佣金 0.3%：好友再邀请来的人核销，你得 0.3%\n举例：直接邀请的好友核销了 10,000，你即可获得 70 的一级佣金。想专门了解代理玩法，见文末「成为代理」教程。"),

        H("⚠️ 温馨提示"),
        T("· gogo589 的充值数据（AlipayHK 转赠账户）提交后无法修改，务必与闲礼会馆给的账户完全一致；\n· 面值要对应：买卡面值、核销面值、转赠金额三者一致，便于顺利到账；\n· 交易号为 28-36 位纯数字、以完成日期(YYYYMMDD)开头，复制时勿漏字符；\n· 折扣与汇率随市场浮动，实际价差以操作当时实时价格为准；\n· 首次操作建议先用小面值（如 HK$200 / 500）跑通全流程，确认到账后再加大；\n· 全程务必通过本页邀请码注册闲礼会馆，否则无法享受佣金与专属客服。"),

        B("① 前往买卡平台 gogo589", BUY_URL),
        B("② 注册闲礼会馆（含邀请码）", SELL_URL),
        B("查看《成为代理躺赚佣金》教程", AGENT_URL),
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
