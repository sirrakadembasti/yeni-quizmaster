import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { getIO } from "../socket";
import { shouldNotifyQuizOwnerOfSubmission } from "../utils/notification-policy";
import { isQuizVisibleToStudent } from "../utils/quiz-scope-policy";
import { archiveContentGuard, archiveResultGuard } from '../middleware/archive-readonly';

const router: Router = Router();
router.use('/quiz/:id/:operation', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return requireAuth(req, res, () => ['answer', 'submit'].includes(req.params.operation)
    ? archiveResultGuard(req, res, next) : archiveContentGuard(req, res, next));
});

// Sınav başlatma ve teslim için kısıtlayıcı rate limiter.
// Genel API limiti (1000 req/15dk) buradaki hassas işlemler için çok yüksek;
// bu endpoint'ler öğrenci başına çok daha az çağrılmalıdır.
const quizActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  keyGenerator: (req: AuthRequest) => req.user!.id,
  max: 50,                   // Kullanıcı başına 15 dakikada en fazla 50 istek
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

router.get("/quizzes", requireAuth, requireRole(["student", "teacher", "admin"]), async (req: AuthRequest, res: Response) => {
  const allQuizzes = await storage.getAllQuizzes({ studentClassId: req.user!.classId });
  const quizzes = allQuizzes.filter(quiz => isQuizVisibleToStudent(quiz, req.user!.classId));
  
  res.json({ quizzes });
});

router.get("/results", requireAuth, requireRole(["student", "teacher", "admin"]), async (req: AuthRequest, res: Response) => {
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
    res.json({ results: results.map(result => {
      if (req.user!.role !== "student" || result.status === "completed") return result;
      const { correctAnswersCount, score, ...safeResult } = result;
      return safeResult;
    }) });
  } catch (error) {
    res.status(500).json({ message: "Sonuçlar alınamadı." });
  }
});

router.get("/results/:id", requireAuth, requireRole(["student", "teacher", "admin"]), async (req: AuthRequest, res: Response) => {
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
router.post("/quiz/:quizId/prepare-offline", requireAuth, requireRole(["student"]), quizActionLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz bulunamadı." });
    if (quiz.contentType === "survey") return res.status(409).json({ message: "Anketler sınav akışıyla başlatılamaz." });
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
      questions: questions.map(({ id, text, type, options, imageUrl }) => ({ id, text, type, options, imageUrl })),
      existingAnswers: (result as any).answers || {},
      remainingSeconds: null,
      preparedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Prepare offline quiz error:", error);
    res.status(500).json({ message: "Sınav çevrimdışı kullanım için hazırlanamadı." });
  }
});

router.post("/quiz/:quizId/start", requireAuth, requireRole(["student", "teacher", "admin"]), quizActionLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const quiz = await storage.getQuiz(req.params.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz bulunamadı." });
    if (quiz.contentType === "survey") return res.status(409).json({ message: "Anketler sınav akışıyla başlatılamaz." });
    
    if (req.user!.role === "student" && quiz.status !== "published") {
      return res.status(403).json({ message: "Bu sınav henüz yayında değil." });
    }

    if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
      return res.status(403).json({ message: "Bu sınavı önizleme yetkiniz yok." });
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

    if (req.user!.role === "student" && result?.status === "completed") {
      return res.status(409).json({ message: "Bu sınav daha önce tamamlanmış." });
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
      questions: questions.map(({id, text, type, options, imageUrl}) => ({id, text, type, options, imageUrl})),
      existingAnswers: (result as any)?.answers || {},
      remainingSeconds,
    });
  } catch (e) {
    console.error("Start quiz error:", e);
    res.status(500).json({ message: "Quiz başlatılamadı." });
  }
});

router.post("/quiz/:resultId/answer", requireAuth, requireRole(["student"]), async (req: AuthRequest, res: Response) => {
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
    
    await storage.saveResultAnswer(result.id, req.user!.id, questionId, selectedOption);
    res.json({ message: "Cevap kaydedildi." });
  } catch (e) {
    if ((e as Error).message === "RESULT_EXPIRED") return res.status(409).json({ message: "Sınav süresi dolmuş." });
    if ((e as Error).message === "RESULT_COMPLETED") return res.status(400).json({ message: "Sınav zaten tamamlanmış." });
    console.error("Answer quiz error:", e);
    res.status(500).json({ message: "Cevap kaydedilemedi." });
  }
});

router.post("/quiz/:resultId/submit", requireAuth, requireRole(["student", "teacher", "admin"]), quizActionLimiter, async (req: AuthRequest, res: Response) => {
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

    if (result.status === "completed") {
      return res.json({ score: result.score || 0, correctAnswers: result.correctAnswersCount, totalQuestions: result.totalQuestions, acceptedQueuedAnswers: false });
    }

    const quiz = await storage.getQuiz(result.quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz bulunamadı." });

    const outcome = await storage.completeResult(result.id, req.user!.id, validation.data.answers || {});
    const { score } = outcome;

    try {
      const quizCreator = await storage.getUser(quiz.createdBy);
      if (outcome.newlyCompleted && quizCreator && shouldNotifyQuizOwnerOfSubmission(quizCreator.role)) {
        const io = getIO();
        const notification = await storage.createNotification({
          userId: quizCreator.id,
          title: "Sınav Teslim Edildi",
          message: `${req.user!.name}, "${quiz.title}" adlı sınavı tamamladı. Skor: ${score}`,
          type: "success"
        });
        io.to(`user_${quizCreator.id}`).emit("notification", notification);
      }
    } catch (notificationError) {
      console.error("Quiz submission notification error:", notificationError);
    }

    const { newlyCompleted, ...response } = outcome;
    res.json(response);
  } catch (e) {
    if ((e as Error).message === "INVALID_QUESTION_ID") return res.status(400).json({ message: "Geçersiz soru kimliği." });
    if ((e as Error).message === "RESULT_COMPLETED") return res.status(409).json({ message: "Sınav oturumu kapalı." });
    console.error("Submit quiz error:", e);
    res.status(500).json({ message: "Sınav teslim edilemedi." });
  }
});

export default router;
