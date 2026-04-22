import { PrismaClient, Prisma, User, Quiz, Question, QuestionBank, StudentResult, Category, Class, ActionLog } from '@prisma/client';

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
  assignTeacherToClassWithCourse(classId: string, teacherId: string, categoryId: string): Promise<void>;
  removeTeacherFromClassWithCourse(assignmentId: string): Promise<void>;
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
  // Atomik soru senkronizasyonu: mevcut soruları siler ve yenilerini tek bir transaction içinde ekler.
  // deleteMany başarılı olsa bile createMany hata verirse tüm değişiklikler geri alınır.
  syncQuestions(quizId: string, questions: (Prisma.QuestionUncheckedCreateInput & { options?: any })[]): Promise<Question[]>;
  
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
  // Sistem genelinde admin dashboard istatistikleri (tek sorguda hesaplanır)
  getAdminStats(): Promise<{
    totalResults: number;
    averageStudentScore: number;
  }>;

  // Notification methods
  // page ve limit opsiyonel — sağlanmazsa sayfa 1, varsayılan limit kullanılır.
  // Dönüş: { data, total } — geriye dönük uyumluluk: route `notifications` key'i altında veriyi döndürür.
  getUserNotifications(userId: string, page?: number, limit?: number): Promise<{ data: any[]; total: number }>;
  markNotificationsAsRead(userId: string): Promise<void>;

  // Arşiv yönetimi
  // purgeArchivedData: Belirtilen akademik yıla ait archived sınavları ve öğrenci sonuçlarını
  // fiziksel olarak siler. GERİ ALINAMAZ — yalnızca admin yetkisiyle çağrılmalıdır.
  purgeArchivedData(academicYear: string): Promise<{ quizzesPurged: number; resultsPurged: number }>;

  // Log methods
  createLog(userId: string, action: string, details?: string): Promise<ActionLog>;
  // page ve limit filters nesnesine eklendi; total count pagination bilgisi için döndürülüyor.
  getLogs(filters?: { role?: string; userId?: string; action?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number }): Promise<{ data: ActionLog[]; total: number }>;
  createAnnouncement(data: any): Promise<any>;
  getAllAnnouncements(): Promise<any[]>;
  deleteAnnouncement(id: string): Promise<void>;
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
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { class: true, assignedCategories: true }
    });
    return user || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const user = await prisma.user.findFirst({ 
      where: { resetToken: token }
    });
    return user || undefined;
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

  async updateUser(id: string, data: any): Promise<User> {
    // Destructure to separate scalar fields from relations and metadata
    const { 
      id: _, 
      createdAt: __, 
      assignedCategories, 
      assignedCategoryIds,
      class,
      classes,
      classIds,
      ...updateData 
    } = data;
    
    // Prepare update data with only allowed scalar fields
    const prismaData: any = {};
    
    // List of allowed scalar fields for User
    const allowedFields = ['name', 'email', 'password', 'role', 'studentNo', 'classNo', 'classId', 'resetToken', 'resetTokenExpiry', 'phoneNumber', 'address'];
    
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        prismaData[key] = updateData[key];
      }
    }

    // Role transition logic: if role is changed to teacher or admin, clear student fields
    if (prismaData.role && ['teacher', 'admin'].includes(prismaData.role)) {
      prismaData.classId = null;
      prismaData.studentNo = null;
    }

    // Handle teacher categories if provided
    if (assignedCategoryIds) {
      prismaData.assignedCategories = {
        set: assignedCategoryIds.map((catId: string) => ({ id: catId }))
      };
    }

    // Handle teacher classes if provided
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
    const data: any = { role };
    // Clear student-specific fields if transitioning to teacher or admin
    if (['teacher', 'admin'].includes(role)) {
      data.classId = null;
      data.studentNo = null;
    }
    await prisma.user.update({ where: { id: userId }, data });
  }

  async getAllUsers(): Promise<User[]> {
    const users = await prisma.user.findMany({
      include: {
        class: true,
        assignedCategories: true,
        // Öğretmenin sorumlu olduğu sınıflar (classTeacherId üzerinden)
        responsibleForClasses: { select: { id: true, name: true } }
      }
    });
    return users as unknown as User[];
  }

  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }

  // Class methods
  async getAllClasses(): Promise<Class[]> {
    const classes = await prisma.class.findMany({
      include: {
        teachers: true,
        classTeacher: true,
        assignedCategories: true,
        teacherAssignments: {
          include: {
            teacher: true,
            category: true
          }
        },
        _count: { 
          select: { 
            students: {
              where: { role: 'student' }
            } 
          } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return classes as unknown as Class[];
  }

  async getClass(id: string): Promise<Class | undefined> {
    const cls = await prisma.class.findUnique({
      where: { id },
      include: { 
        teachers: true, 
        classTeacher: true, 
        assignedCategories: true,
        teacherAssignments: {
          include: {
            teacher: true,
            category: true
          }
        }
      }
    });
    return (cls as any) || undefined;
  }

  async assignTeacherToClassWithCourse(classId: string, teacherId: string, categoryId: string): Promise<void> {
    await prisma.classTeacherCourse.upsert({
      where: {
        classId_teacherId_categoryId: {
          classId,
          teacherId,
          categoryId
        }
      },
      create: {
        classId,
        teacherId,
        categoryId
      },
      update: {} // No change if exists
    });
  }

  async removeTeacherFromClassWithCourse(assignmentId: string): Promise<void> {
    await prisma.classTeacherCourse.delete({
      where: { id: assignmentId }
    });
  }
  async createClass(cls: Prisma.ClassUncheckedCreateInput & { teacherId?: string, classTeacherId?: string }): Promise<Class> {
    const existingClass = await prisma.class.findFirst({ 
      where: { name: cls.name } 
    });
    if (existingClass) {
      throw new Error("CLASS_EXISTS");
    }

    const data: any = {
      name: cls.name,
      description: cls.description,
      maxStudents: cls.maxStudents,
      classTeacherId: cls.classTeacherId || cls.teacherId || null
    };

    // Connect teacher as both classTeacher and in teachers list
    if (data.classTeacherId) {
      data.teachers = { connect: { id: data.classTeacherId } };
    }

    const created = await prisma.class.create({
      data,
      include: { teachers: true, classTeacher: true, assignedCategories: true }
    });

    return created as unknown as Class;
  }

  async updateClass(id: string, data: Partial<Prisma.ClassUncheckedCreateInput>): Promise<Class | undefined> {
    try {
      if (data.name) {
        const existingClass = await prisma.class.findFirst({ 
          where: { 
            name: data.name, 
            id: { not: id } 
          } 
        });
        if (existingClass) {
          throw new Error("CLASS_EXISTS");
        }
      }

      const updated = await prisma.class.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          maxStudents: data.maxStudents,
          classTeacherId: data.classTeacherId
        },
        include: { teachers: true, classTeacher: true, assignedCategories: true }
      });
      return updated as unknown as Class;
    } catch (e: any) {
      if (e.message === "CLASS_EXISTS") throw e;
      return undefined;
    }
  }

  async deleteClass(id: string): Promise<void> {
    // Check if class has students or teacher assignments
    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: { where: { role: 'student' } },
            teacherAssignments: true
          }
        }
      }
    });

    if (cls && cls._count.students > 0) {
      throw new Error("Sınıf kapatılamaz/silinemez. Önce sınıf içerisindeki öğretmen ve öğrencilerin boşaltılması gerekmektedir.");
    }

    await prisma.class.delete({ where: { id } });
  }
  async getClassesByTeacher(teacherId: string): Promise<Class[]> {
    const classes = await prisma.class.findMany({
      where: { 
        OR: [
          { teachers: { some: { id: teacherId } } },
          { classTeacherId: teacherId }
        ]
      },
      include: { teachers: true, classTeacher: true, assignedCategories: true }
    });
    return classes as unknown as Class[];
  }

  async assignStudentToClass(studentId: string, classId: string): Promise<void> {
    // Find the highest student number in this class
    const highestStudentNoUser = await prisma.user.findFirst({
      where: { classId },
      orderBy: { studentNo: 'desc' },
      select: { studentNo: true }
    });

    const nextNo = (highestStudentNoUser?.studentNo || 0) + 1;

    await prisma.user.update({
      where: { id: studentId },
      data: { 
        classId,
        studentNo: nextNo
      }
    });
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
    return await prisma.user.findMany({ 
      where: { 
        classId,
        role: 'student'
      } 
    });
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
        category: true, creator: true,
        assignedClasses: true, creator: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return quizzes.map(q => ({ 
      ...q, 
      category: q.category?.name || 'General',
      questionCount: q._count.questions,
      participantCount: q._count.results
    })) as unknown as Quiz[];
  }

  async getQuiz(id: string): Promise<Quiz | undefined> {
    const quiz = await prisma.quiz.findUnique({ 
      where: { id },
      include: { category: true, creator: true, assignedClasses: true, creator: true }
    });
    return quiz ? { 
      ...quiz, 
      category: quiz.category?.name || 'General'
    } as unknown as Quiz : undefined;
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
        category: true, creator: true,
        assignedClasses: true, creator: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return quizzes.map(q => ({ 
      ...q, 
      category: q.category?.name || 'General',
      questionCount: q._count.questions,
      participantCount: q._count.results
    })) as unknown as Quiz[];
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
      include: { assignedClasses: true, creator: true }
    });
    return { 
      ...created, 
      category: quiz.category || 'General'
    } as unknown as Quiz;
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
      include: { assignedClasses: true, creator: true }
    });
    return updated as unknown as Quiz;
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
      }) as unknown as Question[];
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
      return { ...q, options } as unknown as Question;
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
    } as unknown as Question;
  }

  async createQuestions(questions: (Prisma.QuestionUncheckedCreateInput & { options?: any })[]): Promise<Question[]> {
    if (questions.length === 0) return [];

    // createMany ile tüm soruları tek DB sorgusunda ekle (N ayrı sorgu yerine 1 sorgu)
    // Not: Prisma'nın createMany metodu oluşturulan kayıtları döndürmez;
    //      bu nedenle ekleme sonrasında getQuestionsByQuiz ile sonuçları çekiyoruz.
    // Not: Tüm sorular aynı quiz'e ait olmalıdır (quizId aynı olmalı).
    await prisma.question.createMany({
      data: questions.map((q) => ({
        quizId: q.quizId as string,
        text: q.text as string,
        type: q.type as string,
        options: q.options ? JSON.stringify(q.options) : "[]",
        correctAnswer: q.correctAnswer as string,
        imageUrl: (q.imageUrl as string | null | undefined) ?? null,
        order: q.order as number,
      })),
    });

    // Eklenen soruları sıralı olarak geri döndür
    return this.getQuestionsByQuiz(questions[0].quizId as string);
  }

  async deleteQuestion(id: string): Promise<void> {
    await prisma.question.delete({ where: { id } });
  }

  async deleteQuestionsByQuiz(quizId: string): Promise<void> {
    await prisma.question.deleteMany({ where: { quizId } });
  }

  async syncQuestions(quizId: string, questions: (Prisma.QuestionUncheckedCreateInput & { options?: any })[]): Promise<Question[]> {
    // Silme ve ekleme işlemlerini tek bir transaction içinde çalıştır.
    // createMany hata verirse deleteMany da geri alınır — veri kaybı yaşanmaz.
    await prisma.$transaction([
      prisma.question.deleteMany({ where: { quizId } }),
      prisma.question.createMany({
        data: questions.map((q) => ({
          quizId: quizId,
          text: q.text as string,
          type: q.type as string,
          options: q.options ? JSON.stringify(q.options) : "[]",
          correctAnswer: q.correctAnswer as string,
          imageUrl: (q.imageUrl as string | null | undefined) ?? null,
          order: q.order as number,
        })),
      }),
    ]);
    return this.getQuestionsByQuiz(quizId);
  }

  // Question Bank methods
  async getQuestionBankItems(teacherId: string): Promise<QuestionBank[]> {
    const items = await prisma.questionBank.findMany({
      where: { teacherId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
    return items.map(q => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
    })) as unknown as QuestionBank[];
  }

  async createQuestionBankItem(item: Omit<Prisma.QuestionBankUncheckedCreateInput, 'id' | 'createdAt'> & { options?: any }): Promise<QuestionBank> {
    const created = await prisma.questionBank.create({
      data: {
        ...item,
        options: item.options ? JSON.stringify(item.options) : null,
      },
      include: { category: true }
    });
    return {
      ...created,
      options: created.options ? JSON.parse(created.options) : null,
    } as unknown as QuestionBank;
  }

  async deleteQuestionBankItem(id: string, teacherId: string): Promise<void> {
    await prisma.questionBank.deleteMany({
      where: { id, teacherId },
    });
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
    })) as unknown as StudentResult[];
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
    })) as unknown as StudentResult[];
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
    })) as unknown as StudentResult[];
  }

  async getStudentQuizResult(studentId: string, quizId: string): Promise<StudentResult | undefined> {
    const r = await prisma.studentResult.findFirst({
      where: { studentId, quizId },
      orderBy: { startedAt: 'desc' }
    });
    return r ? {
      ...r,
      answers: r.answers ? JSON.parse(r.answers) : {}
    } as unknown as StudentResult : undefined;
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
    } as unknown as StudentResult;
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
    } as unknown as StudentResult : undefined;
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

  // Sistem genelinde tamamlanan sınav istatistiklerini tek sorguda hesaplar
  async getAdminStats(): Promise<{ totalResults: number; averageStudentScore: number }> {
    const agg = await prisma.studentResult.aggregate({
      where: { status: 'completed', score: { not: null } },
      _count: { id: true },
      _avg: { score: true },
    });
    return {
      totalResults: agg._count.id,
      averageStudentScore: Math.round(agg._avg.score ?? 0),
    };
  }

  // Notification methods
  async getUserNotifications(userId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);
    return { data, total };
  }

  async createNotification(data: { userId: string, title: string, message: string, type?: string }): Promise<any> {
    return await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type || "info"
      }
    });
  }

  async markNotificationsAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }

  // Log methods
  async createLog(userId: string, action: string, details?: string): Promise<ActionLog> {
    return await prisma.actionLog.create({
      data: { userId, action, details }
    });
  }

  async getLogs(filters?: { role?: string; userId?: string; action?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number }): Promise<{ data: ActionLog[]; total: number }> {
    const where: Prisma.ActionLogWhereInput = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = { contains: filters.action };
    if (filters?.role) where.user = { role: filters.role };
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 100;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.actionLog.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.actionLog.count({ where }),
    ]);

    return {
      data: logs.map(l => ({
        ...l,
        user: { name: l.user.name, email: l.user.email, role: l.user.role },
      })) as unknown as ActionLog[],
      total,
    };
  }
  async archiveQuizzesAndResults(academicYear: string): Promise<{ quizzesArchived: number, resultsArchived: number }> {
    const quizzesUpdate = await prisma.quiz.updateMany({
      where: { academicYear: null },
      data: { status: 'archived', academicYear }
    });

    const resultsUpdate = await prisma.studentResult.updateMany({
      where: { academicYear: null },
      data: { academicYear }
    });

    return {
      quizzesArchived: quizzesUpdate.count,
      resultsArchived: resultsUpdate.count
    };
  }

  async promoteStudents(fromClassId: string, toClassId: string | null, academicYear?: string): Promise<number> {
    // academicYear verilmişse: öğrencilerin taşınmadan önceki tamamlanmış
    // sınav sonuçlarına yıl damgası vur — yeni sınıf istatistiklerini kirletmez.
    if (academicYear) {
      const students = await prisma.user.findMany({
        where: { role: 'student', classId: fromClassId },
        select: { id: true }
      });
      const studentIds = students.map(s => s.id);
      if (studentIds.length > 0) {
        await prisma.studentResult.updateMany({
          where: {
            studentId: { in: studentIds },
            academicYear: null,
            status: 'completed'
          },
          data: { academicYear }
        });
      }
    }

    const result = await prisma.user.updateMany({
      where: { role: 'student', classId: fromClassId },
      data: { classId: toClassId }
    });
    return result.count;
  }

  async purgeArchivedData(academicYear: string): Promise<{ quizzesPurged: number; resultsPurged: number }> {
    // Önce bağımsız sonuçları sil (quiz'e bağlı olmayanlar).
    // Quiz silindiğinde Question ve StudentResult cascade ile zaten silinir (onDelete: Cascade).
    // Ancak academicYear'a göre filtrelenmiş sonuçları ayrıca da temizliyoruz.
    const resultsDelete = await prisma.studentResult.deleteMany({
      where: { academicYear }
    });

    // Archived sınavları sil — bağlı Question'lar ve kalan StudentResult'lar cascade silinir.
    const quizzesDelete = await prisma.quiz.deleteMany({
      where: { academicYear, status: 'archived' }
    });

    return {
      quizzesPurged: quizzesDelete.count,
      resultsPurged: resultsDelete.count
    };
  }

  // Announcement methods
  async createAnnouncement(data: any): Promise<any> {
    return await prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        createdBy: data.createdBy,
        targetRole: data.targetRole || "all",
        targetClassId: data.targetClassId || null
      },
      include: { creator: { select: { name: true } } }
    });
  }

  async getAllAnnouncements(): Promise<any[]> {
    return await prisma.announcement.findMany({
      include: { creator: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await prisma.announcement.delete({ where: { id } });
  }
}

export const storage = new PrismaStorage();
