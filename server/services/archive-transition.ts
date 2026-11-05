import type { Prisma, PrismaClient } from '@prisma/client';

export type TransitionStudent = { id: string; role: string; isActive: boolean; classId: string | null; studentNo?: number | null; graduationYear?: string | null; graduationDate?: Date | string | null };
export type TransitionRule = { fromClassId: string; toClassId: string | null; graduate: boolean };
export type TransitionClass = { id: string; name?: string; maxStudents: number | null };
export type PlannedStudent = { id: string; classId: string | null; studentNo: number | null; graduate: boolean };
export interface TransitionSummary {
  promoted: number; graduated: number; skippedInactive: number; skippedGraduated: number; skippedClassless: number;
  transitions: { fromClassId: string; fromClassName: string; toClassId: string | null; toClassName: string | null; graduate: boolean; students: number }[];
}
export class TransitionPlanError extends Error {
  constructor(public code: string, message: string, public fromClassId?: string, public toClassId?: string) { super(message); }
}
const dateValue = (value: TransitionStudent['graduationDate']) => value == null ? null : value instanceof Date ? value.getTime() : new Date(value).getTime();
const formerGraduate = (student: TransitionStudent) => !!student.graduationYear || student.graduationDate != null;

/** Every destination is computed from the captured membership, including cycles. */
export function buildStudentTransition(frozen: TransitionStudent[], current: TransitionStudent[], classes: TransitionClass[], rules: TransitionRule[]) {
  const students = frozen.filter(student => student.role === 'student');
  const initial = students.filter(student => student.isActive && !formerGraduate(student) && student.classId !== null).sort((a, b) => a.id.localeCompare(b.id));
  const live = new Map(current.map(student => [student.id, student])), classMap = new Map(classes.map(classroom => [classroom.id, classroom]));
  const ruleMap = new Map(rules.map(rule => [rule.fromClassId, rule]));
  if (ruleMap.size !== rules.length) throw new TransitionPlanError('invalid_mapping', 'Duplicate transition mapping');
  for (const rule of rules) {
    if (!classMap.has(rule.fromClassId) || rule.fromClassId === rule.toClassId || (rule.graduate ? rule.toClassId !== null : !rule.toClassId || !classMap.has(rule.toClassId))) throw new TransitionPlanError('invalid_mapping', 'Invalid transition mapping', rule.fromClassId, rule.toClassId ?? undefined);
  }
  for (const student of students) {
    const actual = live.get(student.id);
    if (!actual || actual.role !== 'student' || actual.isActive !== student.isActive || actual.classId !== student.classId || (actual.studentNo ?? null) !== (student.studentNo ?? null) || (actual.graduationYear ?? null) !== (student.graduationYear ?? null) || dateValue(actual.graduationDate) !== dateValue(student.graduationDate)) throw new TransitionPlanError('membership_changed', 'Frozen student membership changed', student.classId ?? undefined);
  }
  // The database unique index includes inactive accounts and non-students too.
  const existingNumbers = new Map<string, Set<number>>();
  for (const student of current.filter(student => student.classId !== null && student.studentNo != null)) {
    const reserved = existingNumbers.get(student.classId!) ?? new Set<number>();
    if (!Number.isSafeInteger(student.studentNo) || student.studentNo! < 1 || student.studentNo! > 2147483647 || reserved.has(student.studentNo!)) throw new TransitionPlanError('student_number_invalid', 'Invalid or colliding student number', student.classId!);
    reserved.add(student.studentNo!); existingNumbers.set(student.classId!, reserved);
  }
  const moving = new Set(initial.map(student => student.id)), counts = new Map<string, number>(), numbers = new Map<string, Set<number>>();
  for (const student of current.filter(student => !moving.has(student.id) && student.classId !== null)) {
    if (student.role === 'student' && student.isActive) counts.set(student.classId!, (counts.get(student.classId!) ?? 0) + 1);
    if (student.studentNo != null) { const reserved = numbers.get(student.classId!) ?? new Set<number>(); reserved.add(student.studentNo); numbers.set(student.classId!, reserved); }
  }
  const summary: TransitionSummary = { promoted: 0, graduated: 0, skippedInactive: 0, skippedGraduated: 0, skippedClassless: 0, transitions: [] };
  for (const student of students) {
    if (formerGraduate(student)) summary.skippedGraduated++;
    else if (!student.isActive) summary.skippedInactive++;
    else if (student.classId === null) summary.skippedClassless++;
  }
  const destinations = new Map<string, TransitionSummary['transitions'][number]>();
  const plan: PlannedStudent[] = initial.map(student => {
    const rule = ruleMap.get(student.classId!);
    if (!rule) throw new TransitionPlanError('missing_mapping', 'Missing transition mapping', student.classId!);
    const item = destinations.get(rule.fromClassId) ?? { fromClassId: rule.fromClassId, fromClassName: classMap.get(rule.fromClassId)?.name ?? rule.fromClassId, toClassId: rule.toClassId, toClassName: rule.toClassId ? classMap.get(rule.toClassId)?.name ?? rule.toClassId : null, graduate: rule.graduate, students: 0 };
    item.students++; destinations.set(rule.fromClassId, item);
    if (rule.graduate) { summary.graduated++; return { id: student.id, classId: null, studentNo: null, graduate: true }; }
    const destination = rule.toClassId!, count = (counts.get(destination) ?? 0) + 1, capacity = classMap.get(destination)!.maxStudents;
    if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < count)) throw new TransitionPlanError('capacity_exceeded', 'Target class capacity exceeded', student.classId!, destination);
    counts.set(destination, count);
    const reserved = numbers.get(destination) ?? new Set<number>();
    let number = 1;
    while (reserved.has(number) && number <= 2147483647) number++;
    if (number > 2147483647) throw new TransitionPlanError('student_number_invalid', 'Student number range exhausted', student.classId!, destination);
    reserved.add(number); numbers.set(destination, reserved); summary.promoted++;
    return { id: student.id, classId: destination, studentNo: number, graduate: false };
  });
  summary.transitions = [...destinations.values()].sort((a, b) => a.fromClassId.localeCompare(b.fromClassId));
  return { students: plan, summary };
}
export const planStudentTransition = (frozen: TransitionStudent[], current: TransitionStudent[], classes: TransitionClass[], rules: TransitionRule[]) => buildStudentTransition(frozen, current, classes, rules).students;

type TransitionDatabase = Pick<PrismaClient | Prisma.TransactionClient, 'user' | 'class' | 'academicTransitionRule'>;
/** Used by read-only preview, preflight and the final database transaction. */
export async function readTransitionPlan(db: TransitionDatabase, yearId: string, frozen?: TransitionStudent[]) {
  const [current, classes, rules] = await Promise.all([
    db.user.findMany({ select: { id: true, role: true, isActive: true, classId: true, studentNo: true, graduationYear: true, graduationDate: true } }),
    db.class.findMany({ select: { id: true, name: true, maxStudents: true } }),
    db.academicTransitionRule.findMany({ where: { yearId } }),
  ]);
  return { ...buildStudentTransition(frozen ?? current, current, classes, rules), rules };
}
export function transitionIssue(error: TransitionPlanError) {
  const messages: Record<string, string> = { missing_mapping: 'Aktif öğrencisi bulunan kaynak sınıfın geçiş hedefi eksik.', invalid_mapping: 'Sınıf geçiş hedefi geçersiz veya yineleniyor.', membership_changed: 'Arşivdeki öğrenci üyeliği değişti; geçiş durduruldu.', capacity_exceeded: 'Hedef sınıfın aktif öğrenci kapasitesi aşılıyor.', student_number_invalid: 'Sınıf öğrenci numaraları geçersiz veya çakışıyor.' };
  return { code: error.code, message: messages[error.code] ?? 'Sınıf geçişi doğrulanamadı.', fromClassId: error.fromClassId, toClassId: error.toClassId };
}
