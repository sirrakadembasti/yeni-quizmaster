import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { classifyLLMError, generateProfileResponse, generateProfileResponseDetailed } from './ai-runtime';
import { getAIUsageService, type AIUsageService } from './ai-usage';
import { AIManagementError, type AIProfileStore } from './ai-profiles';
import { getAIProfileStore } from './ai-management-instance';

export interface AIHandlerDependencies {
  getStore: () => Promise<AIProfileStore>;
  generate: typeof generateProfileResponse;
  generateDetailed?: typeof generateProfileResponseDetailed;
  getUsage?: () => Promise<AIUsageService>;
}
export const defaultAIDependencies: AIHandlerDependencies = { getStore: getAIProfileStore, generate: generateProfileResponse, generateDetailed: generateProfileResponseDetailed, getUsage: getAIUsageService };
const pending = new Set<string>();
export async function withAIOperation(req: AuthRequest, res: Response, work: (signal: AbortSignal) => Promise<void>) {
  const key = req.user!.id;
  if (pending.has(key)) { res.status(409).json({ code: 'AI_IN_PROGRESS', message: 'AI işleminiz devam ediyor. Tamamlanmasını bekleyin.' }); return; }
  pending.add(key);
  const controller = new AbortController();
  const closed = () => { if (!res.writableEnded) controller.abort(); };
  res.once('close', closed);
  try { await work(controller.signal); }
  catch (error) { if (!res.destroyed && !res.headersSent) sendAIError(res, error); }
  finally { pending.delete(key); res.off('close', closed); }
}
export function sendAIError(res: Response, error: unknown) {
  if (error instanceof AIManagementError) { res.status(error.status).json({ code: error.code, message: error.message }); return; }
  // Never echo key-file, database or upstream error details.
  const classified = classifyLLMError(error);
  res.status(classified.status).json({ code: classified.code, message: classified.message });
}
