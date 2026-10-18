#!/usr/bin/env bash
# gogo589 前端一键部署 / 更新脚本（在「商城前台」或「管理后台」前端服务器运行）
# 用法：bash deploy_frontend.sh
# 构建产物在 frontend/build，宝塔网站根目录指向它即可。
set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; NC='\033[0m'
err(){ echo -e "${RED}✘ $*${NC}" >&2; exit 1; }
ok(){ echo -e "${GRN}✔ $*${NC}"; }
info(){ echo -e "${YEL}➤ $*${NC}"; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$HERE/frontend" ]; then FRONT="$HERE/frontend"
elif [ -f "$HERE/package.json" ]; then FRONT="$HERE"
else err "找不到 frontend 目录，请把脚本放在仓库根目录（与 frontend 同级）运行"; fi
cd "$FRONT"
info "前端目录：$FRONT"

command -v yarn >/dev/null 2>&1 || err "未找到 yarn，请先安装：npm i -g yarn"

if [ ! -f .env ]; then
  [ -f .env.production.example ] && cp .env.production.example .env
  err "已从模板生成 frontend/.env —— 请填好 REACT_APP_BACKEND_URL（后端 API 域名）后重跑"
fi
BURL="$(grep -E '^REACT_APP_BACKEND_URL=' .env | head -1 | cut -d= -f2-)"
[ -n "$BURL" ] || err "frontend/.env 的 REACT_APP_BACKEND_URL 未填写（后端 API 域名）"
ok "后端 API 地址：$BURL"

info "安装依赖 yarn install ..."
yarn install --frozen-lockfile 2>/dev/null || yarn install
info "构建生产包 yarn build ...（约 1-3 分钟）"
yarn build
[ -d build ] || err "构建失败：未生成 build 目录"
ok "构建完成：$FRONT/build"
echo -e "${GRN}✔ 前端部署完成。请确认宝塔网站根目录指向：$FRONT/build${NC}"
