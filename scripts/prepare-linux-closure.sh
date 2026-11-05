#!/usr/bin/env sh
# Disposable native tooling only; no system PATH or application data changes.
set -eu
closure_base="${XDG_CACHE_HOME:-$HOME/.cache}/quizmaster-closure"
mkdir -p "$closure_base/tmp"
tool_root=$(mktemp -d "$closure_base/tools-XXXXXX")
printf 'Linux tooling: %s\n' "$tool_root"
cd "$tool_root"
node_version=22.23.2
archive="node-v${node_version}-linux-x64.tar.xz"
curl --fail --location --retry 2 --max-time 180 --output "$archive" "https://nodejs.org/dist/v${node_version}/${archive}"
curl --fail --location --retry 2 --max-time 30 --output SHASUMS256.txt "https://nodejs.org/dist/v${node_version}/SHASUMS256.txt"
grep " ${archive}$" SHASUMS256.txt > selected-shasum.txt
sha256sum --check selected-shasum.txt
tar -xf "$archive"
PATH="$tool_root/node-v${node_version}-linux-x64/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH
npm install --prefix "$tool_root/pnpm" pnpm@9.15.1 --no-audit --no-fund
PATH="$tool_root/pnpm/node_modules/.bin:$PATH"
export PATH
stage_root=$(mktemp -d "$closure_base/source-XXXXXX")
tar -xf /mnt/f/projeler/yeni-quizmaster-main/docs/admin-audit/test-results-latest/linux-setup/source-head.tar -C "$stage_root"
# Include the user's current reviewed localhost edits without committing them.
cp /mnt/f/projeler/yeni-quizmaster-main/client/src/lib/api.ts "$stage_root/client/src/lib/api.ts"
cp /mnt/f/projeler/yeni-quizmaster-main/client/src/pages/server-setup.tsx "$stage_root/client/src/pages/server-setup.tsx"
for script in admin-hybrid-setup-closure.mjs linux-owned-process-cleanup.mjs linux-owned-process-cleanup.test.mjs; do
  cp "/mnt/f/projeler/yeni-quizmaster-main/scripts/$script" "$stage_root/scripts/$script"
done
cd "$stage_root"
git init -q
git add .
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
printf '\nLINUX_TOOL_ROOT=%s\nLINUX_STAGE_ROOT=%s\n' "$tool_root" "$stage_root"
node -p 'JSON.stringify({platform:process.platform,node:process.version,arch:process.arch})'
pnpm --version
