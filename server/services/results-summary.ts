import type { Prisma, PrismaClient } from '@prisma/client';

export interface ResultsSummaryFilters {
  quizId?: string;
  categoryId?: string;
  classId?: string;
  studentId?: string;
  createdBy?: string;
}

export interface ResultsSummaryPaging {
  limit?: number;
  cursor?: string;
}

export const RESULTS_SUMMARY_PAGE_SIZE = 500;

const summarySelect = {
  id: true, quizId: true, studentId: true, status: true, score: true,
  correctAnswersCount: true, totalQuestions: true, timeTaken: true,
  startedAt: true, submittedAt: true, completedAt: true,
  student: { select: {
    id: true, name: true, classId: true, studentNo: true,
    class: { select: { id: true, name: true } },
  } },
  quiz: { select: {
    id: true, title: true, categoryId: true, createdBy: true,
    category: { select: { id: true, name: true } },
    creator: { select: { id: true, name: true } },
  } },
} satisfies Prisma.StudentResultSelect;

export type ResultSummary = Prisma.StudentResultGetPayload<{ select: typeof summarySelect }>;

export interface ResultsSummaryPage {
  results: ResultSummary[];
  nextCursor: string | null;
}

/** Small bounded pages; immutable IDs make progress independent of submittedAt changes. */
export async function getResultsSummary(db: Pick<PrismaClient, 'studentResult'>, filters: ResultsSummaryFilters, paging: ResultsSummaryPaging = {}): Promise<ResultsSummaryPage> {
  const limit = paging.limit ?? RESULTS_SUMMARY_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > RESULTS_SUMMARY_PAGE_SIZE ||
      (paging.cursor !== undefined && (typeof paging.cursor !== 'string' || !paging.cursor.length || paging.cursor.length > 128))) {
    throw new Error('Invalid result summary pagination');
  }
  const where: Prisma.StudentResultWhereInput = {
    academicYear: null,
    ...(paging.cursor ? { id: { lt: paging.cursor } } : {}),
    ...(filters.quizId ? { quizId: filters.quizId } : {}),
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.classId ? { student: { classId: filters.classId } } : {}),
    quiz: {
      academicYear: null, status: { not: 'archived' }, contentType: 'exam',
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.createdBy ? { createdBy: filters.createdBy } : {}),
    },
  };
  const rows = await db.studentResult.findMany({ where, select: summarySelect, orderBy: { id: 'desc' }, take: limit + 1 });
  const results = rows.slice(0, limit);
  return { results, nextCursor: rows.length > limit ? results[results.length - 1].id : null };
}
