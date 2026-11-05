import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { request as httpRequest } from 'node:http';
import studentRouter from '../../api-routes/student';
import { storage } from '../../storage';
import { captureTrustedRequestReceipt, getTrustedRequestReceipt } from '../../utils/request-receipt';
const receiptClock = vi.hoisted(() => ({ now: 1000000, sessionDelay: 0 }));
const socket = vi.hoisted(() => ({ to: vi.fn(), emit: vi.fn() }));

vi.mock('../../storage', () => ({ storage: {
  getQuiz: vi.fn(), getResult: vi.fn(), getQuestion: vi.fn(), getQuestionsByQuiz: vi.fn(),
  updateResult: vi.fn(), saveResultAnswer: vi.fn(), completeResult: vi.fn(), getUser: vi.fn(), createNotification: vi.fn(),
} }));
vi.mock('../../socket', () => ({ getIO: () => socket }));
// Route delegation/contracts only: never open a database.
vi.mock('../../middleware/archive-readonly', () => ({
  archiveContentGuard: (_req: any, _res: any, next: any) => next(),
  archiveResultGuard: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => req.user ? next() : res.status(401).json({ message: 'Unauthorized' }),
  requireRole: (roles: string[]) => (req: any, res: any, next: any) => roles.includes(req.user?.role) ? next() : res.status(403).json({ message: 'Forbidden' }),
}));
function createTestApp(role = 'student', onJson?: (body: any) => void) {
  const app = express(); app.use(express.json());
  app.use(captureTrustedRequestReceipt);
  app.use((_req, _res, next) => { receiptClock.now += receiptClock.sessionDelay; next(); });
  if (onJson) app.use((_req, res, next) => {
    const json = res.json.bind(res);
    res.json = body => { onJson(body); return json(body); };
    next();
  });
  app.use((req, _res, next) => { (req as any).user = { id: 'student-1', role }; next(); });
  app.use('/api/student', studentRouter);
  return app;
}
const app = createTestApp();
const answer = { questionId: '550e8400-e29b-41d4-a716-446655440000', selectedOption: 'A' };
function send() { return request(app).post('/api/student/quiz/result-1/answer').send(answer); }

describe('Student answer atomic delegation and response contracts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    socket.to.mockReturnThis();
    receiptClock.now = 1000000; receiptClock.sessionDelay = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => receiptClock.now);
    // Baseline prechecks pass, so failure specifically exposes redundant route reads.
    vi.mocked(storage.getResult).mockResolvedValue({ id: 'result-1', studentId: 'student-1', quizId: 'quiz-1', status: 'in_progress', startedAt: new Date() } as any);
    vi.mocked(storage.getQuiz).mockResolvedValue({ id: 'quiz-1', timeLimit: 30 } as any);
    vi.mocked(storage.getQuestion).mockResolvedValue({ id: answer.questionId, quizId: 'quiz-1', correctAnswer: 'A' } as any);
    vi.mocked(storage.saveResultAnswer).mockResolvedValue(undefined);
    vi.mocked(storage.completeResult).mockResolvedValue({ score: 100, correctAnswers: 1, totalQuestions: 1, acceptedQueuedAnswers: true, newlyCompleted: false });
  });
  afterEach(() => vi.restoreAllMocks());
  it('accepts a valid answer with exactly one atomic storage call and no route pre-reads', async () => {
    const response = await send();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Cevap kaydedildi.' });
    expect(storage.saveResultAnswer).toHaveBeenCalledExactlyOnceWith('result-1', 'student-1', answer.questionId, 'A', receiptClock.now);
    expect(storage.getResult).not.toHaveBeenCalled();
    expect(storage.getQuiz).not.toHaveBeenCalled();
    expect(storage.getQuestion).not.toHaveBeenCalled();
    expect(storage.getQuestionsByQuiz).not.toHaveBeenCalled();
    expect(storage.updateResult).not.toHaveBeenCalled();
  });
  it.each([
    ['RESULT_NOT_FOUND', 404, 'Sınav oturumu bulunamadı.'],
    ['RESULT_FORBIDDEN', 403, 'Bu sınav oturumu size ait değil.'],
    ['QUIZ_NOT_FOUND', 404, 'Quiz bulunamadı.'],
    ['RESULT_COMPLETED', 400, 'Bu sınav zaten tamamlanmış.'],
    ['RESULT_EXPIRED', 409, 'Sınav süresi dolduğu için cevap kaydedilemedi.'],
    ['INVALID_QUESTION_ID', 404, 'Soru bulunamadı.'],
  ])('maps atomic %s to its existing %s response contract', async (code, status, message) => {
    vi.mocked(storage.saveResultAnswer).mockRejectedValue(Object.assign(new Error(code), { code }));
    const response = await send();
    expect(response.status).toBe(status);
    expect(response.body).toEqual({ message });
    expect(storage.getResult).not.toHaveBeenCalled();
    expect(storage.getQuiz).not.toHaveBeenCalled();
    expect(storage.getQuestion).not.toHaveBeenCalled();
    expect(storage.updateResult).not.toHaveBeenCalled();
  });
  it('rejects malformed requests before any atomic write', async () => {
    const response = await request(app).post('/api/student/quiz/result-1/answer').send({ questionId: 'invalid', selectedOption: '' });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Geçersiz soru ID');
    expect(storage.saveResultAnswer).not.toHaveBeenCalled();
    expect(storage.getResult).not.toHaveBeenCalled();
  });
  it('keeps answer saving student-only', async () => {
    expect((await request(createTestApp('teacher')).post('/api/student/quiz/result-1/answer').send(answer)).status).toBe(403);
    expect(storage.saveResultAnswer).not.toHaveBeenCalled();
  });
  it('sends committed grading before waiting for best-effort notification, then persists before emitting', async () => {
    const responses: any[] = [];
    const events: string[] = [];
    const notification = { id: 'notice-1', userId: 'teacher-1', title: 'Sınav Teslim Edildi' };
    let started!: () => void, finish!: () => void, emitted!: () => void;
    const notificationStarted = new Promise<void>(resolve => { started = resolve; });
    const pendingNotification = new Promise<void>(resolve => { finish = resolve; });
    const notificationEmitted = new Promise<void>(resolve => { emitted = resolve; });
    let responseSentWhenNotificationStarted = false;
    vi.mocked(storage.completeResult).mockResolvedValue({ score: 100, correctAnswers: 1, totalQuestions: 1, acceptedQueuedAnswers: true, newlyCompleted: true });
    vi.mocked(storage.getUser).mockResolvedValue({ id: 'teacher-1', role: 'teacher' } as any);
    vi.mocked(storage.getQuiz).mockResolvedValue({ id: 'quiz-1', createdBy: 'teacher-1', title: 'Fixture quiz' } as any);
    vi.mocked(storage.createNotification).mockImplementation(async () => {
      responseSentWhenNotificationStarted = responses.length === 1;
      started(); await pendingNotification; events.push('persisted'); return notification as any;
    });
    socket.emit.mockImplementation(() => { events.push('emitted'); emitted(); });
    const response = request(createTestApp('student', body => responses.push(body))).post('/api/student/quiz/result-1/submit').send({ answers: { [answer.questionId]: 'A' } }).then(value => value);
    await notificationStarted;
    try {
      expect(responseSentWhenNotificationStarted).toBe(true);
      expect(responses).toEqual([{ score: 100, correctAnswers: 1, totalQuestions: 1, acceptedQueuedAnswers: true }]);
      // The HTTP client receives grading while notification persistence is still pending.
      expect((await response).status).toBe(200);
      expect(socket.emit).not.toHaveBeenCalled();
    } finally { finish(); await response; await notificationEmitted; }
    const result = await response; await notificationEmitted;
    expect(result.status).toBe(200);
    expect(result.body).not.toHaveProperty('newlyCompleted');
    expect(events).toEqual(['persisted', 'emitted']);
    expect(socket.to).toHaveBeenCalledWith('user_teacher-1');
    expect(socket.emit).toHaveBeenCalledWith('notification', notification);
    expect(storage.createNotification).toHaveBeenCalledTimes(1);
  });
  it('contains best-effort notification failure after sending the committed result', async () => {
    const responses: any[] = [];
    const failure = new Error('notification persistence failed');
    vi.mocked(storage.completeResult).mockResolvedValue({ score: 100, correctAnswers: 1, totalQuestions: 1, acceptedQueuedAnswers: true, newlyCompleted: true });
    vi.mocked(storage.getUser).mockResolvedValue({ id: 'teacher-1', role: 'teacher' } as any);
    vi.mocked(storage.createNotification).mockRejectedValue(failure);
    let logged!: () => void;
    const notificationFailed = new Promise<void>(resolve => { logged = resolve; });
    const log = vi.spyOn(console, 'error').mockImplementation(() => { logged(); });
    try {
      const response = await request(createTestApp('student', body => responses.push(body))).post('/api/student/quiz/result-1/submit').send({ answers: {} });
      await notificationFailed;
      expect(response.status).toBe(200);
      expect(responses).toEqual([{ score: 100, correctAnswers: 1, totalQuestions: 1, acceptedQueuedAnswers: true }]);
      expect(log).toHaveBeenCalledWith('Quiz submission notification error:', failure);
      expect(socket.emit).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it('does not create or emit duplicate notification for a previously completed submission', async () => {
    vi.mocked(storage.getUser).mockResolvedValue({ id: 'teacher-1', role: 'teacher' } as any);
    const response = await request(app).post('/api/student/quiz/result-1/submit').send({ answers: {} });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ score: 100, correctAnswers: 1, totalQuestions: 1, acceptedQueuedAnswers: true });
    expect(storage.createNotification).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });
  it('passes complete-body server receipt before session delay and ignores client timestamps', async () => {
    receiptClock.sessionDelay = 5000;
    expect((await request(app).post('/api/student/quiz/result-1/answer').send({ ...answer, receivedAt: 0 })).status).toBe(200);
    expect(storage.saveResultAnswer).toHaveBeenCalledWith('result-1', 'student-1', answer.questionId, 'A', 1000000);
  });
  it('passes the same trusted receipt to submit despite delayed session processing', async () => {
    receiptClock.sessionDelay = 5000;
    expect((await request(app).post('/api/student/quiz/result-1/submit').send({ answers: { [answer.questionId]: 'A' }, receivedAt: 0 })).status).toBe(200);
    expect(storage.completeResult).toHaveBeenCalledWith('result-1', 'student-1', { [answer.questionId]: 'A' }, 1000000);
  });
  it('keeps trusted receipt immutable when later middleware asks again', () => {
    const req = {} as any;
    captureTrustedRequestReceipt(req, {} as any, () => {});
    receiptClock.now += 5000;
    expect(getTrustedRequestReceipt(req)).toBe(1000000);
  });
  it('timestamps complete request bodies rather than early headers', async () => {
    const bodyApp = express();
    let headersSeen!: () => void;
    const headers = new Promise<void>(resolve => { headersSeen = resolve; });
    bodyApp.use((_req, _res, next) => { headersSeen(); next(); });
    bodyApp.use(express.json());
    bodyApp.use(captureTrustedRequestReceipt);
    bodyApp.post('/receipt', (req, res) => { receiptClock.now += 5000; res.json({ receipt: getTrustedRequestReceipt(req) }); });
    const server = bodyApp.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const body = JSON.stringify({ answer: 'A' });
      const port = (server.address() as import('node:net').AddressInfo).port;
      let incoming!: ReturnType<typeof httpRequest>;
      const response = new Promise<{ receipt: number }>((resolve, reject) => {
        incoming = httpRequest({ host: '127.0.0.1', port, path: '/receipt', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
          let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve(JSON.parse(data)));
        });
        incoming.on('error', reject); incoming.flushHeaders();
      });
      await headers;
      receiptClock.now = 2000000; // Body completes later than the headers.
      incoming.end(body);
      expect(await response).toEqual({ receipt: 2000000 });
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
  it('does not disguise an unexpected failure as a successful save', async () => {
    vi.mocked(storage.saveResultAnswer).mockRejectedValue(new Error('unexpected storage failure'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await send();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Cevap kaydedilemedi.' });
    } finally { log.mockRestore(); }
  });
});
