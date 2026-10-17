# 多平台總後台 — Hub 數據接口規範（v1）

gogo589 後台可把其他平台（如 **Giftray 商城**）的訂單、充值、會員與統計拉進來合併查看。
對方平台只需實作下面 **4 個只讀 GET 接口**，並用 `X-Hub-Key` 鑒權即可。

## 1. 鑒權
- 所有請求帶 Header：`X-Hub-Key: <對方平台自行生成的密鑰>`
- 密鑰錯誤 → 回 `401 {"detail":"無效的 Hub Key"}`
- 建議只允許 HTTPS；密鑰在 gogo589 後台「系統配置 → 平台接入」填寫

## 2. 通用返回格式（列表類）
```json
{ "platform": {"id": "giftray", "name": "Giftray 商城"}, "total": 123, "page": 1, "size": 50, "rows": [ ... ] }
```
- 所有時間用 ISO 8601（UTC），例如 `2026-06-01T08:21:33+00:00`
- 金額一律 **USD 數字**（非字串）
- 分頁：`page` 從 1 起，`size` 最大 200

## 3. 接口

### 3.1 統計 `GET /hub/stats?days=30`
```json
{ "platform": {"id":"giftray","name":"Giftray 商城"}, "days": 30,
  "revenue_usd": 7063.35, "orders": 78, "topup_usd": 4280.0, "topups": 8,
  "new_members": 5, "members": 9, "pending_orders": 29, "pending_topups": 1, "open_chats": 0 }
```
| 欄位 | 說明 |
|---|---|
| revenue_usd / orders | 近 N 天已付款訂單總額 / 筆數 |
| topup_usd / topups | 近 N 天成功充值總額 / 筆數 |
| new_members / members | 近 N 天新註冊 / 會員總數 |
| pending_orders | 已付款待處理訂單數（即時） |
| pending_topups | 待審核充值數（即時） |
| open_chats | 未讀客服會話數（可回 0） |

### 3.2 訂單 `GET /hub/orders?since=&paid_since=&status=&page=1&size=50`
`rows[]` 每筆：
```json
{ "id": "f6b5...", "order_no": "GT26101614BC58", "type": "order",
  "user": "a***@gmail.com", "status": "paid", "amount_usd": 54.35,
  "items": ["新地商場禮品卡 500HKD ×1"], "created_at": "...", "paid_at": "..." }
```
- `type`：`order`（一般商品）或 `giftcard`（禮品卡）
- `status` 建議值：`pending_payment` / `paid` / `processing` / `shipped` / `completed` / `cancelled` / `failed` / `refunded`
- `since`：只回 `created_at >= since` 的訂單；按 `created_at` 倒序
- `paid_since`：只回 `paid_at > paid_since` 的訂單（gogo589 後台每 8 秒用此參數拉取新付款訂單，觸發「新訂單」彈窗與提示音）

### 3.3 充值 `GET /hub/topups?since=&status=&page=1&size=50`
`rows[]` 每筆：
```json
{ "id": "...", "order_no": "4BC07D38", "type": "topup", "user": "a***@gmail.com",
  "status": "approved", "amount_usd": 50.0, "items": ["信用卡 / VISA"], "created_at": "...", "paid_at": "..." }
```
- `status` 建議值：`pending` / `reviewing` / `approved` / `rejected` / `failed`

### 3.4 會員 `GET /hub/members?q=&page=1&size=50`
`rows[]` 每筆：
```json
{ "id": "user_xxx", "email": "a@b.com", "name": "Ajin", "wallet_usd": 120.5, "created_at": "...", "is_test": false }
```
- `q`：按郵箱模糊搜尋

## 4. 參考實作
gogo589 自身已按本規範對外提供同樣 4 個接口（`https://www.gogo589.com/api/hub/…`，密鑰見後台「平台接入」頁），Giftray 可直接照抄其返回格式。

## 5. 平台類型
- **商城**（如 Giftray）：實作全部 4 個接口
- **充值平台**（如四方充值平台）：只需 `/hub/stats`、`/hub/topups`、`/hub/members`（stats 中訂單欄位可回 0）；在 gogo589「平台接入」把類型選為「充值平台」即可

## 6. 接入步驟
1. Giftray 開發完成 4 個接口並提供：接口前綴（如 `https://www.giftray.com/api`）、`X-Hub-Key`、客服後台地址
2. gogo589 後台 → 系統配置 → 平台接入 → 新增平台（代號 `giftray`）→ 填入以上資訊 → 儲存 → 「測試連線」
3. 之後：數據概覽頂部出現「多平台匯總」；訂單管理多一個「多平台訂單 / 充值」Tab；用戶管理多「多平台會員」；客服菜單多「Giftray 商城 客服」入口
