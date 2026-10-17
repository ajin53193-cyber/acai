@echo off
rem ============================================================
rem  四方收款平台 - 宝塔终端一键部署入口
rem  用法：在宝塔「终端」里执行  D:\wwwroot\sifang\deploy.bat
rem  作用：拉取最新代码 -> 装依赖 -> 构建前端 -> 重启后端(8011)
rem ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\windows\update.ps1" -Port 8011
