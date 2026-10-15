@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title gogo589 deploy (Windows / BaoTa)

echo ============================================================
echo    gogo589 one-click deploy (Windows)
echo    Run from project root (the folder that has backend/ frontend/)
echo ============================================================
echo.

cd /d "%~dp0"

if not exist "backend" ( echo [ERROR] backend folder not found here. Put this script in project root. & pause & exit /b 1 )
if not exist "frontend" ( echo [ERROR] frontend folder not found here. Put this script in project root. & pause & exit /b 1 )

echo [CHECK] python / node / yarn ...
where python >nul 2>nul || ( echo [ERROR] python not found. Install Python 3.11 and add to PATH. & pause & exit /b 1 )
where node   >nul 2>nul || ( echo [ERROR] node not found. Install Node 18/20 and add to PATH. & pause & exit /b 1 )
where yarn   >nul 2>nul || ( echo [INFO] yarn missing, installing via npm... & call npm install -g yarn )

echo.
echo ===================== 1/4 .env =====================
if not exist "backend\.env" ( copy "backend\.env.example" "backend\.env" >nul & echo [CREATED] backend\.env  -- fill real secrets later! )
if not exist "frontend\.env" ( copy "frontend\.env.example" "frontend\.env" >nul & echo [CREATED] frontend\.env -- set REACT_APP_BACKEND_URL to your domain! )

echo.
echo ================== 2/4 backend deps ==================
cd backend
if not exist "venv" ( python -m venv venv )
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install emergentintegrations==0.2.2 --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
cd ..

echo.
echo ================== 3/4 build frontend ==================
cd frontend
call yarn install
call yarn build
cd ..

echo.
echo ================== 4/4 start backend ==================
where pm2 >nul 2>nul
if %errorlevel%==0 (
  call pm2 start ecosystem.config.js
  call pm2 save
  echo [OK] backend started with PM2 on port 8001
) else (
  echo [INFO] PM2 not found. Starting backend in a new window (stops when closed).
  cd backend
  call venv\Scripts\activate.bat
  start "gogo589-backend" cmd /k "uvicorn server:app --host 0.0.0.0 --port 8001"
  cd ..
)

echo.
echo ============================================================
echo  DONE (auto part). Two manual steps remain:
echo  1) Open backend\.env in Notepad, fill secrets
echo     (EMERGENT_LLM_KEY / STRIPE_API_KEY / CLERK_* / MONGO_URL),
echo     then restart backend.
echo  2) In BaoTa -> Website, create a site with root:
echo     %cd%\frontend\build
echo     and reverse-proxy /api to http://127.0.0.1:8001
echo     (see deploy\nginx.conf.sample, enable SSL)
echo ============================================================
pause
