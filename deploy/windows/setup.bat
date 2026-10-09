@echo off
rem ============================================================
rem  Heying website - Windows Baota one-click bootstrap
rem  Steps performed: download code -> install Python/Node ->
rem  install deps -> build frontend -> start backend
rem ============================================================
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "ROOT=D:\wwwroot"
set "APP_DIR=%ROOT%\heying"
set "PY_VER=3.11.9"
set "NODE_VER=v20.18.1"
set "PY_URL=https://mirrors.huaweicloud.com/python/%PY_VER%/python-%PY_VER%-amd64.exe"
set "NODE_URL=https://registry.npmmirror.com/-/binary/node/%NODE_VER%/node-%NODE_VER%-x64.msi"
set "TMP=%TEMP%\heying_setup"
if not exist "%TMP%" mkdir "%TMP%"

echo.
echo ============================================================
echo   Heying website - one-click setup
echo   Target dir: %APP_DIR%
echo ============================================================

rem ---------- 1. download and extract source code ----------
if exist "%APP_DIR%\backend\server.py" (
  echo [1/4] Code already exists, skip download
) else (
  echo [1/4] Downloading source code...
  if not exist "%ROOT%" mkdir "%ROOT%"
  set "ZIP=%TMP%\acai.zip"
  del /q "!ZIP!" >nul 2>&1
  call :download "https://codeload.github.com/ajin53193-cyber/acai/zip/refs/heads/main" "!ZIP!"
  if not exist "!ZIP!" call :download "https://ghfast.top/https://github.com/ajin53193-cyber/acai/archive/refs/heads/main.zip" "!ZIP!"
  if not exist "!ZIP!" call :download "https://ghproxy.net/https://github.com/ajin53193-cyber/acai/archive/refs/heads/main.zip" "!ZIP!"
  if not exist "!ZIP!" ( echo [ERROR] Code download failed. Check server internet access. & pause & exit /b 1 )
  echo     Extracting...
  if exist "%TMP%\unzip" rmdir /s /q "%TMP%\unzip"
  powershell -NoProfile -Command "Expand-Archive -Force '!ZIP!' '%TMP%\unzip'"
  if exist "%APP_DIR%" rmdir /s /q "%APP_DIR%"
  move "%TMP%\unzip\acai-main" "%APP_DIR%" >nul || ( echo [ERROR] Extract result not found & pause & exit /b 1 )
  echo     Code ready: %APP_DIR%
)

rem ---------- 2. install Python ----------
echo [2/4] Checking Python 3.11...
set "PYEXE="
for %%p in ("C:\Program Files\Python311\python.exe" "C:\Program Files\Python312\python.exe") do if exist %%p set "PYEXE=%%~p"
if not defined PYEXE where python >nul 2>&1 && set "PYEXE=python"
if not defined PYEXE (
  echo     Downloading and silently installing Python %PY_VER% ^(2-4 min, please wait, do NOT close^)...
  call :download "%PY_URL%" "%TMP%\python-setup.exe"
  if not exist "%TMP%\python-setup.exe" ( echo [ERROR] Python download failed & pause & exit /b 1 )
  "%TMP%\python-setup.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1 Include_test=0
  set "PATH=C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%PATH%"
) else (
  echo     Already installed
  set "PATH=C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%PATH%"
)

rem ---------- 3. install Node ----------
echo [3/4] Checking Node 20...
where node >nul 2>&1
if errorlevel 1 (
  echo     Downloading and silently installing Node %NODE_VER% ^(1-3 min^)...
  call :download "%NODE_URL%" "%TMP%\node-setup.msi"
  if not exist "%TMP%\node-setup.msi" ( echo [ERROR] Node download failed & pause & exit /b 1 )
  msiexec /i "%TMP%\node-setup.msi" /qn /norestart
  set "PATH=C:\Program Files\nodejs;%PATH%"
) else (
  echo     Already installed
)

rem ---------- 4. run the main deploy script ----------
echo [4/4] Deploying ^(install deps / build frontend / start backend^)...
echo.
call "%APP_DIR%\deploy\windows\deploy.bat"
exit /b %ERRORLEVEL%

rem ================= download sub-routine =================
:download
echo     Fetching: %~1
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -UseBasicParsing -Uri '%~1' -OutFile '%~2' -TimeoutSec 900 } catch { Write-Host ('  fail: ' + $_.Exception.Message) }"
goto :eof
