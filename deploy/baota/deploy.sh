#!/usr/bin/env bash
# 合赢项目社 · 宝塔/Linux 一键部署与更新脚本
# 用法：cd /www/wwwroot/heying && bash deploy/baota/deploy.sh
# 首次运行：安装依赖、构建前端、注册并启动后端服务；之后每次更新：git pull 后再执行一次即可
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
SERVICE_NAME="heying-backend"
PIP_INDEX="${PIP_INDEX:-https://mirrors.aliyun.com/pypi/simple/}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"

red() { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
step() { echo -e "\n\033[36m==> $*\033[0m"; }

cd "$APP_DIR"

# ---------- 0. 拉取最新代码（如果是 git 仓库） ----------
if [ -d .git ]; then
  step "拉取最新代码"
  git pull --ff-only || red "git pull 失败，继续使用当前代码"
fi

# ---------- 1. 检查 .env ----------
step "检查后端配置 backend/.env"
if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$APP_DIR/deploy/baota/backend.env.example" "$BACKEND_DIR/.env"
  SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 48)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$SECRET|" "$BACKEND_DIR/.env"
  sed -i "s|^UPLOAD_DIR=.*|UPLOAD_DIR=$APP_DIR/uploads|" "$BACKEND_DIR/.env"
  red "已生成 $BACKEND_DIR/.env，请检查其中的 ADMIN_PASSWORD / AI_API_KEY（DeepSeek 密钥，留空则 AI 客服回落为人工提示）后重新执行本脚本"
  exit 1
fi
grep -q "^LOCAL_STORAGE=1" "$BACKEND_DIR/.env" || red "提示：.env 未设置 LOCAL_STORAGE=1，上传图片将尝试连接 Emergent 对象存储（自托管请设为 1）"

# ---------- 2. Python 虚拟环境 ----------
step "准备 Python 环境（需要 3.10+）"
PY=""
for c in python3.12 python3.11 python3.10 python3 /www/server/pyenv/versions/3.1*/bin/python3 /www/server/pyproject_evn/*/bin/python3; do
  for p in $c; do
    if command -v "$p" >/dev/null 2>&1 || [ -x "$p" ]; then
      if "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then PY="$p"; break 2; fi
    fi
  done
done
if [ -z "$PY" ]; then
  red "未找到 Python 3.10+。请在宝塔「软件商店 → Python项目管理器 → 版本管理」安装 3.11，或执行 apt install -y python3.11 python3.11-venv 后重试"
  exit 1
fi
echo "使用 $PY ($($PY --version))"
if [ ! -x "$BACKEND_DIR/.venv/bin/python" ]; then
  "$PY" -m venv "$BACKEND_DIR/.venv"
fi
"$BACKEND_DIR/.venv/bin/pip" install -q -i "$PIP_INDEX" --upgrade pip
"$BACKEND_DIR/.venv/bin/pip" install -q -i "$PIP_INDEX" -r "$BACKEND_DIR/requirements-selfhost.txt"
green "Python 依赖安装完成"

# ---------- 3. 构建前端 ----------
step "构建前端（Node 18+）"
if ! command -v node >/dev/null 2>&1; then
  red "未找到 node。请在宝塔「软件商店 → Node.js版本管理器」安装 Node 20 并设为默认版本后重试"
  exit 1
fi
echo "Node $(node -v)"
cd "$FRONTEND_DIR"
command -v yarn >/dev/null 2>&1 || npm i -g yarn --registry "$NPM_REGISTRY"
# 去掉仅 Emergent 预览环境使用的 devDependencies（境内无法下载），构建不需要它们
node -e '
const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));
for (const k of Object.keys(p.devDependencies||{})) if (k.startsWith("@emergentbase/")) delete p.devDependencies[k];
fs.writeFileSync("package.json", JSON.stringify(p,null,2));'
yarn install --registry "$NPM_REGISTRY" --network-timeout 600000 --ignore-engines
REACT_APP_BACKEND_URL="" DISABLE_EMERGENT_OVERLAY=true NODE_OPTIONS="--max-old-space-size=2048" GENERATE_SOURCEMAP=false yarn build
# 恢复被改动的 package.json / yarn.lock，避免影响下次 git pull
git -C "$APP_DIR" checkout -- frontend/package.json 2>/dev/null || true
git -C "$APP_DIR" checkout -- frontend/yarn.lock 2>/dev/null || true
green "前端构建完成：$FRONTEND_DIR/build"

# ---------- 4. 后端服务（systemd） ----------
step "注册并重启后端服务 $SERVICE_NAME"
mkdir -p "$APP_DIR/uploads"
if command -v systemctl >/dev/null 2>&1; then
  sed "s|/www/wwwroot/heying|$APP_DIR|g" "$APP_DIR/deploy/baota/heying-backend.service" > "/etc/systemd/system/$SERVICE_NAME.service"
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
  systemctl restart "$SERVICE_NAME"
  sleep 3
  systemctl is-active --quiet "$SERVICE_NAME" || { red "后端启动失败，日志："; journalctl -u "$SERVICE_NAME" -n 40 --no-pager; exit 1; }
else
  red "系统无 systemd，请用宝塔「Python项目管理器」手动启动：$BACKEND_DIR/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001"
fi

# ---------- 5. 健康检查 ----------
step "健康检查"
if curl -sf http://127.0.0.1:8001/api/settings >/dev/null; then
  green "后端 OK：http://127.0.0.1:8001/api/settings"
else
  red "后端接口无响应，请查看：journalctl -u $SERVICE_NAME -n 50"
  exit 1
fi

green "\n部署完成！请确认宝塔站点根目录指向：$FRONTEND_DIR/build，并已按 deploy/baota/nginx-site.conf 配置 /api/ 反向代理。"
echo "首次迁移线上数据请执行：$BACKEND_DIR/.venv/bin/python deploy/baota/import_from_live.py"
