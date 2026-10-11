# 四方收款平台 - MongoDB 每日备份 (Windows)
# 用法: powershell -File backup_db.ps1 [-KeepDays 14] [-OutDir D:\backups\sifang]
# 恢复: mongorestore --uri "<MONGO_URL>" --db <DB_NAME> --drop --gzip --archive=<文件>.gz
param(
  [int]$KeepDays = 14,
  [string]$OutDir = (Join-Path (Resolve-Path "$PSScriptRoot\..\..").Path "backups")
)
$ErrorActionPreference = "Stop"
$envFile = Join-Path (Resolve-Path "$PSScriptRoot\..\..").Path "backend\.env"
$mongo = (Select-String -Path $envFile -Pattern "^MONGO_URL=(.*)$").Matches[0].Groups[1].Value.Trim('"')
$dbName = (Select-String -Path $envFile -Pattern "^DB_NAME=(.*)$").Matches[0].Groups[1].Value.Trim('"')
if (-not (Get-Command mongodump -ErrorAction SilentlyContinue)) { throw "未找到 mongodump，请安装 MongoDB Database Tools 并加入 PATH: https://www.mongodb.com/try/download/database-tools" }
New-Item -ItemType Directory -Force $OutDir | Out-Null
$file = Join-Path $OutDir ("{0}_{1}.archive.gz" -f $dbName, (Get-Date -Format "yyyyMMdd_HHmmss"))
mongodump --uri "$mongo" --db $dbName --gzip --archive="$file"
if ($LASTEXITCODE -ne 0) { throw "mongodump 失败" }
Get-ChildItem $OutDir -Filter "$dbName*.archive.gz" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } | Remove-Item -Force
$size = [math]::Round((Get-Item $file).Length / 1MB, 2)
Write-Host "备份完成: $file ($size MB)，保留最近 $KeepDays 天"
