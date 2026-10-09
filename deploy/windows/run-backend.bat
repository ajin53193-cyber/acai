@echo off
rem Heying backend keep-alive runner (registered as scheduled task HeyingBackend by deploy.bat; no manual run needed)
rem Auto-restarts 5s after any crash
chcp 65001 >nul
cd /d "%~dp0..\..\backend"
if not exist "..\logs" mkdir "..\logs"
:loop
echo [%date% %time%] starting uvicorn >> "..\logs\backend.log"
".venv\Scripts\python.exe" -m uvicorn server:app --host 127.0.0.1 --port 8001 --proxy-headers --forwarded-allow-ips=127.0.0.1 >> "..\logs\backend.log" 2>&1
echo [%date% %time%] uvicorn exited, restart in 5s >> "..\logs\backend.log"
ping -n 6 127.0.0.1 >nul
goto loop
