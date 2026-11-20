import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// S-08: seed tüm iş verisini siler; üretimde ya da kurulu (installation.lock) bir örnekte çalışmamalı.
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsx = path.join(repository, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const seed = path.join(repository, 'server', 'prisma', 'seed.ts');

function makeRoot({ lock }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-seed-guard-'));
  assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
  fs.mkdirSync(path.join(root, 'server', 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'client'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server', 'package.json'), '{}');
  fs.writeFileSync(path.join(root, 'client', 'package.json'), '{}');
  const db = path.join(root, 'server', 'data', 'quiz.db');
  fs.writeFileSync(db, 'sentinel-not-a-real-database');
  if (lock) fs.writeFileSync(path.join(root, 'server', 'data', 'installation.lock'), 'locked');
  return { root, db };
}
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function runSeed(root, db, env) {
  return spawnSync(process.execPath, [tsx, seed], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, DATABASE_URL: `file:${db}`, QUIZMASTER_ALLOW_SEED: '', NODE_ENV: 'development', ...env },
  });
}

for (const [name, lock, env] of [
  ['kilit dosyası varsa seed reddedilir', true, {}],
  ['NODE_ENV=production iken seed reddedilir', false, { NODE_ENV: 'production' }],
]) {
  test(name, { timeout: 150000 }, t => {
    const { root, db } = makeRoot({ lock });
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const before = digest(db);
    const result = runSeed(root, db, env);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /QUIZMASTER_ALLOW_SEED/);
    assert.equal(digest(db), before, 'veritabanı dosyası değişmemeli');
  });
}
