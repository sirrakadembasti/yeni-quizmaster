import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth';
import { PROVIDERS } from '../services/ai-providers';
import { fetchProfileModels, classifyLLMError } from '../services/ai-runtime';
import { buildQuestionPrompt, parseGeneratedQuestions } from '../services/ai-question-format';
import { defaultAIDependencies, sendAIError, withAIOperation, type AIHandlerDependencies } from '../services/ai-http';
import { supportsQuestionJSON } from '../services/ai-provider-validation';
import { parseAIUsageFilters } from '../services/ai-usage';

const revisionBody = z.object({ revision: z.number().int().nonnegative() });
const profileBody = z.object({
  name: z.string().trim().min(1).max(80), provider: z.string().min(1).max(80),
  model: z.string().trim().min(1).max(160), baseURL: z.string().url().max(2000),
  apiKey: z.string().max(8192).optional(), revision: z.number().int().nonnegative().optional(),
  timeoutMs: z.number().int().min(5000).max(300000).optional(),
  maxOutputTokens: z.number().int().min(256).max(32768).optional(),
  thinking: z.enum(['auto', 'enabled', 'disabled']).optional(),
}).strict();
export function createAIManagementRouter(dependencies: AIHandlerDependencies = defaultAIDependencies): Router {
  const router = Router(); router.use(requireAuth, requireRole(['admin']));
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const networkLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => (req as AuthRequest).user!.id,
    message: { code: 'AI_TEST_RATE_LIMIT', message: 'AI test sınırına ulaşıldı. Bir süre sonra tekrar deneyin.' },
  });
  const route = (work: (req: AuthRequest, res: import('express').Response) => Promise<unknown>) =>
    (req: AuthRequest, res: import('express').Response) => { void work(req, res).catch(error => { if (!res.headersSent && !res.destroyed) sendAIError(res, error); }); };
  router.get('/catalog', (_req, res) => res.json({ providers: PROVIDERS }));
  router.get('/usage', route(async (req,res) => {
    const filters = parseAIUsageFilters(req.query);
    if (!dependencies.getUsage) return res.status(503).json({code:'AI_USAGE_UNAVAILABLE',message:'AI kullanım kaydı kullanılamıyor.'});
    res.json(await (await dependencies.getUsage()).list(filters));
  }));
  router.get('/profiles', route(async (_req, res) => res.json(await (await dependencies.getStore()).list())));
  router.post('/profiles', route(async (req, res) => {
    const input = profileBody.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Ad, sağlayıcı, model ve profil ayarlarını kontrol edin.' });
    res.status(201).json(await (await dependencies.getStore()).save(input.data));
  }));
  router.put('/profiles/:id', route(async (req, res) => {
    const input = profileBody.safeParse(req.body);
    if (!input.success || input.data.revision === undefined) return res.status(400).json({ message: 'Profil ayarları ve güncel revizyon gerekli.' });
    res.json(await (await dependencies.getStore()).save(input.data, req.params.id));
  }));
  router.delete('/profiles/:id', route(async (req, res) => {
    const input = revisionBody.strict().safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Güncel profil revizyonu gerekli.' });
    const store = await dependencies.getStore(); await store.remove(req.params.id, input.data.revision); res.json(await store.list());
  }));
  router.post('/profiles/:id/enabled', route(async (req, res) => {
    const input = revisionBody.extend({ enabled: z.boolean() }).strict().safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Güncel revizyon ve kullanım durumu gerekli.' });
    res.json(await (await dependencies.getStore()).setEnabled(req.params.id, input.data.revision, input.data.enabled));
  }));
  router.post('/default', route(async (req, res) => {
    const input = z.object({ profileId: z.string().min(1).nullable(), settingsRevision: z.number().int().nonnegative(), profileRevision: z.number().int().nonnegative().optional() }).strict().safeParse(req.body);
    if (!input.success || (input.data.profileId !== null && input.data.profileRevision === undefined)) return res.status(400).json({ message: 'Güncel yapılandırma ve profil revizyonu gerekli.' });
    res.json(await (await dependencies.getStore()).setDefault(input.data.profileId, input.data.settingsRevision, input.data.profileRevision));
  }));
  router.get('/profiles/:id/models', networkLimit, route(async (req, res) => {
    await withAIOperation(req, res, async signal => {
      const profile = await (await dependencies.getStore()).getForAdmin(req.params.id);
      if (!profile) { res.status(404).json({ message: 'Profil bulunamadı.' }); return; }
      const models = await fetchProfileModels(profile, { signal });
      if (!signal.aborted) res.json({ models });
    });
  }));
  router.post('/profiles/:id/test', networkLimit, route(async (req, res) => {
    const input = revisionBody.extend({ mode: z.enum(['quick', 'questions']) }).strict().safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Test türü ve güncel revizyon gerekli.' });
    await withAIOperation(req, res, async signal => {
      const store = await dependencies.getStore(), profile = await store.getForAdmin(req.params.id);
      if (!profile) { res.status(404).json({ message: 'Profil bulunamadı.' }); return; }
      if (profile.revision !== input.data.revision) { res.status(409).json({ message: 'Profil değişti. Listeyi yenileyin.' }); return; }
      const { mode } = input.data, started = Date.now();
      let failure: unknown;
      try {
        const jsonObject = mode === 'questions' && supportsQuestionJSON(profile);
        const prompt = mode === 'quick' ? 'Yalnızca OK yaz.' : buildQuestionPrompt({ topic: 'Türkiye tarihi', count: 1, difficulty: 'easy', questionType: 'multiple-choice', contentType: 'exam' }, { jsonObject });
        const text = await dependencies.generate([{ role: 'user', content: prompt }], profile, { signal, purpose: mode, jsonObject });
        if (mode === 'questions') { try { parseGeneratedQuestions(text, 1, 'exam'); } catch { throw Object.assign(new Error('Invalid question response'), { code: 'AI_INVALID_QUESTIONS' }); } }
        if (!text.trim()) throw Object.assign(new Error('Empty response'), { code: 'LLM_EMPTY_RESPONSE' });
      } catch (error) { failure = error; }
      if (signal.aborted) return;
      const durationMs = Date.now() - started;
      const code = failure && (failure as { code?: string }).code === 'AI_INVALID_QUESTIONS' ? 'AI_INVALID_QUESTIONS' : failure ? classifyLLMError(failure).code : undefined;
      const recorded = await store.recordTest(profile.id, profile.revision, mode, failure ? 'failed' : 'passed', { durationMs, ...(code ? { code, upstreamStatus: classifyLLMError(failure).upstreamStatus } : {}) });
      if (!recorded) { res.status(409).json({ message: 'Profil test sırasında değişti. Yeniden sınayın.' }); return; }
      if (failure) {
        if (code === 'AI_INVALID_QUESTIONS') res.status(502).json({ code, message: 'Model geçerli örnek soru üretemedi.', durationMs });
        else sendAIError(res, failure);
        return;
      }
      res.json({ ok: true, mode, durationMs, message: mode === 'quick' ? 'Bağlantı ve model yanıtı doğrulandı.' : 'Örnek soru biçimi ve cevap tutarlılığı doğrulandı. Soruları kullanmadan önce inceleyin.' });
    });
  }));
  router.post('/import-gemini', route(async (req, res) => {
    const input = z.object({ name: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(160) }).strict().safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Profil adı ve Gemini model kimliği gerekli.' });
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return res.status(400).json({ message: 'Sunucuda aktarılacak Gemini anahtarı bulunamadı.' });
    res.status(201).json(await (await dependencies.getStore()).save({ ...input.data, provider: 'google', baseURL: 'https://generativelanguage.googleapis.com/v1beta', apiKey }));
  }));
  return router;
}
