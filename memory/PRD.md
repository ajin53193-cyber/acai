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
- (2026-06 最终结论) iOS 26 主屏幕 PWA：`100dvh`/`height:100%` 比真实屏幕少 ~68px，但 fixed `top:0;bottom:0`(inset) 能铺满真实屏幕 → 所有 Sheet/遮罩/锁定 body 一律用 inset/bottom:0，**禁止**用 dvh/百分比高度；不要再做 display 翻转/meta 重写等“强制重算视口”（会闪动且无效）。`react-remove-scroll` 会给 body 注入 `position:relative !important`，锁定需靠 `html body.gt-scroll-locked{position:fixed !important; bottom:0 ...}` 覆盖（index.css）。Header 改为 `position:fixed` + ResizeObserver 占位 div（`header-spacer`），避免 iOS 底部回弹时 sticky 头部跟着移动。`lib/iosViewportFix.js` 现仅做 standalone 诊断埋点（vp_debug）。转赠成功弹窗已按平台风格（奶油圆角卡 + 橙色渐变按钮，去掉卡通字体）重做。
- (2026-06) 评价管理重做：`/app/frontend/src/pages/admin/ReviewsAdmin.jsx`（统计卡、搜索/商品/显示/评分过滤、新增/编辑、客服回复、显示开关、批量显示/隐藏/删除、分页加载）。后端 `GET /api/admin/reviews` 返回 `{items, counts}` 并支持 `q/product_id/visible/rating`；新增 `PATCH /api/admin/reviews/{id}` (visible/reply→replied_at) 与 `POST /api/admin/reviews/bulk`；Review 模型加 `reply/area`。测试 iteration_38 全通过。
- (2026-06) 安装引导：`/app/frontend/src/components/A2HSTip.jsx` 挂在 Header，手机 UA 且非 standalone、非 /admin 时首页加载 4s 后出现底部提示条，点「查看教學」打开 AddToHomeDialog（30 天不再提示），关闭 7 天不再提示（localStorage `a2hs_tip_until`）。
- (2026-06) 手机端购物主流程体检（详情→加购→购物车抽屉→结账）通过，无 console 报错、无滚动锁泄漏。
- (2026-06) 评价增强（iteration_39 全通过）：① 快捷话术模板 `GET/PUT /api/admin/reviews/templates`（settings key `review_reply_templates`，默认 5 条），回复弹窗一键填入 + 管理模板弹窗；② 差评提醒：`BAD_REVIEW_COND`（≤2 星、无 reply、handled!=true），`GET /api/admin/badges` 驱动侧栏徽标（Admin.jsx 30s 轮询，数量上升时 toast.warning），仪表盘 `todo-bad-reviews` 红色待办卡 → 跳转评价管理并预置 bad 过滤（sessionStorage `reviews_preset`），行内「標記已處理」PATCH handled；③ A2HS 埋点：`POST /api/track`（白名单 a2hs_tip_shown/open/close, a2hs_dialog_open, pwa_launch；`lib/track.js` standalone 启动时每会话记一次 pwa_launch），`GET /api/admin/a2hs/stats?days=` 驱动仪表盘「添加到桌面引導成效」卡（曝光/点击/CTR/教学打开/App 启动、来源、平台、日序列）。AddToHomeDialog 用 ref 防 StrictMode 双触发。
- Admin Login: /admin/login | admin@gogo589.com | Gg589!kVTEyEy16n | TOTP Secret 2FAI3HWF6WYDNSQC7DNSUGKZ4HWQBMOH
- 角标：前端 /admin/me 每 30s 轮询 { badge: { manual } }。
- 倒计时：GiftTransferring 依赖 order.gift_dispatch_at / info_submitted_at / is_giftcard_order。
- 用户性格：极易改主意、要求极具体，大改前务必 ask_human 确认。

- (2026-06) 礼品卡：顾客端固定 90s 倒计时（gift_countdown_at），实际完成 `gift_dispatch_at` 在后台「自動完成延遲區間」内随机（默认 0.5~1.0 分钟 = 30~60s，须早于倒计时）；新增 `_dispatch_giftcard_at` 精确定时任务在倒计时归零时立即完成（20s 轮询为兜底，`gift_dispatching` 原子抢占防重复发货）；前端倒计时期间每 3s 轮询、归零后每 2s。转赠成功弹窗按钮改「查看訂單」，不再自动关闭/点遮罩关闭。礼品卡订单提交资料提示改「等待系統轉贈充值」。

- (2026-06) 修复：手机简体/英文界面提交充值资料报「請填寫所有必填的充值資料」——公共商品 API 会本地化 delivery_fields 的 name（繁→简/英），前端按本地化标签作 key，后端按原名校验失败。`submit_order_info` 现将简体/繁体/英文/code 别名映射回原字段名。手机网页端「添加輕量版桌面 App」海报弹窗（A2HSTip.jsx，每次打开都弹，文字区白底、按钮无箭头、顶部 Logo），桌面图标换为用户提供的 gogo589 Logo（icons/apple-touch-icon.png, app-icon-512.png, app-logo.png）。

- (2026-06) 礼品卡「自动转赠失败」流程：号码未命中号码库时不再直接转人工，而是照常显示 90s 倒计时「系統轉贈中」，30~60s 后（`gift_fail_at` + `_fail_giftcard_at` 定时任务，`_sweep_giftcard_failures` 20s 兜底）把订单置为 status=paid、info_submitted=false、info_rejected=true、gift_auto_failed=true、reason=「系統自動轉贈失敗，請重新提交 AlipayHK 帳號進行人工轉贈」，前端自动展开表单并显示红色提示；再次提交若仍未命中则直接 gift_manual 转人工（toast「等待人工轉贈」），命中则走自动流程。

- (2026-06) 后台：礼品卡订单管理操作列改为 2 列胶囊按钮并 sticky 固定在右侧（ui.jsx Table 新增 stickyLast）；取消/驳回/补号改为平台风格 Dialog + 原因预设 + 必填原因，取消原因写入 order.admin_note 并在前台订单详情显示红色「訂單已取消 — 原因」；新增 `auto_failed` 页签；`processing` 页签排除 gift_manual。后台菜单改为 `/admin?s=<section>` 可寻址链接（右键/Cmd+点击可新标签打开，popstate 同步）。

- (2026-06) 后台壳升级（iteration_40/41 通过）：① 左侧导航可收起为 64px 图标栏（`admin-sidebar-toggle`，localStorage `admin_sidebar_collapsed`，收起时 hover 图标出浮层菜单，aside z-40 防被内容遮挡）；② 多页签工作区：顶部 TabBar（`admin-tab-<key>`、右键菜单 關閉/關閉其他/關閉全部、`admin_tabs` 持久化、`?s=` 同步、非激活页签保持挂载保留筛选状态）。
- (2026-06) 站内实时客服 + 声音提醒（iteration_41 全通过）：后端 `backend/chat_api.py`（公共 `POST /api/chat/sessions`、`GET/POST /api/chat/sessions/{sid}/messages`（guest_id 或 Bearer），`GET /api/chat/quick-replies`；管理 `/api/admin/chat/sessions*`、`/api/admin/chat/quick-replies`（settings key `chat_quick_replies`，默认 4 条）、`GET /api/admin/alerts?since=`）。快捷问题点选 = 用户消息 + 系统自动回复（auto=true，不计未读、不触发提醒）。前台 `ServiceWidget.jsx` 改为聊天窗（访客免登录，localStorage `chat_guest_id`；手机端 inset 全屏；关闭时后台 20s 轮询未读角标）。后台「客服 → 客服會話」`pages/admin/ChatAdmin.jsx`（会话列表/筛选/搜索、回复/图片、标记已处理、快捷回复模板芯片与设置弹窗），badges 增加 `chat-sessions`，权限 ALL_PERMISSIONS 增加 `chat-sessions`。声音：`lib/adminSounds.js` WebAudio 合成三种音（订单叮咚 / 充值金币 / 客服消息），Admin.jsx `useAdminAlerts` 每 8s 轮询 alerts 并 toast+发声；TabBar 右侧小喇叭 `admin-sound-toggle` 面板可开关/调音量/试听（localStorage `admin_sound`）。
- (2026-06) 客服增强（iteration_42 通过）：① 会员中心新增「客服對話」`/account/chat`（`pages/account/ChatHistory.jsx`，`GET /api/me/chat/sessions?guest_id=`，点击行 `openService(session)` 在悬浮窗继续聊）；② 后台桌面通知：声音面板新增「桌面通知」开关（Notification API，仅 document.hidden 时弹，prefs.desktop）；③ 客服会话右侧「用戶與訂單」面板（`GET /api/admin/chat/sessions/{sid}/context`、`GET /api/admin/chat/orders?q=`，一键把订单状态填入回复）；④ 非工作时段自动回复：settings `chat_hours`（enabled/start/end/tz/message，`GET/PUT /api/admin/chat/hours`，公共 `GET /api/chat/status`），用户离线时段发普通消息自动回复一次（同会话 6h 不重复，`after_hours_at`），前台窗口头部显示在线/非工作时段。

- (2026-06) Stripe 收款上线：后端 `STRIPE_API_KEY` 换成用户自有测试密钥（`sk_test_51UQrIA...`，巴西 BR 账户，默认币种 BRL）。按付款方式对接独立 Stripe 类型：`payments_api.py` checkout 读取 `config.stripe_methods`（逗号分隔 payment_method_types，默认 card）与 `config.stripe_currency`（非 usd 时用 `_fx_rate` 经 db.currencies/er-api 换算，结算币种本地化，钱包仍按 amount_usd 入帐）。`server.py _ensure_stripe_methods()`（在 `_ensure_payment_methods` 内幂等执行）：信用卡→stripe_methods=card；旧「Apple Pay / Google Pay」重命名为「Google Pay」(card，Apple Pay 该账户已停用)；新增「Link」(link,card) 与「PIX」(pix, brl)。新图标 `frontend/public/payments/{google-pay,link,pix}.svg`。端到端验证：4 种方式均成功创建 Stripe 会话（PIX $50→R$251.80）。Boleto 未对接（该账户 API 返回 invalid，需 Stripe 后台激活账户）。publishable key `pk_test_...` 当前跳转式收银台用不到，未配置。

- (2026-06) 后台支付管理自助新增 Stripe 方式：`PaymentMethodsAdmin.jsx` 当 provider=stripe 时新增「Stripe 付款类型」下拉（`pm-form-stripe-type`），写入 `config.stripe_methods`（选项：card / link,card / pix / alipay / klarna / afterpay_clearpay / boleto），选 pix/boleto 自动把 `config.stripe_currency` 设为 brl 并提示按汇率换算。配合已有 checkout 逻辑即可自助上架任意 Stripe 标准方式，无需改代码。注意：方式能否真正收款仍取决于 Stripe 账户是否对该类型开放（如 boleto 需 charges_enabled=True）。用户 Stripe 账户 details_submitted=True 但 charges_enabled 仍 False，Boleto 暂不可用。

- (2026-06) 支付/客服本轮：① 用户自有 Stripe 测试密钥写入 STRIPE_API_KEY（巴西 BR 账户，charges_enabled 当时仍 False → Alipay/PIX/Boleto 等区域方式不稳定，card/Google Pay/Link 稳定）；按方式对接独立 Stripe 类型（config.stripe_methods / stripe_currency，PIX 按汇率换 BRL），checkout 对 Link/钱包类失败自动回退 ['card']，其它方式失败抛 400（避免 Cloudflare 502 拦截）。后台 PaymentMethodsAdmin 新增「Stripe 付款类型」下拉自助上架。已加支付宝 Alipay（/payments/alipay.svg）。② 充值页 WalletTopUp.jsx：去掉「立即充值」按钮的 + 号、去掉按钮下方 footnote、去掉选中方式的「付款说明」描述面板（pm-description 整块移除）。③ 客服 ServiceWidget.jsx：手机端从全屏改悬浮小窗（left-3 right-3 bottom-[5.5rem] h-[72vh] max-h-[34rem] 圆角，md 仍右下 380x560）；接入 VisualViewport 适配 iOS 键盘；头部新增「結束」按钮（POST /api/chat/sessions/{sid}/end 删除会话+消息）；关闭窗口 POST .../close 写 closed_at，后端 chat_api.sweep_closed_sessions() 在 _giftcard_dispatch_loop(每20s) 中清理 closed_at 超过 CHAT_CLOSE_TTL=600s 的会话+消息；open_session/user_send 会清空 closed_at。iteration_43 前端 6/6 通过。
