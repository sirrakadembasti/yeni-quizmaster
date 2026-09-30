import { disconnectUserSockets } from "../socket";
import { z } from "zod";
import { Router, type Response } from "express";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PARENT_RELATIONS = new Set(["Anne", "Baba", "Diğer"]);

function validParentContact(data: Record<string, unknown>) {
  const fields = [data.parentName, data.parentRelation, data.parentPhone, data.parentEmail, data.parentAddress];
  if (!fields.some((value) => typeof value === "string" && value.trim())) return true;
  return typeof data.parentName === "string" && data.parentName.trim().length >= 2
    && typeof data.parentRelation === "string" && PARENT_RELATIONS.has(data.parentRelation)
    && typeof data.parentPhone === "string" && data.parentPhone.trim().length >= 7
    && typeof data.parentEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.parentEmail.trim())
    && typeof data.parentAddress === "string" && data.parentAddress.trim().length >= 5;
}

async function validateGuardianStudentIds(input: unknown) {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 1000) return null;
  const ids = [...new Set(input)];
  if (ids.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))) return null;
  const users = await Promise.all(ids.map((id) => storage.getUser(id)));
  if (users.some((user) => !user || user.role !== 'student' || (user as any).isActive === false)) return null;
  return ids as string[];
}

async function validateTeacherAssignmentIds(input: unknown, lookup: (id: string) => Promise<unknown>) {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 1000) return null;
  const ids = [...new Set(input)];
  if (ids.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id))) return null;
  const records = await Promise.all(ids.map((id) => lookup(id as string)));
  if (records.some((record) => !record)) return null;
  return ids as string[];
}

// ==================== USER MANAGEMENT ====================

router.get("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    let users: any[];
    const userRole = String(req.user!.role).toLowerCase();

    if (userRole === 'admin') {
      // Admins see everyone
      users = await storage.getAllUsers();
    } else if (userRole === 'teacher') {
      // Tek sorgu: yaln?zca yetkili s?n?flardaki ??renciler ve oturum sahibi ??retmen.
      users = [req.user!, ...await storage.getStudentsByTeacher(req.user!.id)];
    } else {
      users = [];
    }

    const sanitizedUsers = users.map(u => {
      // Safely convert to plain object if it's a Prisma model
      const userObj = JSON.parse(JSON.stringify(u));
      // Remove sensitive fields
      const { password, resetToken, resetTokenExpiry, ...safeUser } = userObj;
      if (userRole === 'teacher') {
        delete safeUser.parentName;
        delete safeUser.parentRelation;
        delete safeUser.parentPhone;
        delete safeUser.parentEmail;
        delete safeUser.parentAddress;
      }
      return safeUser;
    });

    res.json({ users: sanitizedUsers });
  } catch (error) {
    console.error("[GET /api/users] Error:", error);
    res.status(500).json({ message: "Kullanıcılar getirilemedi." });
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const currentUser = req.user!;
    const userRole = String(currentUser.role).toLowerCase();

    const targetUser = await storage.getUser(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    if (userRole === 'admin') {
      const { password, resetToken, resetTokenExpiry, ...safeUser } = targetUser as any;
      return res.json({ user: safeUser });
    }

    if (userRole === 'teacher') {
      if (targetUser.role !== 'student') {
        return res.status(403).json({ message: "Bu kullanıcıyı görüntüleme yetkiniz yok." });
      }
      const teacherClasses = await storage.getClassesByTeacher(currentUser.id);
      if (!teacherClasses.some(c => c.id === targetUser.classId)) {
        return res.status(403).json({ message: "Bu öğrenciyi görüntüleme yetkiniz yok." });
      }
      const {
        password, resetToken, resetTokenExpiry,
        parentName, parentRelation, parentPhone, parentEmail, parentAddress,
        ...safeUser
      } = targetUser as any;
      return res.json({ user: safeUser });
    }

    if (userRole === 'student') {
      if (currentUser.id !== targetUserId) {
        return res.status(403).json({ message: "Bu profili görüntüleme yetkiniz yok." });
      }
      const { password, resetToken, resetTokenExpiry, ...safeUser } = targetUser as any;
      return res.json({ user: safeUser });
    }

    return res.status(403).json({ message: "Yetkisiz işlem." });
  } catch (error) {
    console.error("[GET /api/users/:id] Error:", error);
    res.status(500).json({ message: "Kullanıcı bilgileri getirilemedi." });
  }
});

router.post("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, email, password, role, classId, phoneNumber, address, assignedCategoryIds, classIds,
      parentName, parentRelation, parentPhone, parentEmail, parentAddress
    } = req.body;

    if (!validParentContact(req.body)) return res.status(400).json({ message: "Veli iletişim kaydı girilecekse ad, yakınlık, telefon, e-posta ve adres eksiksiz olmalıdır." });

    if (typeof name !== "string" || name.trim().length < 2 || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Ad, geçerli e-posta ve en az 6 karakterli parola gereklidir." });
    }
    if (parentEmail && (typeof parentEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim()))) {
      return res.status(400).json({ message: "Geçerli bir veli e-posta adresi giriniz." });
    }
    const requestedRole = role || 'student';
    if (!['admin', 'teacher', 'student', 'parent'].includes(requestedRole)) {
      return res.status(400).json({ message: "Geçersiz rol." });
    }
    if (requestedRole === 'parent' && (typeof phoneNumber !== 'string' || phoneNumber.trim().length < 7 || typeof address !== 'string' || address.trim().length < 5)) {
      return res.status(400).json({ message: "Veli hesabı için telefon ve adres zorunludur." });
    }
    const guardianStudentIds = requestedRole === 'parent'
      ? await validateGuardianStudentIds(req.body.guardianStudentIds)
      : undefined;
    if (requestedRole === 'parent' && !guardianStudentIds) {
      return res.status(400).json({ message: "Geçersiz öğrenci seçimi." });
    }
    if (requestedRole !== 'teacher' && ((Array.isArray(assignedCategoryIds) && assignedCategoryIds.length > 0) || (Array.isArray(classIds) && classIds.length > 0))) {
      return res.status(400).json({ message: "Ders ve sınıf ataması yalnızca öğretmen hesabına yapılabilir." });
    }
    const teacherCategoryIds = requestedRole === 'teacher'
      ? await validateTeacherAssignmentIds(assignedCategoryIds, (id) => storage.getCategory(id)) : [];
    const teacherClassIds = requestedRole === 'teacher'
      ? await validateTeacherAssignmentIds(classIds, (id) => storage.getClass(id)) : [];
    if (!teacherCategoryIds || !teacherClassIds) {
      return res.status(400).json({ message: "Geçersiz öğretmen ders veya sınıf seçimi." });
    }

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

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await storage.getUserByEmail(normalizedEmail);
    if (existingUser) return res.status(400).json({ message: "Bu e-posta adresi zaten kullanımda." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userPayload: any = {
      name: name.trim(), email: normalizedEmail, password: hashedPassword, role: requestedRole, classId, phoneNumber, address
    };
    if (guardianStudentIds) userPayload.guardianStudentIds = guardianStudentIds;
    if (requestedRole === 'teacher') {
      userPayload.assignedCategoryIds = teacherCategoryIds;
      userPayload.classIds = teacherClassIds;
    }
    if (requestedRole !== 'student') {
      userPayload.classId = null;
    }

    // Only admin can set parent information
    if (req.user!.role === 'admin') {
      if (parentName !== undefined) userPayload.parentName = parentName;
      if (parentRelation !== undefined) userPayload.parentRelation = parentRelation;
      if (parentPhone !== undefined) userPayload.parentPhone = parentPhone;
      if (parentEmail !== undefined) userPayload.parentEmail = parentEmail;
      if (parentAddress !== undefined) userPayload.parentAddress = parentAddress;
    }

    const user = await storage.createUser(userPayload);

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
    if (currentUser.role === "student") {
      return res.status(403).json({ message: "Öğrenci profil bilgileri yalnızca okul yönetimi tarafından güncellenebilir." });
    }
    const updateSchema = z.object({
      name: z.string().trim().min(2).max(100).optional(),
      email: z.string().trim().email().optional(),
      password: z.string().min(6).optional(),
      role: z.enum(["admin", "teacher", "student", "parent"]).optional(),
    }).passthrough();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ message: "Geçersiz kullanıcı bilgileri." });
    if (isUpdatingSelf && req.body.password !== undefined) {
      if (typeof req.body.currentPassword !== "string" ||
          !await bcrypt.compare(req.body.currentPassword, targetUser.password)) {
        return res.status(400).json({ message: "Mevcut şifrenizi doğrulayın." });
      }
    }
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
      delete filteredBody.parentName;
      delete filteredBody.parentRelation;
      delete filteredBody.parentPhone;
      delete filteredBody.parentEmail;
      delete filteredBody.parentAddress;
    } else if (isTeacher) {
      // Teacher updating a student
      const allowedFieldsForTeacherOnStudent = ['name', 'email', 'phoneNumber', 'address', 'password', 'classId'];
      for (const field of allowedFieldsForTeacherOnStudent) {
        if (req.body[field] !== undefined) {
          filteredBody[field] = req.body[field];
        }
      }
      delete filteredBody.parentName;
      delete filteredBody.parentRelation;
      delete filteredBody.parentPhone;
      delete filteredBody.parentEmail;
      delete filteredBody.parentAddress;
    }

    // Sınıf numarası yalnızca sunucu tarafından atanır.
    delete filteredBody.studentNo;
    delete filteredBody.classNo;
    delete filteredBody.isActive;
    delete filteredBody.deactivatedAt;

    if (isAdmin && req.body.guardianStudentIds !== undefined) {
      if ((filteredBody.role || targetUser.role) !== 'parent') {
        delete filteredBody.guardianStudentIds;
      } else {
        const guardianStudentIds = await validateGuardianStudentIds(req.body.guardianStudentIds);
        if (!guardianStudentIds) {
          return res.status(400).json({ message: "Geçersiz öğrenci seçimi." });
        }
        filteredBody.guardianStudentIds = guardianStudentIds;
      }
    }

    if (typeof filteredBody.email === "string") {
      filteredBody.email = filteredBody.email.trim().toLowerCase();
      const emailOwner = await storage.getUserByEmail(filteredBody.email);
      if (emailOwner && emailOwner.id !== targetUserId) {
        return res.status(409).json({ message: "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor." });
      }
    }

    const nullableProfileFields = [
      "classId", "phoneNumber", "address",
      "parentName", "parentRelation", "parentPhone", "parentEmail", "parentAddress",
    ];
    for (const field of nullableProfileFields) {
      if (typeof filteredBody[field] === "string") {
        const value = filteredBody[field].trim();
        filteredBody[field] = value || null;
      }
    }
    if (filteredBody.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(filteredBody.parentEmail)) {
      return res.status(400).json({ message: "Geçerli bir veli e-posta adresi giriniz." });
    }
    const mergedParentContact = { ...targetUser, ...filteredBody } as any;
    if (!validParentContact(mergedParentContact)) return res.status(400).json({ message: "Veli iletişim kaydı girilecekse ad, yakınlık, telefon, e-posta ve adres eksiksiz olmalıdır." });
    if ((filteredBody.role || targetUser.role) === 'parent' && (typeof mergedParentContact.phoneNumber !== 'string' || mergedParentContact.phoneNumber.trim().length < 7 || typeof mergedParentContact.address !== 'string' || mergedParentContact.address.trim().length < 5)) {
      return res.status(400).json({ message: "Veli hesabı için telefon ve adres zorunludur." });
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
    if (filteredBody.password || (filteredBody.role && filteredBody.role !== targetUser.role)) disconnectUserSockets(targetUserId);
    if (isUpdatingSelf && filteredBody.password) {
      await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
      req.session.userId = updatedUser.id;
      req.session.sessionVersion = updatedUser.sessionVersion ?? 0;
    }
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("[PATCH /api/users/:id] Error:", error);
    if ((error as any)?.code === "P2002") return res.status(409).json({ message: "Bu e-posta adresi zaten kullanılıyor." });
    res.status(500).json({ message: "Kullanıcı güncellenemedi." });
  }
});
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const target = await storage.getUser(req.params.id);
    if (!target) return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    if (target.role === "student") {
      await storage.deactivateStudent(target.id);
      await storage.createLog(req.user!.id, "DEACTIVATE_STUDENT", `Öğrenci pasife alındı: ${target.id}`);
      return res.json({ message: "Öğrenci pasife alındı; sınıf ve sınav geçmişi korundu." });
    }
    await storage.deleteUser(target.id);
    res.json({ message: "Kullanıcı silindi." });
  } catch (error) {
    res.status(500).json({ message: "Kullanıcı silinemedi." });
  }
});

router.patch("/:id/role", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  const { role } = req.body;
  if (!['admin', 'teacher', 'student', 'parent'].includes(role)) {
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
