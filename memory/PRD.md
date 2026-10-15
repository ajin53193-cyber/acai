# PRD — 跨境充值商城 (高仿 Kavip / gogo589)

## 原始问题陈述
构建一个跨境充值商城 Web App（PC+Mobile），含完整自建后台。核心为高度定制化的「礼品卡转赠与自动核销系统」。
技术栈：React + FastAPI + MongoDB + Emergent Object Storage + 自建 OTP 登录 + Google OAuth。

## 已实现（截至 2026-06）
- 前端：首页、分类、商品详情、购物车、结账、用户账户、多货币。
- [2026-06] 礼花升级：转赠完成瞬间 confetti 从礼物盒图标位置迸发（giftRef getBoundingClientRect → 归一化 origin），并弹出庆祝浮层「禮品卡已轉贈到您的{channel}賬戶！」（channel 由 delivery_info 字段名动态推导，默认 Alipay HK），4.8s 自动消失。celebrate(origin) 支持自定义迸发点。浮层内按订单面额显示对应 SHKP 礼品卡卡面（/giftcards/hkd-{200,500,1000,5000,8000}.png，已 PIL 预裁掉米色留白、统一尺寸 object-cover 显示）；giftCardImageFor() 从 spec_label 的 HKD 金额映射。
- [2026-06] 分享图自定义祝福语：详情交易号卡新增祝福语输入框（上限 40 字），生成的分享图中以橙色浅底框展示祝福语（动态高度+自动换行）。
- [2026-06] 我的订单按交易号/订单编号搜索：列表顶部搜索框客户端过滤（匹配 order_no 或 gift_trade_nos[].trade_no），带清除按钮与空态提示。
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
- 全站模态滚动锁定：`/app/frontend/src/lib/useScrollLock.js` 导出 `<ScrollLock/>`，已内置进 dialog.jsx / sheet.jsx / alert-dialog.jsx 的 Radix `*Primitive.Content` 内部（仅弹窗真正打开时挂载）。打开任意 Dialog/Sheet/AlertDialog 时 body 变 `position:fixed` 冻结背景，修复 iOS/手机桌面版点击输入框整页上移的 bug。vaul Drawer 自带锁定，勿叠加。切勿把锁挂在 Content 外层包装组件（会被 CartDrawer/AuthModal 无条件渲染而首屏锁死）。
- (2026-06) iOS「添加到主屏幕」PWA 键盘专项修复：用户所说「手机桌面端」= 主屏幕 PWA（standalone）。两层修复：
  1) `useScrollLock.js` 锁定期间监听 window scroll / visualViewport resize+scroll / focusin：强制 scrollY 归 0，并把打开的 Dialog/Sheet 以内联 top/height 重新锚定到 visualViewport（`<ScrollLock side=...>`，sheet.jsx 已传 side），让输入框始终在键盘上方可见，Safari 无需再推页面。
  2) `/app/frontend/src/lib/iosViewportFix.js`（index.js 引入）：修复 standalone 下键盘收起后 innerHeight/100dvh 永久缩小、底部 fixed 按钮条上浮的 WebKit bug——在 input/textarea focusout、vv resize、visibilitychange 后，若 innerHeight 小于基线(maxVH / screen.height) 则对 `#root` 做 display none→"" 同步 reflow 强制重新测量视口并恢复 scrollY。仅 iOS UA 生效。`#root` 已加 `min-height:100vh`。
  均无法在 Playwright 真机复现，需用户在 iPhone 上验证（先彻底关闭 PWA 再重开以清缓存）。
- Admin Login: /admin/login | admin@gogo589.com | Gg589!kVTEyEy16n | TOTP Secret 2FAI3HWF6WYDNSQC7DNSUGKZ4HWQBMOH
- 角标：前端 /admin/me 每 30s 轮询 { badge: { manual } }。
- 倒计时：GiftTransferring 依赖 order.gift_dispatch_at / info_submitted_at / is_giftcard_order。
- 用户性格：极易改主意、要求极具体，大改前务必 ask_human 确认。
