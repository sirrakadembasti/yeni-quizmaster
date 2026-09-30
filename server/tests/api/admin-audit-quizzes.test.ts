import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import quizRouter from '../../api-routes/quiz';
import dashboardRouter from '../../api-routes/dashboard';
import { storage } from '../../storage';

// Audit probes record current behavior. No application database or real session is used.
vi.mock('../../storage', () => ({ storage: {
  getAllQuizzes: vi.fn(), getQuizzesByCreator: vi.fn(), getQuiz: vi.fn(),
  getQuestionsByQuiz: vi.fn(), syncQuestions: vi.fn(), deleteQuiz: vi.fn(),
  createLog: vi.fn(), getAllUsers: vi.fn(), getAdminStats: vi.fn(),
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

  it('accepts an answer that is absent from selectable options', async () => {
    const response = await request(app).post('/quizzes/quiz-audit/questions').send([
      { text: 'Select A', options: ['A', 'B'], correctAnswer: 'C', type: 'multiple-choice' },
    ]);
    expect(response.status).toBe(201);
    expect(storage.syncQuestions).toHaveBeenCalledWith('quiz-audit', [expect.objectContaining({ correctAnswer: 'C', options: ['A', 'B'] })]);
  });

  it('allows replacing all questions in a published exam with an empty list', async () => {
    const response = await request(app).post('/quizzes/quiz-audit/questions').send([]);
    expect(response.status).toBe(201);
    expect(storage.syncQuestions).toHaveBeenCalledWith('quiz-audit', []);
  });

  it('quiz deletion succeeds without recording an audit action or reason', async () => {
    const response = await request(app).delete('/quizzes/quiz-audit').send({ reason: 'Audit reason' });
    expect(response.status).toBe(200);
    expect(storage.deleteQuiz).toHaveBeenCalledWith('quiz-audit');
    expect(storage.createLog).not.toHaveBeenCalled();
  });

  it('dashboard exam count includes survey records', async () => {
    vi.mocked(storage.getAllQuizzes).mockResolvedValue([{ contentType: 'exam' }, { contentType: 'survey' }] as any);
    vi.mocked(storage.getAdminStats).mockResolvedValue({ totalResults: 0, averageStudentScore: 0 });
    const response = await request(app).get('/dashboard/stats');
    expect(response.status).toBe(200);
    expect(response.body.stats.totalQuizzes).toBe(2);
  });
});
