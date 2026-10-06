import { isDeepStrictEqual } from "node:util";
import { PrismaClient, Prisma, User, Quiz, Question, QuestionBank, StudentResult, Category, Class, ActionLog, EmailQueue } from '@prisma/client';

const prisma = new PrismaClient();
export const closeStorage = () => prisma.$disconnect();

export type ContentQuestionInput = Omit<Prisma.QuestionUncheckedCreateInput, 'options' | 'config' | 'correctAnswer'> & { options?: any; config?: any; correctAnswer?: string | null };
export type ContentSettingsInput = Prisma.QuizUncheckedCreateInput & { assignedClassIds: string[] };

async function writeTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(operation, { maxWait: 10000, timeout: 10000 }); }
    catch (error) {
      if (attempt >= 3 || !["P1008", "P2028", "P2034"].includes((error as any).code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

function validateClassCapacity(capacity: number | null | undefined) {
  if (capacity != null && (!Number.isInteger(capacity) || capacity <= 0)) throw new Error('INVALID_CLASS_CAPACITY');
}

async function assertClassCapacity(tx: Prisma.TransactionClient, classId: string, additionalActiveStudents: number | null, excludeUserIds: string[] = [], override?: number | null) {
  const classroom = await tx.class.findUnique({ where: { id: classId }, select: { maxStudents: true } });
  if (!classroom) throw new Error('CLASS_NOT_FOUND');
  const capacity = override === undefined ? classroom.maxStudents : override;
  validateClassCapacity(capacity);
  // Inactive enrollment validates the class without adding an occupied seat.
  if (capacity === null || additionalActiveStudents === null) return;
  const activeStudents = await tx.user.count({ where: { classId, role: 'student', isActive: true,
    ...(excludeUserIds.length ? { id: { notIn: excludeUserIds } } : {}),
  } });
  if (activeStudents + additionalActiveStudents > capacity) throw new Error('CLASS_CAPACITY_EXCEEDED');
}

const resultStudentSelect = {
  id: true, name: true, classId: true, studentNo: true,
  class: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

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
  createUser(user: Prisma.UserUncheckedCreateInput & { guardianStudentIds?: string[] }): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  updateUserRole(userId: string, role: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;
  deactivateStudent(id: string): Promise<User>;
  getGuardianStudents(guardianId: string): Promise<any[]>;
  getStudentGuardians(studentId: string): Promise<any[]>;
  replaceGuardianStudents(guardianId: string, studentIds: string[]): Promise<any[]>;
  linkGuardianStudent(guardianId: string, studentId: string, relation?: string | null): Promise<any>;
  unlinkGuardianStudent(guardianId: string, studentId: string): Promise<void>;

  // Class methods
  getAllClasses(): Promise<Class[]>;
  getClass(id: string): Promise<Class | undefined>;
  createClass(cls: Prisma.ClassUncheckedCreateInput & { teacherId?: string | null }): Promise<Class>;
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
  getStudentsByTeacher(teacherId: string): Promise<User[]>;
  assignCategoryToClass(classId: string, categoryId: string): Promise<void>;
  removeCategoryFromClass(classId: string, categoryId: string): Promise<void>;
  assignCategoryToTeacher(teacherId: string, categoryId: string): Promise<void>;
  removeCategoryFromTeacher(teacherId: string, categoryId: string): Promise<void>;

  // Quiz methods
  getAllQuizzes(filters?: { studentClassId?: string | null }): Promise<Quiz[]>;
  getQuiz(id: string): Promise<Quiz | undefined>;
  getQuizzesByCreator(teacherId: string): Promise<Quiz[]>;
  createQuiz(quiz: Prisma.QuizUncheckedCreateInput & { assignedClassIds?: string[], category?: string }): Promise<Quiz>;
  updateQuiz(id: string, quiz: Partial<Prisma.QuizUncheckedCreateInput> & { assignedClassIds?: string[] }): Promise<Quiz | undefined>;
  saveContent(id: string, settings: ContentSettingsInput, questions: ContentQuestionInput[], actor: { id: string; role: string }): Promise<{ quiz: Quiz; questions: Question[]; created: boolean; published: boolean }>;
  deleteQuiz(id: string): Promise<void>;
  deleteQuizWithAudit(id: string, actorId: string, reason: string): Promise<void>;
  getSurveySubmissions(surveyId: string, startDate?: Date, endDate?: Date): Promise<any[]>;
  getStudentSurveySubmission(surveyId: string, studentId: string): Promise<any | undefined>;
  createSurveySubmission(surveyId: string, studentId: string, answers: Array<{ questionId: string; value: unknown }>): Promise<any>;

  // Question methods
  getQuestionsByQuiz(quizId: string): Promise<Question[]>;
  getQuestion(id: string): Promise<Question | undefined>;
  createQuestion(question: Omit<Prisma.QuestionUncheckedCreateInput, 'options' | 'config' | 'correctAnswer'> & { options?: any; config?: any; correctAnswer?: string | null }): Promise<Question>;
  createQuestions(questions: (Omit<Prisma.QuestionUncheckedCreateInput, 'options' | 'config' | 'correctAnswer'> & { options?: any; config?: any; correctAnswer?: string | null })[]): Promise<Question[]>;
  deleteQuestion(id: string): Promise<void>;
  deleteQuestionsByQuiz(quizId: string): Promise<void>;
  // Katılım başladıktan sonra içerik değişmez; taslak düzenlemesi soru kimliklerini korur.
  // deleteMany başarılı olsa bile createMany hata verirse tüm değişiklikler geri alınır.
  syncQuestions(quizId: string, questions: (Omit<Prisma.QuestionUncheckedCreateInput, 'options' | 'config' | 'correctAnswer'> & { options?: any; config?: any; correctAnswer?: string | null })[]): Promise<Question[]>;
  
  // Student Result methods
  getResultsByStudent(studentId: string, teacherId?: string): Promise<StudentResult[]>;
  getFilteredResults(filters: { quizId?: string; categoryId?: string; classId?: string; studentId?: string; createdBy?: string }): Promise<StudentResult[]>;
  getResultsByQuiz(quizId: string): Promise<StudentResult[]>;
  getLiveResults(quizId: string): Promise<StudentResult[]>;
  getStudentQuizResult(studentId: string, quizId: string): Promise<StudentResult | undefined>;
  createResult(result: Prisma.StudentResultUncheckedCreateInput & { answers?: any }): Promise<StudentResult>;
  updateResult(id: string, result: Partial<Prisma.StudentResultUncheckedCreateInput> & { answers?: any }): Promise<void>;
  getResult(id: string): Promise<StudentResult | undefined>;
  saveResultAnswer(id: string, studentId: string, questionId: string, answer: string): Promise<void>;
  completeResult(id: string, studentId: string, answers: Record<string, string>): Promise<{ score: number; correctAnswers: number; totalQuestions: number; acceptedQueuedAnswers: boolean; newlyCompleted: boolean }>;
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
  getClassAnalytics(classIds: string[], startDate: Date, endDate: Date): Promise<any[]>;
  getDashboardOverview(role: string, userId: string): Promise<any[]>;
  getQuestionBankItems(teacherId: string): Promise<QuestionBank[]>;
  createQuestionBankItem(item: Omit<Prisma.QuestionBankUncheckedCreateInput, 'id' | 'createdAt' | 'options'> & { options?: any }): Promise<QuestionBank>;


  // Notification methods
  // page ve limit opsiyonel — sağlanmazsa sayfa 1, varsayılan limit kullanılır.
  // Dönüş: { data, total } — geriye dönük uyumluluk: route `notifications` key'i altında veriyi döndürür.
  getUserNotifications(userId: string, page?: number, limit?: number): Promise<{ data: any[]; total: number; unread: number }>;
  createNotification(data: { userId: string; title: string; message: string; type?: string }): Promise<any>;
  markNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(userId: string, notificationId: string): Promise<boolean>;
  getNotificationPreferences(userId: string): Promise<{ muted: boolean }>;
  updateNotificationPreferences(userId: string, muted: boolean): Promise<{ muted: boolean }>;

  // Arşiv yönetimi
  // purgeArchivedData: Belirtilen akademik yıla ait archived sınavları ve öğrenci sonuçlarını
  // fiziksel olarak siler. GERİ ALINAMAZ — yalnızca admin yetkisiyle çağrılmalıdır.
  purgeArchivedData(academicYear: string): Promise<{ quizzesPurged: number; resultsPurged: number }>;

  // Log methods
  createLog(userId: string, action: string, details?: string): Promise<ActionLog>;
  // page ve limit filters nesnesine eklendi; total count pagination bilgisi için döndürülüyor.
  getLogs(filters?: { role?: string; userId?: string; action?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number }): Promise<{ data: ActionLog[]; total: number }>;
  getSystemLogs(filters?: { search?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number }): Promise<{ data: ActionLog[]; total: number }>;
  databaseHealth(): Promise<boolean>;
  pruneOperationalData(cutoffs: {
    actionLogsBefore: Date;
    readNotificationsBefore: Date;
    emailLogsBefore: Date;
    passwordResetsBefore: Date;
  }): Promise<{ actionLogs: number; readNotifications: number; emailLogs: number; passwordResets: number }>;

  // Email Queue methods
  enqueueEmail(data: { to: string; subject: string; body: string; type?: string; maxAttempts?: number }): Promise<EmailQueue>;
  getEmailLogs(filters?: { status?: string; search?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number }): Promise<{ data: EmailQueue[]; total: number; counts: { total: number; sent: number; pending: number; failed: number } }>;
  retryEmail(id: string): Promise<EmailQueue | null>;
  deleteEmailLog(id: string): Promise<boolean>;
  getPendingEmails(limit?: number): Promise<EmailQueue[]>;
  claimPendingEmails(limit?: number, excludeIds?: string[]): Promise<EmailQueue[]>;
  updateEmailStatus(id: string, status: string, errorMessage?: string | null, processingUntil?: Date): Promise<EmailQueue | null>;
  createPasswordResetRequest(data: { userId: string; email: string; tokenHash: string; expiresAt: Date; requestedBy?: string | null; requestIp?: string | null }): Promise<any>;
  updatePasswordResetRequest(id: string, data: Record<string, unknown>): Promise<any>;
  getPasswordResetRequest(id: string): Promise<any | undefined>;
  getPasswordResetRequestByToken(tokenHash: string): Promise<any | undefined>;
  getPasswordResetRequests(filters?: { status?: string; search?: string; page?: number; limit?: number }): Promise<{ data: any[]; total: number; counts: Record<string, number> }>;
  cancelPendingPasswordResetRequests(userId: string): Promise<void>;

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
      include: { 
        class: true, 
        assignedCategories: true, 
        managedClasses: true,
        teacherAssignments: {
          include: { class: true, category: true }
        }
      }
    });
    if (user) {
      const combinedClasses = new Map();
      const combinedCategories = new Map();
      
      (user as any).managedClasses?.forEach((c: any) => combinedClasses.set(c.id, c));
      (user as any).assignedCategories?.forEach((c: any) => combinedCategories.set(c.id, c));
      
      (user as any).teacherAssignments?.forEach((ta: any) => {
        combinedClasses.set(ta.class.id, ta.class);
        combinedCategories.set(ta.category.id, ta.category);
      });

      (user as any).classes = Array.from(combinedClasses.values());
      (user as any).assignedCategories = Array.from(combinedCategories.values());
    }
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { 
        class: true, 
        assignedCategories: true, 
        managedClasses: true,
        teacherAssignments: {
          include: { class: true, category: true }
        }
      }
    });
    if (user) {
      const combinedClasses = new Map();
      const combinedCategories = new Map();
      
      (user as any).managedClasses?.forEach((c: any) => combinedClasses.set(c.id, c));
      (user as any).assignedCategories?.forEach((c: any) => combinedCategories.set(c.id, c));
      
      (user as any).teacherAssignments?.forEach((ta: any) => {
        combinedClasses.set(ta.class.id, ta.class);
        combinedCategories.set(ta.category.id, ta.category);
      });

      (user as any).classes = Array.from(combinedClasses.values());
      (user as any).assignedCategories = Array.from(combinedCategories.values());
    }
    return user || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const user = await prisma.user.findFirst({ 
      where: { resetToken: token }
    });
    return user || undefined;
  }

  async createUser(user: Prisma.UserUncheckedCreateInput & { guardianStudentIds?: string[]; assignedCategoryIds?: string[]; classIds?: string[] }): Promise<User> {
    const guardianStudentIds = [...new Set(user.guardianStudentIds || [])];
    return writeTransaction(async (tx) => {
      const role = user.role || 'student';
      const classId = role === 'student' ? user.classId : null;
      if (classId) await assertClassCapacity(tx, classId, user.isActive === false ? null : 1);
      const highest = classId ? await tx.user.aggregate({
        where: { role: 'student', classId },
        _max: { studentNo: true },
      }) : null;
      const created = await tx.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: user.password,
          role,
          isActive: user.isActive ?? true,
          deactivatedAt: user.deactivatedAt,
          classId,
          classNo: null,
          studentNo: classId ? (highest?._max.studentNo || 0) + 1 : null,
          phoneNumber: user.phoneNumber,
          address: user.address,
          parentName: user.parentName,
          parentRelation: user.parentRelation,
          parentPhone: user.parentPhone,
          parentEmail: user.parentEmail,
          parentAddress: user.parentAddress,
          ...(role === 'teacher' && user.assignedCategoryIds?.length ? {
            assignedCategories: { connect: user.assignedCategoryIds.map((id) => ({ id })) }
          } : {}),
          ...(role === 'teacher' && user.classIds?.length ? {
            managedClasses: { connect: user.classIds.map((id) => ({ id })) }
          } : {})
        }
      });
      if (created.role === 'parent' && guardianStudentIds.length > 0) {
        await tx.guardianStudent.createMany({
          data: guardianStudentIds.map((studentId) => ({ guardianId: created.id, studentId, relation: 'Diğer' })),
        });
      }
      return created;
    });
  }

  async updateUser(id: string, data: any, requireStudent = false): Promise<User> {
    // Destructure to separate scalar fields from relations and metadata
    const { 
      id: _, 
      createdAt: __, 
      assignedCategories, 
      assignedCategoryIds,
      class: studentClass,
      classes,
      classIds,
      guardianStudentIds,
      ...updateData 
    } = data;
    
    // Prepare update data with only allowed scalar fields
    const prismaData: any = {};
    
    // List of allowed scalar fields for User
    const allowedFields = [
      'name', 'email', 'password', 'role', 'classId',
      'resetToken', 'resetTokenExpiry', 'phoneNumber', 'address',
      'parentName', 'parentRelation', 'parentPhone', 'parentEmail', 'parentAddress',
      'isActive', 'deactivatedAt',
    ];
    
    for (const key of allowedFields) {
      if (updateData[key] !== undefined) {
        prismaData[key] = updateData[key];
      }
    }

    // A non-student account must not retain enrollment/contact-only student data.
    if (prismaData.role && ['teacher', 'admin', 'parent'].includes(prismaData.role)) {
      prismaData.classId = null;
      prismaData.studentNo = null;
      prismaData.classNo = null;
      prismaData.parentName = null;
      prismaData.parentRelation = null;
      prismaData.parentPhone = null;
      prismaData.parentEmail = null;
      prismaData.parentAddress = null;
    }

    // Handle teacher categories if provided
    if (Array.isArray(assignedCategoryIds)) {
      prismaData.assignedCategories = {
        set: assignedCategoryIds.map((catId: string) => ({ id: catId }))
      };
    }

    // Handle teacher classes if provided
    if (Array.isArray(classIds)) {
      prismaData.managedClasses = {
        set: classIds.map((classId: string) => ({ id: classId }))
      };
    }

    const updated = await writeTransaction(async (tx) => {
      const currentUser = await tx.user.findUnique({ where: { id }, select: { role: true, classId: true, isActive: true } });
      if (requireStudent && currentUser?.role !== 'student') throw new Error('INVALID_STUDENT');
      const resultingRole = prismaData.role || currentUser?.role;
      const resultingClassId = prismaData.classId === undefined ? currentUser?.classId : prismaData.classId;
      const resultingActive = prismaData.isActive === undefined ? currentUser?.isActive : prismaData.isActive;
      if (resultingRole === 'student' && resultingClassId) {
        const occupiesNewSeat = resultingActive && (currentUser?.role !== 'student' || !currentUser.isActive || currentUser.classId !== resultingClassId);
        if (occupiesNewSeat || currentUser?.classId !== resultingClassId) await assertClassCapacity(tx, resultingClassId, occupiesNewSeat ? 1 : null, [id]);
      }
      if (prismaData.password !== undefined || (prismaData.role !== undefined && prismaData.role !== currentUser?.role)) {
        prismaData.sessionVersion = { increment: 1 };
      }
      if (currentUser && prismaData.role !== undefined && currentUser.role !== prismaData.role) {
        if (currentUser.role === 'parent') {
          await tx.guardianStudent.deleteMany({ where: { guardianId: id } });
        }
        if (currentUser.role === 'student') {
          await tx.guardianStudent.deleteMany({ where: { studentId: id } });
        }
        if (currentUser.role === 'teacher') {
          await tx.class.updateMany({ where: { classTeacherId: id }, data: { classTeacherId: null } });
          await tx.classTeacherCourse.deleteMany({ where: { teacherId: id } });
          prismaData.assignedCategories = { set: [] };
          prismaData.managedClasses = { set: [] };
        }
      }

      if (resultingRole === 'student' && prismaData.classId !== undefined && (prismaData.classId !== currentUser?.classId || currentUser?.role !== 'student')) {
        if (prismaData.classId) {
          const highest = await tx.user.aggregate({
            where: { role: 'student', classId: prismaData.classId, id: { not: id } },
            _max: { studentNo: true },
          });
          prismaData.studentNo = (highest._max.studentNo || 0) + 1;
        } else {
          prismaData.studentNo = null;
        }
        prismaData.classNo = null;
      }

      const user = await tx.user.update({
        where: { id },
        data: prismaData,
        include: { class: true, assignedCategories: true, managedClasses: true }
      });
      if (user.role === 'parent' && Array.isArray(guardianStudentIds)) {
        const uniqueStudentIds = [...new Set(guardianStudentIds as string[])];
        await tx.guardianStudent.deleteMany({ where: { guardianId: id } });
        if (uniqueStudentIds.length > 0) {
          await tx.guardianStudent.createMany({
            data: uniqueStudentIds.map((studentId) => ({ guardianId: id, studentId, relation: 'Diğer' })),
          });
        }
      }
      return user;
    });
    
    return { ...updated, classes: (updated as any).managedClasses } as unknown as User;
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    await this.updateUser(userId, { role } as any);
  }

  async getAllUsers(): Promise<User[]> {
    const users = await prisma.user.findMany({
      where: { OR: [{ role: { not: 'student' } }, { isActive: true }] },
      include: {
        class: true,
        assignedCategories: true,
        managedClasses: true,
        // Öğretmenin sorumlu olduğu sınıflar (classTeacherId üzerinden)
        responsibleForClasses: { select: { id: true, name: true } },
        teacherAssignments: {
          include: { class: true, category: true }
        }
      }
    });
    
    return users.map(u => {
      const combinedClasses = new Map();
      const combinedCategories = new Map();
      
      (u as any).managedClasses?.forEach((c: any) => combinedClasses.set(c.id, c));
      (u as any).assignedCategories?.forEach((c: any) => combinedCategories.set(c.id, c));
      
      (u as any).teacherAssignments?.forEach((ta: any) => {
        combinedClasses.set(ta.class.id, ta.class);
        combinedCategories.set(ta.category.id, ta.category);
      });

      return { 
        ...u, 
        classes: Array.from(combinedClasses.values()),
        assignedCategories: Array.from(combinedCategories.values())
      };
    }) as unknown as User[];
  }

  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }

  async deactivateStudent(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { isActive: false, deactivatedAt: new Date() },
    });
  }

  async getGuardianStudents(guardianId: string): Promise<any[]> {
    return prisma.guardianStudent.findMany({
      where: { guardianId, student: { isActive: true } },
      include: { student: { include: { class: true } } },
      orderBy: { student: { name: 'asc' } },
    });
  }

  async getStudentGuardians(studentId: string): Promise<any[]> {
    return prisma.guardianStudent.findMany({
      where: { studentId },
      include: { guardian: { select: { id: true, name: true, email: true, phoneNumber: true, address: true, role: true } } },
      orderBy: { guardian: { name: 'asc' } },
    });
  }

  async replaceGuardianStudents(guardianId: string, studentIds: string[]): Promise<any[]> {
    const uniqueStudentIds = [...new Set(studentIds)];
    await prisma.$transaction(async (tx) => {
      await tx.guardianStudent.deleteMany({ where: { guardianId } });
      if (uniqueStudentIds.length > 0) {
        await tx.guardianStudent.createMany({
          data: uniqueStudentIds.map((studentId) => ({ guardianId, studentId, relation: 'Diğer' })),
        });
      }
    });
    return this.getGuardianStudents(guardianId);
  }

  async linkGuardianStudent(guardianId: string, studentId: string, relation?: string | null): Promise<any> {
    return prisma.guardianStudent.upsert({
      where: { guardianId_studentId: { guardianId, studentId } },
      create: { guardianId, studentId, relation: relation || 'Diğer' },
      update: { relation: relation || 'Diğer' },
    });
  }

  async unlinkGuardianStudent(guardianId: string, studentId: string): Promise<void> {
    await prisma.guardianStudent.delete({ where: { guardianId_studentId: { guardianId, studentId } } });
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
              where: { role: 'student', isActive: true }
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
    await writeTransaction(async tx => {
    const teacher = await tx.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'teacher' || !teacher.isActive) throw new Error('INVALID_CLASS_TEACHER');
    if (!await tx.class.findUnique({ where: { id: classId } })) throw new Error('CLASS_NOT_FOUND');
    if (!await tx.category.findUnique({ where: { id: categoryId } })) throw new Error('CATEGORY_NOT_FOUND');
    await tx.classTeacherCourse.upsert({
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
    });
  }

  async removeTeacherFromClassWithCourse(assignmentId: string): Promise<void> {
    await prisma.classTeacherCourse.delete({
      where: { id: assignmentId }
    });
  }
  async createClass(cls: Prisma.ClassUncheckedCreateInput & { teacherId?: string | null }): Promise<Class> {
    validateClassCapacity(cls.maxStudents);
    return writeTransaction(async tx => {
      const existingClass = await tx.class.findFirst({ where: { name: cls.name } });
      if (existingClass) throw new Error("CLASS_EXISTS");

      const classTeacherId = Object.prototype.hasOwnProperty.call(cls, 'classTeacherId')
        ? cls.classTeacherId : cls.teacherId;
      const data = {
        name: cls.name,
        description: cls.description,
        maxStudents: cls.maxStudents,
        classTeacherId: classTeacherId ?? null,
      };

      if (data.classTeacherId) {
        const teacher = await tx.user.findUnique({ where: { id: data.classTeacherId } });
        if (!teacher || teacher.role !== 'teacher' || !teacher.isActive) throw new Error('INVALID_CLASS_TEACHER');
      }
      const created = await tx.class.create({
        data,
        include: { teachers: true, classTeacher: true, assignedCategories: true }
      });

      return created as unknown as Class;
    });
  }

  async updateClass(id: string, data: Partial<Prisma.ClassUncheckedCreateInput>): Promise<Class | undefined> {
    try {
      return await writeTransaction(async tx => {
        const current = await tx.class.findUnique({ where: { id } });
        if (!current) return undefined;
        if (data.maxStudents !== undefined) await assertClassCapacity(tx, id, 0, [], data.maxStudents);
        if (data.classTeacherId) {
          const teacher = await tx.user.findUnique({ where: { id: data.classTeacherId } });
          if (!teacher || teacher.role !== 'teacher' || !teacher.isActive) throw new Error('INVALID_CLASS_TEACHER');
        }
        if (data.name) {
          const existingClass = await tx.class.findFirst({ where: { name: data.name, id: { not: id } } });
          if (existingClass) throw new Error("CLASS_EXISTS");
        }

        const updated = await tx.class.update({
          where: { id },
          data: {
            name: data.name,
            description: data.description,
            maxStudents: data.maxStudents,
            classTeacherId: data.classTeacherId,
            ...(data.classTeacherId !== undefined && data.classTeacherId !== current.classTeacherId && current.classTeacherId
              ? { teachers: { disconnect: { id: current.classTeacherId } } } : {})
          },
          include: { teachers: true, classTeacher: true, assignedCategories: true }
        });
        return updated as unknown as Class;
      });
    } catch (e: any) {
      if (e.code === "P2025") return undefined;
      throw e;
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
          { classTeacherId: teacherId },
          { teacherAssignments: { some: { teacherId } } }
        ]
      },
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
    return classes as unknown as Class[];
  }

  async assignStudentToClass(studentId: string, classId: string): Promise<void> {
    await this.updateUser(studentId, { classId }, true);

  }


  async removeStudentFromClass(studentId: string): Promise<void> {
    await prisma.user.update({ where: { id: studentId }, data: { classId: null, studentNo: null, classNo: null } });
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
        role: 'student',
        isActive: true,
      } 
    });
  }

  async getStudentsByTeacher(teacherId: string): Promise<User[]> {
    return await prisma.user.findMany({
      where: {
        role: 'student',
        isActive: true,
        class: {
          is: {
            OR: [
              { classTeacherId: teacherId },
              { teachers: { some: { id: teacherId } } },
              { teacherAssignments: { some: { teacherId } } },
            ],
          },
        },
      },
      include: { class: true },
      orderBy: [
        { class: { name: 'asc' } },
        { studentNo: 'asc' },
        { name: 'asc' },
      ],
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
  async getAllQuizzes(filters?: { studentClassId?: string | null }): Promise<Quiz[]> {
    const quizzes = await prisma.quiz.findMany({
      where: filters && "studentClassId" in filters ? {
        status: "published", contentType: "exam",
        assignedClasses: filters.studentClassId ? { some: { id: filters.studentClassId } } : { none: {} },
      } : undefined,
      include: {
        _count: {
          select: { 
            questions: true,
            results: {
              where: {
                student: { role: 'student' }
              }
            },
            surveySubmissions: true
          }
        },
        category: true, creator: { select: { id: true, name: true, role: true } },
        assignedClasses: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return quizzes.map(q => ({ 
      ...q, 
      category: q.category?.name || 'General',
      questionCount: q._count.questions,
      participantCount: q.contentType === 'survey' ? q._count.surveySubmissions : q._count.results
    })) as unknown as Quiz[];
  }

  async getQuiz(id: string): Promise<Quiz | undefined> {
    const quiz = await prisma.quiz.findUnique({ 
      where: { id },
      include: { category: true, creator: { select: { id: true, name: true, role: true } }, assignedClasses: true }
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
            },
            surveySubmissions: true
          }
        },
        category: true, creator: { select: { id: true, name: true, role: true } },
        assignedClasses: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return quizzes.map(q => ({ 
      ...q, 
      category: q.category?.name || 'General',
      questionCount: q._count.questions,
      participantCount: q.contentType === 'survey' ? q._count.surveySubmissions : q._count.results
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
        contentType: quiz.contentType || 'exam',
        publishedAt: quiz.publishedAt,
        audienceSize: quiz.audienceSize,
        createdBy: quiz.createdBy,
        assignedClasses: quiz.assignedClassIds ? {
          connect: quiz.assignedClassIds.map(id => ({ id }))
        } : undefined,
      },
      include: { assignedClasses: true, creator: { select: { id: true, name: true, role: true } } }
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
        contentType: quiz.contentType,
        publishedAt: quiz.publishedAt,
        audienceSize: quiz.audienceSize,
        assignedClasses: quiz.assignedClassIds ? {
          set: quiz.assignedClassIds.map(id => ({ id }))
        } : undefined,
      },
      include: { assignedClasses: true, creator: { select: { id: true, name: true, role: true } } }
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

  async getSurveySubmissions(surveyId: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    return prisma.surveySubmission.findMany({
      where: {
        surveyId,
        ...(startDate || endDate ? {
          submittedAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        } : {}),
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, classId: true } },
        answers: {
          include: { question: { select: { id: true, text: true, type: true, options: true, order: true } } },
          orderBy: { question: { order: 'asc' } },
        },
      },
    });
  }

  async getStudentSurveySubmission(surveyId: string, studentId: string): Promise<any | undefined> {
    const submission = await prisma.surveySubmission.findUnique({
      where: { surveyId_studentId: { surveyId, studentId } },
      include: { answers: true },
    });
    return submission || undefined;
  }

  async createSurveySubmission(
    surveyId: string,
    studentId: string,
    answers: Array<{ questionId: string; value: unknown }>,
  ): Promise<any> {
    return prisma.surveySubmission.create({
      data: {
        surveyId,
        studentId,
        answers: {
          create: answers.map((answer) => ({
            questionId: answer.questionId,
            value: JSON.stringify(answer.value),
          })),
        },
      },
      include: { answers: true },
    });
  }
  // Question methods
  async getQuestionsByQuiz(quizId: string): Promise<Question[]> {
    const questions = await prisma.question.findMany({ where: { quizId }, orderBy: { order: 'asc' } });
    return questions.map((question) => ({
      ...question,
      options: question.options ? JSON.parse(question.options) : [],
      config: question.config ? JSON.parse(question.config) : null,
    })) as unknown as Question[];
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    const question = await prisma.question.findUnique({ where: { id } });
    if (!question) return undefined;
    return {
      ...question,
      options: question.options ? JSON.parse(question.options) : [],
      config: question.config ? JSON.parse(question.config) : null,
    } as unknown as Question;
  }

  async createQuestion(q: Prisma.QuestionUncheckedCreateInput & { options?: any; config?: any }): Promise<Question> {
    const created = await prisma.question.create({
      data: {
        quizId: q.quizId,
        text: q.text,
        type: q.type,
        options: JSON.stringify(q.options || []),
        correctAnswer: q.correctAnswer || null,
        config: q.config ? JSON.stringify(q.config) : null,
        imageUrl: q.imageUrl,
        order: q.order,
      }
    });
    return {
      ...created,
      options: created.options ? JSON.parse(created.options) : [],
      config: created.config ? JSON.parse(created.config) : null,
    } as unknown as Question;
  }

  async createQuestions(questions: (Prisma.QuestionUncheckedCreateInput & { options?: any; config?: any })[]): Promise<Question[]> {
    if (questions.length === 0) return [];
    await prisma.question.createMany({
      data: questions.map((q) => ({
        quizId: q.quizId as string,
        text: q.text as string,
        type: q.type as string,
        options: JSON.stringify(q.options || []),
        correctAnswer: (q.correctAnswer as string | null | undefined) || null,
        config: q.config ? JSON.stringify(q.config) : null,
        imageUrl: (q.imageUrl as string | null | undefined) ?? null,
        order: q.order as number,
      })),
    });
    return this.getQuestionsByQuiz(questions[0].quizId as string);
  }

  async deleteQuestion(id: string): Promise<void> {
    await prisma.question.delete({ where: { id } });
  }

  async deleteQuestionsByQuiz(quizId: string): Promise<void> {
    await prisma.question.deleteMany({ where: { quizId } });
  }

  async syncQuestions(quizId: string, questions: (Omit<Prisma.QuestionUncheckedCreateInput, 'options' | 'config' | 'correctAnswer'> & { options?: any; config?: any; correctAnswer?: string | null })[]): Promise<Question[]> {
    await writeTransaction(tx => this.syncQuestionsInTransaction(tx, quizId, questions));
    return this.getQuestionsByQuiz(quizId);
  }

  async deleteQuizWithAudit(id: string, actorId: string, reason: string): Promise<void> {
    await writeTransaction(async tx => {
      const quiz = await tx.quiz.findUniqueOrThrow({ where: { id }, include: {
        _count: { select: { questions: true, results: true, surveySubmissions: true } },
      } });
      await tx.quiz.delete({ where: { id } });
      await tx.actionLog.create({ data: { userId: actorId, action: 'DELETE_QUIZ', details: JSON.stringify({
        quizId: id, title: quiz.title, reason, questions: quiz._count.questions,
        results: quiz._count.results, surveySubmissions: quiz._count.surveySubmissions,
      }) } });
    });
  }

  private async syncQuestionsInTransaction(tx: Prisma.TransactionClient, quizId: string, questions: ContentQuestionInput[]): Promise<void> {
      const existing = await tx.question.findMany({ where: { quizId } });
      const existingIds = new Set(existing.map(q => q.id));
      const incomingIds = questions.filter(q => q.id).map(q => q.id!);
      if (new Set(incomingIds).size !== incomingIds.length || incomingIds.some(id => !existingIds.has(id))) {
        throw new Error("INVALID_QUESTION_ID");
      }
      const normalize = (q: any) => ({
        text: q.text, type: q.type,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options || [],
        correctAnswer: q.correctAnswer || null,
        config: typeof q.config === 'string' ? JSON.parse(q.config) : q.config || null,
        imageUrl: q.imageUrl ?? null, order: q.order,
      });
      const existingById = new Map(existing.map(q => [q.id, q]));
      const unchanged = questions.length === existing.length &&
        questions.every(q => q.id && isDeepStrictEqual(normalize(q), normalize(existingById.get(q.id))));
      if (unchanged) return;
      const participation = await tx.studentResult.count({ where: { quizId } });
      const submissions = await tx.surveySubmission.count({ where: { surveyId: quizId } });
      if (participation || submissions) throw new Error("CONTENT_HAS_RESPONSES");
      await tx.question.deleteMany({ where: { quizId, id: { notIn: incomingIds } } });
      for (const q of questions) {
        const data = {
          quizId, text: q.text, type: q.type,
          options: JSON.stringify(q.options || []),
          correctAnswer: q.correctAnswer || null,
          config: q.config ? JSON.stringify(q.config) : null,
          imageUrl: q.imageUrl ?? null, order: q.order,
        };
        if (q.id) await tx.question.update({ where: { id: q.id }, data });
        else await tx.question.create({ data });
      }
  }

  async saveContent(id: string, settings: ContentSettingsInput, questions: ContentQuestionInput[], actor: { id: string; role: string }) {
    return writeTransaction(async tx => {
      const existing = await tx.quiz.findUnique({ where: { id } });
      if (existing && existing.contentType !== settings.contentType) throw new Error('CONTENT_TYPE_MISMATCH');
      if (existing && actor.role !== 'admin' && existing.createdBy !== actor.id) throw new Error('CONTENT_FORBIDDEN');
      if (settings.status === 'published' && questions.length === 0) throw new Error('CONTENT_EMPTY');
      // Authorization is checked again in the write transaction, so assignment cannot
      // slip through if a teacher loses responsibility while the request is saving.
      if (actor.role !== 'admin' && settings.assignedClassIds.length) {
        const allowed = await tx.class.count({ where: { id: { in: settings.assignedClassIds }, OR: [{ teachers: { some: { id: actor.id } } }, { classTeacherId: actor.id }, { teacherAssignments: { some: { teacherId: actor.id } } }] } });
        if (allowed !== new Set(settings.assignedClassIds).size) throw new Error('CONTENT_FORBIDDEN');
      }
      const published = settings.status === 'published' && existing?.status !== 'published';
      const audienceSize = published ? await tx.user.count({ where: { role: 'student', isActive: true, classId: { in: settings.assignedClassIds } } }) : existing?.audienceSize;
      const data = {
        title: settings.title, description: settings.description, categoryId: settings.categoryId,
        difficulty: settings.difficulty, timeLimit: settings.timeLimit, shuffleQuestions: settings.shuffleQuestions,
        status: settings.status, contentType: settings.contentType,
        ...(published ? { publishedAt: new Date(), audienceSize } : {}),
        assignedClasses: { set: settings.assignedClassIds.map(id => ({ id })) },
      };
      let quiz;
      if (existing) quiz = await tx.quiz.update({ where: { id }, data, include: { assignedClasses: true } });
      else {
        const { assignedClasses: _assignments, ...creation } = data;
        quiz = await tx.quiz.create({ data: { ...creation, id, createdBy: actor.id, assignedClasses: { connect: settings.assignedClassIds.map(id => ({ id })) } }, include: { assignedClasses: true } });
      }
      // A repeated request after a lost response may still contain new questions
      // without IDs. Match unchanged questions before syncing to keep their IDs.
      const current = await tx.question.findMany({ where: { quizId: id }, orderBy: { order: 'asc' } });
      const normalized = questions.map((q, index) => {
        const old = current[index];
        if (!q.id && old && old.text === q.text && old.type === q.type && old.options === JSON.stringify(q.options || []) && old.correctAnswer === (q.correctAnswer || null) && old.config === (q.config ? JSON.stringify(q.config) : null) && old.imageUrl === (q.imageUrl ?? null) && old.order === q.order) return { ...q, id: old.id };
        return q;
      });
      await this.syncQuestionsInTransaction(tx, id, normalized);
      const saved = await tx.question.findMany({ where: { quizId: id }, orderBy: { order: 'asc' } });
      return { quiz: quiz as unknown as Quiz, questions: saved.map(q => ({ ...q, options: JSON.parse(q.options || '[]'), config: q.config ? JSON.parse(q.config) : null })) as unknown as Question[], created: !existing, published };
    });
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

  async createQuestionBankItem(item: Omit<Prisma.QuestionBankUncheckedCreateInput, 'id' | 'createdAt' | 'options'> & { options?: any }): Promise<QuestionBank> {
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
  async getFilteredResults(filters: { quizId?: string; categoryId?: string; classId?: string; studentId?: string; createdBy?: string }): Promise<StudentResult[]> {
    const where: Prisma.StudentResultWhereInput = {};
    if (filters.quizId) where.quizId = filters.quizId;
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.classId) where.student = { classId: filters.classId };
    where.quiz = {
      contentType: 'exam',
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.createdBy ? { createdBy: filters.createdBy } : {}),
    };
    const results = await prisma.studentResult.findMany({
      where,
      include: {
        student: { select: resultStudentSelect },
        quiz: { include: { category: true, creator: { select: { id: true, name: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return results.map((result) => ({
      ...result,
      answers: result.answers ? JSON.parse(result.answers) : {},
    })) as unknown as StudentResult[];
  }
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
      include: { student: { select: resultStudentSelect } },
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
      include: { student: { select: resultStudentSelect } },
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
    const created = await writeTransaction(async tx => {
      const existing = await tx.studentResult.findFirst({ where: { studentId: r.studentId, quizId: r.quizId }, orderBy: { startedAt: 'desc' } });
      if (existing) return existing;
      return tx.studentResult.create({ data: {
        studentId: r.studentId, quizId: r.quizId, status: r.status || "in_progress",
        answers: JSON.stringify(r.answers || {}), totalQuestions: r.totalQuestions || 0,
        startedAt: r.startedAt || new Date(),
      } });
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

  async saveResultAnswer(id: string, studentId: string, questionId: string, answer: string): Promise<void> {
    await writeTransaction(async tx => {
      const result = await tx.studentResult.findUnique({ where: { id }, include: { quiz: true } });
      if (!result || result.studentId !== studentId) throw new Error("RESULT_FORBIDDEN");
      if (result.status !== "in_progress") throw new Error("RESULT_COMPLETED");
      if (result.quiz.timeLimit && Date.now() >= result.startedAt.getTime() + result.quiz.timeLimit * 60000) throw new Error("RESULT_EXPIRED");
      const questions = await tx.question.findMany({ where: { quizId: result.quizId } });
      if (!questions.some(q => q.id === questionId)) throw new Error("INVALID_QUESTION_ID");
      const answers = { ...JSON.parse(result.answers || "{}"), [questionId]: answer };
      const correct = questions.filter(q => answers[q.id] === q.correctAnswer).length;
      await tx.studentResult.update({ where: { id }, data: { answers: JSON.stringify(answers), correctAnswersCount: correct } });
    });
  }

  async completeResult(id: string, studentId: string, incomingAnswers: Record<string, string>) {
    return writeTransaction(async tx => {
      const result = await tx.studentResult.findUnique({ where: { id }, include: { quiz: true } });
      if (!result || result.studentId !== studentId) throw new Error("RESULT_FORBIDDEN");
      if (result.status === "completed") return {
        score: result.score || 0, correctAnswers: result.correctAnswersCount,
        totalQuestions: result.totalQuestions, acceptedQueuedAnswers: false, newlyCompleted: false,
      };
      if (result.status !== "in_progress") throw new Error("RESULT_COMPLETED");
      const questions = await tx.question.findMany({ where: { quizId: result.quizId } });
      const validIds = new Set(questions.map(q => q.id));
      if (Object.keys(incomingAnswers).some(key => !validIds.has(key))) throw new Error("INVALID_QUESTION_ID");
      const acceptedQueuedAnswers = !result.quiz.timeLimit || Date.now() < result.startedAt.getTime() + result.quiz.timeLimit * 60000;
      const answers = { ...JSON.parse(result.answers || "{}"), ...(acceptedQueuedAnswers ? incomingAnswers : {}) };
      const correct = questions.filter(q => answers[q.id] === q.correctAnswer).length;
      const score = questions.length ? Math.round(correct / questions.length * 100) : 0;
      const now = new Date();
      await tx.studentResult.update({ where: { id }, data: {
        status: "completed", answers: JSON.stringify(answers), score, correctAnswersCount: correct,
        totalQuestions: questions.length, submittedAt: now, completedAt: now,
        timeTaken: Math.max(0, Math.floor((now.getTime() - result.startedAt.getTime()) / 1000)),
      } });
      return { score, correctAnswers: correct, totalQuestions: questions.length, acceptedQueuedAnswers, newlyCompleted: true };
    });
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

  async getClassAnalytics(classIds: string[], startDate: Date, endDate: Date): Promise<any[]> {
    if (classIds.length === 0) return [];
    const classes = await prisma.class.findMany({
      where: { id: { in: classIds } },
      orderBy: { name: 'asc' },
      include: {
        students: {
          where: { role: 'student', isActive: true },
          select: {
            id: true,
            results: {
              where: {
                status: 'completed',
                submittedAt: { gte: startDate, lte: endDate },
                score: { not: null },
              },
              select: { score: true, quizId: true, studentId: true },
            },
          },
        },
      },
    });

    return classes.map((classroom) => {
      const results = classroom.students.flatMap((student) => student.results);
      const participantIds = new Set(results.map((result) => result.studentId));
      const scoreTotal = results.reduce((total, result) => total + (result.score ?? 0), 0);
      return {
        classId: classroom.id,
        className: classroom.name,
        studentCount: classroom.students.length,
        participantCount: participantIds.size,
        completedCount: results.length,
        averageScore: results.length > 0 ? Math.round(scoreTotal / results.length) : 0,
        participationRate: classroom.students.length > 0
          ? Math.round((participantIds.size / classroom.students.length) * 100)
          : 0,
      };
    });
  }

  async getDashboardOverview(role: string, userId: string): Promise<any[]> {
    const quizzes = await prisma.quiz.findMany({
      where: {
        status: 'published',
        contentType: 'exam',
        ...(role === 'teacher' ? { createdBy: userId } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      include: {
        category: { select: { name: true } },
        assignedClasses: {
          select: {
            students: { where: { role: 'student', isActive: true }, select: { id: true } },
          },
        },
        results: {
          where: { status: 'completed' },
          select: { studentId: true },
        },
      },
    });

    return quizzes.map((quiz) => {
      const assignedIds = new Set(quiz.assignedClasses.flatMap((classroom) => classroom.students.map((student) => student.id)));
      const participantIds = new Set(quiz.results.map((result) => result.studentId));
      const assignedStudents = quiz.audienceSize ?? assignedIds.size;
      const participants = participantIds.size;
      return {
        id: quiz.id,
        title: quiz.title,
        category: quiz.category?.name || 'Genel',
        createdAt: quiz.createdAt,
        assignedStudents,
        participants,
        participationRate: assignedStudents > 0 ? Math.min(100, Math.round((participants / assignedStudents) * 100)) : 0,
      };
    });
  }

  // Notification methods
  async getUserNotifications(userId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number; unread: number }> {
    const skip = (page - 1) * limit;
    const [data, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { data, total, unread };
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

  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    const result = await prisma.notification.deleteMany({
      where: { id: notificationId, userId }
    });
    return result.count > 0;
  }

  async getNotificationPreferences(userId: string): Promise<{ muted: boolean }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationMuted: true }
    });
    return { muted: user?.notificationMuted ?? false };
  }

  async updateNotificationPreferences(userId: string, muted: boolean): Promise<{ muted: boolean }> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { notificationMuted: muted },
      select: { notificationMuted: true }
    });
    return { muted: user.notificationMuted };
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
  async getArchiveCandidates(): Promise<{ quizzes: number, results: number }> {
    const [quizzes, results] = await prisma.$transaction([
      prisma.quiz.count({ where: { academicYear: null, status: { not: 'archived' } } }),
      prisma.studentResult.count({ where: { academicYear: null } }),
    ]);
    return { quizzes, results };
  }

  async archiveQuizzesAndResults(academicYear: string, actorId?: string): Promise<{ quizzesArchived: number, resultsArchived: number }> {
    return writeTransaction(async tx => {
    const quizzesUpdate = await tx.quiz.updateMany({
      where: { academicYear: null, status: { not: 'archived' } },
      data: { status: 'archived', academicYear }
    });

    const resultsUpdate = await tx.studentResult.updateMany({
      where: { academicYear: null },
      data: { academicYear }
    });

    const result = {
      quizzesArchived: quizzesUpdate.count,
      resultsArchived: resultsUpdate.count
    };
    if (actorId) await tx.actionLog.create({ data: {
      userId: actorId, action: 'ARCHIVE_YEAR',
      details: `Yıl sonu arşivi yapıldı: ${academicYear}. Sınavlar: ${result.quizzesArchived}, Sonuçlar: ${result.resultsArchived}`,
    } });
    return result;
    });
  }

  async promoteStudents(fromClassId: string, toClassId: string | null, academicYear?: string): Promise<number> {
    if (fromClassId === toClassId) return 0;
    return writeTransaction(async tx => {
      const students = await tx.user.findMany({ where: { role: "student", classId: fromClassId }, orderBy: { id: "asc" } });
      if (toClassId) await assertClassCapacity(tx, toClassId, students.filter(student => student.isActive).length || null);
      const ids = students.map(student => student.id);
      if (academicYear && ids.length) await tx.studentResult.updateMany({
        where: { studentId: { in: ids }, academicYear: null, status: "completed" }, data: { academicYear },
      });
      const highest = toClassId ? await tx.user.aggregate({ where: { classId: toClassId, role: "student" }, _max: { studentNo: true } }) : null;
      let number = highest?._max.studentNo || 0;
      for (const student of students) await tx.user.update({
        where: { id: student.id }, data: { classId: toClassId, studentNo: toClassId ? ++number : null, classNo: null },
      });
      return students.length;
    });
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
    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        createdBy: data.createdBy,
        targetRole: data.targetRole || "all",
        targetClassId: data.targetClassId || null
      },
      include: { creator: { select: { name: true, role: true } } }
    });

    return announcement;
  }

  async getAllAnnouncements(): Promise<any[]> {
    return await prisma.announcement.findMany({
      include: { creator: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await prisma.announcement.delete({ where: { id } });
  }

  async getSystemLogs(filters?: { search?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number }): Promise<{ data: ActionLog[]; total: number }> {
    const systemActions = ["ARCHIVE_YEAR", "PROMOTE_STUDENTS", "PURGE_ARCHIVED_DATA", "SYSTEM_BACKUP", "SYSTEM_ERROR", "SYSTEM_INIT"];
    const where: Prisma.ActionLogWhereInput = {
      OR: [
        { action: { in: systemActions } },
        { action: { startsWith: "SYSTEM_" } },
        { details: { contains: "Hata" } },
        { details: { contains: "Error" } },
      ]
    };
    if (filters?.search) {
      where.AND = [
        {
          OR: [
            { action: { contains: filters.search } },
            { details: { contains: filters.search } },
          ]
        }
      ];
    }
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

  async databaseHealth(): Promise<boolean> {
    await prisma.user.findFirst({ select: { id: true } });
    return true;
  }

  async pruneOperationalData(cutoffs: {
    actionLogsBefore: Date;
    readNotificationsBefore: Date;
    emailLogsBefore: Date;
    passwordResetsBefore: Date;
  }): Promise<{ actionLogs: number; readNotifications: number; emailLogs: number; passwordResets: number }> {
    return prisma.$transaction(async (tx) => {
      const passwordResets = await tx.passwordResetRequest.deleteMany({
        where: {
          status: { in: ["completed", "cancelled", "expired", "failed"] },
          updatedAt: { lt: cutoffs.passwordResetsBefore },
        },
      });
      const emailLogs = await tx.emailQueue.deleteMany({
        where: {
          status: { in: ["sent", "failed"] },
          createdAt: { lt: cutoffs.emailLogsBefore },
          passwordResetRequest: null,
        },
      });
      const readNotifications = await tx.notification.deleteMany({
        where: {
          isRead: true,
          createdAt: { lt: cutoffs.readNotificationsBefore },
        },
      });
      const actionLogs = await tx.actionLog.deleteMany({
        // Archive audit also stores durable recovery cycles and lifetime attempt totals.
        where: { createdAt: { lt: cutoffs.actionLogsBefore }, action: { not: { startsWith: 'ARCHIVE_' } } },
      });

      return {
        actionLogs: actionLogs.count,
        readNotifications: readNotifications.count,
        emailLogs: emailLogs.count,
        passwordResets: passwordResets.count,
      };
    });
  }

  async enqueueEmail(data: { to: string; subject: string; body: string; type?: string; maxAttempts?: number }): Promise<EmailQueue> {
    return await prisma.emailQueue.create({
      data: {
        to: data.to,
        subject: data.subject,
        body: data.body,
        type: data.type || "notification",
        status: "pending",
        maxAttempts: data.maxAttempts || 3,
      }
    });
  }

  async getEmailLogs(filters?: { status?: string; search?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number }): Promise<{ data: EmailQueue[]; total: number; counts: { total: number; sent: number; pending: number; failed: number } }> {
    const where: Prisma.EmailQueueWhereInput = {};
    if (filters?.status && filters.status !== 'all') {
      where.status = filters.status;
    }
    if (filters?.search) {
      where.OR = [
        { to: { contains: filters.search } },
        { subject: { contains: filters.search } },
        { type: { contains: filters.search } },
      ];
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 100;
    const skip = (page - 1) * limit;

    const [data, total, totalAll, sentCount, pendingCount, failedCount] = await Promise.all([
      prisma.emailQueue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.emailQueue.count({ where }),
      prisma.emailQueue.count(),
      prisma.emailQueue.count({ where: { status: 'sent' } }),
      prisma.emailQueue.count({ where: { status: 'pending' } }),
      prisma.emailQueue.count({ where: { status: 'failed' } }),
    ]);

    return {
      data,
      total,
      counts: {
        total: totalAll,
        sent: sentCount,
        pending: pendingCount,
        failed: failedCount,
      }
    };
  }

  async retryEmail(id: string): Promise<EmailQueue | null> {
    const email = await prisma.emailQueue.findUnique({ where: { id } });
    if (!email || (email.processingUntil && email.processingUntil > new Date())) return null;
    return await prisma.emailQueue.update({
      where: { id },
      data: {
        status: 'pending',
        processingUntil: null,
        attempts: 0,
        errorMessage: null,
      }
    });
  }

  async deleteEmailLog(id: string): Promise<boolean> {
    try {
      await prisma.emailQueue.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getPendingEmails(limit = 10): Promise<EmailQueue[]> {
    return await prisma.emailQueue.findMany({
      where: {
        status: 'pending',
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async claimPendingEmails(limit = 1, excludeIds: string[] = []): Promise<EmailQueue[]> {
    return writeTransaction(async tx => {
      const now = new Date();
      const emails = await tx.emailQueue.findMany({
        where: { status: "pending", id: { notIn: excludeIds }, OR: [{ processingUntil: null }, { processingUntil: { lt: now } }] },
        orderBy: { createdAt: "asc" }, take: limit,
      });
      const processingUntil = new Date(now.getTime() + 5 * 60000);
      for (const email of emails) await tx.emailQueue.update({ where: { id: email.id }, data: { processingUntil } });
      return emails.map(email => ({ ...email, processingUntil }));
    });
  }

  async updateEmailStatus(id: string, status: string, errorMessage?: string | null, processingUntil?: Date): Promise<EmailQueue | null> {
    try {
      return await prisma.emailQueue.update({
        where: { id, ...(processingUntil ? { processingUntil } : {}) },
        data: {
          processingUntil: null,
          status,
          errorMessage: errorMessage ?? null,
          lastAttempt: new Date(),
          sentAt: status === 'sent' ? new Date() : undefined,
          attempts: { increment: 1 }
        }
      });
    } catch (err: any) {
      if (err?.code === 'P2025') return null;
      throw err;
    }
  }

  async createPasswordResetRequest(data: { userId: string; email: string; tokenHash: string; expiresAt: Date; requestedBy?: string | null; requestIp?: string | null }): Promise<any> {
    return prisma.passwordResetRequest.create({ data: { ...data, requestedBy: data.requestedBy || null, requestIp: data.requestIp || null } });
  }

  async updatePasswordResetRequest(id: string, data: Record<string, unknown>): Promise<any> {
    return prisma.passwordResetRequest.update({ where: { id }, data: data as any, include: { user: { select: { id: true, name: true, email: true, role: true } }, emailQueue: true } });
  }

  async getPasswordResetRequest(id: string): Promise<any | undefined> {
    return (await prisma.passwordResetRequest.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true, role: true } }, emailQueue: true } })) || undefined;
  }

  async getPasswordResetRequestByToken(tokenHash: string): Promise<any | undefined> {
    return (await prisma.passwordResetRequest.findUnique({ where: { tokenHash }, include: { user: true, emailQueue: true } })) || undefined;
  }

  async getPasswordResetRequests(filters?: { status?: string; search?: string; page?: number; limit?: number }): Promise<{ data: any[]; total: number; counts: Record<string, number> }> {
    const where: Prisma.PasswordResetRequestWhereInput = {};
    if (filters?.status && filters.status !== 'all') where.status = filters.status;
    if (filters?.search) where.OR = [{ email: { contains: filters.search } }, { user: { name: { contains: filters.search } } }];
    const page = filters?.page || 1;
    const limit = filters?.limit || 100;
    const [data, total, pending, completed, cancelled, failed] = await Promise.all([
      prisma.passwordResetRequest.findMany({ where, include: { user: { select: { id: true, name: true, email: true, role: true } }, emailQueue: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.passwordResetRequest.count({ where }),
      prisma.passwordResetRequest.count({ where: { status: 'pending' } }),
      prisma.passwordResetRequest.count({ where: { status: 'completed' } }),
      prisma.passwordResetRequest.count({ where: { status: 'cancelled' } }),
      prisma.passwordResetRequest.count({ where: { status: 'failed' } }),
    ]);
    return { data, total, counts: { pending, completed, cancelled, failed } };
  }

  async cancelPendingPasswordResetRequests(userId: string): Promise<void> {
    await prisma.passwordResetRequest.updateMany({ where: { userId, status: 'pending' }, data: { status: 'cancelled', cancelledAt: new Date() } });
  }
}

export const storage = new PrismaStorage();
