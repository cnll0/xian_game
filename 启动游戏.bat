@echo off
cd /d "%~dp0"
echo Starting Xian Game 2D...
start "" "http://localhost:8081"
python -m http.server 8081