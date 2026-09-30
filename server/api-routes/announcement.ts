import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { canAssignClasses } from "../utils/class-authorization";
import { getIO } from "../socket";
import { logger } from "../utils/logger";
import {
  isValidTeacherAnnouncementTarget,
  matchesAnnouncementRecipient
} from "../utils/notification-policy";

const router: Router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const all = await storage.getAllAnnouncements();
    let filtered = all;

    if (req.user!.role === 'student') {
      filtered = all.filter(a => {
        if (a.targetClassId) {
          return a.targetClassId === req.user!.classId;
        }

        return a.targetRole === 'all' || a.targetRole === 'student';
      });
    } else if (req.user!.role === 'parent') {
      const links = await storage.getGuardianStudents(req.user!.id);
      const classIds = new Set(links.map(link => link.student?.classId).filter(Boolean));
      filtered = all.filter(a =>
        (a.targetRole === 'all' || a.targetRole === 'parent') &&
        (!a.targetClassId || classIds.has(a.targetClassId))
      );
    } else if (req.user!.role === 'teacher') {
      filtered = all.filter(a =>
        a.createdBy === req.user!.id ||
        (a.creator?.role === 'admin' && (a.targetRole === 'all' || a.targetRole === 'teacher'))
      );
    }

    res.json({ announcements: filtered });
  } catch (error) {
    res.status(500).json({ message: "Duyurular getirilemedi." });
  }
});

router.post("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, targetRole, targetClassId } = req.body;
    if (!title || !content) return res.status(400).json({ message: "Başlık ve içerik zorunludur." });

    if (req.user!.role === "teacher" &&
        !isValidTeacherAnnouncementTarget(targetRole, targetClassId)) {
      return res.status(403).json({
        message: "Öğretmenler yalnızca dersine girdikleri bir sınıftaki öğrencilere duyuru gönderebilir."
      });
    }

    if (targetClassId &&
        !await canAssignClasses(req.user!.role, req.user!.id, [targetClassId])) {
      return res.status(403).json({ message: "Bu sınıfa duyuru gönderme yetkiniz yok." });
    }

    const announcement = await storage.createAnnouncement({
      title,
      content,
      createdBy: req.user!.id,
      targetRole,
      targetClassId
    });

    try {
      const allUsers = await storage.getAllUsers();
      const recipients = allUsers.filter(user => matchesAnnouncementRecipient({
        recipientId: user.id,
        recipientRole: user.role,
        recipientClassId: user.classId,
        creatorId: req.user!.id,
        targetRole,
        targetClassId,
      }));

      const io = getIO();
      await Promise.all(recipients.map(async user => {
        const notification = await storage.createNotification({
          userId: user.id,
          title,
          message: content,
          type: "announcement"
        });
        io.to(`user_${user.id}`).emit("notification", notification);
      }));
    } catch (notificationError) {
      logger.error({ err: notificationError }, "[Announcement] Anlık bildirimler gönderilemedi.");
    }

    res.status(201).json(announcement);
  } catch (error) {
    res.status(500).json({ message: "Duyuru oluşturulamadı." });
  }
});

router.delete("/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.deleteAnnouncement(req.params.id);
    res.json({ message: "Duyuru silindi." });
  } catch (error) {
    res.status(500).json({ message: "Duyuru silinemedi." });
  }
});

export default router;
