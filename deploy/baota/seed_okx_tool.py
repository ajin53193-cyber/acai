#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
采集 OKX《新手总攻略（Web端）》并写入「热门工具」。
用法：
  cd /www/wwwroot/heying && backend/.venv/bin/python deploy/baota/seed_okx_tool.py
幂等：按固定 slug=okx-guide 做 upsert，可重复执行（会刷新内容，保留浏览/下载计数）。
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

CDN = "https://www.okx.com/cdn/assets/plugins/announcements/contentful/tofttmniq0qv"

def H(t):   return {"type": "heading", "text": t, "image": "", "link": ""}
def T(t):   return {"type": "text", "text": t, "image": "", "link": ""}
def I(u):   return {"type": "image", "text": "", "image": u, "link": ""}
def B(t, u): return {"type": "button", "text": t, "image": "", "link": u}

BLOCKS = [
    H("一、交易前设置"),
    H("1. 下载 & 注册"),
    T("进入欧易官网，点击下载图标 -【更多客户端】-【下载欧易客户端】，按提示完成安装即可。"),
    I(f"{CDN}/3FKkO523PSkmCtS8iQwnpc/e87a89147a54c9920289fed69650840d/1.png"),
    I(f"{CDN}/5BiAlghbZfJdxWRfBscLZk/6cefc17842abfbd4b0a1fa793d95a016/2.png"),
    T("点击页面上方【注册/登录】-【立即注册】。注册需同时绑定手机号和邮箱：依次输入【邮箱】—【邮箱验证码】—【手机号】—【验证码】—设置【密码】，即可完成注册。"),
    I(f"{CDN}/4zH9ghRIeorvWtF5xuDv02/cbc10151843625edb3e2723b3cf4bd55/3.png"),
    I(f"{CDN}/5aiJ1fKaTCBq6JTzczYnQc/3cf93b89e5882815ddfd6035da1e9fd8/4.png"),

    H("2. 个人信息设置"),
    T("进行买/卖币交易前，需先完成身份认证并绑定收付款方式。"),
    T("【身份认证】注意：身份认证与视频认证需在 App 端进行。1）打开欧易 App，点击首页左上角用户中心图标 — 昵称/账号 —【身份认证】—【立即认证】，上传证件照（身份证正反面）并完成人脸识别。"),
    I(f"{CDN}/3fRP2v1BbHjA4xQ5VCFDxn/f493bdd925cb0a4fece2e55e246fc537/_____1-1.png"),
    I(f"{CDN}/ODZgE5uRoDPqGEsJ3hbxv/9fcb946c69ad407474fc3c75cc54c112/_____2.png"),
    I(f"{CDN}/fXmmVmPEMLPgkDpVGeKUD/eb02cf517e4b05be85d16313a792d842/_____3.png"),
    T("2）视频认证需在【C2C 买币】中进行：App 首页【买币】-【C2C 买币】-【我的】-【视频认证】-【开始录制】。录制时请开启声音、打开摄像头、勿连耳机；系统朗读风险提示时无需跟读，在「嘀」声后回答【是的】，再提交资料等待审核。"),
    I(f"{CDN}/74zEosU1GZZ41W0h6vGC2N/3d2c035edc4bffdd872f72ee532e7cb9/_____1-2.png"),
    I(f"{CDN}/2uDjKVnuWLHRAugYOMujKz/6289c5727e92d875a1920b5d86c3b85c/_____4.png"),
    I(f"{CDN}/2KQvHYyDpKd5iacfm75W5/2464b206989ae190595542322d72a31d/_____5.png"),
    T("以下为不同身份认证等级的充提币限额："),
    I(f"{CDN}/4pFV7solvKvktddgfBDJ5n/52be2af31aad340ac168234b03dd98ee/_____________.png"),
    T("【绑定收付款方式】进入官网【买币】-【C2C 买币】-【个人中心】，在收付款设置中点击【添加支付方式】，可选择银行卡、支付宝、微信，按提示完成绑定。"),
    I(f"{CDN}/7JK0wtBz9ziEG6JMYcdHIh/41eb126cf3fe51f0b84229743426d017/11.png"),
    I(f"{CDN}/45w8qHnJ4RNizUG1uB3iwI/4257466921621d726d755aa7e8f29fd6/12.png"),
    T("注意：如需更换绑定的手机号或邮箱，可在官网右上角个人信息图标 -【安全中心】的验证方式中修改【手机号】/【邮箱】。"),
    I(f"{CDN}/12sDLyDQxHgiWlSxQXAVBt/992bc31c9e6aa2380fe8367c8222f1ba/13.png"),
    I(f"{CDN}/6IKxP9YGwkZAliuBUP8dDA/d432ce3798226599d03ead23576ae176/14.png"),

    H("二、买卖币交易"),
    H("1. 如何快捷买币？"),
    T("1）打开官网 -【买币】-【C2C 买币】-【快捷交易】-【购买】- 选择需要购买的数字资产；"),
    I(f"{CDN}/6JEpbRnT99veUmtso8vvJ6/cafd55276a7a27db557726fa6635eaf4/%E5%A6%82%E4%BD%95%E4%BD%BF%E7%94%A8%E5%BF%AB%E6%8D%B7%E4%B9%B0%E5%B8%81_%E5%8D%96%E5%B8%81_1.png"),
    T("2）确认资产 - 输入【购买金额】- 选择【支付方式】- 点击【购买】；"),
    I(f"{CDN}/28A4FGiQ6uhK2KCzJSVsu5/cf7020cbc39a8ff630c4c9f754497808/%E5%A6%82%E4%BD%95%E4%BD%BF%E7%94%A8%E5%BF%AB%E6%8D%B7%E4%B9%B0%E5%B8%81_%E5%8D%96%E5%B8%81_3.png"),
    I(f"{CDN}/6MSjzEFFYt7OKYZl5hGRmN/3bf13be79026dcb3d311101be4491fce/___________WEB_4.png"),
    T("3）确定【购买详情预览】-【获取付款详情】- 按商家要求的支付方式转账 - 按页面金额付款 -【我已支付】- 确认已转账 - 等商家收到款放币即可。"),
    I(f"{CDN}/5YEIrvZjMFfAKeqBuiLAHr/2d2427f5000006cc892dab5e75d2912d/%E5%A6%82%E4%BD%95%E4%BD%BF%E7%94%A8%E5%BF%AB%E6%8D%B7%E4%B9%B0%E5%B8%81_%E5%8D%96%E5%B8%81_4.png"),

    H("2. 如何快捷卖币？"),
    T("打开官网 -【买币】-【C2C 买币】-【快捷交易】-【出售】- 选择需要出售的数字资产；"),
    I(f"{CDN}/FYg7KEDXMDa9JgfrTulFn/c8fcf8d7c9bd310f4b97d311ba55c75a/%E5%A6%82%E4%BD%95%E4%BD%BF%E7%94%A8%E5%BF%AB%E6%8D%B7%E4%B9%B0%E5%B8%81_%E5%8D%96%E5%B8%81_2.png"),
    T("确认资产 - 输入【出售金额】- 选择【支付方式】-【下一步】- 确定【出售详情预览】-【出售】，成功收到商家付款后点击「确认收款」即可。"),
    I(f"{CDN}/AfNANy6HGx9C1QHbuIO5e/3435ba9d685f8ed1467512808c944bea/___________WEB_8.png"),
    I(f"{CDN}/3lIp5XQ1NuUv2PUFhT3i28/f7799643c8c1a7a1aed2bc05c834126e/___________WEB_9.png"),
    I(f"{CDN}/5pCa9YLHzQdBpZgjAdx38H/79e9efe538e5472c7192c71bb0d53299/%E5%A6%82%E4%BD%95%E4%BD%BF%E7%94%A8%E5%BF%AB%E6%8D%B7%E4%B9%B0%E5%B8%81_%E5%8D%96%E5%B8%81_5.png"),
    T("⚠️ 注意事项：1）务必在银行 App 或微信/支付宝账单中确认是否收到商家付款，切勿凭短信等方式确认；2）务必核实为商家实名付款，如非实名请联系在线客服或申诉；3）未收到款切勿点击放币，可直接申诉或联系客服；4）以订单详情页展示的收付款方式，或 IM 窗口卖家卡片内的收付款方式为准，切勿转错。"),

    H("三、如何进行现货交易？"),
    T("成功购买一笔数字资产（如 USDT）后，资产会进入【资金账户】。若想交易其他数字资产，需进行「资金划转」到【交易账户】。"),
    T("【资金划转】进入官网【资产管理】，选择币种，填写数量 -【确认】，将资产从【资金账户】划转到【交易账户】。"),
    I(f"{CDN}/GQvuJU9X6eg3fPlsRssgL/1dbe6422ce43b260d81294bd91113859/23.png"),
    T("选择【交易】-【现货】，选择想交易的币对。以 USDT 购买其他币种为例：选择限价委托，填入买入价格、数量，点击「买入 XXX」；若想卖出，选择委托方式、填写下单信息后点击「卖出 XXX」。"),
    I(f"{CDN}/6nuz1jFi3Cr3VjWe7Dft93/773a93e7b20acfae5bc83aa764cdf9ca/%C3%A6__%C3%A6__%C3%A5__%C3%A8__web_03.png"),
    I(f"{CDN}/4AapyJmXy1D0CK22G4itD/d8c96523c2072db309e5c3c09581e392/26.png"),
    T("注意：限价委托需自行输入买入/卖出价格，行情符合预期时自动成交，不保证快速成交；若想按当时行情快速成交，可选择市价委托。"),

    H("四、如何查看我的资产？"),
    T("在 Web 端点击页面上方的【资产管理】-【我的资产】，即可查看资金账户、交易账户及金融账户的资产状况。"),

    H("五、如何从其他平台充币到本平台？"),
    T("充币条件：需先完成身份认证，否则无法操作充币，也无法查看充值地址。"),
    T("充币步骤：【资产管理】-【充币】- 选择【充币币种及网络】-【下一步】-【复制地址】，将充币地址复制给对方平台进行提币，达到页面要求的确认数后即可到账。可在充币界面选择充入资金账户/交易账户。"),
    I(f"{CDN}/76omaNkpB4fviXU8hehNIQ/3fd5dcbf2a8bb728f9eeee21f0d29ce9/01.png"),
    I(f"{CDN}/6aSx8ZvpWzAWZ5Kv1IB76X/be60fa4373e85647f3a7166afb4f915e/02.png"),
    T("注意：①部分币种暂不支持币安智能链（BSC）、火币生态链（HECO）充值；②低于最小到账数量会导致无法到账；③到账时间取决于网络确认速度及平台所需确认数；④如要求填写 Memo/Tag 请务必填写，否则无法到账；⑤充币成功后可在资产总览或充币记录页查看。"),

    H("六、更多金融产品"),
    T("在官网首页点击【金融】，可查看丰富功能：赚币（闲置资产增值，支持活期与定期）、借贷（无需卖币即可获取现金流）、Jumpstart（早期参与优质新项目）。"),
    T("风险提示：以上内容仅供参考，不构成任何投资建议。数字资产价格波动大、存在风险，投资需谨慎，请自主判断并做出投资决策。"),
    B("查看 OKX 官方原文教程", "https://www.okx.com/zh-hans/help/novice-general-raiders-web-side"),
]

TOOL = {
    "slug": "okx-guide",
    "name": "欧易 OKX",
    "icon": "https://www.google.com/s2/favicons?domain=okx.com&sz=128",
    "tagline": "全球领先数字资产交易平台 · 新手总攻略（Web 端）",
    "download_link": "https://www.okx.com/zh-hans/download",
    "download_text": "下载欧易 App",
    "blocks": BLOCKS,
    "published": True,
    "sort": 0,
}


def main():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    now = datetime.now(timezone.utc).isoformat()
    existing = db.tools.find_one({"slug": TOOL["slug"]})
    if existing:
        db.tools.update_one({"slug": TOOL["slug"]}, {"$set": {**TOOL, "updated_at": now}})
        print(f"已更新工具: {TOOL['name']} (slug={TOOL['slug']}, {len(BLOCKS)} 个区块)")
    else:
        doc = {"id": str(uuid.uuid4()), **TOOL, "views": 0, "downloads": 0, "created_at": now, "updated_at": now}
        db.tools.insert_one(doc)
        print(f"已新增工具: {TOOL['name']} (slug={TOOL['slug']}, {len(BLOCKS)} 个区块)")
    print(f"访问: /tools/{TOOL['slug']}")
    client.close()


if __name__ == "__main__":
    main()
