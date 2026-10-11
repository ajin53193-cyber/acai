@echo off
rem 用法: cron_call.bat /api/cron/daily-settle [端口=8001]   —— 读取 backend\.env 的 WEBHOOK_CRON_SECRET 调用本机后端
setlocal
set "ENVFILE=%~dp0..\..\backend\.env"
for /f "usebackq tokens=1,* delims==" %%A in ("%ENVFILE%") do if /i "%%A"=="WEBHOOK_CRON_SECRET" set "SECRET=%%B"
set "PORT=%~2"
if "%PORT%"=="" set "PORT=8001"
curl.exe -s -X POST "http://127.0.0.1:%PORT%%~1" -H "Authorization: Bearer %SECRET%" >> "%~dp0..\..\backend\logs\cron.log" 2>&1
echo. >> "%~dp0..\..\backend\logs\cron.log"
