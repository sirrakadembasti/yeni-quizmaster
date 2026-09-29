#!/usr/bin/env sh
set -u

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$PROJECT_ROOT" || exit 1

printf '\n%s\n' '============================================================'
printf '%s\n' '  QuizMaster Kurulum Ön Kontrolü'
printf '%s\n' '============================================================'
printf 'Proje dizini: %s\n\n' "$PROJECT_ROOT"

if [ ! -f package.json ] || ! grep -q '"name"[[:space:]]*:[[:space:]]*"quiz-master"' package.json; then
  printf '%s\n' '[HATA] Bu dizin geçerli QuizMaster proje kökü değil.' >&2
  exit 1
fi

has_error=0
if command -v node >/dev/null 2>&1; then
  node_version=$(node -p 'process.versions.node' 2>/dev/null || true)
  node_major=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)
  case "$node_major" in
    22|24) printf '[TAMAM] Node.js %s\n' "$node_version" ;;
    *) printf '[UYUMSUZ] Node.js %s bulundu. Node.js 22 veya 24 LTS gereklidir.\n' "$node_version"; has_error=1 ;;
  esac
else
  printf '%s\n' '[EKSİK] Node.js bulunamadı.'
  has_error=1
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm_version=$(pnpm --version 2>/dev/null || true)
  if [ "$pnpm_version" = "9.15.1" ]; then
    printf '[TAMAM] pnpm %s\n' "$pnpm_version"
  else
    printf '[UYUMSUZ] pnpm %s bulundu. Gerekli sürüm: 9.15.1\n' "$pnpm_version"
    has_error=1
  fi
else
  printf '%s\n' '[EKSİK] pnpm bulunamadı. Gerekli sürüm: 9.15.1'
  has_error=1
fi

if [ "$has_error" -ne 0 ]; then
  cat <<'EOF'

Kurulması veya düzeltilmesi gereken bileşenler var.

Node.js 24 LTS: https://nodejs.org/en/download
pnpm belgesi:   https://pnpm.io/installation/
Node.js kuruluysa: npm install --global pnpm@9.15.1

Proxy, DNS veya sistem PATH ayarları bu betik tarafından değiştirilmez.
Kurulumlardan sonra yeni bir terminal açıp ./kurulum.sh komutunu tekrar çalıştırın.
EOF
  exit 1
fi

CHECK_PORT="${SETUP_BOOTSTRAP_PORT:-5049}"
WIZARD_PORT="${SETUP_WIZARD_PORT:-5050}"
HOLDER_PID=""
if HOLDER_PID=$(node "scripts/find-port-holder.mjs" "$CHECK_PORT" 2>/dev/null); then
  :
else
  HOLDER_PID=""
fi

if [ -n "$HOLDER_PID" ]; then
  cat <<EOF

[UYARI] Kurulum başlangıç portu zaten kullanımda: 127.0.0.1:$CHECK_PORT

Bu durum, önceki kurulum penceresi veya kurulum.sh kapatıldığında
arka planda kalan kurulum sürecinin portu bırakmamasından kaynaklanır.

  listen EADDRINUSE: address already in use 127.0.0.1:$CHECK_PORT

Portu tutan süreç: PID $HOLDER_PID

Yapılması gerekenler:
  1. Hâlâ açık bir kurulum penceresi varsa onu kullanın veya kapatın.
  2. Kalan kurulum sürecini durdurun: kill $HOLDER_PID
  3. ./kurulum.sh dosyasını yeniden çalıştırın.

Not: Kurulum verileri bu uyarı nedeniyle değiştirilmez.
EOF
  printf '%s' "Kalan kurulum süreci şimdi durdurulsun mu? [E/H]: "
  read -r answer || answer="H"
  case "$answer" in
    [EeYy]*)
      kill "$HOLDER_PID" 2>/dev/null || true
      sleep 1
      ;;
    *)
      echo "Kurulum iptal edildi; mevcut dosya ve veriler değiştirilmedi."
      exit 1
      ;;
  esac
fi

WIZARD_HOLDER=""
if WIZARD_HOLDER=$(node "scripts/find-port-holder.mjs" "$WIZARD_PORT" 2>/dev/null); then
  :
else
  WIZARD_HOLDER=""
fi

if [ -n "$WIZARD_HOLDER" ]; then
  cat <<EOF

[UYARI] Sihirbaz portu zaten kullanımda: 127.0.0.1:$WIZARD_PORT

Önceki kurulum sihirbazı kalmış olabilir (2. aşama). Devam ederseniz
sihirbaz açılmadan "port zaten kullanımda" hatası alabilirsiniz.

Portu tutan süreç: PID $WIZARD_HOLDER
Durdurmak için: kill $WIZARD_HOLDER

Not: Kurulum verileri bu uyarı nedeniyle değiştirilmez.
EOF
  printf '%s' "Sihirbaz portunu tutan süreç şimdi durdurulsun mu? [E/H]: "
  read -r answer || answer="H"
  case "$answer" in
    [EeYy]*)
      kill "$WIZARD_HOLDER" 2>/dev/null || true
      sleep 1
      ;;
    *)
      echo "Devam edildi; sihirbaza geçince yeniden uyarılırsınız."
      ;;
  esac
fi

printf '\n%s\n\n' '[TAMAM] Gerekli çalışma ortamı hazır. Grafik kurulum başlangıcı açılıyor...'
printf '%s\n' 'Bu terminali sihirbaz bitene kadar KAPATMAYIN; sihirbaz bu sürecin altındadır.'
printf '%s\n' 'Portlar: başlatıcı '"$CHECK_PORT"' · sihirbaz '"$WIZARD_PORT"
printf '\n'
pnpm run setup
setup_exit=$?
if [ "$setup_exit" -ne 0 ]; then
  cat <<EOF

[HATA] Kurulum başlangıcı $setup_exit koduyla kapandı.

Bu hata genellikle önceki kurulum penceresi kapatıldığında arka planda
kalan kurulum sürecinin neden olduğu port çakışmasından kaynaklanır:
  listen EADDRINUSE: address already in use 127.0.0.1:$CHECK_PORT

Yapılması gerekenler:
  1. Hâlâ açık bir kurulum penceresi varsa onu kullanın veya kapatın.
  2. Portu tutan süreci bulun:
       node scripts/find-port-holder.mjs $CHECK_PORT
  3. Dönen PID ile süreci durdurun: kill <PID>
  4. ./kurulum.sh dosyasını yeniden çalıştırın.

Kurulum verileri bu hata nedeniyle değiştirilmez.

Not: Sihirbaz 5050, kurulum başlatıcısı $CHECK_PORT portunu kullanır.
Uygulama zaten kuruluysa (installation.lock) sihirbaz kapalı kalır;
temiz kurulum için başlatıcıdaki "Yedekle ve Temiz Kuruluma Geç" adımını kullanın.
EOF
  exit "$setup_exit"
fi
exit 0
