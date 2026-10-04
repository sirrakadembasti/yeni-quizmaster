import { Router, type Express } from "express";
import type { Server } from "http";
import authRouter from "./auth";
import userRouter from "./user";
import quizRouter from "./quiz";
import resultRouter from "./result";
import classRouter from "./class";
import categoryRouter from "./category";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import adminRouter from "./admin";
import uploadRouter from "./upload";
import parentRouter from "./parent";
import questionBankRouter from "./question-bank";
import notificationRouter from "./notification";
import announcementRouter from "./announcement";
import studentRouter from "./student";
import analyticsRouter from "./analytics";
import surveyRouter from "./survey";
import deploymentRouter from "./deployment";
import { createAcademicHistoryRouter } from "./academic-history";

export async function registerRoutes(_httpServer: Server, app: Express) {
  const router: Router = Router();

  router.use("/auth", authRouter);
  router.use("/users", userRouter);
  router.use("/quizzes", quizRouter);
  router.use("/results", resultRouter);
  router.use("/classes", classRouter);
  router.use("/categories", categoryRouter);
  router.use("/dashboard", dashboardRouter);
  router.use("/ai", aiRouter);
  router.use("/admin/academic-history", createAcademicHistoryRouter());
  router.use("/admin", adminRouter);
  router.use("/upload", uploadRouter);
  router.use("/parents", parentRouter);
  router.use("/question-bank", questionBankRouter);
  router.use("/notifications", notificationRouter);
  router.use("/announcements", announcementRouter);
  router.use("/student", studentRouter);
  router.use("/analytics", analyticsRouter);
  router.use("/surveys", surveyRouter);
  router.use("/admin/deployment", deploymentRouter);

  // Register the router with /api prefix
  app.use("/api", router);
}
