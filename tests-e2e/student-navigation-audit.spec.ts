import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { login, api, prisma } from './student-audit-helpers';

const out = 'tests/denetim-kanitlari/ogrenci';
const routes = ['/', '/student/dashboard','/student/quizzes','/my-quizzes','/student/results','/my-results','/my-stats','/student/surveys','/student/survey/55555555-5555-4555-8555-555555555555','/student/result/student-audit-result','/settings','/announcements'];
for (const [group, batch] of [routes.slice(0,6), routes.slice(6)].entries()) {
test(`S-N01 group ${group+1}: loaded student routes, aliases, reload, mobile and console`, async ({ page }) => {
  test.setTimeout(180000);
  mkdirSync(out + '/screenshots', { recursive: true });
  await login(page);
  const errors: string[] = [], failed: string[] = [], observations: any[] = [], responses: any[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/api/')) { responses.push({ path: new URL(r.url()).pathname, status: r.status(), timing: r.request().timing() }); if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); } });
  try {
  for (const route of batch) {
    const expected = route === '/' || route.includes('dashboard') ? 'Hoş Geldin' : route.includes('quizzes') ? 'Student Audit Exam' : route.includes('/survey/') || route.endsWith('/surveys') ? 'Student Audit Survey' : route === '/my-stats' ? 'Audit Mathematics' : route === '/settings' ? 'Hesap Ayarları' : route === '/announcements' ? 'Student Audit Announcement' : 'Student Audit Completed Exam';
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main')).toContainText(expected, { timeout: 30000 });
    await expect(page.locator('body')).not.toContainText('404 Page Not Found');
    await page.reload();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/yükleniyor/i);
    await expect(page.locator('main')).toContainText(expected, { timeout: 30000 });
    await page.setViewportSize({ width: 390, height: 844 });
    observations.push({ route, text: (await page.locator('main').innerText()).slice(0,700), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), unnamed: await page.locator('main').evaluate(el => Array.from(el.querySelectorAll('button,input,textarea')).filter(x => !x.getAttribute('aria-label') && !x.getAttribute('aria-labelledby') && !x.textContent?.trim() && !(x.id && document.querySelector(`label[for="${x.id}"]`))).length) });
    await page.screenshot({ path: `${out}/screenshots/${route.replace(/\W+/g,'-') || 'home'}-mobile.png`, fullPage: true });
    writeFileSync(`${out}/screenshots/${route.replace(/\W+/g,'-') || 'home'}-accessible.txt`, await page.locator('main').ariaSnapshot());
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  expect(errors).toEqual([]);
  } finally { writeFileSync(`${out}/navigation-observations-${group+1}.json`, JSON.stringify({ observations, errors, failed, responses }, null,2)); }
});
}

test('S-N02 anonymous protected route and server endpoints reject access', async ({ page }) => {
  await page.goto('/student/quizzes');
  await expect(page).toHaveURL(/\/auth/);
  expect((await page.request.get('/api/student/results')).status()).toBe(401);
  await login(page);
  expect((await api(page,'GET','/student/results/student-audit-private-result')).status()).toBe(403);
  await page.goto('/management');
  await expect(page).toHaveURL(/\/$/);
  await page.request.post('/api/auth/logout', { headers: { 'x-csrf-token': (await (await page.request.get('/api/csrf-token')).json()).csrfToken } });
  await page.goto('/student/results');
  await expect(page).toHaveURL(/\/auth/);
});

test('S-N03 quiz search and result export/print use real student records', async ({ page }) => {
  await login(page);
  await page.goto('/student/quizzes');
  await expect(page.getByText('Student Audit Exam', { exact:true })).toBeVisible();
  await page.getByPlaceholder('Sınav adı veya konu ara...').fill('does-not-exist');
  await expect(page.getByText('Aradığınız sınav bulunamadı.')).toBeVisible();
  await page.getByPlaceholder('Sınav adı veya konu ara...').fill('Completed');
  await expect(page.getByText('Student Audit Completed Exam', {exact:true})).toBeVisible();
  await page.goto('/student/results');
  await expect(page.getByText('Student Audit Completed Exam', {exact:true})).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', {name:'Excel', exact:true}).click();
  const download = await downloadEvent;
  const filename = `${out}/student-results-export.xlsx`;
  await download.saveAs(filename);
  const csv = readFileSync(filename,'utf8');
  expect(csv).toContain('Student Audit Completed Exam');
  expect(csv).not.toContain('Private Other');
  await page.emulateMedia({media:'print'});
  await page.pdf({path:`${out}/student-results-print.pdf`,printBackground:true});
  await page.emulateMedia({media:'screen'});
  await page.goto('/my-stats');
  await expect(page.getByText('İstatistikler', {exact:true})).toBeVisible();
  const statsDownload = page.waitForEvent('download');
  await page.getByRole('button', {name:/Excel/}).click();
  await (await statsDownload).saveAs(`${out}/student-statistics-export.xlsx`);
});

test('S-N04 missing quiz back navigation stays in authorized student panel', async ({page}) => {
  await login(page);
  await page.goto('/student/quiz/does-not-exist');
  await page.getByRole('button', {name:/Geri|Dön/}).first().click();
  await expect(page).toHaveURL(/\/student\/quizzes$/);
  await page.goto('/student/quiz/student-audit-completed-exam');
  await expect(page.getByText('Bu sınav daha önce tamamlanmış.', { exact: true })).toBeVisible();
  await page.getByRole('button', {name:'Quizlere Dön', exact:true}).click();
  await expect(page).toHaveURL(/\/student\/quizzes$/);
  const db = prisma(), emptyId = 'student-audit-repair-empty-exam';
  try {
    await db.quiz.create({data:{id:emptyId,title:'Repair Empty Exam',status:'published',contentType:'exam',createdBy:'student-audit-teacher',assignedClasses:{connect:{id:'11111111-1111-4111-8111-111111111111'}}}});
    await page.goto(`/student/quiz/${emptyId}`);
    await expect(page.getByText('Quizde Soru Yok', {exact:true})).toBeVisible();
    await page.getByRole('button', {name:'Quizlere Geri Dön', exact:true}).click();
    await expect(page).toHaveURL(/\/student\/quizzes$/);
    await login(page,'student-audit-teacher@example.test');
    await page.goto(`/student/quiz/${emptyId}`);
    await expect(page.getByText('Quizde Soru Yok', {exact:true})).toBeVisible();
    await page.getByRole('button', {name:'Quizlere Geri Dön', exact:true}).click();
    await expect(page).toHaveURL(/\/quizzes$/);
  } finally {
    await db.studentResult.deleteMany({where:{quizId:emptyId}});
    await db.quiz.deleteMany({where:{id:emptyId}});
    await db.$disconnect();
  }
});

test('S-N05 stats display category names from real relation objects', async ({page}) => {
  await login(page);
  await page.goto('/my-stats');
  await expect(page.locator('main')).toContainText('Audit Mathematics');
  await expect(page.locator('main')).not.toContainText('[object Object]');
});

test('S-N06 empty student and controlled survey failure observation', async ({page}) => {
  await login(page,'student-audit-empty@example.test');
  await page.goto('/student/results');
  await expect(page.getByText('Sonuç Bulunamadı')).toBeVisible();
  await login(page);
  await page.route('**/api/surveys', route => route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Audit controlled failure'})}));
  await page.goto('/student/surveys');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByText('Anketler yükleniyor...', { exact: true })).toHaveCount(0);
  await page.screenshot({path:`${out}/screenshots/survey-controlled-failure.png`, fullPage:true});
  writeFileSync(`${out}/survey-failure-observation.txt`,await page.locator('main').innerText());
});
