@echo off
cd /d %~dp0
set PORT=8000
start "birthday-server" /min python -m http.server %PORT% --bind 127.0.0.1
timeout /t 2 >nul
start "" http://127.0.0.1:%PORT%/index.html
