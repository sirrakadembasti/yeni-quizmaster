import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { login, api, prisma, assertIsolatedRuntime } from './student-audit-helpers';

const surveyId = '55555555-5555-4555-8555-555555555555';
const studentId = 'student-audit-student';
const answers = {
  'survey-q1': 'Student audit: more examples would help.',
  'survey-q2': 4,
  'survey-q3': 'B',
  'survey-q4': ['A', 'C'],
  'survey-q5': 'Katılıyorum',
};

test.describe('Student audit: surveys and shared functions', () => {
  test.beforeAll(() => { assertIsolatedRuntime(); });
  test.beforeEach(async ({ page }) => { await login(page); });

  test('all five survey types validate, submit once, persist real answers and remain completed after reload', async ({ page }) => {
    test.setTimeout(180000);
    const db = prisma();
    try {
      const detailResponse = await api(page, 'GET', `/api/surveys/${surveyId}`);
      expect(detailResponse.status()).toBe(200);
      const detail = await detailResponse.json();
      expect(detail.submitted).toBe(false);
      expect(detail.questions.map((q: any) => q.type)).toEqual(['open-text', 'rating', 'single-choice', 'multiple-choice', 'likert']);
      expect(detail.questions.every((q: any) => q.correctAnswer == null)).toBe(true);
      expect(await db.surveySubmission.count({ where: { surveyId, studentId } })).toBe(0);
      const invalid = [
        { answers: {} },
        { answers: { ...answers, 'unknown-question': 'Extra answer' } },
        { answers: { ...answers, 'survey-q1': '   ' } },
        { answers: { ...answers, 'survey-q1': 'x'.repeat(5001) } },
        ...[0, 6, 2.5, '4'].map(value => ({ answers: { ...answers, 'survey-q2': value } })),
        { answers: { ...answers, 'survey-q3': 'Outside option' } },
        { answers: { ...answers, 'survey-q4': [] } },
        { answers: { ...answers, 'survey-q4': ['Outside option'] } },
        { answers: { ...answers, 'survey-q5': 'Outside option' } },
      ];
      for (const payload of invalid) {
        const response = await api(page, 'POST', `/api/surveys/${surveyId}/submit`, payload);
        expect(response.status(), 'invalid answer submission').toBe(400);
        expect((await response.json()).message).toBeTruthy();
      }
      expect(await db.surveySubmission.count({ where: { surveyId, studentId } })).toBe(0);
      await page.goto('/student/surveys');
      await expect(page.getByRole('heading', { name: 'Anketlerim', exact: true })).toBeVisible();
      const listing = page.locator('.grid > div').filter({ hasText: detail.survey.title });
      await expect(listing).toContainText('Bekliyor');
      await listing.getByRole('button', { name: 'Anketi Yanıtla', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/student/survey/${surveyId}$`));
      await expect(page.getByRole('heading', { name: detail.survey.title, exact: true })).toBeVisible();
      const submit = page.getByRole('button', { name: 'Anketi Gönder', exact: true });
      await expect(submit).toBeDisabled();
      await page.locator('textarea').fill('   ');
      await expect(page.locator('textarea')).toHaveAttribute('maxlength', '5000');
      await page.getByRole('button', { name: '4', exact: true }).click();
      await page.getByRole('button', { name: 'B', exact: true }).click();
      // Checkboxes are nested in native labels; use their actual accessible names.
      await page.getByRole('checkbox', { name: 'A', exact: true }).check();
      await page.getByRole('checkbox', { name: 'C', exact: true }).check();
      await expect(page.getByRole('checkbox', { name: 'A', exact: true })).toBeChecked();
      await page.getByRole('checkbox', { name: 'A', exact: true }).uncheck();
      await expect(page.getByRole('checkbox', { name: 'A', exact: true })).not.toBeChecked();
      await page.getByRole('checkbox', { name: 'A', exact: true }).check();
      await expect(submit).toBeDisabled();
      await page.getByRole('button', { name: 'Katılıyorum', exact: true }).click();
      const rejected = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/surveys/${surveyId}/submit`);
      await submit.click();
      expect((await rejected).status()).toBe(400);
      await expect(page.getByText('Audit open response: Açık uçlu cevap 1-5000 karakter arasında olmalıdır.', { exact: true })).toBeVisible();
      expect(await db.surveySubmission.count({ where: { surveyId, studentId } })).toBe(0);
      await page.locator('textarea').fill(answers['survey-q1']);
      mkdirSync('tests/denetim-kanitlari/ogrenci/screenshots', { recursive: true });
      await page.screenshot({ path: 'tests/denetim-kanitlari/ogrenci/screenshots/survey-five-types-ready.png', fullPage: true });
      const pending = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/surveys/${surveyId}/submit`);
      await submit.click();
      const submitted = await pending;
      expect(submitted.status()).toBe(201);
      const result = await submitted.json();
      expect(result.submissionId).toBeTruthy();
      await expect(page).toHaveURL(/\/student\/surveys$/);
      await expect(listing).toContainText('Yanıtlandı');
      await expect(listing.getByRole('button', { name: 'Tamamlandı', exact: true })).toBeDisabled();
      const stored = await db.surveySubmission.findUnique({ where: { id: result.submissionId }, include: { answers: true } });
      expect(stored.studentId).toBe(studentId);
      expect(stored.surveyId).toBe(surveyId);
      expect(stored.answers).toHaveLength(5);
      for (const answer of stored.answers) {
        const actual = JSON.parse(answer.value), expected = answers[answer.questionId as keyof typeof answers];
        // Multi-select is a set: toggling A off/on legitimately changes order.
        expect(Array.isArray(actual) ? [...actual].sort() : actual).toEqual(Array.isArray(expected) ? [...expected].sort() : expected);
      }
      await page.reload();
      await expect(listing.getByRole('button', { name: 'Tamamlandı', exact: true })).toBeDisabled();
      await page.goto(`/student/survey/${surveyId}`);
      await expect(page.getByText('Bu anketi daha önce yanıtladınız.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Anketi Gönder', exact: true })).toHaveCount(0);
      const repeat = await api(page, 'POST', `/api/surveys/${surveyId}/submit`, { answers });
      expect(repeat.status()).toBe(409);
      expect((await repeat.json()).message).toBe('Bu anketi daha önce yanıtladınız.');
      expect(await db.surveySubmission.count({ where: { surveyId, studentId } })).toBe(1);
      expect(await db.surveyAnswer.count({ where: { submissionId: result.submissionId } })).toBe(5);
      await page.screenshot({ path: 'tests/denetim-kanitlari/ogrenci/screenshots/survey-completed-repeat-blocked.png', fullPage: true });
    } finally { await db.$disconnect(); }
  });

  test('foreign student cannot list, view or submit the own-class survey', async ({ page }) => {
    await login(page, 'student-audit-other@example.test');
    const list = await api(page, 'GET', '/api/surveys');
    expect(list.status()).toBe(200);
    const body = await list.json();
    expect(body.surveys.some((survey: any) => survey.id === surveyId)).toBe(false);
    expect(body.surveys).toHaveLength(0);
    expect((await api(page, 'GET', `/api/surveys/${surveyId}`)).status()).toBe(403);
    expect((await api(page, 'POST', `/api/surveys/${surveyId}/submit`, { answers })).status()).toBe(403);
    await page.goto('/student/surveys');
    await expect(page.getByText('Yanıtlamanız gereken anket bulunmuyor.', { exact: true })).toBeVisible();
    await page.goto(`/student/survey/${surveyId}`);
    await expect(page.getByText('Anket bulunamadı.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anketi Gönder', exact: true })).toHaveCount(0);
    const db = prisma();
    try { expect(await db.surveySubmission.count({ where: { surveyId, studentId: 'student-audit-other-student' } })).toBe(0); }
    finally { await db.$disconnect(); }
  });

  test('student profile is read-only in GUI and update API rejects changes', async ({ page }) => {
    const original = await (await api(page, 'GET', '/api/auth/me')).json();
    await page.goto('/settings');
    for (const name of ['Ad Soyad', 'E-posta', 'Telefon', 'Adres']) await expect(page.getByLabel(name, { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Değişiklikleri Kaydet', exact: true })).toHaveCount(0);
    await expect(page.getByText('Kişisel ve iletişim bilgilerinizde değişiklik yapmak istiyorsanız lütfen okul yönetimi ile iletişime geçiniz.', { exact: true })).toBeVisible();
    const rejected = await api(page, 'PATCH', '/api/auth/me', { name: 'Forbidden Student Profile Mutation' });
    expect(rejected.status()).toBe(403);
    expect((await rejected.json()).message).toContain('yalnızca okul yönetimi');
    const after = await (await api(page, 'GET', '/api/auth/me')).json();
    expect(after.user.name).toBe(original.user.name);
    await page.reload();
    await expect(page.getByLabel('Ad Soyad', { exact: true })).toHaveValue(original.user.name);
  });

  test('student security form validates mismatch and incorrect current password without mutation', async ({ page }) => {
    await page.goto('/settings?tab=security');
    await expect(page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true })).toBeDisabled();
    await page.getByLabel('Mevcut Şifre', { exact: true }).fill('WrongStudentAuditPassword!');
    await page.getByLabel('Yeni Şifre', { exact: true }).fill('StudentAuditTemporary2026!');
    await page.getByLabel('Yeni Şifre (Tekrar)', { exact: true }).fill('MismatchStudentAuditPassword!');
    await page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true }).click();
    await expect(page.getByText('Yeni şifreler uyuşmuyor.', { exact: true })).toBeVisible();
    await page.getByLabel('Yeni Şifre (Tekrar)', { exact: true }).fill('StudentAuditTemporary2026!');
    const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/change-password' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Şifreyi Güncelle', exact: true }).click();
    expect((await pending).status()).toBe(400);
    await expect(page.getByText('Mevcut şifreniz yanlış.', { exact: true })).toBeVisible();
    await login(page);
    expect((await api(page, 'GET', '/api/auth/me')).status()).toBe(200);
  });

  test('student notification sound preference persists and operation history is private', async ({ page }) => {
    const preferenceResponse = await api(page, 'GET', '/api/notifications/preferences');
    expect(preferenceResponse.status()).toBe(200);
    const before = await preferenceResponse.json();
    try {
      await page.goto('/settings?tab=notifications');
      const sound = page.getByRole('switch', { name: 'Bildirim sesini aç veya kapat', exact: true });
      await expect(sound).toHaveAttribute('aria-checked', String(!before.muted));
      await sound.click();
      await expect(sound).toHaveAttribute('aria-checked', String(before.muted));
      await page.reload();
      await expect(sound).toHaveAttribute('aria-checked', String(before.muted));
      const after = await (await api(page, 'GET', '/api/notifications/preferences')).json();
      expect(after.muted).toBe(!before.muted);
      await page.getByRole('tab', { name: 'İşlem Geçmişi', exact: true }).click();
      await expect(page).toHaveURL(/\/settings\?tab=logs$/);
      const logsResponse = await api(page, 'GET', '/api/admin/logs/me?limit=100');
      expect(logsResponse.status()).toBe(200);
      const logs = await logsResponse.json();
      expect(logs.logs.length).toBeGreaterThan(0);
      expect(logs.logs.every((entry: any) => entry.userId === studentId)).toBe(true);
      expect((await api(page, 'GET', '/api/admin/logs')).status()).toBe(403);
    } finally { expect((await api(page, 'PATCH', '/api/notifications/preferences', { muted: before.muted })).status()).toBe(200); }
  });

  test('student announcement target filtering is real and create/delete controls remain forbidden', async ({ page }) => {
    const db = prisma();
    const createdIds: string[] = [];
    try {
      const student = await db.user.findUnique({ where: { id: studentId } });
      const foreign = await db.user.findUnique({ where: { id: 'student-audit-other-student' } });
      const creator = await db.user.findFirst({ where: { role: 'teacher' } });
      expect(student.classId).toBeTruthy();
      expect(foreign.classId).not.toBe(student.classId);
      expect(creator).toBeTruthy();
      const cases = [
        { suffix: 'all visible', targetRole: 'all', targetClassId: null, visible: true },
        { suffix: 'students visible', targetRole: 'student', targetClassId: null, visible: true },
        { suffix: 'own class visible', targetRole: 'student', targetClassId: student.classId, visible: true },
        { suffix: 'foreign class hidden', targetRole: 'student', targetClassId: foreign.classId, visible: false },
        { suffix: 'teachers hidden', targetRole: 'teacher', targetClassId: null, visible: false },
      ];
      const records = [];
      for (const item of cases) {
        const row = await db.announcement.create({ data: { title: `Student audit ${item.suffix} ${Date.now()}`, content: 'Isolated student announcement fixture', createdBy: creator.id, targetRole: item.targetRole, targetClassId: item.targetClassId } });
        createdIds.push(row.id);
        records.push({ ...row, visible: item.visible });
      }
      const response = await api(page, 'GET', '/api/announcements');
      expect(response.status()).toBe(200);
      const list = await response.json();
      await page.goto('/announcements');
      await expect(page.getByRole('heading', { name: 'Duyuru Merkezi', exact: true })).toBeVisible();
      for (const row of records) {
        expect(list.announcements.some((ann: any) => ann.id === row.id)).toBe(row.visible);
        if (row.visible) await expect(page.getByRole('heading', { name: row.title, exact: true })).toBeVisible();
        else await expect(page.getByRole('heading', { name: row.title, exact: true })).toHaveCount(0);
      }
      await expect(page.getByRole('button', { name: 'Yeni Duyuru', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Duyuruyu sil', exact: true })).toHaveCount(0);
      expect((await api(page, 'POST', '/api/announcements', { title: 'Forbidden student announcement', content: 'Forbidden', targetRole: 'all' })).status()).toBe(403);
      expect((await api(page, 'DELETE', `/api/announcements/${createdIds[0]}`)).status()).toBe(403);
      expect(await db.announcement.count({ where: { id: { in: createdIds } } })).toBe(5);
    } finally {
      await db.announcement.deleteMany({ where: { id: { in: createdIds } } });
      await db.$disconnect();
    }
  });
});
