// LEGACY (pnpm): bu kabul/prova betiği pnpm'e bağlıdır; pnpm kaldırıldı (docs/npm-gecis-tasarimi.md). CI'da koşmaz, npm'e uyarlanana kadar çalışması beklenmemelidir.
// Production API rehearsal. All SQL and processes are restricted to a fresh owned fixture.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { ownedFile, noLinks, exclusiveJson, readPerformanceRuntime } from './production-performance-guard.mjs';
import { launchOwned, cleanupOwned } from './academic-owned-process.mjs';
import { verifyFixturePortsReleased } from './linux-owned-process-cleanup.mjs';
import { waitForAuditServer } from './audit-server-readiness.mjs';
import { seedPerformance } from './production-performance-seed.mjs';
import { actorClient, summarize } from './production-performance-http.mjs';
import { schoolBrowserProof } from './school-exam-browser-proof.mjs';

if (process.argv.length !== 2) throw Error('This rehearsal accepts no database or path arguments');
const repo = noLinks(path.resolve(import.meta.dirname, '..'));
const req = createRequire(path.join(repo, 'server/package.json'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(ownedFile(repo, file, true))).digest('hex');
const protectedFiles = ['client/src/lib/api.ts', 'client/src/pages/server-setup.tsx', 'server/data/quiz.db'];
const before = protectedFiles.map(hash);
noLinks(path.join(repo, 'server/data'));
const root = fs.mkdtempSync(path.join(repo, 'server/data/quizmaster-test-academic-performance-'));
for (const dir of ['server/data', 'server/uploads', 'server/prisma', 'client/dist', 'dist', 'artifacts']) fs.mkdirSync(path.join(root, dir), { recursive: true });
for (const file of ['package.json', 'server/package.json', 'client/package.json']) fs.writeFileSync(ownedFile(root, file), '{}', { flag: 'wx' });
for (const file of ['.env', 'server/.env']) fs.writeFileSync(ownedFile(root, file), '# synthetic school exam only\n', { flag: 'wx' });
fs.cpSync(noLinks(path.join(repo, 'client/dist')), path.join(root, 'client/dist'), { recursive: true, force: false, filter: source => { noLinks(source); return true; } });
fs.copyFileSync(ownedFile(repo, 'server/prisma/schema.prisma', true), ownedFile(root, 'server/prisma/schema.prisma'));
fs.cpSync(noLinks(path.join(repo, 'server/prisma/migrations')), path.join(root, 'server/prisma/migrations'), { recursive: true, errorOnExist: true, force: false });
const runtime = { root, database: path.join(root, 'server/data/academic.db'), runId: crypto.randomUUID() };
exclusiveJson(root, 'runtime.json', runtime);
readPerformanceRuntime(repo, path.join(root, 'runtime.json'), { runId: runtime.runId, requireDatabase: false });
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TMP|TEMP|LOCALAPPDATA|USERPROFILE)$/i.test(key)));
Object.assign(env, { DATABASE_URL: 'file:' + runtime.database.replaceAll('\\', '/'), ACADEMIC_ARCHIVE_RUNTIME: path.join(root, 'runtime.json'), SESSION_SECRET: 'school-rehearsal-only-random-2026', HOST: '127.0.0.1', NODE_ENV: 'production', CI: 'true', CHECKPOINT_DISABLE: '1', ARCHIVE_BACKUP_ROOT: path.join(root, 'artifacts'), PRISMA_HIDE_UPDATE_MESSAGE: '1' });
// pnpm's cross-env launcher adds this virtual-store search path in the real start command.
env.NODE_PATH = path.join(repo, 'node_modules', '.pnpm', 'node_modules');
const jobs = [], proof = { runId: runtime.runId, workload: { students: 80, classes: 4, questions: 20, timeLimitMinutes: 30, mode: 'accelerated synchronized bursts, not a 30-minute soak', network: 'loopback; not school Wi-Fi' }, phases: [] };
let db, isolation, port;
const httpActors = [];
async function schoolActor(actor) {
  const client = await actorClient(runtime.origin, actor, runtime.fixture.password);
  httpActors.push(client);
  return client;
}
const print = value => console.log('SCHOOL ' + JSON.stringify(value));
async function launch(args, label, cwd = root) {
  const log = fs.createWriteStream(ownedFile(root, label + '.log'), { flags: 'wx' });
  return launchOwned(args, { cwd, env, onState: state => jobs.push({ state, label, log }), onOutput: text => log.write(text) });
}
async function freePort() { const socket = net.createServer(); await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); }); const value = socket.address().port; await new Promise(resolve => socket.close(resolve)); return value; }
async function phase(name, tasks, afterResponse) {
  const start = performance.now(), samples = [];
  const values = await Promise.all(tasks.map(async (task, actor) => {
    const at = performance.now(); let result, error;
    try { result = await task(); } catch (e) { error = e.name + ': ' + e.message + (e.cause?.code ? ' [' + e.cause.code + ': ' + e.cause.message + ']' : ''); }
    samples.push({ actor, ms: performance.now() - at, status: result?.status ?? 0, ok: result?.status === 200, error });
    if (afterResponse && result?.status === 200) await afterResponse(result, actor);
    return result;
  }));
  const row = { name, ...summarize(samples), elapsedMs: performance.now() - start, samples };
  proof.phases.push(row); print({ ...row, samples: undefined });
  exclusiveJson(root, 'phase-' + name + '.json', row);
  assert.equal(row.errors, 0, name + ' requests must all be acknowledged');
  return values;
}
try {
  const guardFile = ownedFile(root, 'migration-guard.mjs');
  fs.writeFileSync(guardFile, `const g=await import(${JSON.stringify(pathToFileURL(path.join(repo, 'scripts/academic-fixture-email.mjs')).href)});g.isolateAcademicFixture();`, { flag: 'wx' });
  const migration = await launch(['--import', pathToFileURL(guardFile).href, req.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(root, 'server/prisma/schema.prisma')], 'migration');
  assert.equal(await migration.finished, 0); await cleanupOwned(migration);
  Object.assign(process.env, { DATABASE_URL: env.DATABASE_URL, ACADEMIC_ARCHIVE_RUNTIME: env.ACADEMIC_ARCHIVE_RUNTIME });
  const guard = await import('./academic-fixture-email.mjs'); isolation = guard.isolateAcademicFixture();
  const nativeEntry = ownedFile(root, 'runtime.cjs');
  await req('esbuild').build({ entryPoints: [path.join(repo, 'server/utils/sqlite-runtime.ts')], outfile: nativeEntry, bundle: true, packages: 'external', platform: 'node', format: 'cjs', logLevel: 'silent' });
  db = req(nativeEntry).createRuntimePrismaClient({ databaseUrl: env.DATABASE_URL, projectRoot: root });
  runtime.fixture = await seedPerformance(db, repo);
  const students = await db.user.findMany({ where: { role: 'student' }, orderBy: { email: 'asc' }, select: { id: true, email: true, classId: true } });
  const classIds = (await db.class.findMany({ orderBy: { name: 'asc' }, take: 4, select: { id: true } })).map(c => c.id);
  await db.class.updateMany({ where: { id: { in: classIds } }, data: { classTeacherId: runtime.fixture.actors[1].id } });
  const actors = classIds.flatMap(classId => students.filter(s => s.classId === classId).slice(0, 20)); assert.equal(actors.length, 80);
  const quizId = crypto.randomUUID(), questions = Array.from({ length: 20 }, (_, n) => ({ id: crypto.randomUUID(), text: 'Tarih görseli ' + (n + 1), type: 'multiple-choice', options: '["A","B","C","D"]', correctAnswer: 'A', order: n, imageUrl: '/uploads/school-' + n + '.jpg' }));
  const raw = Buffer.alloc(640 * 480 * 3); let state = 123456789;
  for (let i = 0; i < raw.length; i++) { state = (Math.imul(state, 1664525) + 1013904223) | 0; raw[i] = state >>> 24; }
  const image = await req('sharp')(raw, { raw: { width: 640, height: 480, channels: 3 } }).jpeg({ quality: 70 }).toBuffer();
  for (let n = 0; n < 20; n++) fs.writeFileSync(ownedFile(root, 'server/uploads/school-' + n + '.jpg'), image, { flag: 'wx' });
  await db.quiz.create({ data: { id: quizId, title: '80 öğrenci tarih sınavı', contentType: 'exam', status: 'published', timeLimit: 30, createdBy: runtime.fixture.actors[1].id, assignedClasses: { connect: classIds.map(id => ({ id })) }, questions: { create: questions } } });
  proof.workload.imageBytes = image.length; proof.workload.imagesPerStudentBytes = image.length * 20; proof.workload.allStudentsImageBytes = image.length * 20 * 80;
  proof.fixture = runtime.fixture.counts;
  proof.sqlite = await db.$queryRawUnsafe('SELECT sqlite_version() AS version');
  proof.pragmas = {}; for (const setting of ['journal_mode', 'synchronous', 'busy_timeout', 'foreign_keys']) proof.pragmas[setting] = await db.$queryRawUnsafe('PRAGMA ' + setting);
  port = await freePort(); runtime.origin = 'http://127.0.0.1:' + port;
  Object.assign(env, { PORT: String(port), FRONTEND_URL: runtime.origin, ALLOWED_ORIGINS: runtime.origin });
  fs.writeFileSync(ownedFile(root, 'runtime.json', true), JSON.stringify(runtime));
  readPerformanceRuntime(repo, path.join(root, 'runtime.json'), { runId: runtime.runId });
  const entry = ownedFile(root, 'dist/index.cjs');
  // Match server/package.json build: native modules stay external, all other dependencies bundle.
  await req('esbuild').build({ entryPoints: [path.join(repo, 'server/index.ts')], outfile: entry, bundle: true, external: ['@prisma/client', 'sqlite3', 'better-sqlite3', 'sharp', 'playwright'], platform: 'node', target: 'node20', format: 'cjs', logLevel: 'silent' });
  const preload = ownedFile(root, 'preload.mjs');
  fs.writeFileSync(preload, `import {createRequire} from 'node:module';const g=await import(${JSON.stringify(pathToFileURL(path.join(repo, 'scripts/academic-fixture-email.mjs')).href)});g.isolateAcademicFixture();const r=createRequire(${JSON.stringify(path.join(repo, 'server/package.json'))});g.disableAcademicFixtureEmailDelivery(r('nodemailer'));await import(${JSON.stringify(pathToFileURL(entry).href)});`, { flag: 'wx' });
  const backend = await launch([preload], 'backend', path.join(root, 'server')); await waitForAuditServer(runtime.origin + '/api/csrf-token', backend);
  const headers = await fetch(runtime.origin + '/api/csrf-token');
  assert.equal(headers.status, 200);
  assert.ok(!headers.headers.get('content-security-policy').includes('upgrade-insecure-requests'), 'HTTP LAN must not require unavailable HTTPS');
  assert.match(headers.headers.get('keep-alive') ?? '', /timeout=65(?:,|$)/);
  proof.httpTransport = { keepAliveHeader: headers.headers.get('keep-alive'), actorPools: 'independent HTTP/1 agent per actor, at most six sockets', retries: 0, ownResultDelayMs: 2000, requestBoundSeconds: 30 };
  await headers.arrayBuffer();
  const clients = [];
  // Login is separate from exam bursts; no artificial removal of production limiters.
  for (const actor of actors) clients.push(await schoolActor(actor));
  const observers = [];
  for (let n = 0; n < 4; n++) observers.push(await schoolActor(runtime.fixture.actors[1]));
  const teacher = observers[0];
  const starts = await phase('start80', clients.map(client => () => client('/api/student/quiz/' + quizId + '/start', 'POST')));
  assert.ok(starts.every(r => r.body.questions.length === 20 && r.body.remainingSeconds > 1700 && r.body.remainingSeconds <= 1800));
  assert.ok(starts.every(r => !JSON.stringify(r.body).includes('"correctAnswer"')), 'Start payload must not disclose the answer key');
  const outsider = students.find(s => !classIds.includes(s.classId)); assert.ok(outsider);
  const outsiderClient = await schoolActor(outsider);
  assert.equal((await outsiderClient('/api/student/quiz/' + quizId + '/start', 'POST')).status, 403);
  const resultIds = starts.map(r => r.body.resultId);
  assert.equal((await clients[0]('/api/student/results/' + resultIds[0])).status, 409);
  assert.equal((await clients[0]('/api/student/quiz/' + quizId + '/start', 'POST')).body.resultId, resultIds[0]);
  assert.equal(await db.studentResult.count({ where: { quizId, studentId: { in: actors.map(a => a.id) } } }), 80);
  // Rapid changes from one actor are acknowledged in sequence, as in the UI queue.
  for (const selectedOption of ['B', 'C', 'A']) assert.equal((await clients[0]('/api/student/quiz/' + resultIds[0] + '/answer', 'POST', { questionId: questions[0].id, selectedOption })).status, 200);
  assert.equal((await outsiderClient('/api/student/quiz/' + resultIds[0] + '/answer', 'POST', { questionId: questions[0].id, selectedOption: 'B' })).status, 403);
  assert.equal((await clients[0]('/api/student/quiz/' + crypto.randomUUID() + '/answer', 'POST', { questionId: questions[0].id, selectedOption: 'A' })).status, 404);
  assert.equal((await clients[0]('/api/student/quiz/' + resultIds[0] + '/answer', 'POST', { questionId: runtime.fixture.questionIds[0], selectedOption: 'A' })).status, 404);
  for (let n = 0; n < 20; n++) {
    // The UI renders only the current question's image, not all twenty at start.
    await phase('image' + (n + 1), clients.map(client => async () => {
      const response = await client.image('/uploads/school-' + n + '.jpg');
      assert.equal(response.status, 200);
      assert.equal(response.bytes, image.length);
      return { status: 200 };
    }));
    const tasks = clients.map((client, actor) => () => client('/api/student/quiz/' + resultIds[actor] + '/answer', 'POST', { questionId: questions[n].id, selectedOption: 'A' }));
    // Four concurrent classroom observers while all students save this answer.
    const observerPaths = ['/api/results/quiz/' + quizId + '/live', '/api/dashboard/stats', '/api/results?projection=summary&quizId=' + quizId, '/api/results/quiz/' + quizId];
    for (let observer = 0; observer < 4; observer++) tasks.push(() => observers[observer](observerPaths[observer]));
    // The corrected exam layout has no invisible-menu polling. Classroom
    // observers still read notifications while observing the answering burst.
    if (n % 3 === 0) for (let observer = 0; observer < 4; observer++) tasks.push(() => observers[observer]('/api/notifications?page=1&limit=5'));
    await phase('answer' + (n + 1), tasks);
  }
  const saved = await db.studentResult.findMany({ where: { id: { in: resultIds } } });
  assert.equal(saved.length, 80); assert.ok(saved.every(row => Object.keys(JSON.parse(row.answers)).length === 20 && row.correctAnswersCount === 20 && row.status === 'in_progress'));
  const answers = Object.fromEntries(questions.map(q => [q.id, 'A']));
  const immediateSamples = [], immediateDetails = [];
  const submissionFlowStarted = performance.now();
  const submissions = await phase('submit80', clients.map((client, actor) => () => client('/api/student/quiz/' + resultIds[actor] + '/submit', 'POST', { answers })), async (_submitted, actor) => {
    // The real UI navigates to its own result two seconds after its own response.
    // Each actor proceeds independently, without waiting for the other 79 submits.
    await new Promise(resolve => setTimeout(resolve, 2000));
    const at = performance.now(); let response, error;
    try { response = await clients[actor]('/api/student/results/' + resultIds[actor]); }
    catch (e) { error = e.name + ': ' + e.message + (e.cause?.code ? ' [' + e.cause.code + ': ' + e.cause.message + ']' : ''); }
    immediateSamples.push({ actor, ms: performance.now() - at, status: response?.status ?? 0, ok: response?.status === 200, error });
    immediateDetails[actor] = response;
  });
  assert.ok(submissions.every(r => r.body.score === 100 && r.body.correctAnswers === 20 && r.body.acceptedQueuedAnswers === true));
  const immediatePhase = { name: 'student-result-after-own-submit80', ...summarize(immediateSamples), elapsedMs: performance.now() - submissionFlowStarted, samples: immediateSamples };
  proof.phases.push(immediatePhase); print({ ...immediatePhase, samples: undefined });
  exclusiveJson(root, 'phase-' + immediatePhase.name + '.json', immediatePhase);
  assert.equal(immediateSamples.length, 80); assert.equal(immediatePhase.errors, 0);
  assert.ok(immediateDetails.every(r => r.body.result.score === 100 && r.body.questions.length === 20 && r.body.questions.every(q => q.isCorrect === true)));
  // This extra simultaneous list-read is a synthetic stress phase, separate from the real navigation above.
  await phase('student-results80', clients.map(client => () => client('/api/student/results')));
  const details = await phase('student-result-details80', clients.map((client, actor) => () => client('/api/student/results/' + resultIds[actor])));
  assert.ok(details.every(r => r.body.result.score === 100 && r.body.questions.length === 20 && r.body.questions.every(q => q.isCorrect === true)));
  const teacherPaths = ['/api/results/quiz/' + quizId + '/live', '/api/dashboard/stats', '/api/results?projection=summary&quizId=' + quizId, '/api/results/quiz/' + quizId];
  await phase('teacher-results-and-dashboard', Array.from({ length: 8 }, (_, n) => () => observers[n % 4](teacherPaths[n % 4])));
  const repeat = await clients[0]('/api/student/quiz/' + resultIds[0] + '/submit', 'POST', { answers }); assert.equal(repeat.status, 200); assert.equal(repeat.body.score, 100);
  const nearId = crypto.randomUUID();
  await db.studentResult.create({ data: { id: nearId, quizId, studentId: actors[0].id, status: 'in_progress', startedAt: new Date(Date.now() - 1795000), totalQuestions: 20, answers: '{}' } });
  const nearSubmit = await clients[0]('/api/student/quiz/' + nearId + '/submit', 'POST', { answers }); assert.equal(nearSubmit.status, 200); assert.equal(nearSubmit.body.acceptedQueuedAnswers, true); assert.equal(nearSubmit.body.score, 100);
  // Fixture setup uses a second writer, unlike the production request path.
  // Finish this control's post-response notification before inserting the next
  // fixture row; independent writer contention is covered by native regressions.
  const notificationDeadline = Date.now() + 30000;
  let beforeExpiredNotifications = 0;
  while (Date.now() < notificationDeadline) {
    beforeExpiredNotifications = await db.notification.count({ where: { userId: runtime.fixture.actors[1].id, title: 'Sınav Teslim Edildi', message: { contains: '"80 öğrenci tarih sınavı"' } } });
    if (beforeExpiredNotifications === 81) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(beforeExpiredNotifications, 81, 'All exam and near-deadline notifications must be durable before the next fixture write');
  // Real 30-minute server cutoff, with an expired fixture attempt (no fake clock/client grace).
  const expiredId = crypto.randomUUID();
  await db.studentResult.create({ data: { id: expiredId, quizId, studentId: actors[0].id, status: 'in_progress', startedAt: new Date(Date.now() - 1801000), totalQuestions: 20, answers: JSON.stringify({ [questions[0].id]: 'A' }) } });
  const lateAnswer = await clients[0]('/api/student/quiz/' + expiredId + '/answer', 'POST', { questionId: questions[1].id, selectedOption: 'A' }); assert.equal(lateAnswer.status, 409);
  const lateSubmit = await clients[0]('/api/student/quiz/' + expiredId + '/submit', 'POST', { answers }); assert.equal(lateSubmit.status, 200); assert.equal(lateSubmit.body.acceptedQueuedAnswers, false); assert.equal(lateSubmit.body.score, 5);
  const completed = await db.studentResult.findMany({ where: { id: { in: resultIds } } });
  assert.ok(completed.every(r => r.status === 'completed' && r.score === 100 && Object.keys(JSON.parse(r.answers)).length === 20));
  assert.equal((await db.$queryRawUnsafe('PRAGMA integrity_check'))[0].integrity_check, 'ok'); assert.equal((await db.$queryRawUnsafe('PRAGMA foreign_key_check')).length, 0);
  const stats = await teacher('/api/dashboard/stats'); assert.equal(stats.status, 200);
  assert.deepEqual(stats.body.stats, { totalQuizzes: 5, totalStudents: 100, totalResults: 282, averageStudentScore: 82 });
  const admin = await schoolActor(runtime.fixture.actors[0]);
  const [legacy] = await phase('legacy-all-results', [() => admin('/api/results')]);
  const allRows = [], pageBytes = []; let cursor;
  do {
    const [page] = await phase('summary-page' + (pageBytes.length + 1), [() => admin('/api/results?projection=summary&limit=500' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''))]);
    assert.ok(page.body.results.length <= 500);
    assert.ok(page.body.results.every(row => !Object.hasOwn(row, 'answers') && !Object.hasOwn(row.quiz, 'questions')));
    allRows.push(...page.body.results); pageBytes.push(Buffer.byteLength(JSON.stringify(page.body))); cursor = page.body.nextCursor;
    assert.ok(pageBytes.length <= 20);
  } while (cursor);
  assert.equal(allRows.length, 8082);
  assert.deepEqual(allRows.map(r => r.id).sort(), legacy.body.results.map(r => r.id).sort());
  assert.equal(allRows.reduce((sum, row) => sum + (row.score ?? 0), 0), legacy.body.results.reduce((sum, row) => sum + (row.score ?? 0), 0));
  proof.reporting = { legacyBytes: Buffer.byteLength(JSON.stringify(legacy.body)), summaryLargestPageBytes: Math.max(...pageBytes), summaryTotalBytes: pageBytes.reduce((a, b) => a + b, 0), pages: pageBytes.length, rows: allRows.length, fullPopulationAndScoresPreserved: true, exactTeacherStatsPreserved: true };
  print({ reporting: proof.reporting });
  const writers = [];
  for (const actor of runtime.fixture.writerActors) writers.push(await schoolActor(actor));
  for (let round = 0; round < 30; round++) await phase('preferences' + (round + 1), writers.map(client => () => client('/api/notifications/preferences', 'PATCH', { muted: round % 2 === 0 })));
  const preferences = await db.user.findMany({ where: { id: { in: runtime.fixture.writerActors.map(a => a.id) } }, select: { notificationMuted: true, notificationRevision: true } });
  assert.ok(preferences.every(p => !p.notificationMuted && p.notificationRevision === 30));
  proof.correctness = { storedAnswers: 1600, completedStudents: 80, scores100: 80, repeatedSubmissionIdempotent: true, noAnswerKey: true, outsiderDenied: true, rapidSequentialChangesPreserved: true, beforeDeadlineAccepted: true, expiredAnswerRejected409: true, expiredSubmitIgnoresQueuedAnswers: true, preferenceWrites600AcknowledgedAndStored: true, integrity: 'ok', foreignKeyViolations: 0 };
  proof.browser = await schoolBrowserProof(repo, root, runtime.runId, runtime.fixture.actors[1], runtime.fixture.password);
  print({ browser: proof.browser });
  // Notifications remain durable even when the student response no longer waits for them.
  assert.equal(await db.notification.count({ where: {
    userId: runtime.fixture.actors[1].id,
    title: 'Sınav Teslim Edildi',
    message: { contains: '"80 öğrenci tarih sınavı"' },
  } }), 82);
  proof.correctness.teacherSubmissionNotifications82Persisted = true;
  assert.equal((await db.$queryRawUnsafe('PRAGMA integrity_check'))[0].integrity_check, 'ok');
  assert.equal((await db.$queryRawUnsafe('PRAGMA foreign_key_check')).length, 0);
  proof.completed = true;
} catch (error) { proof.failure = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1; print({ failure: proof.failure }); }
finally {
  for (const client of httpActors) client.close();
  const cleanup = [];
  for (const { state, label, log } of [...jobs].reverse()) { try { cleanup.push({ label, ...await cleanupOwned(state) }); } catch (e) { cleanup.push({ label, error: e.message }); process.exitCode = 1; } log.end(); }
  await db?.$disconnect(); isolation?.restore();
  proof.cleanup = cleanup;
  if (port) { try { proof.portReleased = await verifyFixturePortsReleased([port]); } catch (e) { proof.portError = e.message; process.exitCode = 1; } }
  proof.protectedHashesUnchanged = protectedFiles.every((file, n) => hash(file) === before[n]); assert.equal(proof.protectedHashesUnchanged, true);
  fs.writeFileSync(ownedFile(root, 'proof.json'), JSON.stringify(proof, (_, value) => typeof value === 'bigint' ? Number(value) : value, 2), { flag: 'wx' });
  print({ root, completed: proof.completed === true, protectedHashesUnchanged: proof.protectedHashesUnchanged, portReleased: proof.portReleased });
}
