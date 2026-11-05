import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { NotificationPreferenceConflict } from '../../services/notification-preferences';
const prefs = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('../../storage', () => ({ storage: { getVersionedNotificationPreferences: prefs.get, updateVersionedNotificationPreferences: prefs.patch } }));
vi.mock('../../middleware/auth', () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = { id: 'u' }; next(); } }));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn() } }));
import router from '../../api-routes/notification';
const app = express(); app.use(express.json()); app.use('/preferences-api', router);
beforeEach(() => { vi.resetAllMocks(); prefs.get.mockResolvedValue({ muted: false, revision: 4 }); prefs.patch.mockResolvedValue({ muted: true, revision: 5 }); });
it('keeps GET legacy body and exposes durable revision as ETag', async () => {
  const response = await request(app).get('/preferences-api/preferences');
  expect(response.status).toBe(200); expect(response.body).toEqual({ muted: false }); expect(response.headers.etag).toBe('"4"');
});
it('uses If-Match and keeps PATCH legacy body', async () => {
  const response = await request(app).patch('/preferences-api/preferences').set('If-Match', '"4"').send({ muted: true });
  expect(response.status).toBe(200); expect(response.body).toEqual({ muted: true }); expect(response.headers.etag).toBe('"5"');
  expect(prefs.patch).toHaveBeenCalledWith('u', true, 4);
});
it.each(['*', 'W/"4"', '4', '"-1"', '"1.5"', '"4", "5"', '"9007199254740992"'])('rejects malformed If-Match %s', async header => {
  const response = await request(app).patch('/preferences-api/preferences').set('If-Match', header).send({ muted: true });
  expect(response.status).toBe(400); expect(prefs.patch).not.toHaveBeenCalled();
});
it('supports legacy callers without a revision', async () => {
  expect((await request(app).patch('/preferences-api/preferences').send({ muted: true })).status).toBe(200);
  expect(prefs.patch).toHaveBeenCalledWith('u', true, undefined);
});
it('maps concurrent stale writes to 409', async () => {
  prefs.patch.mockRejectedValue(new NotificationPreferenceConflict());
  expect((await request(app).patch('/preferences-api/preferences').set('If-Match', '"4"').send({ muted: true })).status).toBe(409);
});
