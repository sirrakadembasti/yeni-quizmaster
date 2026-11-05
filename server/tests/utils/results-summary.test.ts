import { expect, it } from 'vitest';
import { getResultsSummary } from '../../services/results-summary';

function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([key, value]: [string, any]) => {
    if (value === null || typeof value !== 'object') return row[key] === value;
    if ('not' in value) return row[key] !== value.not;
    if ('lt' in value) return row[key] < value.lt;
    return matches(row[key], value);
  });
}
function project(row: any, select: any): any {
  return Object.fromEntries(Object.entries(select).map(([key, value]: [string, any]) => [key,
    value === true ? row[key] : row[key] == null ? null : project(row[key], value.select),
  ]));
}
function fixture() {
  const base = {
    id: 'r', quizId: 'q', studentId: 's', status: 'completed', score: 0, academicYear: null,
    correctAnswersCount: 0, totalQuestions: 20, timeTaken: 1800,
    startedAt: new Date('2026-10-01'), submittedAt: new Date('2026-10-02'), completedAt: new Date('2026-10-02'),
    answers: 'x'.repeat(50000),
    student: { id: 's', name: 'Student', classId: 'c', studentNo: '10', class: { id: 'c', name: 'Class' }, password: 'secret' },
    quiz: { id: 'q', title: 'Exam', categoryId: 'cat', createdBy: 'teacher', status: 'published', contentType: 'exam', academicYear: null,
      description: 'x'.repeat(50000), category: { id: 'cat', name: 'Math', description: 'large' }, creator: { id: 'teacher', name: 'Teacher' } },
  };
  const rows = [
    base,
    { ...base, id: 'foreign', quiz: { ...base.quiz, createdBy: 'other' } },
    { ...base, id: 'survey', quiz: { ...base.quiz, contentType: 'survey' } },
    { ...base, id: 'archived', quiz: { ...base.quiz, status: 'archived' } },
    { ...base, id: 'year-quiz', quiz: { ...base.quiz, academicYear: '2025' } },
    { ...base, id: 'year-result', academicYear: '2025' },
    { ...base, id: 'incomplete', status: 'in_progress', score: null },
    { ...base, id: 'different-class', student: { ...base.student, classId: 'other' } },
    { ...base, id: 'different-quiz', quizId: 'other-q', quiz: { ...base.quiz, id: 'other-q' } },
    { ...base, id: 'different-category', quiz: { ...base.quiz, categoryId: 'other-cat' } },
    { ...base, id: 'different-student', studentId: 'other-s', student: { ...base.student, id: 'other-s' } },
  ];
  let calls = 0;
  const db = { studentResult: { findMany: async (query: any) => {
    calls++;
    expect(query.take).toBeGreaterThan(1);
    expect(query.take).toBeLessThanOrEqual(501);
    expect(query.include).toBeUndefined();
    expect(query.orderBy).toEqual({ id: 'desc' });
    return rows.filter(row => matches(row, query.where)).sort((a, b) => a.id < b.id ? 1 : -1)
      .slice(0, query.take).map(row => project(row, query.select));
  } } };
  return { db, rows, calls: () => calls };
}
async function summary(db: any, filters: any, paging?: any) {
  return (getResultsSummary as any)(db, filters, paging);
}

it('preserves reporting filters and zero/null/incomplete attempts without heavy answer or quiz fields', async () => {
  const { db, calls } = fixture();
  const page = await summary(db, { createdBy: 'teacher', classId: 'c', categoryId: 'cat', quizId: 'q', studentId: 's' });
  const rows = page.results;
  expect(page.nextCursor).toBeNull();
  expect(rows.map((r: any) => r.id)).toEqual(['r', 'incomplete']);
  expect(rows[0]).toMatchObject({ score: 0, correctAnswersCount: 0, totalQuestions: 20, timeTaken: 1800,
    student: { name: 'Student', classId: 'c', studentNo: '10', class: { name: 'Class' } },
    quiz: { title: 'Exam', createdBy: 'teacher', categoryId: 'cat', category: { name: 'Math' } } });
  expect(rows[1]).toMatchObject({ status: 'in_progress', score: null });
  expect(rows[0].submittedAt).toEqual(new Date('2026-10-02'));
  expect(rows[0].answers).toBeUndefined();
  expect(rows[0].quiz.description).toBeUndefined();
  expect(rows[0].quiz.category.description).toBeUndefined();
  expect(rows[0].student.password).toBeUndefined();
  expect(calls()).toBe(1);
});

it('allows admins all creators but still excludes archived/year/survey records', async () => {
  const { db } = fixture();
  expect((await summary(db, {})).results.map((r: any) => r.id)).toEqual(['r', 'incomplete', 'foreign', 'different-student', 'different-quiz', 'different-class', 'different-category']);
});

it('keeps every summary row for full metrics, exports and print beyond one hundred results', async () => {
  const { db, rows, calls } = fixture();
  const base = rows[0];
  rows.splice(0, rows.length, ...Array.from({ length: 200 }, (_, index) => ({ ...base, id: `r${index}` })));
  const { results, nextCursor } = await summary(db, { createdBy: 'teacher' });
  expect(nextCursor).toBeNull();
  expect(results).toHaveLength(200);
  expect(new Set(results.map((row: any) => row.id)).size).toBe(200);
  expect(JSON.stringify(results).length).toBeLessThan(JSON.stringify(rows).length / 20);
  expect(calls()).toBe(1);
});

it('bounds reads and advances a stable cursor without dropping filtered results', async () => {
  const { db } = fixture();
  const first = await summary(db, {}, { limit: 2 });
  expect(first.results.map((row: any) => row.id)).toEqual(['r', 'incomplete']);
  expect(first.nextCursor).toBe('incomplete');
  const second = await summary(db, {}, { limit: 2, cursor: first.nextCursor });
  expect(second.results.map((row: any) => row.id)).toEqual(['foreign', 'different-student']);
  expect(second.nextCursor).toBe('different-student');
  const third = await summary(db, {}, { limit: 2, cursor: second.nextCursor });
  expect(third.results.map((row: any) => row.id)).toEqual(['different-quiz', 'different-class']);
  const last = await summary(db, {}, { limit: 2, cursor: third.nextCursor });
  expect(last.results.map((row: any) => row.id)).toEqual(['different-category']);
  expect(last.nextCursor).toBeNull();
});

it.each([0, -1, 501, 1.5, NaN])('rejects invalid page size %s at the service boundary', async limit => {
  const { db } = fixture();
  await expect(summary(db, {}, { limit })).rejects.toThrow('Invalid result summary pagination');
});

it('returns a terminal empty page when the filter has no matches', async () => {
  const { db } = fixture();
  expect(await summary(db, { createdBy: 'missing' })).toEqual({ results: [], nextCursor: null });
});

it.each(['', 'x'.repeat(129), 123])('rejects malformed cursors at the service boundary', async cursor => {
  const { db, calls } = fixture();
  await expect(summary(db, {}, { cursor })).rejects.toThrow('Invalid result summary pagination');
  expect(calls()).toBe(0);
});
