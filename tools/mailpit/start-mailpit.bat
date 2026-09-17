@echo off
title Mailpit Local SMTP & Web UI Server
echo ========================================================
echo   QuizMaster Yerel E-Posta Test Sunucusu (Mailpit)
echo ========================================================
echo Web Arayuzu (In-box): http://127.0.0.1:8025
echo SMTP Sunucu Portu  : 127.0.0.1:1026
echo.
echo Sunucu calisiyor... Durdurmak icin Ctrl+C tusuna basin.
echo ========================================================
cd /d "%~dp0"
mailpit.exe --listen 127.0.0.1:8025 --smtp 127.0.0.1:1026
pause
