import { describe, expect, it, vi } from 'vitest';
import { createArchiveWorker, planStudentTransition, retryDelay } from '../../services/archive-worker';

describe('annual frozen student transition', () => {
  const students = [{ id: 'a', role: 'student', isActive: true, classId: 'one', studentNo: 1 }, { id: 'b', role: 'student', isActive: true, classId: 'two', studentNo: 1 }];
  const classes = [{ id: 'one', maxStudents: 1 }, { id: 'two', maxStudents: 1 }];
  const rules = [{ fromClassId: 'one', toClassId: 'two', graduate: false }, { fromClassId: 'two', toClassId: null, graduate: true }];
  it('moves each initial student once and frees departing capacity', () => {
    expect(planStudentTransition(students, students, classes, rules)).toEqual([{ id: 'a', classId: 'two', studentNo: 1, graduate: false }, { id: 'b', classId: null, studentNo: null, graduate: true }]);
  });
  it('rejects a frozen student moved while files were generated', () => {
    expect(() => planStudentTransition(students, [{ ...students[0], classId: 'two' }, students[1]], classes, rules)).toThrow(/changed/);
  });
  it('requires explicit coverage without interpreting class names', () => {
    expect(() => planStudentTransition(students, students, classes, rules.slice(0, 1))).toThrow(/mapping/);
  });
  it('keeps inactive students in their initial classes without requiring mappings', () => {
    const inactive = students.map(student => ({ ...student, isActive: false }));
    expect(planStudentTransition(inactive, inactive, classes, [])).toEqual([]);
  });
  it('never promotes a former graduate even if the account was reactivated', () => {
    const graduates = students.map(student => ({ ...student, graduationYear: '2024-2025', graduationDate: new Date('2025-07-14T21:05:00Z') }));
    expect(planStudentTransition(graduates, graduates, classes, [])).toEqual([]);
  });
  it('leaves classless students without invented destinations', () => {
    const classless = students.map(student => ({ ...student, classId: null }));
    expect(planStudentTransition(classless, classless, classes, [])).toEqual([]);
  });
  it('uses one frozen hop for cycles and releases every departing number', () => {
    expect(planStudentTransition(students, students, classes, [{ fromClassId: 'one', toClassId: 'two', graduate: false }, { fromClassId: 'two', toClassId: 'one', graduate: false }])).toEqual([
      { id: 'a', classId: 'two', studentNo: 1, graduate: false }, { id: 'b', classId: 'one', studentNo: 1, graduate: false },
    ]);
  });
  it('rejects a self-target instead of presenting it as a promotion', () => {
    expect(() => planStudentTransition(students, students, classes, [{ fromClassId: 'one', toClassId: 'one', graduate: false }, rules[1]])).toThrow(/mapping/);
  });
  it('revalidates frozen graduation fields and student numbers', () => {
    expect(() => planStudentTransition(students, [{ ...students[0], graduationYear: '2024-2025' }, students[1]], classes, rules)).toThrow(/changed/);
    expect(() => planStudentTransition(students, [{ ...students[0], studentNo: 7 }, students[1]], classes, rules)).toThrow(/changed/);
  });
  it('preserves stationary former graduate numbers and active occupancy', () => {
    const enrolled = [students[0], { ...students[1], studentNo: 2 }];
    const former = { id: 'former', role: 'student', isActive: true, classId: 'two', studentNo: 1, graduationYear: '2024-2025' };
    expect(() => planStudentTransition([...enrolled, former], [...enrolled, former], classes, rules)).toThrow(/capacity/);
    expect(planStudentTransition([...enrolled, { ...former, isActive: false }], [...enrolled, { ...former, isActive: false }], classes, rules)[0].studentNo).toBe(2);
  });
  it('counts new active arrivals and reserves inactive student numbers', () => {
    expect(() => planStudentTransition(students, [...students, { id: 'new', role: 'student', isActive: true, classId: 'two', studentNo: 2 }], classes, rules)).toThrow(/capacity/);
    const distinct = [students[0], { ...students[1], studentNo: 2 }];
    expect(planStudentTransition(distinct, [...distinct, { id: 'inactive', role: 'student', isActive: false, classId: 'two', studentNo: 1 }], classes, rules)[0].studentNo).toBe(2);
  });
});

describe('durable worker orchestration', () => {
  function setup() {
    const now = new Date('2026-07-14T21:05:00Z');
    const job: any = { id: 'job', label: '2025-2026', academicYearId: 'year', status: 'files_generating', mode: 'manual', attempts: 0, leaseOwner: null, leaseExpiresAt: null, initiatedBy: null, createdAt: now };
    const updateMany = vi.fn(async ({ where, data }: any) => {
      if (where.id !== job.id || (where.leaseOwner && where.leaseOwner !== job.leaseOwner)) return { count: 0 };
      if (where.AND && job.leaseExpiresAt && job.leaseExpiresAt > now) return { count: 0 };
      if (where.leaseExpiresAt?.gt && (!job.leaseExpiresAt || job.leaseExpiresAt <= where.leaseExpiresAt.gt)) return { count: 0 };
      Object.assign(job, data, data.attempts ? { attempts: job.attempts + (data.attempts.increment ?? -data.attempts.decrement) } : {});
      return { count: 1 };
    });
    const db: any = { academicYear: { findFirst: vi.fn(async () => ({ id: 'year', label: job.label, status: 'active', scheduledCloseAt: new Date('2027-07-14T21:05:00Z') })) }, archiveSnapshot: { findFirst: vi.fn(async () => job.status === 'completed' ? null : { ...job }), findUniqueOrThrow: vi.fn(async () => ({ ...job })), updateMany, update: vi.fn(async ({ data }: any) => Object.assign(job, data)) }, archiveSnapshotRow: { findMany: vi.fn(async () => [{ entityType: 'user', entityId: 'z', dataJson: '{}' }, { entityType: 'class', entityId: 'b', dataJson: '{}' }]) }, user: { findMany: vi.fn(async () => []) }, quiz: { updateMany: vi.fn() }, actionLog: { create: vi.fn() }, emailQueue: { create: vi.fn() } };
    db.academicYear.findUniqueOrThrow = vi.fn(async () => ({ id: 'year', label: job.label, status: 'active' }));
    db.archiveSnapshot.count = vi.fn(async () => 0);
    db.class = { findMany: vi.fn(async () => []) };
    db.academicTransitionRule = { findMany: vi.fn(async () => []) };
    db.$transaction = async (fn: any) => { const before = { ...job }; try { return await fn(db); } catch (error) { Object.assign(job, before); throw error; } };
    db.$executeRawUnsafe = vi.fn(async (sql: string) => sql.startsWith('INSERT INTO ArchiveFinalizationPermit') ? 1 : 0);
    const artifact: any = { artifactPath: '/backup/archive.zip', zipSha256: 'abc', sizeBytes: 5 };
    const generate = vi.fn(async () => artifact), verify = vi.fn(async () => artifact);
    return { db, now, job, generate, verify };
  }
  it('exports sorted frozen rows and verifies before completing', async () => {
    const s = setup(); const worker = createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify });
    await worker.tick();
    expect(s.generate.mock.calls[0][0].rows.map((r: any) => r.entityType)).toEqual(['class', 'user']);
    expect(s.verify).toHaveBeenCalledOnce(); expect(s.job.status).toBe('completed');
  });
  it('export failure never finalizes and uses bounded retry state', async () => {
    const s = setup(); s.generate.mockRejectedValue(new Error('disk full'));
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify, maxAttempts: 2 }).tick();
    expect(s.job.status).toBe('retry_wait'); expect(s.job.nextAttemptAt.getTime() - s.now.getTime()).toBe(30000); expect(s.verify).not.toHaveBeenCalled(); expect(s.db.quiz.updateMany).not.toHaveBeenCalled();
    s.job.leaseExpiresAt = null; s.job.attempts = 1;
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify, maxAttempts: 2 }).tick();
    expect(s.job.status).toBe('failed');
  });
  it('competing workers generate only once', async () => {
    const s = setup(); const options = { db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify };
    await Promise.all([createArchiveWorker(options).tick(), createArchiveWorker(options).tick()]);
    expect(s.generate).toHaveBeenCalledOnce();
  });
  it('refuses finalization after ownership loss', async () => {
    const s = setup(); s.verify.mockImplementation(async () => { s.job.leaseOwner = 'replacement'; return { artifactPath: '/backup', zipSha256: 'abc', sizeBytes: 5 } as any; });
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify }).tick();
    expect(s.job.status).toBe('files_generating'); expect(s.db.quiz.updateMany).not.toHaveBeenCalled();
  });
  it('backs off exponentially with a fixed upper bound', () => {
    expect([1, 2, 3, 30].map(retryDelay)).toEqual([30000, 60000, 120000, 3600000]);
  });
  it('resumes an expired verified job by rechecking files without regenerating them', async () => {
    const s = setup(); Object.assign(s.job, { status: 'verified', artifactPath: '/backup', zipSha256: 'abc', leaseOwner: 'dead', leaseExpiresAt: new Date(s.now.getTime() - 1) });
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify }).tick();
    expect(s.generate).not.toHaveBeenCalled(); expect(s.verify).toHaveBeenCalledOnce(); expect(s.job.status).toBe('completed');
  });
  it('does not claim an unexpired lease', async () => {
    const s = setup(); Object.assign(s.job, { leaseOwner: 'alive', leaseExpiresAt: new Date(s.now.getTime() + 10000) });
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify }).tick();
    expect(s.generate).not.toHaveBeenCalled(); expect(s.job.attempts).toBe(0);
  });
  it('annual finalization promotes the frozen set, retains teachers and completes last', async () => {
    const s = setup(); s.job.mode = 'annual';
    const events: string[] = [], initial = [{ id: 'student-a', role: 'student', isActive: true, classId: 'one', studentNo: 1 }, { id: 'student-b', role: 'student', isActive: true, classId: 'two', studentNo: 1 }];
    s.db.archiveSnapshotRow.findMany.mockResolvedValue(initial.map(u => ({ entityType: 'user', entityId: u.id, dataJson: JSON.stringify(u) })));
    s.db.user.findMany.mockImplementation(async ({ where }: any) => where?.role === 'admin' ? [] : [...initial, { id: 'teacher', role: 'teacher', isActive: true, classId: null, studentNo: null }]);
    const moved:Array<Record<string,unknown>>=[];
    s.db.user.updateMany = vi.fn(async ({where}:any) => { events.push('release-numbers'); return {count:where.id.in.length}; });
    const execute=s.db.$executeRawUnsafe;
    s.db.$executeRawUnsafe=vi.fn(async(sql:string,...values:any[])=>{
      if(sql.startsWith('WITH changes')&&sql.includes('INSERT INTO ArchiveFinalizationPermit'))return (values.length-5)/4;
      if(sql.startsWith('WITH changes')&&sql.includes('UPDATE "User"')){
        const count=(values.length-3)/4;
        for(let index=0;index<count;index++){
          const [id,classId,studentNo,graduate]=values.slice(index*4,index*4+4);events.push(id);
          moved.push({id,classId,classNo:null,studentNo,...(graduate?{isActive:false,graduationYear:values[values.length-2]}:{})});
        }
        return count;
      }
      if(sql.startsWith('INSERT INTO ArchiveFinalizationPermit')&&sql.includes('FROM "User"'))return values.length-4;
      return execute(sql,...values);
    });
    s.db.class = { findMany: vi.fn(async () => [{ id: 'one', maxStudents: 1 }, { id: 'two', maxStudents: 1 }]) };
    s.db.academicTransitionRule = { findMany: vi.fn(async () => [{ fromClassId: 'one', toClassId: 'two', graduate: false }, { fromClassId: 'two', toClassId: null, graduate: true }]) };
    s.db.academicYear.findUniqueOrThrow.mockResolvedValue({ id: 'year', label: s.job.label, status: 'active', scheduledCloseAt: s.now });
    s.db.academicYear.update = vi.fn(async () => { events.push('close-year'); });
    s.db.academicYear.create = vi.fn(async () => { events.push('open-year'); });
    const update = s.db.archiveSnapshot.updateMany;
    s.db.archiveSnapshot.updateMany = vi.fn(async (args: any) => { if (args.data.status === 'completed') events.push('complete'); return update(args); });
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify }).tick();
    expect(events).toEqual(['release-numbers', 'student-a', 'student-b', 'close-year', 'open-year', 'complete']);
    expect(moved.map(student=>student.id)).not.toContain('teacher');
    expect(moved[1]).toMatchObject({ classId: null, classNo: null, studentNo: null, isActive: false, graduationYear: '2025-2026' });
    expect(s.db.academicYear.create.mock.calls[0][0].data).toMatchObject({ label: '2026-2027', status: 'active', scheduledCloseAt: new Date('2027-07-14T21:05:00Z') });
    expect(s.db.academicYear.create.mock.calls[0][0].data.transitionRules).toEqual({ create: [{ fromClassId: 'one', toClassId: 'two', graduate: false }, { fromClassId: 'two', toClassId: null, graduate: true }] });
    expect(s.job.status).toBe('completed');
  });
  it('verification failure never marks a job verified or changes the live year', async () => {
    const s = setup(); s.verify.mockRejectedValue(new Error('checksum mismatch'));
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify }).tick();
    expect(s.job.status).toBe('retry_wait'); expect(s.job.artifactPath).toBeUndefined(); expect(s.db.academicYear.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  it('enqueues only at the persisted July boundary and deduplicates the annual label', async () => {
    const s = setup(); s.job.mode = 'annual';
    s.db.academicYear.findFirst.mockResolvedValue({ id: 'year', label: s.job.label, status: 'active', scheduledCloseAt: s.now });
    s.db.academicYear.findUnique = vi.fn(async () => ({ id: 'year', label: s.job.label, status: 'active', scheduledCloseAt: s.now }));
    s.db.archiveSnapshot.findUnique = vi.fn(async () => s.job);
    s.generate.mockRejectedValue(new Error('disk full'));
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => new Date(s.now.getTime() - 1), export: s.generate, verify: s.verify }).tick();
    expect(s.db.archiveSnapshot.findUnique).not.toHaveBeenCalled();
    s.job.leaseExpiresAt = null;
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify }).tick();
    expect(s.db.archiveSnapshot.findUnique).toHaveBeenCalledWith({ where: { annualKey: '2025-2026' } });
  });
  it('queues admin failures in the existing outbox without sending emails', async () => {
    const s = setup(); s.generate.mockRejectedValue(new Error('disk full'));
    s.db.user.findMany.mockResolvedValue([{ id: 'admin', email: 'admin@example.test' }]);
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify, maxAttempts: 1 }).tick();
    expect(s.db.actionLog.create.mock.calls[0][0].data.action).toBe('ARCHIVE_FAILED');
    expect(s.db.emailQueue.create.mock.calls[0][0].data).toMatchObject({ to: 'admin@example.test', type: 'system_alert' });
  });
  it('rejects a lease shorter than the SQLite transaction wait and timeout', () => {
    const s = setup();
    expect(() => createArchiveWorker({ db: s.db, backupRoot: '/backup', leaseMs: 149999 })).toThrow(/limits/);
  });
  it.each(['retry_wait', 'files_generating', 'failed'])('defers annual capture while a manual job is %s', async status => {
    const s = setup(); s.job.mode = 'annual'; s.job.status = 'queued';
    const capture = vi.fn(); s.db.archiveSnapshot.count.mockResolvedValue(1);
    s.db.archiveSnapshot.findFirst.mockImplementation(async ({ where }: any) => where.mode === 'manual' ? null : { ...s.job });
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, capture, export: s.generate, verify: s.verify }).tick();
    expect(capture).not.toHaveBeenCalled(); expect(s.job.attempts).toBe(0); expect(s.generate).not.toHaveBeenCalled();
    expect(s.db.archiveSnapshot.count).toHaveBeenCalledWith({ where: { academicYearId: 'year', mode: 'manual', status: { notIn: ['completed', 'cancelled'] } } });
  });
  it('keeps processing a runnable manual job while the annual candidate is blocked', async () => {
    const s = setup(); const annual = { ...s.job, id: 'annual', mode: 'annual' };
    s.db.archiveSnapshot.count.mockResolvedValue(1);
    s.db.archiveSnapshot.findFirst.mockImplementation(async ({ where }: any) => where.mode === 'manual' ? { ...s.job } : annual);
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify }).tick();
    expect(s.job.status).toBe('completed'); expect(s.generate).toHaveBeenCalledOnce();
  });
  it('rechecks manual fences inside finalization without spending a failure attempt', async () => {
    const s = setup(); s.job.mode = 'annual';
    s.db.archiveSnapshot.count.mockResolvedValueOnce(0).mockResolvedValue(1);
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify }).tick();
    expect(s.job.status).toBe('verified'); expect(s.job.attempts).toBe(0); expect(s.job.leaseOwner).toBeNull();
    expect(s.db.academicYear.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  it('refreshes the lease immediately before capture after slow claim preparation', async () => {
    const s = setup(); s.job.status = 'queued'; let clock = s.now;
    const capture = vi.fn(async () => { expect(s.job.leaseExpiresAt.getTime() - clock.getTime()).toBe(180000); s.job.status = 'files_generating'; return s.job; });
    const original = s.db.archiveSnapshot.findUniqueOrThrow;
    s.db.archiveSnapshot.findUniqueOrThrow = vi.fn(async (args: any) => { const result = await original(args); if (s.job.status === 'queued') clock = new Date(s.now.getTime() + 5000); return result; });
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => clock, capture, export: s.generate, verify: s.verify }).tick();
    expect(capture).toHaveBeenCalledOnce(); expect(s.job.status).toBe('completed');
  });
  it('rolls back year closure when creating next-year mapping copies fails', async () => {
    const s = setup(); s.job.mode = 'annual';
    s.db.archiveSnapshotRow.findMany.mockResolvedValue([]);
    s.db.class = { findMany: vi.fn(async () => [{ id: 'one', maxStudents: 30 }, { id: 'two', maxStudents: 30 }]) };
    s.db.academicTransitionRule = { findMany: vi.fn(async () => [{ id: 'old-rule', yearId: 'year', fromClassId: 'one', toClassId: 'two', graduate: false }]) };
    let liveYear = 'active';
    s.db.academicYear.findUniqueOrThrow.mockResolvedValue({ id: 'year', label: s.job.label, status: 'active', scheduledCloseAt: s.now });
    s.db.academicYear.update = vi.fn(async () => { liveYear = 'closed'; });
    s.db.academicYear.create = vi.fn(async ({ data }: any) => { if (data.transitionRules?.create.length) throw new Error('mapping copy failure'); });
    const transaction = s.db.$transaction;
    s.db.$transaction = async (fn: any) => { const before = liveYear; try { return await transaction(fn); } catch (error) { liveYear = before; throw error; } };
    await createArchiveWorker({ db: s.db, backupRoot: '/backup', now: () => s.now, export: s.generate, verify: s.verify }).tick();
    expect(liveYear).toBe('active'); expect(s.job.status).toBe('retry_wait'); expect(s.job.lastError).toBe('mapping copy failure');
    expect(s.db.academicYear.create.mock.calls[0][0].data.transitionRules.create).toEqual([{ fromClassId: 'one', toClassId: 'two', graduate: false }]);
  });
});
