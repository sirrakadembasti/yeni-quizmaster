import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

// Opt-in audit suite: never aim these mutation checks at the production server.
const runtime = JSON.parse(readFileSync('docs/admin-audit/runtime.json', 'utf8'));
const isolatedRoot = resolve(runtime.root);
const expectedParent = resolve('server/data');
if (dirname(isolatedRoot) !== expectedParent || !/^quizmaster-test-admin-audit-/.test(isolatedRoot.split(/[\\/]/).at(-1)!) ||
    resolve(runtime.database) !== join(isolatedRoot, 'server', 'data', 'audit.db') ||
    JSON.stringify(runtime.ports) !== '[5510,5511]') {
  throw new Error('System flow audit requires the isolated audit runtime on 5510/5511.');
}
// Root config uses one worker; keep tests independent so a desired-UX failure
// does not skip the subsequent persisted-profile check.
test.describe.configure({ mode: 'default' });
test.beforeEach(async ({ baseURL }) => {
  if (baseURL !== 'http://127.0.0.1:5511') throw new Error('System flow audit must target the disposable browser server on 127.0.0.1:5511.');
});

async function login(page: Page) {
  const base = 'http://127.0.0.1:5511';
  const csrf = await page.request.get(base + '/api/csrf-token');
  expect(csrf.status()).toBe(200);
  const token = (await csrf.json()).csrfToken;
  const loginResponse = await page.request.post(base + '/api/auth/login', {
    data: { email: 'audit-admin@example.test', password: 'AuditOnly2026!' },
    headers: { 'x-csrf-token': token },
  });
  expect(loginResponse.status(), await loginResponse.text()).toBe(200);
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-dashboard-shell]')).toBeVisible();
}

async function api(page: Page, path: string, method = 'GET', data?: unknown) {
  return page.evaluate(async ({ path, method, data }) => {
    const token = await fetch('/api/csrf-token').then(r => r.json());
    const response = await fetch('/api' + path, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token.csrfToken },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, body: await response.json() };
  }, { path, method, data });
}

async function option(page: Page, trigger: Locator, name: string | RegExp) {
  await trigger.click();
  await page.getByRole('option', { name, exact: typeof name === 'string' }).click();
}

function classCard(page: Page, name: string) {
  return page.locator('div.group.cursor-pointer').filter({ has: page.getByRole('heading', { name, exact: true }) });
}

test('management class required fields, create, edit, cancel delete, delete and persisted reload', async ({ page }) => {
  test.setTimeout(240000);
  await login(page);
  await page.goto('/management',{waitUntil:'domcontentloaded'});
  await page.getByRole('tab', { name: 'Sınıflar', exact: true }).click();
  const before = await api(page, '/classes');
  expect(before.status).toBe(200);
  expect(before.body.classes.some((c: any) => ['1-A', '1-B'].includes(c.name))).toBe(false);
  await page.getByRole('button', { name: 'Yeni Sınıf', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Sınıfı Kaydet' })).toBeDisabled();
  await option(page, dialog.getByRole('combobox').nth(0), '1. Sınıf');
  await expect(dialog.getByRole('button', { name: 'Sınıfı Kaydet' })).toBeDisabled();
  await option(page, dialog.getByRole('combobox').nth(1), 'A Şubesi');
  await dialog.locator('textarea').fill('Isolated system browser audit');
  await dialog.getByRole('button', { name: 'Sınıfı Kaydet' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(classCard(page, '1-A')).toBeVisible();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('tab', { name: 'Sınıflar', exact: true }).click();
  const created = (await api(page, '/classes')).body.classes.find((c: any) => c.name === '1-A');
  expect(created.description).toBe('Isolated system browser audit');
  await classCard(page, '1-A').hover();
  await classCard(page, '1-A').getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Hızlı Düzenle' }).click();
  await option(page, dialog.getByRole('combobox').nth(1), 'B Şubesi');
  await dialog.locator('textarea').fill('Edited through actual UI');
  await dialog.getByRole('button', { name: 'Sınıfı Kaydet' }).click();
  await expect(classCard(page, '1-B')).toBeVisible();
  expect((await api(page, '/classes/' + created.id)).body.class.description).toBe('Edited through actual UI');
  await classCard(page, '1-B').hover();
  await classCard(page, '1-B').getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Sınıfı Sil' }).click();
  await dialog.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await expect(classCard(page, '1-B')).toBeVisible();
  await classCard(page, '1-B').hover();
  await classCard(page, '1-B').getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Sınıfı Sil' }).click();
  await dialog.getByRole('button', { name: 'Evet, Sil', exact: true }).click();
  await expect(classCard(page, '1-B')).toHaveCount(0);
  await page.reload({waitUntil:'domcontentloaded'});
  expect((await page.request.get('http://127.0.0.1:5511/api/classes/' + created.id)).status()).toBe(404);
});

test('management user invalid input visible validation, create, edit, cancel and delete persist', async ({ page }) => {
  await login(page);
  const email = `system-flow-${Date.now()}@example.test`;
  await page.goto('/management',{waitUntil:'domcontentloaded'});
  await page.getByRole('tab', { name: 'Kullanıcılar', exact: true }).click();
  await page.getByRole('button', { name: /Yeni Kullanıcı/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Örn: Mehmet Can').fill('System Flow Student');
  await dialog.getByPlaceholder('mehmet@okul.com').fill('invalid-address');
  const badResponse = page.waitForResponse(r => r.url().endsWith('/api/users') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Kullanıcıyı Kaydet' }).click();
  expect((await badResponse).status()).toBe(400);
  await expect(page.getByText('Ad, geçerli e-posta ve en az 6 karakterli parola gereklidir.', { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('mehmet@okul.com').fill(email);
  await dialog.locator('input[type=password]').fill('AuditOnly2026!');
  await dialog.getByRole('button', { name: 'Kullanıcıyı Kaydet' }).click();
  await expect(dialog).toHaveCount(0);
  let row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toBeVisible();
  const created = (await api(page, '/users')).body.users.find((u: any) => u.email === email);
  expect(created.role).toBe('student');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('tab', { name: 'Kullanıcılar', exact: true }).click();
  await row.getByRole('button').nth(0).click();
  await dialog.getByPlaceholder('Örn: Mehmet Can').fill('System Flow Student Updated');
  await dialog.getByRole('button', { name: 'Değişiklikleri Kaydet', exact: true }).click();
  await expect(row).toContainText('System Flow Student Updated');
  expect((await api(page, '/users/' + created.id)).body.user.name).toBe('System Flow Student Updated');
  await row.getByRole('button').nth(1).click();
  await dialog.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole('button').nth(1).click();
  await dialog.getByRole('button', { name: 'Evet, Sil', exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.reload({waitUntil:'domcontentloaded'});
  const inactive = await api(page, '/users/' + created.id); expect(inactive.status).toBe(200); expect(inactive.body.user.isActive).toBe(false);
});

test('parent creation requires contact information before submit', async ({ page }) => {
  await login(page);
  await page.goto('/management',{waitUntil:'domcontentloaded'});
  await page.getByRole('tab', { name: 'Kullanıcılar', exact: true }).click();
  await page.getByRole('button', { name: /Yeni Kullanıcı/ }).click();
  const dialog = page.getByRole('dialog');
  await option(page, dialog.getByRole('combobox'), 'Veli (Bağlı Öğrencileri İzleyebilir)');
  await expect(dialog.getByRole('button', { name: 'Kullanıcıyı Kaydet' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Veli-Öğrenci Eşleştirme Sayfasını Aç' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('archive promotion moves only isolated new students, updates counts and graduation persists', async ({ page }) => {
  await login(page);
  const tag = Date.now();
  const from = await api(page, '/classes', 'POST', { name: `6-Audit-${tag}` });
  const to = await api(page, '/classes', 'POST', { name: `7-Audit-${tag}` });
  expect(from.status).toBe(201); expect(to.status).toBe(201);
  const added = await api(page, '/users', 'POST', { name: 'Promotion isolated student', email: `promotion-${tag}@example.test`, password: 'AuditOnly2026!', role: 'student', classId: from.body.id });
  expect(added.status).toBe(201);
  const student = added.body.user;
  try {
    await page.goto('/archive');
    await page.getByRole('tab', { name: 'Sınıf Atlatma', exact: true }).click();
    await option(page, page.getByRole('combobox').nth(0), new RegExp(`6-Audit-${tag}`));
    await option(page, page.getByRole('combobox').nth(1), `7-Audit-${tag}`);
    await page.getByRole('button', { name: 'İşlemi Başlat', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('farklı bir seviyeye');
    await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
    expect((await api(page, '/users/' + student.id)).body.user.classId).toBe(from.body.id);
    await page.getByRole('button', { name: 'İşlemi Başlat', exact: true }).click();
    await page.getByRole('button', { name: 'Evet, İşlemi Yap', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await api(page, '/users/' + student.id)).body.user.classId).toBe(to.body.id);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('tab', { name: 'Sınıf Atlatma', exact: true }).click();
    await option(page, page.getByRole('combobox').nth(0), new RegExp(`7-Audit-${tag}`));
    await expect(page.getByRole('combobox').nth(0)).toContainText('1 Öğrenci');
    await page.getByRole('button', { name: 'İşlemi Başlat', exact: true }).click();
    await page.getByRole('button', { name: 'Evet, İşlemi Yap', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload({waitUntil:'domcontentloaded'});
    const graduate = (await api(page, '/users/' + student.id)).body.user;
    expect(graduate.classId).toBeNull(); expect(graduate.studentNo).toBeNull();
    expect((await api(page, '/users/audit-student')).body.user.classId).toBe('audit-class');
  } finally {
    await api(page, '/users/' + student.id, 'DELETE');
    await api(page, '/classes/' + from.body.id, 'DELETE');
    await api(page, '/classes/' + to.body.id, 'DELETE');
  }
});

test('deployment invalid origin receives API 400 and visible error instead of silent failure', async ({ page }, info) => {
  await login(page);
  await page.goto('/server-setup');
  await expect(page.getByRole('button', { name: 'Profili Kaydet' })).toBeEnabled();
  await page.getByText('Herkese açık adres', { exact: true }).locator('..').locator('input').fill('not-an-origin');
  const failed = page.waitForResponse(r => r.url().endsWith('/api/admin/deployment/configuration') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Profili Kaydet' }).click();
  const response = await failed;
  expect.soft(response.status()).toBe(400);
  await info.attach('invalid-deployment-response', { body: await response.text(), contentType: 'application/json' });
  await page.screenshot({ path: 'docs/admin-audit/evidence/remaining-repairs/deployment-invalid-profile.png', fullPage: true });
  const errorToast = page.locator('[data-sonner-toast]').filter({ hasText: 'Yapılandırma geçersiz' });
  await expect.soft(errorToast).toBeVisible();
  await expect.soft(errorToast).toContainText('publicUrl');
});

test('deployment profile saves only under isolated root and survives HTTP reload', async ({ page }) => {
  await login(page);
  const before = await api(page, '/admin/deployment/status');
  expect(before.status).toBe(200); expect(before.body.runtimeChangesAllowed).toBe(true);
  const savedPath = join(isolatedRoot, 'server', 'data', 'deployment-config.json');
  const updated = { ...before.body.config, publicUrl: 'http://127.0.0.1:5511', mode: 'localhost', basePath: '/', allowedOrigins: ['http://127.0.0.1:5511', 'http://127.0.0.1:5510'], trustProxyHops: 0 };
  try {
    await page.goto('/server-setup');
    await expect(page.getByRole('button', { name: 'Profili Kaydet' })).toBeEnabled();
    await option(page, page.getByRole('combobox'), 'Yerel / localhost (deneme)');
    await page.getByPlaceholder('http://127.0.0.1:5173', {exact:true}).fill(updated.publicUrl);
    await page.locator('textarea').first().fill(updated.allowedOrigins.join('\n'));
    await page.locator('input[type=number]').first().fill('0');
    const saved = page.waitForResponse(r => r.url().endsWith('/api/admin/deployment/configuration') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Profili Kaydet' }).click();
    expect((await saved).status()).toBe(200);
    await expect.poll(() => existsSync(savedPath)).toBe(true);
    const disk = JSON.parse(readFileSync(savedPath, 'utf8'));
    expect(disk.publicUrl).toBe(updated.publicUrl); expect(disk.trustProxyHops).toBe(0);
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByPlaceholder('http://127.0.0.1:5173', {exact:true})).toHaveValue(updated.publicUrl);
    expect((await api(page, '/admin/deployment/status')).body.config.allowedOrigins).toEqual(updated.allowedOrigins);
  } finally {
    const restored = await api(page, '/admin/deployment/configuration', 'PUT', before.body.config);
    expect(restored.status).toBe(200);
  }
});
