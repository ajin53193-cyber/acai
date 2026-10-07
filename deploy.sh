#!/usr/bin/env bash
# 合赢项目社官网 · 阿里云一键部署脚本
# 用法：在服务器上进入项目目录后执行  bash deploy.sh
set -e

echo "==> 检查 Docker ..."
if ! command -v docker >/dev/null 2>&1; then
  echo "==> 安装 Docker（阿里云镜像源）..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  bash /tmp/get-docker.sh --mirror Aliyun
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "==> 安装 docker compose 插件 ..."
  apt-get update && apt-get install -y docker-compose-plugin
fi

echo "==> 配置 Docker 国内镜像加速 ..."
if [ ! -f /etc/docker/daemon.json ]; then
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json << 'EOF'
{"registry-mirrors": ["https://docker.m.daocloud.io"]}
EOF
  systemctl restart docker || true
fi

echo "==> 检查环境变量 backend/.env ..."
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo ""
  echo "================================================"
  echo "  已生成 backend/.env，请先编辑填写："
  echo "    nano backend/.env"
  echo "  填完后再执行一次  bash deploy.sh"
  echo "================================================"
  exit 1
fi

echo "==> 构建并启动（首次约 5-10 分钟）..."
docker compose up -d --build

echo ""
echo "==> 完成！访问 http://服务器IP 即可，后台入口 /admin"
echo "==> 绑定域名后记得开 HTTPS： apt install certbot python3-certbot-nginx -y && certbot --nginx -d 你的域名"
