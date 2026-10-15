import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { actorClient } from './production-performance-http.mjs';

test('image workload uses the authenticated browser session and rejects other paths', async () => {
  let imageCookie;
  let client;
  const server = http.createServer((req, res) => {
    if (req.url === '/uploads/owned.jpg') {
      imageCookie = req.headers.cookie;
      res.end(Buffer.from([1, 2, 3])); return;
    }
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/csrf-token') {
      if (!req.headers.cookie) res.setHeader('set-cookie', 'sid=synthetic-preflight; Path=/');
      res.end(JSON.stringify({ csrfToken: 'synthetic-token' }));
    } else if (req.url === '/api/auth/login') {
      assert.equal(req.headers['x-csrf-token'], 'synthetic-token');
      res.setHeader('set-cookie', 'sid=synthetic-authenticated; Path=/');
      res.end('{}');
    } else res.end(JSON.stringify({ user: { id: 'owned' } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    client = await actorClient('http://127.0.0.1:' + server.address().port, { id: 'owned', email: 'owned@example.test' }, 'synthetic-password');
    assert.deepEqual(await client.image('/uploads/owned.jpg'), { status: 200, bytes: 3 });
    assert.equal(imageCookie, 'sid=synthetic-authenticated');
    await assert.rejects(client.image('https://example.test/image.jpg'));
    await assert.rejects(client.image('/uploads/../data/quiz.db'));
    await assert.rejects(client.image('/api/anything'));
  } finally {
    client?.close?.();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('actors have separate TCP pools and reuse each own pool for authenticated API and images', async () => {
  const sockets = new Map();
  const server = http.createServer((req, res) => {
    const actor = /^sid=([ab])$/.exec(req.headers.cookie || '')?.[1];
    if (actor) {
      if (!sockets.has(actor)) sockets.set(actor, new Set());
      sockets.get(actor).add(req.socket);
    }
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/auth/login') {
      let body = '';
      req.on('data', value => { body += value; });
      req.on('end', () => {
        const id = JSON.parse(body).email.split('@')[0];
        res.setHeader('set-cookie', 'sid=' + id + '; Path=/'); res.end('{}');
      });
    } else if (req.url === '/api/csrf-token') res.end(JSON.stringify({ csrfToken: 'fixture-token' }));
    else if (req.url === '/api/auth/me') res.end(JSON.stringify({ user: { id: actor } }));
    else if (req.url === '/uploads/owned.jpg') res.end(Buffer.from([1, 2, 3]));
    else res.end('{"ok":true}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const clients = [];
  try {
    const origin = 'http://127.0.0.1:' + server.address().port;
    for (const id of ['a', 'b']) clients.push(await actorClient(origin, { id, email: id + '@fixture.test' }, 'fixture-password'));
    for (const client of clients) {
      assert.deepEqual(await client('/api/probe'), { status: 200, body: { ok: true } });
      assert.deepEqual(await client.image('/uploads/owned.jpg'), { status: 200, bytes: 3 });
    }
    assert.equal(sockets.get('a').size, 1, 'Actor API and image traffic must reuse its own TCP connection');
    assert.equal(sockets.get('b').size, 1, 'Second actor must reuse its own TCP connection');
    assert.ok([...sockets.get('a')].every(socket => !sockets.get('b').has(socket)), 'Actors must not share TCP pool sockets');
    for (const client of clients) {
      assert.equal(typeof client.close, 'function'); client.close(); client.close();
      await assert.rejects(client('/api/probe'), /closed/i);
    }
  } finally {
    for (const client of clients) client.close?.();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});

test('actor transport rejects redirects without retrying or forwarding credentials', async () => {
  const visits = [];
  const server = http.createServer((req, res) => {
    visits.push(req.url);
    if (req.url === '/api/redirect' || req.url === '/uploads/redirect.jpg') {
      res.writeHead(302, { location: '/api/destination' }); res.end(); return;
    }
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/csrf-token') res.end('{"csrfToken":"fixture-token"}');
    else if (req.url === '/api/auth/me') res.end('{"user":{"id":"fixture"}}');
    else res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let client;
  try {
    client = await actorClient('http://127.0.0.1:' + server.address().port, { id: 'fixture', email: 'fixture@example.test' }, 'fixture-password');
    await assert.rejects(client('/api/redirect'));
    await assert.rejects(client.image('/uploads/redirect.jpg'));
    assert.equal(visits.filter(url => url === '/api/redirect').length, 1);
    assert.equal(visits.filter(url => url === '/uploads/redirect.jpg').length, 1);
    assert.ok(!visits.includes('/api/destination'));
  } finally {
    client?.close?.(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
