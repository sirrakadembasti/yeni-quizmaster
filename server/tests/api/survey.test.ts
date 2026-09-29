import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import surveyRouter from '../../api-routes/survey';
import { storage } from '../../storage';

vi.mock('../../storage', () => ({
  storage: {
    getUser: vi.fn(),
    getAllQuizzes: vi.fn(),
    getQuiz: vi.fn(),
    getQuestionsByQuiz: vi.fn(),
    getStudentSurveySubmission: vi.fn(),
    createSurveySubmission: vi.fn(),
    getSurveySubmissions: vi.fn(),
    createLog: vi.fn(),
    getClassesByTeacher: vi.fn(),
    getAllClasses: vi.fn(),
    getStudentsByClass: vi.fn(),
    createQuiz: vi.fn(),
    updateQuiz: vi.fn(),
    syncQuestions: vi.fn(),
  },
}));

function createApp(user: { id: string; role: string; classId?: string }) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'survey-test', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    (req.session as any).userId = user.id;
    next();
  });
  vi.mocked(storage.getUser).mockResolvedValue(user as any);
  app.use('/api/surveys', surveyRouter);
  return app;
}

const survey = {
  id: '4f9d2fd7-b035-426f-91e8-3c7fd8f01f42',
  title: 'Memnuniyet',
  contentType: 'survey',
  status: 'published',
  createdBy: 'teacher-1',
  assignedClasses: [{ id: 'class-1' }],
  audienceSize: 2,
};

const question = {
  id: 'ab46672b-fdbf-4815-aecd-f586de9bcacc',
  quizId: survey.id,
  text: 'Memnun musunuz?',
  type: 'single-choice',
  options: ['Evet', 'Hayır'],
  correctAnswer: null,
  config: null,
  order: 1,
};

describe('Survey API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getStudentSurveySubmission).mockResolvedValue(undefined);
  });

  it('creates surveys through the dedicated survey endpoint with a fixed content type', async () => {
    vi.mocked(storage.createQuiz).mockResolvedValue({ ...survey, status: 'draft' } as any);
    const response = await request(createApp({ id: 'admin-1', role: 'admin' }))
      .post('/api/surveys')
      .send({ title: 'Yeni Memnuniyet Anketi', status: 'draft', assignedClassIds: [] });

    expect(response.status).toBe(201);
    expect(storage.createQuiz).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'survey', timeLimit: null, shuffleQuestions: false }));
  });

  it('lists only surveys assigned to the student class', async () => {
    vi.mocked(storage.getAllQuizzes).mockResolvedValue([
      survey,
      { ...survey, id: '9f9d2fd7-b035-426f-91e8-3c7fd8f01f43', assignedClasses: [{ id: 'class-2' }] },
      { ...survey, id: '9f9d2fd7-b035-426f-91e8-3c7fd8f01f44', contentType: 'exam' },
    ] as any);
    const response = await request(createApp({ id: 'student-1', role: 'student', classId: 'class-1' })).get('/api/surveys');
    expect(response.status).toBe(200);
    expect(response.body.surveys).toHaveLength(1);
    expect(response.body.surveys[0].id).toBe(survey.id);
  });

  it('blocks a student from opening a survey assigned to another class', async () => {
    vi.mocked(storage.getQuiz).mockResolvedValue({ ...survey, assignedClasses: [{ id: 'class-2' }] } as any);
    const response = await request(createApp({ id: 'student-1', role: 'student', classId: 'class-1' })).get('/api/surveys/' + survey.id);
    expect(response.status).toBe(403);
  });

  it('stores survey answers without score or correct answer fields', async () => {
    vi.mocked(storage.getQuiz).mockResolvedValue(survey as any);
    vi.mocked(storage.getQuestionsByQuiz).mockResolvedValue([question] as any);
    vi.mocked(storage.createSurveySubmission).mockResolvedValue({ id: 'submission-1', submittedAt: new Date() } as any);
    const response = await request(createApp({ id: 'student-1', role: 'student', classId: 'class-1' }))
      .post('/api/surveys/' + survey.id + '/submit')
      .send({ answers: { [question.id]: 'Evet' } });
    expect(response.status).toBe(201);
    expect(storage.createSurveySubmission).toHaveBeenCalledWith(survey.id, 'student-1', [{ questionId: question.id, value: 'Evet' }]);
  });

  it('rejects duplicate submissions', async () => {
    vi.mocked(storage.getQuiz).mockResolvedValue(survey as any);
    vi.mocked(storage.getStudentSurveySubmission).mockResolvedValue({ id: 'existing' } as any);
    const response = await request(createApp({ id: 'student-1', role: 'student', classId: 'class-1' }))
      .post('/api/surveys/' + survey.id + '/submit')
      .send({ answers: { [question.id]: 'Evet' } });
    expect(response.status).toBe(409);
  });

  it('returns aggregated results to admin', async () => {
    vi.mocked(storage.getAllQuizzes).mockResolvedValue([survey] as any);
    vi.mocked(storage.getQuestionsByQuiz).mockResolvedValue([question] as any);
    vi.mocked(storage.getSurveySubmissions).mockResolvedValue([
      { submittedAt: new Date(), student: { name: 'Öğrenci' }, answers: [{ questionId: question.id, value: JSON.stringify('Evet') }] },
    ] as any);
    const response = await request(createApp({ id: 'admin-1', role: 'admin' })).get('/api/surveys/results?surveyId=' + survey.id);
    expect(response.status).toBe(200);
    expect(response.body.surveys[0]).toMatchObject({ participantCount: 1, audienceSize: 2, participationRate: 50 });
    expect(response.body.surveys[0].questionResults[0]).toMatchObject({
      responseCount: 1,
      totalSelections: 1,
      distribution: [{ label: 'Evet', count: 1 }, { label: 'Hay\u0131r', count: 0 }],
    });
  });
});
