import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { logger } from "../index";
import { z } from "zod";

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
    res.json(await storage.getNotificationPreferences(req.user!.id));
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
    res.json(await storage.updateNotificationPreferences(req.user!.id, parsed.data.muted));
  } catch (error) {
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
