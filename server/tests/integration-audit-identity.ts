// Marker only in disposable test entrypoints; production never installs it.
import { Server } from 'node:http';
export function installIntegrationAuditIdentity() {
  const identity = process.env.INTEGRATION_AUDIT_ID;
  if (!identity) return;
  if (!/^[a-f0-9-]{36}$/.test(identity)) throw new Error('Invalid fixture identity');
  const prototype: any = Server.prototype;
  const original = prototype.emit;
  prototype.emit = function (event: string, ...args: any[]) {
    if (event === 'request') args[1].setHeader('x-quizmaster-audit-fixture', identity);
    return original.apply(this, [event, ...args]);
  };
}
