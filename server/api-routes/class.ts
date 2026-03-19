import { Router, type Response, type Request } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();

// ==================== CLASS ROUTES ====================

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
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

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const cls = await storage.getClass(req.params.id);
    if (!cls) return res.status(404).json({ message: "Class not found" });
    const students = await storage.getStudentsByClass(cls.id);
    res.json({ class: cls, students });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch class details" });
  }
});

router.post("/", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const cls = await storage.createClass(req.body);
    res.status(201).json(cls);
  } catch (error) {
    res.status(500).json({ message: "Failed to create class" });
  }
});

router.patch("/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const cls = await storage.updateClass(req.params.id, req.body);
    if (!cls) return res.status(404).json({ message: "Class not found" });
    res.json(cls);
  } catch (error) {
    res.status(500).json({ message: "Failed to update class" });
  }
});

router.delete("/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.deleteClass(req.params.id);
    res.json({ message: "Class deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete class" });
  }
});

router.post("/:id/teachers", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { teacherId } = req.body;
    const teacher = await storage.getUser(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }
    await storage.assignTeacherToClass(teacherId, req.params.id);
    res.json({ message: "Teacher assigned to class" });
  } catch (error) {
    res.status(500).json({ message: "Failed to assign teacher" });
  }
});

router.delete("/:id/teachers/:teacherId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.removeTeacherFromClass(req.params.teacherId, req.params.id);
    res.json({ message: "Teacher removed from class" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove teacher" });
  }
});

router.post("/:id/students", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.body;
    const student = await storage.getUser(studentId);
    if (!student || student.role !== 'student') {
      return res.status(400).json({ message: "Invalid student ID" });
    }
    await storage.assignStudentToClass(studentId, req.params.id);
    res.json({ message: "Student assigned to class" });
  } catch (error) {
    res.status(500).json({ message: "Failed to assign student" });
  }
});

router.delete("/:id/students/:studentId", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.removeStudentFromClass(req.params.studentId);
    res.json({ message: "Student removed from class" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove student" });
  }
});

router.post("/:id/categories", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId } = req.body;
    await storage.assignCategoryToClass(req.params.id, categoryId);
    await storage.createLog(req.user!.id, "ASSIGN_CATEGORY_TO_CLASS", `Sınıf ID: ${req.params.id}, Ders ID: ${categoryId}`);
    res.status(200).json({ message: "Ders sınıfa atandı" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/:id/categories/:categoryId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.removeCategoryFromClass(req.params.id, req.params.categoryId);
    await storage.createLog(req.user!.id, "REMOVE_CATEGORY_FROM_CLASS", `Sınıf ID: ${req.params.id}, Ders ID: ${req.params.categoryId}`);
    res.status(200).json({ message: "Ders sınıftan çıkarıldı" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// Since these are related to teachers and categories, keeping them here for consistency with original structure
router.post("/teachers/:id/categories", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId } = req.body;
    await storage.assignCategoryToTeacher(req.params.id, categoryId);
    await storage.createLog(req.user!.id, "ASSIGN_CATEGORY_TO_TEACHER", `Öğretmen ID: ${req.params.id}, Ders ID: ${categoryId}`);
    res.status(200).json({ message: "Ders öğretmene atandı" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/teachers/:id/categories/:categoryId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.removeCategoryFromTeacher(req.params.id, req.params.categoryId);
    await storage.createLog(req.user!.id, "REMOVE_CATEGORY_FROM_TEACHER", `Öğretmen ID: ${req.params.id}, Ders ID: ${req.params.categoryId}`);
    res.status(200).json({ message: "Ders öğretmenden çıkarıldı" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
