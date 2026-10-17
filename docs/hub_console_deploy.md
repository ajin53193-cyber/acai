# 總後台（多平台管理）— 部署說明（Windows 寶塔）

總後台已併入主站後端（8001），**不需要 8101 端口、不需要額外 PM2 進程**。
訪問地址：`https://www.gogo589.com/12334`（路徑可在 `backend\.env` 的 `HUB_PATH` 修改）。
API 前綴：`/api/hub-admin/*`；頁面檔：`backend\hub_static\index.html`。

## 1. 解壓補丁
```cmd
cd /d D:\wwwroot\gogo589
curl -o patch.zip "https://<Emergent 預覽域名>/api/_export/<DATA_EXPORT_TOKEN>/patch.zip"
tar -xf patch.zip
```
補丁內容：`backend\server.py`、`backend\hub_console.py`、`backend\hub_api.py`、`backend\hub_static\index.html`、`docs\*`。

## 2. backend\.env 追加（用寶塔檔案管理器編輯，不要用 CMD echo）
```
HUB_PATH=12334
HUB_ADMIN_USER=hubadmin
HUB_ADMIN_PASSWORD=自訂一個強密碼
HUB_SECRET=隨便一串 40 位以上隨機字元
```

## 3. Nginx 站點配置新增一段（寶塔 → 網站 → www.gogo589.com → 配置檔），放在 `location /api/` 旁邊：
```nginx
location /12334 {
    proxy_pass http://127.0.0.1:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
儲存後重載 Nginx（Windows：`taskkill /f /im nginx.exe` 後在寶塔啟動）。

## 4. 重啟後端
```cmd
"C:\Windows\system32\config\systemprofile\AppData\Roaming\npm\pm2.cmd" restart gogo589-backend
```

## 5. 使用
- 瀏覽器開 `https://www.gogo589.com/12334` → 以 `HUB_ADMIN_USER / HUB_ADMIN_PASSWORD` 登入（超級管理員）。
- 菜單：數據概覽 / 訂單管理 / 充值管理 / 客服管理 / 用戶管理 — 每頁點開按平台分頁籤（gogo589 / Giftray / 四方USDT），數據各自獨立；數據概覽另有「合計」（只匯總商城）。
- 管理員：可新增管理員帳號（帳號 + 密碼 ≥ 8 位），勾選「模組權限」與「可見平台」；未勾選的菜單與平台分頁會隱藏，後端同步校驗。普通管理員可在左下角「修改密碼」。
- 本站 gogo589 自動接入。
- Giftray、四方充值平台：對方依 `docs\hub_platform_spec.md` 實作接口後，在「平台接入」新增（填接口前綴 + X-Hub-Key，充值平台類型選「充值平台」）→ 儲存 → 測試連線。
- 總後台與 `/gg589-k7p2x` 後台的「平台接入」共用同一份平台設定。

## 若之前已啟動過獨立的 8101 版本
```cmd
"C:\Windows\system32\config\systemprofile\AppData\Roaming\npm\pm2.cmd" delete gogo589-hub
"C:\Windows\system32\config\systemprofile\AppData\Roaming\npm\pm2.cmd" save
rmdir /s /q D:\wwwroot\gogo589\hub
```
