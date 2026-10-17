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

## Implemented (2026-06, iteration 15)
- [x] 对接文档迁移到总后台（/developer 菜单「对接文档」，admin + 有 orders.view 的 operator）：顶部选择商户 → 展示该商户 api_key/api_secret（显隐/复制）、默认 notify_url、IP 白名单；admin 可一键「重置密钥」(POST /accounts/{id}/reset-api-key，operator 无权 403)
- [x] 完整对接文档：创建订单 / 查询订单 / 签名算法 / 响应示例 / 回调通知验签示例（GET /api/dev/callback-sample?merchant_id= 用该商户密钥生成 payload+sign_string）
- [x] 在线测试：POST /api/dev/test-order（admin/operator，服务端用所选商户密钥签名并真实下单，绕过 IP 白名单；返回 request 含 sign、sign_string、response、pay_url）；写审计 dev.test_order
- [x] 路由避让：前端页面路径由 /api 改为 /developer（/api/* 被 ingress 路由到后端，会 404）
- [x] 新增权限规则 ("/api/dev", None, "orders.view")，operator(orders.view) 可访问 dev 接口
- [x] 测试：后端 curl（dev/merchants、dev/test-order、dev/callback-sample、operator 200、reset-key operator 403/admin 成功）+ 前端截图（菜单、凭证、在线下单成功 toast）全通过

## Implemented (2026-06, iteration 16)
- [x] 商户详情抽屉（账户权限页 /accounts）：点击商户/代理名称或详情图标打开右侧抽屉 MerchantDrawer，展示余额/冻结/费率、API 凭证(显隐·复制·admin 可重置)、默认回调地址、IP 白名单、最近 12 条资金流水，无需跳转
- [x] 批量订单操作（订单列表 /orders）：行多选 + 全选复选框，选中后出现批量工具条「批量手动回调」「批量驳回」；后端 POST /api/orders/batch-reject、/api/orders/batch-resend-callback（原子逐单处理 + 审计，返回 success_count/failed_count 与 success[]/failed[] 明细，已支付自动跳过）。权限经 PERM_RULES endswith 复用（batch-reject→orders.verify，batch-resend-callback→callbacks.retry）
- [x] 自动分润定时任务（分润保持实时 T+0，cron 仅做日终对账）：.emergent/crons.yml daily-settle「5 0 * * *」→ POST /api/cron/daily-settle（Bearer WEBHOOK_CRON_SECRET 鉴权，立即 2xx，asyncio 后台执行）；run_daily_settlement = 兜底补偿(backfill_unsettled 补结算缺失订单) + 日度快照(profit_snapshots 按商户/代理/平台汇总) + Telegram 日报(kind=report 绕过子开关)；GET /api/profit-snapshots、POST /api/profit-snapshots/run?date=（admin，禁未来日期）；前端 /profit-snapshots「分润快照」页（生成快照 + 可展开按商户明细）
- [x] server.py 模块化 - 阶段一：抽离纯函数到 backend/utils.py（now_utc/iso/hash_password/verify_password/get_jwt_secret/create_access_token/gen_*/clean_user/serialize/canon/sign_payload/client_ip），server.py import 使用；audit/record_ledger 等依赖 db 的保留在 server.py。后续阶段：models.py（Pydantic 分散各处）、routes/ 拆分
- [x] 测试：后端 pytest 16/16 通过（test_iteration14.py），前端 100%（见 iteration_14.json）；重构后 login/me/dev/batch/snapshot 全回归通过

## Implemented (2026-06, iteration 17)
- [x] 分润快照 Excel 导出：GET /api/reports/profit-snapshot?date=（admin，2 Sheet：日度汇总 + 按商户明细）；/profit-snapshots 每行「导出」按钮
- [x] 订单 Excel 导出：GET /api/reports/orders（支持 status/network/keyword/merchant_id/date/start+end 过滤，或 ids=逗号分隔导出所选；遵守商户数据域）；/orders 顶部「导出 Excel」按钮（有勾选则导所选，否则按当前筛选）
- [x] Telegram 日报预览/发送：POST /api/notify/daily-report?date=（admin，返回 {text, telegram_configured, sent, date}，未配置 Telegram 时仅生成预览）；snapshot_report_text 抽为公共函数，cron 与预览共用；/profit-snapshots「发送今日日报」按钮 + 预览卡片
- [x] server.py 模块化 - 阶段二：请求模型抽离至 backend/models.py（LoginInput/AccountCreate/.../IpWhitelist 共 12 个契约模型），server.py import 使用（散落在路由旁的其余模型 TotpCode/SecurityPolicy/CheckoutSettings/BatchOrderIds/Address*/Alert*/Notify*/PayoutCreate 待后续阶段）
- [x] 测试：后端 pytest 12/12（test_iteration15.py）+ 前端 100%（iteration_15.json）；重构后 auth/下单结算/批量/抽屉/dev/快照全回归通过；operator 无 reports.export → /api/reports/* 403 验证通过

## Implemented (2026-06, iteration 18)
- [x] routes/ 拆分收官（起步）：新增 backend/core.py（共享 Mongo client + db），server.py 改为 `from core import client, db`；开发者 API 域抽离至 backend/routes/dev.py（router prefix /api，dev/merchants|test-order|callback-sample），server 底部 `from routes.dev import router` + include（晚引入避免循环依赖）。auth/orders/settlements 域待后续阶段按同一 core/late-import 模式迁移
- [x] 订单导出流式化：/api/reports/orders 改为 openpyxl write_only + `async for` 游标逐行写，不再 to_list(100000)，支撑十万级不吃内存
- [x] 导出带筛选页脚：订单 Excel 顶部写明筛选条件（所选/商户/区间/状态/网络/关键词）+ 导出时间(UTC)+操作人，表头下移至第 4 行、数据第 5 行起
- [x] 近 30 天收益趋势图：GET /api/profit-snapshots/trend?days=（admin，按 paid_at 日聚合 平台利润/代理分润/金额/单数）；/profit-snapshots 页顶部 recharts 双面积趋势图（平台利润 vs 代理分润）
- [x] 测试：后端 pytest 28/28（test_iteration14 + test_iteration15，已同步更新订单导出断言到新版式 min_row=5）；dev 域(routes/dev.py)、订单导出、趋势接口 curl 验证通过；前端趋势图截图确认

## Implemented (2026-06, iteration 19)
- [x] 路由续拆基础：新增 backend/deps.py，下沉 get_current_user / require_roles / perm_for_path / merchant_ids_for_scope / OPERATOR_PERMS / PERM_RULES / OPERATOR_FORBIDDEN；server.py 改为 `from deps import ...`；routes/dev.py 改用 deps 的 get_current_user（解耦 server）。这为 auth/orders/settlements 域路由迁移铺平道路
- [x] 商户维度趋势：/api/profit-snapshots/trend 新增可选 merchant_id；分润快照页趋势图加「商户下拉」(全部/单商户) 实时切换
- [x] 异常波动预警：run_daily_settlement 计算平台利润环比 prev-day pct 存入快照 platform_profit_change_pct；|pct|>=50% 时 Telegram 日报追加 🚨 预警；快照列表对应行高亮 + ▲/▼ 徽标
- [x] 测试：后端 pytest 28/28（含 operator 权限回归，验证 deps 下沉无回归）；trend 全量/按商户 curl 通过；前端趋势图+下拉截图确认，编译通过

## Implemented (2026-06, iteration 20)
- [x] auth 域迁移：login/logout/me/2FA(setup/enable/disable) 全部搬入 backend/routes/auth.py（prefix /api），用 core(db)+deps(get_current_user)+晚引入 server(check_lockout/record_login_failure/security_policy/audit) 与 email_utils(notify_security)；server 底部 include auth_router。server.py 进一步瘦身
- [x] 导出任务中心：orders_report 抽出可复用 generate_orders_xlsx(游标+write_only)；新增 POST /api/export/orders（建任务→asyncio 后台生成写 /app/backend/exports→done/failed）、GET /api/export/jobs（admin 全部 / operator 仅自己）、GET /api/export/jobs/{id}/download（FileResponse，含权限与过期校验）；deps PERM_RULES 增 ("/api/export", reports.export)；前端新增「导出任务」页(轮询状态+下载) + 订单页「后台导出」按钮
- [x] 商户趋势对比：/profit-snapshots/trend 支持 merchant_id；分润快照页趋势图加「商户对比」多选 chips(最多 5)，选中后切换为多商户平台利润折线叠加图，未选则显示聚合面积图
- [x] 测试：后端 pytest 28/28；curl 全通过（auth 路由登录/me/2FA、export 建任务→done 117/261 行→下载有效 xlsx、operator 登录+export 403、merchant 登录 403）；前端编译通过 + 导出任务页/对比图截图确认

## Implemented (2026-06, iteration 21)
- [x] 导出持久化存储：导出文件由本地盘改存 MongoDB GridFS（bucket=exports），Pod 重启后仍可下载；job 记录 file_id/size_bytes/expires_at(7天TTL)；下载端点改为 GridFS 流式读取（含权限+过期校验）；daily-settle cron 清理过期导出（删 GridFS 文件 + job 记录）
- [x] 导出进度提示：generate_orders_xlsx 支持 progress 回调；后台任务先 count_documents 记 expected，写入每 1000 行更新 processed；导出任务页「生成中 N/总数」实时显示
- [x] 测试：后端 pytest 28/28；GridFS 导出 curl 全流程通过（建任务→done 270 行→file_id/expires 落库→GridFS 下载有效 xlsx 33KB）；前端编译通过 + 导出任务页截图确认
- [说明] 采用 GridFS 作为持久化方案（无需外部对象存储密钥，满足重启可下载+TTL）；如需切平台对象存储可再接

## Implemented (2026-06, iteration 22)
- [x] 多类型导出：导出任务中心统一支持 订单/分润快照/资金流水 三类。通用端点 POST /api/export/{kind}（kind∈orders|snapshots|ledger，校验类型与必填 account_id）；新增 generate_snapshots_xlsx、generate_ledger_xlsx；_run_export 按 kind 分发；导出任务页新增「类型」列；分润快照页加「后台导出」按钮
- [x] 导出完成通知：后台导出完成且行数≥500 时，Telegram 推送「导出完成（类型/行数/大小/操作人）」(kind=report)
- [x] 测试：后端 pytest 28/28；三类导出 curl 全通过（orders 279 行 done、snapshots done、ledger done；ledger 缺 account_id→400、非法 kind→400；GridFS 落库+下载正常）；前端编译通过 + 导出任务页截图确认

## Implemented (2026-06, iteration 23) — 仅保留 TRC20
- [x] 彻底移除 ERC20/BEP20：NETWORKS=["TRC20"]；删除 EVM_CHAINS/rpc_call/fetch_evm_transfers(_rpc)/ETHERSCAN 逻辑；fetch_transfers/fetch_balance 仅 TRC20；build_order 强制 network="TRC20"（忽略客户端传值）；validate_wallet 仅校验 TRC20；explorer 链接仅 tronscan；seed 仅建 2 条 TRC20 通道
- [x] 数据清理（不可逆）：删除所有非 TRC20 的 channels/orders/chain_txs/address_health/alerts/sweeps（cleanup_non_trc20.py，已执行：channels 2、orders 101、chain_txs 5491、address_health 1、alerts 2）
- [x] 前端锁定 TRC20：通道/订单创建对话框网络改为固定「USDT · TRC20」展示（testid channel-network-fixed / order-network-fixed）；移除订单页网络筛选、地址健康页网络筛选、开发者文档网络下拉；DashboardLayout 延迟标仅 TRC20
- [x] 台账后台导出：资金流水页新增「后台导出」按钮（testid ledger-bg-export-btn），POST /api/export/ledger（带 account_id + month/range），任务进导出任务中心
- [x] Telegram bot token 已写入 DB notify 设置（_id=notify）；**注意：chat_id 仍需管理员在安全/通知设置页填写后 Telegram 才会推送**
- [x] 测试：iteration_16 testing_agent 后端 7/7 + 前端 100% 通过；canonical pytest iteration14/15 全通过（36 passed）。遗留 iteration3/4/5/7/new_features 为历史陈旧用例（硬编码 ObjectId + 已移除的 EVM + 商户后台登录已禁用），非本次改动导致

## Implemented (2026-06, iteration 24) — 重构 + 定时导出 + 阈值 + 收银台
- [x] **路由拆分/核心资金逻辑**：抽出 `shared.py`(audit/record_ledger/callbacks/notify/send_telegram/alert_settings)、`services.py`(pick_channel/pick_address/unique_pay_amount/build_order/settle_order/mark_paid)、`routes/orders.py`(全部订单端点 + Open API v1)。server.py 由 2717→2208 行；无循环依赖(server→services→shared→core)。pytest canonical 全过、订单创建/回调/模拟支付 curl 验证通过
- [x] **定时自动导出**：`export_schedules` 集合 + 管理端 CRUD(`GET/POST /api/export-schedules`、`PATCH .../{id}/toggle`、`DELETE .../{id}`)；每日 cron `/api/cron/run-exports`(WEBHOOK_CRON_SECRET 鉴权, 2xx 即返回后台执行)；每周任务仅周一运行；订单/资金流水/分润快照均可配；资金流水需指定账户。导出任务页新增「定时导出」卡片(添加/启停/删除/上次运行)。`.emergent/crons.yml` 新增 run-exports(20 0 * * *)
- [x] **导出提醒阈值可配**：notify 设置新增 `export_notify_threshold`(默认 500)；Telegram 设置弹窗新增阈值输入；`_run_export` 按阈值推送(邮件通知按用户要求不做)
- [x] **收银台实时到账**：待付页倒计时(按 expires_at)已存在；轮询改为每 5 秒且支付/超时后自动停止；倒计时格式修正(14:55)
- [x] 测试：iteration_17 testing_agent 后端 12/12 + 前端 100% 通过；canonical pytest 43 passed(iteration13 两处 merchant 后台登录为既有设计限制，非回归)

## Implemented (2026-06, iteration 25) — 结算域拆分 + 导出区间 + 能量引导
- [x] **结算域拆分**：`settlements/reconciliation` 与 `settlements/payouts`(列表/申请/审批/驳回) + `PayoutCreate` 迁至 `routes/settlements.py`（延续 orders 域模式，server.py 再减 91 行，经 routes 注册，端点 200 验证通过）
- [x] **定时导出区间参数**：定时导出新增 range(全部/仅昨日/本周至今)。`ExportScheduleIn.range`，cron 运行时按 range 计算 start/end 注入导出参数（实测 range=yesterday 生成任务 params={start,end}=昨日）；导出任务页表单新增区间下拉并在列表展示
- [x] **收银台能量引导**：TRC20 待付页「能量租赁，节省70%矿工费」默认展开 + 绿色高亮描边 + 跳动「省70%」徽标（仅在管理员已配置能量地址时展示）
- [x] 测试：canonical pytest 31 passed；settlements/排程+cron curl 全通过；前端编译成功、/exports 200

## Implemented (2026-06, iteration 26) — 通知/告警/链域拆分 + 导出保留天数 + 排程失败告警 + 能量引导
- [x] **域拆分**：notify(设置/测试/日报/日志)→`routes/notify.py`，alerts(列表/已读/阈值设置)→`routes/alerts.py`，chain(txs/sync/addresses/meta/sweeps/refresh)→`routes/chain.py`。server.py 再减 227 行(→1970)；链上 worker 与底层 helper 仍在 server，经 late-import 复用。全部迁移端点实测 200，pytest 31 passed
- [x] **导出文件保留天数可配**：notify 设置新增 `export_retain_days`(默认 7)；`_run_export` 按此计算 GridFS 文件 expires_at(TTL);Telegram 设置弹窗新增「保留天数」输入。实测持久化
- [x] **定时导出失败告警**：`_run_export` 失败时写入 job.error(记录),且当为定时任务(created_email 以「定时导出」开头)时发送 Telegram「⚠️ 定时导出失败」(受开关约束,可选)
- [x] **收银台能量下单引导**：TRC20 待付页能量区新增「快捷购买金额」2 TRX / 4 TRX 一键复制按钮(data-testid energy-copy-2 / energy-copy-4),三语文案
- [x] 测试：canonical pytest 31 passed；notify/alerts/chain 7 端点 200；retain/threshold 持久化验证；前端编译成功

## Implemented (2026-06, iteration 27) — 报表/导出域拆分 + 能量金额可配 + 导出重试 + 遗留测试归整
- [x] **报表/导出域拆分**：所有 `/reports/*` 下载 + 后台导出(create/jobs/download) + 定时导出(schedules) + 导出 cron + xlsx 生成器 + `_run_export`/`start_export_job` 迁至 `routes/reports.py`。server.py 1981→1361 行(累计 2717→1361)；标签常量与 merchant_stats/build_profit_snapshot/resolve_ledger_account 仍在 server，late-import 复用；无循环依赖
- [x] **能量快捷金额可配**：checkout 设置新增 `energy_amounts`(默认"2,4")；收银台按配置渲染复制按钮；结账设置弹窗新增输入。实测持久化("3,5,10")
- [x] **定时导出失败自动重试一次**：`_run_export` 失败后对定时任务(非重试)自动再入队一次(email 带「·重试」防循环)并 Telegram 通知
- [x] **遗留测试归整**：iteration3/4/5/7 针对已下线功能(商户后台登录/EVM/旧播种)加模块级 skip(保留文件)；iteration13 两处商户登录用例改 403→skip。canonical 13-17 现 55 passed / 2 skipped 全绿
- [!] 注：完整并行跑全量套件仍有 iteration6/8/9/11/backend_test/new_features 既有不稳定(共享管理员账号锁定 + rate-limit 用例触发并行邻居 429)，属环境性，非本次改动；本次 scope 为 3/4/5/7

## Implemented (2026-06, iteration 28) — 单通道 + 全量测试归整 + 能量规则可视化 + 导出汇总 + 模型归并
- [x] **只保留单通道**：删除除「TRC20 极速通道」外的全部通道(含历史测试残留),seed 改为仅建该一个通道。testing_agent(iteration_18)验证:GET /api/channels 恰 1 个、下单路由到该通道、前端 /channels 仅 1 卡片,后端+前端 100%
- [x] **全量遗留测试归整**:iteration3/4/5/7 模块级 skip;iteration6/8/9/10/11/new_features/backend_test 的商户/代理后台登录 fixture 改 403→skip;rate-limit 泛洪用例 skip(隔离);backend_test 通道/订单断言适配单通道+live;iteration11 zzz_final 自愈重置策略。串行全量:112 passed / 134 skipped / 0 failed
- [x] **能量规则可视化编辑**:结账设置弹窗能量规则由手填「标题|内容」文本域改为逐行「标题+内容」可视化行编辑(增/删),保存为结构化数组。实测持久化
- [x] **导出中心汇总条**:/exports 顶部新增本月导出次数 / 文件总大小 / 48h 内到期 三项汇总(客户端按 jobs 计算)
- [x] **模型归并**:SecurityPolicy、CheckoutSettings 从 server.py 迁入 models.py 并 import 复用

## Implemented (2026-06, iteration 29) — CI 并行隔离 + 通道安全删除 + 导出到期提醒 + 能量规则拖拽 + 支付成功页
- [x] **CI 并行稳定**：新增 `backend/tests/conftest.py`（自动从 frontend/.env 注入 `REACT_APP_BACKEND_URL`，修复 6 处 import-time KeyError；提供 `worker_id`/`uid`/`shared_admin_token`/`make_operator` 隔离工具）。将破坏共享管理员状态的 2FA 全流程用例改为在**一次性抛弃型 operator** 上运行（iteration9 TestAdmin2FA）；`test_login_bad` 改用唯一抛弃邮箱避免污染管理员锁定计数器。连续 3 次 `-n 2 --dist loadscope` 并行全绿：**114 passed / 134 skipped**
- [x] **通道安全删除**：新增 `DELETE /api/channels/{id}`，若该通道地址仍有 pending 订单→返回 409 阻止（curl 验证 409 阻止 / 200 清空后可删 / 404）。前端 ChannelsPage 每卡片加删除按钮 + AlertDialog 二次确认（有待付时红色警示 + 禁用确认）
- [x] **导出文件到期提醒**：notify 设置新增 `export_expiry_notify`(默认 True)；新增 `POST /api/cron/export-expiry-reminders` + crons.yml 每日 0:30 运行，对 24h 内到期且未提醒的文件推送一次 Telegram。前端 /exports 汇总改「24h 内到期」、任务表新增「有效期」列、<24h 琥珀高亮+警告图标；Telegram 设置弹窗新增开关
- [x] **能量规则拖拽排序**：引入 @dnd-kit，结账设置「能量租赁」条款支持拖拽手柄排序，保存按顺序持久化
- [x] **支付成功页**：订单支付成功后收银台自动切换为专属全屏成功页（动画对勾 + 金额 + 币种/协议/订单号/交易哈希/支付时间 + 查看链上记录 + 返回商户按钮），沿用多语言与品牌主题。新增订单 `return_url` 字段（后台下单 + 开放 API `/api/v1/orders` + dev 测试均支持，仅接受 http/https），public 接口返回 `paid_at`/`return_url`。testing_agent(iteration_19) 前后端 100%
- [x] **单通道不变量修复**：清理历史测试残留的 13 个 TEST_* 通道（仅保留 live「TRC20 极速通道」）；修复 `backend_test` 通道用例自清理 + conftest 会话级安全网（结束时删除遗留非 live 的 TEST/TMP/VERIFY 通道）。全量 pytest 跑完后仍恰为 1 个通道

## Implemented (2026-06, iteration 29b) — 成功页自动跳转 + 账户删除 + return_url 校验
- [x] **成功页自动跳回商户（可选）**：收银台设置「品牌」tab 新增开关 `success_auto_redirect` + 倒计时秒数 `success_redirect_seconds`(1-60, 默认5)。开启且订单含 return_url 时，支付成功页按倒计时自动跳转（按钮显示「返回商户 (Ns)」，截图验证 7s 倒计时）；关闭则仅显示按钮由用户点击。CheckoutSettings 模型 + DEFAULT_CHECKOUT_SETTINGS 同步新增两字段
- [x] **账户删除接口 + UI**：`DELETE /api/accounts/{id}`（admin-only），仅可删 operator/merchant；安全校验：不能删自己、商户有可用/冻结余额或进行中订单(pending/confirming)或待处理提现→409 阻止。curl 验证：删 operator=200、删自己=400、删 agent=400、非法=404。AccountsPage 每行新增删除按钮 + AlertDialog 二次确认（商户显示资金安全提示）
- [x] **非法 return_url 改为 422**：`build_order` 对非 http(s) 的 return_url 由「静默忽略」改为抛 422（curl 验证 `javascript:` →422，`https://` →200）

## Implemented (2026-06, iteration 29c) — 测试商户清理 + 成功页收据 + return_url 白名单 + 导出到期倒计时
- [x] **一键清理测试商户**：`POST /api/accounts/cleanup-test-merchants`（admin），删除 `test_*@test.com`/`*@citest.com`/名称 TEST_M 的残留商户，有进行中订单或待处理提现者自动跳过；@demo.com 演示账户永不匹配。curl 验证：18→6（移除 12、跳过 3）。AccountsPage 商户 tab 新增「清理测试商户」按钮 + 确认弹窗
- [x] **成功页收据**：支付成功页新增「下载收据」按钮，纯前端 Canvas 生成 PNG（品牌名/支付成功/金额/币种/协议/订单号/交易哈希/支付时间），无新依赖，多语言。截图验证按钮存在
- [x] **return_url 域名白名单（防钓鱼）**：收银台设置新增 `return_url_domains`（逗号/换行分隔，留空=允许任意，支持子域名）。`build_order` 校验下单 return_url 域名命中白名单否则 422。curl 验证：evil.com→422、pay.ok.example.com（子域）→200
- [x] **导出到期实时倒计时**：ExportJobsPage 每秒刷新 `nowTs`，有效期列 <24h 显示 HH:MM:SS 实时倒计时（琥珀高亮），≥24h 显示「N天 N小时后」。截图验证

## Implemented (2026-06, iteration 30) — 内置在线客服（付款人↔平台实时聊天）
- [x] **内置实时客服**（新模块 `routes/support.py`，轮询实现）：
  - 付款人侧（收银台，无需登录）：悬浮客服按钮 + 聊天面板（欢迎语、消息气泡、输入发送，3s 轮询）；并在待付款区加提示「转错金额或未自动到账？点此联系在线客服」（多语言 简/繁/EN）。组件 `components/SupportChat.jsx`
  - 客服侧（后台 admin/operator）：新页面 `pages/SupportPage.jsx`（会话列表+未读角标 / 对话窗 / 回复，5s/3s 轮询），侧边栏「在线客服」入口 + 未读数角标（10s 轮询 `/support/unread-count`）
  - 每商户客服配置（管理员）：MerchantDrawer 新增「在线客服」开关 + 欢迎语；`PATCH /api/accounts/{id}/support`。关闭后付款人发消息返回 403
  - 线程以 order_no 为键；`support_messages` 集合；读/未读标记（客服打开线程标记已读）
  - API：`GET/POST /api/support/public/{order_no}`（匿名付款人）、`GET /api/support/threads`、`GET/POST /api/support/threads/{order_no}`、`GET /api/support/unread-count`（admin/operator，operator 需 orders.view，deps.py 已加 PERM_RULE）
  - 验证：curl 全链路（配置/欢迎语/付款人发/客服收未读=2/读后=1/客服回复/付款人收到/禁用→403）+ 付款人与后台双端截图确认

## Implemented (2026-06, iteration 31) — 客服增强：提醒/话术/附件/状态 + 独立坐席后台
- [x] **Telegram 新消息提醒**：付款人发起新会话（该线程无未读时）触发一次 Telegram 推送（含商户/订单/摘要）；notify 设置新增 `notify_support` 开关（AlertBell UI）。send_telegram 增加 support 类型门控
- [x] **快捷回复话术**：`GET/PUT /api/support/templates`（admin 可编辑，默认 5 条）；后台会话输入框上方话术 chips 一键插入
- [x] **付款人附件**：收银台客服面板支持上传转账截图（客户端 canvas 压缩至 ≤1280px/jpeg），消息含 `image`（data URL，后端校验格式/大小 ≤~2.6MB）；双端气泡渲染图片
- [x] **会话状态 open/resolved + 筛选**：新增 `support_threads` 集合记录线程状态/最近活动；`PATCH /api/support/threads/{order_no}/status`；后台「全部/待处理/已解决」筛选 + 会话内「标记已解决/重新打开」+ 列表已解决勾标
- [x] **独立客服坐席后台**：新增坐席权限 `support.manage`（operator 可勾选）；`/api/support/*` 鉴权改为 support.manage。仅有该权限的 operator 登录后自动跳转 `/support`，侧栏只见「在线客服」，访问其他后台接口 403 —— 等于独立客服工作台
- [x] **会话内订单详情**：后台对话顶部展示订单号/状态/金额/应付/网络/创建时间/商户单号/交易哈希/**收款地址**（可复制）
  - 验证：curl 全链路（坐席 support.manage→/support 200 /orders 403、话术 CRUD、附件存储、线程详情含收款地址、resolve+筛选）+ 后台双截图确认；pytest 并行回归 114 passed/134 skipped
  - 坐席测试账号：support_seat@demo.com / Seat888!!（见 test_credentials.md）

## Implemented (2026-06, iteration 32) — 客服高级能力
- [x] **坐席工作量看板**：`GET /api/support/stats`（open/resolved/total + 每坐席平均响应时长/回复数）；SupportPage 顶部统计卡
- [x] **会话自动分配**：首个回复的坐席自动成为负责人（`assigned_to`/`assigned_id`），会话列表与详情显示「负责：X」，避免两名坐席重复回复
- [x] **访客输入提示 + 新消息通知**：付款人输入时 `POST /support/public/{order}/typing`，后台会话显示「访客正在输入…」；后台未读增加时 WebAudio 提示音 + 浏览器桌面通知（首次请求授权）
- [x] **附件改用对象存储**：接入 Emergent 对象存储（`storage.py`，EMERGENT_LLM_KEY），图片存储返回 `/api/support/file/{path}` 代替 base64 入库；`support_files` 记录+软删除；对象存储不可用时自动回退内联（功能不中断）。全链路验证：上传→对象存储→`GET /api/support/file/...` 200 image/png
- [x] **会话数据自动清除**：订单已完成(paid)且会话标记已解决时，自动删除该会话消息/线程并软删附件（`support.purge` 审计）。验证：paid+resolve→deleted:true，线程消失
  - pytest 并行回归 114 passed/134 skipped

## Implemented (2026-06, iteration 33) — 客服：转交/访客未读/定时清理/坐席在线
- [x] **坐席转交（交接）**：`GET /api/support/seats`（坐席+在线状态）、`PATCH /api/support/threads/{order_no}/assign`；后台会话头「转交坐席…」下拉，转交后写入居中系统提示「会话由 A 转交给 B」（付款人侧不可见）。即独立客服后台可随时分配/交接坐席
- [x] **访客未读提示**：`GET /api/support/public/{order_no}/unread`；收银台悬浮按钮在面板关闭时轮询并显示红色未读角标，打开即清零
- [x] **定时清理**：`POST /api/cron/support-cleanup` + crons.yml 每日 0:40；清理「已解决 + 订单已完成(paid) + 超过保留天数(默认7，support 设置 retain_days)」的会话（删除消息/线程、软删附件），作为即时清理之外的安全网
- [x] **坐席在线状态 + 通知路由**：坐席调用 unread-count/threads 时更新 `support_last_seen`（120s 窗口判定在线）；seats 列表显示在线；新客户消息仅在「无坐席在线」时才发 Telegram（在线时以站内提示音/桌面通知覆盖）
  - 验证：curl 全链路（seats 在线、payer 未读 0→1、转交+系统提示、payer 不可见系统消息、cron 401/purge）+ 后台截图确认；pytest 并行回归 114 passed/134 skipped

## Implemented (2026-06, iteration 34) — 坐席工作台首页 / 在线指示灯 / 轮询分配
- [x] **坐席工作台 mini 首页**：新增路由 `/home`（`SupportHomePage.jsx`）。仅「support.manage 且无 orders.view」的专席登录后进入此页（App.js IndexRoute 重定向 `/home`）。展示：在线状态圆点、我负责的待处理数(`mine_open`)、全部待处理/已解决/在线坐席数、快捷入口（进入在线客服、我负责的会话 `/support?mine=1`）。侧栏新增「坐席工作台」项（仅专席可见，`supportOnly` 过滤）。
- [x] **坐席在线/离线指示灯**：会话列表「负责：xxx」与会话头部「负责：xxx」均显示绿/灰圆点（复用 `/support/seats` 在线数据，列表按名字匹配、头部按 assigned_id 匹配），不再局限于转交下拉。SupportPage 新增「仅我负责」过滤。
- [x] **新会话轮询分配坐席**：`support_public_post` 对**无人负责**的新会话按 round-robin 自动分配给在线坐席（`_online_seats` + settings.rr_last 指针），写入系统提示「系统已自动分配给 X」；无人在线时保持未分配并发 Telegram（原逻辑）。`/support/stats` 新增 `mine_open`、`online`。
  - 验证：curl（stats 含 mine_open/online、新 payer 消息触发自动分配+系统消息）+ 截图（专席落 `/home`、控制台在线圆点显示）。

## Implemented (2026-06, iteration 35) — 前台隐藏坐席信息 + 简繁自动转换
- [x] **前台不显示坐席信息**：`SupportChat.jsx` 移除 agent 消息上方的 `sender_name` 标签；付款人侧只见消息内容，不再显示客服姓名（后台 `SupportPage` 仍显示坐席名用于管理）。
- [x] **简→繁自动转换**：后端 `routes/support.py` 引入 OpenCC(`s2twp`，台湾正体+词汇)。付款人侧接口 `support_public_get` 将 **agent 消息文本与 welcome** 转换为繁体；坐席后台 `support_thread_get` 保留原简体。即坐席用简体回复，访客自动看到繁体。依赖 `opencc-python-reimplemented`（已写入 requirements.txt）。
  - 验证：curl（坐席发简体「订单已成功到账…网络…」→ 付款人收到繁体「訂單已成功到賬…網路…」，后台仍为简体）+ 收银台截图（繁体气泡、无坐席名）。

## Implemented (2026-06, iteration 36) — 坐席忙闲均衡分配
- [x] **忙闲均衡分配**：`_auto_assign` 由纯 round-robin 改为「最少负载优先」——无人负责的新会话分配给**当前 open 会话数最少**的在线坐席；负载相同时用 `rr_last` 轮转打平，保证公平。避免忙的坐席更忙。
  - 验证：curl（两坐席均在线、初始负载 3/3，连发 4 个新会话 → 交替分配、结束 5/5 保持均衡）。

## Implemented (2026-06, iteration 37) — 坐席上限保护 + 负载看板
- [x] **坐席并发上限保护**：新增全局设置 `settings.support.max_per_seat`（默认 5，范围 1-100）。`_auto_assign` 仅在「open 会话数 < 上限」的在线坐席中选最少负载者；全部达上限则不分配，新会话保持待认领。`/support/settings` GET(admin/operator)、PUT(admin) 读写上限；后台控制台头部「每坐席上限」输入框（仅 admin 可改）。
- [x] **坐席负载看板**：坐席工作台首页新增看板，列出各坐席在线状态圆点、当前 open 会话数/上限（x/N）、负载进度条（绿/黄/红）与「已满」标记；`/support/seats` 每项增加 `open_count/max/full`，`/support/stats` 增加 `max_per_seat`。
- [x] **达上限 Telegram 兜底**：新会话未被分配（无人在线或全部已满）时发 Telegram，文案区分「无坐席在线」/「所有在线坐席已达会话上限」。
  - 验证：curl（cap=1 两坐席已满 → 新会话 assigned=None；PUT 设置生效）+ 截图（首页负载看板 5/5 已满红条、admin 控制台上限输入框）。

## Implemented (2026-06, iteration 38) — 负载倒计时 / 离线自动转接 / 排队提示
- [x] **坐席最久未回时长**：`/support/seats` 每项新增 `max_wait_seconds`（该坐席名下 open 且 last_sender=customer 的会话中，距最早未回复客户消息的最长等待）。工作台首页负载看板显示时钟徽标（≥5分红 / ≥2分黄 / 其余灰），一眼识别拖单。
- [x] **离线自动转接**：新增 `_reassign_offline()`（30s 节流），当坐席调用 `/support/threads` 轮询时后台触发；将「分配给已离线坐席且 last_sender=customer」的会话转给在线且未满的最少负载坐席，写入系统提示「X 已离线，会话自动转交给 Y」。
- [x] **超额排队提示**：`support_public_get` 返回 `queued`（待回复且无在线坐席可接：未分配或所属坐席离线）。收银台客服面板显示温和繁体提示「目前客服繁忙，您的訊息已排隊，我們會盡快回覆您 🙏」。
  - 验证：curl（queued=True；离线坐席会话被转交给在线坐席+系统消息；seats 返回 max_wait_seconds=2981）+ 截图（首页 50分 红色时钟徽标、收银台排队横幅）。

## Implemented (2026-06, iteration 39) — 2位小数 / 多地址分摊 / 链上监听加固 / 高并发索引
- [x] **付款金额 2 位小数**：`services.py` 防撞单改为 2 位（同地址 100 个金额变体），`free_pay_amount` 返回唯一 2 位金额。已验证（25.00→25.38/25.00/25.32）。
- [x] **收款地址自动分摊**：`ordered_addresses`（最少待支付优先）+ `build_order` 在某地址 100 个金额用尽时自动切换下一地址，全部用尽才返回 409。沿用「最少待支付优先」轮询。
- [x] **链上监听生产级加固**（TronGrid，TRC20）：
  - 仅轮询「有待支付订单」的地址（原有）；
  - **按地址增量时间游标** `cursor_ms`（+3 分钟重叠防漏），不再每次回扫 2 小时；
  - **全局 QPS 限流**（`CHAIN_MIN_INTERVAL`，默认 ~12/s）+ **403/429/5xx/超时 指数退避重试**（`_chain_get`）；
  - 轮询间隔 `CHAIN_POLL_SECONDS`、QPS 均可用环境变量调；
  - TronGrid 免费无 Key 即可运行；填 `TRONGRID_API_KEY`（环境变量）即提额，代码已就绪。
- [x] **8 万笔/天 索引**：orders 新增 `order_no`、`status+expires_at`、`merchant_id+created_at`、`created_at` 索引。
- [x] **能量租赁板块**：后台「能量租赁」标签页已可开关并填真实 TRX 代购地址/价格/文案/规则（配置即用，无需改码）。
- 验证：curl（2 位唯一金额）+ 后台日志（min_timestamp 游标递增、200 OK）+ `pytest -n 2` 114 passed/134 skipped。

## 待用户提供
- 链上数据源凭证（二选一，均可随时热接，不阻塞现有 TronGrid 免费监听）：
  - `TRONGRID_API_KEY`（提额）；或
  - 换源（Chainstack 节点 URL / TronHook Webhook Key / 自建节点 URL）——届时按集成规范接入多数据源。
- 真实 TRC20 收款地址（多个，用于 2 位小数并发分摊）。

## Implemented (2026-06, iteration 40) — 收款地址保存修复 / 订单手动核对回调
- [x] **收款地址「添加」保存修复**：`AddressHealthPage` 的添加弹窗现在自动预选通道（单通道时也不会卡住），添加按钮不再因未选通道而置灰。后端 `POST /chain/addresses` 本身正常（有效 TRC20 地址 200，格式错误返回明确 400）。
- [x] **订单手动核对回调**：订单详情新增「手动核对到账」（待支付/确认中/超时可用）。管理员填入 **TxID + 金额** → 后端 `POST /orders/{id}/manual-callback` 在该订单**收款地址**的链上记录中核对哈希与金额（TronGrid），匹配后按**实际到账金额**确认订单（写 tx、记 chain_txs、防重复占用）并触发商户回调。
  - 校验：哈希不存在→400；金额不符→400（提示实际金额）；哈希已占用其他订单→400；成功→订单置 paid 且 amount=实际金额。
  - 验证：curl（bogus→400、真实 tx 866.7→200 置 paid、重复→400 dedup）+ 截图（添加地址按钮可用、手动核对弹窗）。
- [x] **繁体翻译确认**：付款人端 agent 消息 + 欢迎语已转繁体（curl 实测「訂單已成功到賬…網路與金額」）；坐席后台控制台按设计保留简体。

## Implemented (2026-06, iteration 41) — 详情滚动修复 / 操作员留痕 / 到账下拉 / 批量补单
- [x] **订单详情弹窗溢出修复**：`order-detail-dialog` 加 `max-h-[85vh] overflow-y-auto`，内容超高可滚动，不再被截断。
- [x] **手动核对留痕**：`manual_callback` 写入 `manual_confirmed / manual_confirmed_by / manual_confirmed_at`；订单详情新增「手动核对确认：操作员 · 时间」行，便于审计。
- [x] **最近到账下拉**：新增 `GET /orders/{id}/recent-arrivals`（实时拉该收款地址链上到账，标记已占用）；手动核对弹窗列出最近到账，点击自动带入哈希与金额，减少手输错误。
- [x] **批量补单**：新增 `POST /orders/manual-callback-batch`（粘贴多条 TxID→解析各活跃收款地址链上记录→按「地址+金额」匹配待处理订单→确认并回调）。订单页「批量补单」按钮 + 弹窗，返回逐条结果（成功/已占用/无匹配/链上未找到）。
  - 验证：curl（批量：真实 tx→paid 867.4，bogus→not_found；单笔 recent-arrivals 正确标记 used）+ 截图（详情可滚动、到账下拉、批量补单弹窗）。

## 待办（item 4）
- [ ] **TronHook Webhook 秒级到账**：需用户提供 TronHook API Key + 回调注册。按集成规范接入：注册收款地址→到账回调→验签→匹配订单→确认（与轮询互为兜底）。

## Implemented (2026-06, iteration 42) — 客服手动补单 / 收款地址核对 / 快捷回复 / 图片修复
- [x] **客服（坐席）可手动补单**：`deps.py` PERM_RULES 将 `/api/orders/{id}/recent-arrivals` 与 `/api/orders/{id}/manual-callback` 映射到 `support.manage` 权限；`manual_callback` 角色放开 admin+operator。批量补单仍仅 admin。`support_thread_get` 返回 `order_id`。
- [x] **聊天页点击收款地址核对哈希**：在线客服会话信息区新增「核对到账/手动补单」按钮（待支付/确认中/超时可见）→ 弹窗列出该地址最近链上到账并标注「已占用/可用」，点击带入哈希+金额，确认后按实际到账金额确认订单并回调。
- [x] **快捷回复新增**：「你好，请提供您的付款截图及交易哈希值（交易号）。」已加入客服快捷话术（置顶）。
- [x] **客服收不到图片修复**：`_store_image` 改为**内联 base64 存储**，不再依赖对象存储检索，保证坐席在任意环境都能看到图片；旧的对象存储路径图片仍通过 `/support/file` 正常显示。
  - 验证：curl（operator recent-arrivals 200 / manual-callback 400 非 403 / batch 403；内联图片 data: URL 落库；thread 返回 order_id；模板置顶）+ 截图（客服端核对补单弹窗显示可用/已占用到账）。

## Implemented (2026-06, iteration 43) — 客服可补单权限 / 去除代理商 / 图片放大
- [x] **「客服可补单」独立权限**：新增 operator 权限 `orders.manual_callback`（标签“客服可补单”）。`/api/orders/{id}/manual-callback` 改映射此权限（recent-arrivals 仍 support.manage）。账户权限页自动渲染该开关（权限列表来自后端 OPERATOR_PERMS）。坐席无此权限→403，有→放行。前端客服台「核对到账/手动补单」按钮按此权限显隐。
- [x] **去除代理商角色（UI）**：账户权限页新增账户角色下拉仅保留「商户 / 操作员」，顶部分页仅「商户 / 操作员」（移除“代理商”）。后端仍兼容 agent（API-only）。
- [x] **客服端图片放大查看**：客服台点击付款截图弹出全屏灯箱，支持「下载 / 关闭」。
- 客服坐席添加位置：账户权限 → 新增账户 → 角色=操作员 → 勾选「在线客服坐席」(+可选「客服可补单」)。
  - 验证：curl（权限列表含 orders.manual_callback=客服可补单；无权限 403、授权后 400 放行）+ 截图（账户页仅商户/操作员、客服台图片灯箱下载/关闭）。

## Implemented (2026-06, iteration 44) — 手动补单标记与筛选
- [x] **手动补单可视标记**：订单列表行对 `manual_confirmed` 订单显示琥珀色「手动补单」标签（hover 显示操作员）；订单详情已有「手动核对确认：操作员·时间」行。
- [x] **按手动补单筛选**：订单状态筛选新增「手动补单」项 → 前端传 `manual=1`；后端 `list_orders` 支持 `manual` 参数（`manual_confirmed: True`）。
- [x] **审计**：`order.manual_callback` / `order.manual_callback_batch` 已记录操作员，审计日志页可查。
  - 验证：curl（`/orders?manual=1` count=2 全部 manual_confirmed=true）+ 截图（列表琥珀「手动补单」标签）。

## Implemented (2026-06, iteration 45) — 客服新消息声音+弹窗提醒
- [x] **新消息提醒**：`SupportPage` 轮询（5s）计算全部会话未读总数，较上次增加时触发：Web Audio 双音提示音 + 应用内 toast「🔔 收到 N 条新客户消息」+ 浏览器桌面通知（Notification，后台标签页也弹）。
- [x] **开关与持久化**：头部「🔊 提醒开 / 🔇 已静音」按钮，存 localStorage；开启时响一声并申请通知权限。切换筛选时重置计数避免误报。
  - 验证：前端编译通过；截图确认头部「提醒开」按钮；toggle 标签读取为「提醒开」。

## Backlog (next)
- P2: 散落模型持续并入 models.py
- P2: 清理测试残留的 TEST_M 商户账户（有余额，需先结清；现可用新删除接口手动清理）
- P3: 导出保留天数可视化倒计时；能量规则移动端拖拽体验微调


## Next Tasks
- 按需接入真实支付/链上监听，或扩展回调通知与对账自动化。

## 2026-06 更新：审计二次验证标注 + 强制操作员安全码
- 审计日志新增 `step_up: {op_code, totp}` 字段（verify_step_up_dep 成功后写入 request.state，shared.audit 自动落库）；审计页/操作员留痕页显示紫色「安全码/谷歌验证」徽章，审计页支持「仅看已通过二次验证」筛选（`GET /api/audit-logs?step_up=true`）。
- 安全策略新增 `enforce_operator_op_code`：开启后未设置操作安全码的操作员的 POST/PUT/PATCH/DELETE（/api/auth/*、/api/support/* 除外）返回 403 `{op_code_required:true}`；前端 api.js 拦截弹出 toast 并引导到 /security；安全页显示红色提示。
- 登录地图提醒：`shared.ip_geo(ip)` 通过 ip-api.com（免费、无需 key，中文结果）解析 IP → 国家/省/市，缓存于 `db.ip_geo`；成功登录新增审计 `auth.login`（detail: location/new_location/new_device，字段 `geo`），登录失败/锁定日志也带 geo。用户记录 `login_cities`，与历史城市不同时标记 `new_location`。审计页/操作员留痕页 IP 下方显示城市标签，异常位置显示琥珀色「异常位置」。

## 2026-06 安全审计修复（security_audit_agent：3 高危 / 2 中危 / 6 加固）
- [高] 导出越权：/api/export/{kind} 现按角色校验（snapshots 仅 admin/operator；ledger 经 resolve_ledger_account；orders merchant_id 需在可见范围）。
- [高] 操作员越权确认收款：PERM_RULES 补 manual-callback-batch；/api/orders/* 未知写操作默认拒绝。
- [高] api_secret 泄露：clean_user 与 /dev/merchants 不再返回 api_secret；新增 GET /api/accounts/{id}/credentials（admin/agent + 二次验证 + 审计 account.reveal_secret）；前端 MerchantDrawer/ApiDocsPage 点击眼睛时按需拉取。
- [中] X-Forwarded-For 伪造：client_ip 改为取右侧受信代理跳数（TRUSTED_PROXY_HOPS，默认 1）。
- [中] 客服会话 IDOR：/orders/{no}/public 下发 chat_token=HMAC(jwt_secret,"chat:"+order_no)；所有 /support/public/* 需 X-Chat-Token 头或 ?t=。
- 加固：order_no 随机段 5 位数字 → 8 位大写字母数字（secrets）；订单关键词 re.escape；notify_url（商户设置与下单参数）禁止内网/本机地址（SSRF）；pending+live 订单 (wallet_address,pay_amount) 唯一部分索引 + 下单 DuplicateKeyError 重试 3 次（TOCTOU）；simulate-pay 需 ALLOW_SIMULATE_PAY=true（已在 preview .env 开启，生产请勿设置）。
- 未处理（低）：cookie SameSite=None 无 CSRF token（Bearer 为主）；JWT 7 天无服务端吊销。

## 2026-06 第二轮安全审计修复
- [高] 提现并发超额：request_payout 改为条件原子扣减（balance ≥ amount），approve/reject 用 find_one_and_update 按 pending 状态原子流转（防重复放款/驳回）。
- [中] 导出/审计日志 $regex 未转义 → re.escape + 长度限制（reports.py、server.py list_audit_logs）。
- [中] 补单竞态：manual-callback / _confirm_with_tx 仅在订单非 paid/confirming 时才重置为 pending，已被链上确认的订单拒绝补单。
- [中] /support/file/{path} 拒绝 .. 路径，且只提供 support_files 中有记录的文件。
- 加固：限流器改用 client_ip（受信代理跳数）；reset-api-key 增加二次验证。
- 残留低风险：JWT localStorage 存储 + 7 天无吊销；return_url_domains 为空时允许任意 http(s) 跳转（可在收银台设置配置白名单）。

## 2026-06 宝塔部署套件 + 清除测试数据
- `/app/deploy/`：README.md、nginx.conf（三域名同域、/api 反代 8001、SPA 回退）、backend.env.example、windows/deploy.ps1（venv+yarn build+NSSM 服务+计划任务，-ResetData）、linux/deploy.sh（systemd+crontab，--reset-data）。
- 前端 `REACT_APP_BACKEND_URL` 为空时自动使用 window.location.origin（api.js / ApiDocsPage / CallbacksPage / SupportChat），备用域名无需单独构建。
- `backend/reset_data.py --yes [--keep-operators]`；`POST /api/admin/reset-test-data`（admin + step-up，审计 admin.reset_test_data）；安全设置页「清空测试数据」卡片（需输入“清空”）。
- 演示数据种子改为仅 `SEED_DEMO_DATA=true` 时生成（preview .env 已设 true，生产示例为 false）。
- 预览库测试数据未实际清除（由用户自行触发）。
- 数据库自动备份：deploy/{windows/backup_db.ps1,restore_db.ps1, linux/backup_db.sh,restore_db.sh}；部署脚本注册每日 02:30 mongodump（gzip archive，保留 14 天）到 <项目>/backups；已验证 dump→restore 完整。
- Windows .ps1 脚本改为 UTF-8 BOM（PowerShell 5 中文乱码修复）
- requirements-prod.txt（剔除 emergentintegrations/litellm 平台专用包）；deploy.ps1 用 corepack 启用 yarn
- deploy.ps1: cron 任务改用 cron_call.bat（修复 schtasks 引号）、自动下载便携版 mongotools、服务健康等待 12s
- deploy.ps1 新增 -Port 参数（用户服务器 8001 被其他项目占用，改用 8011）

## 2026-06 生产部署记录（宝塔 Windows 10，137.220.157.109）
- 代码目录 D:\wwwroot\sifang；Python 便携版 D:\python311\tools\python.exe（系统 Python 3.8 过旧、MSI 在 SYSTEM 会话安装失败）；Node 22；MongoDB 7 Windows 服务。
- 后端 NSSM 服务 SifangPayBackend，端口 **8011**（8001 被同机另一项目 eztyv.com 占用）；Nginx 站点 print8.8bc8uyz.com(+1/+2 备用) → root D:/wwwroot/sifang/frontend/build，/api → 127.0.0.1:8011。
- 踩坑：ps1 需 UTF-8 BOM；宝塔建站会用默认页覆盖 build/index.html（重新 yarn build）；Let's Encrypt 被宝塔反复申请触发注册限流，改用 win-acme (D:\wacs) 签发后粘到宝塔「其他证书」。
- 管理员 ajin53193@gmail.com（生产密码由用户持有）。
- 复制按钮：新增 lib/clipboard.js copyText()（HTTP 非安全上下文回退 execCommand），替换全部 navigator.clipboard 调用
- deploy/windows/update.ps1 与 linux/update.sh：一键拉取分支 ZIP、同步代码（保留 .env 等）、装依赖、构建、重启、健康检查，更新前自动备份
- 付款页文案：自动上分 → 自动到账（简/繁，checkoutI18n.js 共 6 处）

## 2026-06 TronHooks 即时到账推送
- routes/tronhooks.py：POST /api/webhooks/tronhooks（HMAC-SHA256 X-Signature 按 watch secret 校验、event_id 去重、仅 transfer.confirmed/USDT/incoming）→ 复用 match_chain_tx(source="tronhooks") → mark_paid → 回调；GET /api/tronhooks/status；POST /api/tronhooks/sync（admin+step-up）。
- 后台循环 tronhooks_sync_loop 每 2 分钟按 live_address_list 自动注册/删除 watch（asset_filter USDT，webhook_url=FRONTEND_URL/api/webhooks/tronhooks）；watch secret 存 db.tronhooks_watches。
- 环境变量 TRONHOOKS_API_KEY（预览未配置；用户生产 key 已提供，需 HTTPS 后在服务器 .env 配置）。收款地址页新增 TronHooksCard。
- chain_txs 新增 source 字段；match_chain_tx 捕获 DuplicateKeyError（轮询与 webhook 并发安全）。
- 用户放弃 TronHooks（无法购买）：代码保留但未配置 Key 时完全停用，前端卡片仅在启用时显示。继续依赖 TronGrid 5s 轮询。

## 2026-10-11
- 手机付款页(CheckoutPage.jsx)整体缩小：字号13-14px、金额32px、二维码170px、间距收紧。
- 生产域名 print8.8bc8uyz.com 已通过宝塔签发 Let's Encrypt 证书(到期2027-01-09)，外网 HTTPS 验证通过；旧 win-acme 证书作废。
- 预览环境 frontend .env 为 sifang-collect 域名。

## 后台隐藏入口 (2026-10-11)
- 后台登录路径改为 `/sf-admin-k9x2m7`（由 frontend .env `REACT_APP_ADMIN_PATH` 控制；生产由 update.ps1/deploy.ps1 的 -AdminPath 参数注入，默认同值）。
- `/login`、`/` 及任何未登录访问均显示 404 页面，不再跳转到登录页。付款页 `/pay/:orderNo` 不受影响。
- 支付成功页按付款页同比例缩小（图标64px、标题19px、金额32px、明细13px、按钮h-10）。
- 手动补单安全阀(2026-10-11)：/orders/{id}/manual-callback 当链上金额与订单应付差异 > max(1 USDT, 10%) 时返回 409，需 force=true；补单同步更新 pay_amount，记录 manual_original_amount，并立即投递回调。前端 OrdersPage/SupportPage 显示“强制补单”勾选框。

## 生产故障恢复 + 图标 + 北京时间 (2026-10-13)
- 宝塔站点误删恢复：重建 Nginx 配置(SSL + /api/ 反代 8011 + SPA try_files)，确认证书在 nginx/conf/ssl/，重跑 update.ps1 重建丢失的前端 build/，站点恢复。
- Favicon 修复：手机浏览器加载了同服务器其它站点(合赢)缓存的图标。新增标准 favicon.ico(多尺寸)+favicon-16/32.png+apple-touch-icon.png(iOS)+icon-192/512.png(PWA)+site.webmanifest，均为 USDT 青色盾牌 ₮；index.html 正确引用并加 ?v=3 破缓存。需清浏览器缓存生效。
- 全站北京时间(UTC+8)：数据库仍存 UTC，但所有展示/日报日切/报表统一北京时间。
  - utils.py 新增 BJ_TZ、now_bj、bj_today_str、bj_yesterday_str、bj_day_bounds、bj_str。
  - server.py: dashboard_stats/_date_window/build_profit_snapshot 改用北京日切；cron daily-settle 与 run_profit_snapshot 默认北京昨日；chain_usage_forecast 的 eta 转北京、告警文案改“北京时间”。
  - routes/reports.py: 月/日筛选按北京时区解析；生成时间/导出时间显示“(北京时间)”；paid_at/created_at/approved_at 列用 bj_str；run_scheduled_exports 用 now_bj。
  - routes/notify.py: daily-report 默认/校验用 bj_today_str。
  - 前端 lib/format.js: fmtDate 加 timeZone Asia/Shanghai；新增 bjToday/bjMonth/bjYesterday；Dashboard/MerchantStats/BalanceLedger/ProfitSnapshots/Commission/MerchantStatement 默认筛选改北京日期；CheckoutPage/ChannelsPage 时间显示加 Asia/Shanghai。
  - 例外（有意保留 UTC）：Dashboard 的 TronGrid 额度面板日期与 24h 图标注仍为 UTC（供应商额度按 UTC 零点重置）。
  - 测试 iteration_20：后端 12/12 通过，前端 0 报错。

## 安全验证弹窗修复 + 平台管理 API (2026-10-17)
- StepUpModal 修复：原来挂在 Radix 弹窗外，被 pointer-events:none+焦点锁定导致输入框打不了字。改为使用项目 Radix Dialog 组件成为最顶层，输入正常。测试 iteration_21 前端 100% 通过。
- 平台管理 API（routes/admin_api.py，前缀 /api/admin-api）：供外部“一个后台管多个平台”的聚合系统用 API Key 拉取/管理本平台数据。
  - 鉴权：请求头 X-Api-Key（HTTPS）。Key 由管理员 JWT 调 POST /api/admin-api/key/rotate 生成（只存 sha256，明文仅返回一次）；GET /api/admin-api/key 查看前缀/状态；PUT /api/admin-api/key/ip-whitelist 设 IP 白名单。设置存 db.settings._id='admin_api'。
  - 数据端点（均需 X-Api-Key）：GET /ping、GET /stats?date=、GET /orders(分页/筛选 status,network,merchant_id,keyword,date,start,end)、GET /orders/{order_no}、GET /accounts?role=、GET /support/threads?status=、GET /support/threads/{order_no}、POST /support/threads/{order_no}/reply。
  - 时间字段同时给 ISO(UTC) 与 *_bj 北京时间；stats/orders 按北京日切。
  - 已 e2e 验证：鉴权401、ping/stats/orders/accounts/threads/detail/reply 全通过。
  - 资金/敏感写操作已开放 (2026-10-17)：复用后台原处理函数（合成 admin actor），保证台账/审计/回调/TxID去重一致。端点：POST /orders/{order_id}/manual-callback(手动补单,差异大需force)、POST /accounts/{account_id}/adjust(credit/debit/freeze/unfreeze)、POST /accounts/{account_id}/toggle-status(冻结/解冻)、GET /settlements/payouts、POST /settlements/payouts/{id}/approve|reject(提现审核)、GET+PUT /checkout/settings(改配置)。e2e 验证通过。
