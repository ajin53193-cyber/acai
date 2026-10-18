#!/usr/bin/env bash
# gogo589 后端一键部署 / 更新脚本（在「后端 API 服务器」运行）
# 用法：bash deploy_backend.sh
# 可重复运行：首次会建 venv 并 pm2 start，之后自动 pm2 reload 热更新。
set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; NC='\033[0m'
err(){ echo -e "${RED}✘ $*${NC}" >&2; exit 1; }
ok(){ echo -e "${GRN}✔ $*${NC}"; }
info(){ echo -e "${YEL}➤ $*${NC}"; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$HERE/backend" ]; then BACKEND="$HERE/backend"
elif [ -f "$HERE/server.py" ]; then BACKEND="$HERE"
else err "找不到 backend 目录，请把脚本放在仓库根目录（与 backend 同级）运行"; fi
cd "$BACKEND"
info "后端目录：$BACKEND"

PY="${PYTHON_BIN:-python3.11}"
command -v "$PY" >/dev/null 2>&1 || PY=python3
command -v "$PY" >/dev/null 2>&1 || err "未找到 python3.11/python3，请先在宝塔软件商店安装 Python 3.11"

if [ ! -d venv ]; then info "创建虚拟环境 venv ..."; "$PY" -m venv venv; fi
# shellcheck disable=SC1091
source venv/bin/activate

info "安装依赖（含 emergentintegrations 专用源）..."
pip install --upgrade pip >/dev/null
pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
ok "依赖安装完成"

if [ ! -f .env ]; then
  if [ -f .env.production.example ]; then
    cp .env.production.example .env
  else
    cat > .env <<'EOF'
MONGO_URL=mongodb://用户名:密码@127.0.0.1:27017/gogo589?authSource=admin
DB_NAME=gogo589
CORS_ORIGINS=https://你的商城域名,https://你的后台域名
APP_PUBLIC_URL=https://你的商城域名
TRONGRID_API_KEY=
USDT_SCAN_SECONDS=90
EMERGENT_LLM_KEY=sk-emergent-68eBd73902bA24a64A
GEO_ENFORCE=false
GEO_STORE_ALLOW=
EOF
  fi
  err ".env 不存在，已生成 backend/.env 模板 —— 请填好后重跑（必填 MONGO_URL / DB_NAME / EMERGENT_LLM_KEY / CORS_ORIGINS）"
fi
getenv(){ grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
MONGO="$(getenv MONGO_URL)"; KEY="$(getenv EMERGENT_LLM_KEY)"; CORS="$(getenv CORS_ORIGINS)"; DBN="$(getenv DB_NAME)"
{ [ -n "$MONGO" ] && [[ "$MONGO" != *用户名* ]]; } || err "backend/.env 的 MONGO_URL 未填真实连接串"
[ -n "$DBN" ]  || err "backend/.env 的 DB_NAME 未填写"
[ -n "$KEY" ]  || err "backend/.env 的 EMERGENT_LLM_KEY 为空（否则全站图片打不开 401/404）。有效值见 DEPLOY_SPLIT.md"
[ -n "$CORS" ] || err "backend/.env 的 CORS_ORIGINS 未填前端域名"
ok ".env 校验通过（DB=$DBN）"

NAME="${PM2_NAME:-gogo589-backend}"
PORT="${PORT:-8001}"
command -v pm2 >/dev/null 2>&1 || err "未检测到 pm2，请在宝塔软件商店安装「PM2管理器(Node 20)」后重跑"
if pm2 describe "$NAME" >/dev/null 2>&1; then
  info "重载 PM2 进程 $NAME ..."; pm2 reload "$NAME" --update-env
else
  info "首次启动 PM2 进程 $NAME（127.0.0.1:$PORT）..."
  pm2 start "venv/bin/uvicorn server:app --host 127.0.0.1 --port $PORT" --name "$NAME"
fi
pm2 save
ok "后端已通过 PM2 运行：$NAME"
echo; pm2 status "$NAME" || true

sleep 2
if curl -fsS "http://127.0.0.1:$PORT/api/products?limit=1" >/dev/null 2>&1; then
  ok "本地健康检查通过：/api/products 200"
else
  echo -e "${YEL}⚠ 本地健康检查未通过，请查看日志：pm2 logs $NAME${NC}"
fi
echo -e "${GRN}✔ 后端部署完成。${NC}"
