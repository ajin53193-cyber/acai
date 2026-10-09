# 合赢项目社官网 · 宝塔面板部署指南

适用：阿里云 / 腾讯云等国内服务器，已安装宝塔面板（Linux，推荐 Ubuntu 22.04 或 Debian 12，2 核 2G 起）。域名 `eztyv.com` 已备案。

部署完成后结构：
- 前端：静态文件，宝塔 Nginx 站点直接托管（`/www/wwwroot/heying/frontend/build`）
- 后端：FastAPI，systemd 服务 `heying-backend`，监听 `127.0.0.1:8001`，Nginx 把 `/api/` 反向代理过去
- 数据库：宝塔软件商店的 MongoDB（本机 27017）
- 上传文件：本地目录 `/www/wwwroot/heying/uploads`
- AI 客服：DeepSeek（或任意 OpenAI 兼容接口），不配密钥则只用预设问答 + 人工提示

---

## 一、宝塔面板里先装好软件（软件商店）
1. **Nginx**（任意 1.2x 版本）
2. **MongoDB**（4.x / 6.x 均可，装完默认只监听本机，无需改）
3. **Node.js 版本管理器** → 安装 **Node 20**，并点「设为命令行默认版本」
4. **Python 项目管理器** → 版本管理 → 安装 **Python 3.11**
   （若系统自带 `python3 --version` ≥ 3.10 可跳过）

## 二、把代码放到服务器
在 Emergent 聊天框点 **Save to GitHub** 推送代码，然后在宝塔「终端」执行：
```bash
cd /www/wwwroot
git clone https://github.com/<你的账号>/<仓库名>.git heying
cd heying
```
（私有仓库需先配置 GitHub Token 或 SSH key；国内拉 GitHub 慢可以在 GitHub 下载 zip 上传到 `/www/wwwroot/heying` 解压）

## 三、生成并填写后端配置
```bash
cd /www/wwwroot/heying
bash deploy/baota/deploy.sh
```
第一次运行会自动生成 `backend/.env` 并退出，用宝塔文件管理打开 `/www/wwwroot/heying/backend/.env` 检查：

| 项 | 说明 |
|---|---|
| `MONGO_URL` | 默认 `mongodb://127.0.0.1:27017`，宝塔 MongoDB 默认无密码，不用改 |
| `DB_NAME` | 数据库名，默认 `heying` |
| `JWT_SECRET` | 已自动生成随机串，不要泄露 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 后台账号密码（首次启动时写入数据库） |
| `LOCAL_STORAGE=1` | 必须为 1，图片/视频存本地 |
| `UPLOAD_DIR` | 已自动指向 `/www/wwwroot/heying/uploads` |
| `AI_API_KEY` | DeepSeek 密钥（https://platform.deepseek.com 创建并充值），留空则 AI 客服关闭、只走预设问答 |
| `AI_BASE_URL` / `AI_MODEL` | 默认 DeepSeek；用通义千问可填 `https://dashscope.aliyuncs.com/compatible-mode/v1` + `qwen-plus` |

保存后再执行一次：
```bash
bash deploy/baota/deploy.sh
```
脚本会：安装 Python 依赖（阿里云镜像）→ 构建前端（npmmirror 镜像）→ 注册并启动 `heying-backend` 服务 → 健康检查。看到 **部署完成** 即成功。

## 四、宝塔添加站点并配置 Nginx
1. 网站 → 添加站点
   - 域名：`eztyv.com` 和 `www.eztyv.com`（一行一个）
   - 根目录：`/www/wwwroot/heying/frontend/build`
   - PHP 版本：纯静态
2. 站点 → **SSL** → Let's Encrypt → 勾选两个域名 → 申请，并开启「强制 HTTPS」
3. 站点 → **配置文件**：把 `server { }` 里从 `index` 开始到结尾（宝塔自己生成的 `#SSL-START ... #SSL-END`、`#ERROR-PAGE`、`#REWRITE` 等块可保留）替换为 `deploy/baota/nginx-site.conf` 的内容，保存
   - 关键点：`location /api/` 代理到 `127.0.0.1:8001`；`location /` 用 `try_files $uri /index.html`；`client_max_body_size 100m`
4. 站点 → 网站目录 → 关闭「防跨站攻击(open_basedir)」（静态站无影响，关掉避免偶发 403）

## 五、迁移线上数据（项目 / 新闻 / 教程 / 设置 / 图片）
在 Emergent 的 eztyv.com 还在线时执行一次（需要线上后台的管理员密码，默认取 `.env` 里的）：
```bash
cd /www/wwwroot/heying
backend/.venv/bin/python deploy/baota/import_from_live.py
```
会把线上后台的所有内容和图片下载到本机。访问统计与历史聊天记录不迁移（从零开始统计）。

## 六、切换 DNS
聚名网把 `eztyv.com`、`www.eztyv.com` 的 A 记录全部改成这台服务器的公网 IP（删掉 Cloudflare 的 162.159.x / 172.66.x 和旧的 47.115.133.9）。生效后打开 https://eztyv.com 检查：
- 首页、项目中心、新闻、联系页
- 客服窗口发消息 → 关键词「加入」会推送「加入海鸥官方群」按钮
- `/admin` 登录 → 上传一张图片 → 前台显示正常

## 七、以后如何更新
Emergent 里改完代码 → Save to GitHub → 服务器执行：
```bash
cd /www/wwwroot/heying && bash deploy/baota/deploy.sh
```
（脚本自带 `git pull`，1–3 分钟完成，前端静态文件替换后用户刷新即生效）

---

## 常用命令
```bash
systemctl status heying-backend          # 后端状态
journalctl -u heying-backend -n 100 -f   # 后端实时日志
systemctl restart heying-backend         # 重启后端
curl -s http://127.0.0.1:8001/api/settings | head -c 200   # 后端是否正常
```

## 常见问题
- **访问首页 502**：后端没起来，`journalctl -u heying-backend -n 50` 看报错；多半是 `.env` 的 MONGO_URL 不通或 Python 版本 < 3.10
- **刷新二级页面 404**：Nginx 没加 `try_files $uri /index.html`，检查第四步配置
- **上传图片报错 413**：`client_max_body_size` 没生效，确认写在 `server {}` 内并重载 Nginx
- **图片不显示**：确认 `.env` 里 `LOCAL_STORAGE=1`，且 `UPLOAD_DIR` 目录存在、可写；迁移脚本是否执行成功
- **AI 客服不回复**：`AI_API_KEY` 为空或 DeepSeek 余额不足；预设问答与人工留言不受影响
- **yarn install 很慢/失败**：脚本已用 npmmirror 镜像；可重跑 `bash deploy/baota/deploy.sh`，依赖会缓存
- **备份**：定期备份 MongoDB（宝塔 → 数据库 → MongoDB → 备份）与 `/www/wwwroot/heying/uploads` 目录
