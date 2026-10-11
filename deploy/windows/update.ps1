# 四方收款平台 - 一键更新 (Windows)
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File D:\wwwroot\sifang\deploy\windows\update.ps1 [-Branch z-hzhi-fzhi-fu] [-Port 8011] [-SkipBackend] [-SkipFrontend]
# 流程: 备份数据库 -> 下载 GitHub 分支 ZIP -> 覆盖 backend/frontend/deploy（保留 .env、.venv、node_modules、logs、backups）-> pip/yarn 依赖 -> 构建前端 -> 重启服务 -> 健康检查
param(
  [string]$Repo = "ajin53193-cyber/acai",
  [string]$Branch = "z-hzhi-fzhi-fu",
  [string]$SiteRoot = (Resolve-Path "$PSScriptRoot\..\..").Path,
  [int]$Port = 8011,
  [switch]$SkipBackend,
  [switch]$SkipFrontend,
  [switch]$NoBackup
)
$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
$backend = Join-Path $SiteRoot "backend"; $frontend = Join-Path $SiteRoot "frontend"
$tmp = Join-Path $env:TEMP ("sifang_update_" + (Get-Date -Format "yyyyMMddHHmmss"))
$nssm = Join-Path $SiteRoot "deploy\windows\nssm\nssm.exe"
if (-not (Test-Path $nssm)) { $nssm = "nssm" }

if (-not $NoBackup) {
  Step "更新前数据库备份"
  try { & "$SiteRoot\deploy\windows\backup_db.ps1" -KeepDays 14 } catch { Write-Warning "备份跳过: $($_.Exception.Message)" }
}

Step "下载最新代码 ($Repo @ $Branch)"
New-Item -ItemType Directory -Force $tmp | Out-Null
$zip = Join-Path $tmp "src.zip"
Invoke-WebRequest "https://github.com/$Repo/archive/refs/heads/$Branch.zip?t=$(Get-Random)" -Headers @{ "Cache-Control" = "no-cache" } -OutFile $zip
Expand-Archive $zip -DestinationPath $tmp -Force
$src = Get-ChildItem $tmp -Directory | Where-Object { $_.Name -ne "__MACOSX" } | Select-Object -First 1
if (-not $src) { throw "ZIP 解压后未找到源码目录" }
$src = $src.FullName
Write-Host "源码目录: $src"

Step "同步文件（保留 .env / .venv / node_modules / logs / backups / build）"
$ex = Join-Path $tmp "exclude.txt"
@("\.env", "\.venv\", "\node_modules\", "\logs\", "\build\", "\backups\", "\mongotools\", "\nssm\") | Set-Content $ex -Encoding ASCII
robocopy "$src\backend"  $backend  /E /XF .env /XD .venv logs __pycache__ exports /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$src\frontend" $frontend /E /XD node_modules build /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy "$src\deploy"   (Join-Path $SiteRoot "deploy") /E /XD nssm mongotools /NFL /NDL /NJH /NJS /NP | Out-Null
Get-ChildItem "$SiteRoot\deploy\windows\*.ps1" | ForEach-Object {
  $t = [IO.File]::ReadAllText($_.FullName, [Text.Encoding]::UTF8)
  [IO.File]::WriteAllText($_.FullName, $t, (New-Object Text.UTF8Encoding $true))
}
Remove-Item $tmp -Recurse -Force

if (-not $SkipBackend) {
  Step "后端依赖"
  Push-Location $backend
  & ".\.venv\Scripts\python.exe" -m pip install -r requirements-prod.txt -q
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "后端依赖安装失败" }
  Pop-Location
}

if (-not $SkipFrontend) {
  Step "前端构建"
  Push-Location $frontend
  corepack enable 2>$null; corepack prepare yarn@1.22.22 --activate 2>$null
  $yarn = if (Get-Command yarn -ErrorAction SilentlyContinue) { "yarn" } else { "npx --yes yarn@1.22.22" }
  Invoke-Expression "$yarn install --frozen-lockfile"
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "前端依赖安装失败" }
  $env:REACT_APP_BACKEND_URL = ""; $env:GENERATE_SOURCEMAP = "false"
  Invoke-Expression "$yarn build"
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "前端构建失败" }
  Pop-Location
}

Step "重启后端服务"
& $nssm restart SifangPayBackend | Out-Null
$ok = $false
foreach ($i in 1..15) {
  Start-Sleep 2
  try { $r = Invoke-WebRequest "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 5; if ($r.StatusCode -eq 200) { $ok = $true; break } } catch {}
}
if ($ok) { Write-Host "后端健康: HTTP 200 ($Port)" -ForegroundColor Green }
else { Write-Warning "后端未在 30 秒内响应，请查看 $backend\logs\backend.err.log" }

Step "完成"
Write-Host "更新完成。浏览器 Ctrl+F5 刷新即可看到新版本。" -ForegroundColor Green
