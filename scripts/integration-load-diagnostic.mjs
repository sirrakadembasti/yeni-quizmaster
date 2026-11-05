// Follow-up single-endpoint fetch benchmark; never connects to production ports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const runtime = JSON.parse(fs.readFileSync(path.join(root, 'tests/denetim-kanitlari/veli/runtime.json')));
assert.equal(path.dirname(path.resolve(runtime.root)), path.join(root, 'server/data'));
assert(path.basename(runtime.root).startsWith('quizmaster-test-parent-audit-'));
assert.deepEqual(runtime.ports, [5560, 5561]);
const base = 'http://127.0.0.1:5560';
const cookieFrom = response => response.headers.getSetCookie().find(x => x.startsWith('quizmaster.sid='))?.split(';')[0];
const first = await fetch(base + '/api/csrf-token', { signal: AbortSignal.timeout(15000) });
assert(runtime.integrationIdentity && first.headers.get('x-quizmaster-audit-fixture') === runtime.integrationIdentity, 'Running service is not the disposable fixture');
let cookie = cookieFrom(first);
const token = (await first.json()).csrfToken;
const login = await fetch(base + '/api/auth/login', { method: 'POST', signal: AbortSignal.timeout(15000),
  headers: { Cookie: cookie, 'Content-Type': 'application/json', 'x-csrf-token': token },
  body: JSON.stringify({ email: 'parent-audit-child@example.test', password: 'StudentAuditOnly2026!' }) });
assert.equal(login.status, 200); cookie = cookieFrom(login) || cookie; await login.body.cancel();
const report = { at: new Date().toISOString(), scope: 'Native fetch single student/quizzes endpoint, distinct from six-endpoint Playwright load', rounds: [] };
for (const concurrency of [2, 20]) {
  const times = [], errors = {}, statuses = {}; let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < 40) {
      cursor++; const start = performance.now();
      try {
        const response = await fetch(base + '/api/student/quizzes', { headers: { Cookie: cookie }, signal: AbortSignal.timeout(15000) });
        await response.json(); statuses[response.status] = (statuses[response.status] || 0) + 1;
      } catch (error) { const code = error.name + '/' + (error.cause?.code || 'none'); errors[code] = (errors[code] || 0) + 1; }
      times.push(performance.now() - start);
    }
  }));
  times.sort((a, b) => a - b);
  report.rounds.push({ concurrency, requests: times.length, statuses, errors, p50Ms: Math.round(times[19]), p95Ms: Math.round(times[37]), maxMs: Math.round(times.at(-1)) });
}
fs.writeFileSync(path.join(root, 'tests/denetim-kanitlari/entegrasyon/load-diagnostic.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
