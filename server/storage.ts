import { PrismaClient } from '@prisma/client';
import { 
  type User, 
  type InsertUser,
  type Quiz,
  type InsertQuiz,
  type Question,
  type InsertQuestion,
  type StudentResult,
  type InsertStudentResult,
  type Category,
  type InsertCategory,
  type Class,
  type InsertClass,
  type ActionLog
} from "./schema";

const prisma = new PrismaClient();

export interface IStorage {
  // Category methods
  getAllCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;

  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  updateUserRole(userId: string, role: string): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Class methods
  getAllClasses(): Promise<Class[]>;
  getClass(id: string): Promise<Class | undefined>;
  createClass(cls: InsertClass): Promise<Class>;
  getClassesByTeacher(teacherId: string): Promise<Class[]>;
  assignStudentToClass(studentId: string, classId: string): Promise<void>;
  removeStudentFromClass(studentId: string): Promise<void>;
  getStudentsByClass(classId: string): Promise<User[]>;
  assignCategoryToClass(classId: string, categoryId: string): Promise<void>;
  removeCategoryFromClass(classId: string, categoryId: string): Promise<void>;
  assignCategoryToTeacher(teacherId: string, categoryId: string): Promise<void>;
  removeCategoryFromTeacher(teacherId: string, categoryId: string): Promise<void>;

  // Quiz methods
  getAllQuizzes(): Promise<Quiz[]>;
  getQuiz(id: string): Promise<Quiz | undefined>;
  getQuizzesByCreator(teacherId: string): Promise<Quiz[]>;
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  updateQuiz(id: string, quiz: Partial<InsertQuiz>): Promise<Quiz | undefined>;
  deleteQuiz(id: string): Promise<void>;

  // Question methods
  getQuestionsByQuiz(quizId: string): Promise<Question[]>;
  getQuestion(id: string): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  createQuestions(questions: InsertQuestion[]): Promise<Question[]>;
  deleteQuestion(id: string): Promise<void>;
  deleteQuestionsByQuiz(quizId: string): Promise<void>;
  
  // Student Result methods
  getResultsByStudent(studentId: string, teacherId?: string): Promise<StudentResult[]>;
  getResultsByQuiz(quizId: string): Promise<StudentResult[]>;
  getLiveResults(quizId: string): Promise<StudentResult[]>;
  getStudentQuizResult(studentId: string, quizId: string): Promise<StudentResult | undefined>;
  createResult(result: InsertStudentResult): Promise<StudentResult>;
  updateResult(id: string, result: Partial<InsertStudentResult>): Promise<void>;
  getResult(id: string): Promise<StudentResult | undefined>;
  getQuizStats(quizId: string): Promise<{
    totalParticipants: number;
    averageScore: number;
    highScorers: number;
  }>;

  // Log methods
  createLog(userId: string, action: string, details?: string): Promise<ActionLog>;
  getLogs(): Promise<ActionLog[]>;
}

export class PrismaStorage implements IStorage {
  // Category methods
  async getAllCategories(): Promise<Category[]> {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
    return categories.map(c => ({ ...c, createdAt: c.createdAt.toISOString() }));
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const category = await prisma.category.findUnique({ where: { id } });
    return category ? { ...category, createdAt: category.createdAt.toISOString() } : undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const created = await prisma.category.create({
      data: { name: category.name, description: category.description }
    });
    return { ...created, createdAt: created.createdAt.toISOString() };
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const updated = await prisma.category.update({
      where: { id },
      data: { name: category.name, description: category.description }
    });
    return { ...updated, createdAt: updated.createdAt.toISOString() };
  }

  async deleteCategory(id: string): Promise<void> {
    await prisma.category.delete({ where: { id } });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({ 
      where: { id },
      include: { class: true, assignedCategories: true }
    });
    return user ? { ...user, createdAt: user.createdAt.toISOString() } as User : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { class: true, assignedCategories: true }
    });
    return user ? { ...user, createdAt: user.createdAt.toISOString() } as User : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const created = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role || 'student',
        classId: user.classId,
        classNo: user.classNo
      }
    });
    return { ...created, createdAt: created.createdAt.toISOString() } as User;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const { id: _, createdAt: __, ...updateData } = data;
    const updated = await prisma.user.update({
      where: { id },
      data: updateData as any
    });
    return { ...updated, createdAt: updated.createdAt.toISOString() } as User;
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { role } });
  }

  async getAllUsers(): Promise<User[]> {
    const users = await prisma.user.findMany({
      include: { class: true, assignedCategories: true }
    });
    return users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })) as User[];
  }

  // Class methods
  async getAllClasses(): Promise<Class[]> {
    const classes = await prisma.class.findMany({ 
      include: { teachers: true, assignedCategories: true },
      orderBy: { createdAt: 'desc' } 
    });
    return classes.map(c => ({ 
      ...c, 
      createdAt: c.createdAt.toISOString(),
      teachers: c.teachers.map(t => ({ ...t, createdAt: t.createdAt.toISOString() }))
    })) as Class[];
  }

  async getClass(id: string): Promise<Class | undefined> {
    const cls = await prisma.class.findUnique({ 
      where: { id },
      include: { teachers: true, assignedCategories: true }
    });
    return cls ? { 
      ...cls, 
      createdAt: cls.createdAt.toISOString(),
      teachers: cls.teachers.map(t => ({ ...t, createdAt: t.createdAt.toISOString() }))
    } as Class : undefined;
  }

  async createClass(cls: InsertClass): Promise<Class> {
    const created = await prisma.class.create({
      data: {
        name: cls.name,
        description: cls.description,
        maxStudents: cls.maxStudents,
        teachers: { connect: { id: cls.teacherId } }
      },
      include: { teachers: true, assignedCategories: true }
    });
    return { 
      ...created, 
      createdAt: created.createdAt.toISOString(),
      teachers: created.teachers.map(t => ({ ...t, createdAt: t.createdAt.toISOString() }))
    } as Class;
  }

  async getClassesByTeacher(teacherId: string): Promise<Class[]> {
    const classes = await prisma.class.findMany({
      where: { teachers: { some: { id: teacherId } } },
      include: { teachers: true, assignedCategories: true }
    });
    return classes.map(c => ({ 
      ...c, 
      createdAt: c.createdAt.toISOString(),
      teachers: c.teachers.map(t => ({ ...t, createdAt: t.createdAt.toISOString() }))
    })) as Class[];
  }

  async assignStudentToClass(studentId: string, classId: string): Promise<void> {
    await prisma.user.update({ where: { id: studentId }, data: { classId } });
  }

  async removeStudentFromClass(studentId: string): Promise<void> {
    await prisma.user.update({ where: { id: studentId }, data: { classId: null } });
  }

  async getStudentsByClass(classId: string): Promise<User[]> {
    const users = await prisma.user.findMany({ where: { classId } });
    return users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })) as User[];
  }

  async assignCategoryToClass(classId: string, categoryId: string): Promise<void> {
    await prisma.class.update({
      where: { id: classId },
      data: { assignedCategories: { connect: { id: categoryId } } }
    });
  }

  async removeCategoryFromClass(classId: string, categoryId: string): Promise<void> {
    await prisma.class.update({
      where: { id: classId },
      data: { assignedCategories: { disconnect: { id: categoryId } } }
    });
  }

  async assignCategoryToTeacher(teacherId: string, categoryId: string): Promise<void> {
    await prisma.user.update({
      where: { id: teacherId },
      data: { assignedCategories: { connect: { id: categoryId } } }
    });
  }

  async removeCategoryFromTeacher(teacherId: string, categoryId: string): Promise<void> {
    await prisma.user.update({
      where: { id: teacherId },
      data: { assignedCategories: { disconnect: { id: categoryId } } }
    });
  }

  // Quiz methods
  async getAllQuizzes(): Promise<Quiz[]> {
    const quizzes = await prisma.quiz.findMany({
      include: {
        _count: {
          select: { questions: true }
        },
        results: {
          include: { student: true }
        },
        category: true,
        assignedClasses: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return quizzes.map(q => ({ 
      ...q, 
      category: q.category?.name || 'General',
      questionCount: q._count.questions,
      participantCount: q.results.filter(r => r.student.role === 'student').length,
      createdAt: q.createdAt.toISOString() 
    })) as any[];
  }

  async getQuiz(id: string): Promise<Quiz | undefined> {
    const quiz = await prisma.quiz.findUnique({ 
      where: { id },
      include: { category: true, assignedClasses: true }
    });
    return quiz ? { 
      ...quiz, 
      category: quiz.category?.name || 'General',
      createdAt: quiz.createdAt.toISOString() 
    } as Quiz : undefined;
  }

  async getQuizzesByCreator(teacherId: string): Promise<Quiz[]> {
    const quizzes = await prisma.quiz.findMany({
      where: { createdBy: teacherId },
      include: {
        _count: {
          select: { questions: true }
        },
        results: {
          include: { student: true }
        },
        category: true,
        assignedClasses: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return quizzes.map(q => ({ 
      ...q, 
      category: q.category?.name || 'General',
      questionCount: q._count.questions,
      participantCount: q.results.filter(r => r.student.role === 'student').length,
      createdAt: q.createdAt.toISOString() 
    })) as any[];
  }

  async createQuiz(quiz: InsertQuiz & { assignedClassIds?: string[] }): Promise<Quiz> {
    const created = await prisma.quiz.create({
      data: {
        title: quiz.title,
        description: quiz.description,
        categoryId: quiz.categoryId || null,
        difficulty: quiz.difficulty || 'medium',
        timeLimit: quiz.timeLimit,
        shuffleQuestions: quiz.shuffleQuestions || false,
        status: quiz.status || 'draft',
        createdBy: quiz.createdBy,
        assignedClasses: quiz.assignedClassIds ? {
          connect: quiz.assignedClassIds.map(id => ({ id }))
        } : undefined
      },
      include: { assignedClasses: true }
    });
    return { 
      ...created, 
      category: quiz.category || 'General',
      createdAt: created.createdAt.toISOString() 
    } as Quiz;
  }

  async updateQuiz(id: string, quiz: Partial<InsertQuiz> & { assignedClassIds?: string[] }): Promise<Quiz | undefined> {
    const updated = await prisma.quiz.update({
      where: { id },
      data: {
        title: quiz.title,
        description: quiz.description,
        categoryId: quiz.categoryId,
        difficulty: quiz.difficulty,
        timeLimit: quiz.timeLimit,
        shuffleQuestions: quiz.shuffleQuestions,
        status: quiz.status,
        assignedClasses: quiz.assignedClassIds ? {
          set: quiz.assignedClassIds.map(id => ({ id }))
        } : undefined
      },
      include: { assignedClasses: true }
    });
    return { ...updated, createdAt: updated.createdAt.toISOString() } as any;
  }

  async deleteQuiz(id: string): Promise<void> {
    await prisma.$transaction([
      prisma.studentResult.deleteMany({ where: { quizId: id } }),
      prisma.question.deleteMany({ where: { quizId: id } }),
      prisma.quiz.delete({ where: { id } })
    ]);
  }

  // Question methods
  async getQuestionsByQuiz(quizId: string): Promise<Question[]> {
    try {
      const questions = await prisma.question.findMany({
        where: { quizId },
        orderBy: { order: 'asc' }
      });
      return questions.map(q => {
        let options: string[] = [];
        if (q.options) {
          try {
            options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
          } catch (e) {
            options = [];
          }
        }
        return { ...q, options, createdAt: q.createdAt.toISOString() };
      }) as Question[];
    } catch (e) {
      return [];
    }
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    try {
      const q = await prisma.question.findUnique({ where: { id } });
      if (!q) return undefined;
      let options: string[] = [];
      if (q.options) {
        try {
          options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        } catch (e) {
          options = [];
        }
      }
      return { ...q, options, createdAt: q.createdAt.toISOString() } as Question;
    } catch (e) {
      return undefined;
    }
  }

  async createQuestion(q: InsertQuestion): Promise<Question> {
    const created = await prisma.question.create({
      data: {
        quizId: q.quizId,
        text: q.text,
        type: q.type,
        options: q.options ? JSON.stringify(q.options) : "[]",
        correctAnswer: q.correctAnswer,
        imageUrl: q.imageUrl,
        order: q.order
      }
    });
    return {
      ...created,
      options: created.options ? JSON.parse(created.options) : [],
      createdAt: created.createdAt.toISOString()
    } as Question;
  }

  async createQuestions(questions: InsertQuestion[]): Promise<Question[]> {
    const results: Question[] = [];
    for (const q of questions) {
      const created = await this.createQuestion(q);
      results.push(created);
    }
    return results;
  }

  async deleteQuestion(id: string): Promise<void> {
    await prisma.question.delete({ where: { id } });
  }

  async deleteQuestionsByQuiz(quizId: string): Promise<void> {
    await prisma.question.deleteMany({ where: { quizId } });
  }

  // Student Result methods
  async getResultsByStudent(studentId: string, teacherId?: string): Promise<StudentResult[]> {
    const where: any = { studentId };
    if (teacherId) {
      where.quiz = { createdBy: teacherId };
    }

    const results = await prisma.studentResult.findMany({
      where,
      include: { 
        quiz: {
          include: { category: true }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    return results.map(r => ({
      ...r,
      answers: r.answers ? JSON.parse(r.answers) : {},
      startedAt: r.startedAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString(),
      completedAt: r.completedAt?.toISOString(),
      quiz: { 
        ...r.quiz, 
        category: r.quiz.category?.name || 'General',
        createdAt: r.quiz.createdAt.toISOString() 
      } as Quiz
    })) as StudentResult[];
  }

  async getResultsByQuiz(quizId: string): Promise<StudentResult[]> {
    const results = await prisma.studentResult.findMany({
      where: { quizId },
      include: { student: true },
      orderBy: { score: 'desc' }
    });
    return results.map(r => ({
      ...r,
      answers: r.answers ? JSON.parse(r.answers) : {},
      startedAt: r.startedAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString(),
      completedAt: r.completedAt?.toISOString(),
      student: { ...r.student, createdAt: r.student.createdAt.toISOString() } as User
    })) as StudentResult[];
  }

  async getLiveResults(quizId: string): Promise<StudentResult[]> {
    const results = await prisma.studentResult.findMany({
      where: { quizId, status: 'in_progress' },
      include: { student: true },
      orderBy: { startedAt: 'desc' }
    });
    return results.map(r => ({
      ...r,
      answers: r.answers ? JSON.parse(r.answers) : {},
      startedAt: r.startedAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString(),
      completedAt: r.completedAt?.toISOString(),
      student: { ...r.student, createdAt: r.student.createdAt.toISOString() } as User
    })) as StudentResult[];
  }

  async getStudentQuizResult(studentId: string, quizId: string): Promise<StudentResult | undefined> {
    const r = await prisma.studentResult.findFirst({
      where: { studentId, quizId },
      orderBy: { startedAt: 'desc' }
    });
    return r ? {
      ...r,
      answers: r.answers ? JSON.parse(r.answers) : {},
      startedAt: r.startedAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString(),
      completedAt: r.completedAt?.toISOString()
    } as StudentResult : undefined;
  }

  async createResult(r: InsertStudentResult): Promise<StudentResult> {
    const created = await prisma.studentResult.create({
      data: {
        studentId: r.studentId,
        quizId: r.quizId,
        status: r.status,
        answers: r.answers ? JSON.stringify(r.answers) : null,
        totalQuestions: r.totalQuestions || 0,
        startedAt: r.startedAt || new Date()
      }
    });
    return {
      ...created,
      answers: created.answers ? JSON.parse(created.answers) : {},
      startedAt: created.startedAt.toISOString(),
      submittedAt: created.submittedAt?.toISOString(),
      completedAt: created.completedAt?.toISOString()
    } as StudentResult;
  }

  async updateResult(id: string, r: Partial<InsertStudentResult>): Promise<void> {
    await prisma.studentResult.update({
      where: { id },
      data: {
        status: r.status,
        answers: r.answers ? JSON.stringify(r.answers) : undefined,
        score: r.score,
        correctAnswersCount: r.correctAnswersCount,
        totalQuestions: r.totalQuestions,
        timeTaken: r.timeTaken,
        submittedAt: r.submittedAt,
        completedAt: r.completedAt
      }
    });
  }

  async getResult(id: string): Promise<StudentResult | undefined> {
    const r = await prisma.studentResult.findUnique({ where: { id } });
    return r ? {
      ...r,
      answers: r.answers ? JSON.parse(r.answers) : {},
      startedAt: r.startedAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString(),
      completedAt: r.completedAt?.toISOString()
    } as StudentResult : undefined;
  }

  async getQuizStats(quizId: string) {
    const results = await prisma.studentResult.findMany({
      where: { quizId, status: 'completed' }
    });
    if (results.length === 0) return { totalParticipants: 0, averageScore: 0, highScorers: 0 };
    const totalScore = results.reduce((acc, r) => acc + (r.score || 0), 0);
    const highScorers = results.filter(r => (r.score || 0) >= 90).length;
    return {
      totalParticipants: results.length,
      averageScore: Math.round(totalScore / results.length),
      highScorers
    };
  }

  // Log methods
  async createLog(userId: string, action: string, details?: string): Promise<ActionLog> {
    const created = await prisma.actionLog.create({
      data: { userId, action, details }
    });
    return { ...created, createdAt: created.createdAt.toISOString() };
  }

  async getLogs(): Promise<ActionLog[]> {
    const logs = await prisma.actionLog.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
    return logs.map(l => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      user: {
        name: l.user.name,
        email: l.user.email,
        role: l.user.role
      }
    }));
  }
}

export const storage = new PrismaStorage();
