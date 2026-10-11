#!/usr/bin/env bash
# 四方收款平台 - Linux 宝塔一键部署（Python 项目管理器/Node + Nginx 反代）
# 用法: sudo bash deploy/linux/deploy.sh [--reset-data]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/backend"; FRONTEND="$ROOT/frontend"
RESET=0; [[ "${1:-}" == "--reset-data" ]] && RESET=1
step(){ printf "\n\033[36m==> %s\033[0m\n" "$1"; }

step "环境检查"
command -v python3 >/dev/null || { echo "缺少 python3（请在宝塔软件商店安装 Python 项目管理器 3.11）"; exit 1; }
command -v node >/dev/null || { echo "缺少 node（请安装 Node 20，宝塔 Node 版本管理器）"; exit 1; }
command -v mongod >/dev/null || systemctl is-active --quiet mongod || echo "警告：未检测到本机 MongoDB，请确认 .env 中 MONGO_URL 可达"

step "后端 .env"
if [[ ! -f "$BACKEND/.env" ]]; then
  cp "$ROOT/deploy/backend.env.example" "$BACKEND/.env"
  sed -i "s/CHANGE_ME_TO_A_LONG_RANDOM_STRING/$(openssl rand -hex 32)/; s/WEBHOOK_CRON_SECRET=CHANGE_ME_RANDOM/WEBHOOK_CRON_SECRET=$(openssl rand -hex 16)/" "$BACKEND/.env"
  echo "已生成 $BACKEND/.env，请编辑填写 ADMIN_PASSWORD / TRONGRID_API_KEY 后重新运行。"; exit 0
fi

step "后端依赖"
cd "$BACKEND"; [[ -d .venv ]] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip; .venv/bin/pip install -q -r requirements-prod.txt

step "前端构建（同域，API 自动跟随访问域名）"
cd "$FRONTEND"; command -v yarn >/dev/null || npm i -g yarn >/dev/null
yarn install --frozen-lockfile; REACT_APP_BACKEND_URL="" GENERATE_SOURCEMAP=false yarn build

[[ $RESET == 1 ]] && { step "清除测试数据"; cd "$BACKEND"; .venv/bin/python reset_data.py --yes; }

step "systemd 服务"
cat >/etc/systemd/system/sifang-backend.service <<EOF
[Unit]
Description=Sifang USDT Pay Backend
After=network.target mongod.service
[Service]
WorkingDirectory=$BACKEND
ExecStart=$BACKEND/.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload; systemctl enable --now sifang-backend; sleep 3
curl -fs http://127.0.0.1:8001/api/checkout/settings >/dev/null && echo "后端健康 OK" || echo "后端未响应: journalctl -u sifang-backend -n 50"

step "定时任务 (crontab)"
SECRET=$(grep ^WEBHOOK_CRON_SECRET= "$BACKEND/.env" | cut -d= -f2)
( crontab -l 2>/dev/null | grep -v "sifang-cron" ;
  echo "5 0 * * * curl -s -X POST http://127.0.0.1:8001/api/cron/daily-settle -H 'Authorization: Bearer $SECRET' # sifang-cron"
  echo "20 0 * * * curl -s -X POST http://127.0.0.1:8001/api/cron/run-exports -H 'Authorization: Bearer $SECRET' # sifang-cron"
  echo "30 0 * * * curl -s -X POST http://127.0.0.1:8001/api/cron/export-expiry-reminders -H 'Authorization: Bearer $SECRET' # sifang-cron"
  echo "0 3 * * * curl -s -X POST http://127.0.0.1:8001/api/cron/support-cleanup -H 'Authorization: Bearer $SECRET' # sifang-cron"
  echo "30 2 * * * bash $ROOT/deploy/linux/backup_db.sh 14 >> $ROOT/backups/backup.log 2>&1 # sifang-cron" ) | crontab -
mkdir -p "$ROOT/backups"; chmod +x "$ROOT/deploy/linux/backup_db.sh" "$ROOT/deploy/linux/restore_db.sh"
command -v mongodump >/dev/null && bash "$ROOT/deploy/linux/backup_db.sh" 14 || echo "提示：安装 mongodb-database-tools 后备份任务才会生效"

step "完成"
cat <<EOF
宝塔面板：网站 -> 添加站点（域名 print8.8bc8uyz.com print8.1bc8uyz.com print8.2bc8uyz.com，根目录 $FRONTEND/build）
-> 配置文件粘贴 $ROOT/deploy/nginx.conf 的 server 块（root 改为 $FRONTEND/build）-> 申请 SSL 并强制 HTTPS
服务：systemctl restart sifang-backend   日志：journalctl -u sifang-backend -f
备份：每日 02:30 -> $ROOT/backups（保留 14 天）；手动 deploy/linux/backup_db.sh；恢复 deploy/linux/restore_db.sh <文件>
EOF
