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
```bash
# 装宝塔 Linux（Ubuntu）
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh
# 软件商店：Nginx、PM2管理器(Node 20)、MongoDB 7.x、Python 3.11
# 后端
cd /www/wwwroot/gogo589-api/backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
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
