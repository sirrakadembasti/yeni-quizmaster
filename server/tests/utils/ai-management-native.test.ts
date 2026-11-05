import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createRuntimePrismaClient } from '../../utils/sqlite-runtime';
import { createManagedAIStore } from '../../services/ai-management-instance';
const require = createRequire(import.meta.url);
it('applies full migration history and preserves managed profiles through native runtime restart', async () => {
  const root = fs.mkdtempSync(path.resolve('data/quizmaster-test-ai-native-'));
  const databaseUrl = 'file:' + path.join(root, 'quiz.db').replaceAll('\\', '/');
  fs.writeFileSync(path.join(root, 'quiz.db'), '');
  let db: ReturnType<typeof createRuntimePrismaClient> | undefined;
  try {
    const SQLite = require('better-sqlite3');
    const migrationDb = new SQLite(path.join(root, 'quiz.db'));
    // Fixture creation is disposable; runtime reconnect below restores WAL/FULL.
    migrationDb.pragma('journal_mode = MEMORY'); migrationDb.pragma('synchronous = OFF');
    try {
      for (const directory of fs.readdirSync('prisma/migrations').sort()) {
        const sql = path.join('prisma/migrations', directory, 'migration.sql');
        if (fs.existsSync(sql)) migrationDb.exec(fs.readFileSync(sql, 'utf8'));
      }
    } finally { migrationDb.close(); }
    db = createRuntimePrismaClient({ databaseUrl });
    let store = createManagedAIStore(db, path.join(root, 'ai-encryption.key'));
    const p = await store.save({ name: 'Okul', provider: 'google', model: 'fixture-model', baseURL: 'https://generativelanguage.googleapis.com/v1beta', apiKey: 'synthetic-only' });
    await store.recordTest(p.id, p.revision, 'quick', 'passed', { durationMs: 1 });
    const enabled = await store.setEnabled(p.id, p.revision, true);
    await store.setDefault(p.id, (await store.list()).settingsRevision, enabled.revision);
    await db.$disconnect();
    db = createRuntimePrismaClient({ databaseUrl });
    store = createManagedAIStore(db, path.join(root, 'ai-encryption.key'));
    expect((await store.getEnabled(p.id))?.apiKey).toBe('synthetic-only');
    expect((await store.list()).defaultProfileId).toBe(p.id);
    expect(JSON.stringify(await store.list())).not.toContain('synthetic-only');
    expect(await db.$queryRawUnsafe('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    expect(await db.$queryRawUnsafe('PRAGMA foreign_key_check')).toEqual([]);
  } finally {
    await db?.$disconnect();
    if (path.dirname(root) !== path.resolve('data') || !path.basename(root).startsWith('quizmaster-test-ai-native-')) throw new Error('Unsafe fixture cleanup');
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 60000);
