@echo off
rem ============================================================
rem  合赢项目社官网 · Windows 宝塔网页面板「一键部署」引导脚本
rem  使用方法（全程在宝塔网页里操作，无需单独安装 Git/Python/Node）：
rem   1) 宝塔 → 文件 → 进入 D:\wwwroot → 新建文件，命名 一键部署.bat
rem   2) 双击该文件 → 把本文件内容全部粘贴进去 → 保存
rem   3) 宝塔 → 终端 → 执行：  D:\wwwroot\一键部署.bat
rem  脚本会：下载代码 → 自动装 Python/Node → 装依赖 → 构建前端 → 启动后端
rem  第一次会生成 backend\.env 并暂停，让你填后台密码/AI密钥，填完再运行一次本脚本即可
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
echo   合赢项目社官网 · 一键部署
echo   安装目录：%APP_DIR%
echo ============================================================

rem ---------- 1. 下载并解压代码 ----------
if exist "%APP_DIR%\backend\server.py" (
  echo [1/4] 代码已存在，跳过下载
) else (
  echo [1/4] 下载网站代码...
  if not exist "%ROOT%" mkdir "%ROOT%"
  set "ZIP=%TMP%\acai.zip"
  del /q "!ZIP!" >nul 2>&1
  call :download "https://codeload.github.com/ajin53193-cyber/acai/zip/refs/heads/main" "!ZIP!"
  if not exist "!ZIP!" call :download "https://ghfast.top/https://github.com/ajin53193-cyber/acai/archive/refs/heads/main.zip" "!ZIP!"
  if not exist "!ZIP!" call :download "https://ghproxy.net/https://github.com/ajin53193-cyber/acai/archive/refs/heads/main.zip" "!ZIP!"
  if not exist "!ZIP!" ( echo [错误] 代码下载失败，请确认服务器能访问外网 & pause & exit /b 1 )
  echo     解压中...
  if exist "%TMP%\unzip" rmdir /s /q "%TMP%\unzip"
  powershell -NoProfile -Command "Expand-Archive -Force '!ZIP!' '%TMP%\unzip'"
  if exist "%APP_DIR%" rmdir /s /q "%APP_DIR%"
  move "%TMP%\unzip\acai-main" "%APP_DIR%" >nul || ( echo [错误] 解压结果异常 & pause & exit /b 1 )
  echo     代码就绪：%APP_DIR%
)

rem ---------- 2. 安装 Python ----------
echo [2/4] 检查 Python 3.11...
set "PYEXE="
for %%p in ("C:\Program Files\Python311\python.exe" "C:\Program Files\Python312\python.exe") do if exist %%p set "PYEXE=%%~p"
if not defined PYEXE where python >nul 2>&1 && set "PYEXE=python"
if not defined PYEXE (
  echo     下载并静默安装 Python %PY_VER%（约 2-4 分钟，请耐心等待，不要关窗口）...
  call :download "%PY_URL%" "%TMP%\python-setup.exe"
  if not exist "%TMP%\python-setup.exe" ( echo [错误] Python 下载失败 & pause & exit /b 1 )
  "%TMP%\python-setup.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1 Include_test=0
  set "PATH=C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%PATH%"
) else (
  echo     已安装
  set "PATH=C:\Program Files\Python311;C:\Program Files\Python311\Scripts;%PATH%"
)

rem ---------- 3. 安装 Node ----------
echo [3/4] 检查 Node 20...
where node >nul 2>&1
if errorlevel 1 (
  echo     下载并静默安装 Node %NODE_VER%（约 1-3 分钟）...
  call :download "%NODE_URL%" "%TMP%\node-setup.msi"
  if not exist "%TMP%\node-setup.msi" ( echo [错误] Node 下载失败 & pause & exit /b 1 )
  msiexec /i "%TMP%\node-setup.msi" /qn /norestart
  set "PATH=C:\Program Files\nodejs;%PATH%"
) else (
  echo     已安装
)

rem ---------- 4. 调用正式部署脚本 ----------
echo [4/4] 开始部署（安装依赖 / 构建前端 / 启动后端）...
echo.
call "%APP_DIR%\deploy\windows\deploy.bat"
exit /b %ERRORLEVEL%

rem ================= 下载子程序（带重试，国内镜像优先） =================
:download
echo     正在下载：%~1
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -UseBasicParsing -Uri '%~1' -OutFile '%~2' -TimeoutSec 900 } catch { Write-Host ('  失败: ' + $_.Exception.Message) }"
goto :eof
