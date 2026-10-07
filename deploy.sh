#!/usr/bin/env bash
# 合赢项目社官网 · 阿里云一键部署脚本
# 用法：在服务器上进入项目目录后执行  bash deploy.sh
# 功能：拉取最新代码 → 检查配置 → 构建启动 → 健康检查
set -e

cd "$(dirname "$0")"

echo "==> 检查 Docker ..."
if ! command -v docker >/dev/null 2>&1; then
  echo "==> 安装 Docker（阿里云 apt 镜像源）..."
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> 配置 Docker 国内镜像加速 ..."
if [ ! -f /etc/docker/daemon.json ]; then
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json << 'EOF'
{"registry-mirrors": ["https://docker.m.daocloud.io"]}
EOF
  systemctl restart docker || true
fi

echo "==> 拉取最新代码 ..."
if [ -d .git ]; then
  if git pull --ff-only; then
    echo "==> 代码已更新到最新"
  else
    echo "!! 代码拉取失败（可能服务器上有本地改动）。将继续用当前代码构建。"
    echo "!! 如需强制同步远端： git fetch --all && git reset --hard origin/$(git branch --show-current 2>/dev/null || echo main)"
  fi
else
  echo "==> 当前目录不是 git 仓库，跳过拉取（首次部署属正常）"
fi

echo "==> 检查环境变量 backend/.env ..."
if [ ! -f backend/.env ]; then
  cp backend/env.example backend/.env
  echo ""
  echo "================================================"
  echo "  已生成 backend/.env，请先编辑填写："
  echo "    nano backend/.env"
  echo "  填完后再执行一次  bash deploy.sh"
  echo "================================================"
  exit 1
fi
if ! grep -q "AI_API_KEY=sk-" backend/.env; then
  echo ""
  echo "!! 警告：backend/.env 缺少 DeepSeek 密钥，AI 客服将无法自动回复"
  echo "!! 请 nano backend/.env 确认有以下三行："
  echo "     AI_BASE_URL=https://api.deepseek.com"
  echo "     AI_API_KEY=你的DeepSeek密钥（sk- 开头）"
  echo "     AI_MODEL=deepseek-chat"
  echo ""
fi

echo "==> 检查 SSL 证书 ..."
if [ -f /etc/letsencrypt/live/eztyv.com/fullchain.pem ]; then
  cp docker-compose.ssl.yml docker-compose.override.yml
  echo "==> 检测到 eztyv.com 证书，本次启用 HTTPS（HTTP 自动跳转 HTTPS）"
else
  rm -f docker-compose.override.yml
  echo "==> 未检测到 SSL 证书，本次仅启用 HTTP"
fi

echo "==> 构建并启动（首次约 5-10 分钟，后续约 1-3 分钟）..."
docker compose up -d --build

echo "==> 等待服务启动并做健康检查 ..."
ok=0
for i in 1 2 3 4 5 6 7 8; do
  sleep 5
  if curl -fs http://localhost/api/settings -o /dev/null 2>&1; then
    ok=1
    break
  fi
done

echo ""
if [ "$ok" = "1" ]; then
  echo "================================================"
  echo "  部署成功，健康检查通过！"
  echo "  网站： http://服务器IP  或  https://你的域名"
  echo "  后台： /admin"
  echo ""
  echo "  部署后请登录后台完成三件事："
  echo "  1. 站点设置 → 在线客服 → 上传微信群二维码"
  echo "  2. 确认「AI 自动回复」开关已打开"
  echo "  3. 收益海报等自定义图片如有缺失请重新上传"
  echo "================================================"
else
  echo "================================================"
  echo "  服务未通过健康检查，请排查："
  echo "    docker compose ps"
  echo "    docker compose logs --tail 50 backend"
  echo "    docker compose logs --tail 50 frontend"
  echo "================================================"
  exit 1
fi
