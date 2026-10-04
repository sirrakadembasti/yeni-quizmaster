import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { logger } from "../utils/logger";
import { getEmailStatus, sendDirectEmail, verifyEmailTransport } from "../utils/email";
import { issuePasswordReset } from "../services/password-reset";
import { respondToClassError } from '../utils/class-errors';
import { z } from 'zod';

const router: Router = Router();

// ==================== LOG ROUTES ====================

router.get("/logs/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, startDate } = req.query;
    const cutoff = startDate ? new Date(String(startDate)) : undefined;
    if (cutoff && !Number.isFinite(cutoff.getTime())) return res.status(400).json({ message: 'Geçersiz başlangıç tarihi.' });
    const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit as string, 10))) : 50;

    const { data: logs, total } = await storage.getLogs({
      userId: req.user!.id,
      startDate: cutoff,
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

// SMTP durumunu parolayı açığa çıkarmadan gösterir.
router.get("/email-settings/status", requireAuth, requireRole(["admin"]), async (_req: AuthRequest, res: Response) => {
  const settings = getEmailStatus();
  res.json({
    settings,
    ready: settings.authConfigured,
  });
});

// Yönetici SMTP bağlantısını ve gerçek gönderimi tek adımda sınayabilir.
router.post("/email-settings/test", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const recipient = typeof req.body?.email === "string" && req.body.email.trim()
      ? req.body.email.trim()
      : req.user!.email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return res.status(400).json({ message: "Geçerli bir test e-posta adresi giriniz." });
    }
    const settings = await verifyEmailTransport();
    const info = await sendDirectEmail({
      to: recipient,
      subject: "QuizMaster SMTP Bağlantı Testi",
      text: "QuizMaster SMTP yapılandırması başarıyla çalışıyor.",
      html: "<p><strong>QuizMaster</strong> SMTP yapılandırması başarıyla çalışıyor.</p>",
    });
    await storage.createLog(req.user!.id, "TEST_EMAIL", `SMTP test e-postası gönderildi: ${recipient}`);
    res.json({ message: "Test e-postası gönderildi.", messageId: info.messageId, settings });
  } catch (error: any) {
    logger.warn({ err: error, adminId: req.user!.id }, "[SMTP] Bağlantı testi başarısız");
    res.status(502).json({
      message: "SMTP bağlantısı kurulamadı. Gmail uygulama şifresi ve sunucu ayarlarını kontrol edin.",
      code: error?.code || "SMTP_ERROR",
    });
  }
});

router.get("/password-reset-requests", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const result = await storage.getPasswordResetRequests({ status: String(req.query.status || "all"), search: String(req.query.search || ""), page, limit });
    res.json({ requests: result.data, counts: result.counts, pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) } });
  } catch (error) {
    logger.error({ err: error }, "[PasswordResetAdmin] Talepler getirilemedi");
    res.status(500).json({ message: "Şifre sıfırlama talepleri getirilemedi." });
  }
});

router.post("/password-reset-requests", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Geçerli bir kullanıcı e-postası giriniz." });
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(404).json({ message: "Bu e-posta ile kayıtlı kullanıcı bulunamadı." });
    const resetRequest = await issuePasswordReset(user, { requestedBy: req.user!.id, requestIp: req.ip });
    await storage.createLog(req.user!.id, "ADMIN_PASSWORD_RESET_REQUEST", `Şifre sıfırlama e-postası istendi: ${user.id}`);
    res.status(201).json({ request: resetRequest });
  } catch (error: any) {
    logger.warn({ err: error, adminId: req.user!.id }, "[PasswordResetAdmin] Talep oluşturulamadı");
    res.status(502).json({ message: "Gmail gönderim kuyruğu oluşturulamadı.", code: error?.code || "EMAIL_QUEUE_ERROR" });
  }
});

router.post("/password-reset-requests/:id/resend", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const current = await storage.getPasswordResetRequest(req.params.id);
    if (!current) return res.status(404).json({ message: "Şifre sıfırlama talebi bulunamadı." });
    const user = await storage.getUser(current.userId);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    const resetRequest = await issuePasswordReset(user, { requestedBy: req.user!.id, requestIp: req.ip });
    await storage.createLog(req.user!.id, "RESEND_PASSWORD_RESET", `Şifre sıfırlama e-postası yenilendi: ${user.id}`);
    res.json({ message: "Yeni şifre sıfırlama bağlantısı Gmail kuyruğuna alındı.", request: resetRequest });
  } catch (error: any) {
    res.status(502).json({ message: "Şifre sıfırlama e-postası yeniden oluşturulamadı.", code: error?.code || "EMAIL_QUEUE_ERROR" });
  }
});

router.post("/password-reset-requests/:id/cancel", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const current = await storage.getPasswordResetRequest(req.params.id);
    if (!current) return res.status(404).json({ message: "Şifre sıfırlama talebi bulunamadı." });
    if (current.status !== "pending") return res.status(409).json({ message: "Yalnızca bekleyen talepler iptal edilebilir." });
    await storage.updatePasswordResetRequest(current.id, { status: "cancelled", cancelledAt: new Date() });
    const user = await storage.getUser(current.userId);
    if (user && user.resetToken === current.tokenHash) {
      const userId = user.id;
      await storage.updateUser(userId, { resetToken: null, resetTokenExpiry: null });
    }
    await storage.createLog(req.user!.id, "CANCEL_PASSWORD_RESET", `Şifre sıfırlama talebi iptal edildi: ${current.id}`);
    res.json({ message: "Şifre sıfırlama talebi iptal edildi." });
  } catch (error) {
    res.status(500).json({ message: "Şifre sıfırlama talebi iptal edilemedi." });
  }
});

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
      // Log ekranı yalnız teslimat metadatasıdır. Sıfırlama bağlantısı içeren
      // e-posta gövdesi API üzerinden yönetici arayüzüne dahi gönderilmez.
      emails: result.data.map(({ body: _body, ...email }) => email),
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

router.get('/archive/preview', requireAuth, requireRole(['admin']), async (_req: AuthRequest, res: Response) => {
  try { res.json(await storage.getArchiveCandidates()); }
  catch { res.status(500).json({ message: 'Arşiv adayları getirilemedi.' }); }
});

router.post("/archive", requireAuth, requireRole(["admin"]), (_req: AuthRequest, res: Response) => {
  res.status(409).json({ message: 'Doğrudan arşivleme kapalıdır. Doğrulanmış arşiv iş akışını kullanın.' });
});

router.post("/promote-students", requireAuth, requireRole(["admin"]), (_req: AuthRequest, res: Response) => {
  res.status(409).json({ message: 'Sınıf geçişleri doğrulanmış yıllık arşiv tamamlanınca otomatik uygulanır. Geçiş kurallarını arşiv sayfasında ayarlayın.' });
});

// Historical records are immutable; the legacy destructive endpoint stays closed.
router.post("/purge", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.createLog(req.user!.id, 'ARCHIVE_WRITE_DENIED', 'Arşiv kalıcı silme isteği reddedildi.');
  } catch (error) { logger.error({ err: error }, 'Archive purge denial audit failed'); }
  return res.status(403).json({ message: 'Arşivler değişmez geçmiş kayıtlardır; kalıcı silme devre dışıdır.' });
});

export default router;
