# 从备份恢复: .\restore_db.ps1 -File D:\...\sifang_pay_2026xxxx.archive.gz
param([Parameter(Mandatory=$true)][string]$File)
$ErrorActionPreference = "Stop"
$envFile = Join-Path (Resolve-Path "$PSScriptRoot\..\..").Path "backend\.env"
$mongo = (Select-String -Path $envFile -Pattern "^MONGO_URL=(.*)$").Matches[0].Groups[1].Value.Trim('"')
$dbName = (Select-String -Path $envFile -Pattern "^DB_NAME=(.*)$").Matches[0].Groups[1].Value.Trim('"')
$ok = Read-Host "将用 $File 覆盖数据库 $dbName，确认? (yes/no)"; if ($ok -ne "yes") { exit 1 }
nssm stop SifangPayBackend | Out-Null
mongorestore --uri "$mongo" --nsInclude="$dbName.*" --drop --gzip --archive="$File"
nssm start SifangPayBackend | Out-Null
Write-Host "恢复完成" -ForegroundColor Green
