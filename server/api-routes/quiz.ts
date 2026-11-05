import { questionImageUrlSchema } from "../utils/upload-paths";
import { saveContentHandler } from './content-save';
import { archiveContentGuard } from '../middleware/archive-readonly';
import { Router, type Response, type Request } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { getIO } from "../socket";
import { logger } from "../utils/logger";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { canAssignClasses } from "../utils/class-authorization";
import { shouldNotifyAdminAboutQuiz } from "../utils/notification-policy";
import { hasInvalidQuestions } from "../utils/question-validation";

const router: Router = Router();
router.use('/:id', (req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : requireAuth(req, res, () => archiveContentGuard(req, res, next)));
router.put('/:id/content', requireAuth, requireRole(['admin', 'teacher']), saveContentHandler('exam'));

async function notifyAdminsAboutTeacherQuiz(
  actor: NonNullable<AuthRequest["user"]>,
  quiz: { title: string; contentType?: string },
  event: "created" | "published"
) {
  if (actor.role !== "teacher") return;
  try {
    const admins = (await storage.getAllUsers()).filter(user => shouldNotifyAdminAboutQuiz(actor.role, user.role));
    if (admins.length === 0) return;
    const contentLabel = quiz.contentType === "survey" ? "Anket" : "Sınav";
    const title = `Öğretmen ${contentLabel} ${event === "created" ? "Oluşturdu" : "Yayınladı"}`;
    const message = `${actor.name}, "${quiz.title}" adlı ${contentLabel.toLocaleLowerCase("tr-TR")} içeriğini ${event === "created" ? "oluşturdu" : "yayınladı"}.`;

    const notifications = await Promise.all(admins.map(async admin => ({
      userId: admin.id,
      notification: await storage.createNotification({
        userId: admin.id,
        title,
        message,
        type: "quiz",
      }),
    })));

    try {
      const io = getIO();
      notifications.forEach(({ userId, notification }) => {
        io.to(`user_${userId}`).emit("notification", notification);
      });
    } catch (socketError) {
      logger.warn({ err: socketError }, "[Quiz] Bildirimler kaydedildi ancak anlik iletim kullanilamadi.");
    }
  } catch (notificationError) {
    logger.error({ err: notificationError }, "[Quiz] Admin bildirimleri gönderilemedi.");
  }
}

// ==================== SCHEMAS ====================

const quizSchema = z.object({
  title: z.string().min(3, "Başlık en az 3 karakter olmalıdır.").max(100),
  description: z.string().max(500).optional().nullable(),
  categoryId: z.string().uuid("Geçersiz kategori ID.").optional().nullable(),
  category: z.string().optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  timeLimit: z.number().int().positive().optional().nullable(),
  shuffleQuestions: z.boolean().default(false),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  contentType: z.literal("exam").default("exam"),
  assignedClassIds: z.array(z.string().uuid()).optional().default([]),
});

const questionSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().min(1, "Soru metni gereklidir."),
  type: z.string().default("multiple-choice"),
  options: z.array(z.string()).default([]),
  correctAnswer: z.string().optional().nullable(),
  config: z.record(z.any()).optional().nullable(),
  imageUrl: questionImageUrlSchema.optional().nullable(),
  order: z.number().int().default(0),
});

const questionsArraySchema = z.array(questionSchema);

// ==================== QUIZ ROUTES ====================

router.get("/admin/quizzes", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {     
  try {
    let quizzes;
    if (req.user!.role === "admin") {
      quizzes = (await storage.getAllQuizzes()).filter((quiz) => quiz.contentType !== "survey");
    } else {
      quizzes = (await storage.getQuizzesByCreator(req.user!.id)).filter((quiz) => quiz.contentType !== "survey");
    }
    res.json({ quizzes });
  } catch (error) {
    res.status(500).json({ message: "Sınavlar getirilemedi." });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    let quizzes;
    if (req.user!.role === "student") {
      // Öğrenci sadece kendisine atanan ve yayınlanmış quizleri görmeli
      const studentClassId = req.user!.classId;
      const allQuizzes = await storage.getAllQuizzes();
      
      quizzes = allQuizzes.filter(q => {
        const isPublished = q.status === "published";
        const isAssignedToMyClass = studentClassId && (q as any).assignedClasses?.some((c: any) => c.id === studentClassId);
        return q.contentType !== "survey" && isPublished && isAssignedToMyClass;
      });
    } else {
      quizzes = (await storage.getQuizzesByCreator(req.user!.id)).filter((quiz) => quiz.contentType !== "survey");
    }
    res.json({ quizzes });
  } catch (error) {
    res.status(500).json({ message: "Sınavlar getirilemedi." });
  }
});

router.get("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.id);
    if (!quiz || quiz.contentType === "survey") return res.status(404).json({ message: "Sınav bulunamadı." });

    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavı görüntüleme yetkiniz yok." });
    }

    const questions = await storage.getQuestionsByQuiz(quiz.id);
    res.json({ quiz, questions });
  } catch (error) {
    res.status(500).json({ message: "Sınav detayları getirilemedi." });
  }
});

router.post("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = quizSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const { title, description, category, categoryId, difficulty, timeLimit, shuffleQuestions, status, contentType, assignedClassIds } = validation.data;
    if (status === 'published') return res.status(400).json({ message: 'Yayınlamak için önce soruları kaydedin veya içerik kaydetme işlemini kullanın.' });

    if (!await canAssignClasses(req.user!.role, req.user!.id, assignedClassIds)) {
      return res.status(403).json({ message: "Yalnızca sorumlu olduğunuz sınıflara sınav atayabilirsiniz." });
    }

    let finalCategoryId = categoryId;
    if (!finalCategoryId && category) {
      const cats = await storage.getAllCategories();
      const found = cats.find(c => c.name.toLowerCase() === category.toLowerCase());
      if (found) finalCategoryId = found.id;
    }

    const quiz = await storage.createQuiz({
      title,
      description,
      categoryId: finalCategoryId || null,
      difficulty,
      timeLimit,
      shuffleQuestions,
      status,
      contentType,
      createdBy: req.user!.id,
      publishedAt: null,
      audienceSize: null,
      assignedClassIds
    });

    await storage.createLog(req.user!.id, "CREATE_QUIZ", `Created quiz: ${quiz.title}`);
    await notifyAdminsAboutTeacherQuiz(req.user!, quiz, "created");
    res.status(201).json({ quiz });
  } catch (error) {
    console.error("Create quiz error:", error);
    res.status(500).json({ message: "Sınav oluşturulamadı." });
  }
});

router.patch("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = quizSchema.partial().safeParse(req.body);
    if (!validation.success) return res.status(400).json({ message: fromZodError(validation.error).message });

    const existingQuiz = await storage.getQuiz(req.params.id);
    if (!existingQuiz || existingQuiz.contentType === "survey") return res.status(404).json({ message: "Sınav bulunamadı." });
    if (req.user!.role === "teacher" && existingQuiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu icerigi duzenleme yetkiniz yok." });
    }

    if (validation.data.contentType && validation.data.contentType !== existingQuiz.contentType) {
      const [examResults, surveySubmissions] = await Promise.all([
        storage.getResultsByQuiz(existingQuiz.id),
        storage.getSurveySubmissions(existingQuiz.id),
      ]);
      if (existingQuiz.status !== "draft" || examResults.length > 0 || surveySubmissions.length > 0) {
        return res.status(409).json({
          message: "Yayimlanmis veya yanit alinmis bir icerigin turu degistirilemez.",
        });
      }
    }

    const assignedClassIds = validation.data.assignedClassIds;
    if (assignedClassIds && !await canAssignClasses(req.user!.role, req.user!.id, assignedClassIds)) {
      return res.status(403).json({ message: "Yalnizca yetkili oldugunuz siniflara atama yapabilirsiniz." });
    }

    if ((validation.data.status ?? existingQuiz.status) === "published") {
      const questions = await storage.getQuestionsByQuiz(req.params.id);
      if (questions.length === 0 || hasInvalidQuestions('exam', questions)) return res.status(400).json({ message: "Yayınlamak için geçerli sınav soruları gereklidir." });
    }

    const publicationFields: { publishedAt?: Date; audienceSize?: number } = {};
    if (validation.data.status === "published" && existingQuiz.status !== "published") {
      const effectiveClassIds = assignedClassIds || ((existingQuiz as any).assignedClasses || []).map((item: any) => item.id);
      const audienceIds = new Set<string>();
      for (const classId of effectiveClassIds) {
        const students = await storage.getStudentsByClass(classId);
        students.forEach((student) => audienceIds.add(student.id));
      }
      publicationFields.publishedAt = new Date();
      publicationFields.audienceSize = audienceIds.size;
    }

    const quiz = await storage.updateQuiz(req.params.id, {
      ...validation.data,
      ...publicationFields,
      assignedClassIds,
    });
    await storage.createLog(req.user!.id, "UPDATE_QUIZ", `Updated quiz: ${quiz?.title}`);

    if (quiz && existingQuiz.status !== "published" && quiz.status === "published") {
      await notifyAdminsAboutTeacherQuiz(req.user!, quiz, "published");
      const io = getIO();
      for (const classroom of (quiz as any).assignedClasses || []) {
        const students = await storage.getStudentsByClass(classroom.id);
        for (const student of students) {
          const notification = await storage.createNotification({
            userId: student.id,
            title: quiz.contentType === "survey" ? "Yeni Anket" : "Yeni Sınav",
            message: `"${quiz.title}" yayımlandı.`,
            type: "info",
          });
          io.to(`user_${student.id}`).emit("notification", notification);
        }
      }
    }

    res.json({ quiz });
  } catch (error) {
    console.error("Update quiz error:", error);
    res.status(500).json({ message: "İçerik güncellenemedi." });
  }
});

router.post("/:id/questions", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = questionsArraySchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ message: fromZodError(validation.error).message });

    const quiz = await storage.getQuiz(req.params.id);
    if (!quiz || quiz.contentType === "survey") return res.status(404).json({ message: "Sınav bulunamadı." });
    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu içeriğe soru ekleme yetkiniz yok." });
    }

    if (hasInvalidQuestions('exam', validation.data) || (quiz.status === 'published' && validation.data.length === 0)) {
      return res.status(400).json({ message: "Sınav soruları, seçenekleri veya doğru cevap geçersiz." });
    }

    const questions = await storage.syncQuestions(req.params.id, validation.data.map((question) => ({
      id: question.id,
      quizId: req.params.id,
      text: question.text,
      type: question.type,
      options: question.options,
      correctAnswer: question.correctAnswer || null,
      config: question.config,
      imageUrl: question.imageUrl,
      order: question.order,
    })));
    res.status(201).json({ questions });
  } catch (error) {
    logger.error({ err: error }, "Sync questions error");
    if ((error as Error).message === "CONTENT_HAS_RESPONSES") return res.status(409).json({ message: "Katılım başladıktan sonra sorular değiştirilemez. Yeni bir sınav/anket oluşturun." });
    if ((error as Error).message === "INVALID_QUESTION_ID") return res.status(400).json({ message: "Geçersiz soru kimliği." });
    res.status(500).json({ message: "Sorular senkronize edilemedi." });
  }
});

router.delete("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = z.object({ reason: z.string().trim().min(5).max(1000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'En az 5 karakterlik bir silme nedeni gereklidir.' });
    const quiz = await storage.getQuiz(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Sınav bulunamadı." });
    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavı silme yetkiniz yok." });
    }
    await storage.deleteQuizWithAudit(req.params.id, req.user!.id, parsed.data.reason);
    res.json({ message: "Sınav başarıyla silindi." });
  } catch (e) {
    res.status(500).json({ message: "Sınav silinemedi." });
  }
});

export default router;
