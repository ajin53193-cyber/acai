@echo off
rem ============================================================
rem  Heying website - Windows (Baota) deploy / update script
rem  First run: installs deps, builds frontend, registers+starts backend
rem  Later updates: just run again
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
echo ===== App dir: %APP_DIR%
cd /d "%APP_DIR%"

rem ---------- 0. pull latest code (only if git repo) ----------
if exist ".git" (
  where git >nul 2>&1 && (
    echo ===== git pull
    git pull --ff-only || echo [note] git pull failed, using current code
  )
)

rem ---------- 1. check backend .env ----------
echo ===== Checking backend\.env
if not exist "%BACKEND_DIR%\.env" (
  copy /y "%APP_DIR%\deploy\windows\backend.env.example" "%BACKEND_DIR%\.env" >nul
  set "UPLOAD_PATH=%APP_DIR:\=/%/uploads"
  powershell -NoProfile -Command "$s=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N'); $u='!UPLOAD_PATH!'; (Get-Content '%BACKEND_DIR%\.env') -replace '^JWT_SECRET=.*',('JWT_SECRET='+$s) -replace '^UPLOAD_DIR=.*',('UPLOAD_DIR='+$u) | Set-Content -Encoding ASCII '%BACKEND_DIR%\.env'"
  echo.
  echo [ACTION NEEDED] Created %BACKEND_DIR%\.env
  echo   Open it in Notepad / Baota file manager and confirm:
  echo     ADMIN_PASSWORD  = admin login password
  echo     AI_API_KEY      = DeepSeek key ^(leave empty to disable AI chat^)
  echo   Then run this script again.
  pause
  exit /b 1
)

rem ---------- 2. Python venv ----------
echo ===== Preparing Python env ^(need 3.10+^)
set "PY="
for %%c in ("py -3.12" "py -3.11" "py -3.10" "python") do (
  if not defined PY (
    %%~c -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1 && set "PY=%%~c"
  )
)
if not defined PY (
  echo [ERROR] Python 3.10+ not found. Install Python 3.11 and re-open terminal.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('%PY% --version') do echo Using %%v
if not exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
  %PY% -m venv "%BACKEND_DIR%\.venv" || (echo [ERROR] create venv failed & pause & exit /b 1)
)
"%BACKEND_DIR%\.venv\Scripts\python.exe" -m pip install -q -i %PIP_INDEX% --upgrade pip
"%BACKEND_DIR%\.venv\Scripts\python.exe" -m pip install -q -i %PIP_INDEX% -r "%BACKEND_DIR%\requirements-selfhost.txt" || (echo [ERROR] pip install failed & pause & exit /b 1)
echo Python deps installed

rem ---------- 3. build frontend ----------
echo ===== Building frontend ^(need Node 18+^)
where node >nul 2>&1 || (
  echo [ERROR] node not found. Install Node 20 LTS and re-open terminal.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo Node %%v
cd /d "%FRONTEND_DIR%"
where yarn >nul 2>&1 || call npm install -g yarn --registry %NPM_REGISTRY%
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));for(const k of Object.keys(p.devDependencies||{}))if(k.startsWith('@emergentbase/'))delete p.devDependencies[k];fs.writeFileSync('package.json',JSON.stringify(p,null,2));"
call yarn install --registry %NPM_REGISTRY% --network-timeout 600000 --ignore-engines || (echo [ERROR] frontend deps install failed & pause & exit /b 1)
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
if not "%BUILD_RC%"=="0" (echo [ERROR] frontend build failed & pause & exit /b 1)
echo Frontend build done: %FRONTEND_DIR%\build

rem ---------- 4. backend service (scheduled task + auto-restart) ----------
echo ===== Registering and restarting backend %TASK_NAME%
if not exist "%APP_DIR%\uploads" mkdir "%APP_DIR%\uploads"
if not exist "%APP_DIR%\logs" mkdir "%APP_DIR%\logs"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*run-backend.bat*' -or $_.CommandLine -like '*uvicorn server:app*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
schtasks /query /tn %TASK_NAME% >nul 2>&1 || (
  schtasks /create /tn %TASK_NAME% /tr "\"%APP_DIR%\deploy\windows\run-backend.bat\"" /sc onstart /ru SYSTEM /rl HIGHEST /f >nul || (echo [ERROR] create scheduled task failed, run as Administrator & pause & exit /b 1)
)
schtasks /run /tn %TASK_NAME% >nul
timeout /t 6 /nobreak >nul

rem ---------- 5. health check ----------
echo ===== Health check
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8001/api/settings > "%TEMP%\heying_hc.txt" 2>nul
set /p HC=<"%TEMP%\heying_hc.txt"
if "%HC%"=="200" (
  echo Backend OK: http://127.0.0.1:8001/api/settings
) else (
  echo [ERROR] Backend not responding ^(status %HC%^). See log: %APP_DIR%\logs\backend.log
  pause
  exit /b 1
)

echo.
echo ================= DEPLOY DONE =================
echo 1. Baota site root -^> %FRONTEND_DIR%\build
echo 2. Site config file -^> apply deploy\windows\nginx-site.conf ^(/api/ reverse proxy^)
echo 3. First data migration: backend\.venv\Scripts\python.exe deploy\baota\import_from_live.py
echo ==============================================
pause
