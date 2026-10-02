// Unit only: actual metadata helpers with controlled process-query results; no process is killed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('./admin-hybrid-setup-closure.mjs', import.meta.url), 'utf8');
const helper = name => source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0];
function actual(env = {}, result = { status: 0, stdout: '[]' }) {
  const definitions = ['windowsMetadataExecutable', 'windowsProcessSnapshot', 'creationTime'].map(name => {
    assert.ok(helper(name), `Actual helper missing: ${name}`);
    return helper(name);
  }).join('\n');
  const calls = [];
  const context = { path: path.win32, process: { env }, spawnSync: (...args) => { calls.push(args); return result; } };
  const api = vm.runInNewContext(`${definitions}\n({windowsMetadataExecutable,windowsProcessSnapshot,creationTime})`, context);
  return { ...api, calls };
}

test('optional absolute interpreter selects exact executable with unchanged default and bounded shell-free query', () => {
  const defaults = actual();
  assert.equal(defaults.windowsMetadataExecutable(), 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  const selected = actual({ HYBRID_POWERSHELL: 'C:\\controlled\\pwsh.exe' });
  assert.equal(selected.windowsMetadataExecutable(), 'C:\\controlled\\pwsh.exe');
  assert.equal(selected.windowsProcessSnapshot(15000).length, 0);
  assert.equal(selected.calls[0][0], 'C:\\controlled\\pwsh.exe');
  assert.equal(selected.calls[0][2].timeout, 10000);
  assert.equal(selected.calls[0][2].shell, false);
  const relative = actual({ HYBRID_POWERSHELL: 'pwsh.exe' });
  assert.equal(relative.windowsProcessSnapshot(), null);
  assert.equal(relative.calls.length, 0);
});

test('invalid or unavailable metadata fails closed while PS5 and ISO creation dates remain valid', () => {
  for (const stdout of ['null', '{}', '[null]', '[{"ProcessId":1,"ParentProcessId":0,"CreationDate":"invalid"}]']) {
    assert.equal(actual({}, { status: 0, stdout }).windowsProcessSnapshot(), null);
  }
  assert.equal(actual({}, { status: null, error: { code: 'ETIMEDOUT' } }).windowsProcessSnapshot(), null);
  const iso = '2026-10-01T19:06:51.836Z';
  const api = actual({}, { status: 0, stdout: JSON.stringify({ ProcessId: 42, ParentProcessId: 1, CreationDate: iso }) });
  assert.equal(api.windowsProcessSnapshot()[0].ProcessId, 42);
  assert.equal(api.creationTime(iso), Date.parse(iso));
  assert.equal(api.creationTime(`/Date(${Date.parse(iso)})/`), Date.parse(iso));
});
