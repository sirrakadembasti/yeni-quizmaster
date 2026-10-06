import { PrismaClient } from '@prisma/client';
import { MAX_SNAPSHOT_JSON_BYTES } from './archive-package';
import { buildStudentTransition } from './archive-transition';

/** Copies business records atomically. No filesystem or external work belongs in this transaction. */
export async function captureArchive(db: PrismaClient, snapshotId: string, lease?: { owner: string; now: () => Date }) {
  return db.$transaction(async tx => {
    const job = await tx.archiveSnapshot.findUniqueOrThrow({ where: { id: snapshotId }, include: { academicYear: true } });
    const assertLease = () => {
      if (lease && (job.leaseOwner !== lease.owner || !job.leaseExpiresAt || job.leaseExpiresAt <= lease.now())) throw new Error('Archive lease expired');
    };
    assertLease();
    const existing = await tx.archiveSnapshotRow.count({ where: { snapshotId } });
    if (job.capturedAt) return job;
    if (['files_generating', 'verified', 'completed'].includes(job.status) || (existing && ['retry_wait', 'failed'].includes(job.status))) return job;
    if (existing || !['queued', 'capturing', 'retry_wait'].includes(job.status)) throw new Error('Invalid capture state');
    if (job.academicYear.status !== 'active' || job.label !== job.academicYear.label) throw new Error('Academic year is not active');
    const scope = JSON.parse(job.scopeJson);
    let ids: string[] | undefined;
    if (job.mode === 'manual') {
      if (!Array.isArray(scope.quizIds) || !scope.quizIds.length || scope.quizIds.some((id: unknown) => typeof id !== 'string')) throw new Error('Select content explicitly');
      ids = [...new Set<string>(scope.quizIds)];
    } else if (job.mode !== 'annual') throw new Error('Invalid archive mode');
    const quizzes = await tx.quiz.findMany({ where: ids ? { id: { in: ids }, status: { not: 'archived' }, academicYear: null } : { OR: [{ academicYear: null, status: { not: 'archived' } }, { academicYear: job.label }] }, include: { assignedClasses: { select: { id: true } } }, orderBy: { id: 'asc' } });
    if (ids && quizzes.length !== ids.length) throw new Error('Selected content is missing or belongs to another archive');
    if (ids && await tx.archiveSnapshotRow.count({ where: { snapshotId: { not: snapshotId }, entityType: 'quiz', entityId: { in: ids } } })) throw new Error('Selected content is already frozen');
    const quizIds = quizzes.map(q => q.id);
    await tx.archiveSnapshot.update({ where: { id: snapshotId }, data: { status: 'capturing' } });
    const results = await tx.studentResult.findMany({ where: { quizId: { in: quizIds } }, orderBy: { id: 'asc' } });
    const submissions = await tx.surveySubmission.findMany({ where: { surveyId: { in: quizIds } }, orderBy: { id: 'asc' } });
    const participantIds = [...new Set([...quizzes.map(q => q.createdBy), ...results.map(r => r.studentId), ...submissions.map(s => s.studentId)])];
    const participantClasses = await tx.user.findMany({ where: { id: { in: participantIds } }, select: { classId: true } });
    const classIds = [...new Set([...quizzes.flatMap(q => q.assignedClasses.map(c => c.id)), ...participantClasses.map(u => u.classId).filter((id): id is string => !!id)])];
    const categoryIds = [...new Set(quizzes.map(q => q.categoryId).filter((id): id is string => !!id))];
    const assignments = await tx.classTeacherCourse.findMany({ where: ids ? { classId: { in: classIds } } : undefined, orderBy: { id: 'asc' } });
    const classes = await tx.class.findMany({ where: ids ? { id: { in: classIds } } : undefined, include: { teachers: { select: { id: true } }, assignedCategories: { select: { id: true } } }, orderBy: { id: 'asc' } });
    const categories = await tx.category.findMany({ where: ids ? { id: { in: [...new Set([...categoryIds, ...assignments.map(a => a.categoryId), ...classes.flatMap(c => c.assignedCategories.map(a => a.id))])] } } : undefined, include: { teachers: { select: { id: true } }, classes: { select: { id: true } } }, orderBy: { id: 'asc' } });
    const links = await tx.guardianStudent.findMany({ where: ids ? { studentId: { in: participantIds } } : undefined, orderBy: { id: 'asc' } });
    const relatedIds = [...new Set([...participantIds, ...assignments.map(a => a.teacherId), ...links.map(l => l.guardianId), ...classes.flatMap(c => [...c.teachers.map(t => t.id), ...(c.classTeacherId ? [c.classTeacherId] : [])]), ...categories.flatMap(c => c.teachers.map(t => t.id))])];
    const users = await tx.user.findMany({ where: ids ? { id: { in: relatedIds } } : undefined, select: {
      id: true, name: true, email: true, role: true, phoneNumber: true, address: true,
      studentNo: true, classNo: true, isActive: true, deactivatedAt: true,
      graduationYear: true, graduationDate: true, parentName: true, parentRelation: true,
      parentPhone: true, parentEmail: true, parentAddress: true, createdAt: true, classId: true,
      managedClasses: { select: { id: true } }, assignedCategories: { select: { id: true } },
    }, orderBy: { id: 'asc' } });
    const groups: Array<[string, Array<{ id: string } & Record<string, unknown>>]> = [
      ['user', users.map(({ managedClasses, assignedCategories, ...u }) => ({ ...u, managedClassIds: managedClasses.map(c => c.id), assignedCategoryIds: assignedCategories.map(c => c.id) }))],
      ['class', classes],
      ['category', categories.map(c => ({ ...c, classes: ids ? c.classes.filter(k => classIds.includes(k.id)) : c.classes }))],
      ['teacherAssignment', assignments],
      ['quiz', quizzes.map(({ assignedClasses, ...q }) => ({ ...q, assignedClassIds: assignedClasses.map(c => c.id) }))],
      ['question', await tx.question.findMany({ where: { quizId: { in: quizIds } }, orderBy: { id: 'asc' } })],
      ['result', results],
      ['surveySubmission', submissions],
      ['surveyAnswer', await tx.surveyAnswer.findMany({ where: { submission: { surveyId: { in: quizIds } } }, orderBy: { id: 'asc' } })],
      ['guardianLink', links],
      ['questionBank', ids ? [] : await tx.questionBank.findMany({ orderBy: { id: 'asc' } })],
      ['announcement', ids ? [] : await tx.announcement.findMany({ orderBy: { id: 'asc' } })],
    ];
    // Validate the exact users/classes being copied under this same writer
    // transaction. A late arrival or capacity change must never commit an
    // invalid capture fence that would prevent administrators repairing it.
    if (job.mode === 'annual') {
      const rules = await tx.academicTransitionRule.findMany({ where: { yearId: job.academicYearId } });
      buildStudentTransition(users, users, classes, rules);
    }
    if (groups.reduce((n, [, rows]) => n + rows.length, 0) > 250000) throw new Error('Snapshot exceeds record limit');
    const prepared = groups.flatMap(([entityType, rows]) => rows.map(row => ({ entityType, entityId: row.id, dataJson: JSON.stringify(row) })));
    if (prepared.reduce((bytes, row) => bytes + Buffer.byteLength(row.dataJson, 'utf8'), 0) > MAX_SNAPSHOT_JSON_BYTES) throw new Error('Snapshot exceeds byte limit');
    for (const row of prepared) await tx.archiveSnapshotRow.create({ data: { snapshotId, ...row } });
    assertLease();
    return tx.archiveSnapshot.update({ where: { id: snapshotId }, data: { status: 'files_generating', capturedAt: lease?.now() ?? new Date() } });
  }, { maxWait: 10000, timeout: 120000 });
}
