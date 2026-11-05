// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../../server/middleware/auth', () => ({ requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(), requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../../../../server/services/archive-db', () => ({ archiveDb: {} }));
import { historicalRequestPolicy } from '../../../../server/middleware/academic-context';
describe('historical request policy', () => {
  it('rejects every unrelated write and live read', () => {
    expect(historicalRequestPolicy('DELETE', '/api/users/1')).toBe(403);
    expect(historicalRequestPolicy('GET', '/api/users')).toBe(409);
    expect(historicalRequestPolicy('POST', '/api/admin/archive')).toBe(403);
  });
  it('allows leaving history and protected downloads, never archive mutation', () => {
    expect(historicalRequestPolicy('POST', '/api/admin/academic-history/context')).toBe(null);
    expect(historicalRequestPolicy('POST', '/api/admin/archive/jobs/123/download-authorize', '123')).toBe(null);
    expect(historicalRequestPolicy('GET', '/api/admin/academic-history/years/123/rows')).toBe(null);
    expect(historicalRequestPolicy('POST', '/api/admin/archive/jobs/123/retry')).toBe(403);
  });
  it('blocks business profile edits and current archive records',()=>{
    expect(historicalRequestPolicy('PATCH','/api/auth/me')).toBe(403);
    expect(historicalRequestPolicy('POST','/api/auth/change-password')).toBe(null);
    expect(historicalRequestPolicy('GET','/api/auth/me')).toBe(null);
    expect(historicalRequestPolicy('GET','/api/admin/archive/years/123/rules')).toBe(409);
    expect(historicalRequestPolicy('GET','/api/admin/archive/jobs/other/download','selected')).toBe(409);
  });
  it.each([
    ['POST','/api/auth/change-password'],
    ['GET','/api/notifications'],['GET','/api/notifications/preferences'],['PATCH','/api/notifications/preferences'],['POST','/api/notifications/mark-read'],['DELETE','/api/notifications/n-1'],
    ['GET','/api/admin/password-reset-requests'],['POST','/api/admin/password-reset-requests'],['POST','/api/admin/password-reset-requests/r-1/resend'],['POST','/api/admin/password-reset-requests/r-1/cancel'],
  ])('allows the operational %s %s in historical mode', (method,path)=>expect(historicalRequestPolicy(method,path)).toBe(null));
  it.each([
    ['GET','/api/auth/change-password'],['PATCH','/api/auth/change-password'],['POST','/api/auth/register'],['PATCH','/api/auth/me'],
    ['POST','/api/notifications/preferences'],['DELETE','/api/notifications/preferences'],['PATCH','/api/notifications/n-1'],['POST','/api/notifications/n-1'],['DELETE','/api/notifications'],
    ['DELETE','/api/admin/password-reset-requests'],['PATCH','/api/admin/password-reset-requests/r-1'],['GET','/api/admin/password-reset-requests/r-1/resend'],['POST','/api/admin/password-reset-requests/r-1/resend/other'],
  ])('keeps the unsupported method/path %s %s blocked', (method,path)=>expect(historicalRequestPolicy(method,path)).toBe(['GET','HEAD','OPTIONS'].includes(method)?409:403));
});
