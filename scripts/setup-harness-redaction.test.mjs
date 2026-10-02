// Unit only: execute the actual harness redactor, with disposable sentinels.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(scripts, 'admin-hybrid-setup-closure.mjs'), 'utf8');
const definition = source.match(/const redact = text => \{[\s\S]*?\n\};/)?.[0];
assert.ok(definition, 'Actual harness redactor missing');
const redact = vm.runInNewContext(`const secrets=new Set(['FIXTURE_PASSWORD_SENTINEL']); ${definition}\nredact;`);

test('Playwright credential header lines are removed from raw ANSI and JSON-encoded call logs', () => {
  const log = 'apiRequestContext.get: Timeout\nCall log:\n  - GET /api/status\n'
    + '\u001b[31m    - CoOkIe: quizmaster.bootstrap=COOKIE_SENTINEL\u001b[39m\n'
    + '    - set-cookie: session=SET_COOKIE_SENTINEL; HttpOnly\n'
    + '    - Authorization: Bearer AUTH_SENTINEL\n  - accept: application/json\n';
  for (const value of [log, JSON.stringify(log), JSON.stringify({ statusReadMisses: [{ error: log }],
    headers: { cookie: 'OBJECT_COOKIE_SENTINEL', 'SET-COOKIE': 'OBJECT_SET_SENTINEL', authorization: 'OBJECT_AUTH_SENTINEL' },
    password: 'FIXTURE_PASSWORD_SENTINEL', phase: 'dependencies' })]) {
    const safe = redact(value);
    for (const secret of ['COOKIE_SENTINEL', 'SET_COOKIE_SENTINEL', 'AUTH_SENTINEL', 'OBJECT_COOKIE_SENTINEL',
      'OBJECT_SET_SENTINEL', 'OBJECT_AUTH_SENTINEL', 'FIXTURE_PASSWORD_SENTINEL']) assert.equal(safe.includes(secret), false);
    assert.equal(safe.includes('apiRequestContext.get: Timeout'), true, 'Keep noncredential diagnostics');
    if (value.startsWith('"') || value.startsWith('{')) assert.doesNotThrow(() => JSON.parse(safe), 'Redaction must preserve valid JSON');
  }
});

test('escaped ANSI/header forms and existing token/secret masking remain safe before report serialization', () => {
  const raw = '\\u001b[31m - cookie: ESCAPED_HEADER_SENTINEL\\u001b[0m\n'
    + 'GET /setup?token=TOKEN_SENTINEL\nSESSION_SECRET=ENV_SENTINEL\n';
  const safe = redact(raw);
  for (const secret of ['ESCAPED_HEADER_SENTINEL', 'TOKEN_SENTINEL', 'ENV_SENTINEL']) assert.equal(safe.includes(secret), false);
  const saved = JSON.stringify({ error: safe });
  assert.doesNotThrow(() => JSON.parse(saved));
});

test('POST call logs and structured headers redact CSRF and proxy authorization without known-secret registration', () => {
  const log = 'apiRequestContext.post: Timeout\nCall log:\n  - POST /api/wizard\n'
    + '\u001b[31m    - X-CsRf-ToKeN: BOOTSTRAP_CSRF_SENTINEL\u001b[39m\n'
    + '    - x-setup-csrf: WIZARD_CSRF_SENTINEL\n'
    + '    - Proxy-Authorization: Basic PROXY_AUTH_SENTINEL\n  - accept: application/json\n';
  for (const value of [log, JSON.stringify(log), JSON.stringify({ error: log,
    headers: { 'x-csrf-token': 'OBJECT_BOOTSTRAP_CSRF_SENTINEL', 'X-SETUP-CSRF': 'OBJECT_WIZARD_CSRF_SENTINEL',
      'proxy-authorization': 'OBJECT_PROXY_AUTH_SENTINEL' }, phase: 'wizard' })]) {
    const safe = redact(value);
    for (const secret of ['BOOTSTRAP_CSRF_SENTINEL', 'WIZARD_CSRF_SENTINEL', 'PROXY_AUTH_SENTINEL',
      'OBJECT_BOOTSTRAP_CSRF_SENTINEL', 'OBJECT_WIZARD_CSRF_SENTINEL', 'OBJECT_PROXY_AUTH_SENTINEL']) {
      assert.equal(safe.includes(secret), false, 'Credential headers must not depend on secrets Set');
    }
    assert.equal(safe.includes('apiRequestContext.post: Timeout'), true);
    if (value.startsWith('"') || value.startsWith('{')) assert.doesNotThrow(() => JSON.parse(safe));
  }
});
