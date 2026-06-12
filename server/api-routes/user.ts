import { Router, type Response } from "express";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();

// ==================== USER MANAGEMENT ====================

router.get("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    let users;
    const userRole = String(req.user!.role).toLowerCase();
    
    if (userRole === 'admin') {
      // Admins see everyone
      users = await storage.getAllUsers();
    } else if (userRole === 'teacher') {
      // Teachers see students in their classes AND themselves
      const teacherClasses = await storage.getClassesByTeacher(req.user!.id);
      const studentIds = new Set<string>();
      const usersList: any[] = [];
      
      // Add themselves
      usersList.push(req.user!);
      
      // Add students from their classes
      for (const cls of teacherClasses) {
        const classStudents = await storage.getStudentsByClass(cls.id);
        classStudents.forEach(s => {
          if (!studentIds.has(s.id)) {
            studentIds.add(s.id);
            usersList.push(s);
          }
        });
      }
      users = usersList;
    } else {
      users = [];
    }

    const sanitizedUsers = users.map(u => {
      // Safely convert to plain object if it's a Prisma model
      const userObj = JSON.parse(JSON.stringify(u));
      // Remove sensitive fields
      const { password, resetToken, resetTokenExpiry, ...safeUser } = userObj;
      return safeUser;
    });

    res.json({ users: sanitizedUsers });
  } catch (error) {
    console.error("[GET /api/users] Error:", error);
    res.status(500).json({ message: "Kullanıcılar getirilemedi." });
  }
});

router.post("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, classNo, classId } = req.body;
    
    if (req.user!.role === 'teacher') {
      if (role !== 'student') {
        return res.status(403).json({ message: "Öğretmenler sadece öğrenci oluşturabilir." });
      }
      if (!classId) {
        return res.status(400).json({ message: "Öğrenci için sınıf belirtilmelidir." });
      }
      // Check if teacher belongs to this class
      const teacherClasses = await storage.getClassesByTeacher(req.user!.id);
      if (!teacherClasses.some(c => c.id === classId)) {
        return res.status(403).json({ message: "Sadece kendi sınıflarınıza öğrenci ekleyebilirsiniz." });
      }
    }

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) return res.status(400).json({ message: "Bu e-posta adresi zaten kullanımda." });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ 
      name, email, password: hashedPassword, role: role || 'student', classNo, classId 
    });
    
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: "Kullanıcı oluşturulamadı." });
  }
});

router.patch("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const currentUser = req.user!;

    const targetUser = await storage.getUser(targetUserId);
    if (!targetUser) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    const isUpdatingSelf = currentUser.id === targetUserId;
    const isAdmin = currentUser.role === 'admin';
    const isTeacher = currentUser.role === 'teacher';

    // Authorization logic
    if (!isUpdatingSelf && !isAdmin && !isTeacher) {
      return res.status(403).json({ message: "Bu işlemi yapma yetkiniz yok." });
    }

    // Teacher specific restrictions when editing OTHERS
    if (isTeacher && !isUpdatingSelf && !isAdmin) {
      if (targetUser.role !== 'student') {
        return res.status(403).json({ message: "Sadece öğrencileri düzenleyebilirsiniz." });
      }

      const teacherClasses = await storage.getClassesByTeacher(currentUser.id);
      if (!teacherClasses.some(c => c.id === targetUser.classId)) {
        return res.status(403).json({ message: "Sadece kendi sınıfınızdaki öğrencileri düzenleyebilirsiniz." });
      }

      // Prevent teacher from changing student role
      if (req.body.role && req.body.role !== 'student') {
        return res.status(403).json({ message: "Öğrenci rolünü değiştiremezsiniz." });
      }

      // If changing classId, check if teacher has access to new class
      if (req.body.classId && !teacherClasses.some(c => c.id === req.body.classId)) {
        return res.status(403).json({ message: "Öğrenciyi sadece kendi sınıflarınızdan birine taşıyabilirsiniz." });
      }
    }

    // Student restriction: Can only edit self
    if (currentUser.role === 'student' && !isUpdatingSelf) {
      return res.status(403).json({ message: "Diğer kullanıcıları düzenleme yetkiniz yok." });
    }

    // Prepare update data with strict field filtering to prevent privilege escalation
    const allowedFieldsForSelf = ['name', 'email', 'phoneNumber', 'address', 'password'];
    const filteredBody: any = {};

    if (isAdmin) {
      // Admin can update everything
      Object.assign(filteredBody, req.body);
    } else if (isUpdatingSelf) {
      // Users updating themselves can only update profile info
      for (const field of allowedFieldsForSelf) {
        if (req.body[field] !== undefined) {
          filteredBody[field] = req.body[field];
        }
      }
      // Explicitly block role/class changes for self if not admin
      delete filteredBody.role;
      delete filteredBody.classId;
      delete filteredBody.studentNo;
    } else if (isTeacher) {
      // Teacher updating a student
      const allowedFieldsForTeacherOnStudent = ['name', 'email', 'phoneNumber', 'address', 'password', 'classId', 'classNo', 'studentNo'];
      for (const field of allowedFieldsForTeacherOnStudent) {
        if (req.body[field] !== undefined) {
          filteredBody[field] = req.body[field];
        }
      }
    }

    if (filteredBody.password) {
      filteredBody.password = await bcrypt.hash(filteredBody.password, 10);
    } else {
      delete filteredBody.password;
    }

    if (filteredBody.classId === "") {
      filteredBody.classId = null;
    }

    const updatedUser = await storage.updateUser(targetUserId, filteredBody);
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("[PATCH /api/users/:id] Error:", error);
    res.status(500).json({ message: "Kullanıcı güncellenemedi." });
  }
});
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.deleteUser(req.params.id);
    res.json({ message: "Kullanıcı silindi." });
  } catch (error) {
    res.status(500).json({ message: "Kullanıcı silinemedi." });
  }
});

router.patch("/:id/role", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  const { role } = req.body;
  if (!['admin', 'teacher', 'student'].includes(role)) {
    return res.status(400).json({ message: "Geçersiz rol." });
  }
  await storage.updateUserRole(req.params.id, role);
  res.json({ message: "Rol güncellendi." });
});

// ==================== TEACHER CATEGORY ASSIGNMENTS ====================
// Client: POST /api/users/:id/categories  →  öğretmene ders ata
// Not: Aynı işlem /api/classes/teachers/:id/categories üzerinden de erişilebilir (class.ts).
//      Bu endpoint, client'ın kullandığı URL yapısını karşılamak için eklenmiştir.
router.post("/:id/categories", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId } = req.body;
    if (!categoryId) {
      return res.status(400).json({ message: "categoryId gereklidir." });
    }
    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser || targetUser.role !== 'teacher') {
      return res.status(404).json({ message: "Öğretmen bulunamadı." });
    }
    await storage.assignCategoryToTeacher(req.params.id, categoryId);
    await storage.createLog(req.user!.id, "ASSIGN_CATEGORY_TO_TEACHER", `Öğretmen ID: ${req.params.id}, Ders ID: ${categoryId}`);
    res.status(200).json({ message: "Ders öğretmene atandı." });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Ders atanamadı." });
  }
});

// Client: DELETE /api/users/:id/categories/:categoryId  →  öğretmenden ders kaldır
router.delete("/:id/categories/:categoryId", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.removeCategoryFromTeacher(req.params.id, req.params.categoryId);
    await storage.createLog(req.user!.id, "REMOVE_CATEGORY_FROM_TEACHER", `Öğretmen ID: ${req.params.id}, Ders ID: ${req.params.categoryId}`);
    res.status(200).json({ message: "Ders öğretmenden çıkarıldı." });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Ders kaldırılamadı." });
  }
});

export default router;
