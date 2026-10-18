#!/usr/bin/env bash
# gogo589 三站一键体检（上线后随时跑）
# 用法：bash healthcheck.sh
# 可用环境变量覆盖域名：
#   API_URL   后端 API（默认从 frontend/.env 的 REACT_APP_BACKEND_URL 读取）
#   FRONT_URL 商城前台域名
#   ADMIN_URL 管理后台域名
set -uo pipefail
RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; NC='\033[0m'
pass(){ echo -e "${GRN}✔ $*${NC}"; }
fail(){ echo -e "${RED}✘ $*${NC}"; FAILED=1; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FENV=""; for p in "$HERE/frontend/.env" "$HERE/.env"; do [ -f "$p" ] && FENV="$p" && break; done
readenv(){ [ -n "$FENV" ] && grep -E "^$1=" "$FENV" | head -1 | cut -d= -f2- || true; }

API_URL="${API_URL:-$(readenv REACT_APP_BACKEND_URL)}"
API_URL="${API_URL:-https://www.apy-gogo-pay-589ppyppgkn.com}"
FRONT_URL="${FRONT_URL:-https://print8.8bc8uyz.com}"
ADMIN_URL="${ADMIN_URL:-https://print8.1bc8uyz.com}"
API_URL="${API_URL%/}"; FRONT_URL="${FRONT_URL%/}"; ADMIN_URL="${ADMIN_URL%/}"
FAILED=0
code(){ curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1" 2>/dev/null || echo 000; }

echo "=== gogo589 体检 ==="
echo "API:   $API_URL"
echo "前台:  $FRONT_URL"
echo "后台:  $ADMIN_URL"
echo "-------------------"

# 1) 后端 API
BODY="$(curl -s --max-time 20 "$API_URL/api/products?limit=200" 2>/dev/null || true)"
C="$(code "$API_URL/api/products?limit=1")"
if [ "$C" = "200" ]; then pass "后端 API 200（/api/products）"; else fail "后端 API 异常：HTTP $C"; fi

# 2) 图片可取（挑一张「对象存储」图片：路径含 /api/img/）
IMG="$(echo "$BODY" | grep -oE '"image":"[^"]*"' | sed 's/"image":"//;s/"$//' | grep -E '/api/img/' | head -1)"
if [ -z "$IMG" ]; then
  echo -e "${YEL}⚠ 未找到对象存储图片（可能仅有示例数据/本地图标），跳过图片检查${NC}"
else
  case "$IMG" in http*) IMGURL="$IMG";; *) IMGURL="$API_URL${IMG}";; esac
  CT="$(curl -s -o /dev/null -w '%{content_type}' --max-time 20 "$IMGURL" 2>/dev/null || true)"
  IC="$(code "$IMGURL")"
  if [ "$IC" = "200" ] && echo "$CT" | grep -qi 'image/'; then pass "图片可取（对象存储 $CT）"; else fail "图片打不开：HTTP $IC type=$CT —— 请检查 backend/.env 的 EMERGENT_LLM_KEY"; fi
fi

# 3) 商城前台
FBODY="$(curl -s --max-time 20 "$FRONT_URL/" 2>/dev/null || true)"
FC="$(code "$FRONT_URL/")"
if [ "$FC" = "200" ] && echo "$FBODY" | grep -q 'id="root"'; then pass "商城前台可达（200 且含 #root）"; else fail "商城前台异常：HTTP $FC"; fi

# 4) 管理后台
AC="$(code "$ADMIN_URL/gg589-k7p2x/login")"
if [ "$AC" = "200" ]; then pass "管理后台登录页可达（200）"; else fail "管理后台异常：HTTP $AC（检查 Nginx 是否放行 /gg589-k7p2x/）"; fi

echo "-------------------"
if [ "$FAILED" = "0" ]; then echo -e "${GRN}✔ 全部通过，三站健康${NC}"; exit 0; else echo -e "${RED}✘ 存在异常项，请按上面提示排查${NC}"; exit 1; fi
