@echo off
rem ============================================================
rem  合赢项目社官网 · Windows（宝塔 Windows 版）一键部署 / 更新脚本
rem  用法：双击运行，或在宝塔「终端」执行  D:\wwwroot\heying\deploy\windows\deploy.bat
rem  首次运行：安装依赖、构建前端、注册并启动后端；以后更新：再运行一次即可
rem ============================================================
chcp 65001 >nul
setlocal EnableDelayedExpansion

pushd "%~dp0..\.."
set "APP_DIR=%CD%"
popd
set "BACKEND_DIR=%APP_DIR%\backend"
set "FRONTEND_DIR=%APP_DIR%\frontend"
set "PIP_INDEX=https://mirrors.aliyun.com/pypi/simple/"
set "NPM_REGISTRY=https://registry.npmmirror.com"
set "TASK_NAME=HeyingBackend"

echo.
echo ===== 项目目录：%APP_DIR%
cd /d "%APP_DIR%"

rem ---------- 0. 拉取最新代码 ----------
if exist ".git" (
  where git >nul 2>&1 && (
    echo ===== 拉取最新代码
    git pull --ff-only || echo [提示] git pull 失败，继续使用当前代码
  )
)

rem ---------- 1. 检查 .env ----------
echo ===== 检查后端配置 backend\.env
if not exist "%BACKEND_DIR%\.env" (
  copy /y "%APP_DIR%\deploy\windows\backend.env.example" "%BACKEND_DIR%\.env" >nul
  for /f "delims=" %%s in ('powershell -NoProfile -Command "-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | %% {[char]$_})"') do set "SECRET=%%s"
  set "UPLOAD_PATH=%APP_DIR:\=/%/uploads"
  powershell -NoProfile -Command "(Get-Content '%BACKEND_DIR%\.env') -replace '^JWT_SECRET=.*','JWT_SECRET=!SECRET!' -replace '^UPLOAD_DIR=.*','UPLOAD_DIR=!UPLOAD_PATH!' | Set-Content -Encoding ASCII '%BACKEND_DIR%\.env'"
  echo.
  echo [需要操作] 已生成 %BACKEND_DIR%\.env
  echo            请用记事本/宝塔文件管理打开它，确认 ADMIN_PASSWORD（后台密码）和 AI_API_KEY（DeepSeek 密钥，可留空）
  echo            保存后再运行一次本脚本。
  pause
  exit /b 1
)

rem ---------- 2. Python 虚拟环境 ----------
echo ===== 准备 Python 环境（需要 3.10+）
set "PY="
for %%c in ("py -3.12" "py -3.11" "py -3.10" "python") do (
  if not defined PY (
    %%~c -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1 && set "PY=%%~c"
  )
)
if not defined PY (
  echo [错误] 未找到 Python 3.10 以上版本。请到 https://www.python.org/downloads/windows/ 下载安装 Python 3.11，
  echo        安装时务必勾选 "Add python.exe to PATH"，装完重新打开终端再运行本脚本。
  pause
  exit /b 1
)
for /f "delims=" %%v in ('%PY% --version') do echo 使用 %%v
if not exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
  %PY% -m venv "%BACKEND_DIR%\.venv" || (echo [错误] 创建虚拟环境失败 & pause & exit /b 1)
)
"%BACKEND_DIR%\.venv\Scripts\python.exe" -m pip install -q -i %PIP_INDEX% --upgrade pip
"%BACKEND_DIR%\.venv\Scripts\python.exe" -m pip install -q -i %PIP_INDEX% -r "%BACKEND_DIR%\requirements-selfhost.txt" || (echo [错误] Python 依赖安装失败 & pause & exit /b 1)
echo Python 依赖安装完成

rem ---------- 3. 构建前端 ----------
echo ===== 构建前端（需要 Node 18+）
where node >nul 2>&1 || (
  echo [错误] 未找到 node。请到 https://nodejs.org/zh-cn 下载安装 Node.js 20 LTS，装完重新打开终端再运行本脚本。
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo Node %%v
cd /d "%FRONTEND_DIR%"
where yarn >nul 2>&1 || call npm install -g yarn --registry %NPM_REGISTRY%
rem 去掉仅 Emergent 预览环境使用的 devDependencies（境内无法下载），构建不需要它们
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));for(const k of Object.keys(p.devDependencies||{}))if(k.startsWith('@emergentbase/'))delete p.devDependencies[k];fs.writeFileSync('package.json',JSON.stringify(p,null,2));"
call yarn install --registry %NPM_REGISTRY% --network-timeout 600000 --ignore-engines || (echo [错误] 前端依赖安装失败 & pause & exit /b 1)
rem 接口地址用相对路径 /api（同域名反向代理），写入临时 env 文件保证优先级最高
> .env.production.local echo REACT_APP_BACKEND_URL=
set "GENERATE_SOURCEMAP=false"
set "NODE_OPTIONS=--max-old-space-size=2048"
call yarn build
set "BUILD_RC=%ERRORLEVEL%"
del /q .env.production.local >nul 2>&1
cd /d "%APP_DIR%"
where git >nul 2>&1 && (
  git checkout -- frontend/package.json >nul 2>&1
  git checkout -- frontend/yarn.lock >nul 2>&1
)
if not "%BUILD_RC%"=="0" (echo [错误] 前端构建失败 & pause & exit /b 1)
echo 前端构建完成：%FRONTEND_DIR%\build

rem ---------- 4. 后端服务（开机计划任务 + 崩溃自动拉起） ----------
echo ===== 注册并重启后端 %TASK_NAME%
if not exist "%APP_DIR%\uploads" mkdir "%APP_DIR%\uploads"
if not exist "%APP_DIR%\logs" mkdir "%APP_DIR%\logs"
rem 停掉旧进程（运行脚本 + uvicorn）
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*run-backend.bat*' -or $_.CommandLine -like '*uvicorn server:app*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
schtasks /query /tn %TASK_NAME% >nul 2>&1 || (
  schtasks /create /tn %TASK_NAME% /tr "\"%APP_DIR%\deploy\windows\run-backend.bat\"" /sc onstart /ru SYSTEM /rl HIGHEST /f >nul || (echo [错误] 注册计划任务失败，请以管理员身份运行 & pause & exit /b 1)
)
schtasks /run /tn %TASK_NAME% >nul
timeout /t 6 /nobreak >nul

rem ---------- 5. 健康检查 ----------
echo ===== 健康检查
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8001/api/settings > "%TEMP%\heying_hc.txt" 2>nul
set /p HC=<"%TEMP%\heying_hc.txt"
if "%HC%"=="200" (
  echo 后端 OK：http://127.0.0.1:8001/api/settings
) else (
  echo [错误] 后端接口无响应（状态 %HC%），请查看日志：%APP_DIR%\logs\backend.log
  pause
  exit /b 1
)

echo.
echo ================= 部署完成 =================
echo 1. 宝塔站点根目录指向：%FRONTEND_DIR%\build
echo 2. 站点「配置文件」按 deploy\windows\nginx-site.conf 配置 /api/ 反向代理
echo 3. 首次迁移线上数据：backend\.venv\Scripts\python.exe deploy\baota\import_from_live.py
echo ============================================
pause
