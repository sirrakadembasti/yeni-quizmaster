import { Router, type Response } from "express";
import { storage } from "../storage";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();

// ==================== USER MANAGEMENT ====================

router.get("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  const users = await storage.getAllUsers();
  const filtered = req.user!.role === 'teacher' ? users.filter(u => u.role === 'student') : users;
  res.json({ users: filtered.map(({ password, ...u }) => u) });
});

router.post("/", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, classNo, classId } = req.body;
    if (req.user!.role === 'teacher' && role !== 'student') {
      return res.status(403).json({ message: "Teachers can only create students" });
    }
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) return res.status(400).json({ message: "Email already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ 
      name, email, password: hashedPassword, role: role || 'student', classNo, classId 
    });
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: "Failed to create user" });
  }
});

router.patch("/:id", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }
    const updatedUser = await storage.updateUser(req.params.id, req.body);
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user" });
  }
});

router.delete("/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.deleteUser(req.params.id);
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

router.patch("/:id/role", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  const { role } = req.body;
  if (!['admin', 'teacher', 'student'].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }
  await storage.updateUserRole(req.params.id, role);
  res.json({ message: "Role updated" });
});

export default router;
