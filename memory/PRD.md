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

## [2026-06] Windows 10 宝塔自托管部署（已完成，待用户浏览器确认）
- 服务器环境：`D:\wwwroot\gogo589`；Python 3.11.9 单独装在 `C:\Python311`（未加 PATH，宝塔自带 3.8.6 在 `C:\Program Files\python` 勿动）；venv 在 `backend\venv`；Node v24 + yarn 1.22.22（corepack）。
- 后端依赖安装命令：`pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ --no-deps`（**`--no-deps` 必须**）。
- `.env` 用宝塔文件管理器创建（CMD 多行粘贴会丢换行）；前端 `REACT_APP_BACKEND_URL=https://www.gogo589.com`，已 `yarn build`。
- CMD 跨盘切目录必须 `cd /d`。
- Nginx 欢迎页根因：`D:\BtSoft\nginx\conf\vhost\test.conf` 用 `default_server` 抢占同域名，已删除；站点配置 `www.gogo589.com.conf`（root build 目录 + try_files + /api/ 反代 8001）正确。Windows 下重启 Nginx 需 `taskkill /f /im nginx.exe` 后在宝塔启动。
- 后端常驻：PM2 7.0.4（路径 `C:\Windows\system32\config\systemprofile\AppData\Roaming\npm\pm2.cmd`，不在 PATH），进程名 `gogo589-backend`，已 `pm2 save`；开机自启用计划任务 `schtasks /tn gogo589-backend /sc onstart /ru SYSTEM → pm2 resurrect`。
- 本机验证通过：80→301 https；443 返回 index.html；`/api/` 返回 JSON；MongoDB 本地 27017 正常（商品自动初始化）。
- 已知：`Storage init failed: 403` — Emergent 对象存储拒绝外部服务器，图片上传不可用，需改为 OSS/S3/本地磁盘（P1）。`translate.py` 仍依赖 EMERGENT_LLM_KEY（P1）。

## [2026-06] iOS 主屏幕 PWA 布局 — 最终状态：完全回退到 fork 前的稳定布局（PWA: fixed header + spacer, 窗口滚动；Safari: sticky）。App Shell（body fixed + #site-scroll）在真机 PWA 导致底部大块留白、转赠成功弹窗消失，已彻底移除，**绝对不要再尝试**。保留的安全改动：`lib/track.js` iOS 只信 `navigator.standalone`（修复 Safari 被 ?source=pwa 误判为 PWA）；转赠成功弹窗 / 充值资料核对弹窗 / 评价弹窗改为 createPortal 到 body；订单详情 Sheet 手机端 `max-sm:-bottom-24 max-sm:pb-[7.5rem]`。原始 P2 头部漂移问题仍未解决，需真机调试。

## [旧记录] iOS 主屏幕 PWA 头部漂移 — 历史（已回退 App Shell 实验）
- 现象（用户录屏）：PWA 内下单→填充值资料（键盘）→返回首页→一滑动，头部+内容整体上移一个状态栏高度（页面比例不变，非缩放）。埋点：正常 vv.offsetTop=0；异常时 offsetTop=56（=状态栏高）。
- 已尝试并无效/有副作用（勿重复）：① 浏览器模式 header 也 fixed+spacer → 状态栏颜色变化且无效，已回退；② offsetTop 自愈 scrollTo（iosViewportFix.js 仍保留，无害但无效）；③ App Shell（html.pwa 下 body overflow hidden、#site-scroll 内滚）→ 头部稳定，但壳层高度拿不到真实屏幕：height:100%/innerHeight 比屏幕少约 55~68pt（iOS 26 standalone），用 screen.height 撑高后 fixed bottom-0 底栏仍锚在 797pt（layout viewport），底部留空/底栏被截；已回退（index.css 的 html.pwa 壳层规则与 track.js 的 --app-h 已删）。
- 当前保留：App.js 中 #site-scroll 包裹 div（无 CSS）、lib/scroller.js（scrollPageTo 等，浏览器模式等价 window.scrollTo）、Header 恢复为「PWA fixed+spacer / 浏览器 sticky」原版（commit 6f9f702）。
- 若继续：需 iPhone 真机实测；思路 a) 壳层用 position:fixed; inset:0（早前结论 inset 可铺满真实屏幕），底栏改为壳层内 flex 子元素而非 fixed；b) 或 focusout 后 window.scrollTo(0, scrollY)+强制重排，用 /api/track 埋点（vp_debug meta.vvTop）在用户服务器 DB events 集合验证。
- 本轮已生效：manifest 192 图标 + start_url /?source=pwa + id/scope；A2HSTip 每会话一次且 PWA 不弹；PagedGrid touch-action pan-x pan-y；iOS 输入框 ≥16px + gesturestart 拦截；路由切换回顶部 + scrollRestoration manual；storage.py 本地磁盘模式；scripts/export_data.py + import_data.py；Nginx index.html no-cache 建议。
- 补丁下发：GET /api/_export/{DATA_EXPORT_TOKEN}/patch.zip（整包 frontend/src + public），用户 tar -xf 到项目根后 yarn build。临时接口 server.py /_export/... 迁移完成后应删除。

### 补充（同日稍后）：面板实测数据与最终状态
- 诊断面板 `lib/vpDebug.js`（logo 连点 5 次开关，或 `?vpdebug=1`）已保留。用户面板截图（异常时）：scrollY=pageTop、vv.offsetTop=0、vv.h=844、innerH=912、clientH=844、screenH=912、header.top=0、safeTop=68px、scale 1 → **JS 层没有任何可区分正常/异常的信号**。
- 录屏逐帧：橙色横幅 y 在 68pt（正常）与 0pt（异常）之间随滚动方向来回切换：向下滚动=异常、向上滚动=正常。即键盘后 WebKit 把 68pt 状态栏 inset 当成"可收起的浏览器顶栏"处理（fixed 层随滚动方向上下移 68pt）。一次性 scrollTo 类修复无意义。
- 已试且回退：`apple-mobile-web-app-status-bar-style=default`（理论上 inset=0 即无可收起区；用户反馈无效且需重新添加图标才生效，不确定是否真正验证过）；document 级非 passive touchmove/gesture 监听 + heal 循环（导致首页滑动卡顿，已全部回退，iosViewportFix.js/index.html 恢复 6f9f702 原版，index.css 的 touch-action/16px 规则已删）。
- 最终保留的今日前端改动：App.js 路由切换 scrollPageTo(0) + scrollRestoration manual、#site-scroll 包裹 div（无 CSS）、lib/scroller.js、PagedGrid touch-action pan-x pan-y、manifest(192 图标/start_url ?source=pwa/id/scope)、track.js isStandalone 含 ?source=pwa、A2HSTip 每会话一次、vpDebug 面板。
- 下一步最有希望的方向（需真机）：App Shell（window 不滚动）但壳层用 `position: fixed; inset: 0`（早前结论 inset 可铺满 912 真实屏幕），并把页面内 `fixed bottom-0` 底栏（ProductDetail/Checkout/注册条/ServiceWidget）改为壳层 flex 子元素或以壳层为包含块验证；或 status-bar-style=default 并让用户确认已重新添加图标后再评估。

## [2026-06] 后台新增：管理员直建 / 测试账号 / 合作方核销 API（iteration_45/46 全通过）
- 订单填充值资料：点「提交充值資料」先弹核对层 `order-info-confirm`（逐字段显示，返回修改 / 確認無誤，提交）再 POST。
- `POST /api/admin/admins/create {email,password,role_id}`（超管）：Clerk 建用户 + users role=admin；前端 AdminsAdmin 新增密码框 + 「建立管理員」，保留「設為管理員」提升。
- 测试账号：`users.is_test`；`POST /api/admin/members/create-test {email,password}`、`POST /api/admin/members/{uid}/test-flag {is_test}`；MembersAdmin 顶部「新增測試帳號」卡、「測試帳號」tab、测试 pill、详情页切换按钮。`_test_uids()` 在 `_period_stats`/`admin_dashboard` 全部查询中排除 is_test 用户（订单/充值/新用户/余额/品类/状态分布/用户总数）。
- 合作方（新地核销）外部 API（`X-API-Key` = 后台礼品卡交易号页 api_key）：`GET /api/ext/txn/query?no=` → 200 {code:0,data:{transactionNo,amount,currency,phone,alipayHK(=phone),product,spec,redeemed,redeemedAt}} / 404；`POST /api/ext/txn/redeem {transactionNo,amount,phone?}` phone 可选，HTTP 状态码与 body.code 一致：0 成功、404 查无、422 面值/手机不符、409 已核销、401 key 错。
- 用户服务器补丁 patch.zip 现包含 backend/giftcard_api.py 与 backend/admin_api.py，解压后需 `pm2 restart gogo589-backend`。

## [2026-06] 订单管理合并 + 核对弹窗居中 + 自动好评（iteration_47/48 全通过）
- 后台两处「訂單管理」合并：財務管理菜单项 `orders` 移除（Admin.jsx MENU、RolesAdmin 权限分组、后端 ALL_PERMISSIONS）。禮品卡→訂單管理 (`giftcard-orders`) 渲染 `pages/admin/OrdersHubAdmin.jsx`：子 Tab「禮品卡訂單」(GiftCardOrdersAdmin，默认) /「全部訂單」(OrdersAdmin)。新订单告警 `jump()` 跳 giftcard-orders 并用 sessionStorage `orders-hub-tab=all` 打开全部订单。
- MyOrders.jsx `InfoConfirm` 核对弹窗全尺寸 `items-center` 居中（原手机端贴底）。
- 核销对接文档已以 Markdown 形式发给用户（域名 www.gogo589.com，含鉴权/错误码/curl/PHP/Node/Python 示例）。
- 自动好评 `backend/review_auto.py`（挂载 `/api`，startup 启动 `review_auto.loop()` 每 60s）：settings key `review_auto` {enabled, daily_min 30, daily_max 100, product_id(默认 is_giftcard 且名含「新地」), seed_total 1849, seed_from 2025-01-01, auto_after_days 3, last_daily_date, today_plan, today_done}。
  - 历史补齐 `POST /api/admin/reviews/auto/seed[?force=true]`：seed_from～昨日随机分布，reviews 标 `seed:true, auto:true`；地区权重 香港34/澳門6/台灣20/中國18/馬來西亞12/新加坡10；作者 60% 脱敏邮箱 `z****7@gmail.com` / 40% 脱敏手机 `852 9****567`；25% 带模板文字（zh-TW/zh-CN/en）；94% 5★ 6% 4★；buy_count 1~5。已补齐则 409。
  - 每日自动：HKT 每天首次 tick 生成 n∈[min,max] 个随机时间点（08:00–23:30 三角分布），到点逐条插入（`daily:true`）。改商品或区间会重置当日计划。
  - 订单自动好评：status=completed 且 `reviewed≠true` 且 completed_at ≤ now-N天 → 每个商品插入 5★ 无文字评论（`auto:true, order_id`），作者为买家脱敏邮箱/手机；is_test 用户跳过并标 `review_skipped`。订单写 `reviewed, review_auto, review{...}, review_ids`。
  - 用户评价 `POST /api/orders/{id}/review {rating, content, images[{image_b64,image_name}]≤3}`（Clerk 登录；非 completed 400，已评 409），图片经 `_upload_b64("gogo589/reviews")`。
  - 管理 `GET/PUT /api/admin/reviews/auto`、`POST .../run-now`；前端 `pages/admin/ReviewAutoPanel.jsx` 嵌在 ReviewsAdmin 顶部（开关/商品/区间/N 天/补齐日期数量/一键补齐/重新生成/立即执行 + 统计）。admin reviews counts 的 `no_reply` 排除 auto。
  - 公共 `GET /api/reviews` 限 300 条；新增 `GET /api/reviews/stats?product_id=` {count, avg, areas}，ProductDetail 用其显示总数/均分/地区数，评论图片缩略图 `review-images-{id}`。
  - 用户端 MyOrders：已完成未评价订单显示「評價」按钮 → `components/OrderReviewDialog.jsx` 居中弹窗（星级/文字/≤3 图）；已评价显示 `OrderReviewBadge`。
- 其它商品每日自動好評（非礼品卡、active≠False）：cfg `other_enabled/other_pct 30/other_min 1/other_max 2/other_text_pct 50/other_date/other_plan[[iso,pid]]/other_done`；每天 HKT 首次 tick 随机抽 pct% 商品，每个 1~2 条，时间 08:00–23:30 分散，文字模板 `TEXTS_GENERIC`，标 `daily_other:true`。区间/比例调整次日生效（不重置当日计划，避免重复生成）。面板 `review-auto-other`。
- Stripe webhook 现支持 `STRIPE_WEBHOOK_SECRET` 签名校验（payments_api._stripe）；已向用户发出 Stripe Webhook / Google OAuth 回调切换到 www.gogo589.com 的操作步骤（APP_PUBLIC_URL、重定向 URI `/auth/google`）。
- 后台「運營管理」新增：「橫幅 / 輪播圖」(key banners，原 Soon 占位) = SiteConfigAdmin `only` 模式（top_promo/hero/promo_banners/detail_banners/announcement + 跳首頁裝修按钮）；「頁尾管理」(key footer，`pages/admin/FooterAdmin.jsx`)：页尾链接栏（settings key `footer_links`，`GET /api/footer`、`PUT /api/admin/footer`、`POST /api/admin/footer/reset`）+ 固定页面 CRUD（`GET/POST /api/admin/articles/pages`、`PUT /api/admin/articles/pages/{id}`，page:true 文章；RichEditor）。基礎設置→客服 WhatsApp 新增自訂二維碼圖片 `settings.cs_qr_image`（data:image 自动上传），Footer 有图显示图否则生成 QR。Footer 三栏改读 `/api/footer`。ALL_PERMISSIONS 增加 `footer`。iteration_49 全通过。
- [2026-06] 管理员密码 + 隐藏后台入口（iteration_50 后端 6/6 + UI 自测通过）：`POST /api/admin/me/password {old_password,new_password}`（Clerk verify_password 校验旧密码→PATCH /users/{id} password + sign_out_of_other_sessions）、`POST /api/admin/admins/{uid}/password`（require_super）；规则 8~32 位含字母数字 `_admin_pw_ok`；前端 `pages/admin/ChangePasswordDialog.jsx`，侧栏底部「修改密碼」(admin-change-password)、管理員管理每行「重設密碼」(admin-reset-pw-{uid})。隐藏入口：默认暗号写死在 `lib/adminPath.js` DEFAULT_SECRET=`gg589-k7p2x`（后台 /gg589-k7p2x/login），可用 `REACT_APP_ADMIN_PATH` 覆盖；预览与用户服务器均用默认值→ `lib/adminPath.js` ADMIN_BASE/ADMIN_LOGIN/isAdminPath；App.js 路由用其值，StoreLayout 内新增 `*`→`pages/NotFound.jsx`（/admin、/admin/login 均 404）。用户服务器需在 frontend\.env 加 `REACT_APP_ADMIN_PATH=自定暗号` 后 yarn build。
- 頁尾文案可编辑：`GET /api/footer` 返回 `texts`（cs_title/cs_btn/cs_sub/show_trustpilot/trustpilot_url/copyright/company/address，默认 DEFAULT_FOOTER_TEXTS），`PUT /api/admin/footer {texts}`；頁尾管理顶部「頁尾文案」卡 (footer-texts-card)；Footer.jsx 用 `ft` 状态渲染，company/address 留空隐藏，Trustpilot 可关闭/加链接。
- 新訂單彈窗：`pages/admin/NewOrderAlert.jsx` 置中模態（訂單號/商品/金額/郵箱），持續顯示直到點「稍後處理」或「查看訂單」(跳 giftcard-orders 全部訂單 Tab)，開啟期間每 12s 重播提示音；useAdminAlerts 的 orders 改走 onOrders，/admin/alerts 投影加 items 與 is_giftcard_order。充值/客服仍用 toast。
- [2026-06] 多平台總後台 Hub（`backend/hub_api.py`，自測通過：以本站為「遠端」自環驗證）：settings key `hub_platforms` {inbound_key, platforms:[{id,name,base_url,api_key,cs_url,admin_url,enabled}]}。對外規範接口 `GET /api/hub/stats|orders|topups|members`（Header `X-Hub-Key`=inbound_key）；管理端 `GET/PUT /api/admin/hub/platforms`（PUT 需超管，api_key 遮罩回傳）、`POST /api/admin/hub/platforms/{id}/test`、`GET /api/admin/hub/platforms/public`、`GET /api/admin/hub/orders?platform=&kind=&q=`（本站+遠端合併，含 topups）、`/admin/hub/members`、`/admin/hub/stats?days=`（每平台 + 合計）。前端：系統配置→平台接入 `HubPlatformsAdmin.jsx`；訂單管理 Hub 第三 Tab「多平台訂單 / 充值」、用戶管理「多平台會員」(`HubAdmin.jsx`)；數據概覽頂部 `HubStatsCards`；客服菜單動態加入 `ext-cs:{id}` 條目（新分頁開 cs_url）。規範文檔 `/app/docs/hub_platform_spec.md`（也可經 _export 下載）。等待用戶提供 Giftray 接口/密鑰後填入即可。新增：`/hub/orders?paid_since=`；`/admin/alerts` 併入 `hub_api.remote_new_paid_orders(since)`（遠端新付款訂單也觸發 NewOrderAlert，含平台標籤，自環驗證通過）；平台 `kind` shop|topup（topup 類型跳過 /hub/orders、不觸發訂單提醒）。用戶提出「四方充值平台」= 以 kind=topup 接入同一 Hub，仍需對方提供接口+密鑰+客服後台地址。
- [2026-06] 獨立「總後台」`/app/hub/`（用戶要求與 gogo589 後台分開）：`server.py`（FastAPI，port 8101，自己的 Mongo DB `gogo589_hub` 只存 platforms；單帳號登入 HUB_ADMIN_USER/PASSWORD + HMAC token，5 次失敗鎖 15 分；API：/api/login, /api/platforms GET/PUT, /api/platforms/{id}/test, /api/stats, /api/orders(含 topups, kind 篩選), /api/members, /api/alerts(paid_since 新訂單)）；`static/index.html` 純 HTML+Tailwind CDN 單頁（數據概覽/訂單充值/會員/客服入口/平台接入，新訂單彈窗+WebAudio 提示音，每 8s 輪詢）。`README.md` 為 Windows 部署說明（PM2 `gogo589-hub`，可反代 hub.gogo589.com）。預覽：本地 8101 已啟動（nohup），帳號 hubadmin / Hub589!Test2026，已接入 gogo589(自身) 與「四方充值平台」(自環, kind=topup) 驗證通過（Playwright 本地截圖）。
- 「確認無誤，提交」按钮文字改为「確認提交」（i18n zh-CN/en 已加条目）。
- patch.zip 现含 backend/server.py、backend/review_auto.py（新文件）、backend/payments_api.py、backend/cms_api.py，解压后需 `pm2 restart gogo589-backend`；首次需在后台「商品評論」点「一鍵補齊歷史好評」。

## 待办 / Blocked
- P1 自托管：storage.py 改本地磁盘/OSS/S3；translate.py 改用户自有 OpenAI Key。
- P1 [BLOCKED-用户操作] Stripe 账户 charges_enabled=False，Boleto/Alipay 不稳定。
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

## [2026-06] 總後台（多平台 Hub）改為主站隱藏路徑 /12334（取代獨立 8101 服務）
- 用戶要求：不要單獨端口，統一用 gogo589.com/12334 進入。已刪除 /app/hub 獨立服務。
- 新增 `backend/hub_console.py`：獨立帳號登入（HMAC token，12h，5 次失敗鎖 15 分），API 前綴 `/api/hub-admin/*`（login / platforms / platforms/{pid}/test / stats / orders / members / alerts），資料與平台設定直接複用 `hub_api.py`（與 /gg589-k7p2x 後台「平台接入」共用同一份設定，本站 gogo589 自動包含）。
- 頁面 `backend/hub_static/index.html` 由後端在 `GET /{HUB_PATH}` 及子路徑返回（no-store）。
- backend/.env 新增：HUB_PATH、HUB_ADMIN_USER、HUB_ADMIN_PASSWORD、HUB_SECRET（缺任一則登入回 503 提示）。
- 部署：用戶 Nginx 需加 `location /12334 { proxy_pass http://127.0.0.1:8001; }`，見 `docs/hub_console_deploy.md`；patch.zip 含 server.py / hub_console.py / hub_api.py / hub_static / docs。
- 預覽環境 /12334 會被 ingress 導到前端 3000，驗證用 localhost:8001/12334（本機 playwright 全流程通過）。

## [2026-06] 總後台直接對接 Giftray 與四方 USDT 平台（適配器，對方無需改代碼）
- `backend/hub_giftray.py`：調用 Giftray 後台管理 API（Base https://lpw-888.com/api，Header X-Admin-Api-Key）/admin/orders、/admin/recharges、/admin/users、/admin/pending-counts、/settings(usdtRate)，映射為 Hub 規範 rows；HKD→USD 換算（usdtRate 1~20 之間取用，否則 7.8），row 額外帶 `amount_label`（原始 HK$）；排除 isTest；need_info 狀態；禮品卡判定 transactionNo/autoReview/redeemed；paid_at=createdAt（餘額扣款即付款）。
- `backend/hub_sifang.py`：調用四方 Admin Open API（Base https://域名/api/admin-api，Header X-Api-Key，回應 {code,msg,data} 自動解包）/orders、/accounts、/support/threads；kind=sifang 視為充值平台（只出現在充值/會員/統計）；狀態 pending→pending_payment、confirming、paid、expired。
- `hub_api.py`：`ADAPTERS={"giftray","sifang"}` 在 `_remote` 分派；`is_topup(p)` 取代 `kind=="topup"` 判斷；平台 tag 帶 kind。10 秒 TTL 快取避免 8 秒輪詢壓力。
- UI：總後台 `/12334` 與 React `HubPlatformsAdmin` 類型下拉新增兩個「直接對接」選項，金鑰標籤/placeholder 隨類型變化；訂單表顯示 amount_label、新狀態標籤（待填資料 / 鏈上確認中 / 已過期）。
- 已用本機 mock 伺服器（8102 Giftray、8103 四方）驗證：測試連線、stats 匯總、orders/topups 映射、搜尋、members、alerts、401 錯誤回報。真實金鑰待用戶填寫。
- 文件：`docs/hub_giftray_sifang_setup.md`；patch.zip 已更新（含兩適配器 + 前端兩檔，需 yarn build）。

## [2026-06] 四方收款平台數據獨立（用戶：「四方收款平台数据的单独的」）
- `hub_api._active()` 與 `/admin/hub/platforms/public` 排除 kind=sifang → 數據概覽 / 訂單充值 / 會員 / 客服只含商城（gogo589 + Giftray）。
- `hub_sifang.py` 新增 overview / order_list / account_list / thread_list / new_paid；`hub_console.py` 新增 `/api/hub-admin/sifang/{platforms,overview,orders,accounts,threads}`，alerts 併入四方 paid 單（type="sifang"）。
- 總後台 UI 新增側欄分組「收款平台（獨立）→ 四方收款」頁：4 個子頁（數據概覽 / 收款單 / 商戶帳戶 / 客服會話），多四方平台可切換；彈窗提醒標「四方收款」，全為四方時「查看訂單」跳四方頁。
- mock 驗證通過（8102/8103 本機假伺服器，測後已移除平台設定）。patch.zip 已更新。

## [2026-06] 總後台重構：按業務分菜單 × 平台分頁籤 + 管理員權限（用戶需求）
- 菜單：數據概覽（合計 + 各平台）/ 訂單管理 / 充值管理 / 客服管理 / 用戶管理，每頁以平台分頁籤（gogo589 本站 / Giftray / 四方USDT）獨立顯示；四方在訂單頁=全部收款單，充值頁=已支付入帳，用戶頁=商戶帳戶。
- `hub_console.py` 重寫：`/api/hub-admin/{me,overview,orders,topups,members,chats,alerts,platforms,admins,me/password}`，全部帶 `platform=` 參數；`need(module)` 依賴做模組權限，`_plat()` 做平台範圍校驗（無權限 404）。
- 管理員：超管 = .env HUB_ADMIN_USER；其他存 `db.hub_admins` {id, username, password_hash(bcrypt), modules[], platforms[], note, enabled, last_login_at}；停用即時失效（每次請求查庫）；普通管理員可改密碼。
- 客服：gogo589 讀 db.chat_sessions；Giftray 走 `/admin/chat/sessions`（hub_giftray.chats）；四方走 `/support/threads`；每頁有「進入該平台客服後台」按鈕。
- 本機驗證（mock 8102/8103 + playwright）：超管全流程、受限管理員只看到勾選模組與平台、403/404/401 正確；測試資料已清除。patch.zip 已更新。

- [2026-06] 總後台頁面同時可由 `/api/hub-admin/ui` 進入（預覽環境可用，正式站用 /12334）。

- [2026-06] 四方真實平台已接入預覽 Hub：base https://print8.8bc8uyz.com/api/admin-api（key 存於 settings.hub_platforms），實測 58 單 / 9 paid / 2660.9 USDT 與其 /stats 一致；sifang row 新增 remark 欄並可搜尋。

- [2026-06] Giftray 真實平台接通（lpw-888.com，key 已啟用 + IP 白名單 35.193.209.116 預覽出口）；409 單 / 422 充值 / 81 會員；拉取 limit 提高（列表 3000、統計 20000/5000）。

## [2026-06] 總後台可直接操作（訂單 / 充值 / 客服 / 四方資金）+ 操作權限 + 操作日誌
- 權限模組擴充：orders_write / topups_write / cs_write / funds_write（超管全有；管理員勾選）。
- `hub_console.py` 新增：`POST /orders/{platform}/{oid}/action`（local: complete→server.admin_confirm_topup、reject_info→admin_reject_info、cancel/processing→admin_update_order；giftray: /admin/orders/{oid}/status；sifang: manual-callback 需 funds_write）、`POST /topups/{platform}/{tid}/action`（local: payments_api approve/reject；giftray: approve/reject/gateway-sync/reverify）、`GET /chats/{platform}/{sid}/messages`、`POST .../reply`、`POST .../close|reopen`、`POST /sifang/{platform}/accounts/{aid}/adjust`、`GET/POST /sifang/{platform}/payouts[...]`、`GET /logs`。server 函數經 importlib 延遲載入避免循環引用；操作者 user_id="hub:<user>"。
- 所有寫操作記錄到 `db.hub_logs`；管理員頁底部顯示最近 100 筆。
- UI：訂單/充值表「操作」欄按狀態與權限顯示按鈕（prompt 輸入原因）；客服會話點擊開右側對話抽屜（5 秒輪詢、回覆、結束/重開）；用戶管理四方頁籤含加款/扣款/凍結與待審提現單；視圖寫入改用 pageShell 回傳的 body 元素，避免切頁競態。
- 驗證：mock Giftray 寫接口 + 本站真實 reply/processing + playwright 全流程通過；真實 Giftray / 四方僅做讀取測試，未對其做寫操作。

- [2026-06] 訂單/充值頁新增狀態分組篩選（全部/待處理/已完成/已取消 → META_STATUS/TOPUP_META 於 hub_console）、類型下拉、「待處理 N 筆可操作」提示；列表上限提高到 500。Giftray 真實客服回覆已實測成功（訪客 7108C8）。

## [2026-06] 總後台改為「工作台」介面（用戶：要像原平台後台一樣完整操作，選 a 三平台統一介面）
- 後端新增：`GET /orders/{platform}/{oid}`（詳情：items/fields/need_fields/timeline/admin_note/transaction_no/extra；local 讀 db.orders；giftray 從 /admin/orders 快取找；sifang /orders/{no}）、`GET /topups/{platform}/{tid}`（網絡/地址/tx_hash/憑證 proof_image/bank/extra）、`GET /chats/{platform}/{sid}/customer`（客戶 + 最近訂單/充值）、`GET /chats/{platform}/quick-replies`、`POST /orders/{platform}/{oid}/note`（備註 / Giftray 交易號）。`/me` 平台含 origin 供相對圖片 URL 補全。
- 前端：訂單/充值列表點行開右側詳情抽屜（含大按鈕操作）；客服改三欄工作台（列表 + 對話 + 客戶資料），Enter 送出、快捷回覆、結束/重開、5 秒輪詢、未讀增加提示音；新訂單彈窗「查看訂單」直接開詳情。
- 驗證：playwright 全流程（gogo589 + Giftray 真實資料讀取、本站回覆）通過。patch.zip 已更新。

## [2026-06] 用戶檔案與調整 / 客服轉接與圖片回覆 / 批量處理（日報用戶選「不要發」，未做）
- 權限新增 members_write（用戶管理操作）。
- `GET /members/{platform}/{uid}`（local: users+orders+topups+wallet_transactions；giftray: /admin/users/{uid}/detail；sifang: 帳戶 + 其收款單）、`POST /members/{platform}/{uid}/action` {adjust|disable|enable}（local: server._wallet_tx + admin_api ban/unban；giftray: /balance {delta HKD} 與 /disable）。
- 客服：`ReplyIn` 支援 image_b64（local 直傳；giftray 先 /admin/chat/upload 再發 image URL）與 image_url（sifang 貼網址）；`GET /cs-agents`、`POST /chats/{p}/{sid}/assign` 存 db.hub_chat_assign（總後台內部指派，三平台通用），列表帶 hub_assigned、「我的」篩選。
- 批量：`POST /orders|topups/{platform}/batch` {ids, action, remark} 逐筆呼叫單筆處理，回 {ok, failed[]}；前端表格勾選 + 底部批量列。
- UI：用戶行點開檔案抽屜（基本資料、加款/扣款/停用、全部訂單可點開、充值、餘額變動）。
- 驗證：playwright（本站加扣款 ±5 餘額正確回復、Giftray 用戶詳情讀取、批量標記處理中、附圖回覆入庫、轉接徽章與「我的」篩選）通過。

## [2026-06] 四頁改為「進入原平台後台頁面」（用戶最終要求）+ 客服未讀提醒 / 今日 vs 昨日 / 備註歷史 / 匯出 / 原平台操作流程
- 訂單/充值/客服/用戶 四頁預設以 iframe 嵌入各平台原後台頁（`embedView`，右上可切換回內建工作台，偏好存 localStorage hub_embed）。平台 URL 欄位新增 orders_url / topups_url / members_url（PlatformIn），本站預設 /gg589-k7p2x?s=giftcard-orders|topups|members|chat-sessions；其他平台留空時用 admin_url。Giftray/四方皆無 X-Frame-Options，可嵌入；Giftray `https://lpw-888.com/admin` 會跳回商城首頁，正確後台網址待用戶提供。
- 內建工作台的訂單操作改為鏡像原後台：本站 確認充值完成 / 駁回充值資料 / 開始充值 / 確認人工發貨 / 標記已完成 / 標記異常 / 取消訂單 / 直接改狀態（action: ship, mark_completed, exception, set_status）；Giftray 完成 / 開始處理 / 退回填寫 / 取消退款 / 補號並重審 / 重新產生交易號。
- 備註歷史 db.hub_order_notes（每筆帶操作者與時間，含操作附帶原因）；`GET/POST /orders/{p}/{oid}/notes|note`。
- `GET /cs-unread`（側欄客服徽章 + 新訊息提示音，10 秒輪詢）、`GET /today`（數據概覽合計頁「今日 vs 昨日」條，北京日切）、前端 CSV 匯出（篩選結果，BOM，Excel 可開）。
- 日報：用戶選擇不要發送，未做。

## 2026-10-17 更新
- Hub 總後台：Giftray 平台（base_url 含 lpw-888.com）的 admin/orders/topups/members/cs 五個入口，若未填或仍是舊預設 `https://lpw-888.com/admin`，自動改為真實後台 `https://lpw-888.com/lpw-boss-7q3x9`（`hub_console.py: _urls`）。平台接入頁佔位提示與 docs 同步更新。
- 補丁包 `/app/export/patch.zip`（hub_console.py / hub_static/index.html / docs）可經 `/api/_export/<DATA_EXPORT_TOKEN>/patch.zip` 下載。
- 待辦 P1：translate.py 改用用戶自有 OpenAI Key（等待用戶提供）。
- 提醒邏輯調整：新訂單彈窗不再每 12 秒重播音效（只響一次，`NewOrderAlert.jsx`）；桌面通知（Notification）改為只要權限已允許就彈出（不限頁面在背景），首次點擊頁面自動請求通知權限；`desktop` 偏好預設開啟。
- 新增 `backend/reset_for_launch.py`：正式上線清數據腳本（預覽模式 / `--yes` 執行，先備份 zip）。清除會員(非 admin)、訂單、充值、錢包/積分流水、聊天、日誌、抽獎、驗證碼等；保留商品/分類/評價/設定/管理員/翻譯。用戶選擇：reviews 保留、admin 保留、僅在 Windows 伺服器執行（預覽環境未清）。
- 新增 `POST /api/admin/system/launch-reset`（require_super + X-Admin-Token）：body `{confirm:"RESET", keep_admin_emails:[]}`；不帶 confirm 回 preview 計數；reset_for_launch.py 拆成 plan()/execute() 供腳本與 API 共用。生產 www.gogo589.com 已確認仍有測試數據（13 會員 / 15 待處理訂單），待用戶部署 patch 後由 agent 遠端觸發（Clerk ticket→session jwt 流程可用：admin login→totp→ticket→FAPI /v1/client/sign_ins strategy=ticket）。預覽環境已清空，僅留 admin@gogo589.com。
- [2026-10-17] 人工轉贈提醒：`_gift_auto_review` 未命中且 gift_auto_failed（用戶重提帳號）時寫入 `gift_manual_at`；`/api/admin/alerts` 新增 `manual` 列表；後台彈出紅色「待人工轉贈」持久彈窗（NewOrderAlert manual 模式，顯示轉贈帳號）+ 聲音 + 桌面通知；「前往人工轉贈」跳到 訂單管理→禮品卡訂單→未命中·待人工 分頁（sessionStorage gco-status）；列表轉贈資料欄加紅字提示「用戶已重新提交帳號 · 請人工轉贈後點完成」。生產 www.gogo589.com 數據已由用戶執行 reset_for_launch.py 清空（dashboard users 1 / wallet 0 / pending 0 已驗證）。
- [2026-10-17] 錢包充值頁移除「USDT 充值單等待付款中」面板（用戶要求），保留每 5 秒輪詢自動入帳 toast。
- [2026-10-18] USDT 自有地址模式：收款方式→USDT（provider crypto）config 新增 `wallet_address` / `network` / `wallet_note`；填寫地址後 `/me/wallet/topup/usdt` 不走四方網關，直接建立 own_wallet 充值單（24h 有效），用戶在充值記錄頁看到 QR + 地址 + 金額 + 網路，填 TXID 或上傳截圖 → reviewing → 後台「充值審核」審核通過（approve 用 tx_hash 作 tx_id）/ 駁回；`/payment-methods` 公開回傳 `own_wallet` 布林；後台充值列表顯示 TXID、Tronscan 連結。留空地址則維持原網關流程。
- 伺服器事故（10-17）：server.py 依賴 hub_*.py、Admin.jsx 依賴多個 admin 頁面但伺服器缺檔 → 502/500；改為打包完整原始碼 patch（backend/*.py + hub_static + frontend/src + public，~14MB）後恢復。以後 patch 一律用完整打包指令。
- [2026-10-18] 自有 USDT 收銀台頁 `/pay/usdt/:tid`（`pages/UsdtPay.jsx`，獨立於 StoreLayout，無站點 header）：仿四方收銀台 — 待付款圖示、金額+複製、「含小數尾數」提示、30 分鐘倒數、TRC20 地址（數字加粗）+複製、紅字警示、黃色提示框、含 Tether logo 的 QR + 保存二維碼、幣種/公鏈/數量/訂單號、「正在監聽鏈上到賬」、聯繫客服、充幣說明 7 條、常見教程 5 條、語言切換、ServiceWidget。已到賬/已過期狀態頁。
- 後端：`_unique_usdt_amount`（同地址待付單金額加 0.01–0.99 唯一尾數）、`_tron_find_payment`（TronGrid public API 查 TRC20-USDT 轉入，金額精確匹配、tx 去重）、`_own_wallet_check`（8 秒節流，在 `/me/wallet/topup/{tid}` 輪詢時觸發；pending/24h 內 expired 皆可補到賬）。可選環境變數 `TRONGRID_API_KEY` 提高限額。
- i18n：`scripts/i18n_keys.json` 由 src 掃描更新（1882 keys），zh-CN/en 字典已重生成。

## 2026-10-18 更新（移除多平台 Hub UI + 能量租賃入口 + USDT 到賬聊天提醒）
- **移除多平台 Hub 菜單/UI（後端檔案保留，單站純淨版）**：用戶確認只移除前台菜單/界面。
  - `Admin.jsx`：移除 import HubPlatformsAdmin/HubMembersAdmin；用戶管理去「多平台會員」(hub-members)、系統配置去「平台接入」(hub-platforms)；移除 SECTIONS 兩項、hubPlats state + `/admin/hub/platforms/public` 拉取、extCs 外部客服菜單與 setSectionOrExt。
  - `OrdersHubAdmin.jsx`：訂單管理去掉「多平台訂單/充值」第三頁籤（移除 HubOrdersAdmin import + Layers），僅剩 禮品卡訂單 / 全部訂單。
  - `DashboardAdmin.jsx`：移除 HubStatsCards import 與數據概覽頂部統計卡。
  - `RolesAdmin.jsx`：權限分組去 hub-members / hub-platforms。
  - 後端 `hub_api.py / hub_console.py / hub_giftray.py / hub_sifang.py` 與 `/12334` 路由**保留未刪**（server.py 仍 include，避免 import 破壞）；`HubAdmin.jsx / HubPlatformsAdmin.jsx` 成為孤兒檔（無 import，保留）。日後若要真正縮小補丁再議。
- **能量租賃 省70% 入口**：收款方式(crypto) config 新增 `energy_url` 欄位（PaymentMethodsAdmin 可填）；`wallet_topup_usdt` own_wallet 分支把 energy_url 寫入 topup doc；`UsdtPay.jsx` 收銀台頂部在 pending 狀態顯示橙色漸層「能量租賃 省70%」banner（Zap 圖示 + ChevronRight），點擊新分頁開 energy_url；未填地址則不顯示。i18n 新增 3 keys（能量租賃 / 省70% / 轉賬手續費太高…）。
- **USDT 到賬聊天提醒**：`chat_api.system_notify(user_id, text)`（找/建該用戶 chat session，插入 sender=admin 系統通知訊息，unread_user+1）；`server._usdt_settle` 到賬入帳後 create_task 推送「您的 {pay_amount} USDT 已到賬，錢包餘額已更新為 USD$ {bal}」。鏈上自動偵測(_own_wallet_check→_usdt_settle)與後台人工審核(payments_api approve→settle=_usdt_settle)皆會觸發。郵件提醒沿用既有 topup_paid（notify_user）。
- 測試：`backend/tests/test_usdt_energy_chat.py` 直接驗證 energy_url 落庫 + 唯一小數金額 + 到賬入帳 100.0 + 聊天系統訊息插入 unread_user=1，全 PASS（Clerk 阻擋 headless，故採後端直測）。前端 webpack 編譯成功、i18n JSON 有效、無 console 錯誤。
- patch.zip 已重新打包（backend/*.py + hub_static + frontend/src + public，~13.8MB），含本次全部改動與重生成 i18n 字典；用戶解壓後 `pm2 restart gogo589-backend` + `cd frontend && yarn build`。
