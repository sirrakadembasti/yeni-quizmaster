// Gerçek başlatıcı (kurulum.bat / kurulum.sh) argüman regresyonu; kontrollü npm/port-yardımcısı fixture'larıyla.
// Paket kurulumu, gerçek port taraması, tarayıcı veya taze kurulum iddiası yoktur.
// Başlatıcı bağımlılıksız başlatıcıyı doğrudan Node ile açar (paket yöneticisinden bağımsız);
// burada sahte scripts/setup-bootstrap.mjs aldığı argümanları kaydeder.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = process.env.HYBRID_SH || (process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\sh.exe' : '/bin/sh');
for (const entry of process.platform === 'win32' ? ['bat', 'sh'] : ['sh']) {
  test(`${entry} actual launcher starts the bootstrap directly and forwards --no-open plus quoted arguments`, { timeout: 90000 }, t => {
    assert([22, 24].includes(Number(process.versions.node.split('.')[0])), 'Wrapper regression requires supported real Node 22/24');
    assert(entry !== 'sh' || fs.existsSync(sh), 'Real SH unavailable; do not substitute a mocked shell');
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-launcher-args-'));
    t.after(() => {
      assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
      assert(path.basename(fixture).startsWith('quizmaster-launcher-args-'));
      fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    });
    const bin = path.join(fixture, 'bin'); fs.mkdirSync(bin);
    fs.mkdirSync(path.join(fixture, 'scripts'));
    fs.writeFileSync(path.join(fixture, 'package.json'), '{"name":"quiz-master"}\n');
    // Return no port occupant without ever enumerating or signalling real PIDs.
    fs.writeFileSync(path.join(fixture, 'scripts/find-port-holder.mjs'), 'process.exit(1);\n');
    fs.copyFileSync(path.join(repository, `kurulum.${entry}`), path.join(fixture, `kurulum.${entry}`));
    const recorded = path.join(fixture, 'argv.jsonl');
    // Sahte bootstrap: aldığı argümanları kaydeder ve başarıyla biter.
    fs.writeFileSync(path.join(fixture, 'scripts/setup-bootstrap.mjs'), `import fs from 'node:fs';
fs.appendFileSync(process.env.LAUNCHER_TEST_ARGS,JSON.stringify(process.argv.slice(2))+'\\n');
`);
    // Desteklenen (npm 11) sahte paket yöneticisi: yalnız sürüm bildirir.
    fs.writeFileSync(path.join(bin, 'npm.cmd'), '@echo off\r\necho 11.0.0\r\n');
    fs.writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\necho 11.0.0\n', { mode: 0o755 });
    const env = { ...process.env, LAUNCHER_TEST_ARGS: recorded, SETUP_BOOTSTRAP_PORT: '5849' };
    const originalPath = Object.entries(process.env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] || '';
    for (const key of Object.keys(env)) if (key.toUpperCase() === 'PATH') delete env[key];
    env.PATH = `${bin}${path.delimiter}${originalPath}`;
    for (const args of [[], ['--no-open', '--label', 'two words']]) {
      const result = entry === 'bat'
        ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', '.\\kurulum.bat', ...args], { cwd: fixture, env, windowsHide: true, timeout: 30000, encoding: 'utf8' })
        : spawnSync(sh, ['kurulum.sh', ...args], { cwd: fixture, env, windowsHide: true, timeout: 30000, encoding: 'utf8' });
      assert.equal(result.error, undefined, 'Controlled actual wrapper process failed to run');
      assert.equal(result.status, 0, `Controlled ${entry} wrapper did not complete its preflight`);
    }
    const invocations = fs.readFileSync(recorded, 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
    assert.deepEqual(invocations, [[], ['--no-open', '--label', 'two words']],
      'Actual launcher lost arguments or did not start the bootstrap directly');
  });
}
