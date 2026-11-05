import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { api, login, prisma } from './parent-audit-helpers';

test('P-B02: real class notices deduplicate siblings and exclude inactive or removed links', async ({ page }) => {
  const db = prisma();
  const parentId = 'parent-audit-parent';
  const childId = 'parent-audit-student';
  const securityId = 'parent-audit-security';
  const syntheticId = 'parent-audit-repairs-child-' + randomUUID();
  const prefix = 'Parent audit repairs notice ' + randomUUID();
  const announcements: string[] = [];
  const child = await db.user.findUniqueOrThrow({ where: { id: childId } });
  const savedLink = await db.guardianStudent.findUniqueOrThrow({ where: { guardianId_studentId: { guardianId: parentId, studentId: childId } } });
  const admin = await db.user.findFirstOrThrow({ where: { role: 'admin' } });
  const security = await db.user.findUniqueOrThrow({ where: { id: securityId } });
  try {
    await db.user.create({ data: { id: syntheticId, name: 'Parent repair synthetic child', email: syntheticId + '@example.test', password: child.password, role: 'student', classId: child.classId } });
    await db.guardianStudent.createMany({ data: [parentId, securityId].map(guardianId => ({ guardianId, studentId: syntheticId, relation: 'Diğer' })) });

    async function publish(phase: string, ownCount: number, securityCount: number) {
      const title = prefix + ' ' + phase;
      await login(page, admin.email);
      const created = await api(page, 'POST', '/announcements', { title, content: 'Synthetic audience boundary acceptance', targetRole: 'parent', targetClassId: child.classId });
      expect(created.status()).toBe(201);
      const announcementId = (await created.json()).id;
      announcements.push(announcementId);
      expect(await db.notification.count({ where: { title, userId: parentId } })).toBe(ownCount);
      expect(await db.notification.count({ where: { title, userId: securityId } })).toBe(securityCount);
      expect(await db.notification.count({ where: { title, userId: 'parent-audit-no-links' } })).toBe(0);
      expect(await db.notification.count({ where: { title, userId: admin.id } })).toBe(0);
      expect(await db.notification.count({ where: { title, userId: childId } })).toBe(0);
      await login(page, child.email);
      const studentList = await api(page, 'GET', '/announcements');
      expect(studentList.status()).toBe(200);
      expect((await studentList.json()).announcements.map((notice: any) => notice.id)).not.toContain(announcementId);
      for (const [email, expected] of [['parent-audit@example.test', ownCount], [security.email, securityCount]] as const) {
        await login(page, email);
        const response = await api(page, 'GET', '/announcements');
        expect(response.status()).toBe(200);
        const ids = (await response.json()).announcements.map((notice: any) => notice.id);
        expect(ids.includes(announcementId)).toBe(expected === 1);
      }
    }

    await publish('two-active-siblings', 1, 1);
    await db.user.update({ where: { id: syntheticId }, data: { isActive: false, deactivatedAt: new Date() } });
    await publish('inactive-child', 1, 0);
    await db.guardianStudent.delete({ where: { guardianId_studentId: { guardianId: parentId, studentId: childId } } });
    await publish('removed-link', 0, 0);
  } finally {
    await db.guardianStudent.upsert({ where: { guardianId_studentId: { guardianId: parentId, studentId: childId } }, create: savedLink, update: { relation: savedLink.relation } });
    await db.notification.deleteMany({ where: { title: { startsWith: prefix } } });
    await db.announcement.deleteMany({ where: { id: { in: announcements }, title: { startsWith: prefix } } });
    await db.user.deleteMany({ where: { id: syntheticId } });
    await db.$disconnect();
  }
});
