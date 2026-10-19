#!/usr/bin/env bash
# 合赢项目社 · 宝塔 / Ubuntu 一键安装引导（首次使用）
# ────────────────────────────────────────────────────────────
# 用法一（推荐，宝塔「终端」里粘贴这一行即可）：
#   bash <(curl -fsSL https://raw.githubusercontent.com/ajin53193-cyber/acai/main/deploy/baota/setup.sh)
#
# 用法二（已经手动把代码放到了 /www/wwwroot/heying）：
#   cd /www/wwwroot/heying && bash deploy/baota/setup.sh
#
# 可用环境变量覆盖默认值：
#   REPO=你的GitHub账号/仓库名   BRANCH=main   APP_DIR=/www/wwwroot/heying
# ────────────────────────────────────────────────────────────
set -euo pipefail

GH_REPO="${REPO:-ajin53193-cyber/acai}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/www/wwwroot/heying}"

red()   { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
step()  { echo -e "\n\033[36m==> $*\033[0m"; }

cat <<BANNER

================================================
  合赢项目社 · 一键部署
  仓库:   $GH_REPO ($BRANCH)
  目录:   $APP_DIR
================================================
BANNER

# ---------- 1. 获取代码 ----------
if [ -d "$APP_DIR/.git" ]; then
  step "检测到已存在 git 仓库，跳过下载（deploy.sh 会自动 git pull 更新）"
elif [ -f "$APP_DIR/deploy/baota/deploy.sh" ]; then
  step "检测到已存在代码（非 git），直接使用 $APP_DIR"
else
  step "下载代码到 $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  if command -v git >/dev/null 2>&1 && git clone --depth 1 -b "$BRANCH" "https://github.com/$GH_REPO.git" "$APP_DIR" 2>/dev/null; then
    green "git clone 完成"
  else
    red "git clone 失败（可能是私有仓库或网络问题），改用 zip 下载…"
    command -v unzip >/dev/null 2>&1 || { apt-get update -y && apt-get install -y unzip; }
    tmp="$(mktemp -d)"
    curl -fSL "https://codeload.github.com/$GH_REPO/zip/refs/heads/$BRANCH" -o "$tmp/src.zip" \
      || { red "zip 下载也失败。请确认仓库已 Save to GitHub 且为公开，或手动上传代码到 $APP_DIR 后重试"; exit 1; }
    unzip -q "$tmp/src.zip" -d "$tmp"
    srcdir="$(find "$tmp" -maxdepth 1 -type d -name '*-*' | head -n1)"
    mkdir -p "$APP_DIR"
    cp -r "$srcdir"/. "$APP_DIR"/
    rm -rf "$tmp"
    green "代码下载完成（zip）"
  fi
fi

# ---------- 2. 交给主部署脚本 ----------
cd "$APP_DIR"
step "执行部署脚本 deploy/baota/deploy.sh"
bash deploy/baota/deploy.sh
