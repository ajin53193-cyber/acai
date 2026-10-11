#!/usr/bin/env bash
# 四方收款平台 - 一键更新 (Linux)
# 用法: sudo bash deploy/linux/update.sh [分支=z-hzhi-fzhi-fu] [端口=8001]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REPO="ajin53193-cyber/acai"; BRANCH="${1:-z-hzhi-fzhi-fu}"; PORT="${2:-8001}"
TMP=$(mktemp -d)
step(){ printf "\n\033[36m==> %s\033[0m\n" "$1"; }

step "更新前数据库备份"; bash "$ROOT/deploy/linux/backup_db.sh" 14 || echo "备份跳过"
step "下载最新代码 ($REPO @ $BRANCH)"
curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.zip" -o "$TMP/src.zip"
unzip -q "$TMP/src.zip" -d "$TMP"; SRC=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)

step "同步文件（保留 .env / .venv / node_modules / build / backups）"
rsync -a --exclude .env --exclude .venv --exclude logs --exclude __pycache__ --exclude exports "$SRC/backend/" "$ROOT/backend/"
rsync -a --exclude node_modules --exclude build "$SRC/frontend/" "$ROOT/frontend/"
rsync -a "$SRC/deploy/" "$ROOT/deploy/"; chmod +x "$ROOT"/deploy/linux/*.sh
rm -rf "$TMP"

step "后端依赖"; "$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements-prod.txt"
step "前端构建"; cd "$ROOT/frontend"; yarn install --frozen-lockfile; REACT_APP_BACKEND_URL="" GENERATE_SOURCEMAP=false yarn build
step "重启后端"; systemctl restart sifang-backend
for i in $(seq 1 15); do sleep 2; curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null && { echo "后端健康 OK"; break; }; done
echo "更新完成，浏览器 Ctrl+F5 刷新。"
