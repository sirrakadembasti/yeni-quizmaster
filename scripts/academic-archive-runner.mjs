// Owns a disposable project root; never reads the deployment .env or database.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { waitForAuditServer } from './audit-server-readiness.mjs';
import { verifyFixturePortsReleased } from './linux-owned-process-cleanup.mjs';
import { launchOwned, cleanupOwned } from './academic-owned-process.mjs';
const repo = path.resolve(import.meta.dirname, '..');
const req = createRequire(path.join(repo, 'server/package.json'));
const clientReq = createRequire(path.join(repo, 'client/package.json'));
const rootReq = createRequire(path.join(repo, 'package.json'));
const protectedFiles = ['server/data/quiz.db', 'client/src/lib/api.ts', 'client/src/pages/server-setup.tsx'];
const hashes = () => protectedFiles.map(file => createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex'));
const before = hashes();
let root = fs.mkdtempSync(path.join(repo, 'server/data/quizmaster-test-academic-'));
const ownedRoots=[root];
const children = [];
let ports = [];
let cancelled = false;
const cancel = () => {
  cancelled = true;
  for (const state of children) void cleanupOwned(state).catch(error => { state.cleanupError = error; });
};
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
async function port() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
// Only operating-system runtime variables are inherited; credentials are absent.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|LOCALAPPDATA|APPDATA|USERPROFILE|HOME)$/i.test(key)));
async function launch(args, cwd = root) {
  if (cancelled) throw new Error('Fixture run cancelled');
  return launchOwned(args, { cwd, env, onState: state => children.push(state) });
}
try {
  for (const directory of ['server/data', 'server/uploads', 'client', 'artifacts']) fs.mkdirSync(path.join(root, directory), { recursive: true });
  for (const directory of ['server', 'client']) fs.writeFileSync(path.join(root, directory, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(root, '.env'), '# Disposable fixture: no credentials\n');
  fs.writeFileSync(path.join(root, 'server/.env'), '# Disposable fixture: no credentials\n');
  if (process.argv.includes('--startup-failure-smoke')) {
    const failed = await launch([path.join(root, 'absent-entry.mjs')]);
    let rejected = false;
    try { await waitForAuditServer('http://127.0.0.1:1', failed, { timeoutMs: 5000 }); }
    catch { rejected = true; }
    if (!rejected) throw new Error('Startup failure was not detected');
    console.log('Owned startup failure detected');
  } else {
  fs.mkdirSync(path.join(root, 'server/prisma'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'server/prisma/schema.prisma'), path.join(root, 'server/prisma/schema.prisma'));
  fs.cpSync(path.join(repo, 'server/prisma/migrations'), path.join(root, 'server/prisma/migrations'), { recursive: true });
  const apiPort = await port();
  let uiPort = await port();
  while (uiPort === apiPort) uiPort = await port();
  ports = [apiPort, uiPort];
  let database = path.join(root, 'server/data/academic.db');
  const runtime = { root, database, ports: [apiPort, uiPort], baseURL: `http://127.0.0.1:${uiPort}` };
  let runtimeFile = path.join(root, 'runtime.json');
  fs.writeFileSync(runtimeFile, JSON.stringify(runtime));
  Object.assign(env, { DATABASE_URL: 'file:' + database.replaceAll('\\', '/'), SESSION_SECRET: 'disposable-academic-fixture-secret', PORT: String(apiPort), HOST: '127.0.0.1', NODE_ENV: 'development', FRONTEND_URL: runtime.baseURL, ALLOWED_ORIGINS: runtime.baseURL, ARCHIVE_BACKUP_ROOT: path.join(root, 'artifacts'), CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1', RUST_LOG: 'info', ACADEMIC_ARCHIVE_RUNTIME: runtimeFile });
  const migrationStart = Date.now();
  // With 22 migrations, two serial Windows runs (one kept awake) reached
  // 19/22 at the old 180s bound. 180*22/19 + 30s startup rounds to 240s.
  // This bounds only disposable setup, not PDF/transaction/browser tests.
  // An explicit opt-in can reuse an independently verified empty test schema.
  // This is browser isolation, not evidence of a fresh installation.
  const template = process.env.ACADEMIC_MIGRATION_TEMPLATE;
  const migration = template
    ? spawnSync('python', [path.join(repo, 'scripts/academic-migration-template.py'), template, database], { cwd: repo, env, windowsHide: true, encoding: 'utf8', timeout: 30000 })
    : spawnSync(process.execPath, [req.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(root, 'server/prisma/schema.prisma')], { cwd: root, env, windowsHide: true, encoding: 'utf8', timeout: 240000 });
  if (migration.status !== 0) throw new Error(`Disposable migration failed: ${migration.error?.message ?? ''}\n${migration.stdout}\n${migration.stderr}`);
  console.log(`${template ? 'Verified empty migration template copied' : 'Disposable migrations completed'} in ${Date.now() - migrationStart}ms`);
  // Diagnostic opt-in: same current server sources, bundled inside the owned
  // fixture. Dependencies remain external and resolve to server/node_modules.
  // This distinguishes TypeScript loader cost from application initialization.
  const bundled = process.env.ACADEMIC_BUNDLE_SERVER === '1';
  let serverEntry = path.join(repo, 'server/index.ts');
  if (bundled) {
    serverEntry = path.join(root, 'server/index.cjs');
    const buildStart = Date.now();
    await req('esbuild').build({ entryPoints: [path.join(repo, 'server/index.ts')], outfile: serverEntry, bundle: true, packages: 'external', platform: 'node', target: 'node20', format: 'cjs', logLevel: 'warning' });
    console.log(`Owned server source bundle built in ${Date.now() - buildStart}ms`);
  }
  let entry = path.join(root, 'entry.mjs');
  const nodemailerEsm = path.resolve(path.dirname(req.resolve('nodemailer')), '../esm/nodemailer.js');
  fs.writeFileSync(entry, `import { createRequire } from 'node:module';
const trace = step => console.log('ACADEMIC_STARTUP ' + step);
trace('entry');
const { disableAcademicFixtureEmailDelivery, isolateAcademicFixture } = await import(${JSON.stringify(pathToFileURL(path.join(repo, 'scripts/academic-fixture-email.mjs')).href)});
isolateAcademicFixture(); trace('isolation');
const require = createRequire(${JSON.stringify(path.join(repo, 'server/package.json'))});
disableAcademicFixtureEmailDelivery(require('nodemailer'));
disableAcademicFixtureEmailDelivery((await import(${JSON.stringify(pathToFileURL(nodemailerEsm).href)})).default);
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = new PrismaClient(); trace('database-client');
try { await db.user.upsert({ where:{id:'academic-admin'}, update:{}, create: { id: 'academic-admin', name: 'Synthetic Academic Admin', email: 'academic-admin@example.test', role: 'admin', password: await bcrypt.hash('AcademicFixtureOnly2026!', 10) } }); trace('admin-seeded'); } finally { await db.$disconnect(); }
trace('server-import');
await import(${JSON.stringify(pathToFileURL(serverEntry).href)});
trace('server-imported');
`);
  if(process.argv.includes('--restore-smoke')){
    if(!bundled)throw new Error('Restoration smoke requires the owned source bundle');
    const seed=path.join(root,'seed.mjs');
    const entrySource=fs.readFileSync(entry,'utf8');fs.writeFileSync(seed,entrySource.split("trace('server-import');")[0]);
    const seedJob=await launch([seed]);if(await seedJob.finished!==0)throw new Error('Restoration source seeding failed');await cleanupOwned(seedJob);
    const sourceDb=new (req('@prisma/client').PrismaClient)({datasources:{db:{url:env.DATABASE_URL}}});
    let expectedAdmin;
    try{expectedAdmin=await sourceDb.user.findUniqueOrThrow({where:{id:'academic-admin'},select:{id:true,email:true,role:true,password:true,sessionVersion:true}});}finally{await sourceDb.$disconnect();}
    fs.copyFileSync(database,path.join(root,'server/data/quiz.db'));
    fs.writeFileSync(path.join(root,'server/.env'),`DATABASE_URL=file:../data/quiz.db\nHOST=127.0.0.1\nPORT=${apiPort}\nARCHIVE_BACKUP_ROOT=${path.join(root,'artifacts').replaceAll('\\','/')}\nSESSION_SECRET=disposable-academic-fixture-secret\n`);
    const {createApplicationBackup,restoreApplicationBackup}=await import('./maintenance-lib.mjs');
    const backup=await createApplicationBackup(root,{name:'browser-restoration'});
    const restoredRoot=fs.mkdtempSync(path.join(repo,'server/data/quizmaster-test-academic-'));ownedRoots.push(restoredRoot);
    await restoreApplicationBackup(backup.backupRoot,restoredRoot);
    // The existing outbound-isolation guard deliberately uses academic.db.
    // Only this owned test changes its filename after validating quiz.db restore.
    const restoredDatabase=path.join(restoredRoot,'server/data/academic.db');fs.renameSync(path.join(restoredRoot,'server/data/quiz.db'),restoredDatabase);
    fs.copyFileSync(serverEntry,path.join(restoredRoot,'server/index.cjs'));serverEntry=path.join(restoredRoot,'server/index.cjs');
    fs.writeFileSync(path.join(restoredRoot,'package.json'),'{"type":"module"}');fs.writeFileSync(path.join(restoredRoot,'server/package.json'),'{}');fs.mkdirSync(path.join(restoredRoot,'client'));fs.writeFileSync(path.join(restoredRoot,'.env'),'# Restored synthetic fixture only\n');
    root=restoredRoot;database=restoredDatabase;runtime.root=root;runtime.database=database;runtimeFile=path.join(root,'runtime.json');fs.writeFileSync(runtimeFile,JSON.stringify(runtime));
    Object.assign(env,{DATABASE_URL:'file:'+database.replaceAll('\\','/'),ARCHIVE_BACKUP_ROOT:path.join(root,'server/data/backups'),ACADEMIC_ARCHIVE_RUNTIME:runtimeFile});
    const seedStart=entrySource.indexOf('try { await db.user.upsert('),seedEnd=entrySource.indexOf("trace('server-import');");
    if(seedStart<0||seedEnd<=seedStart)throw new Error('Source seed section not found');
    const restoredEntry=entrySource.slice(0,seedStart)+`try { const expected=${JSON.stringify(expectedAdmin)}; const actual=await db.user.findUniqueOrThrow({where:{id:expected.id},select:{id:true,email:true,role:true,password:true,sessionVersion:true}}); if(Object.keys(expected).some(key=>actual[key]!==expected[key]))throw new Error('Restored admin identity/hash mismatch'); trace('restored-admin-verified'); } finally { await db.$disconnect(); }\n`+entrySource.slice(seedEnd);
    entry=path.join(root,'entry.mjs');fs.writeFileSync(entry,restoredEntry.replace(pathToFileURL(path.join(ownedRoots[0],'server/index.cjs')).href,pathToFileURL(serverEntry).href));
    console.log('Offline maintenance backup restored into an independent browser fixture');
  }
  const api = await launch(bundled ? [entry] : ['--import', pathToFileURL(req.resolve('tsx')).href, entry]);
  await waitForAuditServer(`http://127.0.0.1:${apiPort}/api/csrf-token`, api);
  const viteEntry = path.join(root, 'ui.mjs');
  fs.writeFileSync(viteEntry, `import { loadConfigFromFile, createServer } from ${JSON.stringify('file:///' + clientReq.resolve('vite').replaceAll('\\', '/'))};\nconst loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, ${JSON.stringify(path.join(repo, 'client/vite.config.ts'))});\nconst server = await createServer({ ...loaded.config, configFile: false, root: ${JSON.stringify(path.join(repo, 'client'))}, envDir: ${JSON.stringify(root)}, server: { ...loaded.config.server, host: '127.0.0.1', port: ${uiPort}, strictPort: true } });\nawait server.listen();\n`);
  const ui = await launch([viteEntry]);
  await waitForAuditServer(runtime.baseURL + '/auth', ui);
  if (!process.argv.includes('--smoke')&&!process.argv.includes('--restore-smoke')) {
    const tests = await launch([path.join(path.dirname(rootReq.resolve('playwright/package.json')), 'cli.js'), 'test', '-c', path.join(repo, 'tests/yapilandirma/playwright.academic-archive.config.ts'), ...process.argv.slice(2)], repo);
    process.exitCode = await tests.finished;
  } else {
    const { chromium } = rootReq('playwright');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      // The app injects Google Fonts while online. Acceptance is local and
      // must not wait on or send requests to third-party font/image services.
      await page.route('**/*', route => new URL(route.request().url()).origin === runtime.baseURL ? route.continue() : route.abort());
      await page.goto(runtime.baseURL + '/auth', { waitUntil: 'domcontentloaded' });
      const csrf = await (await page.request.get(runtime.baseURL + '/api/csrf-token')).json();
      const response = await page.request.post(runtime.baseURL + '/api/auth/login', { data: { email: 'academic-admin@example.test', password: 'AcademicFixtureOnly2026!' }, headers: { 'x-csrf-token': csrf.csrfToken } });
      if (response.status() !== 200) throw new Error('Synthetic browser login failed');
      const me = await (await page.request.get(runtime.baseURL + '/api/auth/me')).json();
      if (me.user.email !== 'academic-admin@example.test') throw new Error('Synthetic browser identity mismatch');
      await page.goto(runtime.baseURL + '/archive', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: /Arşiv/ }).first().waitFor({ state: 'visible', timeout: 30000 });
      await page.getByLabel('Eğitim yılı', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
      if(process.argv.includes('--restore-smoke')){
        const evidence=path.join(repo,'.superpowers/sdd/2026-10-05-academic-archive-review-plan');fs.mkdirSync(evidence,{recursive:true});
        await page.screenshot({path:path.join(evidence,'production-restored-admin-desktop.png'),fullPage:true});
        await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});
        await page.getByRole('heading',{name:/Arşiv/}).first().waitFor({state:'visible',timeout:30000});
        await page.screenshot({path:path.join(evidence,'production-restored-admin-mobile.png'),fullPage:true});
      }
      console.log('Isolated Chromium navigation and admin login passed');
    } finally { await browser.close(); }
  }
  }
} catch (error) {
  console.error('Fixture run failed:', error);
  throw error;
} finally {
  const cleanupErrors = [];
  for (const state of children.reverse()) {
    try {
      await cleanupOwned(state);
    } catch (error) { cleanupErrors.push(error); }
  }
  if (ports.length && !(await verifyFixturePortsReleased(ports)).every(result => result.stopped)) cleanupErrors.push(new Error('Owned fixture ports remain occupied'));
  if (JSON.stringify(before) !== JSON.stringify(hashes())) cleanupErrors.push(new Error('Protected database or user files changed'));
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Fixture cleanup failed; root preserved for diagnosis');
  for(const ownedRoot of ownedRoots){
    if (path.dirname(ownedRoot) !== path.join(repo, 'server/data') || !path.basename(ownedRoot).startsWith('quizmaster-test-academic-')) throw new Error('Unsafe fixture cleanup target');
    fs.rmSync(ownedRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
  console.log('Owned fixture removed; protected file hashes preserved');
  process.removeListener('SIGINT', cancel);
  process.removeListener('SIGTERM', cancel);
}
