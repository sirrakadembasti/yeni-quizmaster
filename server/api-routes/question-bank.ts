import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

const router: Router = Router();

const questionBankSchema = z.object({
  text: z.string().min(1, "Soru metni gereklidir."),
  type: z.string().default("multiple-choice"),
  options: z.array(z.string()).min(2, "En az 2 seçenek gereklidir."),
  correctAnswer: z.string().min(1, "Doğru cevap gereklidir."),
  imageUrl: z.string().url().optional().nullable(),
  categoryId: z.string().uuid("Geçersiz kategori ID.").optional().nullable(),
});

router.get("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const items = await storage.getQuestionBankItems(req.user!.id);
    res.json({ questions: items });
  } catch (error) {
    console.error("[GET /api/question-bank] Error:", error);
    res.status(500).json({ message: "Soru havuzu getirilemedi." });
  }
});

router.post("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = questionBankSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const item = await storage.createQuestionBankItem({
      ...validation.data,
      teacherId: req.user!.id,
    });
    res.status(201).json({ question: item });
  } catch (error) {
    console.error("[POST /api/question-bank] Error:", error);
    res.status(500).json({ message: "Soru havuza eklenemedi." });
  }
});

router.delete("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.deleteQuestionBankItem(req.params.id, req.user!.id);
    res.json({ message: "Soru havuzdan silindi." });
  } catch (error) {
    console.error("[DELETE /api/question-bank] Error:", error);
    res.status(500).json({ message: "Soru silinemedi." });
  }
});

export default router;