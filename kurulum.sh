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

printf '\n%s\n\n' '[TAMAM] Gerekli çalışma ortamı hazır. Grafik kurulum başlangıcı açılıyor...'
exec pnpm setup
