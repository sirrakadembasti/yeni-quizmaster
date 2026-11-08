#!/usr/bin/env node
// Paket yöneticisinden bağımsız çalıştırıcı: node scripts/pm.mjs [--pm npm|pnpm|bun] <komut>
//   install [--no-frozen] [--no-dev]
//   run [--workspace server|client] <betik> [-- argümanlar…]
//   exec [--workspace server|client] <bin> [-- argümanlar…]   (npm için desteklenmez)
// Yönetici: --pm > QUIZMASTER_PM > varsayılan. Çıkış kodu alt sürecinki kadardır.
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInvocation, selectManager } from './package-manager.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parsePmArgs(argv) {
  const out = { pm: undefined, op: null };
  const rest = [...argv];
  while (rest[0] === '--pm') { rest.shift(); out.pm = rest.shift(); }
  const type = rest.shift();
  if (!['install', 'run', 'exec'].includes(type)) throw new Error('Kullanım: node scripts/pm.mjs [--pm yönetici] install|run|exec …');
  const op = { type };
  const dashdash = rest.indexOf('--');
  const head = dashdash === -1 ? rest : rest.slice(0, dashdash);
  const tail = dashdash === -1 ? [] : rest.slice(dashdash + 1);
  const positional = [];
  for (let i = 0; i < head.length; i += 1) {
    const arg = head[i];
    if (arg === '--workspace' || arg === '-w') op.workspace = head[++i];
    else if (arg === '--no-frozen') op.frozen = false;
    else if (arg === '--no-dev') op.dev = false;
    else if (arg.startsWith('-')) throw new Error(`Bilinmeyen seçenek: ${arg}`);
    else positional.push(arg);
  }
  if (type === 'run') op.script = positional.shift();
  if (type === 'exec') op.bin = positional.shift();
  // '--' öncesindeki fazla konumsal değerler de betiğe iletilir.
  op.args = [...positional, ...tail];
  return { pm: out.pm, op };
}

export function runPm(argv, { env = process.env, stdio = 'inherit' } = {}) {
  const { pm, op } = parsePmArgs(argv);
  const manager = selectManager({ requested: pm, env });
  const invocation = createInvocation(manager, op, { root, env });
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, { cwd: invocation.cwd, env: invocation.env, stdio, shell: false, windowsHide: true });
    child.on('error', reject);
    child.on('close', code => resolve(code ?? 1));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPm(process.argv.slice(2)).then(code => process.exit(code), error => { console.error(error.message); process.exit(1); });
}
