import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import session from 'express-session';
import { generateToken, csrfSynchronisedProtection } from '../../middleware/csrf';
vi.mock('../../middleware/auth', () => ({
  requireAuth(req: any, res: any, next: any) { const role = req.get('x-test-role'); if (!role) return res.sendStatus(401); req.user = { id: role, role }; next(); },
  requireRole: (roles: string[]) => (req: any, res: any, next: any) => roles.includes(req.user?.role) ? next() : res.sendStatus(403),
}));
vi.mock('../../services/archive-db', () => ({ archiveDb: {} }));
import { historicalRequestPolicy } from '../../middleware/academic-context';
import { createAIManagementRouter } from '../../api-routes/ai-management';
import { AIUsageService } from '../../services/ai-usage';
import { createAIRouter } from '../../api-routes/ai';
const store = { list: vi.fn(), getEnabled: vi.fn(), getForAdmin: vi.fn(), save: vi.fn(), remove: vi.fn(), setEnabled: vi.fn(), setDefault: vi.fn(), recordTest: vi.fn() };
const generate = vi.fn(); const getStore = vi.fn(async () => store as any);
const app = express(); app.use(express.json());
app.use('/admin', createAIManagementRouter({ getStore, generate }));
app.use('/ai', createAIRouter({ getStore, generate }));
const profile = { id: 'p', name: 'Tarih modeli', provider: 'custom', model: 'model', enabled: true, baseURL: 'https://provider.example/v1', apiKey: 'never-return-secret', revision: 1, transport: 'openai' };
beforeEach(() => {
  vi.clearAllMocks();
  store.list.mockResolvedValue({ profiles: [{ ...profile, apiKey: undefined, hasApiKey: true }], defaultProfileId: 'p', settingsRevision: 0 });
  store.getEnabled.mockResolvedValue(profile); store.getForAdmin.mockResolvedValue(profile); store.recordTest.mockResolvedValue(true);
  generate.mockResolvedValue('[{"text":"Bir artı iki?","type":"multiple-choice","options":["2","3","4"],"correctAnswer":"B"}]');
});
it.each([undefined, 'teacher', 'student', 'parent'])('rejects non-admin management access (%s)', async role => {
  const req = request(app).get('/admin/profiles'); if (role) req.set('x-test-role', role);
  expect((await req).status).toBe(role ? 403 : 401); expect(store.list).not.toHaveBeenCalled();
});
it.each(['student', 'parent'])('rejects %s model listing before store access', async role => {
  expect((await request(app).get('/ai/models').set('x-test-role', role)).status).toBe(403); expect(store.list).not.toHaveBeenCalled();
});
it('teacher sees only safe enabled model projection', async () => {
  const response = await request(app).get('/ai/models').set('x-test-role', 'teacher');
  expect(response.status).toBe(200); expect(response.body.models).toEqual([{ id: 'p', name: 'Tarih modeli', provider: 'custom', model: 'model' }]);
  expect(JSON.stringify(response.body)).not.toMatch(/baseURL|apiKey|never-return-secret|revision/);
});
it.each(['customBaseUrl', 'customApiKey', 'model'])('rejects %s override before provider call', async field => {
  const response = await request(app).post('/ai/generate-questions').set('x-test-role', 'teacher').send({ profileId: 'p', topic: 'Tarih', [field]: 'override' });
  expect(response.status).toBe(400); expect(generate).not.toHaveBeenCalled();
});
it('disabled model cannot be invoked and does not fall back', async () => {
  store.getEnabled.mockResolvedValue(null);
  const response = await request(app).post('/ai/generate-questions').set('x-test-role', 'teacher').send({ profileId: 'p', topic: 'Tarih' });
  expect(response.status).toBe(409); expect(generate).not.toHaveBeenCalled();
});
it('produces validated questions from the stored profile', async () => {
  const response = await request(app).post('/ai/generate-questions').set('x-test-role', 'teacher').send({ profileId: 'p', topic: 'Tarih', count: 1 });
  expect(response.status).toBe(200); expect(response.body.questions[0].correctAnswer).toBe('3');
  expect(generate.mock.calls[0][1]).toBe(profile);
});
it('retires teacher legacy config probing', async () => {
  expect((await request(app).post('/ai/test-config').set('x-test-role', 'teacher').send({})).status).toBe(403);
});
it('requires revision before admin deletion', async () => {
  expect((await request(app).delete('/admin/profiles/p').set('x-test-role', 'admin').send({})).status).toBe(400);
  expect(store.remove).not.toHaveBeenCalled();
});
it('sample test validates real question format, not just nonempty text', async () => {
  generate.mockResolvedValue('OK');
  const response = await request(app).post('/admin/profiles/p/test').set('x-test-role', 'admin').send({ revision: 1, mode: 'questions' });
  expect(response.status).toBe(502); expect(store.recordTest).toHaveBeenCalledWith('p', 1, 'questions', 'failed', expect.any(Object));
});
it('provider error content and credentials are not exposed', async () => {
  generate.mockRejectedValue(new Error('provider secret never-return-secret upstream debug'));
  const response = await request(app).post('/ai/generate-questions').set('x-test-role', 'teacher').send({ profileId: 'p', topic: 'Tarih', count: 1 });
  expect(response.status).toBe(502); expect(JSON.stringify(response.body)).not.toMatch(/never-return-secret|upstream debug/);
});
it('rejects malformed management input before persistence', async () => {
  expect((await request(app).post('/admin/profiles').set('x-test-role', 'admin').send({ name: 42, enabled: true })).status).toBe(400);
  expect(store.save).not.toHaveBeenCalled();
});
it('blocks duplicate generation until the first provider call settles', async () => {
  let finish!: (value: string) => void;
  generate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const first = request(app).post('/ai/generate-questions').set('x-test-role', 'teacher').send({ profileId: 'p', topic: 'Tarih', count: 1 }).then(response => response);
  await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
  const duplicate = await request(app).post('/ai/generate-questions').set('x-test-role', 'teacher').send({ profileId: 'p', topic: 'Tarih', count: 1 });
  finish('[{"text":"Soru","type":"short-answer","options":[],"correctAnswer":"Yanıt"}]');
  expect((await first).status).toBe(200); expect(duplicate.status).toBe(409); expect(generate).toHaveBeenCalledTimes(1);
});
it('allows only the installation AI namespace through historical policy', () => {
  expect(historicalRequestPolicy('POST', '/api/admin/ai/profiles')).toBeNull();
  expect(historicalRequestPolicy('DELETE', '/api/admin/ai/profiles/p')).toBeNull();
  expect(historicalRequestPolicy('POST', '/api/admin/ai-other/profiles')).toBe(403);
  expect(historicalRequestPolicy('POST', '/api/quizzes')).toBe(403);
  expect(historicalRequestPolicy('GET', '/api/users')).toBe(409);
});
it('uses the actual host session CSRF middleware for AI writes', async () => {
  const guarded = express(); guarded.use(express.json());
  guarded.use(session({ secret: 'synthetic-ai-csrf-fixture', resave: false, saveUninitialized: false }));
  guarded.get('/token', (req, res) => res.json({ token: generateToken(req) }));
  guarded.use(csrfSynchronisedProtection);
  guarded.use('/admin', createAIManagementRouter({ getStore, generate }));
  const agent = request.agent(guarded);
  const token = (await agent.get('/token')).body.token;
  expect((await agent.post('/admin/default').set('x-test-role', 'admin').send({ profileId: null, settingsRevision: 0 })).status).toBe(403);
  expect(store.setDefault).not.toHaveBeenCalled();
  expect((await agent.post('/admin/default').set('x-test-role', 'admin').set('x-csrf-token', token).send({ profileId: null, settingsRevision: 0 })).status).toBe(200);
});


function usageApp() {
 const usage={context:vi.fn().mockResolvedValue({draftId:'draft'}),start:vi.fn().mockResolvedValue('usage-id'),finish:vi.fn().mockResolvedValue(undefined),list:vi.fn().mockResolvedValue({rows:[],total:0})};
 const detailed=vi.fn().mockResolvedValue({text:'[{"text":"Soru","type":"short-answer","options":[],"correctAnswer":"Cevap"}]',usage:{inputTokens:10,outputTokens:50,reasoningTokens:20,cacheReadTokens:null,cacheWriteTokens:null,totalTokens:60}});
 const tracked=express();tracked.use(express.json());const deps={getStore,generate,generateDetailed:detailed,getUsage:async()=>usage as any};tracked.use('/ai',createAIRouter(deps));tracked.use('/admin',createAIManagementRouter(deps));return {tracked,usage,detailed};
}
it('records provider token metadata once without returning private metadata to teachers',async()=>{
 const {tracked,usage,detailed}=usageApp();
 const response=await request(tracked).post('/ai/generate-questions').set('x-test-role','teacher').send({profileId:'p',topic:'Tarih',count:1,context:{draftId:crypto.randomUUID(),quizTitle:'Tarih sınavı'}});
 expect(response.status).toBe(200);expect(detailed).toHaveBeenCalledTimes(1);expect(usage.finish).toHaveBeenCalledWith('usage-id',expect.objectContaining({status:'success',validQuestionCount:1,usage:expect.objectContaining({inputTokens:10,outputTokens:50})}));expect(response.body).not.toHaveProperty('usage');
});
it('records token consumption even when generated questions are invalid',async()=>{
 const {tracked,usage,detailed}=usageApp();detailed.mockResolvedValue({text:'not JSON',usage:{inputTokens:10,outputTokens:50}} as any);
 expect((await request(tracked).post('/ai/generate-questions').set('x-test-role','teacher').send({profileId:'p',topic:'Tarih',count:1})).status).toBe(502);
 expect(usage.finish).toHaveBeenCalledWith('usage-id',expect.objectContaining({status:'invalid',errorCode:'AI_INVALID_QUESTIONS',usage:expect.objectContaining({outputTokens:50})}));
});
it('does not call a provider when attribution is forbidden',async()=>{
 const {tracked,usage,detailed}=usageApp();usage.context.mockRejectedValue(Object.assign(new Error('Forbidden context'),{upstreamStatus:403}));
 await request(tracked).post('/ai/generate-questions').set('x-test-role','teacher').send({profileId:'p',topic:'Tarih',count:1});expect(detailed).not.toHaveBeenCalled();expect(usage.start).not.toHaveBeenCalled();
});
it.each([undefined,'teacher','student','parent'])('protects usage listing from %s',async role=>{
 const {tracked,usage}=usageApp();const req=request(tracked).get('/admin/usage');if(role)req.set('x-test-role',role);expect((await req).status).toBe(role?403:401);expect(usage.list).not.toHaveBeenCalled();
});
it('rejects invalid usage filters before querying and allows admin reads',async()=>{
 const {tracked,usage}=usageApp();expect((await request(tracked).get('/admin/usage?pageSize=500').set('x-test-role','admin')).status).toBe(400);expect(usage.list).not.toHaveBeenCalled();expect((await request(tracked).get('/admin/usage?pageSize=25').set('x-test-role','admin')).status).toBe(200);expect(usage.list).toHaveBeenCalledOnce();
});

it('finishes a disconnected request as cancelled without calling the provider again',async()=>{
 const {tracked,usage,detailed}=usageApp();
 detailed.mockImplementationOnce((_messages,_profile,options)=>new Promise((_resolve,reject)=>options.signal!.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true})));
 const req=request(tracked).post('/ai/generate-questions').set('x-test-role','teacher').send({profileId:'p',topic:'Tarih',count:1});
 const result=req.then(response=>response).catch(()=>undefined);await vi.waitFor(()=>expect(detailed).toHaveBeenCalledOnce());req.abort();await result;
 await vi.waitFor(()=>expect(usage.finish).toHaveBeenCalledWith('usage-id',expect.objectContaining({status:'cancelled'})));expect(detailed).toHaveBeenCalledOnce();
});
it('keeps successful questions when ledger completion writes are exhausted',async()=>{
 const {detailed}=usageApp();const update=vi.fn().mockRejectedValue(new Error('Injected ledger failure'));
 const ledger=new AIUsageService({aIUsage:{upsert:vi.fn().mockResolvedValue({id:'u'}),updateMany:update}} as any);
 const tracked=express();tracked.use(express.json());tracked.use('/ai',createAIRouter({getStore,generate,generateDetailed:detailed,getUsage:async()=>ledger}));
 const response=await request(tracked).post('/ai/generate-questions').set('x-test-role','teacher').send({profileId:'p',topic:'Tarih',count:1});
 expect(response.status).toBe(200);expect(response.body.questions).toHaveLength(1);expect(update).toHaveBeenCalledTimes(3);expect(detailed).toHaveBeenCalledOnce();
});
