import { Router, type Response, type Request } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { getIO } from "../socket";
import { logger } from "../index";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

const router: Router = Router();

// ==================== SCHEMAS ====================

const quizSchema = z.object({
  title: z.string().min(3, "Ba�l�k en az 3 karakter olmal�d�r.").max(100),
  description: z.string().max(500).optional().nullable(),
  categoryId: z.string().uuid("Ge�ersiz kategori ID.").optional().nullable(),
  category: z.string().optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  timeLimit: z.number().int().positive().optional().nullable(),
  shuffleQuestions: z.boolean().default(false),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  assignedClassIds: z.array(z.string().uuid()).optional().default([]),
});

const questionSchema = z.object({
  text: z.string().min(1, "Soru metni gereklidir."),
  type: z.string().default("multiple-choice"),
  options: z.array(z.string()).min(2, "En az 2 se�enek gereklidir."),
  correctAnswer: z.string().min(1, "Do�ru cevap gereklidir."),
  imageUrl: z.string().url().optional().nullable(),
  order: z.number().int().default(0),
});

const questionsArraySchema = z.array(questionSchema);

// ==================== QUIZ ROUTES ====================

router.get("/admin/quizzes", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {     
  try {
    let quizzes;
    if (req.user!.role === "admin") {
      quizzes = await storage.getAllQuizzes();
    } else {
      quizzes = await storage.getQuizzesByCreator(req.user!.id);
    }
    res.json({ quizzes });
  } catch (error) {
    res.status(500).json({ message: "S�navlar getirilemedi." });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    let quizzes;
    if (req.user!.role === "student") {
      // ��renci sadece kendisine atanan ve yay�nlanm�� quizleri g�rmeli
      const studentClassId = req.user!.classId;
      const allQuizzes = await storage.getAllQuizzes();
      
      quizzes = allQuizzes.filter(q => {
        const isPublished = q.status === "published";
        const isAssignedToMyClass = studentClassId && (q as any).assignedClasses?.some((c: any) => c.id === studentClassId);
        return isPublished && isAssignedToMyClass;
      });
    } else {
      quizzes = await storage.getQuizzesByCreator(req.user!.id);
    }
    res.json({ quizzes });
  } catch (error) {
    res.status(500).json({ message: "S�navlar getirilemedi." });
  }
});

router.get("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.id);
    if (!quiz) return res.status(404).json({ message: "S�nav bulunamad�." });

    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu s�nav� g�r�nt�leme yetkiniz yok." });
    }

    const questions = await storage.getQuestionsByQuiz(quiz.id);
    res.json({ quiz, questions });
  } catch (error) {
    res.status(500).json({ message: "S�nav detaylar� getirilemedi." });
  }
});

router.post("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = quizSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const { title, description, category, categoryId, difficulty, timeLimit, shuffleQuestions, status, assignedClassIds } = validation.data;

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
      createdBy: req.user!.id,
      assignedClassIds
    });

    await storage.createLog(req.user!.id, "CREATE_QUIZ", `Created quiz: ${quiz.title}`);
    res.status(201).json({ quiz });
  } catch (error) {
    console.error("Create quiz error:", error);
    res.status(500).json({ message: "S�nav olu�turulamad�." });
  }
});

router.patch("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = quizSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const existingQuiz = await storage.getQuiz(req.params.id);
    if (!existingQuiz) return res.status(404).json({ message: "S�nav bulunamad�." });

    if (req.user!.role === "teacher" && existingQuiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu s�nav� d�zenleme yetkiniz yok." });
    }

    if (validation.data.status === "published" && existingQuiz.status !== "published") {
      const questions = await storage.getQuestionsByQuiz(req.params.id);
      if (questions.length === 0) {
        return res.status(400).json({ message: "S�nav yay�nlanabilmesi i�in en az 1 soru eklenmelidir." });
      }
    }

    const quiz = await storage.updateQuiz(req.params.id, {
      ...validation.data,
      assignedClassIds: validation.data.assignedClassIds
    });

    await storage.createLog(req.user!.id, "UPDATE_QUIZ", `Updated quiz: ${quiz?.title}`);

    if (existingQuiz.status !== "published" && quiz?.status === "published" && (quiz as any).assignedClasses && (quiz as any).assignedClasses.length > 0) {
      const io = getIO();
      for (const cls of (quiz as any).assignedClasses) {
        const students = await storage.getStudentsByClass(cls.id);
        for (const student of students) {
          const notification = await storage.createNotification({
            userId: student.id,
            title: "Yeni Sınav",
            message: `"${quiz?.title}" adlı sınav yayınlandı.`,
            type: "info"
          });
          io.to(`user_${student.id}`).emit("notification", notification);
        }
      }
    }

    res.json({ quiz });
  } catch (error) {
    console.error("Update quiz error:", error);
    res.status(500).json({ message: "S�nav g�ncellenemedi." });
  }
});

router.post("/:id/questions", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {    
  try {
    const quizId = req.params.id;

    const validation = questionsArraySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const quiz = await storage.getQuiz(quizId);
    if (!quiz) return res.status(404).json({ message: "S�nav bulunamad�." });

    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu s�nava soru ekleme yetkiniz yok." });
    }

    const questionsData = validation.data.map((q) => ({
      quizId: quizId,
      text: q.text,
      type: q.type,
      options: q.options,
      correctAnswer: q.correctAnswer,
      imageUrl: q.imageUrl,
      order: q.order
    }));

    const questions = await storage.syncQuestions(quizId, questionsData);
    res.status(201).json({ questions });
  } catch (error) {
    logger.error({ err: error }, "Sync questions error");
    res.status(500).json({ message: "Sorular senkronize edilemedi." });
  }
});

router.delete("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.id);
    if (!quiz) return res.status(404).json({ message: "S�nav bulunamad�." });
    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu s�nav� silme yetkiniz yok." });
    }
    await storage.deleteQuiz(req.params.id);
    res.json({ message: "S�nav ba�ar�yla silindi." });
  } catch (e) {
    res.status(500).json({ message: "S�nav silinemedi." });
  }
});

export default router;
