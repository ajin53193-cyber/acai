#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
写入「推广图文」：USDT 充值教程（TRC20 通用版）。
用法：
  cd /www/wwwroot/heying && backend/.venv/bin/python deploy/baota/seed_promo_recharge.py
幂等：按固定 slug=usdt-recharge 做 upsert，可重复执行（刷新内容、保留浏览计数）。
分享链接：/p/usdt-recharge
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


COVER = "https://static.prod-images.emergentagent.com/jobs/dd977e8b-1776-4e0e-b7ca-f75b73af51cb/images/fb7def63cd8f296112d0067c0e6bc42578c45f7023981aa121fdf89edf87739d.jpeg"
RECHARGE_URL = "https://print8.8bc8uyz.com/pay/usdt/d91e4a49-5980-48d3-81b5-9af134f01496"

PROMO = {
    "slug": "usdt-recharge",
    "title": "USDT 充值教程",
    "subtitle": "新手也能看懂 · 全程 TRC20 网络 · 最快 3 分钟到账",
    "cover": COVER,
    "tool_slugs": ["okx-guide", "binance"],  # 底部展示：去哪买 USDT
    "published": True,
    "blocks": [
        T("本教程面向首次使用 USDT（泰达币）充值的用户，手把手教你完成充值全流程。全程使用 TRC20（波场 Tron）网络，手续费低、到账快。按步骤操作即可，无需任何专业知识。"),

        H("准备工作"),
        T("① 一个加密货币交易所账户（如 欧易 OKX、币安 Binance），并已完成实名认证；\n② 账户里有足够的 USDT 余额——若没有，可先在交易所用人民币通过 C2C 买入 USDT（买币教程见本页底部工具）；\n③ 本次充值的「收款地址（TRC20）」与「需支付的 USDT 数量」——提交充值后会在订单页自动生成。"),

        H("第一步 · 打开充值订单，获取收款地址"),
        T("在充值页面选择「USDT 充值」并提交，系统会生成一个专属订单页，上面包含三个关键信息：\n· 收款地址：一串以 T 开头的字母数字（TRC20 地址）\n· 充值金额：需支付的 USDT 精确数量（例如 100.00 USDT）\n· 收款二维码 与 订单有效期（倒计时）\n请停留在该页面，不要关闭，接下来会用到这些信息。"),

        H("第二步 · 复制收款地址与金额"),
        T("点击订单页的「复制」按钮，分别复制「收款地址」和「充值金额」。\n⚠️ 务必保证转账金额与订单完全一致，多转或少转都可能导致系统无法自动到账。"),

        H("第三步 · 从交易所提币（转账）"),
        T("以 欧易 OKX / 币安 Binance 为例：\n① 打开交易所 APP，进入【资产 / 钱包】→【提币 / 提现】；\n② 币种选择 USDT；\n③ 提币网络务必选择 TRC20（Tron / 波场）——这一步最关键，选错网络资产会丢失！\n④ 将刚才复制的「收款地址」粘贴到提币地址栏（也可直接扫描订单页二维码）；\n⑤ 输入与订单完全一致的 USDT 数量；\n⑥ 核对无误后点击确认，输入资金密码 / 谷歌验证码完成提币。"),

        H("第四步 · 等待到账"),
        T("提交提币后，区块链会进行确认。TRC20 网络通常 1–3 分钟即可到账。到账后订单页会自动显示「充值成功」，无需重复操作。期间请保持订单页开启。"),

        H("⚠️ 重要注意事项"),
        T("1. 网络只能选 TRC20：切勿使用 ERC20、BEP20 等其它网络，否则资金可能无法到账甚至永久丢失。\n2. 金额必须精确一致：严格按订单显示的数量转账，避免因金额不符导致延迟或失败。\n3. 地址仔细核对：转账前再次核对收款地址首尾几位是否与订单一致。\n4. 注意订单有效期：请在倒计时结束前完成转账，超时请重新下单获取新地址。\n5. 切勿重复支付：一个订单只需转账一次，提交成功后耐心等待到账即可。"),

        H("常见问题"),
        T("· 没有 USDT 怎么办？ 可在 欧易 OKX / 币安 通过 C2C（法币交易）用支付宝 / 微信 / 银行卡买入 USDT，详细买币教程见本页底部工具。\n· 转错网络了怎么办？ 请第一时间联系交易所客服尝试找回，但不保证能追回，务必提前核对网络。\n· 很久没到账？ 可在交易所「提币记录」里查看区块链状态（哈希 / TXID）；若显示已确认但订单未更新，请联系客服并提供 TXID。"),

        B("前往充值页面", RECHARGE_URL),
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
