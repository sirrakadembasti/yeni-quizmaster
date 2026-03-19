import type { Express } from "express";
import { type Server } from "http";

// Import modular routes
import authRoutes from "./auth";
import adminRoutes from "./admin";
import userRoutes from "./user";
import quizRoutes from "./quiz";
import categoryRoutes from "./category";
import classRoutes from "./class";
import studentRoutes from "./student";
import aiRoutes from "./ai";
import uploadRoutes from "./upload";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register modular routes
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/quizzes", quizRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/classes", classRoutes);
  app.use("/api/student", studentRoutes); // This covers student quizzes and results
  app.use("/api/ai", aiRoutes);
  app.use("/api/upload", uploadRoutes);
  
  // Special results endpoint used by teachers/admins (originally /api/results)
  // These are handled within student.ts now, but we can add an alias if needed
  // Based on api.ts: resultApi uses /api/results/quiz/:quizId
  app.use("/api/results", studentRoutes); 
  
  // Dashboard routes
  app.use("/api/dashboard", dashboardRoutes);
  // Teacher dashboard alias
  app.use("/api/teacher/dashboard", dashboardRoutes);

  return httpServer;
}

import dashboardRoutes from "./dashboard";
