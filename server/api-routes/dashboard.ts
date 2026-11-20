import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

import { logger } from "../utils/logger";
const router: Router = Router();

// ==================== DASHBOARD & STATS ====================
router.get("/overview", requireAuth, requireRole(["teacher", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const recentQuizzes = await storage.getDashboardOverview(req.user!.role, req.user!.id);
    res.json({ recentQuizzes });
  } catch (error) {
    logger.error({ err: error }, "Dashboard overview error");
    res.status(500).json({ message: "Dashboard verileri getirilemedi." });
  }
});


router.get("/stats", requireAuth, requireRole(["teacher", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const stats = await storage.getDashboardStats(req.user!.role, req.user!.id);
    res.json({ stats });
  } catch (error) {
    logger.error({ err: error }, "Teacher stats error");
    res.status(500).json({ message: "Failed to fetch teacher stats" });
  }
});

export default router;
