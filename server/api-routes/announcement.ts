import { Router, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { canAssignClasses } from "../utils/class-authorization";
import { getIO } from "../socket";
import { logger } from "../utils/logger";
import {
  isValidTeacherAnnouncementTarget,
  matchesAnnouncementAudience,
  matchesAnnouncementRecipient
} from "../utils/notification-policy";

const router: Router = Router();

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(150),
  content: z.string().trim().min(1).max(5000),
  targetRole: z.enum(["all", "teacher", "student", "parent"]).nullish(),
  targetClassId: z.string().uuid().nullish(),
});
const NOTIFICATION_MESSAGE_LIMIT = 500;

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const all = await storage.getAllAnnouncements();
    let filtered = all;

    if (req.user!.role === 'student') {
      filtered = all.filter(a =>
        (a.targetRole === 'all' || a.targetRole === 'student') &&
        matchesAnnouncementAudience({
          recipientId: req.user!.id,
          recipientRole: req.user!.role,
          recipientClassId: req.user!.classId,
          creatorId: a.createdBy,
          targetRole: a.targetRole,
          targetClassId: a.targetClassId,
        })
      );
    } else if (req.user!.role === 'parent') {
      const links = await storage.getGuardianStudents(req.user!.id);
      const classIds = links.map(link => link.student?.classId).filter((id): id is string => Boolean(id));
      filtered = all.filter(a =>
        (a.targetRole === 'all' || a.targetRole === 'parent') &&
        matchesAnnouncementAudience({
          recipientId: req.user!.id,
          recipientRole: req.user!.role,
          recipientActive: req.user!.isActive,
          recipientLinkedStudentClassIds: classIds,
          creatorId: a.createdBy,
          targetRole: a.targetRole,
          targetClassId: a.targetClassId,
        })
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
    const parsed = announcementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Başlık 3-150, içerik 1-5000 karakter olmalı; hedef rol ve sınıf geçerli olmalıdır." });
    }
    const { title, content } = parsed.data;
    const targetRole = parsed.data.targetRole ?? undefined;
    const targetClassId = parsed.data.targetClassId ?? undefined;

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
      const parentClassIds = new Map<string, string[]>();
      if (targetClassId && (!targetRole || targetRole === "all" || targetRole === "parent")) {
        // Resolve only active children in the targeted class, rather than querying every parent.
        const students = allUsers.filter(user => user.role === "student" && user.isActive && user.classId === targetClassId);
        const links = await Promise.all(students.map(student => storage.getStudentGuardians(student.id)));
        for (const link of links.flat()) {
          if (link.guardian?.role === "parent") parentClassIds.set(link.guardianId, [targetClassId]);
        }
      }
      const recipients = allUsers.filter(user => matchesAnnouncementRecipient({
        recipientId: user.id,
        recipientRole: user.role,
        recipientClassId: user.classId,
        recipientLinkedStudentClassIds: parentClassIds.get(user.id),
        recipientActive: user.isActive,
        creatorId: req.user!.id,
        targetRole,
        targetClassId,
      }));

      const io = getIO();
      await Promise.all(recipients.map(async user => {
        const notification = await storage.createNotification({
          userId: user.id,
          title,
          message: content.length > NOTIFICATION_MESSAGE_LIMIT ? `${content.slice(0, NOTIFICATION_MESSAGE_LIMIT - 1)}…` : content,
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

router.delete("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await storage.getAnnouncement(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Duyuru bulunamadı." });
    if (req.user!.role !== "admin" && announcement.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Yalnızca kendi duyurunuzu silebilirsiniz." });
    }
    await storage.deleteAnnouncement(req.params.id);
    res.json({ message: "Duyuru silindi." });
  } catch (error) {
    res.status(500).json({ message: "Duyuru silinemedi." });
  }
});

export default router;
