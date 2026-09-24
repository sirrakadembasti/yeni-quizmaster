import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import quizRouter from '../../api-routes/quiz';
import { storage } from '../../storage';

vi.mock('../../storage', () => ({
  storage: {
    getAllQuizzes: vi.fn(),
    getQuizzesByCreator: vi.fn(),
    getQuiz: vi.fn(),
    createQuiz: vi.fn(),
    updateQuiz: vi.fn(),
    deleteQuiz: vi.fn(),
    getQuestionsByQuiz: vi.fn(),
    createLog: vi.fn(),
    getAllCategories: vi.fn(),
    getAllUsers: vi.fn(),
    getResultsByQuiz: vi.fn(),
    getSurveySubmissions: vi.fn(),
  }
}));

const createTestApp = (user: { id: string, role: string }) => {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));

  // Mock session middleware
  app.use((req, res, next) => {
    (req as any).session.userId = user.id;
    (req as any).user = user; // Set user directly for routes
    next();
  });

  // Mock requireAuth to skip storage.getUser since user is already populated
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

  app.use('/api/quizzes', quizRouter);
  return app;
};

describe('Quizzes API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getAllUsers).mockResolvedValue([] as any);
    vi.mocked(storage.getResultsByQuiz).mockResolvedValue([] as any);
    vi.mocked(storage.getSurveySubmissions).mockResolvedValue([] as any);
  });

  describe('GET /api/quizzes/:id', () => {
    it('should allow teacher to view their own quiz', async () => {
      const teacherUser = { id: 'teacher-1', role: 'teacher' };
      const app = createTestApp(teacherUser);
      
      const mockQuiz = { id: 'quiz-1', title: 'Test Quiz', createdBy: 'teacher-1' };
      vi.mocked(storage.getQuiz).mockResolvedValue(mockQuiz as any);
      vi.mocked(storage.getQuestionsByQuiz).mockResolvedValue([] as any);

      const res = await request(app).get('/api/quizzes/quiz-1');

      expect(res.status).toBe(200);
      expect(res.body.quiz.title).toBe('Test Quiz');
    });

    it('should block teacher from viewing another teacher\'s quiz (IDOR test)', async () => {
      const teacherUser = { id: 'teacher-1', role: 'teacher' };
      const app = createTestApp(teacherUser);
      
      const mockQuiz = { id: 'quiz-1', title: 'Test Quiz', createdBy: 'teacher-2' };
      vi.mocked(storage.getQuiz).mockResolvedValue(mockQuiz as any);

      const res = await request(app).get('/api/quizzes/quiz-1');

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Bu sınavı görüntüleme yetkiniz yok.');
    });

    it('should allow admin to view any quiz', async () => {
      const adminUser = { id: 'admin-1', role: 'admin' };
      const app = createTestApp(adminUser);
      
      const mockQuiz = { id: 'quiz-1', title: 'Test Quiz', createdBy: 'teacher-2' };
      vi.mocked(storage.getQuiz).mockResolvedValue(mockQuiz as any);
      vi.mocked(storage.getQuestionsByQuiz).mockResolvedValue([] as any);

      const res = await request(app).get('/api/quizzes/quiz-1');

      expect(res.status).toBe(200);
      expect(res.body.quiz.title).toBe('Test Quiz');
    });
  });

  describe('POST /api/quizzes', () => {
    it('should return 400 for invalid data (zod validation)', async () => {
      const teacherUser = { id: 'teacher-1', role: 'teacher' };
      const app = createTestApp(teacherUser);

      const res = await request(app)
        .post('/api/quizzes')
        .send({ title: 'A' }); // Title too short

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Başlık en az 3 karakter olmalıdır.');
    });

    it('should create a quiz successfully', async () => {
      const teacherUser = { id: 'teacher-1', role: 'teacher' };
      const app = createTestApp(teacherUser);

      const validQuizData = {
        title: 'Valid Quiz',
        description: 'Test',
        difficulty: 'medium',
      };

      vi.mocked(storage.createQuiz).mockResolvedValue({ id: 'new-quiz', ...validQuizData } as any);

      const res = await request(app)
        .post('/api/quizzes')
        .send(validQuizData);

      expect(res.status).toBe(201);
      expect(storage.createQuiz).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Valid Quiz',
        createdBy: 'teacher-1'
      }));
    });
  });

  describe('PATCH /api/quizzes/:id', () => {
    it('should block teacher from updating another teacher\'s quiz', async () => {
      const teacherUser = { id: 'teacher-1', role: 'teacher' };
      const app = createTestApp(teacherUser);
      
      const mockQuiz = { id: 'quiz-1', title: 'Test Quiz', createdBy: 'teacher-2' };
      vi.mocked(storage.getQuiz).mockResolvedValue(mockQuiz as any);

      const res = await request(app)
        .patch('/api/quizzes/quiz-1')
        .send({ title: 'New Title' });

      expect(res.status).toBe(403);
    });

    it('should reject survey payloads on the exam endpoint', async () => {
      const teacherUser = { id: 'teacher-1', role: 'teacher' };
      const app = createTestApp(teacherUser);
      vi.mocked(storage.getQuiz).mockResolvedValue({
        id: 'quiz-1',
        title: 'Published Exam',
        createdBy: 'teacher-1',
        contentType: 'exam',
        status: 'published',
      } as any);

      const res = await request(app)
        .patch('/api/quizzes/quiz-1')
        .send({ contentType: 'survey' });

      expect(res.status).toBe(400);
      expect(storage.updateQuiz).not.toHaveBeenCalled();
    });

    it('should update quiz successfully if owner', async () => {
      const teacherUser = { id: 'teacher-1', role: 'teacher' };
      const app = createTestApp(teacherUser);
      
      const mockQuiz = { id: 'quiz-1', title: 'Test Quiz', createdBy: 'teacher-1' };
      vi.mocked(storage.getQuiz).mockResolvedValue(mockQuiz as any);
      vi.mocked(storage.updateQuiz).mockResolvedValue({ ...mockQuiz, title: 'New Title' } as any);

      const res = await request(app)
        .patch('/api/quizzes/quiz-1')
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
      expect(storage.updateQuiz).toHaveBeenCalledWith('quiz-1', expect.objectContaining({ title: 'New Title' }));
    });
  });
});
