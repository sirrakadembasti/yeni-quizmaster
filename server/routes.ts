import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  insertUserSchema, 
  insertQuizSchema, 
  insertQuestionSchema, 
  insertStudentResultSchema,
  type Question,
  type User,
  type Quiz,
  type Category,
  type InsertStudentResult
} from "./schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { randomUUID } from "crypto";

// Extend Express session to include user
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// Custom request type to include authenticated user
interface AuthRequest extends Request {
  user?: User;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Multer configuration for file uploads
  const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = 'uploads/';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage: uploadStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const mimetype = allowedTypes.test(file.mimetype);
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      if (mimetype && extname) return cb(null, true);
      cb(new Error("Only image files are allowed!"));
    }
  });

  // Auth middleware
  const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };

  const requireRole = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    };
  };

  // ==================== AUTH ROUTES ====================
  
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, password, classNo, classId } = req.body;
      const email = req.body.email?.trim();
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) return res.status(400).json({ message: "Email already registered" });
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ 
        name, 
        email, 
        password: hashedPassword, 
        role: 'student',
        classNo,
        classId
      });
      req.session.userId = user.id;
      await storage.createLog(user.id, "REGISTER", `User registered as student`);
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      const email = req.body.email?.trim();
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
      await storage.createLog(user.id, "LOGIN", `User logged in`);
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req: AuthRequest, res: Response) => {
    await storage.createLog(req.user!.id, "LOGOUT", `User logged out`);
    req.session.destroy(() => res.json({ message: "Logged out" }));
  });

  app.get("/api/auth/me", requireAuth, (req: AuthRequest, res: Response) => {
    const { password, ...userWithoutPassword } = req.user!;
    res.json({ user: userWithoutPassword });
  });

  app.patch("/api/auth/me", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const updatedUser = await storage.updateUser(req.user!.id, req.body);
      const { password, ...userWithoutPassword } = updatedUser;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // ==================== ADMIN ROUTES ====================

  app.get("/api/admin/logs", requireAuth, requireRole(["admin"]), async (req, res) => {
    try {
      const logs = await storage.getLogs();
      res.json({ logs });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // ==================== UPLOAD ROUTES ====================
  
  app.post("/api/upload", requireAuth, upload.single('image'), (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  });

  // ==================== USER MANAGEMENT ====================

  app.get("/api/users", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    const users = await storage.getAllUsers();
    const filtered = req.user!.role === 'teacher' ? users.filter(u => u.role === 'student') : users;
    res.json({ users: filtered.map(({ password, ...u }) => u) });
  });

  app.patch("/api/users/:id/role", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
    const { role } = req.body;
    if (!['admin', 'teacher', 'student'].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    await storage.updateUserRole(req.params.id, role);
    res.json({ message: "Role updated" });
  });

  // ==================== QUIZ ROUTES ====================

  app.get("/api/quizzes", requireAuth, async (req: AuthRequest, res: Response) => {
    let quizzes;
    if (req.user!.role === "student") {
      quizzes = (await storage.getAllQuizzes()).filter(q => q.status === "published");
    } else if (req.user!.role === "teacher") {
      quizzes = await storage.getQuizzesByCreator(req.user!.id);
    } else {
      quizzes = await storage.getAllQuizzes();
    }
    res.json({ quizzes });
  });

  app.get("/api/quizzes/:id", requireAuth, async (req: Request, res: Response) => {
    const quiz = await storage.getQuiz(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Not found" });
    const questions = await storage.getQuestionsByQuiz(quiz.id);
    res.json({ quiz, questions });
  });

  app.post("/api/quizzes", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, category, categoryId, difficulty, timeLimit, shuffleQuestions, status, assignedClassIds } = req.body;
      
      let finalCategoryId = categoryId;
      if (!finalCategoryId && category) {
        const cats = await storage.getAllCategories();
        const found = cats.find(c => c.name.toLowerCase() === category.toLowerCase());
        if (found) finalCategoryId = found.id;
      }

      const quiz = await (storage as any).createQuiz({
        title,
        description,
        category: category || "General",
        categoryId: finalCategoryId || null,
        difficulty: difficulty || "medium",
        timeLimit: timeLimit || null,
        shuffleQuestions: !!shuffleQuestions,
        status: status || "draft",
        createdBy: req.user!.id,
        assignedClassIds: Array.isArray(assignedClassIds) ? assignedClassIds : []
      });
      
      await storage.createLog(req.user!.id, "CREATE_QUIZ", `Created quiz: ${title}`);
      res.status(201).json({ quiz });
    } catch (error) {
      console.error("Create quiz error:", error);
      res.status(500).json({ message: "Failed to create quiz" });
    }
  });

  app.patch("/api/quizzes/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, category, categoryId, difficulty, timeLimit, shuffleQuestions, status, assignedClassIds } = req.body;
      
      const existingQuiz = await storage.getQuiz(req.params.id);
      if (!existingQuiz) return res.status(404).json({ message: "Quiz not found" });
      
      // Check permission
      if (req.user!.role === "teacher" && existingQuiz.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      let finalCategoryId = categoryId;
      if (!finalCategoryId && category) {
        const cats = await storage.getAllCategories();
        const found = cats.find(c => c.name.toLowerCase() === category.toLowerCase());
        if (found) finalCategoryId = found.id;
      }

      const quiz = await (storage as any).updateQuiz(req.params.id, {
        title,
        description,
        categoryId: finalCategoryId || null,
        difficulty,
        timeLimit,
        shuffleQuestions,
        status,
        category: category || "General",
        assignedClassIds: Array.isArray(assignedClassIds) ? assignedClassIds : []
      });
      
      await storage.createLog(req.user!.id, "UPDATE_QUIZ", `Updated quiz: ${title || existingQuiz.title}`);
      res.json({ quiz });
    } catch (error) {
      console.error("Update quiz error:", error);
      res.status(500).json({ message: "Failed to update quiz" });
    }
  });

  app.post("/api/quizzes/:id/questions", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    try {
      const quizId = req.params.id;
      console.log(`[express] Syncing questions for quiz ${quizId}...`);
      
      if (!Array.isArray(req.body)) {
        console.error("[express] Body is not an array:", req.body);
        return res.status(400).json({ message: "Body must be an array of questions" });
      }

      // Validate quiz exists and user has permission
      const quiz = await storage.getQuiz(quizId);
      if (!quiz) {
        console.error(`[express] Quiz ${quizId} not found`);
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // First, delete existing questions to perform a clean update
      await storage.deleteQuestionsByQuiz(quizId);
      
      const questionsData = req.body.map((q: any) => ({
        quizId: quizId,
        text: String(q.text || ""),
        type: String(q.type || 'multiple-choice'),
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: String(q.correctAnswer || ""),
        imageUrl: q.imageUrl || null,
        order: Number(q.order) || 0
      }));
      
      console.log(`[express] Mapping complete. Creating ${questionsData.length} questions...`);
      const questions = await storage.createQuestions(questionsData);
      console.log(`[express] Successfully synced ${questions.length} questions`);
      
      res.status(201).json({ questions });
    } catch (error) {
      console.error("[express] Sync questions error:", error);
      res.status(500).json({ message: "Failed to sync questions." });
    }
  });

  app.delete("/api/quizzes/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) return res.status(404).json({ message: "Not found" });
      if (req.user!.role === "teacher" && quiz.createdBy !== req.user!.id) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteQuiz(req.params.id);
      res.json({ message: "Deleted" });
    } catch (e) {
      res.status(500).json({ message: "Delete failed" });
    }
  });

  // ==================== CATEGORY ROUTES ====================

  app.get("/api/categories", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    try {
      const category = await storage.createCategory(req.body);
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    try {
      const updated = await storage.updateCategory(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Category not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.json({ message: "Category deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // ==================== CLASS ROUTES ====================

  app.get("/api/classes", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      let classes;
      if (req.user!.role === "admin") {
        classes = await storage.getAllClasses();
      } else if (req.user!.role === "teacher") {
        classes = await storage.getClassesByTeacher(req.user!.id);
      } else {
        classes = req.user!.classId ? [await storage.getClass(req.user!.classId)] : [];
      }
      res.json({ classes });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch classes" });
    }
  });

  app.get("/api/classes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const cls = await storage.getClass(req.params.id);
      if (!cls) return res.status(404).json({ message: "Class not found" });
      const students = await storage.getStudentsByClass(cls.id);
      res.json({ class: cls, students });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch class details" });
    }
  });

  app.post("/api/classes", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const cls = await storage.createClass(req.body);
      res.status(201).json(cls);
    } catch (error) {
      res.status(500).json({ message: "Failed to create class" });
    }
  });

  app.post("/api/classes/:id/students", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    try {
      const { studentId } = req.body;
      const student = await storage.getUser(studentId);
      if (!student || student.role !== 'student') {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      // Strict single classroom membership is enforced here and in Prisma schema
      await storage.assignStudentToClass(studentId, req.params.id);
      res.json({ message: "Student assigned to class" });
    } catch (error) {
      res.status(500).json({ message: "Failed to assign student" });
    }
  });

  app.delete("/api/classes/:id/students/:studentId", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    try {
      await storage.removeStudentFromClass(req.params.studentId);
      res.json({ message: "Student removed from class" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove student" });
    }
  });

  app.post("/api/classes/:id/categories", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { categoryId } = req.body;
      await storage.assignCategoryToClass(req.params.id, categoryId);
      await storage.createLog(req.user!.id, "ASSIGN_CATEGORY_TO_CLASS", `Sınıf ID: ${req.params.id}, Ders ID: ${categoryId}`);
      res.status(200).json({ message: "Ders sınıfa atandı" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/classes/:id/categories/:categoryId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
    try {
      await storage.removeCategoryFromClass(req.params.id, req.params.categoryId);
      await storage.createLog(req.user!.id, "REMOVE_CATEGORY_FROM_CLASS", `Sınıf ID: ${req.params.id}, Ders ID: ${req.params.categoryId}`);
      res.status(200).json({ message: "Ders sınıftan çıkarıldı" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/users/:id/categories", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
    try {
      const { categoryId } = req.body;
      await storage.assignCategoryToTeacher(req.params.id, categoryId);
      await storage.createLog(req.user!.id, "ASSIGN_CATEGORY_TO_TEACHER", `Öğretmen ID: ${req.params.id}, Ders ID: ${categoryId}`);
      res.status(200).json({ message: "Ders öğretmene atandı" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/users/:id/categories/:categoryId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
    try {
      await storage.removeCategoryFromTeacher(req.params.id, req.params.categoryId);
      await storage.createLog(req.user!.id, "REMOVE_CATEGORY_FROM_TEACHER", `Öğretmen ID: ${req.params.id}, Ders ID: ${req.params.categoryId}`);
      res.status(200).json({ message: "Ders öğretmenden çıkarıldı" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== DASHBOARD & STATS ====================

  app.get("/api/dashboard/stats", requireAuth, requireRole(["admin"]), async (req, res) => {
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

  app.get("/api/teacher/dashboard/stats", requireAuth, requireRole(["teacher", "admin"]), async (req: AuthRequest, res: Response) => {
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

  // ==================== STUDENT ROUTES ====================

  app.get("/api/student/quizzes", requireAuth, async (req: AuthRequest, res: Response) => {
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

  app.get("/api/student/results", requireAuth, async (req: AuthRequest, res: Response) => {
    let studentId = req.user!.id;
    if ((req.user!.role === "teacher" || req.user!.role === "admin") && req.query.studentId) {
      studentId = req.query.studentId as string;
    }
    const results = await storage.getResultsByStudent(studentId);
    const enriched = await Promise.all(results.map(async r => ({ ...r, quiz: await storage.getQuiz(r.quizId) })));
    res.json({ results: enriched });
  });

  app.get("/api/student/results/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const result = await storage.getResult(req.params.id);
      if (!result) return res.status(404).json({ message: "Result not found" });

      const quiz = await storage.getQuiz(result.quizId);
      const questions = await storage.getQuestionsByQuiz(result.quizId);

      // Attach student's answers to the questions for the frontend
      const enrichedQuestions = questions.map(q => ({
        ...q,
        studentAnswer: result.answers?.[q.id] || null,
        isCorrect: result.answers?.[q.id] === q.correctAnswer
      }));

      res.json({ result, quiz, questions: enrichedQuestions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch result details" });
    }
  });
  app.get("/api/results/quiz/:quizId", requireAuth, requireRole(["admin", "teacher"]), async (req, res) => {
    const results = await storage.getResultsByQuiz(req.params.quizId);
    const quiz = await storage.getQuiz(req.params.quizId);
    const enriched = await Promise.all(results.map(async r => ({ 
      ...r, 
      student: await storage.getUser(r.studentId),
      quizTitle: quiz?.title
    })));
    res.json({ results: enriched });
  });

  app.get("/api/results/quiz/:quizId/live", requireAuth, requireRole(["admin", "teacher"]), async (req, res) => {
    const results = await storage.getLiveResults(req.params.quizId);
    const quiz = await storage.getQuiz(req.params.quizId);
    const enriched = await Promise.all(results.map(async r => ({ 
      ...r, 
      student: await storage.getUser(r.studentId),
      quizTitle: quiz?.title
    })));
    res.json({ results: enriched });
  });

  app.post("/api/student/quiz/:quizId/start", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const quiz = await storage.getQuiz(req.params.quizId);
      if (!quiz) return res.status(404).json({ message: "Not found" });
      
      const questions = await storage.getQuestionsByQuiz(quiz.id);
      let result = await storage.getStudentQuizResult(req.user!.id, quiz.id);
      
      // Only create a result record if the user is a student
      if (!result && req.user!.role === 'student') {
        result = await storage.createResult({ 
          studentId: req.user!.id, 
          quizId: quiz.id, 
          status: "in_progress", 
          totalQuestions: questions.length, 
          answers: {}, 
          startedAt: new Date() 
        });
      }
      
      // For teachers/admins, if no result exists, return a mock or limited object
      // StudentQuiz.tsx handles the absence of resultId via isPreviewMode check
      res.json({ 
        resultId: result?.id || 'preview-mode', 
        quiz, 
        questions: questions.map(({id, text, type, options}) => ({id, text, type, options})), 
        existingAnswers: result?.answers || {} 
      });
    } catch (e) {
      console.error("Start quiz error:", e);
      res.status(500).json({ message: "Failed to start quiz" });
    }
  });

  app.post("/api/student/quiz/:resultId/answer", requireAuth, async (req, res) => {
    const result = await storage.getResult(req.params.resultId);
    if (!result) return res.status(404).json({ message: "Not found" });
    const question = await storage.getQuestion(req.body.questionId);
    if (!question) return res.status(404).json({ message: "Question not found" });
    const answers = { ...result.answers, [req.body.questionId]: req.body.selectedOption };
    const allQ = await storage.getQuestionsByQuiz(result.quizId);
    let correct = 0;
    allQ.forEach(q => { if (answers[q.id] === q.correctAnswer) correct++; });
    await storage.updateResult(result.id, { answers, correctAnswersCount: correct });
    res.json({ isCorrect: question.correctAnswer === req.body.selectedOption });
  });

  app.post("/api/student/quiz/:resultId/submit", requireAuth, async (req, res) => {
    const result = await storage.getResult(req.params.resultId);
    if (!result) return res.status(404).json({ message: "Not found" });
    const allQ = await storage.getQuestionsByQuiz(result.quizId);
    let correct = 0;
    allQ.forEach(q => { if (result.answers?.[q.id] === q.correctAnswer) correct++; });
    const score = Math.round((correct / allQ.length) * 100);
    await storage.updateResult(result.id, { status: "completed", score, submittedAt: new Date(), timeTaken: Math.floor((Date.now() - new Date(result.startedAt!).getTime()) / 1000) });
    res.json({ score, correctAnswers: correct, totalQuestions: allQ.length });
  });

  // ==================== AI ROUTES ====================

  app.post("/api/ai/test-config", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    try {
      const { 
        baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/", 
        apiKey = process.env.GEMINI_API_KEY, 
        model = "gemini-1.5-flash" 
      } = req.body;

      if (!apiKey) {
        return res.status(400).json({ message: "API anahtarı bulunamadı." });
      }

      const response = await fetch(`${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5
        })
      });

      if (response.ok) {
        res.json({ success: true, message: "Bağlantı başarılı!" });
      } else {
        const errorData = await response.json().catch(() => ({}));
        res.status(response.status).json({ 
          success: false, 
          message: "Bağlantı başarısız.", 
          details: errorData.error?.message || "Servis sağlayıcı hatası." 
        });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "Bağlantı testi sırasında bir hata oluştu." });
    }
  });

  app.post("/api/ai/generate-questions", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
    try {
      const { 
        topic, 
        count = 3, 
        difficulty = "medium", 
        model = "gemini-1.5-flash",
        customBaseUrl,
        customApiKey
      } = req.body;

      const apiKey = customApiKey || process.env.GEMINI_API_KEY;
      const baseUrl = customBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/";

      if (!apiKey) {
        return res.status(500).json({ message: "API anahtarı yapılandırılmamış." });
      }

      console.log(`[AI] Generating questions for topic: "${topic}" using model: ${model} via ${baseUrl}`);

      const prompt = `Generate ${count} multiple-choice questions about "${topic}" at a medium difficulty level.
Each question MUST have exactly 5 options.
Respond ONLY with a valid JSON array of objects, where each object has the following structure:
{
  "text": "The question text",
  "type": "multiple-choice",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
  "correctAnswer": "The exact text of the correct option"
}
Do not include markdown code blocks, just the raw JSON array.`;

      const endpoint = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}chat/completions`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("AI Provider error status:", response.status);
        return res.status(500).json({ 
          message: "AI sağlayıcısından soru oluşturulamadı.",
          details: errorData.error?.message || "Bilinmeyen hata"
        });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        return res.status(500).json({ message: "AI sağlayıcısından boş içerik döndü." });
      }

      let questions = [];
      try {
        let cleanContent = content.trim();
        if (cleanContent.includes('```json')) {
          cleanContent = cleanContent.split('```json')[1].split('```')[0].trim();
        } else if (cleanContent.includes('```')) {
          cleanContent = cleanContent.split('```')[1].split('```')[0].trim();
        }
        
        const rawQuestions = JSON.parse(cleanContent);
        
        if (!Array.isArray(rawQuestions)) throw new Error("AI did not return an array");

        questions = rawQuestions.map((q: any) => {
          const options = Array.isArray(q.options) ? [...q.options] : ["A", "B", "C", "D"];
          const correctText = q.correctAnswer || options[0];
          
          // Shuffle options
          for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
          }
          
          const newCorrectIndex = options.indexOf(correctText);
          return {
            text: q.text || "İsimsiz Soru",
            type: "multiple-choice",
            options,
            correctAnswerIndex: newCorrectIndex !== -1 ? newCorrectIndex : 0
          };
        });
      } catch (parseError) {
        console.error("JSON Parse error:", content);
        return res.status(500).json({ message: "AI verisi işlenemedi. Lütfen tekrar deneyin." });
      }

      res.json({ questions });
    } catch (error) {
      console.error("AI Generation error:", error);
      res.status(500).json({ message: "Sunucu hatası oluştu." });
    }
  });

  return httpServer;
}
