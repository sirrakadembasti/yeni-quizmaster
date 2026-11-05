import http from 'node:http';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import { configureHTTPTransport } from '../../utils/http-transport';

describe('HTTP transport idle limits', () => {
  it('extends idle reuse without changing active request limits or the native buffer', () => {
    const server = http.createServer();
    const original = { request: server.requestTimeout, active: server.timeout, buffer: server.keepAliveTimeoutBuffer };
    configureHTTPTransport(server);
    expect(server.keepAliveTimeout).toBe(65_000);
    expect(server.headersTimeout).toBe(75_000);
    expect(server.requestTimeout).toBe(original.request);
    expect(server.timeout).toBe(original.active);
    expect(server.keepAliveTimeoutBuffer).toBe(original.buffer);
  });

  it('reuses an owned loopback socket beyond the former six-second idle boundary', async () => {
    const server = http.createServer((_request, response) => response.end('ok'));
    configureHTTPTransport(server);
    let connections = 0;
    server.on('connection', () => { connections++; });
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    try {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Owned loopback listener required');
      const request = () => new Promise<string>((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port: address.port, agent }, response => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', chunk => { body += chunk; });
          response.on('end', () => resolve(body));
          response.on('error', reject);
        });
        req.on('error', reject);
      });
      expect(await request()).toBe('ok');
      await new Promise(resolve => setTimeout(resolve, 6_250));
      expect(await request()).toBe('ok');
      expect(connections).toBe(1);
    } finally {
      agent.destroy();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }, 15_000);
});
