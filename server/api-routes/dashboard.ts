import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();

// ==================== DASHBOARD & STATS ====================

router.get("/stats", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const quizzes = await storage.getAllQuizzes();
    const users = await storage.getAllUsers();
    res.json({ 
      stats: { 
        totalQuizzes: quizzes.length, 
        totalStudents: users.filter(u => u.role === 'student').length, 
        totalTeachers: users.filter(u => u.role === 'teacher').length, 
        totalResults: 0, 
        averageStudentScore: 0 
      } 
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});

router.get("/teacher/stats", requireAuth, requireRole(["teacher", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const quizzes = await storage.getQuizzesByCreator(req.user!.id);
    res.json({ 
      stats: { 
        totalQuizzes: quizzes.length, 
        totalResults: 0, 
        totalStudents: 0, 
        averageStudentScore: 0 
      } 
    });
  } catch (error) {
    console.error("Teacher stats error:", error);
    res.status(500).json({ message: "Failed to fetch teacher stats" });
  }
});

export default router;
