@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
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
  echo [HATA] package.json bulunamadı. Bu dosyayı QuizMaster ana dizininden çalıştırın.
  goto :failed
)

findstr /C:"quiz-master" "package.json" >nul
if errorlevel 1 (
  echo [HATA] Bu dizin geçerli QuizMaster proje kökü olarak doğrulanamadı.
  goto :failed
)

set "HAS_ERROR=0"
set "NODE_VERSION="
set "NODE_MAJOR="
where node >nul 2>&1
if errorlevel 1 (
  echo [EKSİK] Node.js bulunamadı.
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
  echo [EKSİK] pnpm bulunamadı. Gerekli sürüm: 9.15.1
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

echo.
echo [TAMAM] Gerekli çalışma ortamı hazır.
echo Grafik kurulum başlangıcı açılıyor...
echo.
call pnpm setup
set "SETUP_EXIT=%ERRORLEVEL%"
if not "%SETUP_EXIT%"=="0" (
  echo.
  echo [HATA] Kurulum başlangıcı %SETUP_EXIT% koduyla kapandı.
  pause
)
popd
exit /b %SETUP_EXIT%

:requirements
echo.
echo ------------------------------------------------------------
echo Kurulması veya düzeltilmesi gereken bileşenler var.
echo.
echo Node.js 24 LTS indirme:
echo   https://nodejs.org/en/download
echo.
echo pnpm resmi kurulum belgesi:
echo   https://pnpm.io/installation/
echo.
echo Node.js kuruluysa pnpm 9.15.1 için:
echo   npm install --global pnpm@9.15.1
echo.
echo Yönetici yetkiniz yoksa kurum bilgi işlem biriminden kurulum isteyin.
echo Proxy, DNS veya sistem PATH ayarları bu betik tarafından değiştirilmez.
echo Kurulumlardan sonra terminali kapatıp yeniden açın ve kurulum.bat dosyasını tekrar çalıştırın.
echo ------------------------------------------------------------
echo.
choice /C EH /N /M "Resmi indirme sayfaları açılsın mı? [E/H]: "
if errorlevel 2 goto :failed
start "" "https://nodejs.org/en/download"
start "" "https://pnpm.io/installation/"

:failed
echo.
echo Kurulum başlatılmadı; mevcut dosya ve veriler değiştirilmedi.
popd
pause
exit /b 1
