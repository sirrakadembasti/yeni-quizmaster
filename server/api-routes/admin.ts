import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { logger } from "../index";

const router: Router = Router();

// ==================== LOG ROUTES ====================

router.get("/logs/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit } = req.query;
    const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit as string, 10))) : 50;

    const { data: logs, total } = await storage.getLogs({
      userId: req.user!.id,
      page: pageNum,
      limit: limitNum,
    });
    res.json({
      logs,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({ message: "İşlem geçmişiniz getirilemedi." });
  }
});

// ==================== ADMIN ROUTES ====================

router.get("/logs", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { role, userId, action, startDate, endDate, page, limit } = req.query;
    const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : 1;
    const limitNum = limit ? Math.min(500, Math.max(1, parseInt(limit as string, 10))) : 100;

    const { data: logs, total } = await storage.getLogs({
      role: role as string,
      userId: userId as string,
      action: action as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: pageNum,
      limit: limitNum,
    });
    res.json({
      logs,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({ message: "Loglar getirilemedi." });
  }
});

router.get("/quizzes", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const quizzes = await storage.getAllQuizzes();
    res.json({ quizzes });
  } catch (error) {
    logger.error({ err: error }, "[GET /api/admin/quizzes] Error");
    res.status(500).json({ message: "Sistemdeki tüm sınavlar getirilemedi." });
  }
});

router.post("/archive", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { academicYear } = req.body;
    if (!academicYear) {
      return res.status(400).json({ message: "Eğitim yılı (academicYear) belirtilmelidir." });
    }
    const result = await storage.archiveQuizzesAndResults(academicYear);
    
    // Log the action
    await storage.createLog(req.user!.id, "ARCHIVE_YEAR", `Yıl sonu arşivi yapıldı: ${academicYear}. Sınavlar: ${result.quizzesArchived}, Sonuçlar: ${result.resultsArchived}`);

    res.json({ message: "Yıl sonu arşivleme başarıyla tamamlandı.", ...result });
  } catch (error) {
    logger.error({ err: error }, "[POST /api/admin/archive] Error");
    res.status(500).json({ message: "Arşivleme işlemi başarısız oldu." });
  }
});

router.post("/promote-students", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    // academicYear opsiyoneldir. Verilirse, taşınmadan önce tamamlanmış
    // sonuçlara yıl damgası vurulur — yeni sınıf istatistiklerini kirletmez.
    const { promotions, academicYear } = req.body; // Array of { fromClassId, toClassId }
    if (!promotions || !Array.isArray(promotions)) {
      return res.status(400).json({ message: "Sınıf atlatma listesi (promotions) gereklidir." });
    }

    let totalPromoted = 0;
    for (const promo of promotions) {
      const count = await storage.promoteStudents(promo.fromClassId, promo.toClassId, academicYear || undefined);
      totalPromoted += count;
    }

    // Log the action
    await storage.createLog(req.user!.id, "PROMOTE_STUDENTS", `Öğrenci sınıf atlatma yapıldı. Toplam öğrenci: ${totalPromoted}${academicYear ? `. Yıl damgası: ${academicYear}` : ''}`);

    res.json({ message: "Öğrenciler başarıyla yeni sınıflarına aktarıldı.", totalPromoted });
  } catch (error) {
    logger.error({ err: error }, "[POST /api/admin/promote-students] Error");
    res.status(500).json({ message: "Öğrenci sınıf atlatma başarısız oldu." });
  }
});

// GERİ ALINAMAZ: Belirtilen akademik yıla ait arşivlenmiş sınavları ve öğrenci
// sonuçlarını veritabanından fiziksel olarak siler. Sadece admin yetkisiyle erişilebilir.
router.post("/purge", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { academicYear } = req.body;
    if (!academicYear) {
      return res.status(400).json({ message: "Silinecek eğitim yılı (academicYear) belirtilmelidir." });
    }

    const result = await storage.purgeArchivedData(academicYear);
    await storage.createLog(req.user!.id, "PURGE_ARCHIVED_DATA", `Arşiv silindi: ${academicYear}. Sınavlar: ${result.quizzesPurged}, Sonuçlar: ${result.resultsPurged}`);

    res.json({ message: `${academicYear} yılına ait arşiv kalıcı olarak silindi.`, ...result });
  } catch (error) {
    logger.error({ err: error }, "[POST /api/admin/purge] Error");
    res.status(500).json({ message: "Arşiv silme işlemi başarısız oldu." });
  }
});

export default router;
