/// <reference types="../../server/node_modules/vitest/globals" />
import express from '../../server/node_modules/express';
import session from '../../server/node_modules/express-session';
import request from '../../server/node_modules/supertest';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), getUser: vi.fn() }));
vi.mock('../../server/storage', () => ({ storage: { getUser: mocks.getUser } }));
vi.mock('../../server/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../server/utils/external-request', async (load) => ({
  ...(await load<typeof import('../../server/utils/external-request')>()),
  safeExternalFetch: mocks.fetch,
}));
import aiRouter from '../../server/api-routes/ai';

const official = 'https://generativelanguage.googleapis.com/v1beta/openai/';
function app(role: string | null = 'teacher') {
  const instance = express();
  instance.use(express.json());
  instance.use(session({ secret: 'synthetic-audit-only', resave: false, saveUninitialized: false }));
  instance.use((req, _res, next) => {
    if (role) req.session.userId = role;
    next();
  });
  instance.use('/ai', aiRouter);
  return instance;
}
function response(content: unknown, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}
const question = { text: '2 + 2?', type: 'multiple-choice', options: ['3', '4', '5'], correctAnswer: '4' };

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'synthetic-server-key');
  mocks.fetch.mockReset();
  mocks.getUser.mockReset().mockImplementation(async (id) => ({ id, role: id, isActive: true, sessionVersion: 0 }));
});
afterEach(() => vi.unstubAllEnvs());

describe('Offline AI router audit: provider mocked, no Google calls, no database', () => {
  it.each([null, 'student', 'parent'])('denies generation for role %s before provider call', async (role) => {
    const result = await request(app(role)).post('/ai/generate-questions').send({ topic: 'Synthetic arithmetic' });
    expect(result.status).toBe(role ? 403 : 401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('accepts official connection test and sends bounded synthetic probe', async () => {
    mocks.fetch.mockResolvedValue(response('hi'));
    const result = await request(app()).post('/ai/test-config').send({ model: 'synthetic-model' });
    expect(result.status).toBe(200);
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe(official + 'chat/completions');
    expect(JSON.parse(options.body).max_tokens).toBe(5);
    expect(options.headers.Authorization).toBe('Bearer synthetic-server-key');
  });
  it('never sends server key to a custom provider', async () => {
    const result = await request(app()).post('/ai/generate-questions').send({ topic: 'Synthetic arithmetic', customBaseUrl: 'https://provider.example/v1/' });
    expect(result.status).toBe(500);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('uses only explicit custom-provider key', async () => {
    mocks.fetch.mockResolvedValue(response(JSON.stringify([question])));
    const result = await request(app()).post('/ai/generate-questions').send({ topic: 'Synthetic arithmetic', customBaseUrl: 'https://provider.example/v1/', customApiKey: 'synthetic-custom-key' });
    expect(result.status).toBe(200);
    expect(mocks.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-custom-key');
  });
  it.each(['https://localhost/', 'https://127.0.0.1/', 'http://provider.example/'])('rejects unsafe generation URL %s', async (customBaseUrl) => {
    const result = await request(app()).post('/ai/generate-questions').send({ topic: 'Synthetic arithmetic', customBaseUrl, customApiKey: 'synthetic-custom-key' });
    expect(result.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([
    JSON.stringify([question]),
    JSON.stringify({ questions: [question] }),
    '```json\n' + JSON.stringify([question]) + '\n```',
    'Synthetic explanation: ' + JSON.stringify([question]) + ' End.',
  ])('parses supported response wrapper %# and preserves answer after shuffle', async (content) => {
    mocks.fetch.mockResolvedValue(response(content));
    const result = await request(app()).post('/ai/generate-questions').send({ topic: 'Synthetic arithmetic', count: 1 });
    expect(result.status).toBe(200);
    const q = result.body.questions[0];
    expect(q.options[q.correctAnswerIndex]).toBe(q.correctAnswer);
  });
  it('preserves unscored survey configuration', async () => {
    const survey = { text: 'Synthetic satisfaction?', type: 'rating', options: [], correctAnswer: null, config: { max: 5 } };
    mocks.fetch.mockResolvedValue(response(JSON.stringify([survey])));
    const result = await request(app()).post('/ai/generate-questions').send({ topic: 'Synthetic survey', count: 1, contentType: 'survey' });
    expect(result.status).toBe(200);
    expect(result.body.questions[0]).toEqual(survey);
  });
  it.each(['not JSON', JSON.stringify([{ text: '', type: 'multiple-choice', correctAnswer: 'x' }]), ''])('rejects malformed or empty provider content %#', async (content) => {
    mocks.fetch.mockResolvedValue(response(content));
    const result = await request(app()).post('/ai/generate-questions').send({ topic: 'Synthetic arithmetic' });
    expect(result.status).toBe(500);
  });
  it('maps provider rejection to generation failure', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Synthetic quota rejection' } }), { status: 429 }));
    const result = await request(app()).post('/ai/generate-questions').send({ topic: 'Synthetic arithmetic' });
    expect(result.status).toBe(500);
    expect(result.body.details).toBe('Synthetic quota rejection');
  });
  it('maps abort to timeout failure', async () => {
    mocks.fetch.mockRejectedValue(Object.assign(new Error('Synthetic timeout'), { name: 'AbortError' }));
    const result = await request(app()).post('/ai/generate-questions').send({ topic: 'Synthetic arithmetic' });
    expect(result.status).toBe(502);
    expect(result.body.message).toContain('Timeout');
  });
  it('records defect: empty generated array is accepted', async () => {
    mocks.fetch.mockResolvedValue(response('[]'));
    const result = await request(app()).post('/ai/generate-questions').send({ topic: 'Synthetic arithmetic', count: 1 });
    expect(result.status).toBe(200);
    expect(result.body.questions).toEqual([]);
  });
  it('records defect: invalid answer silently selects option zero', async () => {
    mocks.fetch.mockResolvedValue(response(JSON.stringify([{ ...question, correctAnswer: 'missing' }])));
    const result = await request(app()).post('/ai/generate-questions').send({ topic: 'Synthetic arithmetic' });
    expect(result.status).toBe(200);
    expect(result.body.questions[0].correctAnswerIndex).toBe(0);
    expect(result.body.questions[0].options).not.toContain(result.body.questions[0].correctAnswer);
  });
  it('records defect: missing topic and negative count reach provider', async () => {
    mocks.fetch.mockResolvedValue(response(JSON.stringify([question])));
    const result = await request(app()).post('/ai/generate-questions').send({ count: -1 });
    expect(result.status).toBe(200);
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).messages[0].content).toContain('Generate -1');
  });
});
