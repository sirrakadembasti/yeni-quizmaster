import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { logger } from "../utils/logger";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { hashResetToken, issuePasswordReset } from "../services/password-reset";
import { getIO } from "../socket";

const router: Router = Router();

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// ==================== AUTH SCHEMAS ====================

const registerSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır.").max(50),
  email: z.string().email("Geçerli bir e-posta adresi giriniz."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır."),
});

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz."),
  password: z.string().min(1, "Şifre gereklidir."),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifre gereklidir."),
  newPassword: z.string().min(6, "Yeni şifre en az 6 karakter olmalıdır."),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi giriniz."),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token gereklidir."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır."),
});

// ==================== AUTH ROUTES ====================

router.post("/register", async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: validation.error.errors[0].message });
    }

    const { name, password, email } = validation.data;
    const existingUser = await storage.getUserByEmail(email.trim());
    if (existingUser) return res.status(400).json({ message: "Bu e-posta adresi zaten kayıtlı." });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    await regenerateSession(req);
    const user = await storage.createUser({ 
      name, 
      email: email.trim(), 
      password: hashedPassword, 
      role: 'student'
    });
    
    req.session.userId = user.id;
    await storage.createLog(user.id, "REGISTER", `User registered as student`);
    try {
      const admins = (await storage.getAllUsers()).filter((candidate) => candidate.role === "admin");
      const notifications = await Promise.all(admins.map((admin) => storage.createNotification({
        userId: admin.id,
        title: "Yeni Üye Kaydı",
        message: `${user.name} (${user.email}) öğrenci hesabı ile kayıt oldu.`,
        type: "registration",
      })));
      try {
        const io = getIO();
        admins.forEach((admin, index) => io.to(`user_${admin.id}`).emit("notification", notifications[index]));
      } catch (socketError) {
        logger.warn({ err: socketError }, "[Auth] Kayıt bildirimi saklandı; anlık bağlantı kullanılamadı.");
      }
    } catch (notificationError) {
      logger.error({ err: notificationError }, "[Auth] Yeni kayıt admin bildirimi oluşturulamadı.");
    }
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Kayıt işlemi başarısız oldu." });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const { email, password } = validation.data;
    const user = await storage.getUserByEmail(email.trim());
    if (!user || (user as any).isActive === false) {
      return res.status(401).json({ message: "Geçersiz e-posta veya şifre." });
    }
    
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Geçersiz e-posta veya şifre." });
    }
    
    await regenerateSession(req);
    req.session.userId = user.id;
    await storage.createLog(user.id, "LOGIN", `User logged in`);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Giriş işlemi başarısız oldu." });
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest, res: Response) => {
  await storage.createLog(req.user!.id, "LOGOUT", `User logged out`);
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ message: "Oturum kapatılamadı." });
    }

    res.clearCookie("quizmaster.sid", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    res.json({ message: "Oturum kapatıldı." });
  });
});

router.get("/me", requireAuth, (req: AuthRequest, res: Response) => {
  const { password, ...userWithoutPassword } = req.user!;
  res.json({ user: userWithoutPassword });
});

router.patch("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role === "student") {
      return res.status(403).json({ message: "Öğrenci profil bilgileri yalnızca okul yönetimi tarafından güncellenebilir." });
    }
    const profileSchema = z.object({
      name: z.string().trim().min(2).max(100).optional(),
      email: z.string().trim().email().optional(),
      phoneNumber: z.string().trim().max(30).optional(),
      address: z.string().trim().max(500).optional(),
    }).strict();
    const validation = profileSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ message: fromZodError(validation.error).message });
    const { name, email, phoneNumber, address } = validation.data;
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null;
    if (address !== undefined) updateData.address = address || null;

    if (email) {
      const trimmedEmail = email.trim();
      // E-posta değiştiriliyorsa başka bir kullanıcıda olup olmadığını kontrol et
      if (trimmedEmail !== req.user!.email) {
        const existingUser = await storage.getUserByEmail(trimmedEmail);
        if (existingUser && existingUser.id !== req.user!.id) {
          return res.status(400).json({ message: "Bu e-posta adresi başka bir hesap tarafından kullanılıyor." });
        }
      }
      updateData.email = trimmedEmail;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "Güncellenecek veri bulunamadı." });
    }

    const updatedUser = await storage.updateUser(req.user!.id, updateData);
    const { password, ...userWithoutPassword } = updatedUser;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Profil güncellenemedi." });
  }
});

router.post("/change-password", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const { currentPassword, newPassword } = validation.data;
    
    // Fetch the full user to get their current hashed password
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Mevcut şifreniz yanlış." });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the password
    await storage.updateUser(user.id, { password: hashedNewPassword });
    await storage.createLog(user.id, "PASSWORD_CHANGE", "User changed their password");
    
    res.json({ message: "Şifreniz başarıyla güncellendi." });
  } catch (error) {
    res.status(500).json({ message: "Şifre güncellenirken bir hata oluştu." });
  }
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const validation = forgotPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const { email } = validation.data;
    const user = await storage.getUserByEmail(email.trim());

    if (!user) {
      // For security, don't reveal that the user doesn't exist
      return res.json({ message: "E-posta başarıyla gönderildi." });
    }

    try {
      await issuePasswordReset(user, { requestedBy: "self", requestIp: req.ip });
    } catch (emailErr) {
      logger.warn({ err: emailErr, userId: user.id }, "[Auth] Şifre sıfırlama e-postası Gmail kuyruğuna alınamadı.");
    }

    await storage.createLog(user.id, "FORGOT_PASSWORD", "Password reset requested");

    res.json({ message: "E-posta başarıyla gönderildi." });
  } catch (error) {
    logger.error({ err: error }, "[Auth] forgot-password işlemi sırasında beklenmedik hata.");
    res.status(500).json({ message: "İşlem sırasında bir hata oluştu." });
  }
});

router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const { token, password } = validation.data;
    const tokenHash = hashResetToken(token);
    const resetRequest = await storage.getPasswordResetRequestByToken(tokenHash);
    const user = resetRequest?.user || await storage.getUserByResetToken(tokenHash);
    const expiry = resetRequest?.expiresAt || user?.resetTokenExpiry;

    if (!user || !expiry || expiry < new Date() || (resetRequest && resetRequest.status !== "pending")) {
      if (resetRequest?.status === "pending" && expiry && expiry < new Date()) {
        await storage.updatePasswordResetRequest(resetRequest.id, { status: "expired" });
      }
      return res.status(400).json({ message: "Geçersiz veya süresi dolmuş token." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await storage.updateUser(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });
    if (resetRequest) await storage.updatePasswordResetRequest(resetRequest.id, { status: "completed", completedAt: new Date() });

    await storage.createLog(user.id, "RESET_PASSWORD", "Password reset successfully");

    res.json({ message: "Şifreniz başarıyla sıfırlandı." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "İşlem sırasında bir hata oluştu." });
  }
});

export default router;
