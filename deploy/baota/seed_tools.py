#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
采集并写入全部「热门工具」教程（欧易OKX / 快帆 / 币安Binance / 火币HTX）。
用法：
  cd /www/wwwroot/heying && backend/.venv/bin/python deploy/baota/seed_tools.py
幂等：按固定 slug 做 upsert，可重复执行（刷新内容、保留浏览/下载计数）。
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

from seed_okx_tool import TOOL as OKX_TOOL  # 复用已整理的欧易OKX教程

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


def H(t):    return {"type": "heading", "text": t, "image": "", "link": ""}
def T(t):    return {"type": "text", "text": t, "image": "", "link": ""}
def I(u):    return {"type": "image", "text": "", "image": u, "link": ""}
def B(t, u): return {"type": "button", "text": t, "image": "", "link": u}


# ---------------- 快帆回国加速器 ----------------
KF = "https://www.kuaifan666.com/wp-content/uploads/2024"
KUAIFAN = {
    "slug": "kuaifan",
    "name": "快帆回国加速器",
    "icon": "https://www.kuaifan666.com/wp-content/uploads/2024/05/cropped-ic_launcher.png",
    "tagline": "海外华人一键回国加速 · 追剧 / 听歌 / 游戏畅享",
    "download_link": "https://www.kuaifan666.com/dowload/",
    "download_text": "下载快帆",
    "blocks": [
        T("身处海外打开国内热门音乐视频软件，常会看到「您所在的区域暂无此内容版权」而无法观看。使用回国加速器即可获得畅快的网络体验。"),
        I(f"{KF}/08/%E8%85%BE%E8%AE%AF%E8%A7%86%E9%A2%91%E6%82%A8%E6%89%80%E5%9C%A8%E7%9A%84%E5%8C%BA%E5%9F%9F%E6%9A%82%E6%97%A0%E6%AD%A4%E5%86%85%E5%AE%B9%E7%89%88%E6%9D%83.png"),
        H("1. 下载快帆回国加速器"),
        T("进入快帆官网下载并安装快帆回国加速器。"),
        H("2. 设置模式"),
        I(f"{KF}/08/8ae8c20d4fd5003f5819e7a50f31db71.png"),
        I(f"{KF}/08/11c2fbd1e2497bb94509ac3995ac735e.png"),
        T("根据使用场景选择模式：\n· 应用模式：仅需加速的 APP 走回国线路，Facebook/Google 等走本地网络\n· 全局模式：除 Facebook/Google 外，其余 APP 均走代理线路\n· 游戏模式：专注加速游戏，需选择游戏线路"),
        H("3. 选好模式后点击首页「回国」按钮开启加速"),
        I(f"{KF}/08/%E5%BF%AB%E5%B8%86%E5%8A%A0%E9%80%9F%E5%89%8D%E5%90%8E.png"),
        H("4. 启动腾讯视频等 APP 观看喜欢的影视"),
        I(f"{KF}/08/%E5%BF%AB%E5%B8%86%E5%8A%A0%E9%80%9F%E5%99%A8%E5%8A%A0%E9%80%9F%E5%8A%9F%E8%83%BD.png"),
        H("三步解除版权限制"),
        T("① 下载快帆：在你的设备下载并安装快帆。\n② 注册账号：注册快帆账号并领取 1 天 VIP 试用。\n③ 选择线路一键连接：点击连接后重启加速 APP，即可获得无限制网络体验。"),
        T("快帆支持加速：腾讯视频、芒果TV、优酷、爱奇艺、咪咕视频、央视频、哔哩哔哩、QQ音乐、网易云音乐、全民K歌、快手、抖音、小红书等。"),
        B("前往快帆官网下载", "https://www.kuaifan666.com/dowload/"),
    ],
    "published": True,
    "sort": 1,
}

# ---------------- 币安 Binance ----------------
BN = "https://public.bnbstatic.com/static/content/square/images"
BINANCE = {
    "slug": "binance",
    "name": "币安 Binance",
    "icon": "https://www.google.com/s2/favicons?domain=binance.com&sz=128",
    "tagline": "全球交易量第一的加密货币交易所 · 新手详细教程",
    "download_link": "https://www.binance.com/zh-CN/register",
    "download_text": "注册 / 下载币安",
    "blocks": [
        T("币安是全球加密货币交易量排名第一的交易所，适合新手快速上手。本教程涵盖：注册账号、KYC 身份认证、账户安全、入金购买 USDT、币币交易买卖比特币、出金变现。"),
        H("一、如何注册币安"),
        T("1）海外访问时请将 IP 切换到合适地区并使用全局模式；2）手机端打开币安官方注册链接；3）苹果手机建议用原生 Safari 浏览器打开，安卓手机点右上角三个点选「在浏览器中打开」。"),
        I(f"{BN}/fa9bb5796b9641ff976b047b1f6e4a0b.jpg"),
        I(f"{BN}/8b4b4b17f84845e49b61d6a4ecab7bc3.jpg"),
        T("进入注册页后，可点右上角「地球」图标切换为【简体中文】，再点击黄色【立即注册】按钮。"),
        I(f"{BN}/61c7608b364e4e24af38eaa25ab7fa38.jpg"),
        I(f"{BN}/5dd696d2f7484123814855604c40640b.jpg"),
        T("用邮箱或手机号注册（建议邮箱），输入邮箱后点【下一步】，将收到的 6 位验证码填入后继续。"),
        I(f"{BN}/9646b8f419c241d7b8ab0eda8bcb9bbb.jpg"),
        I(f"{BN}/196b11915cd740c7a438554af4b85780.jpg"),
        T("设置密码（至少 8 个字符、含 1 个数字、1 个大写字母），点【下一步】。如有邀请码可填写，提交后完成注册。"),
        I(f"{BN}/2362187b45ca43d29c784e37baff1616.jpg"),
        I(f"{BN}/00c48b92d8404d33b2cd92c12938c485.png"),
        H("二、KYC 身份认证"),
        T("选择居住国家/地区 → 填写国籍、真实姓名与出生日期（须与证件一致）→ 上传身份证正反面 → 完成人脸识别，提交后等待几分钟审核通过即可。"),
        I(f"{BN}/95c303ec73044619a9ab47399d348eb8.jpg"),
        I(f"{BN}/5d9e8d5f75374ca898f8c96d7f603e88.jpg"),
        I(f"{BN}/4059dc983fde4eaba11084c1c3e1bddb.jpg"),
        I(f"{BN}/9d94e629d6374e5fb96aa444f9fa53fb.jpg"),
        I(f"{BN}/8e84a170c04c49219d211d3c1acd5fc4.jpg"),
        I(f"{BN}/1493fe49f7d84fe195c81f9799c4902b.jpg"),
        I(f"{BN}/c623e204d93d4b23825ed6f082139383.jpg"),
        I(f"{BN}/87d872d603b8423fba83f8158746b8b5.jpg"),
        H("三、账户安全设置"),
        T("买币前建议在【账户】-【账户安全】中开启「身份验证器」（类似银行 U 盾），启用后每次登录需两步验证，相当于双保险。"),
        I(f"{BN}/a4287dff11b9461c8dfff6f76a841239.jpg"),
        H("四、C2C 买入 USDT"),
        T("点击左上角【一键买币】。C2C 分快捷区与自选区。USDT 相当于加密货币界的「美金」，价格与美元挂钩（约 1:7.3 人民币），一般先用人民币买 USDT，再用 USDT 购买其他币种。"),
        I(f"{BN}/fd617e2a863e46d5bd6f5a342d854462.jpg"),
        I(f"{BN}/99e3210c78dc4760ad271bc8d474dcc0.jpg"),
        T("注意：买入资产有 T+1 提币限制（买入后至少隔天才能提到其他平台/钱包，但币安内部交易不受限）。"),
        I(f"{BN}/92377aae01004e3989d0531b1b51381b.jpg"),
        T("自选区可手动筛选卖家：输入金额、选择支付方式（如支付宝），建议打开「仅显示神盾广告方」（金牌卖家信誉高、冻卡概率低）。"),
        I(f"{BN}/9ed234dcfdfa487b9485599198c4af13.jpg"),
        I(f"{BN}/fffc82b70ab8434c91a8c6a34e55a11e.jpg"),
        I(f"{BN}/ef043e903c0845d69c0c1d336832601c.jpg"),
        I(f"{BN}/adc7d868a13343cfa4179f9738e08378.jpg"),
        I(f"{BN}/d4f7b0def4d36b2a22655108b5911.jpg"),
        T("下单后请在 15 分钟内按卖家要求付款（务必按每位卖家的具体要求操作），付款后点【我已完成付款，通知对方】，等待放币。所有沟通务必在币安官方聊天框进行，便于客服核实。"),
        I(f"{BN}/2de095b757a445338ad0576fe4acc7ed.jpg"),
        I(f"{BN}/35d68008d10b413ba97b135cc130acaf.jpg"),
        I(f"{BN}/0697e3ca137440afaa996ddd181976cc.jpg"),
        T("到账后点右上角【钱包】-【资金账户】查看，USDT 已到账。平台在下单时即锁定卖家对应数额，若卖家不放币可凭付款记录找客服仲裁。"),
        I(f"{BN}/80872aba356d4315897a59c561f3d199.jpg"),
        I(f"{BN}/eddc554376c54094b12fbf3da35e3880.jpg"),
        H("五、币币交易 · 买卖比特币"),
        T("先把 USDT 从【资金账户】划转到【现货账户】（资金账户负责出入金，现货账户负责交易，内部划转免手续费）。"),
        I(f"{BN}/76ddb1cdd8294cac93ef09dda664991c.jpg"),
        T("点击【交易】-「现货交易」，选择交易对（如 BTC/USDT）。左侧盘口：红色卖单、绿色买单；中间为 K 线与技术指标；右侧为交易对列表。"),
        I(f"{BN}/0f71d36107d34109bcbfb08e5013972b.jpg"),
        I(f"{BN}/883d1ac5e4e943f0a9631c7417534a9e.jpg"),
        I(f"{BN}/c3230b26464b4ec2868af9ef4a74bc27.jpg"),
        I(f"{BN}/c49f7003519d462d9dee43d50926fb85.jpg"),
        T("限价单：以设定价格买入/卖出，到价才成交（可能较慢），价格可随时修改；市价单：以当前市场价立即成交，速度快但价格不一定最优。"),
        I(f"{BN}/b106a77ec8fd476eaedc5d4c872ed4ff.jpg"),
        I(f"{BN}/03ca5e00a3bf4b488e0675d2b1b250d8.jpg"),
        I(f"{BN}/0557b9a3693e4651adff1581db23b713.jpg"),
        I(f"{BN}/9fd8acc44a0a4aa481f64740a222dce6.jpg"),
        I(f"{BN}/c8076bdb60c542e7817a0c49bfcc080b.jpg"),
        I(f"{BN}/68b0e3254ded4338930ed351d33dc01b.jpg"),
        I(f"{BN}/b4a360372e794094851ec74ee792cfe8.jpg"),
        H("六、出金变现"),
        T("先把 USDT 从现货账户划转回资金账户 → 点【一键买币】选【卖出】→ 选自选区、币种 USDT、收款方式（建议开「仅显示神盾广告方」）。"),
        I(f"{BN}/fde2318bc0e84eea888f9d4d23eb38e7.jpg"),
        I(f"{BN}/7d9e73e42d84445facbc20aaf1a8b0a4.jpg"),
        I(f"{BN}/fe81a5dffd934d7b96ddcaca8509a3fa.jpg"),
        I(f"{BN}/990648904688403f865f25dd9fce0a17.jpg"),
        T("添加本人实名收款账户（建议勿用工资卡等重要卡，以防冻卡）。收到买家付款提醒后，务必核实币安账户实际到账，再点「确认收款」放行 USDT。"),
        I(f"{BN}/4e303768dd8a41ef8303337eebf57d03.jpg"),
        I(f"{BN}/86e9ff9a95d344eebd5271f2d7aa0d3c.jpg"),
        T("风险提示：以上含第三方内容，不构成任何投资建议。加密资产价格波动大、存在风险，请谨慎决策。"),
        B("前往币安官网注册", "https://www.binance.com/zh-CN/register"),
    ],
    "published": True,
    "sort": 2,
}

# ---------------- 火币 HTX ----------------
HT = "https://d1x7dwosqaosdj.cloudfront.net/images/2024-11"
HTX = {
    "slug": "htx",
    "name": "火币 HTX",
    "icon": "https://www.google.com/s2/favicons?domain=htx.com&sz=128",
    "tagline": "火币 HTX · 身份验证器（谷歌验证器）下载与绑定教程",
    "download_link": "https://www.htx.com/zh-cn/",
    "download_text": "前往火币 HTX",
    "blocks": [
        T("身份验证器（谷歌验证器）是一款动态口令工具，绑定后每 30 秒生成一个动态验证码，用于登录、提现、修改安全设置等的安全验证，是账号与资产安全的重要屏障。"),
        H("一、下载安装"),
        T("安卓手机：在应用商店搜索「身份验证器」，找到 Google Authenticator 或 Microsoft Authenticator 下载安装。\n苹果手机：在 App Store 搜索 Google Authenticator（需海外账号）或 Microsoft Authenticator 安装。\n注：也可在绑定操作时按提示下载安装。"),
        H("二、绑定身份验证器（网页端）"),
        T("1）打开火币官网 htx.com，登录账户，点右上角头像，选「账户安全」。"),
        I(f"{HT}/1141bfbb26464b5f89329b6edc33d3e3.png"),
        T("2）点击「谷歌验证器」后的「绑定」。"),
        I(f"{HT}/c7babb4ca7824d47b7665fba5868550e.png"),
        T("3）获得密钥后开始配置。"),
        I(f"{HT}/9755d08948c74280bb2c80e8424ea426.png"),
        T("第一步：打开身份验证器，点右下角「+」，可手动输入密钥或扫描二维码（建议扫码更方便）。\n第二步：扫描火币网站给出的二维码（无摄像头可手动输入密钥）。\n第三步：在火币网站输入验证器显示的 6 位验证码。\n第四步：完成邮箱或手机验证，即绑定成功。"),
        H("三、手机端绑定"),
        T("打开并登录火币 APP，点左上角头像 → 上方【设置图标】→【安全设置】→【谷歌身份验证器】，后续步骤参考网页端即可。"),
        H("四、注意事项"),
        T("强烈建议绑定时把密钥或二维码保存下来，万一手机丢失可在新手机重新绑定。若忘记备份，可将手持身份证照片与联系电话邮件发送至 support@huobigroup.com 申请解绑，客服处理后可重新绑定。"),
        H("五、常见问题"),
        T("验证码提示错误时可排查：\n1）检查验证器 APP 与火币 APP 时区是否一致，更新时区后重试；\n2）若重装过验证器 APP，验证码会变，请申请删除后重试；\n3）修改 2FA 后 24 小时内限制提币与划转至法币账户，但不影响入金或交易；\n4）多次输入错误可申请解绑身份验证器。"),
        B("前往火币 HTX 官网", "https://www.htx.com/zh-cn/"),
    ],
    "published": True,
    "sort": 3,
}

TOOLS = [OKX_TOOL, KUAIFAN, BINANCE, HTX]


def main():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    now = datetime.now(timezone.utc).isoformat()
    for t in TOOLS:
        if db.tools.find_one({"slug": t["slug"]}):
            db.tools.update_one({"slug": t["slug"]}, {"$set": {**t, "updated_at": now}})
            action = "更新"
        else:
            db.tools.insert_one({"id": str(uuid.uuid4()), **t, "views": 0, "downloads": 0, "created_at": now, "updated_at": now})
            action = "新增"
        print(f"[{action}] {t['name']}  (slug={t['slug']}, {len(t['blocks'])} 区块)  ->  /tools/{t['slug']}")
    client.close()
    print("完成。")


if __name__ == "__main__":
    main()
