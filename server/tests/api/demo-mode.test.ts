import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";

const mockStorage = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  createLog: vi.fn(),
  getAllUsers: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: mockStorage,
}));

vi.mock("../../socket", () => ({
  getIO: () => ({ to: () => ({ emit: vi.fn() }) }),
  disconnectUserSockets: vi.fn(),
  disconnectSessionSockets: vi.fn(),
}));

import authRoutes from "../../api-routes/auth";
import { createDemoModeGuard, demoRequestPolicy } from "../../middleware/demo-guard";
import {
  DEMO_READ_ONLY_CODE,
  DEMO_READ_ONLY_MESSAGE,
  DEMO_SHOWCASE_ACCOUNTS,
} from "../../utils/demo-mode";
import { renderIndexHtmlForBasePath } from "../../static";

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "demo-test-secret",
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use(createDemoModeGuard());
  app.use("/api/auth", authRoutes);
  app.get("/api/quizzes", (_req, res) => res.json({ items: ["quiz-1"] }));
  app.post("/api/quizzes", (_req, res) => res.status(201).json({ created: true }));
  app.delete("/api/quizzes/:id", (_req, res) => res.json({ deleted: true }));
  return app;
}

describe("Demo Mode & Showcase Accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APP_DEMO_MODE;
    delete process.env.APP_BASE_PATH;
  });

  it("enforces demoRequestPolicy for read vs write routes", () => {
    expect(demoRequestPolicy("GET", "/api/quizzes")).toBeNull();
    expect(demoRequestPolicy("HEAD", "/api/users")).toBeNull();
    expect(demoRequestPolicy("POST", "/api/auth/login")).toBeNull();
    expect(demoRequestPolicy("POST", "/api/auth/demo-login")).toBeNull();
    expect(demoRequestPolicy("POST", "/api/auth/logout")).toBeNull();
    expect(demoRequestPolicy("POST", "/api/admin/academic-history/context")).toBeNull();

    expect(demoRequestPolicy("POST", "/api/quizzes")).toBe(403);
    expect(demoRequestPolicy("PUT", "/api/users/u-1")).toBe(403);
    expect(demoRequestPolicy("PATCH", "/api/auth/me")).toBe(403);
    expect(demoRequestPolicy("DELETE", "/api/quizzes/q-1")).toBe(403);
  });

  it("returns the 4 ready showcase accounts from GET /api/auth/demo-info", async () => {
    process.env.APP_DEMO_MODE = "true";
    process.env.APP_BASE_PATH = "/demo";
    const app = buildTestApp();

    const response = await request(app).get("/api/auth/demo-info");
    expect(response.status).toBe(200);
    expect(response.body.enabled).toBe(true);
    expect(response.body.basePath).toBe("/demo");
    expect(response.body.readOnlyMessage).toBe(DEMO_READ_ONLY_MESSAGE);
    expect(response.body.accounts).toHaveLength(4);
    expect(response.body.accounts.map((a: any) => a.key)).toEqual([
      "demo-admin",
      "demo-ogretmen",
      "demo-ogrenci",
      "demo-veli",
    ]);
  });

  it("logs in via POST /api/auth/demo-login and blocks mutations for demo showcase users while allowing reads", async () => {
    const app = buildTestApp();
    const agent = request.agent(app);

    const demoTeacherMeta = DEMO_SHOWCASE_ACCOUNTS.find((a) => a.key === "demo-ogretmen")!;
    mockStorage.getUserByEmail.mockResolvedValue({
      id: "demo-teacher-id",
      name: demoTeacherMeta.name,
      email: demoTeacherMeta.email,
      password: "hashed-password",
      role: "teacher",
      isActive: true,
      sessionVersion: 0,
    });
    mockStorage.getUser.mockResolvedValue({
      id: "demo-teacher-id",
      name: demoTeacherMeta.name,
      email: demoTeacherMeta.email,
      role: "teacher",
      isActive: true,
      sessionVersion: 0,
    });

    const loginRes = await agent
      .post("/api/auth/demo-login")
      .send({ roleKey: "demo-ogretmen" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user).toMatchObject({
      id: "demo-teacher-id",
      email: "demo-ogretmen@quizmaster.com",
      role: "teacher",
      isDemoUser: true,
    });

    // GET request is allowed
    const readRes = await agent.get("/api/quizzes");
    expect(readRes.status).toBe(200);
    expect(readRes.body).toEqual({ items: ["quiz-1"] });

    // POST / DELETE mutations are blocked with 403 DEMO_MODE_READ_ONLY
    const createRes = await agent.post("/api/quizzes").send({ title: "Yeni Sınav" });
    expect(createRes.status).toBe(403);
    expect(createRes.body).toEqual({
      code: DEMO_READ_ONLY_CODE,
      message: DEMO_READ_ONLY_MESSAGE,
    });

    const deleteRes = await agent.delete("/api/quizzes/q-1");
    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body).toEqual({
      code: DEMO_READ_ONLY_CODE,
      message: DEMO_READ_ONLY_MESSAGE,
    });
  });

  it("rewrites index.html asset paths and injects runtime globals for /demo subpath", () => {
    const sampleHtml = `<!doctype html><html><head><link rel="stylesheet" href="/assets/index.css"></head><body><script type="module" src="/assets/index.js"></script></body></html>`;
    const rendered = renderIndexHtmlForBasePath(sampleHtml, "/demo", true);

    expect(rendered).toContain('window.__APP_BASE_PATH__="/demo"');
    expect(rendered).toContain("window.__APP_DEMO_MODE__=true");
    expect(rendered).toContain('href="/demo/assets/index.css"');
    expect(rendered).toContain('src="/demo/assets/index.js"');
  });
});
