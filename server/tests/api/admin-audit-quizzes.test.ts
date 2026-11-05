import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import quizRouter from '../../api-routes/quiz';
import dashboardRouter from '../../api-routes/dashboard';
import surveyRouter from '../../api-routes/survey';
import { storage } from '../../storage';

// Audit probes record current behavior. No application database or real session is used.
vi.mock('../../storage', () => ({ storage: {
  getAllQuizzes: vi.fn(), getQuizzesByCreator: vi.fn(), getQuiz: vi.fn(),
  getQuestionsByQuiz: vi.fn(), syncQuestions: vi.fn(), deleteQuiz: vi.fn(),
  createLog: vi.fn(), getAllUsers: vi.fn(), getAdminStats: vi.fn(), getDashboardStats: vi.fn(), deleteQuizWithAudit: vi.fn(), createQuiz: vi.fn(), updateQuiz: vi.fn(),
} }));
vi.mock('../../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: (roles: string[]) => (req: any, res: any, next: () => void) =>
    roles.includes(req.user.role) ? next() : res.sendStatus(403),
}));

const admin = { id: 'admin-audit', role: 'admin', name: 'Audit Admin' };
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => { req.user = admin; next(); });
app.use('/quizzes', quizRouter);
app.use('/dashboard', dashboardRouter);
app.use('/surveys', surveyRouter);

describe('Admin audit: quiz API current behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getAllUsers).mockResolvedValue([] as any);
    vi.mocked(storage.getQuiz).mockResolvedValue({ id: 'quiz-audit', title: 'Audit', status: 'published', contentType: 'exam', createdBy: 'teacher-audit' } as any);
    vi.mocked(storage.syncQuestions).mockResolvedValue([] as any);
  });

  it('admin ordinary quiz list omits teacher exams while admin list includes them', async () => {
    const teacherExam = { id: 'teacher-exam', createdBy: 'teacher-audit', contentType: 'exam' };
    vi.mocked(storage.getAllQuizzes).mockResolvedValue([teacherExam] as any);
    vi.mocked(storage.getQuizzesByCreator).mockResolvedValue([] as any);
    const ordinary = await request(app).get('/quizzes');
    const administrative = await request(app).get('/quizzes/admin/quizzes');
    expect(ordinary.status).toBe(200);
    expect(ordinary.body.quizzes).toEqual([]);
    expect(administrative.body.quizzes).toEqual([teacherExam]);
    expect(storage.getQuizzesByCreator).toHaveBeenCalledWith(admin.id);
  });

  it('rejects an answer that is absent from selectable options', async () => {
    const response = await request(app).post('/quizzes/quiz-audit/questions').send([
      { text: 'Select A', options: ['A', 'B'], correctAnswer: 'C', type: 'multiple-choice' },
    ]);
    expect(response.status).toBe(400);
    expect(storage.syncQuestions).not.toHaveBeenCalled();
  });

  it('rejects replacing all questions in a published exam with an empty list', async () => {
    const response = await request(app).post('/quizzes/quiz-audit/questions').send([]);
    expect(response.status).toBe(400);
    expect(storage.syncQuestions).not.toHaveBeenCalled();
  });

  it('quiz deletion passes actor and reason to the atomic audit operation', async () => {
    const response = await request(app).delete('/quizzes/quiz-audit').send({ reason: 'Audit reason' });
    expect(response.status).toBe(200);
    expect((storage as any).deleteQuizWithAudit).toHaveBeenCalledWith('quiz-audit', admin.id, 'Audit reason');
    expect(storage.deleteQuiz).not.toHaveBeenCalled();
  });

  it.each([['A', ''], ['A', 'A'], ['A', ' A ']])('rejects invalid options %j', async (...options) => {
    const response = await request(app).post('/quizzes/quiz-audit/questions').send([{ text: 'Question', options, correctAnswer: 'A' }]);
    expect(response.status).toBe(400);
  });

  it('rejects missing deletion reason and preserves the quiz on an audit failure', async () => {
    expect((await request(app).delete('/quizzes/quiz-audit')).status).toBe(400);
    (storage as any).deleteQuizWithAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    expect((await request(app).delete('/quizzes/quiz-audit').send({ reason: 'Audit reason' })).status).toBe(500);
    expect(storage.deleteQuiz).not.toHaveBeenCalled();
  });

  it.each(['/quizzes', '/surveys'])('rejects published creation without questions on %s', async (url) => {
    expect((await request(app).post(url).send({ title: 'Empty publication', status: 'published' })).status).toBe(400);
    expect(storage.createQuiz).not.toHaveBeenCalled();
  });

  it('protects a published survey against empty replacement', async () => {
    vi.mocked(storage.getQuiz).mockResolvedValue({ id: 'survey', status: 'published', contentType: 'survey' } as any);
    expect((await request(app).post('/surveys/survey/questions').send([])).status).toBe(400);
    expect(storage.syncQuestions).not.toHaveBeenCalled();
  });

  it.each(['/quizzes', '/surveys'])('rejects an empty publication through PATCH on %s', async (url) => {
    vi.mocked(storage.getQuiz).mockResolvedValue({ id:'content', contentType:url === '/quizzes' ? 'exam':'survey', status:'published' } as any);
    vi.mocked(storage.getQuestionsByQuiz).mockResolvedValue([]);
    expect((await request(app).patch(`${url}/content`).send({status:'published'})).status).toBe(400);
    expect(storage.updateQuiz).not.toHaveBeenCalled();
  });

  it('rejects duplicate survey options and permits clearing draft questions', async () => {
    vi.mocked(storage.getQuiz).mockResolvedValue({ id:'survey', contentType:'survey', status:'draft' } as any);
    expect((await request(app).post('/surveys/survey/questions').send([{text:'Question', type:'single-choice', options:['A',' A ']}])).status).toBe(400);
    expect((await request(app).post('/surveys/survey/questions').send([])).status).toBe(201);
  });

  it('returns bounded dashboard counts without loading every quiz or user', async () => {
    vi.mocked(storage.getDashboardStats).mockResolvedValue({ totalQuizzes: 2, totalStudents: 0, totalTeachers: 0, totalResults: 0, averageStudentScore: 0 });
    const response = await request(app).get('/dashboard/stats');
    expect(response.status).toBe(200);
    expect(response.body.stats.totalQuizzes).toBe(2);
    expect(storage.getDashboardStats).toHaveBeenCalledWith('admin', admin.id);
    expect(storage.getAllQuizzes).not.toHaveBeenCalled();
    expect(storage.getAllUsers).not.toHaveBeenCalled();
  });
});
