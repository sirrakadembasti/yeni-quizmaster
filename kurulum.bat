@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 1254 >nul
title QuizMaster Kurulum Ön Kontrolü

set "PROJECT_ROOT=%~dp0"
pushd "%PROJECT_ROOT%" >nul 2>&1
if errorlevel 1 (
  echo [HATA] QuizMaster proje dizinine girilemedi: %PROJECT_ROOT%
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   QuizMaster Kurulum Ön Kontrolü
echo ============================================================
echo Proje dizini: %PROJECT_ROOT%
echo.

if not exist "package.json" (
  echo [HATA] package.json bulunamadý. Bu dosyayý QuizMaster ana dizininden çalýþtýrýn.
  goto :failed
)

findstr /C:"quiz-master" "package.json" >nul
if errorlevel 1 (
  echo [HATA] Bu dizin geçerli QuizMaster proje kökü olarak doðrulanamadý.
  goto :failed
)

set "HAS_ERROR=0"
set "NODE_VERSION="
set "NODE_MAJOR="
where node >nul 2>&1
if errorlevel 1 (
  echo [EKSÝK] Node.js bulunamadý.
  set "HAS_ERROR=1"
) else (
  for /f "delims=" %%V in ('node -p "process.versions.node" 2^>nul') do set "NODE_VERSION=%%V"
  for /f "delims=" %%M in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%M"
  if "!NODE_MAJOR!"=="22" (
    echo [TAMAM] Node.js !NODE_VERSION!
  ) else if "!NODE_MAJOR!"=="24" (
    echo [TAMAM] Node.js !NODE_VERSION!
  ) else (
    echo [UYUMSUZ] Node.js !NODE_VERSION! bulundu. Node.js 22 veya 24 LTS gereklidir.
    set "HAS_ERROR=1"
  )
)

set "PNPM_VERSION="
where pnpm >nul 2>&1
if errorlevel 1 (
  echo [EKSÝK] pnpm bulunamadý. Gerekli sürüm: 9.15.1
  set "HAS_ERROR=1"
) else (
  for /f "delims=" %%V in ('pnpm --version 2^>nul') do set "PNPM_VERSION=%%V"
  if "!PNPM_VERSION!"=="9.15.1" (
    echo [TAMAM] pnpm !PNPM_VERSION!
  ) else (
    echo [UYUMSUZ] pnpm !PNPM_VERSION! bulundu. Gerekli sürüm: 9.15.1
    set "HAS_ERROR=1"
  )
)

if "%HAS_ERROR%"=="1" goto :requirements

set "CHECK_PORT=5049"
if defined SETUP_BOOTSTRAP_PORT set "CHECK_PORT=%SETUP_BOOTSTRAP_PORT%"

rem --- Kurulum baslangic portu kontrolu ---
set "PORT_HOLDER_PID="
for /f "delims=" %%P in ('node "scripts\find-port-holder.mjs" !CHECK_PORT! 2^>nul') do set "PORT_HOLDER_PID=%%P"

if defined PORT_HOLDER_PID (
  echo.
  echo [UYARI] Kurulum baþlangýç portu zaten kullanýmda: 127.0.0.1:!CHECK_PORT!
  echo.
  echo Bu durum, önceki kurulum penceresi veya kurulum.bat kapatýldýðýnda
  echo arka planda kalan kurulum sürecinin portu býrakmamasýndan kaynaklanýr.
  echo.
  echo   listen EADDRINUSE: address already in use 127.0.0.1:!CHECK_PORT!
  echo.
  echo Portu tutan süreç: PID !PORT_HOLDER_PID!
  echo.
  echo Yapýlmasý gerekenler:
  echo   1. Hâlâ açýk bir kurulum penceresi varsa onu kullanýn veya kapatýn.
  echo   2. Aþaðýdaki komutla kalan kurulum sürecini durdurun:
  echo        taskkill /PID !PORT_HOLDER_PID! /F
  echo   3. kurulum.bat dosyasýný yeniden çalýþtýrýn.
  echo.
  echo Not: Kurulum verileri bu uyarý nedeniyle deðiþtirilmez.
  echo.
  choice /C DK /N /M "Kalan kurulum süreci þimdi durdurulsun mu? [D=durdur ve devam et / K=kapat]: "
  if errorlevel 2 goto :failed
  echo.
  echo PID !PORT_HOLDER_PID! durduruluyor...
  taskkill /PID !PORT_HOLDER_PID! /F >nul 2>&1
  if errorlevel 1 (
    echo [HATA] Süreç durdurulamadý. Elle deneyin: taskkill /PID !PORT_HOLDER_PID! /F
    goto :failed
  )
  ping -n 2 127.0.0.1 >nul
)

set "WIZARD_PORT=5050"
if defined SETUP_WIZARD_PORT set "WIZARD_PORT=%SETUP_WIZARD_PORT%"
set "WIZARD_PID="
for /f "delims=" %%P in ('node "scripts\find-port-holder.mjs" !WIZARD_PORT! 2^>nul') do set "WIZARD_PID=%%P"
if defined WIZARD_PID (
  echo.
  echo [UYARI] Sihirbaz portu zaten kullanilda: 127.0.0.1:!WIZARD_PORT!
  echo Onceki sihirbaz kalmis olabilir. Devam ederseniz 2. asamada
  echo "port zaten kullanilda" hatasi alabilirsiniz.
  echo Portu tutan surec: PID !WIZARD_PID!
  echo.
  choice /C DK /N /M "Sihirbaz portu simdi durdurulsun mu? [D=durdur ve devam / K=gec ve devam]: "
  if not errorlevel 2 (
    taskkill /PID !WIZARD_PID! /F >nul 2>&1
    ping -n 2 127.0.0.1 >nul
  )
)

echo.
echo [TAMAM] Gerekli çalýþma ortamý hazýr.
echo Grafik kurulum baþlangýcý açýlýyor...
echo.
call pnpm run setup %*
set "SETUP_EXIT=%ERRORLEVEL%"
if not "%SETUP_EXIT%"=="0" (
  echo.
  echo [HATA] Kurulum baþlangýcý %SETUP_EXIT% koduyla kapandý.
  echo.
  echo ------------------------------------------------------------
  echo Bu hata genellikle önceki kurulum penceresi kapatýldýðýnda
  echo arka planda kalan kurulum sürecinin neden olduðu port
  echo çakýþmasýndan kaynaklanýr:
  echo   listen EADDRINUSE: address already in use 127.0.0.1:!CHECK_PORT!
  echo.
  echo Yapýlmasý gerekenler:
  echo   1. Hâlâ açýk bir kurulum penceresi varsa onu kullanýn veya kapatýn.
  echo   2. Portu tutan süreci bulun:
  echo        node scripts\find-port-holder.mjs !CHECK_PORT!
  echo   3. Dönen PID deðeriyle süreci durdurun:
  echo        taskkill /PID ^<PID^> /F
  echo   4. kurulum.bat dosyasýný yeniden çalýþtýrýn.
  echo.
  echo Kurulum verileri bu hata nedeniyle deðiþtirilmez.
  echo ------------------------------------------------------------
  pause
)
popd
exit /b %SETUP_EXIT%

:requirements
echo.
echo ------------------------------------------------------------
echo Kurulmasý veya düzeltilmesi gereken bileþenler var.
echo.
echo Node.js 24 LTS indirme:
echo   https://nodejs.org/en/download
echo.
echo pnpm resmi kurulum belgesi:
echo   https://pnpm.io/installation/
echo.
echo pnpm 9.15.1 icin (sistem PATH'ini degistirmeden):
where npm >nul 2>&1 && echo   npm install --global pnpm@9.15.1
where corepack >nul 2>&1 && echo   corepack enable ^&^& corepack prepare pnpm@9.15.1 --activate
where npm >nul 2>&1 || where corepack >nul 2>&1 || echo   Bu Node.js kurulumunda npm ve corepack yok. npm iceren tam Node.js 22/24 LTS kurun veya pnpm bagimsiz kurulumunu kullanin: https://pnpm.io/installation
echo.
echo Yönetici yetkiniz yoksa kurum bilgi iþlem biriminden kurulum isteyin.
echo Proxy, DNS veya sistem PATH ayarlarý bu betik tarafýndan deðiþtirilmez.
echo Kurulumlardan sonra terminali kapatýp yeniden açýn ve kurulum.bat dosyasýný tekrar çalýþtýrýn.
echo ------------------------------------------------------------
echo.
choice /C EH /N /M "Resmi indirme sayfalarý açýlsýn mý? [E/H]: "
if errorlevel 2 goto :failed
start "" "https://nodejs.org/en/download"
start "" "https://pnpm.io/installation/"

:failed
echo.
echo Kurulum baþlatýlmadý; mevcut dosya ve veriler deðiþtirilmedi.
popd
pause
exit /b 1
