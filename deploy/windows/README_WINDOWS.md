# 合赢项目社官网 · 宝塔 Windows 版部署指南

适用：Windows Server / Windows 10，已安装宝塔 Windows 面板（面板目录如 `D:\BtSoft\panel`）。
下文以 **D 盘** 为例，网站放在 `D:\wwwroot\heying`；如果您的宝塔装在 C 盘，把路径里的 `D:` 换成 `C:` 即可。

部署完成后：
- 前端：静态文件，宝塔 Nginx 站点托管（根目录 `D:\wwwroot\heying\frontend\build`）
- 后端：FastAPI，开机计划任务 `HeyingBackend` 常驻运行，监听 `127.0.0.1:8001`，Nginx 把 `/api/` 反向代理过去
- 数据库：宝塔软件商店的 MongoDB（本机 27017）
- 上传文件：`D:\wwwroot\heying\uploads`
- 后端日志：`D:\wwwroot\heying\logs\backend.log`

---

## 一、安装基础软件（4 个）
**宝塔「软件商店」里装 2 个：**
1. **Nginx**（任意 1.2x 版本）
2. **MongoDB**（装完默认本机 27017，无密码，不用改）

**在服务器桌面用浏览器下载安装 2 个（宝塔 Windows 版的 Python/Node 管理器路径不固定，直接官方安装最省事）：**
3. **Python 3.11**：https://www.python.org/downloads/windows/ → 「Windows installer (64-bit)」
   安装第一屏 **务必勾选「Add python.exe to PATH」**，然后点 Install Now
4. **Node.js 20 LTS**：https://nodejs.org/zh-cn → 下载 Windows 安装包（.msi）一路下一步
5. **Git for Windows**：https://git-scm.com/download/win → 一路下一步（用来拉取/更新代码）

> 装完以上软件后，**关闭并重新打开宝塔的「终端」**（或 cmd），否则找不到刚安装的命令。

## 二、拉取代码
宝塔左侧「终端」（或 Win+R 输入 cmd 回车）执行：
```bat
D:
cd \wwwroot
git clone https://github.com/ajin53193-cyber/acai.git heying
```
- 若 `D:\wwwroot` 不存在，先 `mkdir D:\wwwroot`
- 若仓库是私有的会要求登录：用户名 `ajin53193-cyber`，密码填 GitHub Token（头像 → Settings → Developer settings → Personal access tokens → 勾选 repo 生成）；或先把仓库改成 Public

## 三、生成并填写后端配置
```bat
D:\wwwroot\heying\deploy\windows\deploy.bat
```
第一次运行会自动生成 `D:\wwwroot\heying\backend\.env` 然后暂停。用记事本打开它，确认：

| 项 | 说明 |
|---|---|
| `MONGO_URL` | 默认 `mongodb://127.0.0.1:27017`，宝塔 MongoDB 默认无密码，不用改 |
| `DB_NAME` | 数据库名，默认 `heying` |
| `JWT_SECRET` | 已自动生成随机串，不要动 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 后台账号密码 |
| `LOCAL_STORAGE=1` | 必须为 1，图片/视频存本地 |
| `UPLOAD_DIR` | 已自动填好，形如 `D:/wwwroot/heying/uploads` |
| `AI_API_KEY` | DeepSeek 密钥（https://platform.deepseek.com 创建并充值），**留空则 AI 客服关闭**，预设问答和人工留言不受影响 |

保存后再执行一次：
```bat
D:\wwwroot\heying\deploy\windows\deploy.bat
```
脚本会：安装 Python 依赖（阿里云镜像）→ 构建前端（npmmirror 镜像，首次 3–8 分钟）→ 注册开机计划任务并启动后端 → 健康检查。看到 **部署完成** 即成功。

## 四、宝塔添加站点并配置 Nginx
1. 网站 → 添加站点
   - 域名：`eztyv.com` 和 `www.eztyv.com`（一行一个）
   - 根目录：`D:\wwwroot\heying\frontend\build`
   - PHP 版本：**纯静态**
2. 站点 → **配置文件**：找到 `index index.php index.html ...` 这一行，从这行开始到 `access_log` 之前的内容全部删掉，粘贴 `deploy\windows\nginx-site.conf` 的内容，保存
   - 关键：`location /api/` 代理到 `127.0.0.1:8001`；`location /` 用 `try_files $uri /index.html`；`client_max_body_size 100m`
3. 站点 → **SSL** → Let's Encrypt → 勾选两个域名 → 申请 → 开启「强制 HTTPS」
   （需要域名已指向本服务器；若 DNS 还没切，先做第六步再回来）
4. 宝塔「安全」放行 **80、443** 端口；云服务商控制台的「安全组」也要放行 80、443

## 五、迁移线上数据（项目 / 新闻 / 教程 / 设置 / 图片）
在 Emergent 的 eztyv.com 还在线时执行一次：
```bat
cd /d D:\wwwroot\heying
backend\.venv\Scripts\python.exe deploy\baota\import_from_live.py
```
把线上后台的全部内容和图片下载到本机。访问统计和历史聊天记录不迁移。

## 六、切换 DNS（聚名网）
`eztyv.com`、`www.eztyv.com`：删掉所有旧 A 记录（162.159.x.x、172.66.x.x、47.115.133.9），新增 A 记录指向本服务器公网 IP。10–30 分钟生效后检查：
- 首页、项目中心、新闻、联系页
- 客服窗口发「加入」→ 出现「加入海鸥官方群」按钮
- `/admin` 登录 → 上传一张图片 → 前台正常显示

## 七、以后如何更新（一键）
Emergent 改完代码 → Save to GitHub → 服务器终端粘贴执行下面这一行（自动：下载最新代码 → 安装依赖 → 构建前端 → 重启后端 → 更新 nginx sitemap 规则 → 健康检查）：
```bat
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; foreach($u in 'https://ghfast.top/https://raw.githubusercontent.com/ajin53193-cyber/acai/main/deploy/windows/setup.bat','https://raw.githubusercontent.com/ajin53193-cyber/acai/main/deploy/windows/setup.bat','https://ghproxy.net/https://raw.githubusercontent.com/ajin53193-cyber/acai/main/deploy/windows/setup.bat'){ try { Invoke-WebRequest -UseBasicParsing $u -OutFile 'C:\heying-update.bat' -TimeoutSec 60; break } catch {} }" && C:\heying-update.bat
```
3–6 分钟完成，看到 `DEPLOY DONE` 即成功。若目录是 git 仓库，也可直接运行 `D:\wwwroot\heying\deploy\windows\deploy.bat`（自带 `git pull`）。

---

## 常用操作
```bat
rem 后端是否正常
curl http://127.0.0.1:8001/api/settings

rem 查看后端日志（也可直接用记事本打开）
type D:\wwwroot\heying\logs\backend.log

rem 手动重启后端
schtasks /end /tn HeyingBackend
schtasks /run /tn HeyingBackend

rem 开机任务状态
schtasks /query /tn HeyingBackend
```

## 常见问题
- **首页 502**：后端没起来，看 `logs\backend.log`；多半是 MongoDB 没启动（宝塔软件商店 → MongoDB → 启动）或 `.env` 路径写错
- **刷新二级页面 404**：Nginx 缺 `try_files $uri /index.html`，检查第四步
- **上传报 413**：`client_max_body_size 100m` 没生效，确认在 `server {}` 内并重载 Nginx
- **图片不显示**：确认 `.env` 的 `LOCAL_STORAGE=1`、`UPLOAD_DIR` 目录存在；迁移脚本是否执行成功
- **提示找不到 python / node / git**：安装后没有重新打开终端；或 Python 安装时没勾 Add to PATH（重装勾上）
- **AI 客服不回复**：`AI_API_KEY` 为空或 DeepSeek 余额不足
- **备份**：定期备份 MongoDB（宝塔 → 数据库 → MongoDB → 备份）和 `D:\wwwroot\heying\uploads` 目录

## 搜索引擎收录（百度 / Google）

站点地图由后端动态生成：`https://eztyv.com/sitemap.xml`（nginx 把 `/sitemap.xml` 代理到 `/api/sitemap.xml`，见 `nginx-site.conf`；更新 nginx 配置后在宝塔「重载配置」）。
后端 `.env` 可加 `SITE_URL=https://eztyv.com`（默认即该域名）。

1. 百度站长：https://ziyuan.baidu.com → 用户中心 → 站点管理 → 添加网站 `https://eztyv.com`
   → 验证方式选「文件验证」，下载 `baidu_verify_xxx.html`，用宝塔文件管理上传到 `D:\wwwroot\heying\frontend\build\`（同时放一份到 `frontend/public/` 并提交代码，避免重新构建后丢失）
   → 验证通过后：普通收录 → sitemap → 提交 `https://eztyv.com/sitemap.xml`
2. Google Search Console：https://search.google.com/search-console → 添加资源（网址前缀）`https://eztyv.com`
   → 验证方式选「HTML 文件」，同样上传到 build 根目录 → 站点地图 → 提交 `sitemap.xml`
3. 两边都验证后，1~3 天开始收录；可在百度「普通收录 → 手动提交」里额外粘贴首页/合作页 URL 加速。
