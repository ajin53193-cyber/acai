#!/usr/bin/env bash
# gogo589 全新服务器环境一键安装（Ubuntu 22.04，需 root/sudo 运行）
# 用法：
#   后端 API 服务器：  sudo bash setup_server.sh backend
#   前端/后台服务器：  sudo bash setup_server.sh frontend
#   同机全装：          sudo bash setup_server.sh all
# 安装内容：git / 构建工具 / Node 20 / yarn / pm2（通用）；backend 额外装 Python3.11 + MongoDB 7
# 说明：Nginx 与 SSL 建议用宝塔面板 GUI 一键完成（省心）；本脚本只装运行时。
set -euo pipefail
ROLE="${1:-all}"
RED='\033[0;31m'; GRN='\033[0;32m'; YEL='\033[1;33m'; NC='\033[0m'
err(){ echo -e "${RED}✘ $*${NC}" >&2; exit 1; }
ok(){ echo -e "${GRN}✔ $*${NC}"; }
info(){ echo -e "${YEL}➤ $*${NC}"; }

[ "$(id -u)" = "0" ] || err "请用 root 或 sudo 运行：sudo bash setup_server.sh $ROLE"
case "$ROLE" in backend|frontend|all) ;; *) err "角色参数错误，应为 backend / frontend / all";; esac
. /etc/os-release 2>/dev/null || true
CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}")"
export DEBIAN_FRONTEND=noninteractive

info "更新 apt 并安装基础工具 ..."
apt-get update -y
apt-get install -y curl wget gnupg ca-certificates lsb-release git build-essential software-properties-common

install_node(){
  if ! command -v node >/dev/null 2>&1 || [ "$(node -v 2>/dev/null | sed 's/v//;s/\..*//')" -lt 18 ] 2>/dev/null; then
    info "安装 Node.js 20 ..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
  info "安装 yarn / pm2（全局）..."
  npm i -g yarn pm2 >/dev/null 2>&1 || npm i -g yarn pm2
  ok "Node $(node -v) / yarn $(yarn -v) / pm2 $(pm2 -v) 就绪"
}

install_python(){
  if ! command -v python3.11 >/dev/null 2>&1; then
    info "安装 Python 3.11 ..."
    add-apt-repository -y ppa:deadsnakes/ppa || true
    apt-get update -y
    apt-get install -y python3.11 python3.11-venv python3.11-dev || {
      echo -e "${YEL}⚠ 未能装 python3.11，改用系统 python3${NC}"
      apt-get install -y python3 python3-venv python3-dev
    }
  fi
  ok "Python：$(command -v python3.11 || command -v python3) 就绪"
}

install_mongo(){
  if command -v mongod >/dev/null 2>&1; then ok "MongoDB 已安装：$(mongod --version | head -1)"; return; fi
  info "安装 MongoDB 7.0 ..."
  curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -y
  apt-get install -y mongodb-org
  systemctl enable --now mongod
  sleep 2
  ok "MongoDB 7 已安装并启动（默认仅监听 127.0.0.1，安全）"
  echo -e "${YEL}➤ 建议创建管理员账号（示例，请改密码）：${NC}"
  cat <<'EOF'
  mongosh <<'JS'
  use admin
  db.createUser({user:"gogo589", pwd:"改成强密码", roles:[{role:"root", db:"admin"}]})
  JS
  # 然后编辑 /etc/mongod.conf 打开 security.authorization: enabled 并 systemctl restart mongod
  # backend/.env 的 MONGO_URL 用：mongodb://gogo589:强密码@127.0.0.1:27017/gogo589?authSource=admin
EOF
}

install_node
if [ "$ROLE" = "backend" ] || [ "$ROLE" = "all" ]; then install_python; install_mongo; fi

echo
ok "环境安装完成（角色：$ROLE）"
echo -e "${YEL}下一步：填好 .env 后运行一键部署 →  bash deploy.sh ${ROLE/all/backend}${NC}"
