/// <reference types="../../server/node_modules/vitest/globals" />
import express from '../../server/node_modules/express';
import session from '../../server/node_modules/express-session';
import request from '../../server/node_modules/supertest';
import dotenv from '../../server/node_modules/dotenv';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../server/storage', () => ({ storage: { getUser: async () => ({ id: 'synthetic-live-ai-teacher', role: 'teacher', isActive: true, sessionVersion: 0 }) } }));
vi.mock('../../server/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
import aiRouter from '../../server/api-routes/ai';

const root = resolve(import.meta.dirname, '../..');
const serverEnv = existsSync(resolve(root, 'server/.env')) ? dotenv.parse(readFileSync(resolve(root, 'server/.env'))) : {};
const rootEnv = existsSync(resolve(root, '.env')) ? dotenv.parse(readFileSync(resolve(root, '.env'))) : {};
const key = process.env.GEMINI_API_KEY || serverEnv.GEMINI_API_KEY || rootEnv.GEMINI_API_KEY;
// Opt-in required: this audit performs at most two real, potentially billed provider requests.
const enabled = process.env.LIVE_AI === '1' && Boolean(key);
const evidence: Record<string, unknown> = {
  testKind: 'real-official-Google-provider',
  configured: Boolean(key),
  authorizedInvocation: process.env.LIVE_AI === '1',
  status: enabled ? 'pending' : 'blocked',
  ...(!enabled ? { blockedReason: !key ? 'GEMINI_API_KEY unavailable to runtime' : 'LIVE_AI opt-in required' } : {}),
  providerRequests: 0,
  usesRealApplicationDatabase: false,
};

function saveEvidence() {
  writeFileSync(resolve(root, 'docs/integration-audit/ai-live-evidence.json'), JSON.stringify(evidence, null, 2));
}
// Vitest may omit suite hooks when its only case is skipped; persist the blocked state now.
saveEvidence();
afterAll(saveEvidence);

it.skipIf(!enabled)('official-provider synthetic connection then one validated arithmetic question', async () => {
  process.env.GEMINI_API_KEY = key;
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'synthetic-live-ai-audit-only', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => { req.session.userId = 'synthetic-live-ai-teacher'; next(); });
  app.use('/ai', aiRouter);

  // Deliberately omit model: exercises application's actual default, no guessed replacement.
  const probe = await request(app).post('/ai/test-config').send({});
  evidence.providerRequests = 1;
  evidence.probeHttpStatus = probe.status;
  evidence.probeSucceeded = probe.body.success === true;
  const detail = String(probe.body.details || '').toLowerCase();
  evidence.providerErrorCategory = probe.status === 200 ? null
    : /billing|payment|credit|balance/.test(detail) ? 'payment-or-billing'
    : /quota|rate.limit|resource.exhausted/.test(detail) ? 'quota-or-rate-limit'
    : /api.key|authentication|unauthoriz|credential/.test(detail) ? 'credentials'
    : /model|not.found/.test(detail) ? 'model-or-endpoint' : 'unclassified';
  if (probe.status !== 200 || probe.body.success !== true) {
    evidence.status = 'failed';
    evidence.failureStage = 'connection-probe';
    // Never copy provider free-text error or response body into evidence.
    expect(probe.status, 'Official provider connection probe failed; inspect sanitized status evidence').toBe(200);
    expect(probe.body.success).toBe(true);
    return;
  }
  const generated = await request(app).post('/ai/generate-questions').send({
    topic: 'Synthetic integration audit: elementary addition using only numbers, no names or personal information',
    count: 1,
    difficulty: 'easy',
  });
  evidence.providerRequests = 2;
  evidence.generationHttpStatus = generated.status;
  evidence.status = 'failed';
  evidence.failureStage = 'generation-or-validation';
  expect(generated.status, 'Question generation failed; inspect sanitized status evidence').toBe(200);
  const questions = generated.body.questions;
  evidence.questionCount = Array.isArray(questions) ? questions.length : null;
  evidence.questionType = Array.isArray(questions) && typeof questions[0]?.type === 'string' ? questions[0].type : null;
  evidence.answerIndexValidated = false;
  expect(Array.isArray(questions)).toBe(true);
  expect(questions.length).toBe(1);
  const question = questions[0];
  expect(question.type).toBe('multiple-choice');
  expect(question.text.length).toBeGreaterThan(0);
  expect(question.options.length).toBeGreaterThan(1);
  expect(question.options[question.correctAnswerIndex]).toBe(question.correctAnswer);
  evidence.answerIndexValidated = true;
  evidence.status = 'passed';
  delete evidence.failureStage;
  delete evidence.blockedReason;
});
