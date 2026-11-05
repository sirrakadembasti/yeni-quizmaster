import type { Prisma, PrismaClient } from '@prisma/client';

export interface DashboardStats {
  totalQuizzes: number;
  totalStudents: number;
  totalTeachers?: number;
  totalResults: number;
  averageStudentScore: number;
}

type DashboardDatabase = Pick<PrismaClient, 'class' | 'user' | 'quiz' | 'studentResult'>;
const activeQuizWhere = { academicYear: null, status: { not: 'archived' } } satisfies Prisma.QuizWhereInput;

/** Keep dashboard reads bounded without loading users, questions or result answers. */
export async function getDashboardStats(db: DashboardDatabase, role: string, userId: string): Promise<DashboardStats> {
  if (role === 'admin') {
    const [totalQuizzes, totalStudents, totalTeachers, results] = await Promise.all([
      db.quiz.count({ where: activeQuizWhere }),
      db.user.count({ where: { role: 'student', isActive: true } }),
      // getAllUsers includes inactive non-students.
      db.user.count({ where: { role: 'teacher' } }),
      db.studentResult.aggregate({
        where: { status: 'completed', score: { not: null }, academicYear: null, quiz: { ...activeQuizWhere, contentType: 'exam' } },
        _count: { id: true },
        _avg: { score: true },
      }),
    ]);
    return { totalQuizzes, totalStudents, totalTeachers, totalResults: results._count.id, averageStudentScore: Math.round(results._avg.score ?? 0) };
  }

  const classes = await db.class.findMany({
    where: {
      OR: [
        { teachers: { some: { id: userId } } },
        { classTeacherId: userId },
        { teacherAssignments: { some: { teacherId: userId } } },
      ],
    },
    select: { id: true },
  });
  const quizWhere = { ...activeQuizWhere, createdBy: userId } satisfies Prisma.QuizWhereInput;
  // Teacher stats count every current attempt, including previews and surveys;
  // only the average is restricted to completed, non-null scores.
  const resultWhere = { academicYear: null, quiz: quizWhere } satisfies Prisma.StudentResultWhereInput;
  const [totalStudents, totalQuizzes, totalResults, scores] = await Promise.all([
    db.user.count({ where: { role: 'student', isActive: true, classId: { in: classes.map(({ id }) => id) } } }),
    db.quiz.count({ where: quizWhere }),
    db.studentResult.count({ where: resultWhere }),
    db.studentResult.aggregate({ where: { ...resultWhere, status: 'completed', score: { not: null } }, _avg: { score: true } }),
  ]);
  return { totalQuizzes, totalStudents, totalResults, averageStudentScore: Math.round(scores._avg.score ?? 0) };
}
