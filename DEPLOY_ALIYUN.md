# 阿里云部署指南（合赢项目社官网）

> **最快路径**：代码拉到服务器后 → `nano backend/.env` 填好密钥 → `bash deploy.sh` 一键完成。
> 项目根目录已自带：`deploy.sh`（一键脚本）、`docker-compose.yml`、`Dockerfile.backend`、`Dockerfile.frontend`、`nginx.conf`、`backend/.env.example`。

本项目 = React 前端（构建后为静态文件）+ FastAPI 后端（8001 端口）+ MongoDB。
推荐使用 **Docker Compose** 在阿里云轻量应用服务器上一键起服务。

## 一、准备

1. 阿里云购买「轻量应用服务器」（2核2G 即可，系统选 Ubuntu 22.04）
2. 如使用自己的域名（如 heyingxxx.com），需先在阿里云完成 **ICP 备案**（1-2 周），微信服务号菜单才允许跳转
3. 服务器放行端口：80、443

## 二、安装 Docker

```bash
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER && newgrp docker
```

## 三、获取代码并上传

通过 Emergent 的「Save to GitHub」导出代码后：

```bash
git clone https://github.com/你的账号/你的仓库.git heying
cd heying
```

## 四、配置环境变量

### backend/.env（按实际填写，不要有默认值泄露到公网）

```
MONGO_URL=mongodb://mongo:27017
DB_NAME=heying
JWT_SECRET=换成一串随机长字符串
ADMIN_USERNAME=admin
ADMIN_PASSWORD=换成你的强密码（首次启动会用它创建管理员，务必修改默认值）
EMERGENT_LLM_KEY=你的Emergent通用密钥（用于AI客服与图片存储，见下方说明）
```

### 平台绑定项说明（重要）

- **EMERGENT_LLM_KEY 必须保留**：AI 客服（GPT 对话）和后台图片上传都通过 Emergent 的云端集成服务完成，部署到阿里云后只要这个密钥有效，两个功能照常可用；密钥失效则 AI 客服和图片上传不可用
- **已上传的图片不受影响**：微信二维码、收益海报等存在 Emergent 对象存储，正式站会继续正常读取
- **首次启动自动播种**：阿里云上的 MongoDB 是空库，启动后会自动写入 9 个示例项目和 14 篇示例文章，登录后台（/admin）替换成您的真实内容即可
- **可选清理**：`frontend/public/index.html` 里的 `emergent-main.js` 和 posthog 统计脚本是 Emergent 平台用的，自部署后可删除，不影响功能

### frontend/.env

```
REACT_APP_BACKEND_URL=
```

> 留空表示前后端同域，由 nginx 反代 /api 到后端。注意：CRA 打包会把该值**写死**进静态文件，所以下面的 Dockerfile.frontend 里已强制置空，防止把预览地址打进正式包。

## 五、一键启动

把下方 `docker-compose.yml`、`Dockerfile.backend`、`Dockerfile.frontend`、`nginx.conf` 放到项目根目录，然后：

```bash
docker compose up -d --build
```

访问 `http://服务器IP` 即可。后台入口 `/admin`。

### docker-compose.yml

```yaml
services:
  mongo:
    image: mongo:7
    restart: always
    volumes:
      - mongo_data:/data/db

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    restart: always
    env_file: backend/.env
    depends_on:
      - mongo

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mongo_data:
```

### Dockerfile.backend

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
COPY backend/ .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Dockerfile.frontend

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ .
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### nginx.conf

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://backend:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /fonts/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /images/ {
        expires 7d;
        add_header Cache-Control "public";
    }

    location / {
        try_files $uri /index.html;
    }
}
```

## 六、HTTPS（微信服务号必须）

HTTPS 已内置到部署流程：`deploy.sh` 每次执行时自动检测 `/etc/letsencrypt/live/eztyv.com/fullchain.pem`，存在则启用 HTTPS（80 端口自动跳转 443），不存在则仅 HTTP。

首次申请证书（需先临时停掉前端容器释放 80 端口）：

```bash
sudo apt install certbot -y
cd ~/acai && docker compose stop frontend
sudo certbot certonly --standalone -d eztyv.com -d www.eztyv.com
docker compose start frontend
```

证书每 90 天到期，设置自动续期（执行一次即可）：

```bash
sudo certbot renew --pre-hook "cd ~/acai && docker compose stop frontend" --post-hook "cd ~/acai && docker compose start frontend" --dry-run
echo "0 3 * * * root certbot renew --pre-hook \"cd ~/acai && docker compose stop frontend\" --post-hook \"cd ~/acai && docker compose start frontend\"" | sudo tee /etc/cron.d/certbot-renew
```

## 七、挂到微信服务号

1. 登录 https://mp.weixin.qq.com（需已认证服务号）
2. 自定义菜单 → 添加菜单 → 类型选「跳转网页」→ 填入 `https://你的域名`
3. 保存并发布，微信内打开测试

## 八、数据说明

- 预览环境的数据（项目/文章/设置）不会随代码走，部署后请在正式站后台重新录入，或联系 Emergent 支持协助导出预览库数据
