import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRuntimePrismaClient } from '../../utils/sqlite-runtime';
import { storage, closeStorage } from '../../storage';
import authRouter from '../../api-routes/auth';
import { createDemoModeGuard } from '../../middleware/demo-guard';

// P-02: requireAuth ilişkisiz (hafif) kullanıcı sorgusu kullanmalı; /me yanıtı ise tam kalmalı.
const db = createRuntimePrismaClient();
let actorId = '';
let student: any;
let teacher: any;
let category: any;
let classroom: any;

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => { req.session = { userId: actorId, sessionVersion: 0 }; next(); });
app.use('/api/auth', authRouter);

beforeAll(async () => {
  classroom = await db.class.create({ data: { name: 'P02 class ' + randomUUID() } });
  category = await db.category.create({ data: { name: 'P02 course ' + randomUUID() } });
  student = await storage.createUser({ name: 'P02 student', email: randomUUID() + '@example.com', password: 'hash', role: 'student', classId: classroom.id } as any);
  teacher = await storage.createUser({ name: 'P02 teacher', email: randomUUID() + '@example.com', password: 'hash', role: 'teacher' } as any);
  await db.user.update({ where: { id: teacher.id }, data: { assignedCategories: { connect: { id: category.id } } } });
}, 30000);
afterAll(async () => { await db.$disconnect(); await closeStorage(); });

describe('P-02: hafif kullanıcı sorgusu', () => {
  it('relations:false ilişkileri yüklemez, düz sütunları korur', async () => {
    const light: any = await storage.getUser(student.id, { relations: false });
    expect(light.classId).toBe(classroom.id);
    expect(light.role).toBe('student');
    for (const key of ['class', 'assignedCategories', 'managedClasses', 'teacherAssignments', 'classes']) {
      expect(key in light).toBe(false);
    }
  });

  it('varsayılan getUser ilişkileri yüklemeye devam eder', async () => {
    const full: any = await storage.getUser(student.id);
    expect(full.class?.id).toBe(classroom.id);
    expect(Array.isArray(full.assignedCategories)).toBe(true);
    expect(Array.isArray(full.classes)).toBe(true);
  });

  it('GET /api/auth/me yanıtında class ve assignedCategories hâlâ bulunur (öğrenci)', async () => {
    actorId = student.id;
    const res = await request(app).get('/api/auth/me').timeout(10000);
    expect(res.status).toBe(200);
    expect(res.body.user.class?.id).toBe(classroom.id);
    expect(Array.isArray(res.body.user.assignedCategories)).toBe(true);
    expect(res.body.user.password).toBeUndefined();
  });

  it('GET /api/auth/me yanıtında öğretmenin dersleri hâlâ bulunur', async () => {
    actorId = teacher.id;
    const res = await request(app).get('/api/auth/me').timeout(10000);
    expect(res.status).toBe(200);
    expect(res.body.user.assignedCategories.map((c: any) => c.id)).toEqual([category.id]);
    expect(Array.isArray(res.body.user.classes)).toBe(true);
  });

  it('demo koruması yazma isteğinde ikinci kez kullanıcı sorgusu yapmaz', async () => {
    const guarded = express();
    guarded.use((req: any, _res, next) => { req.session = { userId: student.id }; next(); });
    guarded.use(createDemoModeGuard());
    guarded.post('/api/anything', (_req, res) => res.json({ ok: true }));
    const spy = vi.spyOn(storage, 'getUser');
    try {
      const res = await request(guarded).post('/api/anything').timeout(10000);
      expect(res.status).toBe(200);
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
});
