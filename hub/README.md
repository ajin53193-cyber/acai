# 總後台（多平台管理系統）部署說明 — Windows 寶塔

獨立於 gogo589 後台的「總後台」，統一查看 gogo589 / Giftray / 四方充值平台 的數據概覽、訂單與充值、會員、客服入口，並有新訂單彈窗 + 提示音。
目錄：`D:\wwwroot\gogo589\hub`（隨 patch.zip 一起解壓），無需前端打包（純靜態頁 + Python 後端）。

## 1. 安裝依賴（一次）
```cmd
cd /d D:\wwwroot\gogo589\hub
..\backend\venv\Scripts\pip install -r requirements.txt --no-deps
```
（與 gogo589 共用同一個 Python 虛擬環境即可，依賴已包含在內）

## 2. 設定 `.env`
```cmd
copy .env.example .env
notepad .env
```
```
MONGO_URL=mongodb://localhost:27017        ← 與 backend\.env 的 MONGO_URL 相同
HUB_DB_NAME=gogo589_hub                    ← 獨立資料庫，只存平台設定
HUB_PORT=8101
HUB_SECRET=隨便一串很長的隨機字元（登入簽名用）
HUB_ADMIN_USER=hubadmin                    ← 總後台帳號
HUB_ADMIN_PASSWORD=自訂密碼                 ← 總後台密碼
```

## 3. 用 PM2 常駐（與 gogo589 後端一樣）
```cmd
"C:\Windows\system32\config\systemprofile\AppData\Roaming\npm\pm2.cmd" start "..\backend\venv\Scripts\python.exe" --name gogo589-hub -- server.py
"C:\Windows\system32\config\systemprofile\AppData\Roaming\npm\pm2.cmd" save
```
瀏覽器打開 `http://伺服器IP:8101` 即可登入（防火牆需放行 8101），或在寶塔新增一個網站（例如 `hub.gogo589.com`）反向代理到 `http://127.0.0.1:8101` 並開 HTTPS。

## 4. 接入平台（總後台 → 平台接入 → 新增 → 儲存 → 測試連線）
| 欄位 | gogo589 填法 |
|---|---|
| 代號 / 名稱 | `gogo589` / `gogo589` |
| 接口地址前綴 | `https://www.gogo589.com/api` |
| 類型 | 商城 |
| X-Hub-Key | gogo589 後台 → 系統配置 → 平台接入 → 「本站對外 Hub 接口」的 X-Hub-Key |
| 客服後台地址 | `https://www.gogo589.com/gg589-k7p2x?s=chat-sessions` |

Giftray、四方充值平台：由對方按 `docs\hub_platform_spec.md` 實作接口後，同樣填入（四方充值平台類型選「充值平台」）。

## 5. 更新
之後每次 patch.zip 解壓後執行：
```cmd
"C:\Windows\system32\config\systemprofile\AppData\Roaming\npm\pm2.cmd" restart gogo589-hub
```
