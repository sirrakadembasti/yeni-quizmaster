import { Router, type Response, type Request } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

const router: Router = Router();

// ==================== SCHEMAS ====================

const classSchema = z.object({
  name: z.string().min(2, "Sınıf adı en az 2 karakter olmalıdır.").max(50),
  description: z.string().max(200).optional().nullable(),
  maxStudents: z.number().int().positive().optional().nullable(),
  classTeacherId: z.string().uuid("Geçersiz öğretmen ID.").optional().nullable(),
  teacherId: z.string().uuid().optional().nullable(), // Legacy support
});

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
    res.status(500).json({ message: "Sınıflar getirilemedi." });
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cls = await storage.getClass(req.params.id);
    if (!cls) return res.status(404).json({ message: "Sınıf bulunamadı." });

    // IDOR Check
    if (req.user!.role === "student" && req.user!.classId !== cls.id) {
      return res.status(403).json({ message: "Sadece kendi sınıfınızın detaylarını görebilirsiniz." });
    }
    if (req.user!.role === "teacher") {
      const isAssigned = (cls as any).teachers?.some((t: any) => t.id === req.user!.id) || cls.classTeacherId === req.user!.id;
      if (!isAssigned) {
         return res.status(403).json({ message: "Sadece atandığınız sınıfların detaylarını görebilirsiniz." });
      }
    }

    const students = await storage.getStudentsByClass(req.params.id);
    res.json({ class: cls, students });
  } catch (error) {
    res.status(500).json({ message: "Sınıf detayları getirilemedi." });
  }
});

router.get("/:id/students", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // IDOR Check
    if (req.user!.role === "student" && req.user!.classId !== req.params.id) {
      return res.status(403).json({ message: "Sadece kendi sınıfınızdaki öğrencileri görebilirsiniz." });
    }
    
    if (req.user!.role === "teacher") {
      const cls = await storage.getClass(req.params.id);
      if (!cls) return res.status(404).json({ message: "Sınıf bulunamadı." });
      const isAssigned = (cls as any).teachers?.some((t: any) => t.id === req.user!.id) || cls.classTeacherId === req.user!.id;
      if (!isAssigned) {
        return res.status(403).json({ message: "Sadece atandığınız sınıfların öğrencilerini görebilirsiniz." });
      }
    }

    const students = await storage.getStudentsByClass(req.params.id);
    res.json({ students });
  } catch (error) {
    res.status(500).json({ message: "Sınıf öğrencileri getirilemedi." });
  }
});

router.post("/", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = classSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }
    const cls = await storage.createClass(validation.data);
    res.status(201).json(cls);
  } catch (error: any) {
    if (error.message === "CLASS_EXISTS") {
      return res.status(400).json({ message: "Bu isimde bir sınıf zaten mevcut." });
    }
    res.status(500).json({ message: "Sınıf oluşturulamadı." });
  }
});

router.patch("/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = classSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }
    const cls = await storage.updateClass(req.params.id, validation.data);
    if (!cls) return res.status(404).json({ message: "Sınıf bulunamadı." });
    res.json(cls);
  } catch (error: any) {
    if (error.message === "CLASS_EXISTS") {
      return res.status(400).json({ message: "Bu isimde bir sınıf zaten mevcut." });
    }
    res.status(500).json({ message: "Sınıf güncellenemedi." });
  }
});

router.delete("/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.deleteClass(req.params.id);
    res.json({ message: "Sınıf silindi." });
  } catch (error) {
    res.status(500).json({ message: "Sınıf silinemedi." });
  }
});

router.post("/:id/teachers", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { teacherId } = req.body;
    const teacher = await storage.getUser(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(400).json({ message: "Geçersiz öğretmen ID." });
    }
    await storage.assignTeacherToClass(teacherId, req.params.id);
    res.json({ message: "Öğretmen sınıfa atandı." });
  } catch (error) {
    res.status(500).json({ message: "Öğretmen atanamadı." });
  }
});

router.delete("/:id/teachers/:teacherId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.removeTeacherFromClass(req.params.teacherId, req.params.id);
    res.json({ message: "Öğretmen sınıftan çıkarıldı." });
  } catch (error) {
    res.status(500).json({ message: "Öğretmen çıkarılamadı." });
  }
});

router.post("/:id/students", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.body;
    const cls = await storage.getClass(req.params.id);
    if (!cls) return res.status(404).json({ message: "Sınıf bulunamadı." });

    // Teacher ownership check — classTeacherId veya teachers listesi üzerinden iki yollu kontrol
    if (req.user!.role === "teacher") {
      const isAssigned =
        (cls as any).teachers?.some((t: any) => t.id === req.user!.id) ||
        cls.classTeacherId === req.user!.id;
      if (!isAssigned) return res.status(403).json({ message: "Bu sınıfa öğrenci ekleme yetkiniz yok." });
    }

    const student = await storage.getUser(studentId);
    if (!student || student.role !== 'student') {
      return res.status(400).json({ message: "Geçersiz öğrenci ID." });
    }
    await storage.assignStudentToClass(studentId, req.params.id);
    res.json({ message: "Öğrenci sınıfa eklendi." });
  } catch (error) {
    res.status(500).json({ message: "Öğrenci eklenemedi." });
  }
});

router.delete("/:id/students/:studentId", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const cls = await storage.getClass(req.params.id);
    if (!cls) return res.status(404).json({ message: "Sınıf bulunamadı." });

    // Teacher ownership check — classTeacherId veya teachers listesi üzerinden iki yollu kontrol
    if (req.user!.role === "teacher") {
      const isAssigned =
        (cls as any).teachers?.some((t: any) => t.id === req.user!.id) ||
        cls.classTeacherId === req.user!.id;
      if (!isAssigned) return res.status(403).json({ message: "Bu sınıftan öğrenci çıkarma yetkiniz yok." });
    }

    await storage.removeStudentFromClass(req.params.studentId);
    res.json({ message: "Öğrenci sınıftan çıkarıldı." });
  } catch (error) {
    res.status(500).json({ message: "Öğrenci çıkarılamadı." });
  }
});

router.post("/:id/categories", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId } = req.body;
    await storage.assignCategoryToClass(req.params.id, categoryId);
    await storage.createLog(req.user!.id, "ASSIGN_CATEGORY_TO_CLASS", `Sınıf ID: ${req.params.id}, Ders ID: ${categoryId}`);
    res.status(200).json({ message: "Ders sınıfa atandı." });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/:id/categories/:categoryId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.removeCategoryFromClass(req.params.id, req.params.categoryId);
    await storage.createLog(req.user!.id, "REMOVE_CATEGORY_FROM_CLASS", `Sınıf ID: ${req.params.id}, Ders ID: ${req.params.categoryId}`);
    res.status(200).json({ message: "Ders sınıftan çıkarıldı." });
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
    res.status(200).json({ message: "Ders öğretmene atandı." });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/teachers/:id/categories/:categoryId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.removeCategoryFromTeacher(req.params.id, req.params.categoryId);
    await storage.createLog(req.user!.id, "REMOVE_CATEGORY_FROM_TEACHER", `Öğretmen ID: ${req.params.id}, Ders ID: ${req.params.categoryId}`);
    res.status(200).json({ message: "Ders öğretmenden çıkarıldı." });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// Triple Relationship: Teacher -> Class -> Course
router.post("/:id/teachers-with-course", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { teacherId, categoryId } = req.body;
    await storage.assignTeacherToClassWithCourse(req.params.id, teacherId, categoryId);
    res.json({ message: "Öğretmen sınıfa ilgili dersle birlikte atandı." });
  } catch (error: any) {
    res.status(500).json({ message: "Atama başarısız: " + error.message });
  }
});

router.delete("/teacher-course/:assignmentId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.removeTeacherFromClassWithCourse(req.params.assignmentId);
    res.json({ message: "Atama kaldırıldı." });
  } catch (error: any) {
    res.status(500).json({ message: "Kaldırma başarısız: " + error.message });
  }
});

export default router;
