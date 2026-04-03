import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();

// ==================== DASHBOARD & STATS ====================

router.get("/stats", requireAuth, requireRole(["teacher", "admin"]), async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role === 'admin') {
      // Paralel sorgularla sistem geneli istatistikleri tek turda çek
      const [quizzes, users, adminStats] = await Promise.all([
        storage.getAllQuizzes(),
        storage.getAllUsers(),
        storage.getAdminStats(),
      ]);
      return res.json({
        stats: {
          totalQuizzes: quizzes.length,
          totalStudents: users.filter(u => u.role === 'student').length,
          totalTeachers: users.filter(u => u.role === 'teacher').length,
          totalResults: adminStats.totalResults,
          averageStudentScore: adminStats.averageStudentScore,
        },
      });
    }

    const teacherId = req.user!.id;
    const teacherClasses = await storage.getClassesByTeacher(teacherId);
    const quizzes = await storage.getQuizzesByCreator(teacherId);
    
    // Count unique students across all teacher's classes
    const studentIds = new Set<string>();
    for (const cls of teacherClasses) {
      const classStudents = await storage.getStudentsByClass(cls.id);
      classStudents.forEach(s => studentIds.add(s.id));
    }

    // Get all results for quizzes created by this teacher
    let totalResultsCount = 0;
    let totalScore = 0;
    let completedResultsCount = 0;

    for (const quiz of quizzes) {
      const results = await storage.getResultsByQuiz(quiz.id);
      totalResultsCount += results.length;
      results.forEach(r => {
        if (r.status === 'completed' && r.score !== null) {
          totalScore += r.score;
          completedResultsCount++;
        }
      });
    }

    res.json({ 
      stats: { 
        totalQuizzes: quizzes.length, 
        totalResults: totalResultsCount, 
        totalStudents: studentIds.size, 
        averageStudentScore: completedResultsCount > 0 ? Math.round(totalScore / completedResultsCount) : 0 
      } 
    });
  } catch (error) {
    console.error("Teacher stats error:", error);
    res.status(500).json({ message: "Failed to fetch teacher stats" });
  }
});

export default router;
