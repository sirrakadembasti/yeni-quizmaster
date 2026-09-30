import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import studentRouter from '../../api-routes/student';
import { storage } from '../../storage';

vi.mock('../../storage', () => ({
  storage: {
    getQuiz: vi.fn(),
    getResult: vi.fn(),
    getQuestion: vi.fn(),
    getQuestionsByQuiz: vi.fn(),
    updateResult: vi.fn(),
    saveResultAnswer: vi.fn(),
    getUser: vi.fn(),
    createNotification: vi.fn(),
  }
}));

vi.mock('../../socket', () => ({
  getIO: () => ({
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  }),
}));

const createTestApp = (user: { id: string, role: string, classId?: string }) => {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));

  // Mock session
  app.use((req, res, next) => {
    (req as any).session.userId = user.id;
    (req as any).user = user;
    next();
  });

  // Mock requireAuth
  vi.mock('../../middleware/auth', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
      ...actual,
      requireAuth: (req: any, res: any, next: any) => {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });
        next();
      }
    };
  });

  app.use('/api/student', studentRouter);
  return app;
};

describe('Student Exam Security & Timelimit Integration Tests', () => {
  const studentUser = { id: 'student-1', role: 'student', classId: 'class-1' };
  const app = createTestApp(studentUser);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept answer when submitted within time limit', async () => {
    const mockResult = {
      id: 'result-1',
      studentId: 'student-1',
      quizId: 'quiz-1',
      status: 'in_progress',
      startedAt: new Date(Date.now() - 5 * 60 * 1000), // Started 5 mins ago
      answers: {},
    };
    const mockQuiz = {
      id: 'quiz-1',
      title: 'Zamanlı Sınav',
      timeLimit: 30, // 30 minutes limit
    };
    const mockQuestion = {
      id: 'q1',
      quizId: 'quiz-1',
      correctAnswer: 'A',
    };

    vi.mocked(storage.getResult).mockResolvedValue(mockResult as any);
    vi.mocked(storage.getQuiz).mockResolvedValue(mockQuiz as any);
    vi.mocked(storage.getQuestion).mockResolvedValue(mockQuestion as any);
    vi.mocked(storage.getQuestionsByQuiz).mockResolvedValue([mockQuestion] as any);
    vi.mocked(storage.updateResult).mockResolvedValue({ ...mockResult } as any);

    const res = await request(app)
      .post('/api/student/quiz/result-1/answer')
      .send({ questionId: '550e8400-e29b-41d4-a716-446655440000', selectedOption: 'A' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Cevap kaydedildi.');
    expect(storage.saveResultAnswer).toHaveBeenCalledWith('result-1', 'student-1', '550e8400-e29b-41d4-a716-446655440000', 'A');
  });

  it('should reject answer with 409 Conflict when exam time has expired', async () => {
    const mockResult = {
      id: 'result-1',
      studentId: 'student-1',
      quizId: 'quiz-1',
      status: 'in_progress',
      startedAt: new Date(Date.now() - 35 * 60 * 1000), // Started 35 mins ago
      answers: {},
    };
    const mockQuiz = {
      id: 'quiz-1',
      title: 'Süresi Dolan Sınav',
      timeLimit: 30, // 30 minutes limit -> EXPIRED!
    };

    vi.mocked(storage.getResult).mockResolvedValue(mockResult as any);
    vi.mocked(storage.getQuiz).mockResolvedValue(mockQuiz as any);

    const res = await request(app)
      .post('/api/student/quiz/result-1/answer')
      .send({ questionId: '550e8400-e29b-41d4-a716-446655440000', selectedOption: 'A' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Sınav süresi dolduğu için cevap kaydedilemedi');
    expect(storage.updateResult).not.toHaveBeenCalled();
  });

  it('should block IDOR attempt to submit answer to another student session', async () => {
    const otherStudentResult = {
      id: 'result-2',
      studentId: 'other-student-999',
      quizId: 'quiz-1',
      status: 'in_progress',
      startedAt: new Date(),
      answers: {},
    };

    vi.mocked(storage.getResult).mockResolvedValue(otherStudentResult as any);

    const res = await request(app)
      .post('/api/student/quiz/result-2/answer')
      .send({ questionId: '550e8400-e29b-41d4-a716-446655440000', selectedOption: 'B' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Bu sınav oturumu size ait değil.');
    expect(storage.updateResult).not.toHaveBeenCalled();
  });

  it('should block answers to already completed exams with 400 Bad Request', async () => {
    const completedResult = {
      id: 'result-1',
      studentId: 'student-1',
      quizId: 'quiz-1',
      status: 'completed',
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
      answers: {},
    };

    vi.mocked(storage.getResult).mockResolvedValue(completedResult as any);

    const res = await request(app)
      .post('/api/student/quiz/result-1/answer')
      .send({ questionId: '550e8400-e29b-41d4-a716-446655440000', selectedOption: 'C' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Bu sınav zaten tamamlanmış.');
    expect(storage.updateResult).not.toHaveBeenCalled();
  });
});
