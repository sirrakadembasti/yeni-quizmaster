import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();

const csvCell = (value: unknown) => {
  const raw = value == null ? "" : String(value).replace(/\r?\n|\r/g, " ").trim();
  const safe = /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

// ==================== RESULT ROUTES (Admin/Teacher) ====================

// Filtered results for reporting. Teacher scope is enforced on the server.
router.get("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const queryValue = (value: unknown) => typeof value === "string" && value !== "all" ? value : undefined;
    const results = await storage.getFilteredResults({
      quizId: queryValue(req.query.quizId),
      categoryId: queryValue(req.query.categoryId),
      classId: queryValue(req.query.classId),
      studentId: queryValue(req.query.studentId),
      createdBy: req.user!.role === "teacher" ? req.user!.id : queryValue(req.query.teacherId),
    });
    res.json({ results });
  } catch (error) {
    res.status(500).json({ message: "Sınav sonuçları alınamadı." });
  }
});

// Get all results for a specific quiz
router.get("/quiz/:quizId", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.quizId);
    
    if (!quiz) return res.status(404).json({ message: "S?nav bulunamad?." });
    // Authorization Check: Teacher must be creator. Admin can see all.
    if (req.user!.role === "teacher" && quiz?.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavın sonuçlarını görme yetkiniz yok." });
    }

    const results = await storage.getResultsByQuiz(req.params.quizId);
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
    const quiz = await storage.getQuiz(req.params.quizId);

    if (!quiz) return res.status(404).json({ message: "Sınav bulunamadı." });
    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavı izleme yetkiniz yok." });
    }

    const results = await storage.getLiveResults(req.params.quizId);
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
    const quiz = await storage.getQuiz(req.params.quizId);

    if (!quiz) return res.status(404).json({ message: "Sınav bulunamadı." });
    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavın sonuçlarını indirme yetkiniz yok." });
    }

    const results = await storage.getResultsByQuiz(req.params.quizId);
    const csvRows = [
      ["Öğrenci Adı", "Öğrenci Email", "Sınıf No", "Durum", "Skor", "Doğru Sayısı", "Toplam Soru", "Süre (sn)", "Tarih"]
    ];

    // getResultsByQuiz include: { student: true } ile student'ı önceden getiriyor;
    // ayrı getUser() çağrısı yapmak N+1 sorgu oluşturur.
    for (const r of results) {
      const student = (r as any).student;
      csvRows.push([
        student?.name || "Bilinmiyor",
        student?.email || "Bilinmiyor",
        student?.studentNo ?? "-",
        r.status === "completed" ? "Tamamlandı" : "Devam Ediyor",
        (r.score !== null && r.score !== undefined) ? r.score.toString() : "-",
        r.correctAnswersCount.toString(),
        r.totalQuestions.toString(),
        r.timeTaken?.toString() || "-",
        r.startedAt ? new Date(r.startedAt).toLocaleString("tr-TR") : "-"
      ]);
    }

    const csvContent = [
      "sep=;",
      ["Sınav Sonuçları", quiz.title, ...Array(7).fill("")].map(csvCell).join(";"),
      Array(9).fill("").map(csvCell).join(";"),
      ...csvRows.map(row => row.map(csvCell).join(";")),
    ].join("\r\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="sinav_sonuclari_${req.params.quizId}.csv"`);
    res.send(Buffer.from("\ufeff" + csvContent, "utf8")); // UTF-8 BOM for Excel
  } catch (error) {
    console.error("Export results error:", error);
    res.status(500).json({ message: "Sonuçlar dışa aktarılamadı." });
  }
});

export default router;
