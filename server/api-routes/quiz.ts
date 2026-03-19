import { Router, type Response, type Request } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

const router: Router = Router();

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
  assignedClassIds: z.array(z.string().uuid()).optional().default([]),
});

const questionSchema = z.object({
  text: z.string().min(1, "Soru metni gereklidir."),
  type: z.string().default("multiple-choice"),
  options: z.array(z.string()).min(2, "En az 2 seçenek gereklidir."),
  correctAnswer: z.string().min(1, "Doğru cevap gereklidir."),
  imageUrl: z.string().url().optional().nullable(),
  order: z.number().int().default(0),
});

const questionsArraySchema = z.array(questionSchema);

// ==================== QUIZ ROUTES ====================

router.get("/admin/quizzes", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const quizzes = await storage.getAllQuizzes();
    res.json({ quizzes });
  } catch (error) {
    res.status(500).json({ message: "Sınavlar getirilemedi." });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  let quizzes;
  if (req.user!.role === "student") {
    quizzes = (await storage.getAllQuizzes()).filter(q => q.status === "published");
  } else {
    quizzes = await storage.getQuizzesByCreator(req.user!.id);
  }
  res.json({ quizzes });
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const quiz = await storage.getQuiz(req.params.id);
  if (!quiz) return res.status(404).json({ message: "Sınav bulunamadı." });
  const questions = await storage.getQuestionsByQuiz(quiz.id);
  res.json({ quiz, questions });
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
    
    await storage.createLog(req.user!.id, "CREATE_QUIZ", `Created quiz: ${title}`);
    res.status(201).json({ quiz });
  } catch (error) {
    console.error("Create quiz error:", error);
    res.status(500).json({ message: "Sınav oluşturulamadı." });
  }
});

router.patch("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = quizSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const existingQuiz = await storage.getQuiz(req.params.id);
    if (!existingQuiz) return res.status(404).json({ message: "Sınav bulunamadı." });
    
    if (req.user!.role === "teacher" && existingQuiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavı düzenleme yetkiniz yok." });
    }

    const quiz = await storage.updateQuiz(req.params.id, {
      ...validation.data,
      assignedClassIds: validation.data.assignedClassIds
    });
    
    await storage.createLog(req.user!.id, "UPDATE_QUIZ", `Updated quiz: ${existingQuiz.title}`);
    res.json({ quiz });
  } catch (error) {
    console.error("Update quiz error:", error);
    res.status(500).json({ message: "Sınav güncellenemedi." });
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
    if (!quiz) return res.status(404).json({ message: "Sınav bulunamadı." });
    
    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınava soru ekleme yetkiniz yok." });
    }

    await storage.deleteQuestionsByQuiz(quizId);
    
    const questionsData = validation.data.map((q) => ({
      quizId: quizId,
      text: q.text,
      type: q.type,
      options: q.options,
      correctAnswer: q.correctAnswer,
      imageUrl: q.imageUrl,
      order: q.order
    }));
    
    const questions = await storage.createQuestions(questionsData);
    res.status(201).json({ questions });
  } catch (error) {
    console.error("Sync questions error:", error);
    res.status(500).json({ message: "Sorular senkronize edilemedi." });
  }
});

router.delete("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Sınav bulunamadı." });
    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavı silme yetkiniz yok." });
    }
    await storage.deleteQuiz(req.params.id);
    res.json({ message: "Sınav başarıyla silindi." });
  } catch (e) {
    res.status(500).json({ message: "Sınav silinemedi." });
  }
});

export default router;
