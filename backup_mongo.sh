#!/usr/bin/env bash
# gogo589 MongoDB 每日备份 + 保留 + 可选异地同步
# 立即备份一次：   bash backup_mongo.sh
# 安装每日定时：   bash backup_mongo.sh --install-cron      （默认每天 03:30）
# 可用环境变量覆盖：
#   BACKUP_DIR  备份目录（默认 /www/backup/mongo）
#   DB_NAME     库名（默认从 backend/.env 读取，否则 gogo589）
#   MONGO_URI   完整连接串（含账号密码，优先级最高；默认从 backend/.env 的 MONGO_URL 读取）
#   KEEP_DAYS   本地保留天数（默认 14）
#   REMOTE      异地同步目标，scp 格式 user@host:/path（留空=不同步）
set -euo pipefail
RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; NC='\033[0m'
ok(){ echo -e "${GRN}✔ $*${NC}"; }
warn(){ echo -e "${YEL}⚠ $*${NC}"; }
err(){ echo -e "${RED}✘ $*${NC}" >&2; exit 1; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVF=""
for p in "$HERE/backend/.env" "$HERE/.env" "/www/wwwroot/gogo589-api/backend/.env"; do [ -f "$p" ] && ENVF="$p" && break; done
readenv(){ [ -n "$ENVF" ] && grep -E "^$1=" "$ENVF" | head -1 | cut -d= -f2- || true; }

BACKUP_DIR="${BACKUP_DIR:-/www/backup/mongo}"
MONGO_URI="${MONGO_URI:-$(readenv MONGO_URL)}"
DB_NAME="${DB_NAME:-$(readenv DB_NAME)}"; DB_NAME="${DB_NAME:-gogo589}"
KEEP_DAYS="${KEEP_DAYS:-14}"
REMOTE="${REMOTE:-}"

if [ "${1:-}" = "--install-cron" ]; then
  SELF="$HERE/$(basename "${BASH_SOURCE[0]}")"
  LINE="30 3 * * * BACKUP_DIR='$BACKUP_DIR' KEEP_DAYS='$KEEP_DAYS' REMOTE='$REMOTE' bash '$SELF' >> /var/log/gogo589-backup.log 2>&1"
  ( crontab -l 2>/dev/null | grep -vF "$SELF" ; echo "$LINE" ) | crontab -
  ok "已安装每日 03:30 自动备份；日志 /var/log/gogo589-backup.log"
  echo "  当前任务：$LINE"
  exit 0
fi

command -v mongodump >/dev/null 2>&1 || err "未找到 mongodump，请先安装 MongoDB（bash setup_server.sh backend）"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/gogo589_${STAMP}.archive.gz"

echo "➤ 开始备份（DB=$DB_NAME）..."
if [ -n "$MONGO_URI" ]; then
  mongodump --uri="$MONGO_URI" --archive="$OUT" --gzip
else
  mongodump --db="$DB_NAME" --archive="$OUT" --gzip
fi
ok "备份完成：$OUT（$(du -h "$OUT" | cut -f1)）"

# ---- 本地图片目录一并备份（设置了 LOCAL_STORAGE_DIR 时）----
LOCAL_DIR="${LOCAL_STORAGE_DIR:-$(readenv LOCAL_STORAGE_DIR)}"
if [ -n "$LOCAL_DIR" ] && [ -d "$LOCAL_DIR" ]; then
  IMG_OUT="$BACKUP_DIR/gogo589_uploads_${STAMP}.tar.gz"
  tar -czf "$IMG_OUT" -C "$(dirname "$LOCAL_DIR")" "$(basename "$LOCAL_DIR")"
  ok "图片目录备份完成：$IMG_OUT（$(du -h "$IMG_OUT" | cut -f1)）"
  find "$BACKUP_DIR" -name 'gogo589_uploads_*.tar.gz' -mtime +"$KEEP_DAYS" -delete
fi

DEL=$(find "$BACKUP_DIR" -name 'gogo589_*.archive.gz' -mtime +"$KEEP_DAYS" -print -delete | wc -l)
[ "$DEL" -gt 0 ] && echo "➤ 已清理 $DEL 个超过 ${KEEP_DAYS} 天的旧备份"

if [ -n "$REMOTE" ]; then
  if scp -q "$OUT" "$REMOTE/"; then ok "已异地同步到 $REMOTE"; else warn "异地同步失败，请检查 REMOTE 与免密 SSH（ssh-copy-id）"; fi
  [ -n "${IMG_OUT:-}" ] && [ -f "${IMG_OUT:-}" ] && scp -q "$IMG_OUT" "$REMOTE/" 2>/dev/null && ok "图片备份已异地同步"
else
  warn "未设置 REMOTE，跳过异地同步。设置示例：REMOTE='user@备份机:/backup/gogo589' bash backup_mongo.sh"
fi

echo
echo "➤ 还原命令（示例）：mongorestore --uri=\"\$MONGO_URL\" --archive=$OUT --gzip --drop"
