@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title gogo589 一键部署脚本 (Windows / 宝塔)

echo ============================================================
echo    gogo589 一键部署脚本  (Windows)
echo    请在项目根目录(含 backend 和 frontend 的那层)双击运行
echo ============================================================
echo.

REM 切到脚本所在目录
cd /d "%~dp0"

if not exist "backend" (
  echo [错误] 当前目录找不到 backend 文件夹，请把本脚本放到项目根目录再运行。
  pause & exit /b 1
)
if not exist "frontend" (
  echo [错误] 当前目录找不到 frontend 文件夹，请把本脚本放到项目根目录再运行。
  pause & exit /b 1
)

echo [检查] 确认 python / node / yarn 是否可用...
where python >nul 2>nul || ( echo [错误] 找不到 python，请先在宝塔安装 Python 3.11 并加入系统 PATH & pause & exit /b 1 )
where node   >nul 2>nul || ( echo [错误] 找不到 node，请先在宝塔安装 Node 18/20 并加入系统 PATH & pause & exit /b 1 )
where yarn   >nul 2>nul || ( echo [提示] 未找到 yarn，正在用 npm 安装 yarn... & call npm install -g yarn )

echo.
echo ===================== 1/4 配置 .env =====================
if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo [已生成] backend\.env  —— 稍后请用记事本打开填入真实密钥！
)
if not exist "frontend\.env" (
  copy "frontend\.env.example" "frontend\.env" >nul
  echo [已生成] frontend\.env —— 请把 REACT_APP_BACKEND_URL 改成你的域名！
)

echo.
echo ================== 2/4 安装后端依赖 ==================
cd backend
if not exist "venv" ( python -m venv venv )
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install emergentintegrations==0.2.2 --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
cd ..

echo.
echo ================== 3/4 打包前端 ==================
cd frontend
call yarn install
call yarn build
cd ..

echo.
echo ================== 4/4 启动后端 ==================
where pm2 >nul 2>nul
if %errorlevel%==0 (
  call pm2 start ecosystem.config.js
  call pm2 save
  echo [已用 PM2 启动后端，端口 8001]
) else (
  echo [提示] 未装 PM2。将用普通方式启动后端(关闭窗口后会停止)。
  echo        建议之后用 PM2 守护： npm install -g pm2
  cd backend
  call venv\Scripts\activate.bat
  start "gogo589-backend" cmd /k "uvicorn server:app --host 0.0.0.0 --port 8001"
  cd ..
)

echo.
echo ============================================================
echo  自动部分完成！还剩两步手动操作：
echo  1) 用记事本打开 backend\.env 填入密钥(EMERGENT_LLM_KEY /
echo     STRIPE_API_KEY / CLERK_* / MONGO_URL 等)，填完重启后端
echo  2) 在宝塔「网站」里新建站点，根目录指向：
echo     %cd%\frontend\build
echo     并把 /api 反向代理到 http://127.0.0.1:8001
echo     (参考 deploy\nginx.conf.sample，开 SSL)
echo ============================================================
pause
