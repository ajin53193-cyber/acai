# 四方收款平台 (USDT Aggregated Payment Platform) — PRD

## Original Problem Statement
构建一个"四方收款平台"：聚合 USDT 收款的四方支付系统，含平台管理后台、代理/渠道端、商户端三类角色。

## User Choices
- 角色：平台管理后台（审核/配置/对账）+ 代理商端（下级商户/分润）+ 商户端（下单/收款/结算）
- 收款通道：USDT（TRC20 / ERC20 / BEP20），链上到账为模拟（MOCKED，无真实区块链对接）
- 认证：平台自建账号密码（JWT）
- 风格：专业金融深色后台（数据密集型）

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT (Bearer + cookie), bcrypt. All routes under `/api`.
- Frontend: React (CRA/craco) + Tailwind + shadcn/ui + recharts + sonner, dark fintech theme.
- Auth: JWT stored in localStorage (`sf_token`), Authorization Bearer header; role-based routing.

## User Personas
- 平台管理员(admin)：全局数据、通道路由配置、商户/代理账户与余额、对账分润、提现审核。
- 代理商(agent)：管理下级商户、查看分润、申请提现。
- 商户(merchant)：创建收款单、查看订单、申请提现、API 密钥。

## Core Requirements (static)
1. 登录认证与角色权限（admin/agent/merchant）
2. 数据总览仪表盘（交易量/成功率/利润/趋势图）
3. 订单与收款管理（创建、筛选、实时状态、模拟支付、收银台）
4. 通道路由配置（USDT 多链、权重、费率、限额、启停）
5. 结算分润与对账（按商户聚合、费率拆分、CSV 导出、提现队列）
6. 商户/代理账户管理（创建、费率、余额调整、冻结、API 密钥）

## Implemented (2026-06)
- [x] JWT 登录/登出/me，admin 种子账号 ajin53193@gmail.com + 演示 agent/merchant
- [x] 角色数据域隔离（admin 全量 / agent 下级商户 / merchant 本人）
- [x] 仪表盘：KPI 卡、7日面积图、柱状图、实时订单流水（10s 自动刷新）
- [x] 订单：列表+筛选+搜索、创建收款单（选商户/金额/链）、模拟支付、详情、收银台链接
- [x] 公共 USDT 收银台 /pay/:orderNo：二维码、地址复制、15分钟倒计时、模拟到账
- [x] 通道：卡片列表、新增、费率/权重/限额、启停开关、加权路由
- [x] 结算：按商户对账聚合、费率拆分（手续费/实收/分润/平台利润）、CSV 导出、提现申请与审核
- [x] 账户：admin 管理商户+代理（Tab）、创建、余额调整/冻结、API 密钥重置；agent 仅管理下级商户
- [x] 种子数据：1 admin + 1 agent + 3 商户 + 3 通道 + 120 订单（近7天）
- [x] 测试：后端 21/21、前端 100% 通过

## Implemented (2026-06, iteration 2)
- [x] 真实 TRC20 链上收款：通道配置 wallet_address → 订单 live=true，金额唯一尾数 (pay_amount) 匹配；后台每 20s 轮询 TronGrid（仅在有待支付订单时），tx_id 去重 (chain_txs)；POST /api/chain/sync 手动同步；GET /api/chain/txs；live 订单禁止模拟支付；收银台显示精确到账金额
- [x] 商户回调通知：notify_url（商户默认 PATCH /api/accounts/me/notify 或订单级）；支付成功入队 callbacks，worker 每 5s 投递，HMAC-SHA256(api_secret) 签名（key 升序 k=v& 排除 sign/空值），响应含 success 视为成功，失败按 15s/1m/5m/30m/2h 重试 5 次；GET /api/callbacks、手动重试、测试接收器 /api/callbacks/test-receiver、签名示例 /api/callbacks/sign-preview；前端 /callbacks 页
- [x] 操作审计日志：audit_logs 记录余额调整/冻结/提现审核/通道增改/密钥重置/账户创建/手动核账/回调地址设置（含操作人、IP、before/after）；GET /api/audit-logs（admin，按操作类型/操作人筛选）；前端 /audit 页
- [x] 修复 AccountsPage useEffect lint 警告
- [x] 测试：后端 17/17（修复 sign-preview 空值字段后）、前端通过

## Implemented (2026-06, iteration 3)
- [x] 商户开放 API：POST /api/v1/orders、/api/v1/orders/query，api_key + timestamp(±300s) + nonce(防重放, 10min TTL) + HMAC-SHA256 sign（key 升序 k=v&，排除 sign/空值，整数值浮点规范为整数），out_trade_no 幂等；商户前端「开发者 API」页（凭证、文档、浏览器本地签名在线调试）
- [x] 到账提醒：GET /api/notifications/paid?since；Layout 每 6s 轮询 → sonner toast + WebAudio 提示音，头部音量开关（localStorage sf_sound）
- [x] 登录防爆破：按邮箱 5 次失败/15 分钟 → 锁定 15 分钟 (HTTP 423)，成功登录清零；审计 auth.login_failed / auth.locked / auth.unlock（真实 IP 取 X-Forwarded-For）；admin GET /api/auth/lockouts、DELETE /api/auth/lockouts/{email}
- [x] 通道多收款地址池：channel.wallet_addresses[]，下单选待支付最少的地址，金额尾数 0.0001–0.9999（单地址 9999 并发）；通道卡片显示地址池与各地址待付数；监听器遍历全部地址（每地址间隔 1s）
- [x] 测试：后端 16/16、前端全通过

## Implemented (2026-06, iteration 4)
- [x] 收银台重做：浅色移动端优先，参考图 1:1（状态图标、金额复制、地址数字加粗、带 USDT 标识二维码、保存 QR、信息表、7 条注意事项、常见教程）；简体/繁體/English 切换（localStorage sf_pay_lang）
- [x] 能量租赁板块：admin「收银台设置」可配置 TRX 地址/价格文案/4 条租赁条款/客服链接/教程链接（PUT /api/checkout/settings），不配置不显示；默认条款内置三语
- [x] 多链监听：ERC20/BEP20 通过 Etherscan V2 统一接口（需 ETHERSCAN_API_KEY，未配置时地址状态显示异常）；chain/sync 返回 errors 不再 4xx
- [x] 地址健康巡检：/addresses 页，链上 USDT 余额（每 5 分钟自动刷新）、同步状态、待付负载、累计到账、浏览器链接；GET /api/chain/addresses、POST /refresh
- [x] 商户 IP 白名单：PATCH /api/accounts/me/ip-whitelist，/api/v1 校验来源 IP（X-Forwarded-For），拦截写审计 api.ip_rejected；开发者 API 页维护
- [x] 代理分润 Excel：GET /api/reports/agent-commission?month&agent_id，3 Sheet（月度汇总/按商户明细/逐单明细）；结算页导出按钮（admin 选代理）
- [x] 常见教程：5 篇内置图文教程（用户提供文案，含交易所/VPN 链接自动可点），收银台点击标题底部弹层展开；admin 可改标题/改为外链
- [x] 测试：后端 23/23、前端全通过

## Implemented (2026-06, iteration 5)
- [x] 教程全文后台编辑：收银台设置改为 Tab（品牌/能量租赁/常见教程），教程编辑器支持标题/外链/正文、排序、新增删除；收银台点击弹层展示
- [x] Etherscan Key 已配置；免费版不覆盖 BSC → 自动回退公共 RPC (publicnode) eth_getLogs/eth_call，BEP20 余额与到账监听已实际跑通
- [x] 收银台品牌化：顶部左侧显示商户名称 + 三语副标题，可选 Logo URL；能量租赁默认折叠；按新参考图调整文案（充币地址/保存二维码/充币数量/订单号/充币说明）与字号
- [x] 测试：后端 7/7、前端全通过

## Implemented (2026-06, iteration 6)
- [x] 地址余额预警：余额突变（≥pct% 且 ≥min_abs USDT，默认 10%/100）与同步失败超时（默认 10 分钟）生成 alerts；admin 头部铃铛（未读角标、弹层列表、全部已读、阈值设置），新预警 toast + 提示音；GET/PUT /api/alerts/settings
- [x] 收银台主题色：settings.theme_color（#RRGGBB 校验）→ 收银台 CSS 变量 --accent（链接/头像/二维码标识），后台取色器 + 预设色
- [x] TronGrid Key 已配置（429 消失）；EVM RPC 拉取限制 3000 块/150 条 + 25s 超时，chain/sync 由 502 降至 ~5s
- [x] 测试：通过（见 iteration_6.json）

## Implemented (2026-06, iteration 7)
- [x] 订单搜索增强：订单号 / TxID / 商户单号 (out_trade_no) / 钱包地址 / 商户名 模糊 + 金额精确匹配；详情显示商户单号
- [x] 收款地址管理页（/addresses）：地址池增删（有待付订单禁止删除）、暂停/恢复分配（暂停地址不再分配新订单）、标签备注、总余额与分链余额、冷钱包归集标记（金额/冷钱包/TxID/备注）与归集记录；审计 address.*
- [x] 测试：通过（见 iteration_7.json）

## Implemented (2026-06, iteration 8)
- [x] 商户月账单 Excel：GET /api/reports/merchant-statement?month&merchant_id（商户本人/代理下级/admin/有 reports.export 的操作员），4 Sheet（月度汇总/收款明细/提现记录/余额调整）；结算页按钮
- [x] Telegram 推送：settings.notify（bot token 掩码存储、chat id、三类开关），铃铛弹层内配置 + 发送测试；地址预警/归集提醒/大额到账（≥big_payment）自动推送；notify_log
- [x] 归集提醒：余额 ≥ sweep_threshold（默认 10000）生成 sweep_due 预警（6 小时冷却）；阈值设置新增 归集阈值/大额阈值
- [x] 操作员子账号：role=operator + permissions[]（9 项），get_current_user 按路径→权限映射统一鉴权（禁止账户创建/冻结/密钥/收银台设置/锁定管理）；账户页「操作员」Tab、权限勾选与编辑；侧栏按权限显示
- [x] 测试账号 operator@demo.com / operator888（orders.view, orders.verify, payouts.review, audit.view）

## Env (optional)
- ETHERSCAN_API_KEY：ERC20/BEP20 监听与余额必需（Etherscan V2 免费 Key，https://etherscan.io/apis）
- TRONGRID_API_KEY：公共接口限速较严 (429)，生产建议配置 TronGrid Key

## Mocked
- ERC20 / BEP20 及未配置收款地址的 TRC20 通道仍为模拟到账（simulate-pay）。配置了地址的 TRC20 通道为真实链上监听。

## Implemented (2026-06, iteration 9)
- [x] 操作员操作留痕视图（/operators，仅 admin）：左侧操作员列表（操作次数/最近操作/2FA 状态），右侧按时间线展示该员工全部审计记录；GET /api/operators、GET /api/audit-logs?actor_id=
- [x] 两步验证 2FA/TOTP（admin + operator）：验证器 App（pyotp），自助绑定页 /security（二维码 + 密钥 + 验证码启用/关闭），登录时 totp_enabled 的 admin/operator 需二次验证（POST /api/auth/login 无 code 返回 {requires_2fa:true}）；管理员强制 POST /api/accounts/{id}/require-2fa（强制者不可自行关闭）
- [x] 商户余额变动流水（/ledger，admin/agent/merchant）：收款入账/代理分润/提现冻结/提现完成/驳回退回/人工加扣款/冻结解冻，含运行余额 balance_after；GET /api/balance/ledger、Excel 导出 GET /api/reports/balance-ledger；settle_order/payout/adjust 均写 balance_ledger，启动时从历史已付订单回填
- [x] 测试：后端 20/20、前端 100% 通过（见 iteration_9.json）；admin 账号登录测试后已确认 2FA 关闭

## Implemented (2026-06, iteration 10)
- [x] 2FA 失败锁定：登录时 2FA 验证码错误也计入 5 次/15 分钟防爆破锁定（record_login_failure），连续失败 → HTTP 423
- [x] 资金流水月份筛选：GET /api/balance/ledger?month=YYYY-MM；/ledger 页「全部时间/按月份」切换，前端按月实时筛选表格
- [x] 2FA 安全邮件（Emergent 托管 Resend）：启用/关闭/登录验证失败 时后台 fire-and-forget 发送安全提醒邮件至账户邮箱（notify_security，asyncio.create_task，不阻塞响应；429 限流降级为 DEBUG 日志）
- [x] 重构起步：邮件逻辑抽离至独立模块 backend/email_utils.py（发件网关校验 + send_email + notify_security），server.py 仅 import 使用
- [x] 测试：后端 20/20、前端 100% 通过（见 iteration_10.json）；admin 账号确认 2FA 关闭

## Implemented (2026-06, iteration 11)
- [x] 订单详情完善：订单详情弹窗补全 网络/收款地址/TxID/商户单号/回调地址/回调状态/手续费/实收/创建·支付·过期时间/收款模式，收款地址与 TxID 支持复制 + 区块浏览器外链
- [x] 订单列表新增「收款地址」列，点击弹出该地址链上到账记录（admin/operator）
- [x] 收款地址 → 链上到账记录：订单详情与「收款地址」页可点开 ChainTxDialog；GET /api/chain/txs?address=&order_no=（admin/operator 专用，商户 403）
- [x] 手动回调 / 驳回订单：POST /api/orders/{id}/resend-callback、/reject（admin/operator，列表与详情按钮）
- [x] 平台安全加固：全局安全响应头、按 IP 限流(300/60s→429)、新设备登录邮件提醒、2FA 平台策略(/api/security/policy)
- [x] 测试：后端 26/26、前端 100% 通过（见 iteration_11.json）

## Implemented (2026-06, iteration 12)
- [x] 每日收款统计 + 日期查询：GET /api/dashboard/stats?date=YYYY-MM-DD（返回 stat_date 及当日订单/成功/成功率/金额）；仪表盘加日期选择器，**仅总后台(admin/operator)可见**
- [x] 商户后台收敛为「仅报表」：移除 商户 的 数据总览/订单与收款/回调通知 菜单与路由，保留 资金流水(对账)+结算分润+开发者API；商户登录默认首页重定向 /ledger；/orders、/callbacks 对商户做角色保护
- [x] 代理商不展示每日收款统计

## Implemented (2026-06, iteration 13)
- [x] 商户统计 Excel 导出：GET /api/reports/merchant-stats（单日/区间）；/merchant-stats 页「导出 Excel」
- [x] 日期区间汇总：商户统计与资金流水均支持 单日/按月/按区间（start~end）；GET /api/stats/merchants、/api/balance/ledger、对应报表均加 start/end
- [x] 下钻明细：点击商户统计行跳转 /orders?merchant_id=&date=|start=&end=，GET /api/orders 新增 merchant_id/date/start/end 过滤
- [x] 导航固定：外层 h-screen overflow-hidden，仅 main 区域滚动，侧栏与顶栏固定不随页面滑动
- [x] 顶栏不透明修复（iteration 12），商户后台收敛为仅报表（iteration 12）
- [x] 测试：后端 10/10、前端 100%（iteration_13.json）

## Implemented (2026-06, iteration 14)
- [x] 仅保留总后台：后端登录拦截 merchant/agent（返回 403），仅 admin/operator 可登录后台
- [x] 导航精简为总后台菜单：移除 开发者API，资金流水限 admin；商户/代理相关入口移除
- [x] 登录页演示账号改为 管理员/操作员
- [x] 商户/代理为纯数据实体，由管理员在总后台管理（商户经收银台与开放 API 对接）

## Backlog
- P1: 获取 ETHERSCAN_API_KEY 后验证 ERC20/BEP20 真实到账
- P2: 代理多级分润（当前单级）
- P2: server.py 进一步拆分为路由模块（现 ~2389 行，email 已抽出；建议继续拆 auth/orders/settlements/ledger/operators）
- P2: admin 账户删除接口（清理测试遗留账户 test_2fa_*@demo.com）

## Next Tasks
- 按需接入真实支付/链上监听，或扩展回调通知与对账自动化。
