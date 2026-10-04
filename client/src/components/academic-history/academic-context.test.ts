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
  it('blocks profile/password edits and current archive records',()=>{
    expect(historicalRequestPolicy('PATCH','/api/auth/me')).toBe(403);
    expect(historicalRequestPolicy('POST','/api/auth/change-password')).toBe(403);
    expect(historicalRequestPolicy('GET','/api/auth/me')).toBe(null);
    expect(historicalRequestPolicy('GET','/api/admin/archive/years/123/rules')).toBe(409);
    expect(historicalRequestPolicy('GET','/api/admin/archive/jobs/other/download','selected')).toBe(409);
  });
});
