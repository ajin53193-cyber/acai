# 四方收款平台 - Windows 宝塔一键部署脚本
# 以管理员身份在 PowerShell 中运行：
#   Set-ExecutionPolicy Bypass -Scope Process -Force; .\deploy\windows\deploy.ps1
# 可选参数：-SiteRoot D:\wwwroot\sifang  -Domain print8.8bc8uyz.com  -ResetData
param(
  [string]$SiteRoot = (Resolve-Path "$PSScriptRoot\..\..").Path,
  [string]$Domain = "print8.8bc8uyz.com",
  [string]$Python = "",
  [switch]$ResetData
)
$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Need($cmd, $hint) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "未找到 $cmd。$hint" } }

Step "环境检查"
Need node   "请安装 Node.js 20 LTS（宝塔 Node 版本管理器或 nodejs.org）"
Need npm    "Node.js 安装异常"
# 寻找 Python >= 3.10：-Python 参数 > py 启动器 3.11/3.12/3.10 > PATH 中的 python
$candidates = @()
if ($Python) { $candidates += $Python }
if (Get-Command py -ErrorAction SilentlyContinue) { foreach ($v in "3.11","3.12","3.10") { $candidates += "py -$v" } }
$candidates += "python"
$PyExe = $null
foreach ($c in $candidates) {
  try {
    $ver = (& cmd /c "$c -c `"import sys;print(sys.version_info[0]*100+sys.version_info[1])`"" 2>$null)
    if ($ver -and [int]$ver -ge 310) { $PyExe = (& cmd /c "$c -c `"import sys;print(sys.executable)`"").Trim(); break }
  } catch {}
}
if (-not $PyExe) {
  throw "需要 Python 3.10+（推荐 3.11）。当前 PATH 中的 python 版本过旧。请从 https://www.python.org/downloads/windows/ 安装 Python 3.11（勾选 Add to PATH 与 py launcher），或用 -Python 'C:\Python311\python.exe' 指定路径。"
}
$py = (& $PyExe --version); $nv = (node --version); Write-Host "Python: $py ($PyExe)  Node: $nv"
if (-not (Get-Service -Name MongoDB -ErrorAction SilentlyContinue)) {
  Write-Warning "未检测到 MongoDB Windows 服务。请先安装 MongoDB Community Server 7.x（勾选 Install as Service），或在 .env 中填写远程 MONGO_URL。"
}

$backend = Join-Path $SiteRoot "backend"
$frontend = Join-Path $SiteRoot "frontend"

Step "后端 .env"
$envFile = Join-Path $backend ".env"
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $SiteRoot "deploy\backend.env.example") $envFile
  $secret = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 48 | % {[char]$_})
  $cron   = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 32 | % {[char]$_})
  (Get-Content $envFile) -replace "CHANGE_ME_TO_A_LONG_RANDOM_STRING", $secret -replace "WEBHOOK_CRON_SECRET=CHANGE_ME_RANDOM", "WEBHOOK_CRON_SECRET=$cron" | Set-Content $envFile -Encoding UTF8
  Write-Warning "已生成 backend\.env，请编辑并填写 ADMIN_PASSWORD / TRONGRID_API_KEY 等后重新运行本脚本。"
  notepad $envFile
  exit 0
}

Step "后端依赖 (venv)"
Push-Location $backend
if (-not (Test-Path ".venv")) { & $PyExe -m venv .venv }
& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip -q
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt -q
Pop-Location

Step "前端构建 (同域部署，API 使用 https://$Domain)"
Push-Location $frontend
if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) { npm install -g yarn | Out-Null }
yarn install --frozen-lockfile
$env:REACT_APP_BACKEND_URL = ""   # 留空 => 前端自动使用当前访问域名（主域/备用域均可）
$env:GENERATE_SOURCEMAP = "false"
yarn build
Pop-Location

if ($ResetData) {
  Step "清除测试数据"
  Push-Location $backend
  & ".\.venv\Scripts\python.exe" reset_data.py --yes
  Pop-Location
}

Step "生成启动脚本 start_backend.bat"
$bat = @"
@echo off
cd /d "$backend"
".venv\Scripts\python.exe" -m uvicorn server:app --host 127.0.0.1 --port 8001 --workers 1
"@
Set-Content (Join-Path $SiteRoot "deploy\windows\start_backend.bat") $bat -Encoding ASCII

Step "注册后端为 Windows 服务 (NSSM)"
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssm) {
  $nssmDir = Join-Path $SiteRoot "deploy\windows\nssm"
  if (-not (Test-Path "$nssmDir\nssm.exe")) {
    New-Item -ItemType Directory -Force $nssmDir | Out-Null
    Invoke-WebRequest "https://nssm.cc/release/nssm-2.24.zip" -OutFile "$nssmDir\nssm.zip"
    Expand-Archive "$nssmDir\nssm.zip" "$nssmDir\tmp" -Force
    Copy-Item "$nssmDir\tmp\nssm-2.24\win64\nssm.exe" "$nssmDir\nssm.exe"
    Remove-Item "$nssmDir\tmp","$nssmDir\nssm.zip" -Recurse -Force
  }
  $nssmExe = "$nssmDir\nssm.exe"
} else { $nssmExe = $nssm.Source }
$svc = "SifangPayBackend"
if (Get-Service $svc -ErrorAction SilentlyContinue) { & $nssmExe stop $svc | Out-Null; & $nssmExe remove $svc confirm | Out-Null }
& $nssmExe install $svc "$backend\.venv\Scripts\python.exe" "-m uvicorn server:app --host 127.0.0.1 --port 8001"
& $nssmExe set $svc AppDirectory $backend
& $nssmExe set $svc AppStdout "$backend\logs\backend.out.log"
& $nssmExe set $svc AppStderr "$backend\logs\backend.err.log"
& $nssmExe set $svc AppRotateFiles 1
& $nssmExe set $svc Start SERVICE_AUTO_START
New-Item -ItemType Directory -Force "$backend\logs" | Out-Null
& $nssmExe start $svc
Start-Sleep 4
try { $r = Invoke-WebRequest "http://127.0.0.1:8001/api/checkout/settings" -UseBasicParsing -TimeoutSec 10; Write-Host "后端健康: HTTP $($r.StatusCode)" -ForegroundColor Green }
catch { Write-Warning "后端未响应，请查看 $backend\logs\backend.err.log" }

Step "注册定时任务 (替代平台 cron)"
$cronSecret = (Select-String -Path $envFile -Pattern "^WEBHOOK_CRON_SECRET=(.*)$").Matches[0].Groups[1].Value
$curl = "curl.exe"
$jobs = @(
  @{n="SifangDailySettle";  t="00:05"; p="/api/cron/daily-settle"},
  @{n="SifangRunExports";   t="00:20"; p="/api/cron/run-exports"},
  @{n="SifangExportExpiry"; t="00:30"; p="/api/cron/export-expiry-reminders"},
  @{n="SifangSupportClean"; t="03:00"; p="/api/cron/support-cleanup"}
)
foreach ($j in $jobs) {
  $cmd = "$curl -s -X POST http://127.0.0.1:8001$($j.p) -H `"Authorization: Bearer $cronSecret`""
  schtasks /Create /F /SC DAILY /ST $j.t /TN $j.n /TR $cmd /RU SYSTEM | Out-Null
}
Write-Host "已创建 4 个 Windows 计划任务。"

Step "注册每日数据库备份 (02:30, 保留 14 天)"
$bk = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$SiteRoot\deploy\windows\backup_db.ps1`" -KeepDays 14"
schtasks /Create /F /SC DAILY /ST 02:30 /TN SifangDbBackup /TR $bk /RU SYSTEM | Out-Null
if (Get-Command mongodump -ErrorAction SilentlyContinue) { & "$SiteRoot\deploy\windows\backup_db.ps1" -KeepDays 14 }
else { Write-Warning "未安装 mongodump（MongoDB Database Tools），计划任务已创建但首次备份跳过。" }

Step "完成"
Write-Host @"
后续在宝塔面板中：
 1. 网站 -> 添加站点：域名填 print8.8bc8uyz.com, print8.1bc8uyz.com, print8.2bc8uyz.com
    根目录： $frontend\build
 2. 站点 -> 配置文件：用 deploy\nginx.conf 的 server 块替换（root 改为上面的 build 路径，Windows 路径用 / 分隔）
 3. 站点 -> SSL：为三个域名申请 Let's Encrypt 证书并开启强制 HTTPS
 4. 浏览器访问 https://$Domain 用 .env 中的 ADMIN_EMAIL / ADMIN_PASSWORD 登录
 服务管理：nssm start|stop|restart SifangPayBackend     日志：$backend\logs
 数据库备份：每日 02:30 自动 -> $SiteRoot\backups（保留 14 天）；手动 deploy\windows\backup_db.ps1；恢复 deploy\windows\restore_db.ps1 -File <文件>
"@ -ForegroundColor Green
