@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Mailpit Local SMTP and Web UI Server

set "PROJECT_ROOT=%~dp0..\.."
set "FINDER=%PROJECT_ROOT%\scripts\find-port-holder.mjs"
set "WEB_PORT=8025"
set "SMTP_PORT=1026"

echo ========================================================
echo   QuizMaster Yerel E-Posta Test Sunucusu (Mailpit)
echo ========================================================
echo Web Arayuzu (In-box): http://127.0.0.1:%WEB_PORT%
echo SMTP Sunucu Portu  : 127.0.0.1:%SMTP_PORT%
echo.

rem --- Port cakisma kontrolu (onceki mailpit kurulum/surec kalintisi) ---
set "CONFLICT_PID="
set "CONFLICT_PORT="
for %%P in (%WEB_PORT% %SMTP_PORT%) do (
  if not defined CONFLICT_PID (
    set "FOUND_PID="
    for /f "delims=" %%H in ('node "%FINDER%" %%P 2^>nul') do set "FOUND_PID=%%H"
    if defined FOUND_PID (
      set "CONFLICT_PID=!FOUND_PID!"
      set "CONFLICT_PORT=%%P"
    )
  )
)

if defined CONFLICT_PID (
  echo [UYARI] Port zaten kullanilda: 127.0.0.1:!CONFLICT_PORT!
  echo.
  echo Bu durum, onceki Mailpit penceresi veya start-mailpit.bat
  echo kapatildiginda arka planda kalan surecin portu birakmamasindan
  echo kaynaklanir.
  echo.
  echo   listen EADDRINUSE: address already in use 127.0.0.1:!CONFLICT_PORT!
  echo.
  echo Portu tutan surec: PID !CONFLICT_PID!
  echo.
  echo Yapilmasi gerekenler:
  echo   1. Hala acik bir Mailpit penceresi varsa onu kullanin veya kapatin.
  echo   2. Asagidaki komutla kalan sureci durdurun:
  echo        taskkill /PID !CONFLICT_PID! /F
  echo   3. start-mailpit.bat dosyasini yeniden calistirin.
  echo.
  echo Not: Kurulum ve uygulama verileri bu uyari nedeniyle degistirilmez.
  echo.
  choice /C DK /N /M "Kalan surec simdi durdurulsun mu? [D=durdur ve devam et / K=kapat]: "
  if errorlevel 2 (
    echo.
    echo Mailpit baslatilmadi; mevcut dosya ve veriler degistirilmedi.
    pause
    exit /b 1
  )
  echo.
  echo PID !CONFLICT_PID! durduruluyor...
  taskkill /PID !CONFLICT_PID! /F >nul 2>&1
  if errorlevel 1 (
    echo [HATA] Surec durdurulamadi. Elle deneyin: taskkill /PID !CONFLICT_PID! /F
    pause
    exit /b 1
  )
  ping -n 2 127.0.0.1 >nul
)

echo Sunucu calisiyor... Durdurmak icin Ctrl+C tusuna basin.
echo ========================================================
cd /d "%~dp0"
mailpit.exe --listen 127.0.0.1:%WEB_PORT% --smtp 127.0.0.1:%SMTP_PORT%
pause
