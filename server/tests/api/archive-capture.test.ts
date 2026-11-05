import { afterAll, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { getOrCreateActiveYear } from '../../services/academic-year';
import { captureArchive } from '../../services/archive-capture';

const db = new PrismaClient();
vi.setConfig({ testTimeout: 120000 });
afterAll(async () => { await db.$disconnect(); });
async function fixture() {
  const year = await getOrCreateActiveYear(db, new Date('2026-10-01T00:00:00Z'));
  const person = await db.user.create({ data: { name: 'Frozen student', email: randomUUID()+'@example.test', password: 'NEVER_EXPORT_PASSWORD', resetToken: 'NEVER_EXPORT_TOKEN', role: 'student' } });
  const quiz = await db.quiz.create({ data: { title: 'Selected', status: 'published', createdBy: person.id } });
  const other = await db.quiz.create({ data: { title: 'Not selected', createdBy: person.id } });
  const result = await db.studentResult.create({ data: { quizId: quiz.id, studentId: person.id, score: 70, status: 'completed' } });
  const job = await db.archiveSnapshot.create({ data: { academicYearId: year.id, label: year.label, mode: 'manual', scopeJson: JSON.stringify({ quizIds: [quiz.id] }) } });
  return { year, person, quiz, other, result, job };
}

it('captures explicit scope and frozen business data without authentication secrets', async () => {
  const f = await fixture();
  const unrelated = await db.user.create({ data: { name: 'Unrelated', email: randomUUID()+'@example.test', password: 'isolated' } });
  await captureArchive(db, f.job.id);
  const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: f.job.id } });
  expect(rows.find(r => r.entityType === 'quiz' && r.entityId === f.quiz.id)).toBeDefined();
  expect(rows.find(r => r.entityType === 'quiz' && r.entityId === f.other.id)).toBeUndefined();
  expect(rows.find(r => r.entityType === 'result' && r.entityId === f.result.id)).toBeDefined();
  expect(rows.find(r => r.entityType === 'user' && r.entityId === unrelated.id)).toBeUndefined();
  const user = rows.find(r => r.entityType === 'user' && r.entityId === f.person.id)!;
  expect(JSON.parse(user.dataJson).name).toBe('Frozen student');
  expect(user.dataJson).not.toContain('NEVER_EXPORT');
  expect(JSON.parse(user.dataJson)).not.toHaveProperty('password');
  await db.user.update({ where: { id: f.person.id }, data: { name: 'Current student name' } });
  expect(JSON.parse((await db.archiveSnapshotRow.findUniqueOrThrow({ where: { id: user.id } })).dataJson).name).toBe('Frozen student');
  await expect(db.quiz.update({ where: { id: f.quiz.id }, data: { title: 'Changed after capture' } })).rejects.toThrow();
  await expect(db.archiveSnapshotRow.update({ where: { id: user.id }, data: { dataJson: '{}' } })).rejects.toThrow();
  await expect(db.archiveSnapshotRow.delete({ where: { id: user.id } })).rejects.toThrow();
  await captureArchive(db, f.job.id);
  expect(await db.archiveSnapshotRow.count({ where: { snapshotId: f.job.id } })).toBe(rows.length);
  expect((await db.quiz.findUniqueOrThrow({ where: { id: f.quiz.id } })).status).toBe('published');
  expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: f.job.id } })) as any).toHaveProperty('capturedAt', expect.any(Date));
});

it('rolls every snapshot row and job state back if capture fails', async () => {
  const f = await fixture();
  await db.$executeRawUnsafe(`CREATE TRIGGER injected_capture_failure BEFORE INSERT ON ArchiveSnapshotRow WHEN NEW.snapshotId='${f.job.id}' AND NEW.entityType='result' BEGIN SELECT RAISE(ABORT,'injected capture failure'); END`);
  try {
    await expect(captureArchive(db, f.job.id)).rejects.toThrow();
    expect(await db.archiveSnapshotRow.count({ where: { snapshotId: f.job.id } })).toBe(0);
    expect((await db.archiveSnapshot.findUniqueOrThrow({ where: { id: f.job.id } })).status).toBe('queued');
    expect((await db.quiz.findUniqueOrThrow({ where: { id: f.quiz.id } })).status).toBe('published');
  } finally { await db.$executeRawUnsafe('DROP TRIGGER injected_capture_failure'); }
});

it('rejects missing content and empty manual selections instead of capturing unrelated records', async () => {
  const year = await getOrCreateActiveYear(db);
  for (const quizIds of [[], [randomUUID()]]) {
    const job = await db.archiveSnapshot.create({ data: { academicYearId: year.id, label: year.label, mode: 'manual', scopeJson: JSON.stringify({ quizIds }) } });
    await expect(captureArchive(db, job.id)).rejects.toThrow();
    expect(await db.archiveSnapshotRow.count({ where: { snapshotId: job.id } })).toBe(0);
  }
});
