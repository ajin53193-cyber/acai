#!/usr/bin/env bash
# 从备份恢复: bash restore_db.sh <备份文件.archive.gz>   （会先停后端，覆盖当前库，再启动）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="${1:?用法: restore_db.sh <备份文件>}"
MONGO_URL=$(grep ^MONGO_URL= "$ROOT/backend/.env" | cut -d= -f2- | tr -d '"')
DB_NAME=$(grep ^DB_NAME= "$ROOT/backend/.env" | cut -d= -f2- | tr -d '"')
read -r -p "将用 $FILE 覆盖数据库 $DB_NAME，确认? (yes/no) " ok; [[ "$ok" == "yes" ]] || exit 1
systemctl stop sifang-backend || true
mongorestore --uri "$MONGO_URL" --nsInclude="${DB_NAME}.*" --drop --gzip --archive="$FILE"
systemctl start sifang-backend
echo "恢复完成"
