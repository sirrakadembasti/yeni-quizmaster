import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

const router: Router = Router();

// ==================== SCHEMAS ====================

const categorySchema = z.object({
  name: z.string().min(2, "Ders adı en az 2 karakter olmalıdır.").max(50),
  description: z.string().max(200).optional().nullable(),
});

// ==================== CATEGORY ROUTES ====================

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    let categories;
    if (req.user!.role === "admin") {
      categories = await storage.getAllCategories();
    } else if (req.user!.role === "teacher") {
      // Teachers only see categories assigned to them or their classes
      const teacher = await storage.getUser(req.user!.id);
      const teacherClasses = await storage.getClassesByTeacher(req.user!.id);
      
      const assignedCategoryIds = new Set((teacher as any).assignedCategories?.map((c: any) => c.id) || []);
      teacherClasses.forEach(cls => {
        (cls as any).assignedCategories?.forEach((c: any) => assignedCategoryIds.add(c.id));
      });

      const allCategories = await storage.getAllCategories();
      categories = allCategories.filter(c => assignedCategoryIds.has(c.id));
    } else {
      // Students see categories for their class
      if (req.user!.classId) {
        const cls = await storage.getClass(req.user!.classId);
        categories = (cls as any)?.assignedCategories || [];
      } else {
        categories = [];
      }
    }
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

router.post("/", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = categorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }
    const category = await storage.createCategory(validation.data);
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: "Failed to create category" });
  }
});

router.put("/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    const validation = categorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: fromZodError(validation.error).message });
    }
    const updated = await storage.updateCategory(req.params.id, validation.data);
    if (!updated) return res.status(404).json({ message: "Category not found" });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update category" });
  }
});

router.delete("/:id", requireAuth, requireRole(["admin"]), async (req: AuthRequest, res: Response) => {
  try {
    await storage.deleteCategory(req.params.id);
    res.json({ message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete category" });
  }
});

export default router;
