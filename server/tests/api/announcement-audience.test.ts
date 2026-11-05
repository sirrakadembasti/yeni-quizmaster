import { describe, expect, it, vi } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import announcementRouter from "../../api-routes/announcement";

vi.mock("../../storage", () => ({ storage: {
  getUser: vi.fn(async () => ({ id: "student-1", role: "student", classId: "class-a", isActive: true, sessionVersion: 0 })),
  getAllAnnouncements: vi.fn(async () => [
    { id: "parent-class", createdBy: "admin-1", targetRole: "parent", targetClassId: "class-a" },
    { id: "student-class", createdBy: "teacher-1", targetRole: "student", targetClassId: "class-a" },
    { id: "all-class", createdBy: "admin-1", targetRole: "all", targetClassId: "class-a" },
    { id: "foreign-class", createdBy: "teacher-1", targetRole: "student", targetClassId: "class-b" },
    { id: "all-school", createdBy: "admin-1", targetRole: "all", targetClassId: null },
  ]),
} }));

describe("student announcement audience boundary", () => {
  it("does not expose a same-class parent notice while preserving student and all audiences", async () => {
    const app = express();
    app.use(session({ secret: "isolated-unit-session", resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => { req.session.userId = "student-1"; next(); });
    app.use("/announcements", announcementRouter);
    const response = await request(app).get("/announcements");
    expect(response.status).toBe(200);
    expect(response.body.announcements.map((notice: any) => notice.id)).toEqual(["student-class", "all-class", "all-school"]);
  });
});
