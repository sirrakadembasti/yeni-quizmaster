import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { createRequire } from 'node:module';
import { createApplicationBackup, restoreApplicationBackup } from './maintenance-lib.mjs';
import { createVerifiedBackup } from './setup-bootstrap-lib.mjs';
const SQLite = createRequire(new URL('../server/package.json', import.meta.url))('better-sqlite3');

test('maintenance and upgrade backups preserve the AI decryption key with its DB', async t => {
  const owned = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-ai-backup-'));
  t.after(() => {
    const resolved = fs.realpathSync(owned);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('quizmaster-ai-backup-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const source = path.join(owned, 'source'), data = path.join(source, 'server/data');
  fs.mkdirSync(data, { recursive: true });
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  fs.writeFileSync(path.join(source, 'server/.env'), `HOST=127.0.0.1\nPORT=${port}\nDATABASE_URL=file:../data/quiz.db\n`);
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update('synthetic-provider-key'), cipher.final()]);
  fs.writeFileSync(path.join(data, 'ai-encryption.key'), key);
  const db = new SQLite(path.join(data, 'quiz.db'));
  const envelope = ['v1', iv.toString('base64'), encrypted.toString('base64'), cipher.getAuthTag().toString('base64')].join('.');
  db.exec('CREATE TABLE AIProfile (id TEXT PRIMARY KEY, encryptedApiKey TEXT)');
  db.prepare('INSERT INTO AIProfile VALUES (?, ?)').run('profile', envelope); db.close();
  const upgrade = createVerifiedBackup(source, 'before-upgrade');
  assert.deepEqual(fs.readFileSync(path.join(upgrade.backupRoot, 'server/data/ai-encryption.key')), key);
  const backup = await createApplicationBackup(source, { name: 'ai' });
  const restored = path.join(owned, 'restored');
  await restoreApplicationBackup(backup.backupRoot, restored);
  const restoredKey = fs.readFileSync(path.join(restored, 'server/data/ai-encryption.key'));
  assert.deepEqual(restoredKey, key);
  const recovered = new SQLite(path.join(restored, 'server/data/quiz.db'), { readonly: true });
  const row = recovered.prepare('SELECT encryptedApiKey FROM AIProfile').get(); recovered.close();
  const decipher = crypto.createDecipheriv('aes-256-gcm', restoredKey, iv);
  decipher.setAuthTag(cipher.getAuthTag());
  assert.equal(Buffer.concat([decipher.update(Buffer.from(row.encryptedApiKey.split('.')[2], 'base64')), decipher.final()]).toString(), 'synthetic-provider-key');
  fs.unlinkSync(path.join(data, 'ai-encryption.key'));
  await assert.rejects(createApplicationBackup(source, { name: 'missing-key' }), /AI.*key/i);
  fs.writeFileSync(path.join(data, 'ai-encryption.key'), crypto.randomBytes(32));
  await assert.rejects(createApplicationBackup(source, { name: 'wrong-key' }), /AI.*key/i);

  // A self-consistent manifest with an incompatible key must still fail restore.
  const keyFile = path.join(backup.backupRoot, 'server/data/ai-encryption.key');
  const badKey = crypto.randomBytes(32); fs.writeFileSync(keyFile, badKey);
  const manifestPath = path.join(backup.backupRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.files.find(file => file.backup === 'server/data/ai-encryption.key').sha256 = crypto.createHash('sha256').update(badKey).digest('hex');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  await assert.rejects(restoreApplicationBackup(backup.backupRoot, path.join(owned, 'wrong-restore')), /AI.*key/i);
});
