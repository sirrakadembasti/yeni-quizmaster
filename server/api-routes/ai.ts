import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth';
import { managedQuestionRequest, buildQuestionPrompt, parseGeneratedQuestions } from '../services/ai-question-format';
import { defaultAIDependencies, sendAIError, withAIOperation, type AIHandlerDependencies } from '../services/ai-http';
import { supportsQuestionJSON } from '../services/ai-provider-validation';
import { classifyLLMError, type AIUsageMetadata } from '../services/ai-runtime';

export function createAIRouter(dependencies: AIHandlerDependencies = defaultAIDependencies): Router {
  const router = Router();
  router.use(requireAuth, requireRole(['admin', 'teacher']));
  const generateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => (req as AuthRequest).user!.id,
    message: { code: 'AI_RATE_LIMIT', message: 'AI üretim sınırına ulaşıldı. Bir süre sonra tekrar deneyin.' },
  });
  router.get('/models', async (_req, res) => {
    try {
      const list = await (await dependencies.getStore()).list();
      const models = list.profiles.filter(p => p.enabled).map(p => ({ id: p.id, name: p.name, provider: p.provider, model: p.model }));
      res.set('Cache-Control', 'no-store').json({ models, defaultProfileId: models.some(p => p.id === list.defaultProfileId) ? list.defaultProfileId : null });
    } catch (error) { sendAIError(res, error); }
  });
  router.post('/test-config', requireRole(['admin']), (_req, res) => {
    res.status(410).json({ code: 'AI_CONFIG_MOVED', message: 'Bağlantı testini AI Yönetimi sayfasındaki kayıtlı profil üzerinden yapın.' });
  });
  router.post('/generate-questions', generateLimit, async (req: AuthRequest, res) => {
    const parsed = managedQuestionRequest.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Geçerli bir AI profili, konu ve 1–10 soru sayısı seçin. Özel bağlantı ayarları kabul edilmez.' }); return; }
    await withAIOperation(req, res, async signal => {
      const input = parsed.data;
      const profile = await (await dependencies.getStore()).getEnabled(input.profileId);
      if (!profile) { res.status(409).json({ code: 'AI_MODEL_UNAVAILABLE', message: 'Seçilen model artık kullanılamıyor. Model listesini yenileyin.' }); return; }
      const jsonObject = supportsQuestionJSON(profile);
      const usageService = dependencies.getUsage ? await dependencies.getUsage() : undefined;
      // Validate attribution separately: a logging failure must not bypass ownership.
      const context = usageService ? await usageService.context(req.user!, input.context || {}, input.contentType) : undefined;
      const usageId = context ? await usageService!.start(req.user!, profile, context, input.count) : null;
      const started = Date.now(); let usage: AIUsageMetadata | undefined, questions: ReturnType<typeof parseGeneratedQuestions> | undefined, failure: unknown;
      let status: 'success' | 'invalid' | 'error' | 'timeout' | 'cancelled' = 'success';
      try {
        const messages = [{ role: 'user' as const, content: buildQuestionPrompt(input, { jsonObject }) }];
        const options = { signal, purpose: 'questions' as const, jsonObject };
        let text: string;
        if (dependencies.generateDetailed) { const result = await dependencies.generateDetailed(messages, profile, options); text = result.text; usage = result.usage; }
        else text = await dependencies.generate(messages, profile, options);
        try { questions = parseGeneratedQuestions(text, input.count, input.contentType); }
        catch { throw Object.assign(new Error('Invalid AI questions'), { code: 'AI_INVALID_QUESTIONS' }); }
      } catch (error) {
        failure = error; usage ??= (error as { usage?: AIUsageMetadata })?.usage;
        const code = (error as {code?:string})?.code;
        status = signal.aborted ? 'cancelled' : code === 'AI_INVALID_QUESTIONS' ? 'invalid' : classifyLLMError(error).code === 'LLM_TIMEOUT' ? 'timeout' : 'error';
      } finally {
        if (signal.aborted) status = 'cancelled';
        if (usageId) await usageService!.finish(usageId, { status, durationMs: Date.now() - started, validQuestionCount: questions?.length, usage,
          errorCode: failure ? (failure as {code?:string})?.code === 'AI_INVALID_QUESTIONS' ? 'AI_INVALID_QUESTIONS' : classifyLLMError(failure).code : undefined });
      }
      if (signal.aborted) return;
      if (failure) {
        if (status === 'invalid') res.status(502).json({ code: 'AI_INVALID_QUESTIONS', message: 'AI yanıtı geçerli soru biçiminde değil. Yeniden deneyin.' });
        else sendAIError(res, failure);
        return;
      }
      res.json({ questions });
    });
  });
  return router;
}
export default createAIRouter();
