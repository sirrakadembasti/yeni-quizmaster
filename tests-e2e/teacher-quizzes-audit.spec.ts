import { test, expect, type Page } from '@playwright/test';
import { login, api, assertIsolatedRuntime } from './teacher-audit-helpers';

// Real isolated UI/API audit. No route interception or synthetic success responses.
// The teacher quiz list has no sort control and the app has no material editor.
test.describe('Teacher audit: quizzes and survey creation', () => {
  let cleanup: Array<{ id: string; kind: 'quizzes' | 'surveys' }> = [];
  test.beforeAll(() => { assertIsolatedRuntime(); });
  test.beforeEach(async ({ page }) => { cleanup = []; await login(page); });
  test.afterEach(async ({ page }) => {
    // Every item here is created by this test; never delete seeded quiz/results.
    for (const item of cleanup) {
      // Surveys share quiz storage; the audited deletion route accepts both types.
      const result = await api(page, `/quizzes/${item.id}`, 'DELETE', { reason: 'Teacher audit isolated test cleanup' });
      expect([200, 404], `cleanup ${item.kind}/${item.id}`).toContain(result.status);
    }
  });

  const uniqueTitle = (suffix: string) => `Teacher UI audit ${suffix} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  async function save(page: Page, kind: 'quizzes' | 'surveys', button: string, isNew = false) {
    const pending = page.waitForResponse(response =>
      response.request().method() === 'PUT' && new RegExp(`/api/${kind}/[^/]+/content$`).test(new URL(response.url()).pathname));
    await page.getByRole('button', { name: button, exact: true }).click();
    const response = await pending;
    const body = await response.json();
    const item = body.quiz || body.survey;
    if (isNew && item?.id) cleanup.push({ kind, id: item.id });
    expect(response.status(), JSON.stringify(body)).toBe(200);
    expect(item?.id).toBeTruthy();
    return { id: item.id as string, body };
  }

  async function setupDraft(page: Page, suffix: string) {
    const title = uniqueTitle(suffix);
    const result = await api(page, '/quizzes', 'POST', { title, description: 'Teacher audit searchable description', status: 'draft' });
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    const id = result.body.quiz.id;
    cleanup.push({ id, kind: 'quizzes' });
    return { title, id };
  }

  async function fillQuestion(page: Page, text = 'What is two plus two?') {
    await page.getByRole('tab', { name: /^Sorular/ }).click();
    await page.getByLabel('Soru Metni', { exact: true }).first().fill(text);
    await page.getByRole('textbox', { name: '1. soru: 1. seçenek', exact: true }).fill('Four');
    await page.getByRole('textbox', { name: '1. soru: 2. seçenek', exact: true }).fill('Five');
  }

  test('new exam navigation and invalid title do not persist content', async ({ page }) => {
    await page.goto('/quizzes');
    await page.getByRole('button', { name: 'Yeni Sınav Oluştur', exact: true }).click();
    await expect(page).toHaveURL(/\/create-quiz$/);
    await expect(page.getByRole('heading', { name: 'Yeni Sınav Oluştur', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yayınla', exact: true })).toBeDisabled();
    await page.getByLabel(/Sınav Başlığı/).fill('ab');
    const pending = page.waitForResponse(r => r.request().method() === 'PUT' && /\/quizzes\/[^/]+\/content$/.test(new URL(r.url()).pathname));
    await page.getByRole('button', { name: 'Taslak Kaydet', exact: true }).click();
    const response = await pending;
    expect(response.status()).toBe(400);
    await expect(page.getByText('İçerik bilgileri veya sorular geçersiz.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/create-quiz$/);
    expect((await api(page, '/quizzes')).body.quizzes.some((q: any) => q.title === 'ab')).toBe(false);
  });

  test('create draft, edit metadata and rules, reload persistence', async ({ page }) => {
    const title = uniqueTitle('draft');
    await page.goto('/create-quiz');
    await page.getByLabel(/Sınav Başlığı/).fill(title);
    await page.getByLabel('Açıklama (Opsiyonel)').fill('Original audit description');
    await page.getByLabel('Ders / Kategori').click();
    await page.getByRole('option', { name: 'Teacher Audit Mathematics', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Teacher Audit 7A', exact: true }).check();
    await expect(page.getByRole('checkbox', { name: 'Private Other 7B', exact: true })).toHaveCount(0);
    await page.getByRole('switch', { name: 'Süre Sınırı', exact: true }).check();
    await page.getByLabel('Süre (Dakika)').fill('25');
    await page.getByRole('switch', { name: 'Soruları Karıştır', exact: true }).check();
    await fillQuestion(page);
    const created = await save(page, 'quizzes', 'Taslak Kaydet', true);
    await expect(page).toHaveURL(/\/quizzes$/);
    await page.getByRole('textbox', { name: 'Sınav adı veya açıklama ile ara', exact: true }).fill(title);
    const row = page.getByRole('row').filter({ hasText: title });
    await expect(row).toContainText('Taslak');
    await row.getByRole('button', { name: `${title} işlemleri`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Düzenle', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/quizzes/${created.id}$`));
    await expect(page.getByLabel(/Sınav Başlığı/)).toHaveValue(title);
    await page.getByLabel(/Sınav Başlığı/).fill(`${title} edited`);
    await page.getByLabel('Açıklama (Opsiyonel)').fill('Updated audit description');
    await save(page, 'quizzes', 'Taslak Kaydet');
    await page.goto(`/quizzes/${created.id}`);
    await page.reload();
    await expect(page.getByLabel(/Sınav Başlığı/)).toHaveValue(`${title} edited`);
    await expect(page.getByLabel('Açıklama (Opsiyonel)')).toHaveValue('Updated audit description');
    await expect(page.getByLabel('Ders / Kategori')).toContainText('Teacher Audit Mathematics');
    await expect(page.getByRole('checkbox', { name: 'Teacher Audit 7A', exact: true })).toBeChecked();
    await expect(page.getByLabel('Süre (Dakika)')).toHaveValue('25');
    await expect(page.getByRole('switch', { name: 'Soruları Karıştır', exact: true })).toBeChecked();
    await page.getByRole('tab', { name: /^Sorular/ }).click();
    await expect(page.getByLabel('Soru Metni', { exact: true })).toHaveValue('What is two plus two?');
    expect((await api(page, `/quizzes/${created.id}`)).body.questions).toHaveLength(1);
  });

  test('duplicate options block save and question/option controls preserve valid answer', async ({ page }) => {
    const draft = await setupDraft(page, 'questions');
    await page.goto(`/quizzes/${draft.id}`);
    await expect(page.getByLabel(/Sınav Başlığı/)).toHaveValue(draft.title);
    await fillQuestion(page);
    await page.getByRole('textbox', { name: '1. soru: 2. seçenek', exact: true }).fill('Four');
    await page.getByRole('button', { name: 'Taslak Kaydet', exact: true }).click();
    await expect(page.getByText('Soru 1: Aynı cevap seçeneği birden fazla kez kullanılamaz.', { exact: true })).toBeVisible();
    expect((await api(page, `/quizzes/${draft.id}`)).body.questions).toHaveLength(0);
    await page.getByRole('textbox', { name: '1. soru: 2. seçenek', exact: true }).fill('Five');
    await page.getByRole('button', { name: '1. soru: 2. seçenek doğru cevap', exact: true }).click();
    await page.getByRole('button', { name: '1. soru: 1. seçeneği sil', exact: true }).click();
    await expect(page.getByRole('button', { name: '1. soru: 1. seçenek doğru cevap', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Seçenek Ekle', exact: true }).click();
    await page.getByRole('textbox', { name: '1. soru: 2. seçenek', exact: true }).fill('Six');
    await page.getByRole('button', { name: 'Soru Ekle (Üst)', exact: true }).click();
    await expect(page.getByLabel('Soru Metni', { exact: true })).toHaveCount(2);
    await expect(page.getByLabel('Soru Metni', { exact: true }).first()).toBeFocused();
    await page.getByRole('button', { name: '1. soruyu sil', exact: true }).click();
    await expect(page.getByLabel('Soru Metni', { exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: '1. soruyu sil', exact: true })).toBeDisabled();
    await save(page, 'quizzes', 'Taslak Kaydet');
    const stored = (await api(page, `/quizzes/${draft.id}`)).body.questions;
    expect(stored).toHaveLength(1);
    expect(stored[0].correctAnswer).toBe('Five');
    expect(stored[0].options).toEqual(['Five', 'Six']);
  });

  test('publish exam and return it to draft using the editor', async ({ page }) => {
    const draft = await setupDraft(page, 'publication');
    await page.goto(`/quizzes/${draft.id}`);
    await expect(page.getByLabel(/Sınav Başlığı/)).toHaveValue(draft.title);
    await page.getByRole('checkbox', { name: 'Teacher Audit 7A', exact: true }).check();
    await fillQuestion(page);
    await save(page, 'quizzes', 'Yayınla');
    let stored = await api(page, `/quizzes/${draft.id}`);
    expect(stored.body.quiz.status).toBe('published');
    expect(stored.body.quiz.publishedAt).toBeTruthy();
    await page.getByRole('textbox', { name: 'Sınav adı veya açıklama ile ara', exact: true }).fill(draft.title);
    await expect(page.getByRole('row').filter({ hasText: draft.title })).toContainText('Yayında');
    await page.goto(`/quizzes/${draft.id}`);
    await expect(page.getByLabel(/Sınav Başlığı/)).toHaveValue(draft.title);
    await save(page, 'quizzes', 'Taslak Kaydet');
    stored = await api(page, `/quizzes/${draft.id}`);
    expect(stored.body.quiz.status).toBe('draft');
  });

  test('delete requires reason, cancellation retains exam, confirmation removes it', async ({ page }) => {
    const draft = await setupDraft(page, 'delete');
    await page.goto('/quizzes');
    await page.getByRole('textbox', { name: 'Sınav adı veya açıklama ile ara', exact: true }).fill(draft.title);
    await page.getByRole('button', { name: `${draft.title} işlemleri`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Sil', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Kalıcı Olarak Sil', exact: true })).toBeDisabled();
    await dialog.getByLabel('Silme Nedeni').fill('abcd');
    await expect(dialog.getByRole('button', { name: 'Kalıcı Olarak Sil', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Vazgeç', exact: true }).click();
    expect((await api(page, `/quizzes/${draft.id}`)).status).toBe(200);
    await page.getByRole('button', { name: `${draft.title} işlemleri`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Sil', exact: true }).click();
    await dialog.getByLabel('Silme Nedeni').fill('Intentional isolated audit deletion');
    await dialog.getByRole('button', { name: 'Kalıcı Olarak Sil', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sınav Bulunamadı', exact: true })).toBeVisible();
    expect((await api(page, `/quizzes/${draft.id}`)).status).toBe(404);
    cleanup = cleanup.filter(item => item.id !== draft.id);
  });

  test('list pagination, description search, empty state and filters', async ({ page }) => {
    await page.goto('/quizzes');
    await expect(page.getByRole('heading', { name: 'Sınavlarım', exact: true })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(10);
    await expect(page.getByRole('button', { name: 'Önceki', exact: true })).toBeDisabled();
    const firstTitles = await page.locator('tbody tr td:first-child p:first-child').allTextContents();
    await page.getByRole('button', { name: 'Sonraki', exact: true }).click();
    await expect(page.getByText(/kayıt · Sayfa 2\//)).toBeVisible();
    const nextTitles = await page.locator('tbody tr td:first-child p:first-child').allTextContents();
    expect(nextTitles.every(title => !firstTitles.includes(title))).toBe(true);
    await page.getByRole('textbox', { name: 'Sınav adı veya açıklama ile ara', exact: true }).fill('no-existing-teacher-audit-quiz-xyz');
    await expect(page.getByRole('heading', { name: 'Sınav Bulunamadı', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Aramayı temizle', exact: true }).click();
    await expect(page.getByText(/kayıt · Sayfa 1\//)).toBeVisible();
    await page.getByRole('combobox', { name: 'Ders Filtresi', exact: true }).click();
    await page.getByRole('option', { name: 'Teacher Audit Mathematics', exact: true }).click();
    await page.getByRole('combobox', { name: 'Sınıf Filtresi', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Private Other 7B', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'Teacher Audit 7A', exact: true }).click();
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    for (const row of await rows.all()) {
      await expect(row).toContainText('Teacher Audit Mathematics');
      await expect(row).toContainText('Teacher Audit 7A');
    }
    await page.getByRole('button', { name: 'Filtreleri Temizle', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Ders Filtresi', exact: true })).toContainText('Tüm Dersler');
    await expect(page.getByRole('combobox', { name: 'Sınıf Filtresi', exact: true })).toContainText('Tüm Sınıflar');
    const draft = await setupDraft(page, 'description');
    await page.reload();
    await page.getByRole('textbox', { name: 'Sınav adı veya açıklama ile ara', exact: true }).fill('Teacher audit searchable description');
    await expect(page.getByRole('row').filter({ hasText: draft.title })).toBeVisible();
  });

  test('foreign teacher exam stays inaccessible through API and direct editor URL', async ({ page }) => {
    const id = 'teacher-audit-other-exam';
    expect((await api(page, `/quizzes/${id}`)).status).toBe(403);
    expect((await api(page, `/quizzes/${id}`, 'PATCH', { title: 'Forbidden teacher audit edit' })).status).toBe(403);
    expect((await api(page, `/quizzes/${id}`, 'DELETE', { reason: 'Forbidden audit attempt' })).status).toBe(403);
    const ownList = await api(page, '/quizzes');
    expect(ownList.body.quizzes.some((quiz: any) => quiz.id === id)).toBe(false);
    await page.goto(`/quizzes/${id}`);
    await expect(page.getByText('Sınav bilgileri yüklenemedi.', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/Sınav Başlığı/)).toHaveValue('');
    await page.getByLabel(/Sınav Başlığı/).fill('Forbidden teacher audit edit');
    await fillQuestion(page);
    const responsePromise = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/quizzes/${id}/content`);
    await page.getByRole('button', { name: 'Taslak Kaydet', exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(403);
    await expect(page.getByText('Bu içeriği düzenleme yetkiniz yok.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/quizzes/${id}$`));
  });

  test('survey create tab saves real open-text and rating questions', async ({ page }) => {
    const title = uniqueTitle('survey');
    await page.goto('/survey-results');
    await page.getByRole('tab', { name: 'Anket Oluştur', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Yeni Anket Oluştur', exact: true })).toBeVisible();
    await page.getByLabel(/Anket Başlığı/).fill(title);
    await page.getByRole('checkbox', { name: 'Teacher Audit 7A', exact: true }).check();
    await expect(page.getByRole('switch', { name: 'Süre Sınırı', exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: /^Sorular/ }).click();
    await page.getByLabel('Soru Türü', { exact: true }).click();
    await page.getByRole('option', { name: 'Açık Uçlu', exact: true }).click();
    await page.getByLabel('Soru Metni', { exact: true }).fill('What should improve in this lesson?');
    await expect(page.getByRole('textbox', { name: /1\. soru: .* seçenek/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Yeni Soru Ekle', exact: true }).click();
    await page.getByLabel('Soru Türü', { exact: true }).first().click();
    await page.getByRole('option', { name: 'Derecelendirme', exact: true }).click();
    await page.getByLabel('Soru Metni', { exact: true }).first().fill('Rate the lesson');
    await page.getByLabel('En Yüksek Değer').fill('7');
    const created = await save(page, 'surveys', 'Yayınla', true);
    await expect(page.getByRole('tab', { name: 'Sonuçlar', exact: true })).toHaveAttribute('aria-selected', 'true');
    const stored = await api(page, `/surveys/${created.id}`);
    expect(stored.status).toBe(200);
    expect(stored.body.survey.title).toBe(title);
    expect(stored.body.survey.status).toBe('published');
    expect(stored.body.questions.map((q: any) => q.type)).toEqual(['rating', 'open-text']);
    expect(stored.body.questions[0].config.max).toBe(7);
    expect(stored.body.questions.every((q: any) => q.correctAnswer == null)).toBe(true);
    await page.reload();
    await page.getByLabel('Anket', { exact: true }).click();
    await expect(page.getByRole('option', { name: title, exact: true })).toBeVisible();
  });
});
