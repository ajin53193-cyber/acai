@echo off
REM ============================================================
REM  Sifang Pay - one-click deploy (run in Baota terminal)
REM  Usage: D:\wwwroot\sifang\deploy\windows\baota_deploy.bat
REM  Pull latest code -> deps -> build frontend -> restart backend(8011)
REM ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1" -Port 8011
