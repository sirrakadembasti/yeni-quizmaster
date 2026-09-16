import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { getAuthorizedClassIds } from "../utils/class-authorization";
import { storage } from "../storage";

const router: Router = Router();

const querySchema = z.object({
  classId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

router.get("/classes", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Gecersiz filtre." });

    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 30);
    const startDate = parsed.data.startDate ? new Date(`${parsed.data.startDate}T00:00:00`) : defaultStart;
    const endDate = parsed.data.endDate ? new Date(`${parsed.data.endDate}T23:59:59.999`) : now;
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      return res.status(400).json({ message: "Gecersiz tarih araligi." });
    }

    const allowedIds = await getAuthorizedClassIds(req.user!.role, req.user!.id);
    if (parsed.data.classId && !allowedIds.has(parsed.data.classId)) {
      return res.status(403).json({ message: "Bu sinifin istatistiklerine erisim yetkiniz yok." });
    }

    const classIds = parsed.data.classId ? [parsed.data.classId] : [...allowedIds];
    const classes = await storage.getClassAnalytics(classIds, startDate, endDate);
    res.json({
      classes,
      filters: {
        classId: parsed.data.classId || null,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Class analytics error:", error);
    res.status(500).json({ message: "Sinif istatistikleri getirilemedi." });
  }
});

export default router;
