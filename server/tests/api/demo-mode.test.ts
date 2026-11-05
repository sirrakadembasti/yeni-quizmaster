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
  DEMO_SHOWCASE_PASSWORD,
  DEMO_READ_ONLY_CODE,
  DEMO_READ_ONLY_MESSAGE,
  DEMO_SHOWCASE_ACCOUNTS,
} from "../../utils/demo-mode";
import { secureJsonReplacer } from "../../utils/json-security";
import { renderIndexHtmlForBasePath } from "../../static";

function buildTestApp() {
  const app = express();
  app.set("json replacer", secureJsonReplacer);
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
    for (const account of response.body.accounts) {
      expect(account.demoPassword).toBe(DEMO_SHOWCASE_PASSWORD);
    }
  });

  it("blocks user registration, password reset, and non-demo logins when accessed from /demo context", async () => {
    const app = buildTestApp();

    // 1. Registration blocked via x-quizmaster-demo header
    const registerRes = await request(app)
      .post("/api/auth/register")
      .set("x-quizmaster-demo", "1")
      .send({
        name: "Yeni Kullanıcı",
        email: "yeni@example.com",
        password: "Password123!",
      });
    expect(registerRes.status).toBe(403);
    expect(registerRes.body).toEqual({
      code: DEMO_READ_ONLY_CODE,
      message: DEMO_READ_ONLY_MESSAGE,
    });
    expect(mockStorage.createUser).not.toHaveBeenCalled();

    // 2. Forgot-password blocked via Referer: /demo
    const forgotRes = await request(app)
      .post("/api/auth/forgot-password")
      .set("Referer", "http://127.0.0.1:5173/demo")
      .send({ email: "yeni@example.com" });
    expect(forgotRes.status).toBe(403);
    expect(forgotRes.body.code).toBe(DEMO_READ_ONLY_CODE);

    // 3. Non-demo email login blocked in /demo context
    const nonDemoLoginRes = await request(app)
      .post("/api/auth/login")
      .set("x-quizmaster-demo", "1")
      .send({ email: "normal-user@example.com", password: "Password123!" });
    expect(nonDemoLoginRes.status).toBe(403);
    expect(nonDemoLoginRes.body.code).toBe(DEMO_READ_ONLY_CODE);
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
