import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const all = await storage.getAllAnnouncements();
    let filtered = all;

    if (req.user!.role === 'student') {
      filtered = all.filter(a => 
        a.targetRole === 'all' || 
        a.targetRole === 'student' || 
        (a.targetClassId && a.targetClassId === req.user!.classId)
      );
    } else if (req.user!.role === 'teacher') {
      filtered = all.filter(a => 
        a.targetRole === 'all' || 
        a.targetRole === 'teacher' ||
        a.createdBy === req.user!.id
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

    const announcement = await storage.createAnnouncement({
      title,
      content,
      createdBy: req.user!.id,
      targetRole,
      targetClassId
    });

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