import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { archiveResultGuard } from '../middleware/archive-readonly';
import { RESULTS_SUMMARY_PAGE_SIZE } from '../services/results-summary';

const router: Router = Router();
router.use('/:id', (req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : requireAuth(req, res, () => archiveResultGuard(req, res, next)));

// ==================== RESULT ROUTES (Admin/Teacher) ====================

// Filtered results for reporting. Teacher scope is enforced on the server.
router.get("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const queryValue = (value: unknown) => typeof value === "string" && value !== "all" ? value : undefined;
    const filters = {
      quizId: queryValue(req.query.quizId),
      categoryId: queryValue(req.query.categoryId),
      classId: queryValue(req.query.classId),
      studentId: queryValue(req.query.studentId),
      createdBy: req.user!.role === "teacher" ? req.user!.id : queryValue(req.query.teacherId),
    };
    if (req.query.projection === 'summary') {
      const rawLimit = req.query.limit;
      const cursor = req.query.cursor;
      const limit = rawLimit === undefined ? RESULTS_SUMMARY_PAGE_SIZE
        : typeof rawLimit === 'string' && /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
      if (!Number.isInteger(limit) || limit < 1 || limit > RESULTS_SUMMARY_PAGE_SIZE ||
          (cursor !== undefined && (typeof cursor !== 'string' || !cursor.length || cursor.length > 128))) {
        return res.status(400).json({ message: 'Geçersiz sonuç sayfalama parametreleri.' });
      }
      const page = await storage.getResultsSummary(filters, { limit, cursor: cursor as string | undefined });
      return res.json(page);
    }
    const results = await storage.getFilteredResults(filters);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ message: "Sınav sonuçları alınamadı." });
  }
});

// Get all results for a specific quiz
router.get("/quiz/:quizId", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.quizId);
    
    if (!quiz) return res.status(404).json({ message: "S?nav bulunamad?." });
    // Authorization Check: Teacher must be creator. Admin can see all.
    if (req.user!.role === "teacher" && quiz?.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavın sonuçlarını görme yetkiniz yok." });
    }

    const results = await storage.getResultsByQuiz(req.params.quizId);
    // getResultsByQuiz zaten `include: { student: true }` ile Prisma'dan student verisini çekiyor.
    // Ayrıca storage.getUser() çağırmak N+1 sorguya neden olur; (r as any).student kullanıyoruz.
    const enriched = results.map(r => ({
      ...r,
      student: (r as any).student,
      quizTitle: quiz?.title,
    }));

    res.json({ results: enriched });
  } catch (error) {
    res.status(500).json({ message: "Sınav sonuçları alınamadı." });
  }
});

export default router;
