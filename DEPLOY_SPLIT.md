# gogo589 前后端分离部署清单（Ubuntu 22.04 + 宝塔 Linux）

## 域名映射
| 角色 | 域名 | 说明 |
|---|---|---|
| 商城前台（前端） | print8.8bc8uyz.com、print8.2bc8uyz.com | 两个域名共用同一份 build |
| 管理后台（前端） | print8.1bc8uyz.com | 同一份 build，隐藏路径 /gg589-k7p2x/login |
| 后端 API | www.apy-gogo-pay-589ppyppgkn.com | Nginx 反代到 127.0.0.1:8001 |

鉴权：Clerk Bearer Token + 后台 X-Admin-Token（请求头），不依赖 Cookie，跨域名安全可用。

---

## 一、.env（见 frontend/.env.production.example、backend/.env.production.example）
- backend/.env：
  - CORS_ORIGINS=https://print8.8bc8uyz.com,https://print8.2bc8uyz.com,https://print8.1bc8uyz.com
  - APP_PUBLIC_URL=https://print8.8bc8uyz.com
  - TRONGRID_API_KEY=（USDT 自动扫链到账必填，免费申请 trongrid.io/dashboard；不填会 429 限流）
  - USDT_SCAN_SECONDS=90（后台自动扫链周期，秒）
  - EMERGENT_LLM_KEY=sk-emergent-68eBd73902bA24a64A ⚠️必填（商品/分类/评价等所有图片走 Emergent 对象存储，靠此 key 访问；留空或填错 → 全站图片 401/404 打不开。自动翻译脚本也用它）
  - GEO_ENFORCE=true / GEO_STORE_ALLOW=...（正式环境地区限制，按需配置；预览环境保持 false）
- frontend/.env：
  - REACT_APP_BACKEND_URL=https://www.apy-gogo-pay-589ppyppgkn.com
- 改完 `cd frontend && yarn build`，把 build 传到商城与后台站点目录。

---

## 二、Nginx（宝塔「网站 → 配置文件」粘贴，SSL 用宝塔一键 Let's Encrypt）

### 商城前台（两个域名共用）
```nginx
server {
  listen 443 ssl http2;
  server_name print8.8bc8uyz.com print8.2bc8uyz.com;
  root /www/wwwroot/gogo589-front/frontend/build;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
  location /static/ { expires 30d; add_header Cache-Control "public, immutable"; }
  gzip on; gzip_comp_level 5;
  gzip_types text/css application/javascript application/json image/svg+xml;
}
```

### 管理后台（只放行隐藏后台路径，更安全）
```nginx
server {
  listen 443 ssl http2;
  server_name print8.1bc8uyz.com;
  root /www/wwwroot/gogo589-admin/frontend/build;
  index index.html;
  location /gg589-k7p2x/ { try_files $uri $uri/ /index.html; }
  location ~* \.(js|css|png|svg|woff2?|ico|json)$ { try_files $uri =404; }
  location / { return 404; }
}
```

### 后端 API（反代到 8001）
```nginx
server {
  listen 443 ssl http2;
  server_name www.apy-gogo-pay-589ppyppgkn.com;
  client_max_body_size 50m;
  location / {
    proxy_pass http://127.0.0.1:8001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;
  }
}
```

---

## 三、部署步骤

### 0）全新服务器先装环境（什么都没装时，先跑这个）
```bash
# 需 root/sudo。会装 git / Node20 / yarn / pm2；backend 角色额外装 Python3.11 + MongoDB7
sudo bash setup_server.sh backend     # 在后端 API 服务器
sudo bash setup_server.sh frontend    # 在前端/后台服务器
# Nginx 与 SSL 建议用宝塔面板 GUI 一键完成（也可只用本脚本+手装 Nginx）
```

### ✅ 一键脚本（推荐，可重复运行；首次部署与日后更新都用它）
```bash
# 先装好环境：宝塔软件商店 → Nginx、PM2管理器(Node 20)、MongoDB 7.x、Python 3.11；并 npm i -g yarn
# 把代码放到对应目录后：

# 【后端 API 服务器】/www/wwwroot/gogo589-api （与 backend 同级）
cd /www/wwwroot/gogo589-api
bash deploy.sh backend          # 自动建 venv、装依赖、校验 .env、pm2 启动/重载、健康检查

# 【前端 商城服务器】/www/wwwroot/gogo589-front （与 frontend 同级）
cd /www/wwwroot/gogo589-front
bash deploy.sh frontend         # 自动 yarn install + yarn build，产物在 frontend/build

# 【后台 服务器】/www/wwwroot/gogo589-admin （同一份前端代码）
cd /www/wwwroot/gogo589-admin
bash deploy.sh frontend
```
> 脚本会在 `.env` 缺失时自动从 `.env.production.example` 生成并提示你填写；`MONGO_URL / DB_NAME / EMERGENT_LLM_KEY / CORS_ORIGINS`（后端）与 `REACT_APP_BACKEND_URL`（前端）未填会直接中止，避免带错配置上线。更新代码后重跑同一条命令即可热更新。

### 手动步骤（等价，供排查参考）
```bash
# 装宝塔 Linux（Ubuntu）
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh
# 后端
cd /www/wwwroot/gogo589-api/backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
pm2 start "venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001" --name gogo589-backend
pm2 save && pm2 startup
# 前端
cd /www/wwwroot/gogo589-front/frontend && yarn && yarn build
# 宝塔建 3 个网站 → 各自一键 SSL
```

---

## 四、换域名后更新第三方
- Clerk：三个前端域名加入允许来源；配 clerk.<根域> CNAME。
- Stripe / PayPal：return URL 用 https://print8.8bc8uyz.com；Webhook 指向 https://www.apy-gogo-pay-589ppyppgkn.com/api/... 并更新密钥。

## 五、安全加固
- 后端 8001 仅监听 127.0.0.1；MongoDB bindIp=127.0.0.1 + 账号密码。
- 三站全上 SSL；宝塔面板改端口 + 两步验证 + 堡塔防火墙。
- 系统防火墙只开 80/443，SSH 22 限 IP；每天备份 MongoDB 并异地同步。

## 六、运维脚本（上线后常用）
```bash
# 三站一键体检（API 200 / 对象存储图片可取 / 前台后台可达）
bash healthcheck.sh
#（可覆盖域名）API_URL=... FRONT_URL=... ADMIN_URL=... bash healthcheck.sh

# 立即备份一次 MongoDB（自动读 backend/.env 的 MONGO_URL/DB_NAME）
bash backup_mongo.sh
# 安装每日 03:30 自动备份（可选异地同步到备份机）
REMOTE='user@备份机:/backup/gogo589' bash backup_mongo.sh --install-cron
# 还原：mongorestore --uri="$MONGO_URL" --archive=/www/backup/mongo/gogo589_YYYYMMDD_HHMMSS.archive.gz --gzip --drop
```

## 七、旧库迁移（上线前把旧服务器数据搬到新库）
```bash
# 在新服务器直接从旧库拉取并导入（旧库名默认 test_database，按实际改 SRC_DB）
SRC_URI="mongodb://旧账号:旧密码@旧服务器IP:27017/test_database?authSource=admin" \
DST_URI="mongodb://新账号:新密码@127.0.0.1:27017/gogo589?authSource=admin" \
SRC_DB=test_database bash migrate_mongo.sh
# 或：已有旧库导出文件时  DUMP=/路径/archive.gz DST_URI=... bash migrate_mongo.sh
```
> 用 `--drop` 覆盖同名集合并自动把旧库名映射到新库名；迁移前会先给新库做一次安全备份；完成后跑 `bash healthcheck.sh` 验证。
