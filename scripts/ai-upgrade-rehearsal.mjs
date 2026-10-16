// Synthetic upgrade acceptance only. Never accepts a live database path.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const repo = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(repo, 'server/package.json'));
const SQLite = require('better-sqlite3');
const root = fs.mkdtempSync(path.join(repo, 'server/data/quizmaster-test-ai-upgrade-'));
const server = path.join(root, 'server'), data = path.join(server, 'data');
fs.mkdirSync(data, { recursive: true });
fs.cpSync(path.join(repo, 'server/prisma'), path.join(server, 'prisma'), { recursive: true });
const file = path.join(data, 'quiz.db');
const db = new SQLite(file);
// Match the installed database's last applied release (14 migrations).
const baselineLast = '20260930120000_nullable_survey_answers';
const pending = fs.readdirSync(path.join(server, 'prisma/migrations')).sort()
  .filter(name => name > baselineLast && fs.existsSync(path.join(server, 'prisma/migrations', name, 'migration.sql')));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const baseline = [];
try {
  // Only disposable fixture creation uses MEMORY/OFF; runtime settings are unchanged.
  db.pragma('journal_mode=MEMORY'); db.pragma('synchronous=OFF');
  db.exec('CREATE TABLE "_prisma_migrations" ("id" TEXT NOT NULL PRIMARY KEY,"checksum" TEXT NOT NULL,"finished_at" DATETIME,"migration_name" TEXT NOT NULL,"logs" TEXT,"rolled_back_at" DATETIME,"started_at" DATETIME NOT NULL DEFAULT current_timestamp,"applied_steps_count" INTEGER NOT NULL DEFAULT 0)');
  for (const name of fs.readdirSync(path.join(server, 'prisma/migrations')).sort()) {
    const sqlPath = path.join(server, 'prisma/migrations', name, 'migration.sql');
    if (!fs.existsSync(sqlPath) || pending.includes(name)) continue;
    const sql = fs.readFileSync(sqlPath, 'utf8'); db.exec(sql);
    db.prepare('INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,applied_steps_count) VALUES (?,?,?,?,1)').run(crypto.randomUUID(), hash(sql), Date.now(), name);
    baseline.push(name);
  }
  db.prepare('INSERT INTO User (id,name,email,password,role,createdAt,isActive) VALUES (?,?,?,?,?,?,?)').run('synthetic-admin', 'Sentetik yönetici', 'admin@example.invalid', 'synthetic-not-login-hash', 'admin', 1700000000000, 1);
  db.prepare('INSERT INTO Quiz (id,title,createdBy) VALUES (?,?,?)').run('synthetic-quiz','Sentetik tarih sınavı','synthetic-admin');
  db.prepare('INSERT INTO Question (id,quizId,text,type,options,correctAnswer,"order") VALUES (?,?,?,?,?,?,?)').run('synthetic-question','synthetic-quiz','Sentetik soru','multiple-choice','["Bir","İki"]','Bir',0);
  db.prepare('INSERT INTO StudentResult (id,studentId,quizId,status,score,answers) VALUES (?,?,?,?,?,?)').run('synthetic-result','synthetic-admin','synthetic-quiz','completed',100,'{"synthetic-question":"Bir"}');
  db.pragma('journal_mode=DELETE'); db.pragma('synchronous=FULL');
} finally { db.close(); }
const original = new SQLite(file, { readonly: true });
const before = original.prepare('SELECT id,name,email,password,role,createdAt,isActive FROM User ORDER BY id').all(); original.close();
const env = { ...process.env, DATABASE_URL: 'file:' + file.replaceAll('\\', '/'), CHECKPOINT_DISABLE: '1' };
const logs = [];
for (const args of [['migrate', 'deploy'], ['migrate', 'status']]) {
  const log = path.join(root, args[1] + '.log');
  const output = fs.openSync(log, 'wx', 0o600);
  const child = spawn(process.execPath, [require.resolve('prisma/build/index.js'), ...args, '--schema', path.join(server, 'prisma/schema.prisma')], { cwd: server, env, windowsHide: true, stdio: ['ignore', output, output] });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  fs.closeSync(output); assert.equal(code, 0, `Prisma ${args[1]} failed; private log ${log}`); logs.push(log);
}
const upgraded = new SQLite(file, { readonly: true });
try {
  assert.deepEqual(upgraded.prepare('SELECT id,name,email,password,role,createdAt,isActive FROM User ORDER BY id').all(), before);
  assert.equal(upgraded.prepare('SELECT notificationRevision FROM User').get().notificationRevision, 0);
  assert.equal(upgraded.prepare('SELECT COUNT(*) AS n FROM AIProfile').get().n, 0);
  assert.equal(upgraded.prepare("SELECT score FROM StudentResult WHERE id='synthetic-result'").get().score,100);
  assert.equal(upgraded.prepare("SELECT correctAnswer FROM Question WHERE id='synthetic-question'").get().correctAnswer,'Bir');
  assert.equal(upgraded.prepare("SELECT revision FROM AIConfiguration WHERE id='singleton'").get().revision, 0);
  assert.equal(upgraded.pragma('integrity_check', { simple: true }), 'ok');
  assert.deepEqual(upgraded.pragma('foreign_key_check'), []);
  for (const name of pending) assert.equal(upgraded.prepare('SELECT COUNT(*) AS n FROM _prisma_migrations WHERE migration_name=? AND finished_at IS NOT NULL').get(name).n, 1);
} finally { upgraded.close(); }
const result = { passed: true, baselineMigrations: baseline.length, addedMigrations: pending, preservedSyntheticUser: true, integrity: 'ok', foreignKeyViolations: 0, root };
fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify(result));
