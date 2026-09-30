import { questionImageUrlSchema } from "../utils/upload-paths";
import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { canAssignClasses, getAuthorizedClassIds } from "../utils/class-authorization";
import { storage } from "../storage";

const router: Router = Router();

const resultQuerySchema = z.object({
  surveyId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const submissionSchema = z.object({
  answers: z.record(z.unknown()),
});

const surveyWriteSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().max(500).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  status: z.enum(["draft", "published", "archived"]).optional().default("draft"),
  assignedClassIds: z.array(z.string().uuid()).optional().default([]),
});

const surveyQuestionSchema = z.array(z.object({
  id: z.string().uuid().optional(),
  text: z.string().trim().min(1),
  type: z.enum(["single-choice", "multiple-choice", "open-text", "rating", "likert"]),
  options: z.array(z.string()).default([]),
  config: z.record(z.any()).optional().nullable(),
  imageUrl: questionImageUrlSchema.optional().nullable(),
  order: z.number().int().default(0),
}));

function parseDateRange(query: z.infer<typeof resultQuerySchema>) {
  const startDate = query.startDate ? new Date(`${query.startDate}T00:00:00`) : undefined;
  const endDate = query.endDate ? new Date(`${query.endDate}T23:59:59.999`) : undefined;
  if (
    (startDate && Number.isNaN(startDate.getTime())) ||
    (endDate && Number.isNaN(endDate.getTime())) ||
    (startDate && endDate && startDate > endDate)
  ) {
    return null;
  }
  return { startDate, endDate };
}

function isAssignedToStudent(survey: any, classId?: string | null) {
  const assignedClasses = survey.assignedClasses || [];
  if (assignedClasses.length === 0) return !classId;
  return Boolean(classId && assignedClasses.some((classroom: any) => classroom.id === classId));
}

async function canAccessSurvey(survey: any, user: NonNullable<AuthRequest["user"]>) {
  if (!survey || survey.contentType !== "survey") return false;
  if (user.role === "admin") return true;
  if (user.role === "student") {
    return survey.status === "published" && isAssignedToStudent(survey, user.classId);
  }
  if (user.role === "teacher") {
    if (survey.createdBy === user.id) return true;
    const allowed = await getAuthorizedClassIds(user.role, user.id);
    return (survey.assignedClasses || []).some((classroom: any) => allowed.has(classroom.id));
  }
  return false;
}

async function getAccessibleSurveys(user: NonNullable<AuthRequest["user"]>) {
  const surveys = (await storage.getAllQuizzes()).filter((quiz) => quiz.contentType === "survey");
  if (user.role === "admin") return surveys;
  if (user.role === "student") {
    return surveys.filter((survey) => survey.status === "published" && isAssignedToStudent(survey, user.classId));
  }
  const allowed = await getAuthorizedClassIds(user.role, user.id);
  return surveys.filter((survey: any) =>
    survey.createdBy === user.id ||
    (survey.assignedClasses || []).some((classroom: any) => allowed.has(classroom.id)),
  );
}

function parseStoredValue(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function validateSurveyAnswer(question: any, value: unknown): string | null {
  const options = Array.isArray(question.options) ? question.options : [];
  if (question.type === "single-choice" || question.type === "likert") {
    return typeof value === "string" && options.includes(value)
      ? null
      : "Geçerli bir seçenek işaretlenmelidir.";
  }
  if (question.type === "multiple-choice") {
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !options.includes(item))) {
      return "En az bir geçerli seçenek işaretlenmelidir.";
    }
    return null;
  }
  if (question.type === "open-text") {
    return typeof value === "string" && value.trim().length > 0 && value.length <= 5000
      ? null
      : "Açık uçlu cevap 1-5000 karakter arasında olmalıdır.";
  }
  if (question.type === "rating") {
    const max = Number(question.config?.max || 5);
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max
      ? null
      : `Derecelendirme 1-${max} arasında olmalıdır.`;
  }
  return "Desteklenmeyen soru türü.";
}

router.get("/results", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = resultQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Geçersiz filtre." });
    const range = parseDateRange(parsed.data);
    if (!range) return res.status(400).json({ message: "Geçersiz tarih aralığı." });

    let surveys = await getAccessibleSurveys(req.user!);
    if (parsed.data.surveyId) {
      surveys = surveys.filter((survey) => survey.id === parsed.data.surveyId);
      if (surveys.length === 0) return res.status(403).json({ message: "Bu anketin sonuçlarına erişim yetkiniz yok." });
    }

    const results = await Promise.all(surveys.map(async (survey: any) => {
      const [questions, submissions] = await Promise.all([
        storage.getQuestionsByQuiz(survey.id),
        storage.getSurveySubmissions(survey.id, range.startDate, range.endDate),
      ]);
      const audienceSize = survey.audienceSize ?? new Set(
        (survey.assignedClasses || []).flatMap((classroom: any) =>
          Array.isArray(classroom.students) ? classroom.students.map((student: any) => student.id) : [],
        ),
      ).size;
      const questionResults = questions.map((question: any) => {
        const options = Array.isArray(question.options) ? question.options : [];
        const answers = submissions.flatMap((submission: any) =>
          submission.answers
            .filter((answer: any) => answer.questionId === question.id)
            .map((answer: any) => ({
              value: parseStoredValue(answer.value),
              studentName: submission.student?.name || "Bilinmeyen öğrenci",
              submittedAt: submission.submittedAt,
            })),
        );

        if (question.type === "open-text") {
          return {
            id: question.id,
            text: question.text,
            type: question.type,
            responseCount: answers.length,
            options,
            config: question.config || null,
            openAnswers: answers,
          };
        }

        const distribution = new Map<string, number>(
          options.map((option: unknown) => [String(option), 0]),
        );
        for (const answer of answers) {
          const values = Array.isArray(answer.value) ? answer.value : [answer.value];
          for (const item of values) {
            const label = String(item);
            distribution.set(label, (distribution.get(label) || 0) + 1);
          }
        }
        const distributionItems = [...distribution.entries()].map(([label, count]) => ({ label, count }));
        const totalSelections = distributionItems.reduce((total, item) => total + item.count, 0);
        const numericTotal = distributionItems.reduce((total, item) => {
          const numericLabel = Number(item.label);
          return Number.isFinite(numericLabel) ? total + numericLabel * item.count : total;
        }, 0);
        return {
          id: question.id,
          text: question.text,
          type: question.type,
          responseCount: answers.length,
          options,
          config: question.config || null,
          totalSelections,
          averageValue: question.type === "rating" && totalSelections > 0
            ? Math.round((numericTotal / totalSelections) * 10) / 10
            : null,
          distribution: distributionItems,
        };
      });

      return {
        id: survey.id,
        title: survey.title,
        createdAt: survey.createdAt,
        participantCount: submissions.length,
        audienceSize,
        participationRate: audienceSize > 0 ? Math.round((submissions.length / audienceSize) * 100) : 0,
        questionResults,
      };
    }));

    res.json({ surveys: results });
  } catch (error) {
    console.error("Survey results error:", error);
    res.status(500).json({ message: "Anket sonuçları getirilemedi." });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const surveys = await getAccessibleSurveys(req.user!);
    if (req.user!.role !== "student") return res.json({ surveys });

    const enriched = await Promise.all(surveys.map(async (survey) => ({
      ...survey,
      submitted: Boolean(await storage.getStudentSurveySubmission(survey.id, req.user!.id)),
    })));
    res.json({ surveys: enriched });
  } catch (error) {
    res.status(500).json({ message: "Anketler getirilemedi." });
  }
});

router.post("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = surveyWriteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Geçersiz anket bilgileri." });
    const { assignedClassIds, ...data } = parsed.data;
    if (!await canAssignClasses(req.user!.role, req.user!.id, assignedClassIds)) {
      return res.status(403).json({ message: "Yalnızca yetkili olduğunuz sınıflara anket atayabilirsiniz." });
    }
    const audience = new Set<string>();
    for (const classId of assignedClassIds) {
      (await storage.getStudentsByClass(classId)).forEach((student) => audience.add(student.id));
    }
    const survey = await storage.createQuiz({
      ...data,
      contentType: "survey",
      timeLimit: null,
      shuffleQuestions: false,
      createdBy: req.user!.id,
      publishedAt: data.status === "published" ? new Date() : null,
      audienceSize: data.status === "published" ? audience.size : null,
      assignedClassIds,
    });
    res.status(201).json({ survey });
  } catch (error) {
    res.status(500).json({ message: "Anket oluşturulamadı." });
  }
});

router.patch("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await storage.getQuiz(req.params.id);
    if (!existing || existing.contentType !== "survey") return res.status(404).json({ message: "Anket bulunamadı." });
    if (req.user!.role === "teacher" && existing.createdBy !== req.user!.id) return res.status(403).json({ message: "Bu anketi düzenleme yetkiniz yok." });
    const parsed = surveyWriteSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Geçersiz anket bilgileri." });
    const assignedClassIds = parsed.data.assignedClassIds;
    if (assignedClassIds && !await canAssignClasses(req.user!.role, req.user!.id, assignedClassIds)) {
      return res.status(403).json({ message: "Yalnızca yetkili olduğunuz sınıflara anket atayabilirsiniz." });
    }
    const publicationFields: { publishedAt?: Date; audienceSize?: number } = {};
    if (parsed.data.status === "published" && existing.status !== "published") {
      const questions = await storage.getQuestionsByQuiz(existing.id);
      if (questions.length === 0) return res.status(400).json({ message: "Yayınlamak için en az bir anket sorusu gereklidir." });
      const effectiveClassIds = assignedClassIds || ((existing as any).assignedClasses || []).map((item: any) => item.id);
      const audience = new Set<string>();
      for (const classId of effectiveClassIds) {
        (await storage.getStudentsByClass(classId)).forEach((student) => audience.add(student.id));
      }
      publicationFields.publishedAt = new Date();
      publicationFields.audienceSize = audience.size;
    }
    const survey = await storage.updateQuiz(req.params.id, { ...parsed.data, ...publicationFields, contentType: "survey", timeLimit: null, shuffleQuestions: false, assignedClassIds });
    res.json({ survey });
  } catch (error) {
    res.status(500).json({ message: "Anket güncellenemedi." });
  }
});

router.post("/:id/questions", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const survey = await storage.getQuiz(req.params.id);
    if (!survey || survey.contentType !== "survey") return res.status(404).json({ message: "Anket bulunamadı." });
    if (req.user!.role === "teacher" && survey.createdBy !== req.user!.id) return res.status(403).json({ message: "Bu ankete soru ekleme yetkiniz yok." });
    const parsed = surveyQuestionSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.some((question) => ["single-choice", "multiple-choice", "likert"].includes(question.type) && (question.options.length < 2 || question.options.some((option) => !option.trim())))) {
      return res.status(400).json({ message: "Anket soruları veya seçenekleri geçersiz." });
    }
    const questions = await storage.syncQuestions(req.params.id, parsed.data.map((question) => ({ ...question, quizId: req.params.id, correctAnswer: null })));
    res.status(201).json({ questions });
  } catch (error) {
    if ((error as Error).message === "CONTENT_HAS_RESPONSES") return res.status(409).json({ message: "Katılım başladıktan sonra sorular değiştirilemez. Yeni bir sınav/anket oluşturun." });
    if ((error as Error).message === "INVALID_QUESTION_ID") return res.status(400).json({ message: "Geçersiz soru kimliği." });
    console.error("Survey question synchronization error:", error);
    res.status(500).json({ message: "Anket soruları kaydedilemedi." });
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const survey = await storage.getQuiz(req.params.id);
    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });
    if (!await canAccessSurvey(survey, req.user!)) {
      return res.status(403).json({ message: "Bu ankete erişim yetkiniz yok." });
    }
    const questions = await storage.getQuestionsByQuiz(survey.id);
    const safeQuestions = questions.map(({ correctAnswer: _correctAnswer, ...question }: any) => question);
    const submission = req.user!.role === "student"
      ? await storage.getStudentSurveySubmission(survey.id, req.user!.id)
      : undefined;
    res.json({ survey, questions: safeQuestions, submitted: Boolean(submission) });
  } catch (error) {
    res.status(500).json({ message: "Anket getirilemedi." });
  }
});

router.post("/:id/submit", requireAuth, requireRole(["student"]), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = submissionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Geçersiz cevap verisi." });

    const survey = await storage.getQuiz(req.params.id);
    if (!survey) return res.status(404).json({ message: "Anket bulunamadı." });
    if (!await canAccessSurvey(survey, req.user!)) {
      return res.status(403).json({ message: "Bu ankete erişim yetkiniz yok." });
    }
    if (await storage.getStudentSurveySubmission(survey.id, req.user!.id)) {
      return res.status(409).json({ message: "Bu anketi daha önce yanıtladınız." });
    }

    const questions = await storage.getQuestionsByQuiz(survey.id);
    if (questions.length === 0) return res.status(409).json({ message: "Ankette yanıtlanacak soru bulunmuyor." });
    const answerKeys = Object.keys(parsed.data.answers);
    if (answerKeys.length !== questions.length || answerKeys.some((id) => !questions.some((question) => question.id === id))) {
      return res.status(400).json({ message: "Tüm anket soruları yanıtlanmalıdır." });
    }

    const normalized = questions.map((question: any) => {
      const value = parsed.data.answers[question.id];
      const validationError = validateSurveyAnswer(question, value);
      if (validationError) throw new Error(`${question.text}: ${validationError}`);
      return { questionId: question.id, value };
    });

    const submission = await storage.createSurveySubmission(survey.id, req.user!.id, normalized);
    await storage.createLog(req.user!.id, "SUBMIT_SURVEY", `Submitted survey: ${survey.title}`);
    res.status(201).json({ submissionId: submission.id, submittedAt: submission.submittedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Anket gönderilemedi.";
    if (message.includes("Unique constraint")) return res.status(409).json({ message: "Bu anketi daha önce yanıtladınız." });
    if (message.includes(": ")) return res.status(400).json({ message });
    console.error("Survey submit error:", error);
    res.status(500).json({ message: "Anket gönderilemedi." });
  }
});

export default router;
