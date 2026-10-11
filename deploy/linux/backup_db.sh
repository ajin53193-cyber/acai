#!/usr/bin/env bash
# 四方收款平台 - MongoDB 每日备份 (Linux)
# 用法: bash backup_db.sh [保留天数=14] [输出目录=<项目>/backups]
# 恢复: mongorestore --uri "$MONGO_URL" --db "$DB_NAME" --drop --gzip --archive=<文件>.gz
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
KEEP="${1:-14}"; OUT="${2:-$ROOT/backups}"
MONGO_URL=$(grep ^MONGO_URL= "$ROOT/backend/.env" | cut -d= -f2- | tr -d '"')
DB_NAME=$(grep ^DB_NAME= "$ROOT/backend/.env" | cut -d= -f2- | tr -d '"')
command -v mongodump >/dev/null || { echo "未找到 mongodump，请安装 mongodb-database-tools"; exit 1; }
mkdir -p "$OUT"
FILE="$OUT/${DB_NAME}_$(date +%Y%m%d_%H%M%S).archive.gz"
mongodump --uri "$MONGO_URL" --db "$DB_NAME" --gzip --archive="$FILE" --quiet
find "$OUT" -name "${DB_NAME}*.archive.gz" -mtime +"$KEEP" -delete
echo "备份完成: $FILE ($(du -h "$FILE" | cut -f1))，保留最近 $KEEP 天"
