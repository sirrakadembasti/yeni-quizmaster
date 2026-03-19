import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

const router: Router = Router();

// ==================== SCHEMAS ====================

const answerSchema = z.object({
  questionId: z.string().uuid("Geçersiz soru ID."),
  selectedOption: z.string().min(1, "Seçenek gereklidir."),
});

// ==================== STUDENT ROUTES ====================

router.get("/quizzes", requireAuth, async (req: AuthRequest, res: Response) => {
  const allQuizzes = await storage.getAllQuizzes();
  const studentClassId = req.user!.classId;
  
  const quizzes = allQuizzes.filter(q => {
    if (q.status !== "published") return false;
    const assignedClasses = (q as any).assignedClasses || [];
    if (assignedClasses.length === 0) return true; 
    return assignedClasses.some((c: any) => c.id === studentClassId);
  });
  
  res.json({ quizzes });
});

router.get("/results", requireAuth, async (req: AuthRequest, res: Response) => {
  let studentId = req.user!.id;
  
  // Teachers and admins can view other students' results
  if ((req.user!.role === "teacher" || req.user!.role === "admin") && req.query.studentId) {
    studentId = req.query.studentId as string;
  }
  
  const results = await storage.getResultsByStudent(studentId);
  const enriched = await Promise.all(results.map(async r => ({ ...r, quiz: await storage.getQuiz(r.quizId) })));
  res.json({ results: enriched });
});

router.get("/results/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await storage.getResult(req.params.id);
    if (!result) return res.status(404).json({ message: "Sonuç bulunamadı." });

    // IDOR Check: Students can only view their own results
    if (req.user!.role === "student" && result.studentId !== req.user!.id) {
      return res.status(403).json({ message: "Bu sonuca erişim yetkiniz yok." });
    }

    const quiz = await storage.getQuiz(result.quizId);
    const questions = await storage.getQuestionsByQuiz(result.quizId);

    const answersMap = ((result as any).answers || {}) as Record<string, any>;
    const enrichedQuestions = questions.map(q => ({
      ...q,
      studentAnswer: answersMap[q.id] || null,
      isCorrect: answersMap[q.id] === q.correctAnswer
    }));

    res.json({ result, quiz, questions: enrichedQuestions });
  } catch (error) {
    res.status(500).json({ message: "Sonuç detayları alınamadı." });
  }
});

// Result management for teachers/admins
router.get("/results/quiz/:quizId", requireAuth, requireRole(["admin", "teacher"]), async (req, res) => {
  const results = await storage.getResultsByQuiz(req.params.quizId);
  const quiz = await storage.getQuiz(req.params.quizId);
  
  // IDOR Check: Teacher must be the creator of the quiz or an admin
  if (req.user!.role === "teacher" && quiz?.createdBy !== req.user!.id) {
    return res.status(403).json({ message: "Bu quizin sonuçlarını görme yetkiniz yok." });
  }

  const enriched = await Promise.all(results.map(async r => ({ 
    ...r, 
    student: await storage.getUser(r.studentId),
    quizTitle: quiz?.title
  })));
  res.json({ results: enriched });
});

router.get("/results/quiz/:quizId/live", requireAuth, requireRole(["admin", "teacher"]), async (req, res) => {
  const results = await storage.getLiveResults(req.params.quizId);
  const quiz = await storage.getQuiz(req.params.quizId);
  
  if (req.user!.role === "teacher" && quiz?.createdBy !== req.user!.id) {
    return res.status(403).json({ message: "Bu quizi izleme yetkiniz yok." });
  }

  const enriched = await Promise.all(results.map(async r => ({ 
    ...r, 
    student: await storage.getUser(r.studentId),
    quizTitle: quiz?.title
  })));
  res.json({ results: enriched });
});

// Quiz taking endpoints
router.post("/quiz/:quizId/start", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz bulunamadı." });
    
    // Check if student is assigned to this quiz/class
    const studentClassId = req.user!.classId;
    const assignedClasses = (quiz as any).assignedClasses || [];
    if (req.user!.role === "student" && assignedClasses.length > 0 && !assignedClasses.some((c: any) => c.id === studentClassId)) {
      return res.status(403).json({ message: "Bu quize erişim yetkiniz yok." });
    }

    const questions = await storage.getQuestionsByQuiz(quiz.id);
    let result = await storage.getStudentQuizResult(req.user!.id, quiz.id);
    
    if (!result && req.user!.role === 'student') {
      result = await storage.createResult({
        studentId: req.user!.id,
        quizId: quiz.id,
        status: "in_progress",
        totalQuestions: questions.length,
        answers: {} as any,
        startedAt: new Date()
      });
    }    
    res.json({ 
      resultId: result?.id || 'preview-mode', 
      quiz, 
      questions: questions.map(({id, text, type, options}) => ({id, text, type, options})), 
      existingAnswers: (result as any)?.answers || {} 
    });
  } catch (e) {
    console.error("Start quiz error:", e);
    res.status(500).json({ message: "Quiz başlatılamadı." });
  }
});

router.post("/quiz/:resultId/answer", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = answerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const { questionId, selectedOption } = validation.data;
    const result = await storage.getResult(req.params.resultId);
    if (!result) return res.status(404).json({ message: "Sınav oturumu bulunamadı." });
    
    // IDOR Check
    if (result.studentId !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınav oturumu size ait değil." });
    }

    if (result.status !== "in_progress") {
      return res.status(400).json({ message: "Bu sınav zaten tamamlanmış." });
    }

    const question = await storage.getQuestion(questionId);
    if (!question || question.quizId !== result.quizId) {
      return res.status(404).json({ message: "Soru bulunamadı." });
    }
    
    const answersMap = ((result as any).answers || {}) as Record<string, any>;
    const answers: any = { ...answersMap, [questionId]: selectedOption };
    
    const allQ = await storage.getQuestionsByQuiz(result.quizId);
    let correct = 0;
    allQ.forEach(q => { if (answers[q.id] === q.correctAnswer) correct++; });
    
    await storage.updateResult(result.id, { 
      answers: answers as any, 
      correctAnswersCount: correct 
    });
    
    res.json({ isCorrect: question.correctAnswer === selectedOption });
  } catch (e) {
    console.error("Answer quiz error:", e);
    res.status(500).json({ message: "Cevap kaydedilemedi." });
  }
});

router.post("/quiz/:resultId/submit", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await storage.getResult(req.params.resultId);
    if (!result) return res.status(404).json({ message: "Sınav oturumu bulunamadı." });
    
    // IDOR Check
    if (result.studentId !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınav oturumu size ait değil." });
    }

    if (result.status !== "in_progress") {
      return res.status(400).json({ message: "Bu sınav zaten teslim edilmiş." });
    }

    const allQ = await storage.getQuestionsByQuiz(result.quizId);
    let correct = 0;
    const answersMap = ((result as any).answers || {}) as Record<string, any>;
    allQ.forEach(q => { if (answersMap[q.id] === q.correctAnswer) correct++; });
    
    const score = Math.round((correct / allQ.length) * 100);
    await storage.updateResult(result.id, { 
      status: "completed", 
      score, 
      submittedAt: new Date(), 
      timeTaken: Math.floor((Date.now() - new Date(result.startedAt!).getTime()) / 1000) 
    });
    
    res.json({ score, correctAnswers: correct, totalQuestions: allQ.length });
  } catch (e) {
    console.error("Submit quiz error:", e);
    res.status(500).json({ message: "Sınav teslim edilemedi." });
  }
});

export default router;
