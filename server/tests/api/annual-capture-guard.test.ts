import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
vi.mock('../../middleware/auth', () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = { id: 'actor' }; next(); } }));
vi.mock('../../services/archive-db', () => ({ archiveDb: null }));
import { createAnnualCaptureGuard } from '../../middleware/annual-capture-guard';
function fixture(frozen: boolean) {
  const db = { archiveSnapshot: { findFirst: vi.fn().mockResolvedValue(frozen ? { id: 'annual', label: '2025-2026' } : null) }, actionLog: { create: vi.fn().mockResolvedValue({}) } };
  const app = express();
  app.use(createAnnualCaptureGuard(db as any));
  app.use((_req, res) => res.json({ allowed: true }));
  return { app, db };
}
it('blocks business mutations during a captured annual job and audits the denial', async () => {
  const { app, db } = fixture(true);
  for (const path of ['/api/users/student', '/api/quizzes', '/api/classes/class', '/api/question-bank/question']) {
    expect((await request(app).patch(path)).status).toBe(423);
  }
  expect(db.actionLog.create).toHaveBeenCalledTimes(4);
});
it('allows reads, authentication and repair/download workflow while the year is frozen', async () => {
  const { app } = fixture(true);
  expect((await request(app).get('/api/classes')).status).toBe(200);
  for (const path of ['/api/auth/logout', '/api/admin/archive/jobs/annual/retry', '/api/admin/academic-history/context']) {
    expect((await request(app).post(path)).status).toBe(200);
  }
});
it('does not interfere with current-year operations without a captured annual job', async () => {
  const { app, db } = fixture(false);
  expect((await request(app).post('/api/quizzes')).status).toBe(200);
  expect(db.actionLog.create).not.toHaveBeenCalled();
});
