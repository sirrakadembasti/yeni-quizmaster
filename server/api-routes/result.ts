import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();

// ==================== RESULT ROUTES (Admin/Teacher) ====================

// Get all results for a specific quiz
router.get("/quiz/:quizId", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const results = await storage.getResultsByQuiz(req.params.quizId);
    const quiz = await storage.getQuiz(req.params.quizId);
    
    // Authorization Check: Teacher must be creator. Admin can see all.
    if (req.user!.role === "teacher" && quiz?.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavın sonuçlarını görme yetkiniz yok." });
    }

    // getResultsByQuiz zaten `include: { student: true }` ile Prisma'dan student verisini çekiyor.
    // Ayrıca storage.getUser() çağırmak N+1 sorguya neden olur; (r as any).student kullanıyoruz.
    const enriched = results.map(r => ({
      ...r,
      student: (r as any).student,
      quizTitle: quiz?.title,
    }));

    res.json({ results: enriched });
  } catch (error) {
    res.status(500).json({ message: "Sınav sonuçları alınamadı." });
  }
});

// Live results for a quiz
router.get("/quiz/:quizId/live", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const results = await storage.getLiveResults(req.params.quizId);
    const quiz = await storage.getQuiz(req.params.quizId);

    if (req.user!.role === "teacher" && quiz?.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu quizi izleme yetkiniz yok." });
    }

    // getLiveResults de `include: { student: true }` içeriyor; ayrı sorgu gerekmez.
    const enriched = results.map(r => ({
      ...r,
      student: (r as any).student,
      quizTitle: quiz?.title,
    }));

    res.json({ results: enriched });
  } catch (error) {
    res.status(500).json({ message: "Canlı sonuçlar alınamadı." });
  }
});

// Export results as CSV
router.get("/quiz/:quizId/export", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const results = await storage.getResultsByQuiz(req.params.quizId);
    const quiz = await storage.getQuiz(req.params.quizId);
    
    if (req.user!.role === "teacher" && quiz?.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavın sonuçlarını indirme yetkiniz yok." });
    }

    const csvRows = [
      ["Öğrenci Adı", "Öğrenci Email", "Sınıf/No", "Durum", "Skor", "Doğru Sayısı", "Toplam Soru", "Süre (sn)", "Tarih"]
    ];

    // getResultsByQuiz include: { student: true } ile student'ı önceden getiriyor;
    // ayrı getUser() çağrısı yapmak N+1 sorgu oluşturur.
    for (const r of results) {
      const student = (r as any).student;
      csvRows.push([
        student?.name || "Bilinmiyor",
        student?.email || "Bilinmiyor",
        student?.classNo || "-",
        r.status === "completed" ? "Tamamlandı" : "Devam Ediyor",
        (r.score !== null && r.score !== undefined) ? r.score.toString() : "-",
        r.correctAnswersCount.toString(),
        r.totalQuestions.toString(),
        r.timeTaken?.toString() || "-",
        r.startedAt ? new Date(r.startedAt).toLocaleString("tr-TR") : "-"
      ]);
    }

    const csvContent = csvRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="sinav_sonuclari_${req.params.quizId}.csv"`);
    res.send(Buffer.from("\ufeff" + csvContent, "utf8")); // UTF-8 BOM for Excel
  } catch (error) {
    console.error("Export results error:", error);
    res.status(500).json({ message: "Sonuçlar dışa aktarılamadı." });
  }
});

export default router;
