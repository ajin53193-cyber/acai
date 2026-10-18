#!/usr/bin/env bash
# gogo589 图片迁移包装脚本：把对象存储现有图片下载到本地磁盘（一次性）。
# 在「后端 API 服务器」仓库根目录运行： bash migrate_images.sh
set -euo pipefail
RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; NC='\033[0m'
info(){ echo -e "${YEL}➤ $*${NC}"; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$HERE/backend" ]; then BACKEND="$HERE/backend"
elif [ -f "$HERE/server.py" ]; then BACKEND="$HERE"
else echo -e "${RED}✘ 找不到 backend 目录${NC}"; exit 1; fi
cd "$BACKEND"

if [ -d venv ]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
else
  info "未找到 venv，使用系统 python3（建议先跑 deploy.sh backend 建好 venv）"
fi

info "开始迁移对象存储图片 -> 本地 LOCAL_STORAGE_DIR ..."
python migrate_images_local.py
echo -e "${GRN}✔ 迁移脚本执行结束。随后用 bash healthcheck.sh 验证图片可访问。${NC}"
