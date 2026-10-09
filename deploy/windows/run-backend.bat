@echo off
rem 合赢项目社 · 后端常驻运行脚本（由 deploy.bat 注册为开机计划任务 HeyingBackend 自动调用，无需手动运行）
rem 进程异常退出时 5 秒后自动拉起
chcp 65001 >nul
cd /d "%~dp0..\..\backend"
if not exist "..\logs" mkdir "..\logs"
:loop
echo [%date% %time%] starting uvicorn >> "..\logs\backend.log"
".venv\Scripts\python.exe" -m uvicorn server:app --host 127.0.0.1 --port 8001 --proxy-headers --forwarded-allow-ips=127.0.0.1 >> "..\logs\backend.log" 2>&1
echo [%date% %time%] uvicorn exited, restart in 5s >> "..\logs\backend.log"
timeout /t 5 /nobreak >nul
goto loop
