#!/usr/bin/env bash
# gogo589 旧库 → 新库 一键迁移（把旧服务器的数据导入新 MongoDB）
#
# 用法一（推荐，在新服务器上拉取旧库）：
#   SRC_URI="mongodb://旧账号:旧密码@旧服务器IP:27017/test_database?authSource=admin" \
#   DST_URI="mongodb://新账号:新密码@127.0.0.1:27017/gogo589?authSource=admin" \
#   bash migrate_mongo.sh
#
# 用法二（已有旧库 dump 文件夹/归档）：
#   DUMP=/path/to/dump_or_archive  DST_URI="mongodb://...:27017/gogo589?authSource=admin" bash migrate_mongo.sh
#
# 说明：
#   - SRC_DB  旧库名（默认 test_database，按实际改；旧 Windows 服务器曾用 test_database）
#   - DST_DB  新库名（默认从 DST_URI 推断，否则 gogo589；应与 backend/.env 的 DB_NAME 一致）
#   - 迁移采用 --drop：导入时会先清空新库里同名集合再写入，确保与旧库一致。
#   - 迁移前会先给新库做一次安全备份（除非 SKIP_BACKUP=1）。
set -euo pipefail
RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; NC='\033[0m'
err(){ echo -e "${RED}✘ $*${NC}" >&2; exit 1; }
ok(){ echo -e "${GRN}✔ $*${NC}"; }
info(){ echo -e "${YEL}➤ $*${NC}"; }

command -v mongorestore >/dev/null 2>&1 || err "未找到 mongorestore，请先装 MongoDB 工具（bash setup_server.sh backend）"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVF=""; for p in "$HERE/backend/.env" "/www/wwwroot/gogo589-api/backend/.env"; do [ -f "$p" ] && ENVF="$p" && break; done
readenv(){ [ -n "$ENVF" ] && grep -E "^$1=" "$ENVF" | head -1 | cut -d= -f2- || true; }

DST_URI="${DST_URI:-$(readenv MONGO_URL)}"
[ -n "$DST_URI" ] || err "未提供 DST_URI（新库连接串），也未在 backend/.env 找到 MONGO_URL"
SRC_DB="${SRC_DB:-test_database}"
DST_DB="${DST_DB:-$(readenv DB_NAME)}"; DST_DB="${DST_DB:-gogo589}"
DUMP="${DUMP:-}"
SRC_URI="${SRC_URI:-}"

[ -n "$DUMP" ] || [ -n "$SRC_URI" ] || err "请提供 SRC_URI（旧库连接串）或 DUMP（已有导出路径）其一"

echo "========= 迁移确认 ========="
echo "  来源：${SRC_URI:+旧库 $SRC_URI (db=$SRC_DB)}${DUMP:+导出文件 $DUMP}"
echo "  目标：$DST_URI (db=$DST_DB)"
echo "  方式：--drop（会覆盖新库同名集合）"
echo "============================"
read -r -p "确认开始迁移？(yes/no) " YES
[ "$YES" = "yes" ] || err "已取消"

# 1) 迁移前安全备份新库
if [ "${SKIP_BACKUP:-0}" != "1" ]; then
  BK="/www/backup/mongo/before_migrate_$(date +%Y%m%d_%H%M%S).archive.gz"
  mkdir -p "$(dirname "$BK")"
  info "迁移前先备份当前新库到 $BK ..."
  mongodump --uri="$DST_URI" --archive="$BK" --gzip 2>/dev/null && ok "已备份（出错可回滚）" || echo -e "${YEL}⚠ 新库为空或备份跳过${NC}"
fi

# 2) 导出旧库（若给的是 SRC_URI）
WORK=""
if [ -n "$SRC_URI" ]; then
  WORK="$(mktemp -d)"
  DUMP="$WORK/dump.archive.gz"
  info "从旧库导出 ..."
  mongodump --uri="$SRC_URI" --db="$SRC_DB" --archive="$DUMP" --gzip
  ok "旧库导出完成：$DUMP"
fi

# 3) 导入新库（--drop 覆盖，--nsFrom/--nsTo 处理库名不同）
# mongorestore 的 --uri 若带库名会被当作 --db 过滤导致 0 条导入，这里去掉库名只保留认证参数
RESTORE_URI="$(printf '%s' "$DST_URI" | sed -E 's#^(mongodb(\+srv)?://[^/]+)/[^?]*#\1/#')"
info "导入新库（$SRC_DB → $DST_DB，--drop）..."
if [ -d "$DUMP" ]; then
  # 目录形式的 dump
  mongorestore --uri="$RESTORE_URI" --drop --nsInclude="${SRC_DB}.*" --nsFrom="${SRC_DB}.*" --nsTo="${DST_DB}.*" "$DUMP"
else
  # 归档形式
  mongorestore --uri="$RESTORE_URI" --drop --gzip --nsInclude="${SRC_DB}.*" --nsFrom="${SRC_DB}.*" --nsTo="${DST_DB}.*" --archive="$DUMP"
fi
ok "导入完成"

[ -n "$WORK" ] && rm -rf "$WORK"

# 4) 校验
info "校验新库集合数量 ..."
mongosh "$DST_URI" --quiet --eval 'const c=db.getCollectionNames(); print("集合数:"+c.length); ["products","categories","reviews","admins","orders"].forEach(n=>{try{print("  "+n+": "+db[n].countDocuments())}catch(e){}});' 2>/dev/null || echo -e "${YEL}（mongosh 不可用，跳过计数校验）${NC}"

echo -e "${GRN}✔ 迁移完成。请运行 bash healthcheck.sh 验证商品与图片是否正常。${NC}"
echo -e "${YEL}提示：若旧库名不是 test_database，请用 SRC_DB=旧库名 重跑。${NC}"
