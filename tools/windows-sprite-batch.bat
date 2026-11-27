@echo off
setlocal
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0windows-sprite-batch.ps1"
echo Exit code: %errorlevel%
pause
