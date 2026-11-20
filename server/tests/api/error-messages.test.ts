import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

vi.mock('../../storage', () => {
  const fns: Record<string, any> = {};
  return { storage: new Proxy(fns, { get: (target, key: string | symbol) => (typeof key === 'symbol' || key === 'then' ? undefined : (target[key] ??= vi.fn())) }) };
});
vi.mock('../../middleware/archive-readonly', () => ({
  archiveContentGuard: (_req: any, _res: any, next: any) => next(),
  archiveResultGuard: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../socket', () => ({
  getIO: () => ({ to: () => ({ emit: () => undefined }) }),
  disconnectUserSockets: () => undefined,
  disconnectSessionSockets: () => undefined,
}));
vi.mock('../../utils/email', () => ({ sendRegistrationSuccessEmail: vi.fn(async () => ({ id: 'email-1' })) }));

import { storage } from '../../storage';
import surveyRouter from '../../api-routes/survey';
import categoryRouter from '../../api-routes/category';
import classRouter from '../../api-routes/class';
import userRouter from '../../api-routes/user';
import { apiErrorHandler } from '../../middleware/error-handler';

const s = storage as any;
const admin = { id: 'admin-1', role: 'admin', isActive: true, sessionVersion: 0 };
const student = { id: 'student-1', role: 'student', isActive: true, sessionVersion: 0, classId: null };
const uuid = '11111111-1111-4111-8111-111111111111';
const prismaDetail = 'Invalid `prisma.thing.update()` invocation: connection secret detail';

function app(userId: string) {
  const a = express();
  a.use(express.json());
  a.use(session({ secret: 's06-test', resave: false, saveUninitialized: false }));
  a.use((req, _res, next) => { req.session.userId = userId; next(); });
  a.use('/api/surveys', surveyRouter);
  a.use('/api/categories', categoryRouter);
  a.use('/api/classes', classRouter);
  a.use('/api/users', userRouter);
  a.use(apiErrorHandler);
  return a;
}
const coded = (message: string, code: string) => Object.assign(new Error(message), { code });

beforeEach(() => {
  vi.clearAllMocks();
  s.getUser.mockImplementation(async (id: string) => (id === 'student-1' ? student : id === 'teacher-1' ? { id, role: 'teacher' } : id === 'admin-1' ? admin : undefined));
  s.createLog.mockResolvedValue(undefined);
});

describe('S-06: anket gönderimi', () => {
  const survey = { id: 'sv1', title: 'Anket', contentType: 'survey', status: 'published', assignedClasses: [] };
  const question = { id: 'q1', text: 'Soru', type: 'single-choice', options: ['A', 'B'] };
  beforeEach(() => {
    s.getQuiz.mockResolvedValue(survey);
    s.getStudentSurveySubmission.mockResolvedValue(undefined);
    s.getQuestionsByQuiz.mockResolvedValue([question]);
  });

  it('veritabanı hatasının iç ayrıntısını sızdırmaz', async () => {
    s.createSurveySubmission.mockRejectedValue(new Error(prismaDetail));
    const res = await request(app('student-1')).post('/api/surveys/sv1/submit').send({ answers: { q1: 'A' } }).timeout(5000);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Anket gönderilemedi.');
  });

  it('tekil kısıt (P2002) 409 döner', async () => {
    s.createSurveySubmission.mockRejectedValue(coded('x', 'P2002'));
    const res = await request(app('student-1')).post('/api/surveys/sv1/submit').send({ answers: { q1: 'A' } }).timeout(5000);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Bu anketi daha önce yanıtladınız.');
  });

  it('cevap doğrulama hatası 400 ve soru metniyle döner', async () => {
    const res = await request(app('student-1')).post('/api/surveys/sv1/submit').send({ answers: { q1: 'Z' } }).timeout(5000);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Soru: Geçerli bir seçenek işaretlenmelidir.');
  });
});

describe('S-06: ders (category)', () => {
  it('aynı adla ders → 409', async () => {
    s.createCategory.mockRejectedValue(coded('unique', 'P2002'));
    const res = await request(app('admin-1')).post('/api/categories').send({ name: 'Matematik' }).timeout(5000);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Bu adla bir ders zaten var.');
  });

  it('kullanımdaki ders silinemez → 409 ve storage iletisi', async () => {
    s.deleteCategory.mockRejectedValue(coded('Bu ders silinemez. Sadece adını değiştirebilirsiniz.', 'CATEGORY_IN_USE'));
    const res = await request(app('admin-1')).delete('/api/categories/c1').timeout(5000);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Bu ders silinemez. Sadece adını değiştirebilirsiniz.');
  });

  it('beklenmeyen hata sabit Türkçe iletiyle döner', async () => {
    s.deleteCategory.mockRejectedValue(new Error(prismaDetail));
    const del = await request(app('admin-1')).delete('/api/categories/c1').timeout(5000);
    expect(del.status).toBe(500);
    expect(del.body.message).toBe('Ders silinemedi.');

    s.createCategory.mockRejectedValue(new Error(prismaDetail));
    const post = await request(app('admin-1')).post('/api/categories').send({ name: 'Fizik' }).timeout(5000);
    expect(post.body.message).toBe('Ders oluşturulamadı.');

    s.getAllCategories.mockRejectedValue(new Error(prismaDetail));
    const get = await request(app('admin-1')).get('/api/categories').timeout(5000);
    expect(get.body.message).toBe('Dersler alınamadı.');

    s.updateCategory.mockResolvedValue(undefined);
    const missing = await request(app('admin-1')).put('/api/categories/c1').send({ name: 'Kimya' }).timeout(5000);
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Ders bulunamadı.');

    s.updateCategory.mockRejectedValue(new Error(prismaDetail));
    const put = await request(app('admin-1')).put('/api/categories/c1').send({ name: 'Kimya' }).timeout(5000);
    expect(put.body.message).toBe('Ders güncellenemedi.');
  });
});

describe('S-06: sınıf silme', () => {
  it('boş olmayan sınıf → 409 ve storage iletisi', async () => {
    s.deleteClass.mockRejectedValue(coded('Sınıf kapatılamaz/silinemez. Önce boşaltın.', 'CLASS_NOT_EMPTY'));
    const res = await request(app('admin-1')).delete('/api/classes/k1').timeout(5000);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Sınıf kapatılamaz/silinemez. Önce boşaltın.');
  });

  it('yıl geçiş kuralında kullanılan sınıf (P2003) → 409', async () => {
    s.deleteClass.mockRejectedValue(coded('FK', 'P2003'));
    const res = await request(app('admin-1')).delete('/api/classes/k1').timeout(5000);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Sınıf, yıl geçiş kurallarında kullanılıyor.');
  });
});

describe('S-06: error.message istemciye dönmez', () => {
  const cases: Array<[string, string, string, string, number, string]> = [
    ['post', '/api/classes/k1/categories', 'assignCategoryToClass', 'Ders sınıfa atanamadı.', 400, 'cat'],
    ['delete', '/api/classes/k1/categories/c1', 'removeCategoryFromClass', 'Ders sınıftan çıkarılamadı.', 400, ''],
    ['post', '/api/classes/teachers/t1/categories', 'assignCategoryToTeacher', 'Ders öğretmene atanamadı.', 400, 'cat'],
    ['delete', '/api/classes/teachers/t1/categories/c1', 'removeCategoryFromTeacher', 'Ders öğretmenden çıkarılamadı.', 400, ''],
    ['post', `/api/classes/k1/teachers-with-course`, 'assignTeacherToClassWithCourse', 'Öğretmen sınıfa atanamadı.', 500, 'both'],
    ['delete', '/api/classes/teacher-course/a1', 'removeTeacherFromClassWithCourse', 'Atama kaldırılamadı.', 500, ''],
    ['post', '/api/users/teacher-1/categories', 'assignCategoryToTeacher', 'Ders atanamadı.', 400, 'cat'],
    ['delete', '/api/users/teacher-1/categories/c1', 'removeCategoryFromTeacher', 'Ders kaldırılamadı.', 400, ''],
  ];
  it.each(cases)('%s %s', async (method, url, storageMethod, expected, status, bodyKind) => {
    s[storageMethod].mockRejectedValue(new Error(prismaDetail));
    const body = bodyKind === 'cat' ? { categoryId: 'c1' } : bodyKind === 'both' ? { teacherId: uuid, categoryId: uuid } : undefined;
    const res = await (request(app('admin-1')) as any)[method](url).send(body).timeout(5000);
    expect(res.status).toBe(status);
    expect(res.body.message).toBe(expected);
    expect(JSON.stringify(res.body)).not.toContain('prisma');
  });
});
