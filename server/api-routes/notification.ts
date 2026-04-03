import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { logger } from "../index";

const router: Router = Router();

// Get user notifications — desteklenen query params: ?page=1&limit=20
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = req.query.page ? Math.max(1, parseInt(req.query.page as string, 10)) : 1;
    const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10))) : 20;

    const { data: notifications, total } = await storage.getUserNotifications(req.user!.id, page, limit);
    // `notifications` key'i aynı kalıyor (geriye dönük uyumluluk); `pagination` yeni eklendi.
    res.json({
      notifications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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

export default router;
