# 宝塔一键部署

域名：`print8.8bc8uyz.com`（主）、`print8.1bc8uyz.com`、`print8.2bc8uyz.com`（备用）。前后端同域，`/api` 反代到 `127.0.0.1:8001`，前端构建时 `REACT_APP_BACKEND_URL` 留空即可自动跟随访问域名，三个域名无需各自构建。

## Windows 宝塔
1. 宝塔软件商店安装：**Nginx**、**Python 项目管理器(3.11)** 或系统 Python 3.11、**Node 20**；安装 **MongoDB 7 Community**（勾选 Install as Service）。
2. 将代码放到如 `D:\wwwroot\sifang`，管理员 PowerShell 执行：
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   .\deploy\windows\deploy.ps1            # 首次：生成 backend\.env 并打开编辑
   .\deploy\windows\deploy.ps1 -ResetData # 填好 .env 后：安装依赖、构建前端、注册服务、清除测试数据
   ```
3. 宝塔「网站」添加站点（三个域名，根目录 `...\frontend\build`），配置文件替换为 `deploy/nginx.conf`（`root` 改为 build 路径，用 `/`），申请 SSL 并强制 HTTPS。
4. 服务：`nssm restart SifangPayBackend`；日志 `backend\logs\`；定时任务已注册到 Windows 计划任务（4 个 Sifang*）。

## Linux 宝塔
```bash
sudo bash deploy/linux/deploy.sh            # 首次生成 .env
sudo bash deploy/linux/deploy.sh --reset-data
```
之后同样在宝塔添加站点并粘贴 `deploy/nginx.conf`。

## 清除测试数据
- 命令行：`python backend/reset_data.py --yes [--keep-operators]`
- 后台：安全设置 → 「清空测试数据」（管理员 + 操作安全码/谷歌验证）

保留：管理员账号、系统设置、通道与收款地址。删除：订单、链上记录、流水、提现、回调、客服、审计、导出、商户/代理/操作员账号。

## 注意
- 生产 `.env` 请勿设置 `ALLOW_SIMULATE_PAY`；`SEED_DEMO_DATA=false` 禁止生成演示数据。
- 邮件提醒与对象存储依赖 Emergent 平台密钥（`EMERGENT_EMAIL_KEY` / `EMERGENT_LLM_KEY`），自建服务器上不填写即自动跳过（客服图片已内联存储，不受影响）。
- `TRUSTED_PROXY_HOPS=1` 对应单层 Nginx；若前置 Cloudflare 再加 Nginx，请设为 2。
