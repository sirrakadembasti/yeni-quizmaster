import type { Request, Response, NextFunction } from 'express';
const receipts = new WeakMap<object, number>();
// Server-only metadata: body fields and HTTP headers cannot set or replace it.
export function getTrustedRequestReceipt(request: object): number {
  const existing = receipts.get(request);
  if (existing !== undefined) return existing;
  const receivedAt = Date.now();
  receipts.set(request, receivedAt);
  return receivedAt;
}
// Register after body parsers and before any asynchronous session/auth work.
export function captureTrustedRequestReceipt(request: Request, _response: Response, next: NextFunction): void {
  getTrustedRequestReceipt(request);
  next();
}
