// Test-entrypoint-only timing: never records SQL, identifiers, cookies or values.
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { storage } from '../storage';
import { logger } from '../utils/logger';

export function installIntegrationProfile() {
  const require = createRequire(import.meta.url);
  const sqlite3 = createRequire(require.resolve('connect-sqlite3'))('sqlite3');
  const timings: Record<string, number[]> = {};
  let effectiveJournalMode: string | undefined;
  const record = (name: string, elapsed: number) => (timings[name] ??= []).push(elapsed);
  const eventLoop = monitorEventLoopDelay({ resolution: 20 });
  eventLoop.enable();
  for (const name of ['get', 'run', 'exec'] as const) {
    const original = (sqlite3.Database.prototype as any)[name];
    (sqlite3.Database.prototype as any)[name] = function (...args: any[]) {
      if (name === 'exec' && ['1', '0'].includes(process.env.INTEGRATION_PROFILE_WAL || '') && typeof args[0] === 'string' && args[0].includes('sessions')) {
        args[0] = 'PRAGMA journal_mode=' + (process.env.INTEGRATION_PROFILE_WAL === '1' ? 'WAL' : 'DELETE') + '; ' + args[0].replace(/PRAGMA\s+journal_mode\s*=\s*\w+\s*;/gi, '');
      }
      const index = args.length - 1;
      if (typeof args[index] !== 'function') return original.apply(this, args);
      const callback = args[index], started = performance.now();
      args[index] = function (this: any, ...result: any[]) {
        record('session.sqlite.' + name, performance.now() - started);
        if (name === 'exec' && typeof args[0] === 'string' && args[0].includes('sessions')) {
          this.get('PRAGMA journal_mode', (error: any, row: any) => {
            if (!error) effectiveJournalMode = row.journal_mode;
          });
        }
        return callback.apply(this, result);
      };
      return original.apply(this, args);
    };
  }
  for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(storage))) {
    if (name === 'constructor' || typeof (storage as any)[name] !== 'function') continue;
    const original = (storage as any)[name].bind(storage);
    (storage as any)[name] = async (...args: any[]) => {
      const started = performance.now();
      try { return await original(...args); }
      finally { record('storage.' + name, performance.now() - started); }
    };
  }
  if (process.env.INTEGRATION_PROFILE_SILENT === '1') logger.level = 'silent';
  let writing = false;
  const timer = setInterval(async () => {
    if (writing) return;
    const summary = Object.fromEntries(Object.entries(timings).map(([name, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return [name, { count: sorted.length, p50Ms: Math.round(sorted[Math.ceil(sorted.length * .5) - 1]),
        p95Ms: Math.round(sorted[Math.ceil(sorted.length * .95) - 1]), maxMs: Math.round(sorted.at(-1)!) }];
    }));
    writing = true;
    try { await writeFile(process.env.INTEGRATION_PROFILE_OUTPUT!, JSON.stringify({
      at: new Date().toISOString(), silentLogger: logger.level === 'silent',
      sessionWal: effectiveJournalMode === 'wal',
      requestedJournalMode: process.env.INTEGRATION_PROFILE_WAL === '1' ? 'wal' : process.env.INTEGRATION_PROFILE_WAL === '0' ? 'delete' : null,
      effectiveJournalMode,
      eventLoop: { meanMs: Math.round(eventLoop.mean / 1e6), p95Ms: Math.round(eventLoop.percentile(95) / 1e6), maxMs: Math.round(eventLoop.max / 1e6) }, timings: summary,
    }, null, 2)); } finally { writing = false; }
  }, 1000);
  timer.unref();
}
