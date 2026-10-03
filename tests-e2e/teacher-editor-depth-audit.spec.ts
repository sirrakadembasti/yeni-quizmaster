import { test, expect, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { login, api, assertIsolatedRuntime } from './teacher-audit-helpers';

// Actual upload/editor APIs and DOM. The generated PNG is a local test fixture,
// not a mocked upload response; resulting assets remain inside the disposable runtime.
function fixturePng() {
  const crc32 = (bytes: Buffer) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 2;
  // Two RGB scanlines, each preceded by PNG filter byte 0.
  const pixels = Buffer.from([0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 255]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

async function saveContent(page: Page, kind: 'quizzes' | 'surveys', button: string) {
  const pending = page.waitForResponse(r => r.request().method() === 'PUT' && new RegExp(`/api/${kind}/[^/]+/content$`).test(new URL(r.url()).pathname));
  await page.getByRole('button', { name: button, exact: true }).click();
  const response = await pending;
  const body = await response.json();
  return { status: response.status(), body, item: body.quiz || body.survey };
}

test.describe('Teacher audit: editor depth', () => {
  test.beforeAll(() => { assertIsolatedRuntime(); });
  test.beforeEach(async ({ page }) => { await login(page); });

  test('real valid question image upload persists through draft save and reopen', async ({ page }) => {
    const title = `Teacher audit image draft ${Date.now()}`;
    let createdId: string | undefined;
    try {
      await page.goto('/create-quiz');
      await page.getByLabel(/Sınav Başlığı/).fill(title);
      await page.getByRole('tab', { name: /^Sorular/ }).click();
      await page.getByLabel('Soru Metni', { exact: true }).fill('Identify the colors in the uploaded audit fixture.');
      await page.getByRole('textbox', { name: '1. soru: 1. seçenek', exact: true }).fill('Red and green');
      await page.getByRole('textbox', { name: '1. soru: 2. seçenek', exact: true }).fill('Only black');
      await page.getByRole('button', { name: 'Soru Görseli (Opsiyonel)', exact: true }).click();
      const uploadPending = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/upload');
      await page.locator('[data-question-id] input[type="file"]').setInputFiles({ name: 'teacher-audit-colors.png', mimeType: 'image/png', buffer: fixturePng() });
      const uploadResponse = await uploadPending;
      const uploaded = await uploadResponse.json();
      expect(uploadResponse.status(), JSON.stringify(uploaded)).toBe(200);
      expect(uploaded.imageUrl).toMatch(/^\/uploads\/[a-f0-9-]+\.webp$/);
      const preview = page.getByRole('img', { name: 'Uploaded image', exact: true });
      await expect(preview).toHaveAttribute('src', uploaded.imageUrl);
      await expect.poll(async () => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      const saved = await saveContent(page, 'quizzes', 'Taslak Kaydet');
      createdId = saved.item?.id;
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      expect(createdId).toBeTruthy();
      await expect(page).toHaveURL(/\/quizzes$/);
      const stored = await api(page, `/quizzes/${createdId}`);
      expect(stored.status).toBe(200);
      expect(stored.body.questions).toHaveLength(1);
      expect(stored.body.questions[0].imageUrl).toBe(uploaded.imageUrl);
      await page.goto(`/quizzes/${createdId}`);
      await page.reload();
      await expect(page.getByLabel(/Sınav Başlığı/)).toHaveValue(title);
      await page.getByRole('tab', { name: /^Sorular/ }).click();
      await page.getByRole('button', { name: /Soru Görseli \(Opsiyonel\)/ }).click();
      await expect(preview).toHaveAttribute('src', uploaded.imageUrl);
      await expect.poll(async () => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      const asset = await page.request.get(uploaded.imageUrl);
      expect(asset.status()).toBe(200);
      expect(asset.headers()['content-type']).toContain('image/webp');
    } finally {
      if (createdId) expect((await api(page, `/quizzes/${createdId}`, 'DELETE', { reason: 'Teacher editor depth isolated image cleanup' })).status).toBe(200);
    }
  });

  test('survey GUI creates all five canonical question types and edits persisted content', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const title = `Teacher audit all survey types ${Date.now()}`;
    let createdId: string | undefined;
    let originalError: unknown;
    let cleanupError: unknown;
    const evidencePath = testInfo.outputPath('survey-editor-phases.json');
    const phases: Array<Record<string, unknown>> = [];
    const phase = (name: string, detail: Record<string, unknown> = {}) => {
      phases.push({ phase: name, timestamp: new Date().toISOString(), ...detail });
      mkdirSync(dirname(evidencePath), { recursive: true });
      // Only known phase/status/count/type/id fields are written. No cookies,
      // CSRF tokens, headers, credentials, request bodies, or raw API responses.
      writeFileSync(evidencePath, JSON.stringify({ test: 'survey all five canonical types', phases }, null, 2));
    };
    const failure = (error: unknown) => ({
      name: error instanceof Error ? error.name : 'UnknownError',
      // First line locates the failure without recording request debug headers.
      message: error instanceof Error ? error.message.split('\n')[0].slice(0, 500) : 'Non-Error failure',
    });
    phase('started');
    const types = [
      { label: 'Tek Seçim', value: 'single-choice', text: 'Choose one favorite topic', options: ['Geometry', 'Algebra'] },
      { label: 'Çoklu Seçim', value: 'multiple-choice', text: 'Choose helpful lesson activities', options: ['Practice', 'Discussion'] },
      { label: 'Açık Uçlu', value: 'open-text', text: 'Describe one lesson improvement', options: [] },
      { label: 'Derecelendirme', value: 'rating', text: 'Rate clarity of the lesson', options: [] },
      { label: 'Likert Ölçeği', value: 'likert', text: 'I feel confident about this topic', options: ['Kesinlikle katılmıyorum', 'Katılmıyorum', 'Kararsızım', 'Katılıyorum', 'Kesinlikle katılıyorum'] },
    ];
    try {
      await page.goto('/survey-results');
      await page.getByRole('tab', { name: 'Anket Oluştur', exact: true }).click();
      await page.getByLabel(/Anket Başlığı/).fill(title);
      await page.getByLabel('Açıklama (Opsiyonel)').fill('Five canonical question types in the isolated teacher audit');
      await page.getByRole('checkbox', { name: 'Teacher Audit 7A', exact: true }).check();
      await page.getByRole('tab', { name: /^Sorular/ }).click();
      phase('create editor opened');
      for (let index = 0; index < types.length; index++) {
        const item = types[index];
        if (index > 0) await page.getByRole('button', { name: 'Soru Ekle (Üst)', exact: true }).click();
        const card = page.locator('[data-question-id]').first();
        await card.getByLabel('Soru Türü', { exact: true }).click();
        await page.getByRole('option', { name: item.label, exact: true }).click();
        await card.getByLabel('Soru Metni', { exact: true }).fill(item.text);
        if (item.value === 'single-choice' || item.value === 'multiple-choice') {
          await card.getByRole('textbox', { name: '1. soru: 1. seçenek', exact: true }).fill(item.options[0]);
          await card.getByRole('textbox', { name: '1. soru: 2. seçenek', exact: true }).fill(item.options[1]);
        } else if (item.value === 'rating') {
          await card.getByLabel('En Yüksek Değer').fill('8');
          await expect(card.getByRole('textbox', { name: /seçenek/ })).toHaveCount(0);
        } else if (item.value === 'likert') {
          for (let option = 0; option < item.options.length; option++) {
            await expect(card.getByRole('textbox', { name: `1. soru: ${option + 1}. seçenek`, exact: true })).toHaveValue(item.options[option]);
          }
        } else {
          await expect(card.getByRole('textbox', { name: /seçenek/ })).toHaveCount(0);
        }
        await expect(card.getByRole('button', { name: /doğru cevap/ })).toHaveCount(0);
        phase('question GUI verified', { type: item.value, questionCount: index + 1 });
      }
      await expect(page.locator('[data-question-id]')).toHaveCount(5);
      const saved = await saveContent(page, 'surveys', 'Yayınla');
      createdId = saved.item?.id;
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      expect(createdId).toBeTruthy();
      phase('published', { status: saved.status, id: createdId });
      await expect(page.getByRole('tab', { name: 'Sonuçlar', exact: true })).toHaveAttribute('aria-selected', 'true');
      const stored = await api(page, `/surveys/${createdId}`);
      expect(stored.status).toBe(200);
      expect(stored.body.questions).toHaveLength(5);
      expect(stored.body.questions.map((q: any) => q.type)).toEqual(types.map(item => item.value).reverse());
      for (const item of types) {
        const question = stored.body.questions.find((q: any) => q.text === item.text);
        expect(question.type).toBe(item.value);
        // GET /surveys/:id deliberately strips correctAnswer from safeQuestions.
        // Survey questions must expose no exam scoring answer (absent or null).
        expect(question.correctAnswer == null).toBe(true);
        expect(question.options).toEqual(item.options);
        if (item.value === 'rating') expect(question.config.max).toBe(8);
      }
      phase('all five persisted', { status: stored.status, questionCount: stored.body.questions.length, types: stored.body.questions.map((q: any) => q.type) });
      await page.reload();
      phase('results reloaded');
      const survey = page.locator('.survey-result-card').filter({ hasText: title });
      await expect(survey).toBeVisible();
      phase('published survey card visible');
      await survey.getByRole('button', { name: 'Düzenle', exact: true }).click();
      await expect(page.getByLabel(/Anket Başlığı/)).toHaveValue(title);
      await page.getByRole('tab', { name: /^Sorular/ }).click();
      const cards = page.locator('[data-question-id]');
      await expect(cards).toHaveCount(5);
      phase('reopened five cards', { questionCount: 5 });
      const reversed = [...types].reverse();
      for (let index = 0; index < reversed.length; index++) {
        await expect(cards.nth(index).getByLabel('Soru Türü', { exact: true })).toContainText(reversed[index].label);
        await expect(cards.nth(index).getByLabel('Soru Metni', { exact: true })).toHaveValue(reversed[index].text);
      }
      await expect(cards.nth(1).getByLabel('En Yüksek Değer')).toHaveValue('8');
      phase('reopened GUI values verified');
      await page.getByRole('tab', { name: 'Anket Ayarları', exact: true }).click();
      await page.getByLabel(/Anket Başlığı/).fill(`${title} edited`);
      const edited = await saveContent(page, 'surveys', 'Yayınla');
      expect(edited.status, JSON.stringify(edited.body)).toBe(200);
      phase('edited content saved', { status: edited.status });
      const readback = await api(page, `/surveys/${createdId}`);
      expect(readback.body.survey.title).toBe(`${title} edited`);
      expect(readback.body.questions.map((q: any) => q.id)).toEqual(stored.body.questions.map((q: any) => q.id));
      expect(readback.body.questions.map((q: any) => q.type)).toEqual(reversed.map(item => item.value));
      phase('edited API readback verified', { status: readback.status, questionCount: readback.body.questions.length, preservedQuestionIds: true });
    } catch (error) {
      originalError = error;
      phase('original failure', failure(error));
    } finally {
      if (createdId) {
        try {
          phase('cleanup started', { id: createdId });
          // Bound the genuine cleanup requests so an unavailable runtime cannot
          // consume the whole test timeout or replace the original assertion.
          const csrfResponse = await page.request.get('/api/csrf-token', { timeout: 8000 });
          expect(csrfResponse.status(), 'cleanup CSRF status').toBe(200);
          const csrf = await csrfResponse.json();
          const response = await page.request.delete(`/api/quizzes/${createdId}`, {
            timeout: 8000,
            headers: { 'x-csrf-token': csrf.csrfToken },
            data: { reason: 'Teacher editor depth isolated survey cleanup' },
          });
          expect(response.status(), 'created survey cleanup status').toBe(200);
          phase('cleanup succeeded', { status: response.status() });
        } catch (error) {
          cleanupError = error;
          phase('cleanup failure', failure(error));
        }
      }
      try {
        await testInfo.attach('survey-editor-phases', { path: evidencePath, contentType: 'application/json' });
      } catch (error) {
        phase('evidence attachment failure', failure(error));
        cleanupError ??= error;
      }
    }
    if (originalError) throw originalError;
    if (cleanupError) throw cleanupError;
  });
});
