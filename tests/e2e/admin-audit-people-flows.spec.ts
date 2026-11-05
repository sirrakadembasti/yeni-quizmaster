import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

// Run only against the disposable admin audit backend, after the route suite.
// Setup uses unique UUID records returned by the real API, never alters audit-* fixtures.
const runtime = JSON.parse(readFileSync('tests/denetim-kanitlari/yonetici/runtime.json', 'utf8'));
const isolatedRoot = resolve(runtime.root);
const base = 'http://127.0.0.1:5511';
if (dirname(isolatedRoot) !== resolve('server/data') || !basename(isolatedRoot).startsWith('quizmaster-test-admin-audit-') ||
    resolve(runtime.database) !== join(isolatedRoot, 'server', 'data', 'audit.db') || JSON.stringify(runtime.ports) !== '[5510,5511]') {
  throw new Error('People audit requires the disposable database and audit ports 5510/5511.');
}
test.setTimeout(360000);
test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'People audit mutations require the disposable 5511 audit frontend').toBe('http://127.0.0.1:5511');
});
async function login(page: Page) {
  // Bootstrap a real CSRF-protected session for the admin panel checks;
  // here so cold auth rendering cannot prevent the CRUD UI assertions.
  const tokenResponse = await page.request.get(base + '/api/csrf-token');
  expect(tokenResponse.status()).toBe(200);
  const token = (await tokenResponse.json()).csrfToken;
  const response = await page.request.post(base + '/api/auth/login', {
    data: { email: 'audit-admin@example.test', password: 'AuditOnly2026!' },
    headers: { 'x-csrf-token': token },
  });
  expect(response.status(), await response.text()).toBe(200);
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await expect(page.locator('[data-dashboard-shell]')).toBeVisible({ timeout: 120000 });
}
async function api(page: Page, path: string, method = 'GET', data?: unknown) {
  const tokenResponse = await page.request.get(base + '/api/csrf-token');
  expect(tokenResponse.status()).toBe(200);
  const token = (await tokenResponse.json()).csrfToken;
  const response = await page.request.fetch(base + '/api' + path, {
    method, headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    ...(data === undefined ? {} : { data }),
  });
  return { status: response.status(), body: await response.json() };
}
const unique = () => randomUUID();
type Fixtures = { emails: Set<string>; users: Map<string, any>; classes: Set<string>; categories: Set<string> };
async function createClass(page: Page, fixtures: Fixtures, name: string) {
  const response = await api(page, '/classes', 'POST', { name });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  fixtures.classes.add(response.body.id);
  return response.body;
}
async function createStudent(page: Page, fixtures: Fixtures, name: string, suffix: string, classId?: string) {
  const email = `people-student-${suffix}@example.test`; fixtures.emails.add(email);
  const response = await api(page, '/users', 'POST', {
    name, email, password: 'AuditOnly2026!', role: 'student',
    ...(classId ? { classId } : {}),
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  fixtures.users.set(response.body.user.id, response.body.user);
  return response.body.user;
}
async function cleanup(page: Page, fixtures: Fixtures) {
  // Discover modal-created users even when a later assertion failed.
  const users = await api(page, '/users'); expect(users.status).toBe(200);
  for (const user of users.body.users) if (fixtures.emails.has(user.email)) fixtures.users.set(user.id, user);
  for (const user of fixtures.users.values()) {
    if (user.role !== 'parent') continue;
    const links = await api(page, `/parents/guardian/${user.id}/students`); expect(links.status).toBe(200);
    for (const link of links.body.students) {
      expect(fixtures.users.has(link.studentId), 'Cleanup must never unlink an unrelated student').toBe(true);
      expect((await api(page, `/parents/link/${user.id}/${link.studentId}`, 'DELETE')).status).toBe(200);
    }
  }
  for (const user of fixtures.users.values()) {
    expect(fixtures.emails.has(user.email), 'Cleanup only handles this test’s unique email addresses').toBe(true);
    if (user.role === 'teacher') expect((await api(page, `/users/${user.id}`, 'PATCH', { assignedCategoryIds: [], classIds: [] })).status).toBe(200);
    if (user.role === 'student') {
      const current = await api(page, `/users/${user.id}`); expect(current.status).toBe(200);
      if (current.body.user.classId) {
        expect(fixtures.classes.has(current.body.user.classId), 'Cleanup must not change an unrelated class').toBe(true);
        expect((await api(page, `/classes/${current.body.user.classId}/students/${user.id}`, 'DELETE')).status).toBe(200);
      }
    }
    // Detach enrollment before soft deletion: class deletion counts inactive
    // students as well. Teacher/guardian disposable accounts can be deleted.
    expect((await api(page, `/users/${user.id}`, 'DELETE')).status).toBe(200);
  }
  for (const id of fixtures.classes) expect((await api(page, `/classes/${id}`, 'DELETE')).status).toBe(200);
  for (const id of fixtures.categories) expect((await api(page, `/categories/${id}`, 'DELETE')).status).toBe(200);
}
async function withFixtures(page: Page, info: TestInfo, run: (fixtures: Fixtures) => Promise<void>) {
  const fixtures: Fixtures = { emails: new Set(), users: new Map(), classes: new Set(), categories: new Set() };
  let primaryError: unknown;
  try { await run(fixtures); } catch (error) { primaryError = error; throw error; }
  finally {
    try { await cleanup(page, fixtures); }
    catch (error) {
      if (!primaryError) throw error;
      await info.attach('fixture-cleanup-error', { body: error instanceof Error ? error.stack || error.message : String(error), contentType: 'text/plain' });
    }
  }
}
async function evidence(page: Page, info: TestInfo, label: string, data: unknown) {
  await info.attach(label, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath(`${label}.png`), fullPage: true, timeout: 10000 });
}

test('people: student creation in real modal persists enrollment and automatic number', async ({ page }, info) => {
  await login(page);
  await withFixtures(page, info, async fixtures => {
    const suffix = unique();
    const classroom = await createClass(page, fixtures, `89-A-${suffix}`);
    const name = `People Student ${suffix}`;
    const email = `people-ui-student-${suffix}@example.test`;
    fixtures.emails.add(email);
    await page.goto('/students', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Yeni Öğrenci', exact: true })).toBeVisible({ timeout: 120000 });
    await page.getByRole('button', { name: 'Yeni Öğrenci', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Yeni Öğrenci', exact: true });
    await dialog.getByLabel('Tam İsim', { exact: true }).fill(name);
    await dialog.getByLabel('E-posta Adresi', { exact: true }).fill(email);
    await dialog.getByLabel('Öğrenci Hesabı Şifresi', { exact: true }).fill('AuditOnly2026!');
    await dialog.getByRole('combobox', { name: 'Kayıtlı Sınıf', exact: true }).click();
    await page.getByRole('option', { name: classroom.name, exact: true }).click();
    await dialog.getByRole('button', { name: 'Hesabı Oluştur', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible();
    const users = await api(page, '/users');
    const persisted = users.body.users.find((user: any) => user.email === email);
    await evidence(page, info, 'student-created', persisted);
    expect(persisted.classId).toBe(classroom.id);
    expect(persisted.studentNo).toBe(1);
    expect(persisted.isActive).toBe(true);
  });
});

test('people: teacher creation must retain selected course and class', async ({ page }, info) => {
  await login(page);
  await withFixtures(page, info, async fixtures => {
    const suffix = unique();
    const classroom = await createClass(page, fixtures, `90-A-${suffix}`);
    const category = await api(page, '/categories', 'POST', { name: `People Course ${suffix}` });
    expect(category.status, JSON.stringify(category.body)).toBe(201);
    const categoryId = category.body.id ?? category.body.category?.id;
    const categoryName = category.body.name ?? category.body.category?.name;
    expect(categoryId).toBeTruthy(); fixtures.categories.add(categoryId);
    const email = `people-ui-teacher-${suffix}@example.test`;
    fixtures.emails.add(email);
    await page.goto('/teachers', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Yeni Öğretmen', exact: true })).toBeVisible({ timeout: 120000 });
    await page.getByRole('button', { name: 'Yeni Öğretmen', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Yeni Öğretmen', exact: true });
    await dialog.getByLabel('Tam İsim', { exact: true }).fill(`People Teacher ${suffix}`);
    await dialog.getByLabel('E-posta Adresi', { exact: true }).fill(email);
    await dialog.getByLabel('Güvenli Şifre', { exact: true }).fill('AuditOnly2026!');
    await dialog.getByRole('checkbox', { name: categoryName, exact: true }).check();
    await dialog.getByRole('checkbox', { name: classroom.name, exact: true }).check();
    await dialog.getByRole('button', { name: 'Hesabı Oluştur', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('row').filter({ hasText: `People Teacher ${suffix}` })).toBeVisible();
    const users = await api(page, '/users');
    const persisted = users.body.users.find((user: any) => user.email === email);
    await evidence(page, info, 'teacher-selected-assignments', { persisted, expectedClassId: classroom.id, expectedCategoryId: categoryId });
    expect.soft(persisted.assignedCategories.map((course: any) => course.id)).toContain(categoryId);
    expect.soft(persisted.classes.map((item: any) => item.id)).toContain(classroom.id);
  });
});

test('people: guardian link and unlink persist after reload', async ({ page }, info) => {
  await login(page);
  await withFixtures(page, info, async fixtures => {
    const suffix = unique();
    const student = await createStudent(page, fixtures, `People Linked Student ${suffix}`, suffix);
    fixtures.emails.add(`people-guardian-${suffix}@example.test`);
    const parent = await api(page, '/users', 'POST', {
      name: `People Guardian ${suffix}`, email: `people-guardian-${suffix}@example.test`,
      password: 'AuditOnly2026!', role: 'parent', phoneNumber: '05551112233', address: 'People isolated audit address',
    });
    expect(parent.status, JSON.stringify(parent.body)).toBe(201);
    const guardian = parent.body.user; fixtures.users.set(guardian.id, guardian);
    const removeName = `${student.name} veli bağlantısını kaldır`;
    await page.goto('/guardian-management', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('combobox', { name: 'Veli hesabı', exact: true })).toBeVisible({ timeout: 120000 });
    await page.getByRole('combobox', { name: 'Veli hesabı', exact: true }).click();
    await page.getByRole('option', { name: `${guardian.name} · ${guardian.email}`, exact: true }).click();
    await page.getByRole('textbox', { name: 'Öğrenci ara', exact: true }).fill(student.name);
    await page.getByRole('combobox', { name: 'Öğrenci', exact: true }).click();
    await page.getByRole('option').filter({ hasText: student.name }).click();
    await page.getByRole('combobox', { name: 'Yakınlık derecesi', exact: true }).click();
    await page.getByRole('option', { name: 'Baba', exact: true }).click();
    await page.getByRole('button', { name: 'Öğrenciyi Veliye Bağla', exact: true }).click();
    await expect(page.getByRole('button', { name: removeName, exact: true })).toBeVisible();
    let links = await api(page, `/parents/guardian/${guardian.id}/students`);
    expect(links.body.students.find((link: any) => link.studentId === student.id)?.relation).toBe('Baba');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('combobox', { name: 'Veli hesabı', exact: true }).click();
    await page.getByRole('option', { name: `${guardian.name} · ${guardian.email}`, exact: true }).click();
    await expect(page.getByRole('button', { name: removeName, exact: true })).toBeVisible();
    await page.getByRole('button', { name: removeName, exact: true }).click();
    await expect(page.getByRole('button', { name: removeName, exact: true })).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    links = await api(page, `/parents/guardian/${guardian.id}/students`);
    await evidence(page, info, 'guardian-unlinked', links);
    expect(links.body.students).toHaveLength(0);
  });
});

test('people: same-level student transfer persists target and removes old enrollment', async ({ page }, info) => {
  await login(page);
  await withFixtures(page, info, async fixtures => {
    const suffix = unique();
    const source = await createClass(page, fixtures, `91-A-${suffix}`);
    const target = await createClass(page, fixtures, `91-B-${suffix}`);
    const student = await createStudent(page, fixtures, `People Transfer ${suffix}`, suffix, source.id);
    await page.goto(`/admin/classes/${target.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: `Sınıf Yönetimi: ${target.name}`, exact: true })).toBeVisible({ timeout: 120000 });
    await page.getByRole('combobox', { name: 'Seviyeye Uygun Öğrenciler', exact: true }).click();
    await page.getByRole('option').filter({ hasText: student.name }).click();
    await page.getByRole('button', { name: 'Sınıfa Dahil Et', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: student.email })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('row').filter({ hasText: student.email })).toBeVisible();
    const [oldClass, newClass] = await Promise.all([api(page, `/classes/${source.id}`), api(page, `/classes/${target.id}`)]);
    await evidence(page, info, 'student-transfer', { oldClass, newClass });
    expect(oldClass.body.students.some((user: any) => user.id === student.id)).toBe(false);
    const enrolled = newClass.body.students.find((user: any) => user.id === student.id);
    expect(enrolled.classId).toBe(target.id);
    expect(enrolled.studentNo).toBe(1);
  });
});
