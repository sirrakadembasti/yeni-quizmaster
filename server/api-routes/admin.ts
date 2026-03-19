import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();

// ==================== ADMIN ROUTES ====================

router.get("/logs", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await storage.getLogs();
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch logs" });
  }
});

export default router;
