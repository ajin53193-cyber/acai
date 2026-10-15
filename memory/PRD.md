# PRD — 跨境充值商城 (高仿 Kavip / gogo589)

## 原始问题陈述
构建一个跨境充值商城 Web App（PC+Mobile），含完整自建后台。核心为高度定制化的「礼品卡转赠与自动核销系统」。
技术栈：React + FastAPI + MongoDB + Emergent Object Storage + 自建 OTP 登录 + Google OAuth。

## 已实现（截至 2026-06）
- 前端：首页、分类、商品详情、购物车、结账、用户账户、多货币。
- [2026-06] 礼品卡交易号一键分享/生成图片：Canvas 2D 绘制品牌分享卡（gogo589 礼品卡 + 礼物盒插画 + 交易号 + 商品名 + 核销提示），支持 Web Share（移动端）与 PNG 下载（桌面端）。文件 /app/frontend/src/lib/giftShareImage.js，MyOrders 列表卡与详情卡均有「分享」按钮。注：改用 Canvas 而非 html-to-image（后者在无头/部分浏览器 foreignObject 导出空白）。
- [2026-06] 到账提醒：转赠完成（倒计时轮询检测到 completed）瞬间触发橙色礼花 confetti + Web Audio 合成三音符提示音（无音频资源，轻量）。文件 /app/frontend/src/lib/celebrate.js。
- [2026-06] 修复旧版 Clerk 登录失败无提示：AuthModal submit()/sendCode() 在 !siLoaded 时静默 return，现加 toast「登入服務載入中，請稍候再試」。
- 后台：商品/礼品卡管理、订单管理、数据看板、会员管理、评价管理。
- 礼品卡系统：号码库比对、asyncio 自动发货、手动审核、外部核销 API。
- 后台侧栏「待人工」订单红色角标（30s 轮询 /admin/me）。
- 礼品卡稽核报表（USD 统计售出/完成/核销）。
- 订单完成自动邮件发送 32 位交易号。
- 礼品卡订单「充值中」状态下，订单详情弹窗显示「系統轉贈中」倒计时卡片（复用 GiftTransferring，秒级倒计时 + 10s 轮询，完成自动刷新显示交易号）。
- [2026-06] 倒计时卡片 & 交易号卡片 UI 重做为平台橙色奶油可爱风：
  - 新增圆润可爱字体 .font-cute (ZCOOL KuaiLe) 与 .font-cute-num (Fredoka)，见 index.html 字体链接 + index.css。
  - 3D 礼物盒圆形插画 /app/frontend/public/giftbox-disc.png 置于橙色进度环中，带 animate-gt-float 浮动动画。
  - 暖橙渐变 + 圆点纹理背景，橙色圆形礼物图标徽章。
  - 文件：/app/frontend/src/pages/MyOrders.jsx

## 待办 / Blocked
- P1 [BLOCKED-用户操作] Google OAuth redirect_uri_mismatch：需用户在 Google Cloud Console 添加授权重定向 URI。
- P1 [BLOCKED-用户操作] 打狗短信 +86 每日限额（25次）：需用户联系打狗客服提额。
- P2 旧版 Clerk 登录失败缺 Toast 提示。
- P2 彻底移除遗留 clerk_auth.py 与 Clerk UI（确认自建 Auth 100% 接管后）。

## 关键信息
- Admin Login: /admin/login | admin@gogo589.com | Gg589!kVTEyEy16n | TOTP Secret 2FAI3HWF6WYDNSQC7DNSUGKZ4HWQBMOH
- 角标：前端 /admin/me 每 30s 轮询 { badge: { manual } }。
- 倒计时：GiftTransferring 依赖 order.gift_dispatch_at / info_submitted_at / is_giftcard_order。
- 用户性格：极易改主意、要求极具体，大改前务必 ask_human 确认。
