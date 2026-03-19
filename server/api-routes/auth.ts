import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { sendResetPasswordEmail } from "../utils/email";

const router: Router = Router();

// ==================== AUTH SCHEMAS ====================

const registerSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır.").max(50),
  email: z.string().email("Geçerli bir e-posta adresi giriniz."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır."),
  classNo: z.string().optional(),
  classId: z.string().optional().nullable(),
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
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }

    const { name, password, email, classNo, classId } = validation.data;
    const existingUser = await storage.getUserByEmail(email.trim());
    if (existingUser) return res.status(400).json({ message: "Bu e-posta adresi zaten kayıtlı." });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ 
      name, 
      email: email.trim(), 
      password: hashedPassword, 
      role: 'student',
      classNo,
      classId: classId || undefined
    });
    
    req.session.userId = user.id;
    await storage.createLog(user.id, "REGISTER", `User registered as student`);
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
    if (!user) {
      return res.status(401).json({ message: "Geçersiz e-posta veya şifre." });
    }
    
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Geçersiz e-posta veya şifre." });
    }
    
    req.session.userId = user.id;
    await storage.createLog(user.id, "LOGIN", `User logged in`);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: "Giriş işlemi başarısız oldu." });
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest, res: Response) => {
  await storage.createLog(req.user!.id, "LOGOUT", `User logged out`);
  req.session.destroy(() => res.json({ message: "Oturum kapatıldı." }));
});

router.get("/me", requireAuth, (req: AuthRequest, res: Response) => {
  const { password, ...userWithoutPassword } = req.user!;
  res.json({ user: userWithoutPassword });
});

router.patch("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const updatedUser = await storage.updateUser(req.user!.id, req.body);
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

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await storage.updateUser(user.id, {
      resetToken: token,
      resetTokenExpiry: expiry,
    });

    await sendResetPasswordEmail(user.email, token);
    await storage.createLog(user.id, "FORGOT_PASSWORD", "Password reset requested");

    res.json({ message: "E-posta başarıyla gönderildi." });
  } catch (error) {
    console.error("Forgot password error:", error);
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
    const user = await storage.getUserByResetToken(token);

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ message: "Geçersiz veya süresi dolmuş token." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await storage.updateUser(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });

    await storage.createLog(user.id, "RESET_PASSWORD", "Password reset successfully");

    res.json({ message: "Şifreniz başarıyla sıfırlandı." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "İşlem sırasında bir hata oluştu." });
  }
});

export default router;
