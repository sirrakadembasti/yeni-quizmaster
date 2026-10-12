import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getOrCreateActiveYear, getYearSchedule } from './academic-year';
import { enqueueArchive } from './archive-jobs';
import { captureArchive } from './archive-capture';
import { exportArchive, verifyArchiveArtifact, type ArchiveArtifact, type SnapshotExport } from './archive-export';
import { readTransitionPlan, type PlannedStudent, type TransitionRule as Transition, type TransitionSummary } from './archive-transition';
import { warmCompletedHistory } from './archive-history-projection';
export { planStudentTransition } from './archive-transition';

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
  async function notify(tx: any, job: any, action: string, transitionSummary?: TransitionSummary) {
    const admins = await tx.user.findMany({ where: { role: 'admin', isActive: true }, select: { id: true, email: true } });
    const actor = job.initiatedBy && await tx.user.findUnique({ where: { id: job.initiatedBy }, select: { id: true } });
    const actorId = actor?.id ?? admins[0]?.id;
    if (actorId) await tx.actionLog.create({ data: { userId: actorId, action, details: JSON.stringify({ snapshotId: job.id, academicYear: job.label, attempts: job.attempts, ...(transitionSummary ? { transitionSummary } : {}) }) } });
    // Existing outbox delivers later; this service never opens SMTP connections.
    if (action === 'ARCHIVE_FAILED') for (const admin of admins) {
      await tx.emailQueue.create({ data: { to: admin.email, subject: `Eğitim yılı arşivi başarısız: ${job.label}`, body: `Arşiv ${job.id} tamamlanamadı. Yönetim panelinden arşiv durumunu inceleyin.`, type: 'system_alert' } });
      if (job.mode === 'annual') await tx.notification.create({ data: { userId: admin.id, title: `Eğitim yılı arşivi başarısız: ${job.label}`, message: `Arşiv ${job.id} tamamlanamadı. Yıl kapanmadı; Yıl Sonu ve Arşiv İşlemleri sayfasında sorunu giderip Yeniden Dene ile kurtarın.`, type: 'error' } });
    }
  }
  // Private, transaction-scoped capabilities. The database checks the captured
  // entity, verified artifact, owner and real-time lease again on every write.
  // Only the exact rollover fields are persisted; no User secrets enter permits.
  const definitions = {
      user: { table: 'User', columns: ['classId', 'classNo', 'studentNo', 'isActive', 'deactivatedAt', 'graduationYear', 'graduationDate'] },
      quiz: { table: 'Quiz', columns: ['status', 'academicYear'] },
      result: { table: 'StudentResult', columns: ['academicYear'] },
      academicYear: { table: 'AcademicYear', columns: ['status', 'closedAt', 'snapshotId'] },
      snapshot: { table: 'ArchiveSnapshot', columns: ['status', 'completedAt', 'leaseOwner', 'leaseExpiresAt', 'lastError', 'nextAttemptAt', 'transitionSummaryJson'] },
    };
  async function permitBatch(tx: any, job: any, kind: keyof typeof definitions, ids: string[], changes: Record<string, unknown>) {
    if (!ids.length) return;
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
    values.push(...ids);
    const count = await tx.$executeRawUnsafe(`INSERT INTO ArchiveFinalizationPermit(snapshotId,owner,entityType,entityId,oldValues,newValues) SELECT ?,?,?,id,json_object(${before}),json_object(${after}) FROM "${table}" WHERE id IN (${ids.map(()=>'?').join(',')})`, ...values);
    if (count !== ids.length) throw new Error('Finalization capability target missing');
  }
  const permit = (tx:any,job:any,kind:keyof typeof definitions,id:string,changes:Record<string,unknown>) => permitBatch(tx,job,kind,[id],changes);
  async function moveStudents(tx:any,job:any,students:PlannedStudent[]) {
    // CTE inputs contain only the validated one-step plan. The existing triggers
    // compare and consume an exact capability for every row, including no-ops.
    const at=now().getTime();
    for(let start=0;start<students.length;start+=100){
      const batch=students.slice(start,start+100),values=batch.flatMap(student=>[student.id,student.classId,student.studentNo,Number(student.graduate)]);
      const cte=`WITH changes(id,classId,studentNo,graduate) AS (VALUES ${batch.map(()=>'(?,?,?,?)').join(',')})`;
      const before=definitions.user.columns.map(column=>`'${column}',u."${column}"`).join(',');
      const after="'classId',c.classId,'classNo',NULL,'studentNo',c.studentNo,'isActive',CASE WHEN c.graduate=1 THEN 0 ELSE u.isActive END,'deactivatedAt',CASE WHEN c.graduate=1 THEN ? ELSE u.deactivatedAt END,'graduationYear',CASE WHEN c.graduate=1 THEN ? ELSE u.graduationYear END,'graduationDate',CASE WHEN c.graduate=1 THEN ? ELSE u.graduationDate END";
      const admitted=await tx.$executeRawUnsafe(`${cte} INSERT INTO ArchiveFinalizationPermit(snapshotId,owner,entityType,entityId,oldValues,newValues) SELECT ?,?,'user',u.id,json_object(${before}),json_object(${after}) FROM "User" u JOIN changes c ON c.id=u.id`,...values,job.id,owner,at,job.label,at);
      if(admitted!==batch.length)throw new Error('Finalization capability target missing');
      const changed=await tx.$executeRawUnsafe(`${cte} UPDATE "User" AS u SET classId=(SELECT classId FROM changes WHERE id=u.id),classNo=NULL,studentNo=(SELECT studentNo FROM changes WHERE id=u.id),isActive=(SELECT CASE WHEN graduate=1 THEN 0 ELSE u.isActive END FROM changes WHERE id=u.id),deactivatedAt=(SELECT CASE WHEN graduate=1 THEN ? ELSE u.deactivatedAt END FROM changes WHERE id=u.id),graduationYear=(SELECT CASE WHEN graduate=1 THEN ? ELSE u.graduationYear END FROM changes WHERE id=u.id),graduationDate=(SELECT CASE WHEN graduate=1 THEN ? ELSE u.graduationDate END FROM changes WHERE id=u.id) WHERE id IN (SELECT id FROM changes)`,...values,at,job.label,at);
      if(changed!==batch.length)throw new Error('Incomplete student transition');
    }
  }
  async function finalize(id: string) {
    await db.$transaction(async tx => {
      const job = await assertOwned(tx, id);
      if (job.mode === 'annual' && await hasPendingManual(tx, job.academicYearId)) throw new ManualPending();
      if (job.status !== 'verified' || !job.zipSha256 || !job.artifactPath) throw new Error('Archive must be verified before finalization');
      const year = await tx.academicYear.findUniqueOrThrow({ where: { id: job.academicYearId } });
      if (year.status !== 'active' || year.label !== job.label) throw new Error('Academic year is no longer active');
      const rows = await tx.archiveSnapshotRow.findMany({ where: { snapshotId: id, entityType: { in: ['user','quiz','result'] } }, orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }] });
      let plan: PlannedStudent[] = [];
      let inheritedRules: Transition[] = [];
      let transitionSummary: TransitionSummary | undefined;
      if (job.mode === 'annual') {
        const frozen = rows.filter(r => r.entityType === 'user').map(r => JSON.parse(r.dataJson));
        const validated = await readTransitionPlan(tx, year.id, frozen);
        const { rules } = validated;
        plan = validated.students; transitionSummary = validated.summary;
        inheritedRules = rules.map(({ fromClassId, toClassId, graduate }) => ({ fromClassId, toClassId, graduate })).sort((a, b) => a.fromClassId.localeCompare(b.fromClassId));
      } else if (job.mode !== 'manual') throw new Error('Invalid archive mode');
      // Archived quizzes from older manual snapshots are untouched. Triggers allow only this verified transition.
      const quizIds=rows.filter(row=>row.entityType==='quiz').map(row=>row.entityId),quizSet=new Set(quizIds);
      for(let start=0;start<quizIds.length;start+=500){
        const ids=quizIds.slice(start,start+500),quizzes=await tx.quiz.findMany({where:{id:{in:ids}},select:{id:true,status:true}});
        if(quizzes.length!==ids.length)throw new Error('Finalization content missing');
        const pending=quizzes.filter(quiz=>quiz.status!=='archived').map(quiz=>quiz.id),changes={status:'archived',academicYear:job.label};
        await permitBatch(tx,job,'quiz',pending,changes);
        if(pending.length && (await tx.quiz.updateMany({where:{id:{in:pending},status:{not:'archived'}},data:changes})).count!==pending.length)throw new Error('Incomplete content finalization');
      }
      const resultIds=rows.filter(row=>{if(row.entityType!=='result')return false;const result=JSON.parse(row.dataJson);return result.academicYear===null&&quizSet.has(result.quizId);}).map(row=>row.entityId);
      for(let start=0;start<resultIds.length;start+=500){
        const ids=resultIds.slice(start,start+500),changes={academicYear:job.label};
        await permitBatch(tx,job,'result',ids,changes);
        if((await tx.studentResult.updateMany({where:{id:{in:ids},academicYear:null},data:changes})).count!==ids.length)throw new Error('Incomplete result finalization');
      }
      if (job.mode === 'annual') {
        // Release all migrating numbers first, so chains and cycles cannot violate the unique index.
        if (plan.length) {
          for(let start=0;start<plan.length;start+=500){
            const ids=plan.slice(start,start+500).map(student=>student.id);
            await permitBatch(tx,job,'user',ids,{studentNo:null});
            if((await tx.user.updateMany({where:{id:{in:ids}},data:{studentNo:null}})).count!==ids.length)throw new Error('Incomplete student number release');
          }
        }
        await moveStudents(tx,job,plan);
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
      await notify(tx, job, 'ARCHIVE_COMPLETED', transitionSummary);
      // Recheck with the clock immediately before the last mutation. A stale transaction rolls back entirely.
      await assertOwned(tx, id);
      const completion = { status: 'completed', completedAt: now(), leaseOwner: null, leaseExpiresAt: null, lastError: null, nextAttemptAt: null, ...(transitionSummary ? { transitionSummaryJson: JSON.stringify(transitionSummary) } : {}) };
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
        if (claimed.mode === 'annual' && !claimed.capturedAt) await readTransitionPlan(db, claimed.academicYearId);
        await (options.capture ?? captureArchive)(db, claimed.id, { owner, now });
      }
      await assertOwned(db, claimed.id);
      const job = await db.archiveSnapshot.findUniqueOrThrow({ where: { id: claimed.id } });
      const rows = await db.archiveSnapshotRow.findMany({ where: { snapshotId: job.id }, orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }] });
      rows.sort((a, b) => a.entityType.localeCompare(b.entityType) || a.entityId.localeCompare(b.entityId));
      if (job.mode === 'annual') await readTransitionPlan(db, job.academicYearId, rows.filter(row => row.entityType === 'user').map(row => JSON.parse(row.dataJson)));
      const input: SnapshotExport = { id: job.id, label: job.label, createdAt: job.createdAt, capturedAt:job.capturedAt, initiatedBy: job.initiatedBy, rows };
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
  return { tick, start() { if (!timer) { timer = setInterval(() => { void tick(); }, intervalMs); timer.unref?.(); void warmCompletedHistory(db,options.onError).catch(error=>options.onError?.(error)); void tick(); } }, stop() { if (timer) clearInterval(timer); timer = undefined; } };
}
