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
import notificationRoutes from "./notification";
import dashboardRoutes from "./dashboard";
import resultRoutes from "./result";
import questionBankRoutes from "./question-bank";
import { generateToken, csrfSynchronisedProtection } from "../middleware/csrf";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // CSRF Token endpoint
  app.get("/api/csrf-token", (req, res) => {
    const token = generateToken(req);
    // Explicitly save the session to avoid race conditions with express-session
    req.session.save((err) => {
      if (err) console.error("Session save error in csrf-token:", err);
      res.json({ token });
    });
  });

  // Apply CSRF protection to all mutating routes
  // It automatically ignores GET, HEAD, OPTIONS
  app.use(csrfSynchronisedProtection);

  // Register modular routes
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/quizzes", quizRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/classes", classRoutes);
  app.use("/api/student", studentRoutes); // This covers student quizzes and results
  app.use("/api/results", resultRoutes); 
  app.use("/api/ai", aiRoutes);
  app.use("/api/question-bank", questionBankRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/notifications", notificationRoutes);
  
  // Dashboard routes
  app.use("/api/dashboard", dashboardRoutes);
  // Teacher dashboard alias
  app.use("/api/teacher/dashboard", dashboardRoutes);

  return httpServer;
}

