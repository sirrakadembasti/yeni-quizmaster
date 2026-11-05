import {test,expect,Page} from '@playwright/test';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
// Mutations are permitted only in the disposable audit runtime.
const runtime=JSON.parse(readFileSync('tests/denetim-kanitlari/yonetici/runtime.json','utf8'));
const isolatedRoot=resolve(runtime.root);
if(dirname(isolatedRoot)!==resolve('server/data')||!/^quizmaster-test-admin-audit-/.test(isolatedRoot.split(/[\\/]/).at(-1)!)||
  resolve(runtime.database)!==join(isolatedRoot,'server','data','audit.db')||JSON.stringify(runtime.ports)!=='[5510,5511]'){
  throw new Error('Admin audit requires the isolated audit runtime on 5510/5511.');
}
test.beforeEach(async({baseURL})=>{
  if(baseURL!=='http://127.0.0.1:5511')throw new Error('Admin audit must target the disposable browser server on 127.0.0.1:5511.');
});
const out='tests/denetim-kanitlari/yonetici/evidence/remaining-repairs';mkdirSync(out,{recursive:true});
let cookies:any[]=[];
async function login(page:Page,email='audit-admin@example.test') {
  if(email==='audit-admin@example.test'&&cookies.length) await page.context().addCookies(cookies);
  else {
    const token=(await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    expect((await page.request.post('/api/auth/login',{data:{email,password:'AuditOnly2026!'},headers:{'x-csrf-token':token}})).status()).toBe(200);
    if(email==='audit-admin@example.test') cookies=await page.context().cookies();
  }
}
async function api(page:Page,path:string,method='GET',data?:any) {
  const token=(await (await page.request.get('/api/csrf-token')).json()).csrfToken;
  const response=await page.request.fetch('/api'+path,{method,headers:{'Content-Type':'application/json','x-csrf-token':token},...(data===undefined?{}:{data})});
  return {status:response.status(),body:await response.json()};
}
const routes=['/','/admin-quizzes','/quizzes','/statistics','/results','/survey-results','/students','/teachers','/guardian-management','/classlist','/management','/archive','/server-setup','/announcements','/settings','/create-quiz','/quizzes/audit-exam','/teachers/audit-teacher','/classes/audit-class','/admin/classes/audit-class','/student/result/audit-result','/student/quiz/audit-teacher-exam','/student/results'];
for(const [i,route] of routes.entries())test('admin route '+route,async({page},info)=>{
const errors:string[]=[],network:any[]=[],views:any[]=[],pending=new Set<import("@playwright/test").Request>(); page.on('request',r=>{if(r.url().includes('/api/'))pending.add(r);});page.on('requestfinished',r=>pending.delete(r));page.on('requestfailed',r=>pending.delete(r));page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)network.push({url:r.url(),status:r.status()});});page.on('requestfailed',r=>network.push({url:r.url(),error:r.failure()?.errorText}));
await login(page);await page.goto(route,{waitUntil:'domcontentloaded'});await expect(page.locator('[data-dashboard-shell]')).toBeVisible();await page.waitForTimeout(600);await expect.poll(()=>pending.size,{timeout:30000}).toBe(0);await page.waitForTimeout(300);await expect(page.locator('main .animate-spin')).toHaveCount(0);
const labels=await page.getByRole('tab').allTextContents();for(const label of labels){const t=page.getByRole('tab',{name:label.trim(),exact:true}).first();if(await t.isVisible()){await t.click();await page.waitForTimeout(200);views.push(label.trim());const children=await page.getByRole('tabpanel').getByRole('tab').allTextContents();for(const child of children){await page.getByRole('tab',{name:child.trim(),exact:true}).last().click();views.push(label.trim()+'/'+child.trim());}}}
await page.screenshot({path:out+'/'+i+'-desktop.png',fullPage:true});pending.clear();await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('[data-dashboard-shell]')).toBeVisible();await expect.poll(()=>pending.size,{timeout:30000}).toBe(0);await page.waitForTimeout(500);await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:out+'/'+i+'-mobile.png',fullPage:true});
const ux=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,unnamedButtons:[...document.querySelectorAll('button')].filter(b=>!b.textContent?.trim()&&!b.getAttribute('aria-label')&&!b.getAttribute('aria-labelledby')&&!b.getAttribute('title')).length,unlabeledInputs:[...document.querySelectorAll('input:not([type=hidden]),textarea')].filter(e=>!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!(e.id&&document.querySelector('label[for="'+e.id+'"]'))&&!e.closest('label')).map(e=>({placeholder:e.getAttribute('placeholder'),type:e.getAttribute('type')}))}));
const evidence=JSON.stringify({route,labels,views,errors,network,ux},null,2);writeFileSync(out+'/'+i+'-audit.json',evidence);await info.attach('audit',{body:evidence,contentType:'application/json'});expect(errors).toEqual([]);
});
test('profile state after save and navigation',async({page},info)=>{
  await login(page);
  const before=await api(page,'/auth/me');expect(before.status).toBe(200);
  const originalName=before.body.user.name;
  const updatedName='Audit Admin '+Date.now();
  try{
    await page.goto('/settings');await page.getByPlaceholder('Ad Soyad',{exact:true}).fill(updatedName);
    await page.getByRole('button',{name:'Değişiklikleri Kaydet'}).click();
    await expect.poll(async()=>(await api(page,'/auth/me')).body.user?.name).toBe(updatedName);
    await page.getByRole('link',{name:'Dashboard',exact:true}).click();await page.getByRole('link',{name:'Ayarlar',exact:true}).click();
    const stale=await page.getByPlaceholder('Ad Soyad',{exact:true}).inputValue();
    await page.screenshot({path:out+'/profile-stale.png'});await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByPlaceholder('Ad Soyad',{exact:true})).toHaveValue(updatedName);
    await info.attach('profile',{body:JSON.stringify({afterNavigation:stale,afterReload:updatedName}),contentType:'application/json'});
    expect(stale).toBe(updatedName);
  }finally{
    const restored=await api(page,'/auth/me','PATCH',{name:originalName});expect(restored.status).toBe(200);
    await expect.poll(async()=>(await api(page,'/auth/me')).body.user?.name).toBe(originalName);
  }
});
test('unauthorized and expired sessions',async({page})=>{await page.goto('/management');await expect(page).toHaveURL(/auth/);await login(page,'audit-teacher@example.test');await page.goto('/management');await expect(page).toHaveURL(/5511\/$/);expect((await api(page,'/admin/logs')).status).toBe(403);expect((await api(page,'/admin/deployment/status')).status).toBe(403);await page.context().clearCookies();await page.goto('/management');await expect(page).toHaveURL(/auth/);expect((await api(page,'/admin/logs')).status).toBe(401);});
test('results selector includes teacher exams',async({page})=>{await login(page);await page.goto('/results');await page.getByRole('combobox').nth(2).click();await page.screenshot({path:out+'/results-exam-selector.png'});await expect(page.getByRole('option',{name:'audit-teacher-exam',exact:false})).toBeVisible();});

test('management category create edit delete persists',async({page})=>{
await login(page);await page.goto('/management');await page.getByRole('button',{name:'Yeni Ders Ekle'}).click();const dialog=page.getByRole('dialog');await dialog.getByPlaceholder('Örn: GÖRSEL PROGRAMLAMA').fill('audit temporary course');await dialog.locator('textarea').fill('Isolated test');await dialog.getByRole('button',{name:'Dersi Kaydet'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);let row=page.getByRole('row').filter({hasText:'AUDİT TEMPORARY COURSE'});await expect(row).toBeVisible();await page.reload({waitUntil:'domcontentloaded'});await expect(row).toBeVisible();await row.getByRole('button').nth(0).click();await dialog.getByPlaceholder('Örn: GÖRSEL PROGRAMLAMA').fill('audit edited course');await dialog.getByRole('button',{name:'Dersi Kaydet'}).click();row=page.getByRole('row').filter({hasText:'AUDİT EDİTED COURSE'});await expect(row).toBeVisible();await row.getByRole('button').nth(1).click();await page.getByRole('button',{name:'Vazgeç',exact:true}).click();await expect(row).toBeVisible();await row.getByRole('button').nth(1).click();await page.getByRole('button',{name:'Evet, Sil',exact:true}).click();await expect(row).toHaveCount(0);await page.reload({waitUntil:'domcontentloaded'});expect((await api(page,'/categories')).body.some((c:any)=>c.name==='AUDİT EDİTED COURSE')).toBe(false);
});
test('announcement create reload delete',async({page})=>{
await login(page);await page.goto('/announcements');await page.getByRole('button',{name:/Yeni Duyuru/}).click();await page.getByPlaceholder('ÖRN: SINAV TAKVİMİ GÜNCELLEMESİ').fill('audit e2e announcement');await page.getByPlaceholder('Duyuru detaylarını buraya yazın...').fill('Isolated browser test announcement');await page.getByRole('button',{name:'Duyuruyu Yayınla'}).click();await expect(page.getByText('AUDİT E2E ANNOUNCEMENT',{exact:true})).toBeVisible();await page.reload({waitUntil:'domcontentloaded'});const card=page.locator('[data-slot="card"]').filter({hasText:'AUDİT E2E ANNOUNCEMENT'});await expect(card).toBeVisible();await card.getByRole('button',{name:'Duyuruyu sil',exact:true}).click();const confirmation=page.getByRole('dialog',{name:'Duyuruyu sil',exact:true});await expect(confirmation).toBeVisible();await expect(card).toBeVisible();await confirmation.getByRole('button',{name:'Sil',exact:true}).click();await expect(confirmation).toHaveCount(0);await expect(page.getByText('AUDİT E2E ANNOUNCEMENT',{exact:true})).toHaveCount(0);await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByText('AUDİT E2E ANNOUNCEMENT',{exact:true})).toHaveCount(0);
});
test('announcement fetch error must differ from empty',async({page})=>{
await login(page);await page.route('**/api/announcements',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Injected audit failure'})}));await page.goto('/announcements');await page.waitForTimeout(8000);await page.screenshot({path:out+'/announcement-error-empty.png'});await expect(page.getByText(/Henüz bir duyuru/)).toHaveCount(0);
});
test('settings unsupported tab falls back to profile',async({page})=>{
await login(page);await page.goto('/settings?tab=unknown');await page.screenshot({path:out+'/settings-unknown-tab.png'});await expect(page.getByRole('tabpanel')).toBeVisible();
});
test('mobile menu keyboard dismissal and dialog focus',async({page})=>{
await login(page);await page.setViewportSize({width:390,height:844});await page.goto('/management');await page.getByRole('button',{name:'Menüyü aç',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Menüyü kapat',exact:true})).not.toBeVisible();
});
