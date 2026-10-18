@echo off
chcp 65001 >nul
cd /d "D:\Desktop\word_or_image\xian\xian_game"
echo 正在启动修仙传说2D...
start "" "http://localhost:8081"
python -m http.server 8081