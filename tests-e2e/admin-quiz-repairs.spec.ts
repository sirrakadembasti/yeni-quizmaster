import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const runtime = JSON.parse(readFileSync('tests/denetim-kanitlari/yonetici/runtime.json', 'utf8'));
const root = resolve(runtime.root);
if (dirname(root) !== resolve('server/data') || !basename(root).startsWith('quizmaster-test-admin-audit-') ||
    resolve(runtime.database) !== join(root, 'server', 'data', 'audit.db') || JSON.stringify(runtime.ports) !== '[5510,5511]') {
  throw new Error('Quiz repairs must use the disposable audit database and ports.');
}
const { PrismaClient } = createRequire(resolve('server/package.json'))('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${runtime.database.replaceAll('\\', '/')}` } } });

async function login(page: any, baseURL: string | undefined) {
  expect(baseURL).toBe('http://127.0.0.1:5511');
  const csrf = await page.request.get(baseURL + '/api/csrf-token');
  expect((await page.request.post(baseURL + '/api/auth/login', {
    data: { email: 'audit-admin@example.test', password: 'AuditOnly2026!' },
    headers: { 'x-csrf-token': (await csrf.json()).csrfToken },
  })).status()).toBe(200);
  // Authentication regenerates the session; mutations use its current CSRF token.
  return (await (await page.request.get(baseURL + '/api/csrf-token')).json()).csrfToken;
}

test('admin quizzes: a failed load retries; permanent deletion records reason and impact and survives reload', async ({ page, baseURL }, info) => {
  test.setTimeout(360000);
  const id = randomUUID();
  const title = `Deletion regression ${id}`;
  const reason = `Duplicated assessment ${id}`;
  try {
    await prisma.quiz.create({ data: { id, title, createdBy: 'audit-admin', contentType: 'exam', status: 'archived',
      questions: { create: { text:'Choose A', options:JSON.stringify(['A','B']), correctAnswer:'A', type:'multiple-choice', order:0 } },
    } });
    await prisma.studentResult.create({ data: {studentId:'audit-student', quizId:id, status:'completed', score:100} });
    await login(page, baseURL);
    let offline = true;
    await page.route('**/api/admin/quizzes', route => offline
      ? route.fulfill({status:500, contentType:'application/json', body:JSON.stringify({message:'Audit injected load failure'})})
      : route.continue());
    await page.goto('/admin-quizzes', {waitUntil:'domcontentloaded'});
    await expect(page.getByRole('alert').filter({hasText:'Sınavlar yüklenemedi'})).toBeVisible({timeout:30000});
    await expect(page.getByText('Sınav bulunamadı.', {exact:true})).toHaveCount(0);
    offline = false;
    await page.getByRole('button',{name:'Yeniden dene', exact:true}).click();
    await page.getByRole('textbox',{name:'Sınav başlığı veya ders ile ara'}).fill(title);
    const row = page.getByRole('row').filter({has:page.getByRole('cell',{name:title, exact:true})});
    await expect(row.getByText('Arşivlenmiş',{exact:true})).toBeVisible();
    await row.getByRole('button',{name:`${title} işlemleri`,exact:true}).click();
    await page.getByRole('menuitem',{name:'Sil',exact:true}).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('öğrenci sonuçları');
    await expect(dialog).toContainText('1 öğrenci sonucu');
    await dialog.getByLabel('Silme Nedeni').fill(reason);
    const deletion = page.waitForResponse(response => response.url().endsWith(`/api/quizzes/${id}`) && response.request().method() === 'DELETE');
    await dialog.getByRole('button',{name:'Evet, Kalıcı Olarak Sil',exact:true}).click();
    expect((await deletion).status()).toBe(200);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Sınav bulunamadı.',{exact:true})).toBeVisible();
    const log = await prisma.actionLog.findFirst({where:{action:'DELETE_QUIZ',details:{contains:id}},orderBy:{createdAt:'desc'}});
    expect(log.userId).toBe('audit-admin');
    expect(JSON.parse(log.details)).toMatchObject({quizId:id,title,reason,questions:1,results:1,surveySubmissions:0});
    expect(await prisma.quiz.findUnique({where:{id}})).toBeNull();
    expect(await prisma.question.count({where:{quizId:id}})).toBe(0);
    expect(await prisma.studentResult.count({where:{quizId:id}})).toBe(0);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('textbox',{name:'Sınav başlığı veya ders ile ara'}).fill(title);
    await expect(page.getByText('Sınav bulunamadı.',{exact:true})).toBeVisible();
    await page.screenshot({path:info.outputPath('delete-audit-reload.png'),fullPage:true,timeout:10000});
  } finally {
    await prisma.quiz.deleteMany({where:{id}});
    await prisma.actionLog.deleteMany({where:{action:'DELETE_QUIZ',details:{contains:id}}});
  }
});

test('published exam and survey keep their questions when legacy endpoints reject empty or invalid replacements', async ({ page, baseURL }) => {
  test.setTimeout(360000);
  const examId = randomUUID(); const surveyId = randomUUID();
  try {
    for (const [id, contentType, type] of [[examId,'exam','multiple-choice'],[surveyId,'survey','single-choice']]) {
      await prisma.quiz.create({data:{id,title:`Published guard ${id}`,createdBy:'audit-admin',contentType,status:'published',
        questions:{create:{text:'Choose A',type,options:JSON.stringify(['A','B']),correctAnswer:contentType === 'exam' ? 'A':null,order:0}},
      }});
    }
    const csrfToken = await login(page, baseURL);
    const headers = {'x-csrf-token':csrfToken};
    for (const [endpoint,id] of [['quizzes',examId],['surveys',surveyId]]) {
      const response = await page.request.post(`${baseURL}/api/${endpoint}/${id}/questions`,{headers,data:[]});
      expect(response.status()).toBe(400);
      expect(await prisma.question.count({where:{quizId:id}})).toBe(1);
      expect((await prisma.quiz.findUnique({where:{id}})).status).toBe('published');
      expect((await page.request.post(`${baseURL}/api/${endpoint}`,{headers,data:{title:'Empty published legacy content',status:'published'}})).status()).toBe(400);
    }
    expect((await page.request.post(`${baseURL}/api/quizzes/${examId}/questions`,{headers,data:[{text:'Invalid answer',options:['A','B'],correctAnswer:'C',type:'multiple-choice'}]})).status()).toBe(400);
    expect(JSON.parse((await prisma.question.findFirst({where:{quizId:examId}})).options)).toEqual(['A','B']);
  } finally {
    await prisma.quiz.deleteMany({where:{id:{in:[examId,surveyId]}}});
  }
});

test.afterAll(async () => {await prisma.$disconnect();});
