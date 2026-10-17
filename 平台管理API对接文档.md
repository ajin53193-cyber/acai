# 平台管理 API 对接文档（Admin Open API）

> 适用场景：外部「一个后台管理多个平台」的聚合系统，通过 API Key 拉取/管理本平台（USDT 四方收款）的订单、客服、账户、统计及资金操作数据。
> 服务端对接前缀：`/api/admin-api`

---

## 1. 基础信息

| 项 | 值 |
|---|---|
| Base URL | `https://你的域名/api/admin-api` |
| 协议 | HTTPS（必须） |
| 鉴权方式 | 请求头 `X-Api-Key: <你的Key>` |
| 数据格式 | 请求/响应均为 JSON（UTF-8） |
| 时区 | 返回的 `*_bj` 字段为北京时间(UTC+8)；原始 ISO 字段为 UTC |

### 统一响应结构
```json
{ "code": 0, "msg": "success", "data": { } }
```
- `code = 0` 表示成功；
- 失败时返回对应 HTTP 状态码（见下），body 形如 `{"detail":"错误说明"}`。

### 错误码
| HTTP | 含义 |
|---|---|
| 401 | 缺少或无效的 X-Api-Key（或管理 API 未启用） |
| 403 | 来源 IP 不在白名单内 |
| 400 | 参数错误 / 业务校验失败 |
| 404 | 资源不存在 |
| 409 | 冲突（如手动补单金额差异过大，需 force） |
| 502 | 链上查询失败（手动补单时） |

---

## 2. 获取与管理 API Key（管理员操作，使用登录 JWT）

> Key 只在生成时明文返回一次，服务端仅保存其 SHA-256 哈希。请妥善保存。

### 2.1 管理员登录拿 JWT
```
POST /api/auth/login
Content-Type: application/json

{ "email": "管理员邮箱", "password": "密码" }
```
响应含 `token`，用于下面的 `Authorization: Bearer <token>`。

### 2.2 生成 / 轮换 Key
```
POST /api/admin-api/key/rotate
Authorization: Bearer <token>
```
响应：
```json
{ "api_key": "ak_xxxxxxxx...", "note": "请妥善保存，此 Key 只显示这一次。" }
```

### 2.3 查看 Key 状态
```
GET /api/admin-api/key
Authorization: Bearer <token>
```
响应：`{ "enabled": true, "key_prefix": "ak_xxxxxx", "ip_whitelist": [...], "rotated_at": "...", "base_url": ".../api/admin-api" }`

### 2.4 设置 IP 白名单（强烈建议）
```
PUT /api/admin-api/key/ip-whitelist
Authorization: Bearer <token>
Content-Type: application/json

{ "ips": ["203.0.113.10", "203.0.113.11"] }
```
设置后，仅白名单内的来源 IP 能调用数据接口；留空数组表示不限制。

---

## 3. 数据接口（均需请求头 `X-Api-Key`）

### 3.1 连通测试
```
GET /ping
```
`data`: `{ "platform": "四方收款平台", "server_time_bj": "2026-10-17 13:50:18", "server_date_bj": "2026-10-17" }`

### 3.2 统计概览
```
GET /stats?date=YYYY-MM-DD        # date 可选，默认今天（北京日）
```
`data`:
```json
{
  "date": "2026-10-17",
  "total_orders": 536, "paid_orders": 81, "pending_orders": 0,
  "total_volume": 47410.41,
  "today_orders": 0, "today_paid_orders": 0, "today_volume": 0,
  "success_rate": 15.1
}
```

### 3.3 订单列表
```
GET /orders?status=paid&network=TRC20&merchant_id=&keyword=&date=&start=&end=&page=1&page_size=50
```
| 参数 | 说明 |
|---|---|
| status | 订单状态：`pending` 待支付 / `paid` 已支付 / `expired` 已过期 / `confirming` 确认中 |
| network | 目前仅 `TRC20` |
| merchant_id | 商户 ID（见账户接口） |
| keyword | 模糊搜索：订单号 / TxID / 商户单号 / 收款地址 / 商户名 |
| date | 按北京日筛选 `YYYY-MM-DD` |
| start, end | 按北京日范围筛选（闭开区间，含起止当天） |
| page, page_size | 分页，page_size ≤ 500 |

`data`:
```json
{
  "items": [{
    "order_no": "SF2026...", "out_trade_no": "商户单号", "merchant_id": "...", "merchant_name": "极光支付",
    "amount_usdt": 100.0, "pay_amount": 100.01, "network": "TRC20", "wallet_address": "T...",
    "status": "paid", "tx_id": "...", "manual_confirmed": false, "remark": null, "live": true,
    "created_at": "2026-10-12T05:09:19+00:00", "created_at_bj": "2026-10-12 13:09:19",
    "paid_at": "...", "paid_at_bj": "...", "expires_at": "..."
  }],
  "total": 536, "page": 1, "page_size": 50
}
```

### 3.4 订单详情
```
GET /orders/{order_no}
```
`data`: 同上单个订单对象。

### 3.5 账户列表
```
GET /accounts?role=merchant       # role 可选：merchant / operator / agent，留空返回全部
```
`data`: `[{ "id": "...", "role": "merchant", "name": "极光支付", "email": "...", "status": "active", "balance": 41214.22, "rate": 0.03, "created_at": "..." }]`

### 3.6 客服会话列表
```
GET /support/threads?status=open   # all / open / resolved
```
`data`: `[{ "order_no": "...", "merchant_name": "...", "last_text": "...", "last_sender": "customer", "last_at": "...", "status": "open", "assigned_to": "客服A", "unread": 2 }]`

### 3.7 客服会话消息
```
GET /support/threads/{order_no}
```
`data`: `{ "order_no": "...", "merchant_name": "...", "status": "open", "assigned_to": "...", "messages": [{ "id": "...", "sender": "customer|agent|system", "sender_name": "...", "text": "...", "image": null, "created_at": "..." }] }`

### 3.8 回复客服消息
```
POST /support/threads/{order_no}/reply
Content-Type: application/json

{ "text": "您好，正在为您处理。", "sender_name": "聚合后台", "image": null }
```
`data`: `{ "id": "...", "created_at": "..." }`

---

## 4. 资金 / 敏感操作接口（均需 `X-Api-Key`）

> ⚠️ 这些操作会动钱 / 改配置，等同于管理员权限。逻辑与后台手动操作完全一致（余额台账、审计日志、商户回调、TxID 去重），审计日志里操作人记为「平台管理API」+ 来源 IP。

### 4.1 手动补单
```
POST /orders/{order_id}/manual-callback
Content-Type: application/json

{ "tx_id": "链上交易哈希", "amount": 100.01, "force": false }
```
- `order_id` 为订单的内部 ID（即订单详情里的内部主键，非 order_no 时请用后台/订单接口拿到的 id）。
- 服务端会在该订单收款地址的链上记录中核验该 TxID 与金额；成功后按**实际到账金额**确认订单并触发商户回调。
- 若链上到账金额与订单应付差异过大（> max(1 USDT, 10%)），返回 409，需 `force: true` 强制按实际金额补单。
- `data`: `{ "ok": true, "amount": 100.01, "tx_id": "..." }`

### 4.2 调整余额
```
POST /accounts/{account_id}/adjust
Content-Type: application/json

{ "amount": 100, "action": "credit", "remark": "备注" }
```
| action | 含义 |
|---|---|
| credit | 增加可用余额 |
| debit | 扣减可用余额 |
| freeze | 冻结（可用→冻结） |
| unfreeze | 解冻（冻结→可用） |

`data`: 更新后的账户对象（含最新 balance / frozen_balance）。

### 4.3 冻结 / 解冻账户
```
POST /accounts/{account_id}/toggle-status
```
在 `active` 与 `frozen` 间切换。`data`: `{ "status": "frozen" }`

### 4.4 提现单列表
```
GET /settlements/payouts?status=pending     # pending / all
```
`data`: `[{ "id": "...", "merchant_id": "...", "merchant_name": "...", "amount": 500, "address": "T...", "network": "TRC20", "status": "pending", "created_at": "...", "created_at_bj": "...", "approved_at": null }]`

### 4.5 审核提现 - 通过放款
```
POST /settlements/payouts/{payout_id}/approve
```

### 4.6 审核提现 - 驳回退款
```
POST /settlements/payouts/{payout_id}/reject
```

### 4.7 读取平台配置
```
GET /checkout/settings
```
`data`: 收银台/品牌/能量等全部配置对象。

### 4.8 修改平台配置
```
PUT /checkout/settings
Content-Type: application/json

{ ...完整配置对象（建议先 GET 拿到当前值，修改后整体回传）... }
```
注意：`theme_color` 需 `#RRGGBB` 格式；能量地址若填写需为合法 TRC20 地址。

---

## 5. 调用示例（curl）

```bash
# 1. 拿 Key（一次性）
curl -X POST https://你的域名/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@xx.com","password":"***"}'
# -> 得到 token

curl -X POST https://你的域名/api/admin-api/key/rotate \
  -H "Authorization: Bearer <token>"
# -> 得到 api_key (ak_...)

# 2. 拉订单
curl "https://你的域名/api/admin-api/orders?status=paid&page=1&page_size=50" \
  -H "X-Api-Key: ak_xxx"

# 3. 回复客服
curl -X POST "https://你的域名/api/admin-api/support/threads/SF2026xxx/reply" \
  -H "X-Api-Key: ak_xxx" -H "Content-Type: application/json" \
  -d '{"text":"您好，正在处理","sender_name":"聚合后台"}'

# 4. 调整余额
curl -X POST "https://你的域名/api/admin-api/accounts/<account_id>/adjust" \
  -H "X-Api-Key: ak_xxx" -H "Content-Type: application/json" \
  -d '{"amount":100,"action":"credit","remark":"手动入账"}'
```

---

## 6. 安全建议
1. 该 Key 等同完整管理员权限（可动钱/改配置），仅保存在你的后端，切勿下发前端或写入日志。
2. 务必配置 IP 白名单（`/key/ip-whitelist`），只允许你聚合后台的服务器 IP 调用。
3. 如怀疑泄露，随时调 `/key/rotate` 轮换，旧 Key 立即失效。
4. 所有操作均写入本平台审计日志（操作人=平台管理API，记录来源 IP）。

---

## 7. 字段字典
- **订单状态 status**：`pending` 待支付 / `confirming` 确认中 / `paid` 已支付 / `expired` 已过期
- **网络 network**：`TRC20`（当前仅支持）
- **账户角色 role**：`merchant` 商户 / `operator` 操作员 / `agent` 代理
- **客服发送方 sender**：`customer` 访客 / `agent` 客服 / `system` 系统
- **余额调整 action**：`credit` / `debit` / `freeze` / `unfreeze`
