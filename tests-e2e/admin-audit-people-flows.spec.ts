import { test, expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

// Run only against the disposable admin audit backend, after the route suite.
// Setup uses unique UUID records returned by the real API, never alters audit-* fixtures.
// Desired-behavior assertions intentionally expose existing production defects.
let cookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
test.beforeEach(async ({ baseURL }) => {
  expect(baseURL, 'People audit mutations require the disposable 5511 audit frontend').toBe('http://127.0.0.1:5511');
});
async function login(page: Page) {
  if (cookies?.length) {
    await page.context().addCookies(cookies);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  } else {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('E-posta', { exact: true }).fill('audit-admin@example.test');
    await page.getByLabel('Şifre', { exact: true }).fill('AuditOnly2026!');
    await page.getByRole('button', { name: /Giriş Yap/ }).last().click();
    await expect(page.locator('[data-dashboard-shell]')).toBeVisible({ timeout: 30000 });
    cookies = await page.context().cookies();
  }
  await expect(page.locator('[data-dashboard-shell]')).toBeVisible();
}
async function api(page: Page, path: string, method = 'GET', data?: unknown) {
  return page.evaluate(async ({ path, method, data }) => {
    const token = await fetch('/api/csrf-token').then(response => response.json());
    const response = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': token.csrfToken },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, body: await response.json() };
  }, { path, method, data });
}
const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
async function createClass(page: Page, name: string) {
  const response = await api(page, '/classes', 'POST', { name });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body;
}
async function createStudent(page: Page, name: string, suffix: string, classId?: string) {
  const response = await api(page, '/users', 'POST', {
    name, email: `people-student-${suffix}@example.test`, password: 'AuditOnly2026!', role: 'student',
    ...(classId ? { classId } : {}),
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.user;
}
async function evidence(page: Page, info: TestInfo, label: string, data: unknown) {
  await info.attach(label, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath(`${label}.png`), fullPage: true, timeout: 10000 });
}

test('people: student creation in real modal persists enrollment and automatic number', async ({ page }, info) => {
  await login(page);
  const suffix = unique();
  const classroom = await createClass(page, `89-A-${suffix}`);
  const name = `People Student ${suffix}`;
  const email = `people-ui-student-${suffix}@example.test`;
  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Yeni Öğrenci', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Örn: Ahmet Yılmaz').fill(name);
  await dialog.getByPlaceholder('ornek@okul.com').fill(email);
  await dialog.getByPlaceholder('En az 6 karakter').fill('AuditOnly2026!');
  await dialog.getByRole('combobox').first().click();
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

test('people: teacher creation must retain selected course and class', async ({ page }, info) => {
  test.setTimeout(240000);
  await login(page);
  const suffix = unique();
  const classroom = await createClass(page, `90-A-${suffix}`);
  const category = await api(page, '/categories', 'POST', { name: `People Course ${suffix}` });
  expect(category.status, JSON.stringify(category.body)).toBe(201);
  const categoryId = category.body.id ?? category.body.category?.id;
  const categoryName = category.body.name ?? category.body.category?.name;
  expect(categoryId).toBeTruthy();
  const email = `people-ui-teacher-${suffix}@example.test`;
  await page.goto('/teachers', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Yeni Öğretmen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Örn: Ahmet Yılmaz').fill(`People Teacher ${suffix}`);
  await dialog.getByPlaceholder('ornek@okul.com').fill(email);
  await dialog.getByPlaceholder('En az 6 karakter').fill('AuditOnly2026!');
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

test('people: guardian link and unlink persist after reload', async ({ page }, info) => {
  await login(page);
  const suffix = unique();
  const student = await createStudent(page, `People Linked Student ${suffix}`, suffix);
  const parent = await api(page, '/users', 'POST', {
    name: `People Guardian ${suffix}`, email: `people-guardian-${suffix}@example.test`,
    password: 'AuditOnly2026!', role: 'parent', phoneNumber: '05551112233', address: 'People isolated audit address',
  });
  expect(parent.status, JSON.stringify(parent.body)).toBe(201);
  const guardian = parent.body.user;
  await page.goto('/guardian-management', { waitUntil: 'domcontentloaded' });
  await page.getByRole('combobox').nth(0).click();
  await page.getByRole('option', { name: `${guardian.name} · ${guardian.email}`, exact: true }).click();
  await page.getByPlaceholder('Öğrenci adı, e-posta, sınıf veya no ara').fill(student.name);
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option').filter({ hasText: student.name }).click();
  await page.getByRole('combobox').nth(2).click();
  await page.getByRole('option', { name: 'Baba', exact: true }).click();
  await page.getByRole('button', { name: 'Öğrenciyi Veliye Bağla', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bağlantıyı Kaldır', exact: true })).toBeVisible();
  let links = await api(page, `/parents/guardian/${guardian.id}/students`);
  expect(links.body.students.find((link: any) => link.studentId === student.id)?.relation).toBe('Baba');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('combobox').nth(0).click();
  await page.getByRole('option', { name: `${guardian.name} · ${guardian.email}`, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bağlantıyı Kaldır', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bağlantıyı Kaldır', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bağlantıyı Kaldır', exact: true })).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  links = await api(page, `/parents/guardian/${guardian.id}/students`);
  await evidence(page, info, 'guardian-unlinked', links);
  expect(links.body.students).toHaveLength(0);
});

test('people: same-level student transfer persists target and removes old enrollment', async ({ page }, info) => {
  await login(page);
  const suffix = unique();
  const source = await createClass(page, `91-A-${suffix}`);
  const target = await createClass(page, `91-B-${suffix}`);
  const student = await createStudent(page, `People Transfer ${suffix}`, suffix, source.id);
  await page.goto(`/admin/classes/${target.id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: `Sınıf Yönetimi: ${target.name}`, exact: true })).toBeVisible();
  await page.getByRole('combobox').nth(1).click();
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
