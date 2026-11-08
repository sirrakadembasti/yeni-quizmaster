import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createWizardProxy, matchRoute, MAX_BODY_BYTES } from './setup-proxy.mjs';

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}
function close(server) {
  return new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); });
}
function request(port, { method = 'GET', path = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

// Sihirbazı taklit eden sunucu: gelen isteği JSON olarak yansıtır.
async function setup(t, { target = true } = {}) {
  const seen = [];
  const wizard = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    seen.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
    if (req.url === '/redirect') { res.statusCode = 303; res.setHeader('location', 'http://evil.example/'); return res.end(); }
    res.setHeader('set-cookie', 'quizmaster.setup=sizdirma; Path=/');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, url: req.url }));
  });
  const wizardPort = await listen(wizard);
  const proxy = createWizardProxy({ getTarget: () => (target ? { port: wizardPort, cookie: 'quizmaster.setup=gizli-oturum' } : null), timeoutMs: 2000 });
  const front = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://x').pathname;
    if (!(await proxy(req, res, pathname))) { res.statusCode = 200; res.end('baslatici'); }
  });
  const frontPort = await listen(front);
  t.after(async () => { await close(front); await close(wizard); });
  return { seen, frontPort };
}

test('beyaz liste: yalnız tanımlı yöntem+yol eşleşir', () => {
  assert.ok(matchRoute('GET', '/wizard'));
  assert.ok(matchRoute('POST', '/wizard/api/apply'));
  assert.equal(matchRoute('GET', '/wizard/api/apply'), null, 'yöntem uyuşmuyor');
  assert.equal(matchRoute('POST', '/wizard/api/status'), null);
  assert.equal(matchRoute('GET', '/wizard/api/../../etc/passwd'), null);
  assert.equal(matchRoute('GET', '/wizard/bilinmeyen'), null);
});

test('izinli istek sihirbaza doğru yolla iletilir; sihirbaz kimliği sunucu tarafında eklenir', async t => {
  const { seen, frontPort } = await setup(t);
  const response = await request(frontPort, { path: '/wizard/api/status', headers: { cookie: 'quizmaster.bootstrap=baslatici-cerezi' } });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.text).url, '/api/status');
  assert.equal(seen[0].headers.cookie, 'quizmaster.setup=gizli-oturum', 'tarayıcı cookie’si sihirbaza sızmamalı');
});

test('Host ve Origin değiştirilmeden iletilir (sameOrigin denetimi için)', async t => {
  const { seen, frontPort } = await setup(t);
  const origin = `http://127.0.0.1:${frontPort}`;
  await request(frontPort, { method: 'POST', path: '/wizard/api/apply', headers: { origin, 'content-type': 'application/json', 'x-setup-csrf': 'abc' }, body: '{"a":1}' });
  assert.equal(seen[0].headers.origin, origin);
  assert.equal(seen[0].headers.host, `127.0.0.1:${frontPort}`);
  assert.equal(seen[0].headers['x-setup-csrf'], 'abc');
  assert.equal(seen[0].body, '{"a":1}');
});

test('sihirbazın Set-Cookie yanıtı tarayıcıya iletilmez; yönlendirme izlenmez', async t => {
  const { frontPort } = await setup(t);
  const response = await request(frontPort, { path: '/wizard/api/status' });
  assert.equal(response.headers['set-cookie'], undefined);
});

test('beyaz liste dışı yol 404, hedef yoksa 503, başlatıcının kendi yolları geçer', async t => {
  const { seen, frontPort } = await setup(t);
  assert.equal((await request(frontPort, { path: '/wizard/api/reset', method: 'POST' })).status, 404);
  assert.equal((await request(frontPort, { path: '/wizard/api/status', method: 'DELETE' })).status, 404);
  assert.equal((await request(frontPort, { path: '/api/status' })).text, 'baslatici');
  assert.equal(seen.length, 0, 'reddedilen istekler sihirbaza ulaşmamalı');

  const none = await setup(t, { target: false });
  assert.equal((await request(none.frontPort, { path: '/wizard' })).status, 503);
});

test('gövde sınırı aşılırsa 413 ve sihirbaza ulaşmaz', async t => {
  const { seen, frontPort } = await setup(t);
  const response = await request(frontPort, { method: 'POST', path: '/wizard/api/apply', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(MAX_BODY_BYTES + 10) });
  assert.equal(response.status, 413);
  assert.equal(seen.length, 0);
});

test('sihirbaz kapalıysa 502 döner, başlatıcı çökmez', async t => {
  const wizard = http.createServer();
  const wizardPort = await listen(wizard);
  await close(wizard); // port artık kapalı
  const proxy = createWizardProxy({ getTarget: () => ({ port: wizardPort, cookie: 'x=y' }), timeoutMs: 1000 });
  const front = http.createServer(async (req, res) => { await proxy(req, res, new URL(req.url, 'http://x').pathname); });
  const frontPort = await listen(front);
  t.after(() => close(front));
  assert.equal((await request(frontPort, { path: '/wizard' })).status, 502);
});
