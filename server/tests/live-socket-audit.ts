/** Real loopback Socket.IO audit: disposable Prisma + SQLite sessions, production routes/socket. */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import express from 'express';
import session from 'express-session';
import { createSessionStore } from '../utils/session-store';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const repo = resolve(import.meta.dirname, '../..');
const req = createRequire(import.meta.url);
const clientRequire = createRequire(join(repo, 'client/package.json'));
const { io: connect } = clientRequire('socket.io-client');
const fixture = mkdtempSync(join(repo, 'server/data/quizmaster-test-live-socket-'));
for (const part of ['server/data', 'client']) mkdirSync(join(fixture, part), { recursive: true });
for (const part of ['server', 'client']) writeFileSync(join(fixture, part, 'package.json'), '{}');
const database = join(fixture, 'server/data/audit.db');
writeFileSync(database, '');
Object.assign(process.env, { DATABASE_URL: `file:${database.replaceAll('\\', '/')}`, NODE_ENV: 'test', ALLOWED_ORIGINS: 'http://127.0.0.1:5999', FRONTEND_URL: 'http://127.0.0.1:5999' });
for (const key of ['EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'APP_BASE_PATH']) delete process.env[key];
process.chdir(fixture);
execFileSync(process.execPath, [req.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', join(repo, 'server/prisma/schema.prisma')], { env: process.env, stdio: 'pipe' });
const db = new PrismaClient();
const password = 'SocketAudit2026!';
const hash = await bcrypt.hash(password, 10);
const classId = '11111111-2222-4333-8444-555555555555';
await db.user.createMany({ data: ['admin', 'teacher', 'student', 'other'].map(id => ({ id, name: `Socket ${id}`, email: `${id}@example.test`, password: hash, role: id === 'other' ? 'student' : id })) });
await db.class.create({ data: { id: classId, name: 'Socket Audit', teachers: { connect: { id: 'teacher' } } } });
await db.user.update({ where: { id: 'student' }, data: { classId } });
await db.quiz.create({ data: { id: 'socket-quiz', title: 'Socket live exam', createdBy: 'teacher', status: 'draft', assignedClasses: { connect: { id: classId } }, questions: { create: { text: 'Choose A', options: JSON.stringify(['A', 'B']), correctAnswer: 'A', type: 'multiple-choice', order: 0 } } } });

const { setupSocket } = await import('../socket');
const { closeStorage } = await import('../storage');
const auth = (await import('../api-routes/auth')).default;
const quiz = (await import('../api-routes/quiz')).default;
const announcements = (await import('../api-routes/announcement')).default;
const notifications = (await import('../api-routes/notification')).default;
const store: any = createSessionStore(join(fixture, 'server/data'));
const middleware = session({ store, secret: 'disposable-socket-audit-secret', name: 'quizmaster.sid', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', maxAge: 3600000 } });
const app = express(); app.use(express.json(), middleware);
app.use('/api/auth', auth); app.use('/api/quizzes', quiz); app.use('/api/announcements', announcements); app.use('/api/notifications', notifications);
const server = createServer(app), io = setupSocket(server, middleware);
await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
const port = (server.address() as any).port, base = `http://127.0.0.1:${port}`;
const clients: any[] = [], results: any[] = [];
const delay = (ms: number) => new Promise(done => setTimeout(done, ms));
function event(socket: any, name: string, timeout = 60000): Promise<any> {
  const pending = new Promise((done, reject) => { const timer = setTimeout(() => { socket.off(name, on); reject(new Error(`Timeout: ${name}`)); }, timeout); const on = (...args: any[]) => { clearTimeout(timer); done(args[0]); }; socket.once(name, on); });
  // HTTP writes may outlast the event timeout; keep rejection handled until the test awaits it.
  pending.catch(() => {});
  return pending;
}
function socket(cookie = '', transport = 'websocket', origin = 'http://127.0.0.1:5999') {
  const value = connect(base, { autoConnect: false, reconnection: false, timeout: 3000, transports: [transport], extraHeaders: { Cookie: cookie, Origin: origin } }); clients.push(value); return value;
}
async function open(cookie: string, transport = 'websocket') { const value = socket(cookie, transport); const ready = event(value, 'connect'); value.connect(); await ready; return value; }
async function rejected(value: any) { const failure = event(value, 'connect_error'); value.connect(); const error = await failure; assert.ok(error); assert.equal(value.connected, false); value.disconnect(); return error.message; }
async function request(path: string, cookie = '', body?: any, method = 'POST') {
  const response = await fetch(base + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await response.json(); return { status: response.status, json, cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie };
}
async function login(id: string, pass = password) { const result = await request('/api/auth/login', '', { email: `${id}@example.test`, password: pass }); assert.equal(result.status, 200); assert.match(result.cookie, /^quizmaster.sid=/); return result.cookie; }
async function check(name: string, action: () => Promise<any>) { const started = performance.now(); try { const evidence = await action(); results.push({ name, status: 'passed', durationMs: Math.round(performance.now() - started), evidence }); console.log(`PASS ${name}`); } catch (error: any) { results.push({ name, status: 'failed', durationMs: Math.round(performance.now() - started), error: error.message }); console.error(`FAIL ${name}: ${error.message}`); } }
let cleanupSucceeded = false;
try {
  await check('anonymous handshake rejected', () => rejected(socket()));
  await check('forged cookie rejected', () => rejected(socket('quizmaster.sid=s%3Aforged.signature')));
  const adminCookie = await login('admin'), teacherCookie = await login('teacher'), studentCookie = await login('student'), otherCookie = await login('other');
  await check('foreign Origin rejected for websocket', () => rejected(socket(adminCookie, 'websocket', 'https://foreign.example.test')));
  await check('foreign Origin rejected for polling', () => rejected(socket(adminCookie, 'polling', 'https://foreign.example.test')));
  const admin = await open(adminCookie), student = await open(studentCookie), other = await open(otherCookie);
  await check('real websocket authenticated and automatic user room', async () => { assert.equal(admin.io.engine.transport.name, 'websocket'); assert.ok(io.sockets.sockets.get(admin.id)?.rooms.has('user_admin')); });
  await check('real polling authenticated', async () => { const value = await open(studentCookie, 'polling'); assert.equal(value.io.engine.transport.name, 'polling'); value.disconnect(); });
  await check('joining another user room disconnects client', async () => { const value = await open(otherCookie); const gone = event(value, 'disconnect'); value.emit('joinUserRoom', 'admin'); assert.equal(await gone, 'io server disconnect'); });
  const studentEvents: any[] = [], otherEvents: any[] = [], adminEvents: any[] = [];
  student.on('notification', (n: any) => studentEvents.push(n)); other.on('notification', (n: any) => otherEvents.push(n)); admin.on('notification', (n: any) => adminEvents.push(n));
  await check('quiz publish sends one live notification only to assigned student and admin', async () => {
    const live = event(student, 'notification'), adminLive = event(admin, 'notification');
    const response = await request('/api/quizzes/socket-quiz', teacherCookie, { status: 'published' }, 'PATCH'); assert.equal(response.status, 200);
    const notification = await live; assert.equal(notification.userId, 'student'); assert.equal((await adminLive).userId, 'admin');
    await delay(200); assert.equal(studentEvents.length, 1); assert.equal(otherEvents.length, 0);
    const persisted = await request('/api/notifications', studentCookie, undefined, 'GET'); assert.ok(persisted.json.notifications.some((n: any) => n.id === notification.id));
    return { liveNotificationIdPersisted: true, studentEvents: studentEvents.length, unrelatedStudentEvents: otherEvents.length };
  });
  await check('repeated publish does not duplicate notifications', async () => { assert.equal((await request('/api/quizzes/socket-quiz', teacherCookie, { status: 'published' }, 'PATCH')).status, 200); await delay(200); assert.equal(studentEvents.length, 1); assert.equal(adminEvents.length, 1); });
  await check('class announcement delivered live with recipient isolation', async () => { const live = event(student, 'notification'); assert.equal((await request('/api/announcements', teacherCookie, { title: 'Socket class announcement', content: 'Isolated fixture', targetRole: 'student', targetClassId: classId })).status, 201); assert.equal((await live).title, 'Socket class announcement'); await delay(200); assert.equal(otherEvents.length, 0); });
  await check('registration emits persistent admin-only notification', async () => { const live = event(admin, 'notification'); assert.equal((await request('/api/auth/register', '', { name: 'Socket New Learner', email: 'new@example.test', password })).status, 200); const n = await live; assert.equal(n.type, 'registration'); assert.equal(n.userId, 'admin'); assert.ok(await db.notification.findUnique({ where: { id: n.id } })); });
  await check('logout disconnects same session but preserves second login', async () => { const secondCookie = await login('student'), second = await open(secondCookie); const gone = event(student, 'disconnect'); assert.equal((await request('/api/auth/logout', studentCookie, {})).status, 200); assert.equal(await gone, 'io server disconnect'); await delay(100); assert.equal(second.connected, true); await rejected(socket(studentCookie)); second.disconnect(); });
  await check('password change disconnects all sessions and accepts only refreshed cookie', async () => { const oldOne = await login('other'), oldTwo = await login('other'); const first = await open(oldOne), second = await open(oldTwo); const goneOne = event(first, 'disconnect'), goneTwo = event(second, 'disconnect'), goneExisting = event(other, 'disconnect'); const changed = await request('/api/auth/change-password', oldOne, { currentPassword: password, newPassword: 'NewSocketAudit2026!' }); assert.equal(changed.status, 200); await Promise.all([goneOne, goneTwo, goneExisting]); await rejected(socket(oldOne)); await rejected(socket(oldTwo)); const refreshed = await open(changed.cookie); assert.equal(refreshed.connected, true); refreshed.disconnect(); });
  await check('packet middleware rejects DB-revoked session version', async () => { const value = await open(await login('teacher')); await db.user.update({ where: { id: 'teacher' }, data: { sessionVersion: { increment: 1 } } }); const gone = event(value, 'disconnect'); value.emit('joinUserRoom', 'teacher'); assert.equal(await gone, 'io server disconnect'); });
  await check('removed SQLite session rejected during packet revalidation', async () => { const cookie = await login('teacher'), value = await open(cookie); const sessionId = (io.sockets.sockets.get(value.id)!.request as any).sessionID; await new Promise<void>((done, reject) => store.destroy(sessionId, (error: any) => error ? reject(error) : done())); const gone = event(value, 'disconnect'); value.emit('joinUserRoom', 'teacher'); assert.equal(await gone, 'io server disconnect'); await rejected(socket(cookie)); });
  await check('expired SQLite session rejected during packet revalidation', async () => { const value = await open(await login('teacher')); const sessionId = (io.sockets.sockets.get(value.id)!.request as any).sessionID; const saved: any = await new Promise((done, reject) => store.get(sessionId, (error: any, data: any) => error ? reject(error) : done(data))); saved.cookie.expires = new Date(Date.now() - 1000).toISOString(); await new Promise<void>((done, reject) => store.set(sessionId, saved, (error: any) => error ? reject(error) : done())); const gone = event(value, 'disconnect'); value.emit('joinUserRoom', 'teacher'); assert.equal(await gone, 'io server disconnect'); });
  await check('inactive account handshake rejected', async () => { await db.user.update({ where: { id: 'admin' }, data: { isActive: false } }); await rejected(socket(adminCookie)); await db.user.update({ where: { id: 'admin' }, data: { isActive: true } }); });
  await check('idle inactive client disconnected by real 30-second session timer', async () => { const value = await open(await login('teacher')); const began = performance.now(), gone = event(value, 'disconnect', 35000); await db.user.update({ where: { id: 'teacher' }, data: { isActive: false } }); assert.equal(await gone, 'io server disconnect'); const elapsedMs = Math.round(performance.now() - began); assert.ok(elapsedMs >= 29000 && elapsedMs < 35000); return { elapsedMs }; });
} finally {
  clients.forEach(value => value.disconnect());
  await new Promise<void>(done => io.close(() => done()));
  await closeStorage(); await db.$disconnect();
  await new Promise<void>((done, reject) => store.db.close((error: any) => error ? reject(error) : done()));
  cleanupSucceeded = !server.listening && io.sockets.sockets.size === 0;
  const report = { generatedAt: new Date().toISOString(), fixture, port, tests: results, passed: results.filter(x => x.status === 'passed').length, failed: results.filter(x => x.status === 'failed').length, cleanupSucceeded, scope: 'Production setupSocket, auth/quiz/announcement/notification routes and storage; real loopback websocket/polling; real disposable Prisma SQLite and connect-sqlite3 sessions. Express test composition excludes full index middleware (CSRF, rate limiter, proxy/TLS) and browser UX. No SMTP/AI worker or external network.' };
  mkdirSync(join(repo, 'docs/live-audit'), { recursive: true });
  writeFileSync(join(repo, 'docs/live-audit/socket-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, cleanupSucceeded, port }));
  if (report.failed || !cleanupSucceeded) process.exitCode = 1;
}
