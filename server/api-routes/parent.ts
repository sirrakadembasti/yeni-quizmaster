import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { isQuizVisibleToStudent } from "../utils/quiz-scope-policy";

const router: Router = Router();
const relationSchema = z.enum(["Anne", "Baba", "Diğer"]);

const createParentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(6).max(128),
  phoneNumber: z.string().trim().min(7).max(30),
  address: z.string().trim().min(5).max(500),
  studentId: z.string().uuid(),
  relation: relationSchema,
});

const linkSchema = z.object({
  guardianId: z.string().uuid(),
  studentId: z.string().uuid(),
  relation: relationSchema,
});

const updateParentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  phoneNumber: z.string().trim().min(7).max(30),
  address: z.string().trim().min(5).max(500),
}).strict();

const guardianStudentsSchema = z.object({
  studentIds: z.array(z.string().uuid()).max(1000).transform((ids) => [...new Set(ids)]),
});

async function isLinked(guardianId: string, studentId: string) {
  return (await storage.getGuardianStudents(guardianId)).some((link) => link.studentId === studentId);
}

router.get("/students", requireAuth, requireRole(["parent"]), async (req: AuthRequest, res: Response) => {
  const links = await storage.getGuardianStudents(req.user!.id);
  res.json({ students: links.map((link) => ({ ...link.student, relation: link.relation })) });
});

router.get("/students/:studentId/overview", requireAuth, requireRole(["parent"]), async (req: AuthRequest, res: Response) => {
  try {
    if (!await isLinked(req.user!.id, req.params.studentId)) return res.status(403).json({ message: "Bu öğrencinin bilgilerine erişim yetkiniz yok." });
    const student = await storage.getUser(req.params.studentId);
    if (!student || student.role !== "student") return res.status(404).json({ message: "Öğrenci bulunamadı." });
    const [results, allQuizzes] = await Promise.all([
      storage.getResultsByStudent(student.id),
      storage.getAllQuizzes(),
    ]);
    const quizzes = allQuizzes.filter(quiz => isQuizVisibleToStudent(quiz, student.classId));
    const completedResults = results.filter((result: any) => result.status === "completed");
    const { password, resetToken, resetTokenExpiry, ...safeStudent } = student as any;
    res.json({
      student: safeStudent,
      results: completedResults,
      quizzes: quizzes.map((quiz: any) => ({ id: quiz.id, title: quiz.title, category: quiz.category, publishedAt: quiz.publishedAt, createdAt: quiz.createdAt, completed: completedResults.some((result: any) => result.quizId === quiz.id) })),
    });
  } catch (error) {
    res.status(500).json({ message: "Veli paneli bilgileri getirilemedi." });
  }
});

router.get("/results/:resultId", requireAuth, requireRole(["parent"]), async (req: AuthRequest, res: Response) => {
  const result = await storage.getResult(req.params.resultId);
  if (!result || result.status !== "completed") return res.status(404).json({ message: "Sonuç bulunamadı." });
  if (!await isLinked(req.user!.id, result.studentId)) return res.status(403).json({ message: "Bu sonuca erişim yetkiniz yok." });
  const [quiz, questions] = await Promise.all([storage.getQuiz(result.quizId), storage.getQuestionsByQuiz(result.quizId)]);
  if (!quiz || (quiz as any).contentType === "survey") return res.status(404).json({ message: "Sınav bulunamadı." });
  const answers = ((result as any).answers || {}) as Record<string, unknown>;
  res.json({
    result,
    quiz,
    questions: questions.map((question: any) => ({ ...question, studentAnswer: answers[question.id] ?? null, isCorrect: answers[question.id] === question.correctAnswer })),
  });
});

router.get("/", requireAuth, requireRole(["admin"]), async (_req: AuthRequest, res: Response) => {
  const parents = (await storage.getAllUsers()).filter((user) => user.role === "parent").map(({ password: _password, ...parent }) => parent);
  res.json({ parents });
});

router.get("/student/:studentId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  res.json({ guardians: await storage.getStudentGuardians(req.params.studentId) });
});

router.get("/guardian/:guardianId/students", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  const guardian = await storage.getUser(req.params.guardianId);
  if (!guardian || guardian.role !== "parent") return res.status(404).json({ message: "Veli hesabı bulunamadı." });
  res.json({ students: await storage.getGuardianStudents(guardian.id) });
});

router.patch("/guardian/:guardianId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  const parsed = updateParentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Ad, geçerli e-posta, telefon ve adres zorunludur." });
  const guardian = await storage.getUser(req.params.guardianId);
  if (!guardian || guardian.role !== "parent") return res.status(404).json({ message: "Veli hesabı bulunamadı." });
  const normalizedEmail = parsed.data.email.toLowerCase();
  const owner = await storage.getUserByEmail(normalizedEmail);
  if (owner && owner.id !== guardian.id) return res.status(409).json({ message: "Bu e-posta başka bir hesapta kullanılıyor." });
  const updated = await storage.updateUser(guardian.id, { ...parsed.data, email: normalizedEmail } as any);
  const { password: _password, ...safeGuardian } = updated as any;
  res.json({ guardian: safeGuardian });
});

router.put("/guardian/:guardianId/students", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  const parsed = guardianStudentsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Geçerli öğrenci seçimleri gönderiniz." });
  const guardian = await storage.getUser(req.params.guardianId);
  if (!guardian || guardian.role !== "parent") return res.status(404).json({ message: "Veli hesabı bulunamadı." });
  const students = await Promise.all(parsed.data.studentIds.map((studentId) => storage.getUser(studentId)));
  if (students.some((student) => !student || student.role !== "student")) {
    return res.status(400).json({ message: "Seçimlerde geçersiz veya öğrenci olmayan bir hesap var." });
  }
  const links = await storage.replaceGuardianStudents(guardian.id, parsed.data.studentIds);
  await storage.createLog(req.user!.id, "SYNC_PARENT_STUDENTS", `Veli-öğrenci bağları güncellendi: ${guardian.id} (${parsed.data.studentIds.length} öğrenci)`);
  res.json({ students: links });
});

router.post("/", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createParentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Geçerli veli hesabı bilgileri giriniz." });
    const student = await storage.getUser(parsed.data.studentId);
    if ((student as any)?.isActive === false) return res.status(400).json({ message: "Pasif öğrenciye veli bağlanamaz." });
    if (!student || student.role !== "student") return res.status(404).json({ message: "Öğrenci bulunamadı." });
    const normalizedEmail = parsed.data.email.toLowerCase();
    if (await storage.getUserByEmail(normalizedEmail)) return res.status(409).json({ message: "Bu e-posta adresi zaten kullanımda." });
    const parent = await storage.createUser({
      name: parsed.data.name,
      email: normalizedEmail,
      password: await bcrypt.hash(parsed.data.password, 10),
      role: "parent",
      phoneNumber: parsed.data.phoneNumber || null,
      address: parsed.data.address || null,
    });
    await storage.linkGuardianStudent(parent.id, student.id, parsed.data.relation);
    await storage.createLog(req.user!.id, "CREATE_PARENT", `Veli hesabı oluşturuldu ve öğrenciye bağlandı: ${parent.id} -> ${student.id}`);
    const { password: _password, ...safeParent } = parent;
    res.status(201).json({ parent: safeParent });
  } catch (error) {
    res.status(500).json({ message: "Veli hesabı oluşturulamadı." });
  }
});

router.post("/link", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Geçersiz veli veya öğrenci bilgisi." });
  const [guardian, student] = await Promise.all([storage.getUser(parsed.data.guardianId), storage.getUser(parsed.data.studentId)]);
  if ((student as any)?.isActive === false) return res.status(400).json({ message: "Pasif öğrenciye veli bağlanamaz." });
  if (!guardian || guardian.role !== "parent") return res.status(404).json({ message: "Veli hesabı bulunamadı." });
  if (!student || student.role !== "student") return res.status(404).json({ message: "Öğrenci bulunamadı." });
  const link = await storage.linkGuardianStudent(guardian.id, student.id, parsed.data.relation);
  res.status(201).json({ link });
});

router.patch("/link/:guardianId/:studentId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ relation: relationSchema }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Yakınlık Anne, Baba veya Diğer olmalıdır." });
  const [guardian, student] = await Promise.all([storage.getUser(req.params.guardianId), storage.getUser(req.params.studentId)]);
  if (!guardian || guardian.role !== "parent" || !student || student.role !== "student" || (student as any).isActive === false) return res.status(404).json({ message: "Veli-öğrenci bağlantısı bulunamadı." });
  if (!await isLinked(guardian.id, student.id)) return res.status(404).json({ message: "Veli-öğrenci bağlantısı bulunamadı." });
  const link = await storage.linkGuardianStudent(req.params.guardianId, req.params.studentId, parsed.data.relation);
  res.json({ link });
});

router.delete("/link/:guardianId/:studentId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.unlinkGuardianStudent(req.params.guardianId, req.params.studentId);
    res.json({ message: "Veli bağlantısı kaldırıldı." });
  } catch (error: any) {
    if (error?.code === "P2025") return res.status(404).json({ message: "Veli bağlantısı bulunamadı." });
    res.status(500).json({ message: "Veli bağlantısı kaldırılamadı." });
  }
});

export default router;
