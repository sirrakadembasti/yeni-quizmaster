import type { Server } from 'node:http';

/** Keep idle browser sockets beyond short bursts of synchronous durable writes. */
export function configureHTTPTransport(server: Server): void {
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 75_000;
}
