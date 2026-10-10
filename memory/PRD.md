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
- [x] 测试：后端 23/23、前端全通过

## Env (optional)
- ETHERSCAN_API_KEY：ERC20/BEP20 监听与余额必需（Etherscan V2 免费 Key，https://etherscan.io/apis）
- TRONGRID_API_KEY：公共接口限速较严 (429)，生产建议配置 TronGrid Key

## Mocked
- ERC20 / BEP20 及未配置收款地址的 TRC20 通道仍为模拟到账（simulate-pay）。配置了地址的 TRC20 通道为真实链上监听。

## Backlog
- P1: 获取 ETHERSCAN_API_KEY 后验证 ERC20/BEP20 真实到账
- P2: 代理多级分润（当前单级）、2FA
- P2: server.py 拆分为子路由模块；大流量下 TronGrid 需付费 Key 或自建节点

## Next Tasks
- 按需接入真实支付/链上监听，或扩展回调通知与对账自动化。
