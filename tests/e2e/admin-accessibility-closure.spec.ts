import { test, expect, type Page, type Locator, type TestInfo, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';

// This suite reads audit fixtures and opens/cancels forms. It never submits application data.
const runtime = JSON.parse(readFileSync('tests/denetim-kanitlari/yonetici/runtime.json', 'utf8'));
const root = resolve(runtime.root);
if (dirname(root) !== resolve('server/data') || !/^quizmaster-test-admin-audit-/.test(basename(root)) ||
    resolve(runtime.database) !== join(root, 'server', 'data', 'audit.db') ||
    JSON.stringify(runtime.ports) !== '[5510,5511]') {
  throw new Error('Accessibility closure requires the disposable admin audit runtime on 5510/5511.');
}

const routes = ['/', '/admin-quizzes', '/quizzes', '/statistics', '/results', '/survey-results',
  '/students', '/teachers', '/guardian-management', '/classlist', '/management', '/archive',
  '/server-setup', '/announcements', '/settings', '/create-quiz', '/quizzes/audit-exam',
  '/teachers/audit-teacher', '/classes/audit-class', '/admin/classes/audit-class',
  '/student/result/audit-result', '/student/quiz/audit-teacher-exam', '/student/results'];
const viewports = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }];

type RequestDiagnostic = { method: string; pathname: string; error: string };
type PageDiagnostics = {
  pageErrors: string[];
  consoleErrors: { message: string; location: { pathname: string; line: number } }[];
  apiErrors: { method: string; status: number; pathname: string }[];
  failedRequests: RequestDiagnostic[];
  abortedRequests: RequestDiagnostic[];
  navigation: string[];
  inventoryStates: string[];
  navigationTiming?: {
    responseStart: number; domInteractive: number; domContentLoadedEventEnd: number;
    loadEventEnd: number; transferSize: number;
  };
};
const diagnosticsByPage = new WeakMap<Page, PageDiagnostics>();
function pathnameOnly(url: string) {
  try { return new URL(url).pathname; } catch { return '(unavailable pathname)'; }
}
function redactDiagnosticMessage(message: string) {
  if (/password|cookie|authorization|secret|csrf|token/i.test(message)) return '[redacted sensitive diagnostic message]';
  return message.replace(/\b(?:https?|wss?|file):\/\/[^\s"'<>]+/gi, url => pathnameOnly(url)).slice(0, 2000);
}

let auditCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
test.beforeAll(async ({ request, baseURL }) => {
  if (baseURL !== 'http://127.0.0.1:5511') throw new Error('Never run this suite against the real application database.');
  const csrf = await request.get('/api/csrf-token');
  expect(csrf.status()).toBe(200);
  const token = (await csrf.json()).csrfToken;
  const login = await request.post('/api/auth/login', {
    data: { email: 'audit-admin@example.test', password: 'AuditOnly2026!' },
    headers: { 'x-csrf-token': token },
  });
  expect(login.status()).toBe(200);
  // Keep session cookies in worker memory; never persist authentication artifacts.
  auditCookies = (await request.storageState()).cookies;
});

test.beforeEach(async ({ page, baseURL }) => {
  if (baseURL !== 'http://127.0.0.1:5511') throw new Error('Never run this suite against the real application database.');
  await page.context().addCookies(auditCookies);
  const diagnostics: PageDiagnostics = {
    pageErrors: [], consoleErrors: [], apiErrors: [], failedRequests: [], abortedRequests: [], navigation: [], inventoryStates: [],
  };
  diagnosticsByPage.set(page, diagnostics);
  page.on('pageerror', error => diagnostics.pageErrors.push(redactDiagnosticMessage(error.message)));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const location = message.location();
    diagnostics.consoleErrors.push({
      message: redactDiagnosticMessage(message.text()),
      location: { pathname: pathnameOnly(location.url), line: location.lineNumber },
    });
  });
  page.on('response', response => {
    const pathname = pathnameOnly(response.url());
    if (response.status() >= 400 && (pathname === '/api' || pathname.startsWith('/api/'))) {
      diagnostics.apiErrors.push({ method: response.request().method(), status: response.status(), pathname });
    }
  });
  page.on('requestfailed', request => {
    const failureText = request.failure()?.errorText || 'Unknown request failure';
    const failed = {
      method: request.method(), pathname: pathnameOnly(request.url()),
      error: redactDiagnosticMessage(failureText),
    };
    if (failureText.includes('ERR_ABORTED')) diagnostics.abortedRequests.push(failed);
    else diagnostics.failedRequests.push(failed);
  });
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) diagnostics.navigation.push(pathnameOnly(frame.url()));
  });
});

test.afterEach(async ({ page }, info) => {
  const diagnostics = diagnosticsByPage.get(page);
  if (!diagnostics) return;
  await info.attach('runtime-diagnostics', {
    body: JSON.stringify({
      scope: { title: info.title, viewport: page.viewportSize(), finalPathname: pathnameOnly(page.url()) },
      ...diagnostics,
    }),
    contentType: 'application/json',
  });
  // HTTP failures remain evidence: some routes intentionally display guard/error states.
  expect.soft(diagnostics.pageErrors, 'No JavaScript page errors during accessibility navigation').toEqual([]);
});

async function open(page: Page, route: string) {
  const pending = new Set<import('@playwright/test').Request>();
  const started = (request: import('@playwright/test').Request) => {
    if (request.url().includes('/api/')) pending.add(request);
  };
  const finished = (request: import('@playwright/test').Request) => pending.delete(request);
  page.on('request', started);
  page.on('requestfinished', finished);
  page.on('requestfailed', finished);
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-dashboard-shell]')).toBeVisible();
    await expect(page.locator('main .animate-spin')).toHaveCount(0);
    await expect.poll(() => pending.size).toBe(0);
    const timing = await page.evaluate(() => {
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!entry) return undefined;
      return {
        responseStart: entry.responseStart, domInteractive: entry.domInteractive,
        domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
        loadEventEnd: entry.loadEventEnd, transferSize: entry.transferSize,
      };
    });
    const diagnostics = diagnosticsByPage.get(page);
    if (diagnostics) diagnostics.navigationTiming = timing;
  } finally {
    page.off('request', started);
    page.off('requestfinished', finished);
    page.off('requestfailed', finished);
  }
}

async function namesAndSnapshot(page: Page, info: TestInfo, state: string) {
  diagnosticsByPage.get(page)?.inventoryStates.push(state);
  // Playwright's ARIA snapshot and accessible-name matcher use the browser's computed
  // accessibility representation. This is not a textContent/title attribute heuristic.
  await info.attach(`${state}-computed-aria`, {
    body: await page.locator('body').ariaSnapshot(), contentType: 'text/yaml',
  });
  const roles = ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio', 'switch',
    'spinbutton', 'slider', 'tab', 'menuitem'] as const;
  for (const role of roles) {
    const controls = page.getByRole(role);
    const controlCount = await controls.count();
    for (let i = 0; i < controlCount; i++) {
      const control = controls.nth(i);
      if (await control.isVisible()) {
        await expect.soft(control, `${state}: computed ${role} name, index ${i}`).toHaveAccessibleName(/\S/, { timeout: 300 });
      }
    }
  }
  // Password inputs do not have an implicit textbox role.
  const passwords = page.locator('input[type=password]');
  const passwordCount = await passwords.count();
  for (let i = 0; i < passwordCount; i++) {
    if (await passwords.nth(i).isVisible()) await expect.soft(passwords.nth(i)).toHaveAccessibleName(/\S/, { timeout: 300 });
  }
}

async function tabTo(page: Page, target: Locator) {
  // Actual Tab navigation, without programmatically focusing the target.
  await expect(target).toBeVisible();
  for (let attempt = 0; attempt < 160; attempt++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target, 'Control must be reachable by Tab').toBeFocused();
}

async function focusInside(container: Locator) {
  await expect.poll(() => container.evaluate(element => element.contains(document.activeElement))).toBe(true);
}

async function openManagementLogView(page: Page, button: Locator) {
  const pending = new Set<import('@playwright/test').Request>();
  const started = (request: import('@playwright/test').Request) => {
    if (request.url().includes('/api/')) pending.add(request);
  };
  const finished = (request: import('@playwright/test').Request) => pending.delete(request);
  page.on('request', started);
  page.on('requestfinished', finished);
  page.on('requestfailed', finished);
  try {
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('main .animate-spin')).toHaveCount(0);
    await expect.poll(() => pending.size).toBe(0);
  } finally {
    page.off('request', started);
    page.off('requestfinished', finished);
    page.off('requestfailed', finished);
  }
}

for (const viewport of viewports) {
  for (const route of routes) {
    test(`computed accessibility ${viewport.name} ${route}`, async ({ page }, info) => {
      // These tests repeat the entire computed-name inventory in 14 management
      // states or 5 settings states. Keep assertion/network timeouts unchanged.
      if (route === '/management') test.setTimeout(600000);
      if (route === '/settings') test.setTimeout(240000);
      await page.setViewportSize(viewport);
      await open(page, route);
      await namesAndSnapshot(page, info, 'initial');
      // Explore every top-level tab and any nested tablists using their own arrow key contract.
      const topLists = page.getByRole('tablist').and(page.locator('[role="tablist"]:not([role="tabpanel"] [role="tablist"])'));
      const listCount = await topLists.count();
      for (let listIndex = 0; listIndex < listCount; listIndex++) {
        const list = topLists.nth(listIndex);
        if (!await list.isVisible()) continue;
        const tabs = list.getByRole('tab');
        const tabCount = await tabs.count();
        await tabs.first().focus();
        await page.keyboard.press('Home');
        for (let i = 0; i < tabCount; i++) {
          await page.keyboard.press('Enter');
          const focused = list.locator(':focus');
          await expect(focused).toHaveAttribute('aria-selected', 'true');
          await namesAndSnapshot(page, info, `tablist-${listIndex}-tab-${i}`);
          const nested = page.getByRole('tabpanel').getByRole('tablist');
          for (let nestedIndex = 0; nestedIndex < await nested.count(); nestedIndex++) {
            const nestedList = nested.nth(nestedIndex);
            if (!await nestedList.isVisible()) continue;
            const nestedTabs = nestedList.getByRole('tab');
            await nestedTabs.first().focus();
            await page.keyboard.press('Home');
            for (let j = 0; j < await nestedTabs.count(); j++) {
              await page.keyboard.press('Enter');
              await expect(nestedList.locator(':focus')).toHaveAttribute('aria-selected', 'true');
              await namesAndSnapshot(page, info, `tablist-${listIndex}-tab-${i}-nested-${nestedIndex}-${j}`);
              await page.keyboard.press('ArrowRight');
            }
          }
          // Log subviews use regular buttons rather than a Radix tablist.
          // Match verified source text; badges may append counts to button names.
          if (route === '/management' && (await tabs.nth(i).textContent())?.trim() === 'Loglar') {
            const logViews = [
              { key: 'users', name: /^Kullanıcı Logları$/ },
              { key: 'emails', name: /^E-Posta Logları/ },
              { key: 'password-resets', name: /^Şifre Talepleri/ },
              { key: 'system', name: /^Sistem Hata & İşlemleri$/ },
            ];
            for (const view of logViews) {
              await openManagementLogView(page, page.getByRole('tabpanel').getByRole('button', { name: view.name }));
              await namesAndSnapshot(page, info, `management-log-${view.key}`);
            }
          }
          await tabs.nth(i).focus();
          await page.keyboard.press('ArrowRight');
        }
      }
    });
  }

  test(`keyboard tabs and profile labels ${viewport.name}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await open(page, '/settings');
    const profile = page.getByRole('tab', { name: 'Profil Bilgileri', exact: true });
    await tabTo(page, profile);
    await page.keyboard.press('ArrowRight');
    const notifications = page.getByRole('tab', { name: 'Bildirimler', exact: true });
    await expect(notifications).toBeFocused();
    await expect(notifications).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/tab=notifications/);
    await expect(page.getByRole('switch', { name: 'Bildirim sesini aç veya kapat', exact: true })).toBeVisible();
    // Do not toggle persisted notification preferences.
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Güvenlik', exact: true })).toBeFocused();
    await namesAndSnapshot(page, info, 'security');
    await page.keyboard.press('Home');
    await expect(profile).toBeFocused();
    await expect(profile).toHaveAttribute('aria-selected', 'true');
    // Require meaningful field names, rather than accepting placeholder fallback names.
    const fields = [['Ad Soyad', 'Ad Soyad'], ['email@example.com', 'E-posta'],
      ['05xx xxx xx xx', 'Telefon'], ['İletişim adresi', 'Adres']];
    for (const [placeholder, name] of fields) {
      await expect.soft(page.getByPlaceholder(placeholder, { exact: true })).toHaveAccessibleName(name, { timeout: 300 });
    }
    await tabTo(page, page.getByPlaceholder('Ad Soyad', { exact: true }));
    await info.attach('keyboard-focus', { body: await page.screenshot(), contentType: 'image/png' });
  });

  test(`keyboard dialog focus trap and restoration ${viewport.name}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await open(page, '/management');
    const trigger = page.getByRole('button', { name: 'Yeni Ders Ekle', exact: true });
    await tabTo(page, trigger);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Yeni Ders Kaydı', exact: true });
    await expect(dialog).toBeVisible();
    await focusInside(dialog);
    await namesAndSnapshot(page, info, 'category-dialog');
    for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); await focusInside(dialog); }
    for (let i = 0; i < 10; i++) { await page.keyboard.press('Shift+Tab'); await focusInside(dialog); }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test(`keyboard results select escape restoration ${viewport.name}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await open(page, '/results');
    const select = page.getByRole('combobox').first();
    await tabTo(page, select);
    await page.keyboard.press('Space');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option').and(page.locator(':focus'))).toHaveCount(1);
    await namesAndSnapshot(page, info, 'results-select');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(select).toBeFocused();
  });
}

test('mobile keyboard navigation trap, Escape and link activation', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/management');
  const trigger = page.getByRole('button', { name: 'Menüyü aç', exact: true });
  await tabTo(page, trigger);
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Ana menü', exact: true });
  await expect(menu).toBeVisible();
  await expect(page.locator('button[aria-label="Menüyü aç"]')).toHaveAttribute('aria-expanded', 'true');
  await focusInside(menu);
  await namesAndSnapshot(page, info, 'mobile-menu');
  await expect(page.getByRole('main')).toHaveCount(0); // background excluded from accessibility tree
  for (let i = 0; i < 35; i++) { await page.keyboard.press('Tab'); await focusInside(menu); }
  for (let i = 0; i < 35; i++) { await page.keyboard.press('Shift+Tab'); await focusInside(menu); }
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await tabTo(page, menu.getByRole('link', { name: 'Ayarlar', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('main')).toBeVisible();
});
