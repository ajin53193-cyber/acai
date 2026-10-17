# Heying: patch Baota nginx vhost so /sitemap.xml is served by the backend, then reload nginx.
# Called by deploy.bat; safe to run repeatedly.
$ErrorActionPreference = 'SilentlyContinue'
$block = @"
    location = /sitemap.xml {
        proxy_pass http://127.0.0.1:8001/api/sitemap.xml;
        proxy_set_header Host `$host;
    }
"@

$blockEsc = $block.Replace('$', '$$')
$bt = $null
foreach ($d in 'C','D','E','F') {
  if (Test-Path "$($d):\BtSoft\panel\vhost\nginx") { $bt = "$($d):\BtSoft"; break }
}
if (-not $bt) { Write-Host '[nginx] Baota vhost dir not found, skip (apply deploy\windows\nginx-site.conf manually)'; exit 0 }

$changed = $false
foreach ($f in Get-ChildItem "$bt\panel\vhost\nginx\*.conf") {
  $s = Get-Content $f.FullName -Raw
  if ($s -notmatch 'heying') { continue }
  if ($s -match 'proxy_pass http://127\.0\.0\.1:8001/api/sitemap\.xml') { Write-Host "[nginx] $($f.Name): sitemap proxy already present"; continue }
  if ($s -match '(?m)^[ \t]*location\s*=\s*/sitemap\.xml\s*\{[^}]*\}[ \t]*\r?\n?') {
    $s = [regex]::Replace($s, '(?m)^[ \t]*location\s*=\s*/sitemap\.xml\s*\{[^}]*\}[ \t]*\r?\n?', $blockEsc + "`r`n")
  } elseif ($s -match '(?m)^[ \t]*location\s+/api/\s*\{') {
    $s = ([regex]'(?m)^([ \t]*location\s+/api/\s*\{)').Replace($s, ($blockEsc + "`r`n" + '$1'), 1)
  } else { Write-Host "[nginx] $($f.Name): no /api/ location found, skip"; continue }
  Copy-Item $f.FullName "$($f.FullName).bak" -Force
  Set-Content -Path $f.FullName -Value $s -Encoding UTF8 -NoNewline
  Write-Host "[nginx] $($f.Name): sitemap proxy added (backup .bak)"
  $changed = $true
}

if (-not $changed) { exit 0 }
$nginx = "$bt\nginx\nginx.exe"
if (-not (Test-Path $nginx)) { Write-Host '[nginx] nginx.exe not found, please reload nginx in Baota panel'; exit 0 }
Push-Location "$bt\nginx"
$t = & $nginx -t 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "[nginx] config test FAILED, restoring backup: $t"
  foreach ($b in Get-ChildItem "$bt\panel\vhost\nginx\*.conf.bak") { Copy-Item $b.FullName ($b.FullName -replace '\.bak$','') -Force }
} else {
  & $nginx -s reload 2>&1 | Out-Null
  Write-Host '[nginx] reloaded, /sitemap.xml now served by backend'
}
Pop-Location
