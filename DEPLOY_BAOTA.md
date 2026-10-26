# gogo589 宝塔（Windows 10）自托管部署指南

> ⚠️ 重要前提
> 1. **Windows 10 是桌面系统，不建议作为正式生产服务器**（稳定性/并发/长时间运行都不理想）。如条件允许，强烈建议改用 Linux 服务器或直接用 Emergent 一键部署。
> 2. 本应用**仍会调用 Emergent 托管服务**：图片上传（对象存储）和繁转简/英自动翻译都依赖 `EMERGENT_LLM_KEY`，会消耗你的 Emergent 积分，且需要服务器能访问 `integrations.emergentagent.com`。
> 3. 账号系统为**自建**（bcrypt 密码 + JWT，全部存在你自己的 MongoDB），后端 `.env` 需配置 `AUTH_SECRET`（随机长字符串，用于签发登录令牌；一旦更换所有用户需重新登录）。

---

## 第 0 步：导出代码到 GitHub
1. 在 Emergent 聊天输入框点 **Save → Save to GitHub**（需 Standard 及以上套餐）。
2. 选择你的 GitHub 账号 / 仓库 / 分支，推送完成。
3. 在服务器上 `git clone` 你的仓库到例如 `C:\wwwroot\gogo589`。

> 代码**不含** `.env`（出于安全）。密钥要去 Emergent 的 **Republish → Secrets** 里逐个复制。

---

## 第 1 步：宝塔安装运行环境
在宝塔「软件商店」里安装：
- **Node.js 版本管理器**（装 Node 18 或 20）
- **Python 项目管理器**（装 **Python 3.11**，与本项目一致）
- **MongoDB**（或用 MongoDB Atlas 云数据库）
- **Nginx**
- **PM2 管理器**（Node 项目管理器里自带）

---

## 第 2 步：准备后端
```powershell
cd C:\wwwroot\gogo589\backend
# 建虚拟环境
python -m venv venv
venv\Scripts\activate
# 安装依赖（emergentintegrations 需加 Emergent 专用源）
pip install -r requirements.txt
pip install emergentintegrations==0.2.2 --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```
复制 `.env.example` 为 `.env` 并填写真实值（见文件内注释）：
- `MONGO_URL` 改成你本机 MongoDB，如 `mongodb://127.0.0.1:27017`
- `EMERGENT_LLM_KEY`、`AUTH_SECRET`、`STRIPE_API_KEY`、`APP_PUBLIC_URL`、`CORS_ORIGINS` 等按注释填

启动后端（二选一）：
```powershell
# 方式A：命令行直接跑
venv\Scripts\activate
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2

# 方式B：用 PM2（在 /app 根目录）
pm2 start ecosystem.config.js
pm2 save
```

---

## 第 3 步：准备前端（打包成静态文件）
```powershell
cd C:\wwwroot\gogo589\frontend
# 复制 .env.example 为 .env，把 REACT_APP_BACKEND_URL 改成你的域名
corepack enable   # 启用 yarn
yarn install
yarn build         # 生成 build 目录（静态文件）
```

---

## 第 4 步：宝塔配置网站 + 反向代理
1. 宝塔「网站 → 添加站点」，绑定你的域名，根目录指向 `C:\wwwroot\gogo589\frontend\build`。
2. 打开站点「配置文件」，参考仓库里的 `deploy/nginx.conf.sample`：
   - `location /` 用 `try_files $uri /index.html`（SPA 路由回退）
   - `location /api/` 反代到 `http://127.0.0.1:8001`
   - `client_max_body_size 20m`（允许图片上传）
3. 站点「SSL」里一键申请 Let's Encrypt 证书并开启强制 HTTPS。

---

## 第 5 步：数据迁移（可选）
如果要把 Emergent 上现有数据搬过来：
1. 在 Emergent 用 Database Viewer 或 `mongodump` 导出数据。
2. 在你服务器上 `mongorestore` 导入到本地 MongoDB（库名与 `DB_NAME` 一致）。

---

## 第 6 步：第三方回调地址更新
部署好域名后，记得更新：
- **Stripe**：webhook 指向 `https://你的域名/api/webhook/stripe`
- **PayPal**：webhook 指向 `https://你的域名/api/webhook/paypal`
- **Google 登录**：在 Google Cloud Console 把 `https://你的域名/...` 加入授权重定向 URI

---

## 常见问题
- **图片上传失败**：检查 `EMERGENT_LLM_KEY` 是否有效、服务器能否访问 `integrations.emergentagent.com`、Emergent 积分是否充足；或改写 `backend/storage.py` 接入你自己的对象存储（S3/阿里云 OSS）。
- **登录无法用**：确认后端 `.env` 有 `AUTH_SECRET`；老用户（Clerk 时期注册）首次用旧密码登录时会自动迁移密码，若 `CLERK_SECRET_KEY` 已删除则需用验证码登录或「忘记密码」重设。
- **/api 404 或 502**：确认后端 8001 在运行、Nginx 的 `/api/` 反代配置正确。
- **刷新页面 404**：确认 `try_files ... /index.html` 已配置（SPA 回退）。
