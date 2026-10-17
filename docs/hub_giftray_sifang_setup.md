# 總後台接入 Giftray 與四方 USDT 平台 — 操作說明

兩個平台都**不需要對方改代碼**：總後台已內建適配器，直接調用他們現有的管理 API。
只要在總後台（`https://www.gogo589.com/12334` → 平台接入）新增兩行、填地址與金鑰即可。

## 1. 先更新伺服器（補丁含適配器）
```cmd
cd /d D:\wwwroot\gogo589
curl -o patch.zip "https://<Emergent 預覽域名>/api/_export/<DATA_EXPORT_TOKEN>/patch.zip"
tar -xf patch.zip
"C:\Windows\system32\config\systemprofile\AppData\Roaming\npm\pm2.cmd" restart gogo589-backend
cd frontend && yarn build
```
（`yarn build` 只是讓 `/gg589-k7p2x` 後台的「平台接入」也多出兩個類型選項；總後台 `/12334` 不用打包。）

## 2. 拿金鑰
| 平台 | 金鑰取得方式 | 請求頭 |
|---|---|---|
| Giftray | Giftray 商城後台 → 核銷接口 API → 後台管理 API → 產生金鑰（`ak_` 開頭）並**開啟啟用開關**；建議把 gogo589 伺服器 IP 加入白名單 | `X-Admin-Api-Key` |
| 四方平台 | 用管理員帳號 `POST /api/auth/login` 取 token → `POST /api/admin-api/key/rotate`（明文只回一次）；建議 `PUT /api/admin-api/key/ip-whitelist {"ips":["gogo589伺服器IP"]}` | `X-Api-Key` |

四方 rotate 範例（在任何電腦執行一次即可）：
```bash
curl -X POST https://四方域名/api/auth/login -H "Content-Type: application/json" -d '{"email":"管理員郵箱","password":"密碼"}'
curl -X POST https://四方域名/api/admin-api/key/rotate -H "Authorization: Bearer <上一步的token>"
```

## 3. 在總後台「平台接入」新增
| 欄位 | Giftray | 四方平台 |
|---|---|---|
| 代號 | `giftray` | `sifang` |
| 名稱 | `Giftray` | `四方USDT` |
| 類型 | **Giftray 商城（直接對接）** | **四方 USDT 收款平台（直接對接）** |
| 接口地址前綴 | `https://lpw-888.com/api` | `https://print8.8bc8uyz.com/api/admin-api` |
| 金鑰 | `ak_…`（Giftray 後台管理 API 金鑰） | `ak_…`（四方 X-Api-Key） |
| 客服後台地址 | `https://lpw-888.com/admin`（或其客服頁網址） | 四方後台客服頁網址 |

→ 儲存 → 每行點「測試連線」，顯示「連線成功：Giftray，近 7 天訂單 N 筆」即接通。

## 4. 數據對應說明
**Giftray（港元商城）**
- 金額：Giftray 以港元計價，總後台統一換算成 USD（匯率取 Giftray `/settings` 的 `usdtRate`，取不到用 7.8），表格金額下方同時顯示原始 `HK$` 金額。
- 訂單狀態：`need_info 待填資料 / processing 處理中 / completed 已完成 / cancelled 已取消`；有交易號 / 自動審核欄位的訂單歸「禮品卡」類型。
- 充值：`pending → 審核中`、`approved → 已到帳`、`rejected → 已拒絕`；方式顯示 USDT 直轉 / 快捷支付 / 信用卡 + 鏈。
- 測試帳號（`isTest`）的訂單、充值不計入統計與列表；會員列表保留但標「測試」。
- 新訂單提醒：Giftray 下單即扣餘額，故以 `createdAt` 視為付款時間，8 秒內彈窗 + 提示音。
- 統計：營收 = 近 N 天非取消訂單港元合計換算 USD；待處理 = 待填資料 + 處理中；未讀客服 = `/admin/pending-counts.chat`。

**四方 USDT 收款平台（獨立數據，不混入商城統計）**
- 總後台左側獨立菜單「四方收款」：數據概覽（今日 / 近 N 天收款 USDT、單量、成功率、待確認、商戶餘額合計、各商戶收款排行）、收款單（按狀態 / 商戶 / 網絡 / 單號·商戶單號·TxID·地址 篩選）、商戶帳戶（餘額、凍結狀態）、客服會話（未結會話 + 一鍵進入四方客服後台）。
- 「數據概覽 / 訂單充值 / 會員 / 客服」四頁只含 gogo589 與 Giftray 商城數據。
- 狀態：`pending 待支付 / confirming 鏈上確認中 / paid 已支付 / expired 已過期`；`manual_confirmed` 顯示「補單」標籤。
- 新訂單提醒：四方 `paid` 收款單同樣彈窗 + 提示音，單獨標註「四方收款」，點「查看訂單」直達四方收款頁。
- 可接入多個四方平台，頁面右上角切換。

## 5. 其他
- Giftray 數據同時也會出現在 `/gg589-k7p2x` 後台的「多平台 Hub」頁並共用新訂單提醒；四方收款只在總後台 `/12334` 顯示。
- 總後台對外部 API 有 10 秒快取，避免 8 秒輪詢給對方造成壓力。
- 若測試連線顯示 `回應 401`：金鑰錯或未啟用；`403`：IP 不在白名單；`回應 5xx`／逾時：對方域名或網路問題。
