import { readFileSync } from 'node:fs';
import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Test runtime preload: preserve the real outbox while preventing any SMTP connection. */
function fixtureRuntime(runtimeFile) {
  if (!runtimeFile) throw new Error('Disposable academic email runtime marker required');
  const runtime = JSON.parse(readFileSync(runtimeFile, 'utf8'));
  const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const root = path.resolve(runtime.root), database = path.join(root, 'server/data/academic.db');
  if (path.dirname(root) !== path.join(repo, 'server/data') || !path.basename(root).startsWith('quizmaster-test-academic-') ||
      path.dirname(path.resolve(runtimeFile)) !== root || path.resolve(runtime.database) !== database ||
      process.env.DATABASE_URL !== 'file:' + database.replaceAll('\\', '/')) {
    throw new Error('Unsafe academic email fixture runtime');
  }
  return root;
}

/** Install before importing Prisma/server modules: independent network and env-read defenses. */
export function isolateAcademicFixture(runtimeFile = process.env.ACADEMIC_ARCHIVE_RUNTIME) {
  const root = fixtureRuntime(runtimeFile);
  const state = { deniedConnections: 0, deniedEnvironmentReads: 0 };
  const local = host => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(String(host ?? 'localhost').toLowerCase());
  const denied = () => {
    state.deniedConnections++;
    throw Object.assign(new Error('Academic fixture outbound connection disabled'), { code: 'ACADEMIC_FIXTURE_OUTBOUND_BLOCKED' });
  };
  const check = args => {
    while (Array.isArray(args[0])) args = args[0];
    const first = args[0];
    if (typeof first === 'string') return; // Local IPC socket/Windows named pipe.
    if (typeof first === 'object' && first?.path) return;
    const host = typeof first === 'number' ? (typeof args[1] === 'string' ? args[1] : 'localhost') : first?.host;
    if (!local(host)) denied();
  };
  const originalSocketConnect = net.Socket.prototype.connect;
  const originalTlsConnect = tls.connect;
  net.Socket.prototype.connect = function (...args) { check(args); return originalSocketConnect.apply(this, args); };
  tls.connect = function (...args) { check(args); return originalTlsConnect.apply(this, args); };
  const originals = new Map();
  for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse']) {
    originals.set(name, [dns[name], dns.promises[name]]);
    if (name === 'lookup') {
      dns.lookup = (host, options, callback) => {
        if (typeof options === 'function') { callback = options; options = {}; }
        if (!local(host)) return queueMicrotask(() => { try { denied(); } catch (error) { callback(error); } });
        const address = host === 'localhost' ? '127.0.0.1' : host;
        const family = String(address).includes(':') ? 6 : 4;
        queueMicrotask(() => options?.all ? callback(null, [{ address, family }]) : callback(null, address, family));
      };
      dns.promises.lookup = async (host, options) => {
        if (!local(host)) denied();
        const address = host === 'localhost' ? '127.0.0.1' : host, family = String(address).includes(':') ? 6 : 4;
        return options?.all ? [{ address, family }] : { address, family };
      };
    } else {
      dns[name] = (...args) => { const callback = args.at(-1); queueMicrotask(() => { try { denied(); } catch (error) { callback(error); } }); };
      dns.promises[name] = async () => denied();
    }
  }
  const resolverOriginals = [];
  for (const [prototype, promise] of [[dns.Resolver.prototype, false], [dns.promises.Resolver.prototype, true]]) {
    for (const name of ['resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNs', 'resolvePtr', 'resolveSoa', 'resolveSrv', 'resolveTxt', 'reverse']) {
      if (typeof prototype[name] !== 'function') continue;
      resolverOriginals.push([prototype, name, prototype[name]]);
      prototype[name] = promise ? async () => denied() : (...args) => { const callback = args.at(-1); queueMicrotask(() => { try { denied(); } catch (error) { callback(error); } }); };
    }
  }
  const originalRead = fs.readFileSync;
  fs.readFileSync = function (file, options) {
    const filename = file instanceof URL ? fileURLToPath(file) : typeof file === 'string' ? path.resolve(file) : '';
    if (filename && /^\.env(?:\.|$)/.test(path.basename(filename)) && !filename.startsWith(root + path.sep)) {
      state.deniedEnvironmentReads++;
      throw Object.assign(new Error('Academic fixture excludes deployment environment files'), { code: 'ENOENT' });
    }
    return originalRead.apply(this, arguments);
  };
  syncBuiltinESMExports();
  return { state, restore() {
    net.Socket.prototype.connect = originalSocketConnect;
    tls.connect = originalTlsConnect;
    fs.readFileSync = originalRead;
    for (const [name, [callback, promise]] of originals) { dns[name] = callback; dns.promises[name] = promise; }
    for (const [prototype, name, original] of resolverOriginals) prototype[name] = original;
    syncBuiltinESMExports();
  } };
}

export function disableAcademicFixtureEmailDelivery(nodemailer, runtimeFile = process.env.ACADEMIC_ARCHIVE_RUNTIME) {
  fixtureRuntime(runtimeFile);
  const blocked = async () => { throw Object.assign(new Error('Academic fixture delivery disabled; outbox only'), { code: 'ACADEMIC_FIXTURE_EMAIL_DELIVERY_DISABLED' }); };
  nodemailer.createTransport = () => ({ sendMail: blocked, verify: blocked, close() {} });
}
