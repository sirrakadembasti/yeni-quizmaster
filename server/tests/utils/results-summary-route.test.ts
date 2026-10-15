import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import resultRouter from '../../api-routes/result';

const data = vi.hoisted(() => ({ summary: vi.fn(), legacy: vi.fn() }));
vi.mock('../../storage', () => ({ storage: { getResultsSummary: data.summary, getFilteredResults: data.legacy } }));
vi.mock('../../middleware/archive-readonly', () => ({ archiveResultGuard: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.user = { role: req.headers['x-role'] || 'teacher', id: 'teacher' }; next(); },
  requireRole: (allowed: string[]) => (req: any, res: any, next: any) => allowed.includes(req.user.role) ? next() : res.sendStatus(403),
}));
const app = express();
app.use('/results', resultRouter);
beforeEach(() => {
  data.summary.mockReset().mockResolvedValue({ results: [{ id: 'small' }], nextCursor: 'small' });
  data.legacy.mockReset().mockResolvedValue([{ id: 'legacy', answers: { q: 'answer' } }]);
});

it('returns a bounded page and forces teacher ownership despite a forged teacher filter', async () => {
  const response = await request(app).get('/results?projection=summary&teacherId=other&classId=c&limit=20&cursor=previous');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ results: [{ id: 'small' }], nextCursor: 'small' });
  expect(data.summary).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'teacher', classId: 'c' }), { limit: 20, cursor: 'previous' });
  expect(data.legacy).not.toHaveBeenCalled();
});

it('preserves the existing full-detail response for legacy consumers', async () => {
  const response = await request(app).get('/results?teacherId=other').set('x-role', 'admin');
  expect(response.body).toEqual({ results: [{ id: 'legacy', answers: { q: 'answer' } }] });
  expect(data.legacy).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'other' }));
  expect(data.summary).not.toHaveBeenCalled();
});

it.each(['limit=0', 'limit=501', 'limit=1.5', 'limit=abc', 'limit=20&limit=30', 'cursor=', 'cursor=a&cursor=b'])('rejects malformed summary pagination: %s', async query => {
  expect((await request(app).get(`/results?projection=summary&${query}`)).status).toBe(400);
  expect(data.summary).not.toHaveBeenCalled();
});

it('denies student access to reporting summaries', async () => {
  expect((await request(app).get('/results?projection=summary').set('x-role', 'student')).status).toBe(403);
  expect(data.summary).not.toHaveBeenCalled();
});
