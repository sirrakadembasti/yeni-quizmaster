// Actual wrapper argv regression with controlled pnpm/port-helper fixtures.
// No dependency install, real port inspection, browser or fresh-install claim.
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
  test(`${entry} actual launcher preserves default invocation and forwards --no-open plus quoted arguments`, { timeout: 90000 }, t => {
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
    const recorder = path.join(fixture, 'record.mjs');
    fs.writeFileSync(recorder, `import fs from 'node:fs';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--version')console.log('9.15.1');
else fs.appendFileSync(process.env.LAUNCHER_TEST_ARGS,JSON.stringify(args)+'\\n');
`);
    fs.writeFileSync(path.join(bin, 'pnpm.cmd'), '@echo off\r\n"%LAUNCHER_TEST_NODE%" "%LAUNCHER_TEST_RECORDER%" %*\r\nexit /b %errorlevel%\r\n');
    fs.writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\nexec "$LAUNCHER_TEST_NODE" "$LAUNCHER_TEST_RECORDER" "$@"\n', { mode: 0o755 });
    const env = { ...process.env, LAUNCHER_TEST_NODE: process.execPath.replaceAll('\\', '/'),
      LAUNCHER_TEST_RECORDER: recorder.replaceAll('\\', '/'), LAUNCHER_TEST_ARGS: recorded,
      SETUP_BOOTSTRAP_PORT: '5849', SETUP_WIZARD_PORT: '5850' };
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
    assert.deepEqual(invocations, [['run', 'setup'], ['run', 'setup', '--no-open', '--label', 'two words']],
      'Actual launcher lost arguments or changed its default pnpm setup invocation');
  });
}
