import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePmArgs } from './pm.mjs';

test('pm: install ve seçenekler', () => {
  assert.deepEqual(parsePmArgs(['install']), { pm: undefined, op: { type: 'install', args: [] } });
  assert.deepEqual(parsePmArgs(['--pm', 'bun', 'install', '--no-frozen', '--no-dev']), { pm: 'bun', op: { type: 'install', frozen: false, dev: false, args: [] } });
});

test('pm: run çalışma alanı, betik ve -- sonrası argümanlar', () => {
  assert.deepEqual(parsePmArgs(['run', '--workspace', 'server', 'db:deploy']).op, { type: 'run', workspace: 'server', script: 'db:deploy', args: [] });
  assert.deepEqual(parsePmArgs(['run', '-w', 'client', 'build', '--', '--mode', 'x y']).op, { type: 'run', workspace: 'client', script: 'build', args: ['--mode', 'x y'] });
});

test('pm: geçersiz komut ve bilinmeyen seçenek reddedilir', () => {
  assert.throws(() => parsePmArgs([]), /Kullanım/);
  assert.throws(() => parsePmArgs(['publish']), /Kullanım/);
  assert.throws(() => parsePmArgs(['run', '--yok', 'x']), /Bilinmeyen seçenek/);
});
