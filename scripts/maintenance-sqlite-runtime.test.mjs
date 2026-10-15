import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as maintenance from './maintenance-lib.mjs';
const req = createRequire(new URL('../server/package.json', import.meta.url));
const legacy = createRequire(req.resolve('connect-sqlite3'))('sqlite3');

test('maintenance snapshots use a patched SQLite runtime and preserve the source', async t => {
  const root = mkdtempSync(path.join(tmpdir(), 'quizmaster-maintenance-version-'));
  t.after(() => {
    const absolute = path.resolve(root);
    assert.equal(path.dirname(absolute), path.resolve(tmpdir()));
    assert.ok(path.basename(absolute).startsWith('quizmaster-maintenance-version-'));
    rmSync(absolute, { recursive: true, force: true });
  });
  const file = path.join(root, 'probe.db'), db = new legacy.Database(file);
  await new Promise((resolve, reject) => db.exec('CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES("preserved");', e => e ? reject(e) : resolve()));
  await new Promise((resolve, reject) => db.close(e => e ? reject(e) : resolve()));
  assert.equal(typeof maintenance.getMaintenanceSQLiteVersion, 'function');
  assert.equal(await maintenance.getMaintenanceSQLiteVersion(file), '3.51.3');
});
