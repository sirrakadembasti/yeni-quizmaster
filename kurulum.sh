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

# Paket yöneticisi: npm 11+ (varsayılan) veya Bun (deneysel). Biri yeterlidir.
pm_ok=0
if command -v npm >/dev/null 2>&1; then
  npm_version=$(npm --version 2>/dev/null || true)
  npm_major=${npm_version%%.*}
  case "$npm_major" in
    ''|*[!0-9]*) printf '%s\n' '[UYARI] npm sürümü okunamadı.' ;;
    *)
      if [ "$npm_major" -ge 11 ]; then
        printf '[TAMAM] npm %s\n' "$npm_version"
        pm_ok=1
      else
        printf '[UYUMSUZ] npm %s bulundu. npm 11 veya üstü gereklidir (Node.js 22 ile gelen npm 10 desteklenmez).\n' "$npm_version"
      fi
      ;;
  esac
else
  printf '%s\n' '[EKSİK] npm bulunamadı. npm 11 veya üstü önerilir.'
fi
if command -v bun >/dev/null 2>&1; then
  printf '[TAMAM] Bun %s (deneysel)\n' "$(bun --version 2>/dev/null || true)"
  pm_ok=1
fi
if [ "$pm_ok" -eq 0 ]; then
  printf '%s\n' '[EKSİK] Desteklenen paket yöneticisi bulunamadı (npm 11+ veya Bun).'
  has_error=1
fi

case "$(uname -s 2>/dev/null || echo bilinmiyor)" in
  Linux|Darwin) ;;
  *) printf '[UYARI] Desteklenen sistemler Linux ve macOS; algılanan: %s\n' "$(uname -s 2>/dev/null || echo bilinmiyor)" ;;
esac

if [ "$(id -u 2>/dev/null || echo 1)" = "0" ]; then
  printf '%s\n' '[UYARI] Kurulum root olarak çalışıyor. Uygulamayı ayrı, yetkisiz bir hizmet kullanıcısıyla kurmanız önerilir.'
fi

# Kurulum verilerine dokunulmaz: yalnız var olan dizinlerin yazılabilirliği denetlenir.
for writable_dir in "$PROJECT_ROOT" "$PROJECT_ROOT/server/data"; do
  if [ -d "$writable_dir" ] && [ ! -w "$writable_dir" ]; then
    printf '[HATA] Yazma izni yok: %s\n' "$writable_dir"
    has_error=1
  fi
done

free_kb=$(df -Pk "$PROJECT_ROOT" 2>/dev/null | awk 'NR==2 {print $4}')
case "$free_kb" in
  ''|*[!0-9]*) ;;
  *)
    if [ "$free_kb" -lt 3145728 ]; then
      printf '[UYARI] Boş disk alanı %s MB; paket kurulumu ve derleme için en az 3072 MB önerilir.\n' "$((free_kb / 1024))"
    fi
    ;;
esac

if ! command -v python3 >/dev/null 2>&1 || ! command -v make >/dev/null 2>&1 || { ! command -v g++ >/dev/null 2>&1 && ! command -v c++ >/dev/null 2>&1; }; then
  printf '%s\n' '[UYARI] python3, make veya C++ derleyicisi bulunamadı. better-sqlite3 için hazır ikili indirilemezse'
  printf '%s\n' '        yerel derleme başarısız olabilir (Debian/Ubuntu: apt install build-essential python3).'
fi

if [ "$has_error" -ne 0 ]; then
  cat <<'EOF'

Kurulması veya düzeltilmesi gereken bileşenler var.

Node.js 24 LTS (npm 11 ile gelir): https://nodejs.org/en/download
npm belgesi: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm
Node.js 22 ile gelen npm 10 desteklenmez; npm 11'e yükseltmek için:
EOF
  if command -v npm >/dev/null 2>&1; then
    printf '%s\n' '  npm install --global npm@11'
    printf '%s\n' '  (yetki yoksa) npm install --prefix "$HOME/.local/npm" npm@11 ve $HOME/.local/npm/node_modules/.bin dizinini bu oturumun PATH değerine ekleyin'
  fi
  if ! command -v npm >/dev/null 2>&1; then
    printf '%s\n' '  Bu Node.js kurulumunda npm yok. npm içeren tam Node.js 22/24 LTS kurun (Node.js 24 npm 11 ile gelir).'
  fi
  cat <<'EOF'

Proxy, DNS veya sistem PATH ayarları bu betik tarafından değiştirilmez.
Kurulumlardan sonra yeni bir terminal açıp ./kurulum.sh komutunu tekrar çalıştırın.
EOF
  exit 1
fi

CHECK_PORT="${SETUP_BOOTSTRAP_PORT:-5049}"
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

printf '\n%s\n\n' '[TAMAM] Gerekli çalışma ortamı hazır. Grafik kurulum başlangıcı açılıyor...'
printf '%s\n' 'Bu terminali sihirbaz bitene kadar KAPATMAYIN; sihirbaz bu sürecin altındadır.'
printf '%s\n' 'Adres: http://127.0.0.1:'"$CHECK_PORT"' (sihirbaz da aynı adreste açılır)'
printf '%s\n' 'Bitişte "Uygulamayı başlat" → yerelde geliştirme sunucusu (arka plan), kurumda üretim servisi.'
printf '%s\n' 'Yerel giriş: http://127.0.0.1:5173/auth'
printf '\n'
# Bağımlılıksız başlatıcı doğrudan Node ile açılır; paket yöneticisi paketleri kurarken seçilir.
node scripts/setup-bootstrap.mjs "$@"
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

Not: Başlatıcı ve sihirbaz tek adreste, $CHECK_PORT portunda çalışır.
Uygulama zaten kuruluysa (installation.lock) sihirbaz kapalı kalır;
temiz kurulum için başlatıcıdaki "Yedekle ve Temiz Kuruluma Geç" adımını kullanın.
EOF
  exit "$setup_exit"
fi
exit 0
