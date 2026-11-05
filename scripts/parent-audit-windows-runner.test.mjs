import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import test from 'node:test';

test('occupied fixture port refuses startup without touching data or terminating the holder',
  { skip: process.platform !== 'win32', timeout: 30000 }, async t => {
    const root = path.resolve(import.meta.dirname, '..');
    const database = path.join(root, 'server/data/quiz.db');
    const hash = () => fs.existsSync(database) ? crypto.createHash('sha256').update(fs.readFileSync(database)).digest('hex') : null;
    const before = hash();
    const holder = net.createServer();
    await new Promise((resolve, reject) => { holder.once('error', reject); holder.listen(5560, '127.0.0.1', resolve); });
    t.after(() => new Promise(resolve => holder.close(resolve)));
    const child = spawn(process.execPath, [path.join(root, 'scripts/parent-audit-windows-runner.mjs')], {
      cwd: root, windowsHide: true, env: { ...process.env, PARENT_AUDIT_RUN: 'windows-port-guard' }, stdio: 'ignore',
    });
    const exit = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    assert.equal(exit, 1);
    const report = JSON.parse(fs.readFileSync(path.join(root, 'tests/denetim-kanitlari/veli/runner-windows-port-guard.json')));
    assert.deepEqual(report.cleanup, []);
    assert.equal(report.cleanupSucceeded, false);
    assert.equal(report.status, 'cleanup-failed');
    assert.equal(holder.listening, true);
    assert.equal(hash(), before);
  });
