import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { getIO } from "../socket";

const router: Router = Router();

// Sınav başlatma ve teslim için kısıtlayıcı rate limiter.
// Genel API limiti (1000 req/15dk) buradaki hassas işlemler için çok yüksek;
// bu endpoint'ler öğrenci başına çok daha az çağrılmalıdır.
const quizActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 50,                   // IP başına 15 dakikada en fazla 50 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin." },
});

// ==================== SCHEMAS ====================

const answerSchema = z.object({
  questionId: z.string().uuid("Geçersiz soru ID."),
  selectedOption: z.string().min(1, "Seçenek gereklidir."),
});

const submitSchema = z.object({
  answers: z.record(z.string().min(1)).optional(),
});

// ==================== STUDENT ROUTES ====================

router.get("/quizzes", requireAuth, async (req: AuthRequest, res: Response) => {
  const allQuizzes = await storage.getAllQuizzes();
  const studentClassId = req.user!.classId;
  
  const quizzes = allQuizzes.filter(q => {
    if (q.status !== "published") return false;
    const assignedClasses = (q as any).assignedClasses || [];
    if (assignedClasses.length === 0) {
      // Herhangi bir sınıfa atanmamış sınav:
      // - Sınıfsız öğrenciler (serbest kullanıcılar) görebilir.
      // - Sınıfı olan öğrenciler GÖREMEZ — yanlışlıkla yayınlanan sınavların
      //   tüm okula sızmasını önler.
      return !studentClassId;
    }
    return assignedClasses.some((c: any) => c.id === studentClassId);
  });
  
  res.json({ quizzes });
});

router.get("/results", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    let studentId = req.user!.id;
    
    // Teachers and admins can view other students' results
    if ((req.user!.role === "teacher" || req.user!.role === "admin") && req.query.studentId) {
      const targetStudentId = req.query.studentId as string;
      const targetStudent = await storage.getUser(targetStudentId);
      
      if (!targetStudent) return res.status(404).json({ message: "Öğrenci bulunamadı." });

      // Teacher authorization check for specific student
      if (req.user!.role === "teacher") {
        const teacherClasses = await storage.getClassesByTeacher(req.user!.id);
        if (!teacherClasses.some(c => c.id === targetStudent.classId)) {
          return res.status(403).json({ message: "Bu öğrencinin sonuçlarını görme yetkiniz yok." });
        }
      }
      studentId = targetStudentId;
    }
    
    // Filter results by teacher if requester is a teacher
    const teacherIdFilter = req.user!.role === "teacher" ? req.user!.id : undefined;
    const results = await storage.getResultsByStudent(studentId, teacherIdFilter);

    // getResultsByStudent zaten `include: { quiz: { include: { category: true } } }` ile quiz verisini getiriyor.
    // Ayrıca storage.getQuiz() çağırmak N+1 sorguya yol açar; r.quiz doğrudan kullanılıyor.
    res.json({ results });
  } catch (error) {
    res.status(500).json({ message: "Sonuçlar alınamadı." });
  }
});

router.get("/results/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await storage.getResult(req.params.id);
    if (!result) return res.status(404).json({ message: "Sonuç bulunamadı." });

    // IDOR Check: Students can only view their own results
    if (req.user!.role === "student" && result.studentId !== req.user!.id) {
      return res.status(403).json({ message: "Bu sonuca erişim yetkiniz yok." });
    }

    if (req.user!.role === "student" && result.status !== "completed") {
      return res.status(409).json({ message: "Sınav tamamlanmadan sonuç detayları görüntülenemez." });
    }

    // Teacher authorization check
    if (req.user!.role === "teacher") {
      const student = await storage.getUser(result.studentId);
      const teacherClasses = await storage.getClassesByTeacher(req.user!.id);
      if (!student || !teacherClasses.some(c => c.id === student.classId)) {
        // As a fallback, check if they created the quiz
        const quiz = await storage.getQuiz(result.quizId);
        if (!quiz || quiz.createdBy !== req.user!.id) {
          return res.status(403).json({ message: "Bu sonuca erişim yetkiniz yok." });
        }
      }
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

// Quiz taking endpoints
router.post("/quiz/:quizId/prepare-offline", quizActionLimiter, requireAuth, requireRole(["student"]), async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz bulunamadı." });
    if (quiz.status !== "published") return res.status(403).json({ message: "Bu sınav henüz yayında değil." });
    if (quiz.timeLimit) {
      return res.status(409).json({ message: "Süreli sınavlar güvenlik nedeniyle çevrimdışı başlatılamaz." });
    }

    const studentClassId = req.user!.classId;
    const assignedClasses = (quiz as any).assignedClasses || [];
    if (assignedClasses.length === 0 && studentClassId) {
      return res.status(403).json({ message: "Bu quize erişim yetkiniz yok." });
    }
    if (assignedClasses.length > 0 && !assignedClasses.some((c: any) => c.id === studentClassId)) {
      return res.status(403).json({ message: "Bu quize erişim yetkiniz yok." });
    }

    const questions = await storage.getQuestionsByQuiz(quiz.id);
    let result = await storage.getStudentQuizResult(req.user!.id, quiz.id);
    if (result?.status === "completed") {
      return res.status(409).json({ message: "Bu sınav daha önce tamamlanmış." });
    }
    if (!result) {
      result = await storage.createResult({
        studentId: req.user!.id,
        quizId: quiz.id,
        status: "in_progress",
        totalQuestions: questions.length,
        answers: {} as any,
        startedAt: new Date(),
      });
    }

    res.json({
      resultId: result.id,
      quiz,
      questions: questions.map(({ id, text, type, options }) => ({ id, text, type, options })),
      existingAnswers: (result as any).answers || {},
      remainingSeconds: null,
      preparedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Prepare offline quiz error:", error);
    res.status(500).json({ message: "Sınav çevrimdışı kullanım için hazırlanamadı." });
  }
});

router.post("/quiz/:quizId/start", quizActionLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz bulunamadı." });
    
    if (req.user!.role === "student" && quiz.status !== "published") {
      return res.status(403).json({ message: "Bu sınav henüz yayında değil." });
    }

    // Erişim kontrolü: Öğrenci yalnızca kendi sınıfına atanmış sınavlara girebilir.
    const studentClassId = req.user!.classId;
    const assignedClasses = (quiz as any).assignedClasses || [];
    if (req.user!.role === "student") {
      if (assignedClasses.length === 0 && studentClassId) {
        // Hiçbir sınıfa atanmamış sınav — sınıflı öğrenci erişemez
        return res.status(403).json({ message: "Bu quize erişim yetkiniz yok." });
      }
      if (assignedClasses.length > 0 && !assignedClasses.some((c: any) => c.id === studentClassId)) {
        // Farklı sınıfa atanmış sınav
        return res.status(403).json({ message: "Bu quize erişim yetkiniz yok." });
      }
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

    const timeLimitSeconds = quiz.timeLimit ? quiz.timeLimit * 60 : null;
    const elapsedSeconds = result?.startedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(result.startedAt).getTime()) / 1000))
      : 0;
    const remainingSeconds = timeLimitSeconds === null
      ? null
      : Math.max(0, timeLimitSeconds - elapsedSeconds);

    res.json({ 
      resultId: result?.id || 'preview-mode', 
      quiz, 
      questions: questions.map(({id, text, type, options}) => ({id, text, type, options})), 
      existingAnswers: (result as any)?.answers || {},
      remainingSeconds,
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

    const quiz = await storage.getQuiz(result.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz bulunamadı." });

    if (quiz.timeLimit && result.startedAt) {
      const deadline = new Date(result.startedAt).getTime() + quiz.timeLimit * 60 * 1000;
      if (Date.now() >= deadline) {
        return res.status(409).json({ message: "Sınav süresi dolduğu için cevap kaydedilemedi." });
      }
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
    
    res.json({ message: "Cevap kaydedildi." });
  } catch (e) {
    console.error("Answer quiz error:", e);
    res.status(500).json({ message: "Cevap kaydedilemedi." });
  }
});

router.post("/quiz/:resultId/submit", quizActionLimiter, requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = submitSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

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
    const quiz = await storage.getQuiz(result.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz bulunamadı." });

    const storedAnswers = ((result as any).answers || {}) as Record<string, string>;
    const incomingAnswers = validation.data.answers || {};
    const validQuestionIds = new Set(allQ.map(question => question.id));
    if (Object.keys(incomingAnswers).some(questionId => !validQuestionIds.has(questionId))) {
      return res.status(400).json({ message: "Geçersiz bir soruya ait cevap gönderildi." });
    }

    const deadline = quiz.timeLimit && result.startedAt
      ? new Date(result.startedAt).getTime() + quiz.timeLimit * 60 * 1000
      : null;
    const acceptsQueuedAnswers = deadline === null || Date.now() < deadline;
    const answersMap = acceptsQueuedAnswers ? { ...storedAnswers, ...incomingAnswers } : storedAnswers;
    let correct = 0;
    allQ.forEach(q => { if (answersMap[q.id] === q.correctAnswer) correct++; });
    
    const score = Math.round((correct / allQ.length) * 100);
    await storage.updateResult(result.id, {
      status: "completed",
      answers: answersMap as any,
      correctAnswersCount: correct,
      score,
      submittedAt: new Date(),
      completedAt: new Date(),   // schema'daki completedAt alanı; submittedAt ile aynı anda set ediliyor
      timeTaken: Math.floor((Date.now() - new Date(result.startedAt!).getTime()) / 1000)
    });

    // Notify the teacher who created the quiz
    if (quiz) {
      const io = getIO();
      const notification = await storage.createNotification({
        userId: quiz.createdBy,
        title: "Sınav Teslim Edildi",
        message: `${req.user!.name}, "${quiz.title}" adlı sınavı tamamladı. Skor: ${score}`,
        type: "success"
      });
      io.to(`user_${quiz.createdBy}`).emit("notification", notification);
    }

    res.json({
      score,
      correctAnswers: correct,
      totalQuestions: allQ.length,
      acceptedQueuedAnswers: acceptsQueuedAnswers,
    });
  } catch (e) {
    console.error("Submit quiz error:", e);
    res.status(500).json({ message: "Sınav teslim edilemedi." });
  }
});

export default router;
