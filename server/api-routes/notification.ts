import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { logger } from "../utils/logger";
import { z } from "zod";
import { NotificationPreferenceConflict } from "../services/notification-preferences";

const router: Router = Router();

// Get user notifications — desteklenen query params: ?page=1&limit=20
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = req.query.page ? Math.max(1, parseInt(req.query.page as string, 10)) : 1;
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10))) : 20;

    const { data: notifications, total, unread } = await storage.getUserNotifications(req.user!.id, page, limit);
    // `notifications` key'i aynı kalıyor (geriye dönük uyumluluk); `pagination` yeni eklendi.
    res.json({
      notifications,
      pagination: { page, limit, total, unread, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error({ err: error }, "[Notification] Bildirimler getirilemedi.");
    res.status(500).json({ message: "Bildirimler getirilemedi." });
  }
});

// Mark all as read
router.post("/mark-read", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await storage.markNotificationsAsRead(req.user!.id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "[Notification] Bildirimler okundu olarak işaretlenemedi.");
    res.status(500).json({ message: "Bildirimler güncellenemedi." });
  }
});

router.get("/preferences", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const preferences = await storage.getVersionedNotificationPreferences(req.user!.id);
    res.set('ETag', `"${preferences.revision}"`).set('Cache-Control', 'no-store').json({ muted: preferences.muted });
  } catch (error) {
    logger.error({ err: error }, "[Notification] Bildirim tercihleri getirilemedi.");
    res.status(500).json({ message: "Bildirim tercihleri getirilemedi." });
  }
});

router.patch("/preferences", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = z.object({ muted: z.boolean() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Geçerli bir bildirim tercihi gönderilmelidir." });
    }
    const header = req.get('If-Match');
    const revision = header === undefined ? undefined : /^"(0|[1-9]\d*)"$/.test(header) ? Number(header.slice(1, -1)) : NaN;
    if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647)) {
      return res.status(400).json({ message: "Geçerli bir bildirim tercihi sürümü gönderilmelidir." });
    }
    const preferences = await storage.updateVersionedNotificationPreferences(req.user!.id, parsed.data.muted, revision);
    res.set('ETag', `"${preferences.revision}"`).set('Cache-Control', 'no-store').json({ muted: preferences.muted });
  } catch (error) {
    if (error instanceof NotificationPreferenceConflict) return res.status(409).json({ message: error.message });
    logger.error({ err: error }, "[Notification] Bildirim tercihleri güncellenemedi.");
    res.status(500).json({ message: "Bildirim tercihleri güncellenemedi." });
  }
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await storage.deleteNotification(req.user!.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Bildirim bulunamadı." });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "[Notification] Bildirim silinemedi.");
    res.status(500).json({ message: "Bildirim silinemedi." });
  }
});

export default router;
