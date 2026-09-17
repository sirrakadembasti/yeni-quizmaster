import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { logger } from "../utils/logger";

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

// E-Posta Logları ve Kuyruk Yönetimi
router.get("/logs/emails", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, startDate, endDate, page, limit } = req.query;
    const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : 1;
    const limitNum = limit ? Math.min(500, Math.max(1, parseInt(limit as string, 10))) : 100;

    const result = await storage.getEmailLogs({
      status: status as string,
      search: search as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: pageNum,
      limit: limitNum,
    });

    res.json({
      emails: result.data,
      counts: result.counts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[GET /api/admin/logs/emails] Error");
    res.status(500).json({ message: "E-posta logları getirilemedi." });
  }
});

// E-Posta Tekrar Gönderim (Retry)
router.post("/logs/emails/:id/retry", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await storage.retryEmail(id);
    if (!updated) {
      return res.status(404).json({ message: "E-posta kaydı bulunamadı." });
    }

    // Log the action
    await storage.createLog(req.user!.id, "RETRY_EMAIL", `E-posta tekrar gönderime alındı: ${updated.to} (${updated.subject})`);

    // Arka planda derhal tetikle
    const { processEmailQueue } = await import("../utils/email");
    setImmediate(() => {
      processEmailQueue().catch(err => {
        logger.error({ err }, "[RetryEmail] Immediate send error");
      });
    });

    res.json({ message: "E-posta tekrar gönderim kuyruğuna alındı.", email: updated });
  } catch (error) {
    logger.error({ err: error }, "[POST /api/admin/logs/emails/:id/retry] Error");
    res.status(500).json({ message: "E-posta tekrar gönderilemedi." });
  }
});

// E-Posta Log Silme
router.delete("/logs/emails/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteEmailLog(id);
    if (!success) {
      return res.status(404).json({ message: "E-posta kaydı bulunamadı veya silinemedi." });
    }

    await storage.createLog(req.user!.id, "DELETE_EMAIL_LOG", `E-posta log kaydı silindi: ID ${id}`);

    res.json({ message: "E-posta kaydı başarıyla silindi." });
  } catch (error) {
    logger.error({ err: error }, "[DELETE /api/admin/logs/emails/:id] Error");
    res.status(500).json({ message: "E-posta kaydı silinirken hata oluştu." });
  }
});

// Sistem Hata & İşlemleri Logları
router.get("/logs/system", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { search, startDate, endDate, page, limit } = req.query;
    const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : 1;
    const limitNum = limit ? Math.min(500, Math.max(1, parseInt(limit as string, 10))) : 100;

    const { data: logs, total } = await storage.getSystemLogs({
      search: search as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: pageNum,
      limit: limitNum,
    });

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[GET /api/admin/logs/system] Error");
    res.status(500).json({ message: "Sistem logları getirilemedi." });
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
