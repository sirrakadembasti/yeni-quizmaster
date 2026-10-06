import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getOrCreateActiveYear, getYearSchedule } from './academic-year';
import { enqueueArchive } from './archive-jobs';
import { captureArchive } from './archive-capture';
import { exportArchive, verifyArchiveArtifact, type ArchiveArtifact, type SnapshotExport } from './archive-export';

type Student = { id: string; role: string; isActive: boolean; classId: string | null; studentNo?: number | null };
type Transition = { fromClassId: string; toClassId: string | null; graduate: boolean };
type PlannedStudent = { id: string; classId: string | null; studentNo: number | null; graduate: boolean };
/** Compute the final population before writing. Never iterate a newly promoted class. */
export function planStudentTransition(frozen: Student[], current: Student[], classes: { id: string; maxStudents: number | null }[], rules: Transition[]): PlannedStudent[] {
  const initial = frozen.filter(s => s.role === 'student' && s.classId !== null).sort((a, b) => a.id.localeCompare(b.id));
  const live = new Map(current.map(s => [s.id, s])), classMap = new Map(classes.map(c => [c.id, c]));
  const ruleMap = new Map(rules.map(r => [r.fromClassId, r]));
  if (ruleMap.size !== rules.length) throw new Error('Duplicate transition mapping');
  for (const rule of rules) {
    if (!classMap.has(rule.fromClassId) || (rule.graduate ? rule.toClassId !== null : !rule.toClassId || !classMap.has(rule.toClassId))) throw new Error('Invalid transition mapping');
  }
  const moving = new Set(initial.map(s => s.id));
  const counts = new Map<string, number>(), numbers = new Map<string, Set<number>>();
  for (const student of current.filter(s => !moving.has(s.id) && s.classId !== null)) {
    if (student.role === 'student' && student.isActive) counts.set(student.classId!, (counts.get(student.classId!) ?? 0) + 1);
    if (student.studentNo !== null && student.studentNo !== undefined) {
      const reserved = numbers.get(student.classId!) ?? new Set<number>();
      if (!Number.isSafeInteger(student.studentNo) || student.studentNo < 1 || reserved.has(student.studentNo)) throw new Error('Invalid or colliding student number');
      reserved.add(student.studentNo); numbers.set(student.classId!, reserved);
    }
  }
  const plan = initial.map(student => {
    const actual = live.get(student.id);
    if (!actual || actual.role !== 'student' || actual.isActive !== student.isActive || actual.classId !== student.classId) throw new Error('Frozen student membership changed');
    const rule = ruleMap.get(student.classId!);
    if (!rule || (rule.graduate ? rule.toClassId !== null : !rule.toClassId || !classMap.has(rule.toClassId))) throw new Error('Missing or invalid transition mapping');
    if (rule.graduate) return { id: student.id, classId: null, studentNo: null, graduate: true };
    const destination = rule.toClassId!, count = (counts.get(destination) ?? 0) + (student.isActive ? 1 : 0), capacity = classMap.get(destination)!.maxStudents;
    if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < count)) throw new Error('Target class capacity exceeded');
    counts.set(destination, count);
    const reserved = numbers.get(destination) ?? new Set<number>();
    let number = 1;
    while (reserved.has(number) && number <= 2147483647) number++;
    if (number > 2147483647) throw new Error('Student number range exhausted');
    reserved.add(number); numbers.set(destination, reserved);
    return { id: student.id, classId: destination, studentNo: number, graduate: false };
  });
  return plan;
}

export const retryDelay = (attempt: number) => Math.min(3600000, 30000 * 2 ** Math.min(20, Math.max(0, attempt - 1)));
class LeaseLost extends Error { constructor() { super('Archive lease lost'); } }
class ManualPending extends Error { constructor() { super('Manual archive must complete before annual archive'); } }
export interface ArchiveWorkerOptions {
  db: PrismaClient; backupRoot: string; now?: () => Date; owner?: string;
  leaseMs?: number; intervalMs?: number; maxAttempts?: number;
  export?: (input: SnapshotExport, root: string) => Promise<ArchiveArtifact>;
  verify?: (input: SnapshotExport, root: string) => Promise<ArchiveArtifact>;
  capture?: typeof captureArchive;
  onError?: (error: unknown) => void;
}
export function createArchiveWorker(options: ArchiveWorkerOptions) {
  const { db, backupRoot } = options, now = options.now ?? (() => new Date()), owner = options.owner ?? randomUUID();
  const leaseMs = options.leaseMs ?? 180000, intervalMs = options.intervalMs ?? 15000, maxAttempts = options.maxAttempts ?? 5;
  // SQLite cannot renew a lease while an interactive transaction owns the writer lock.
  // The lease exceeds maxWait (10s) + transaction timeout (120s), with a 20s margin.
  if (!Number.isFinite(leaseMs) || leaseMs < 150000 || !Number.isFinite(intervalMs) || intervalMs < 100 || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw new Error('Invalid worker limits');
  let timer: ReturnType<typeof setInterval> | undefined, busy = false;
  const owned = (id: string) => ({ id, leaseOwner: owner, leaseExpiresAt: { gt: now() } });
  async function assertOwned(tx: any, id: string) {
    const job = await tx.archiveSnapshot.findUniqueOrThrow({ where: { id } });
    if (job.leaseOwner !== owner || !job.leaseExpiresAt || job.leaseExpiresAt <= now() || ['completed', 'failed', 'cancelled'].includes(job.status)) throw new LeaseLost();
    return job;
  }
  async function patchOwned(id: string, data: Record<string, unknown>) {
    const changed = await db.archiveSnapshot.updateMany({ where: owned(id), data });
    if (changed.count !== 1) throw new LeaseLost();
  }
  async function hasPendingManual(tx: any, yearId: string) {
    return await tx.archiveSnapshot.count({ where: { academicYearId: yearId, mode: 'manual', status: { notIn: ['completed', 'cancelled'] } } }) > 0;
  }
  async function notify(tx: any, job: any, action: string) {
    const admins = await tx.user.findMany({ where: { role: 'admin', isActive: true }, select: { id: true, email: true } });
    const actor = job.initiatedBy && await tx.user.findUnique({ where: { id: job.initiatedBy }, select: { id: true } });
    const actorId = actor?.id ?? admins[0]?.id;
    if (actorId) await tx.actionLog.create({ data: { userId: actorId, action, details: JSON.stringify({ snapshotId: job.id, academicYear: job.label, attempts: job.attempts }) } });
    // Existing outbox delivers later; this service never opens SMTP connections.
    if (action === 'ARCHIVE_FAILED') for (const admin of admins) {
      await tx.emailQueue.create({ data: { to: admin.email, subject: `Eğitim yılı arşivi başarısız: ${job.label}`, body: `Arşiv ${job.id} tamamlanamadı. Yönetim panelinden arşiv durumunu inceleyin.`, type: 'system_alert' } });
      if (job.mode === 'annual') await tx.notification.create({ data: { userId: admin.id, title: `Eğitim yılı arşivi başarısız: ${job.label}`, message: `Arşiv ${job.id} tamamlanamadı. Yıl kapanmadı; Yıl Sonu ve Arşiv İşlemleri sayfasında sorunu giderip Yeniden Dene ile kurtarın.`, type: 'error' } });
    }
  }
  // Private, transaction-scoped capabilities. The database checks the captured
  // entity, verified artifact, owner and real-time lease again on every write.
  // Only the exact rollover fields are persisted; no User secrets enter permits.
  async function permit(tx: any, job: any, kind: 'user' | 'quiz' | 'result' | 'academicYear' | 'snapshot', id: string, changes: Record<string, unknown>) {
    const definitions = {
      user: { table: 'User', columns: ['classId', 'classNo', 'studentNo', 'isActive', 'deactivatedAt', 'graduationYear', 'graduationDate'] },
      quiz: { table: 'Quiz', columns: ['status', 'academicYear'] },
      result: { table: 'StudentResult', columns: ['academicYear'] },
      academicYear: { table: 'AcademicYear', columns: ['status', 'closedAt', 'snapshotId'] },
      snapshot: { table: 'ArchiveSnapshot', columns: ['status', 'completedAt', 'leaseOwner', 'leaseExpiresAt', 'lastError', 'nextAttemptAt'] },
    };
    const { table, columns } = definitions[kind];
    if (Object.keys(changes).some(key => !columns.includes(key))) throw new Error('Invalid finalization capability');
    const values: any[] = [job.id, owner, kind];
    const before = columns.map(column => `'${column}',"${column}"`).join(',');
    const after = columns.map(column => {
      if (!Object.prototype.hasOwnProperty.call(changes, column)) return `'${column}',"${column}"`;
      const value = changes[column];
      values.push(value instanceof Date ? value.getTime() : typeof value === 'boolean' ? Number(value) : value);
      return `'${column}',?`;
    }).join(',');
    values.push(id);
    const count = await tx.$executeRawUnsafe(`INSERT INTO ArchiveFinalizationPermit(snapshotId,owner,entityType,entityId,oldValues,newValues) SELECT ?,?,?,id,json_object(${before}),json_object(${after}) FROM "${table}" WHERE id=?`, ...values);
    if (count !== 1) throw new Error('Finalization capability target missing');
  }
  async function finalize(id: string) {
    await db.$transaction(async tx => {
      const job = await assertOwned(tx, id);
      if (job.mode === 'annual' && await hasPendingManual(tx, job.academicYearId)) throw new ManualPending();
      if (job.status !== 'verified' || !job.zipSha256 || !job.artifactPath) throw new Error('Archive must be verified before finalization');
      const year = await tx.academicYear.findUniqueOrThrow({ where: { id: job.academicYearId } });
      if (year.status !== 'active' || year.label !== job.label) throw new Error('Academic year is no longer active');
      const rows = await tx.archiveSnapshotRow.findMany({ where: { snapshotId: id }, orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }] });
      let plan: PlannedStudent[] = [];
      let inheritedRules: Transition[] = [];
      if (job.mode === 'annual') {
        const frozen = rows.filter(r => r.entityType === 'user').map(r => JSON.parse(r.dataJson));
        const [current, classes, rules] = await Promise.all([
          tx.user.findMany({ select: { id: true, role: true, isActive: true, classId: true, studentNo: true } }),
          tx.class.findMany({ select: { id: true, maxStudents: true } }),
          tx.academicTransitionRule.findMany({ where: { yearId: year.id } }),
        ]);
        plan = planStudentTransition(frozen, current, classes, rules);
        inheritedRules = rules.map(({ fromClassId, toClassId, graduate }) => ({ fromClassId, toClassId, graduate })).sort((a, b) => a.fromClassId.localeCompare(b.fromClassId));
      } else if (job.mode !== 'manual') throw new Error('Invalid archive mode');
      // Archived quizzes from older manual snapshots are untouched. Triggers allow only this verified transition.
      for (const row of rows.filter(r => r.entityType === 'quiz')) {
        const quiz = await tx.quiz.findUniqueOrThrow({ where: { id: row.entityId }, select: { status: true } });
        if (quiz.status !== 'archived') {
          const changes = { status: 'archived', academicYear: job.label };
          await permit(tx, job, 'quiz', row.entityId, changes);
          await tx.quiz.update({ where: { id: row.entityId }, data: changes });
        }
        const results = rows.filter(r => r.entityType === 'result').filter(r => {
          const result = JSON.parse(r.dataJson);
          return result.quizId === row.entityId && result.academicYear === null;
        });
        for (const result of results) await permit(tx, job, 'result', result.entityId, { academicYear: job.label });
        await tx.studentResult.updateMany({ where: { quizId: row.entityId, academicYear: null }, data: { academicYear: job.label } });
      }
      if (job.mode === 'annual') {
        // Release all migrating numbers first, so chains and cycles cannot violate the unique index.
        if (plan.length) {
          for (const student of plan) await permit(tx, job, 'user', student.id, { studentNo: null });
          await tx.user.updateMany({ where: { id: { in: plan.map(s => s.id) } }, data: { studentNo: null } });
        }
        for (const student of plan) {
          const changes = student.graduate
            ? { classId: null, classNo: null, studentNo: null, isActive: false, deactivatedAt: now(), graduationYear: job.label, graduationDate: now() }
            : { classId: student.classId, classNo: null, studentNo: student.studentNo };
          await permit(tx, job, 'user', student.id, changes);
          await tx.user.update({ where: { id: student.id }, data: changes });
        }
        const start = Number(job.label.slice(5)), nextLabel = `${start}-${start + 1}`;
        const yearChanges = { status: 'closed', closedAt: now(), snapshotId: id };
        await permit(tx, job, 'academicYear', year.id, yearChanges);
        await tx.academicYear.update({ where: { id: year.id }, data: yearChanges });
        await tx.academicYear.create({ data: {
          label: nextLabel, status: 'active', opensAt: year.scheduledCloseAt, scheduledCloseAt: getYearSchedule(nextLabel),
          // Fresh rule identities let administrators edit the active year independently.
          transitionRules: { create: inheritedRules },
        } });
      }
      await notify(tx, job, 'ARCHIVE_COMPLETED');
      // Recheck with the clock immediately before the last mutation. A stale transaction rolls back entirely.
      await assertOwned(tx, id);
      const completion = { status: 'completed', completedAt: now(), leaseOwner: null, leaseExpiresAt: null, lastError: null, nextAttemptAt: null };
      await permit(tx, job, 'snapshot', id, completion);
      const changed = await tx.archiveSnapshot.updateMany({ where: { ...owned(id), status: 'verified' }, data: completion });
      if (changed.count !== 1) throw new LeaseLost();
      const remaining = await tx.$executeRawUnsafe('DELETE FROM ArchiveFinalizationPermit WHERE snapshotId=?', id);
      if (remaining !== 0) throw new Error('Unconsumed finalization capabilities');
    }, { maxWait: 10000, timeout: 120000 });
  }
  async function tick() {
    if (busy) return;
    busy = true;
    let claimed: any, heartbeat: ReturnType<typeof setInterval> | undefined, heartbeatError: unknown;
    try {
      const year = await getOrCreateActiveYear(db, now());
      if (year.scheduledCloseAt <= now()) await enqueueArchive(db, { mode: 'annual', academicYearId: year.id }, now());
      const runnable = { status: { in: ['queued', 'capturing', 'files_generating', 'verified', 'retry_wait'] }, AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now() } }] }, { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now() } }] }] };
      const orderBy = [{ createdAt: 'asc' as const }, { id: 'asc' as const }];
      let candidate = await db.archiveSnapshot.findFirst({ where: runnable, orderBy });
      // A failed, backoff-delayed or live-leased manual snapshot still holds its capture fence.
      // Skip the annual candidate but keep servicing eligible manual work.
      if (candidate?.mode === 'annual' && await hasPendingManual(db, candidate.academicYearId)) {
        candidate = await db.archiveSnapshot.findFirst({ where: { ...runnable, mode: 'manual' }, orderBy });
      }
      if (!candidate) return;
      const changed = await db.archiveSnapshot.updateMany({ where: { id: candidate.id, ...runnable }, data: { leaseOwner: owner, leaseExpiresAt: new Date(now().getTime() + leaseMs), attempts: { increment: 1 } } });
      if (changed.count !== 1) return;
      claimed = await assertOwned(db, candidate.id);
      heartbeat = setInterval(() => { patchOwned(claimed.id, { leaseExpiresAt: new Date(now().getTime() + leaseMs) }).catch(error => { heartbeatError = error; }); }, Math.floor(leaseMs / 3));
      heartbeat.unref?.();
      if (['queued', 'capturing', 'retry_wait'].includes(claimed.status)) {
        if (claimed.mode === 'annual' && await hasPendingManual(db, claimed.academicYearId)) throw new ManualPending();
        await patchOwned(claimed.id, { leaseExpiresAt: new Date(now().getTime() + leaseMs) });
        await (options.capture ?? captureArchive)(db, claimed.id, { owner, now });
      }
      await assertOwned(db, claimed.id);
      const job = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: claimed.id } });
      const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }] });
      rows.sort((a, b) => a.entityType.localeCompare(b.entityType) || a.entityId.localeCompare(b.entityId));
      const input: SnapshotExport = { id: job.id, label: job.label, createdAt: job.createdAt, initiatedBy: job.initiatedBy, rows };
      if (job.status !== 'verified') await (options.export ?? exportArchive)(input, backupRoot);
      const artifact = await (options.verify ?? verifyArchiveArtifact)(input, backupRoot);
      if (heartbeatError) throw heartbeatError;
      await patchOwned(job.id, { status: 'verified', artifactPath: artifact.artifactPath, zipSha256: artifact.zipSha256, sizeBytes: artifact.sizeBytes });
      if (heartbeat) { clearInterval(heartbeat); heartbeat = undefined; }
      await patchOwned(job.id, { leaseExpiresAt: new Date(now().getTime() + leaseMs) });
      await finalize(job.id);
    } catch (error) {
      if (claimed && error instanceof ManualPending) {
        await patchOwned(claimed.id, { leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: new Date(now().getTime() + intervalMs), attempts: { decrement: 1 } }).catch(failure => { if (!(failure instanceof LeaseLost)) options.onError?.(failure); });
      } else if (claimed && !(error instanceof LeaseLost)) {
        await db.$transaction(async tx => {
          const job = await assertOwned(tx, claimed.id), failed = job.attempts >= maxAttempts;
          const changed = await tx.archiveSnapshot.updateMany({ where: owned(job.id), data: { status: failed ? 'failed' : 'retry_wait', nextAttemptAt: failed ? null : new Date(now().getTime() + retryDelay(job.attempts)), leaseOwner: null, leaseExpiresAt: null, lastError: String(error instanceof Error ? error.message : error).slice(0, 1000) } });
          if (changed.count !== 1) throw new LeaseLost();
          await notify(tx, job, failed ? 'ARCHIVE_FAILED' : 'ARCHIVE_RETRY');
        }).catch(failure => { if (!(failure instanceof LeaseLost)) options.onError?.(failure); });
      }
      if (!(error instanceof LeaseLost) && !(error instanceof ManualPending)) options.onError?.(error);
    } finally { if (heartbeat) clearInterval(heartbeat); busy = false; }
  }
  return { tick, start() { if (!timer) { timer = setInterval(() => { void tick(); }, intervalMs); timer.unref?.(); void tick(); } }, stop() { if (timer) clearInterval(timer); timer = undefined; } };
}
