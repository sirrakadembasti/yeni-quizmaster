import { PrismaClient, Prisma, User, Quiz, Question, StudentResult, Category, Class, ActionLog } from '@prisma/client';

const prisma = new PrismaClient();

export interface IStorage {
  // Category methods
  getAllCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: Prisma.CategoryUncheckedCreateInput): Promise<Category>;
  updateCategory(id: string, category: Partial<Prisma.CategoryUncheckedCreateInput>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;

  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: Prisma.UserUncheckedCreateInput): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  updateUserRole(userId: string, role: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;

  // Class methods
  getAllClasses(): Promise<Class[]>;
  getClass(id: string): Promise<Class | undefined>;
  createClass(cls: Prisma.ClassUncheckedCreateInput & { teacherId?: string }): Promise<Class>;
  updateClass(id: string, data: Partial<Prisma.ClassUncheckedCreateInput>): Promise<Class | undefined>;
  deleteClass(id: string): Promise<void>;
  getClassesByTeacher(teacherId: string): Promise<Class[]>;
  assignStudentToClass(studentId: string, classId: string): Promise<void>;
  removeStudentFromClass(studentId: string): Promise<void>;
  assignTeacherToClass(teacherId: string, classId: string): Promise<void>;
  removeTeacherFromClass(teacherId: string, classId: string): Promise<void>;
  getStudentsByClass(classId: string): Promise<User[]>;
  assignCategoryToClass(classId: string, categoryId: string): Promise<void>;
  removeCategoryFromClass(classId: string, categoryId: string): Promise<void>;
  assignCategoryToTeacher(teacherId: string, categoryId: string): Promise<void>;
  removeCategoryFromTeacher(teacherId: string, categoryId: string): Promise<void>;

  // Quiz methods
  getAllQuizzes(): Promise<Quiz[]>;
  getQuiz(id: string): Promise<Quiz | undefined>;
  getQuizzesByCreator(teacherId: string): Promise<Quiz[]>;
  createQuiz(quiz: Prisma.QuizUncheckedCreateInput & { assignedClassIds?: string[], category?: string }): Promise<Quiz>;
  updateQuiz(id: string, quiz: Partial<Prisma.QuizUncheckedCreateInput> & { assignedClassIds?: string[] }): Promise<Quiz | undefined>;
  deleteQuiz(id: string): Promise<void>;

  // Question methods
  getQuestionsByQuiz(quizId: string): Promise<Question[]>;
  getQuestion(id: string): Promise<Question | undefined>;
  createQuestion(question: Prisma.QuestionUncheckedCreateInput & { options?: any }): Promise<Question>;
  createQuestions(questions: (Prisma.QuestionUncheckedCreateInput & { options?: any })[]): Promise<Question[]>;
  deleteQuestion(id: string): Promise<void>;
  deleteQuestionsByQuiz(quizId: string): Promise<void>;
  
  // Student Result methods
  getResultsByStudent(studentId: string, teacherId?: string): Promise<StudentResult[]>;
  getResultsByQuiz(quizId: string): Promise<StudentResult[]>;
  getLiveResults(quizId: string): Promise<StudentResult[]>;
  getStudentQuizResult(studentId: string, quizId: string): Promise<StudentResult | undefined>;
  createResult(result: Prisma.StudentResultUncheckedCreateInput & { answers?: any }): Promise<StudentResult>;
  updateResult(id: string, result: Partial<Prisma.StudentResultUncheckedCreateInput> & { answers?: any }): Promise<void>;
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
    return await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const category = await prisma.category.findUnique({ where: { id } });
    return category || undefined;
  }

  async createCategory(category: Prisma.CategoryUncheckedCreateInput): Promise<Category> {
    return await prisma.category.create({
      data: { name: category.name, description: category.description }
    });
  }

  async updateCategory(id: string, category: Partial<Prisma.CategoryUncheckedCreateInput>): Promise<Category | undefined> {
    return await prisma.category.update({
      where: { id },
      data: { name: category.name, description: category.description }
    });
  }

  async deleteCategory(id: string): Promise<void> {
    // Check if category has quizzes or teachers assigned
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            quizzes: true,
            teachers: true
          }
        }
      }
    });

    if (category && (category._count.quizzes > 0 || category._count.teachers > 0)) {
      throw new Error("Bu ders silinemez. Çünkü bu ders ile hazırlanmış sınavlar veya ilişkilendirilmiş öğretmenler bulunmaktadır. Sadece adını değiştirebilirsiniz.");
    }

    await prisma.category.delete({ where: { id } });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({ 
      where: { id },
      include: { class: true, assignedCategories: true }
    });
    return (user as any) || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { class: true, assignedCategories: true }
    });
    return (user as any) || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const user = await prisma.user.findFirst({ 
      where: { resetToken: token }
    });
    return (user as any) || undefined;
  }

  async createUser(user: Prisma.UserUncheckedCreateInput): Promise<User> {
    return await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role || 'student',
        classId: user.classId,
        classNo: user.classNo
      }
    });
  }

  async updateUser(id: string, data: Partial<User> & { assignedCategoryIds?: string[], classIds?: string[] }): Promise<User> {
    const { id: _, createdAt: __, assignedCategoryIds, classIds, ...updateData } = data as any;
    
    // Prepare update data
    const prismaData: any = { ...updateData };

    // Handle teacher categories if provided
    if (assignedCategoryIds) {
      prismaData.assignedCategories = {
        set: assignedCategoryIds.map((catId: string) => ({ id: catId }))
      };
    }

    // Handle teacher classes if provided (A teacher can be in many classes)
    if (classIds) {
      prismaData.classes = {
        set: classIds.map((classId: string) => ({ id: classId }))
      };
    }

    return await prisma.user.update({
      where: { id },
      data: prismaData,
      include: { class: true, assignedCategories: true }
    });
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { role } });
  }

  async getAllUsers(): Promise<User[]> {
    const users = await prisma.user.findMany({
      include: { class: true, assignedCategories: true }
    });
    return users as any as User[];
  }

  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }

  // Class methods
  async getAllClasses(): Promise<Class[]> {
    const classes = await prisma.class.findMany({ 
      include: { teachers: true, assignedCategories: true },
      orderBy: { createdAt: 'desc' } 
    });
    return classes as any as Class[];
  }

  async getClass(id: string): Promise<Class | undefined> {
    const cls = await prisma.class.findUnique({ 
      where: { id },
      include: { teachers: true, assignedCategories: true }
    });
    return (cls as any) || undefined;
  }

  async createClass(cls: Prisma.ClassUncheckedCreateInput & { teacherId?: string }): Promise<Class> {
    const data: any = {
      name: cls.name,
      description: cls.description,
      maxStudents: cls.maxStudents,
    };
    
    if (cls.teacherId) {
      data.teachers = { connect: { id: cls.teacherId } };
    }

    const created = await prisma.class.create({
      data,
      include: { teachers: true, assignedCategories: true }
    });
    
    return created as any as Class;
  }

  async updateClass(id: string, data: Partial<Prisma.ClassUncheckedCreateInput>): Promise<Class | undefined> {
    try {
      const updated = await prisma.class.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          maxStudents: data.maxStudents,
        },
        include: { teachers: true, assignedCategories: true }
      });
      return updated as any as Class;
    } catch (e) {
      return undefined;
    }
  }

  async deleteClass(id: string): Promise<void> {
    await prisma.class.delete({ where: { id } });
  }

  async getClassesByTeacher(teacherId: string): Promise<Class[]> {
    const classes = await prisma.class.findMany({
      where: { teachers: { some: { id: teacherId } } },
      include: { teachers: true, assignedCategories: true }
    });
    return classes as any as Class[];
  }

  async assignStudentToClass(studentId: string, classId: string): Promise<void> {
    await prisma.user.update({ where: { id: studentId }, data: { classId } });
  }

  async removeStudentFromClass(studentId: string): Promise<void> {
    await prisma.user.update({ where: { id: studentId }, data: { classId: null } });
  }

  async assignTeacherToClass(teacherId: string, classId: string): Promise<void> {
    await prisma.class.update({
      where: { id: classId },
      data: { teachers: { connect: { id: teacherId } } }
    });
  }

  async removeTeacherFromClass(teacherId: string, classId: string): Promise<void> {
    await prisma.class.update({
      where: { id: classId },
      data: { teachers: { disconnect: { id: teacherId } } }
    });
  }

  async getStudentsByClass(classId: string): Promise<User[]> {
    return await prisma.user.findMany({ where: { classId } });
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
          select: { 
            questions: true,
            results: {
              where: {
                student: { role: 'student' }
              }
            }
          }
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
      participantCount: q._count.results
    })) as any as Quiz[];
  }

  async getQuiz(id: string): Promise<Quiz | undefined> {
    const quiz = await prisma.quiz.findUnique({ 
      where: { id },
      include: { category: true, assignedClasses: true }
    });
    return quiz ? { 
      ...quiz, 
      category: quiz.category?.name || 'General'
    } as any as Quiz : undefined;
  }

  async getQuizzesByCreator(teacherId: string): Promise<Quiz[]> {
    const quizzes = await prisma.quiz.findMany({
      where: { createdBy: teacherId },
      include: {
        _count: {
          select: { 
            questions: true,
            results: {
              where: {
                student: { role: 'student' }
              }
            }
          }
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
      participantCount: q._count.results
    })) as any as Quiz[];
  }

  async createQuiz(quiz: Prisma.QuizUncheckedCreateInput & { assignedClassIds?: string[], category?: string }): Promise<Quiz> {
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
      category: quiz.category || 'General'
    } as any as Quiz;
  }

  async updateQuiz(id: string, quiz: Partial<Prisma.QuizUncheckedCreateInput> & { assignedClassIds?: string[] }): Promise<Quiz | undefined> {
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
    return updated as any as Quiz;
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
        return { ...q, options };
      }) as any as Question[];
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
      return { ...q, options } as any as Question;
    } catch (e) {
      return undefined;
    }
  }

  async createQuestion(q: Prisma.QuestionUncheckedCreateInput & { options?: any }): Promise<Question> {
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
      options: created.options ? JSON.parse(created.options) : []
    } as any as Question;
  }

  async createQuestions(questions: (Prisma.QuestionUncheckedCreateInput & { options?: any })[]): Promise<Question[]> {
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
      quiz: { 
        ...r.quiz, 
        category: r.quiz.category?.name || 'General'
      }
    })) as any as StudentResult[];
  }

  async getResultsByQuiz(quizId: string): Promise<StudentResult[]> {
    const results = await prisma.studentResult.findMany({
      where: { quizId },
      include: { student: true },
      orderBy: { score: 'desc' }
    });
    return results.map(r => ({
      ...r,
      answers: r.answers ? JSON.parse(r.answers) : {}
    })) as any as StudentResult[];
  }

  async getLiveResults(quizId: string): Promise<StudentResult[]> {
    const results = await prisma.studentResult.findMany({
      where: { quizId, status: 'in_progress' },
      include: { student: true },
      orderBy: { startedAt: 'desc' }
    });
    return results.map(r => ({
      ...r,
      answers: r.answers ? JSON.parse(r.answers) : {}
    })) as any as StudentResult[];
  }

  async getStudentQuizResult(studentId: string, quizId: string): Promise<StudentResult | undefined> {
    const r = await prisma.studentResult.findFirst({
      where: { studentId, quizId },
      orderBy: { startedAt: 'desc' }
    });
    return r ? {
      ...r,
      answers: r.answers ? JSON.parse(r.answers) : {}
    } as any as StudentResult : undefined;
  }

  async createResult(r: Prisma.StudentResultUncheckedCreateInput & { answers?: any }): Promise<StudentResult> {
    const created = await prisma.studentResult.create({
      data: {
        studentId: r.studentId,
        quizId: r.quizId,
        status: r.status || "in_progress",
        answers: r.answers ? JSON.stringify(r.answers) : null,
        totalQuestions: r.totalQuestions || 0,
        startedAt: r.startedAt || new Date()
      }
    });
    return {
      ...created,
      answers: created.answers ? JSON.parse(created.answers) : {}
    } as any as StudentResult;
  }

  async updateResult(id: string, r: Partial<Prisma.StudentResultUncheckedCreateInput> & { answers?: any }): Promise<void> {
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
      answers: r.answers ? JSON.parse(r.answers) : {}
    } as any as StudentResult : undefined;
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
    return await prisma.actionLog.create({
      data: { userId, action, details }
    });
  }

  async getLogs(): Promise<ActionLog[]> {
    const logs = await prisma.actionLog.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
    return logs.map(l => ({
      ...l,
      user: {
        name: l.user.name,
        email: l.user.email,
        role: l.user.role
      }
    })) as any as ActionLog[];
  }
}

export const storage = new PrismaStorage();