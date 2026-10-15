import { describe, expect, it } from 'vitest';
import { getDashboardStats } from '../../services/dashboard-stats';

// Only the database boundary is replaced: evaluate actual service predicates on
// adversarial rows rather than returning prearranged aggregate responses.
function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([key, condition]: [string, any]) => {
    if (key === 'OR') return condition.some((part: any) => matches(row, part));
    if (key === 'AND') return condition.every((part: any) => matches(row, part));
    const value = row[key];
    if (condition === null || typeof condition !== 'object') return value === condition;
    if ('not' in condition) return value !== condition.not;
    if ('in' in condition) return condition.in.includes(value);
    if ('some' in condition) return value.some((item: any) => matches(item, condition.some));
    if ('is' in condition) return matches(value, condition.is);
    return matches(value, condition);
  });
}

function fixture() {
  const classes = [
    { id: 'legacy', classTeacherId: null, teachers: [{ id: 't' }], teacherAssignments: [] },
    { id: 'primary', classTeacherId: 't', teachers: [], teacherAssignments: [] },
    { id: 'course', classTeacherId: null, teachers: [], teacherAssignments: [{ teacherId: 't' }] },
    { id: 'other', classTeacherId: 'other', teachers: [], teacherAssignments: [] },
  ];
  const users = [
    ...classes.map(c => ({ id: `s-${c.id}`, role: 'student', isActive: true, classId: c.id })),
    { id: 'inactive', role: 'student', isActive: false, classId: 'legacy' },
    { id: 'unassigned', role: 'student', isActive: true, classId: null },
    { id: 't', role: 'teacher', isActive: true, classId: 'legacy' },
    { id: 'other', role: 'teacher', isActive: false, classId: null },
    { id: 'admin', role: 'admin', isActive: true, classId: null },
  ];
  const quizzes = [
    { id: 'exam', createdBy: 't', status: 'published', academicYear: null, contentType: 'exam' },
    { id: 'draft', createdBy: 't', status: 'draft', academicYear: null, contentType: 'exam' },
    { id: 'survey', createdBy: 't', status: 'published', academicYear: null, contentType: 'survey' },
    { id: 'archived', createdBy: 't', status: 'archived', academicYear: null, contentType: 'exam' },
    { id: 'year', createdBy: 't', status: 'published', academicYear: '2025', contentType: 'exam' },
    { id: 'foreign', createdBy: 'other', status: 'published', academicYear: null, contentType: 'exam' },
  ];
  const result = (quizId: string, score: number | null, status = 'completed', academicYear: string | null = null, studentId = 's-legacy') => ({
    quizId, score, status, academicYear, studentId, quiz: quizzes.find(q => q.id === quizId), student: users.find(u => u.id === studentId),
  });
  const results = [
    result('exam', 0), result('exam', 100), result('draft', 60, 'completed', null, 't'),
    result('survey', 80), result('exam', null), result('exam', 90, 'in_progress'),
    result('exam', 90, 'abandoned'), result('exam', 100, 'completed', '2025'),
    result('archived', 100), result('year', 100), result('foreign', 20),
  ];
  const calls: string[] = [];
  const count = (name: string, rows: any[]) => async ({ where }: any) => {
    calls.push(`${name}.count`);
    return rows.filter(row => matches(row, where)).length;
  };
  const db = {
    class: { findMany: async ({ where, select }: any) => {
      calls.push('class.findMany');
      expect(select).toEqual({ id: true });
      return classes.filter(row => matches(row, where)).map(({ id }) => ({ id }));
    } },
    user: { count: count('user', users) },
    quiz: { count: count('quiz', quizzes) },
    studentResult: {
      count: count('studentResult', results),
      aggregate: async ({ where }: any) => {
        calls.push('studentResult.aggregate');
        const selected = results.filter(row => matches(row, where));
        const scored = selected.filter(row => row.score !== null);
        return { _count: { id: selected.length }, _avg: { score: scored.length ? scored.reduce((sum, r) => sum + r.score!, 0) / scored.length : null } };
      },
    },
  };
  return { db, calls, classes, quizzes, results, users };
}

async function stats(db: any, role: string, id: string) {
  return getDashboardStats(db, role, id);
}

describe('dashboard statistics without result/user materialization', () => {
  it('preserves teacher scope across all three class relationships, surveys and previews', async () => {
    const { db, calls } = fixture();
    expect(await stats(db, 'teacher', 't')).toEqual({ totalQuizzes: 3, totalStudents: 3, totalResults: 7, averageStudentScore: 60 });
    expect(calls.length).toBeLessThanOrEqual(5);
  });

  it('preserves admin current exam aggregates and includes inactive teachers', async () => {
    const { db, calls } = fixture();
    expect(await stats(db, 'admin', 'admin')).toEqual({ totalQuizzes: 4, totalStudents: 5, totalTeachers: 2, totalResults: 4, averageStudentScore: 45 });
    expect(calls.length).toBeLessThanOrEqual(4);
  });

  it('does not borrow another teacher classes or quizzes when the teacher has none', async () => {
    const { db } = fixture();
    expect(await stats(db, 'teacher', 'missing')).toEqual({ totalQuizzes: 0, totalStudents: 0, totalResults: 0, averageStudentScore: 0 });
  });

  it('returns zero mean when all current results are incomplete or null scored', async () => {
    const { db, results } = fixture();
    results.forEach(row => { if (row.status === 'completed') row.score = null; });
    expect(await stats(db, 'teacher', 't')).toEqual({ totalQuizzes: 3, totalStudents: 3, totalResults: 7, averageStudentScore: 0 });
    expect(await stats(db, 'admin', 'admin')).toEqual({ totalQuizzes: 4, totalStudents: 5, totalTeachers: 2, totalResults: 0, averageStudentScore: 0 });
  });

  it('rounds fractional averages and keeps counts bounded as result volume grows', async () => {
    const { db, results, calls } = fixture();
    const template = results[0];
    results.splice(0, results.length, ...Array.from({ length: 1000 }, (_, index) => ({ ...template, score: index % 2 ? 75 : 76 })));
    expect(await stats(db, 'teacher', 't')).toEqual({ totalQuizzes: 3, totalStudents: 3, totalResults: 1000, averageStudentScore: 76 });
    expect(calls.length).toBeLessThanOrEqual(5);
  });
});
