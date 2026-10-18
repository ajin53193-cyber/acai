#!/usr/bin/env bash
# gogo589 一键部署入口（前后端分离）
# 后端 API 服务器执行：  bash deploy.sh backend
# 前端/后台服务器执行：  bash deploy.sh frontend
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
case "${1:-}" in
  backend)  bash "$HERE/deploy_backend.sh" ;;
  frontend) bash "$HERE/deploy_frontend.sh" ;;
  *)
    echo "用法：bash deploy.sh [backend|frontend]"
    echo "  后端 API 服务器执行：bash deploy.sh backend"
    echo "  前端/后台服务器执行：bash deploy.sh frontend"
    exit 1 ;;
esac
