import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildServerEnv, setupPayloadSchema } from "../../setup-wizard/config";
import { createSetupApp } from "../../setup-wizard/server";

const payload = {
  deployment: {
    mode: "subdomain" as const,
    publicUrl: "https://sinav.kurum.test",
    basePath: "/",
    allowedOrigins: ["https://sinav.kurum.test"],
    trustProxyHops: 1,
    retention: { enabled: false, actionLogDays: 365, readNotificationDays: 180, emailLogDays: 90, passwordResetDays: 90 },
  },
  server: { host: "127.0.0.1" as const, port: 5000 },
  admin: { name: "Sistem Yöneticisi", email: "admin@kurum.test", password: "GucluParola2026" },
  email: { enabled: false as const },
  buildClient: false,
  overwriteExistingEnv: false,
};

describe("setup wizard configuration", () => {
  it("creates a production env without persisting the admin password", () => {
    const parsed = setupPayloadSchema.parse(payload);
    const env = buildServerEnv(parsed, "fixed-session-secret");
    expect(env).toContain('SESSION_SECRET="fixed-session-secret"');
    expect(env).toContain("ALLOW_RUNTIME_DEPLOYMENT_CHANGES=false");
    expect(env).not.toContain(payload.admin.password);
    expect(env).not.toContain(payload.admin.email);
  });

  it("rejects weak passwords and non-Gmail mailboxes", () => {
    expect(() => setupPayloadSchema.parse({ ...payload, admin: { ...payload.admin, password: "password123456" } })).toThrow();
    expect(() => setupPayloadSchema.parse({ ...payload, email: { enabled: true, user: "mail@kurum.test", password: "abcdefghijklmnop", fromEmail: "mail@kurum.test", fromName: "QuizMaster" } })).toThrow();
  });

  it("accepts a local demo profile with localhost mode", () => {
    const parsed = setupPayloadSchema.parse({
      ...payload,
      deployment: {
        ...payload.deployment,
        mode: "localhost",
        publicUrl: "http://localhost:5000",
        basePath: "/",
        allowedOrigins: ["http://localhost:5000", "http://127.0.0.1:5000"],
        trustProxyHops: 0,
      },
    });
    expect(parsed.deployment.mode).toBe("localhost");
  });
});

describe("setup wizard HTTP isolation", () => {
  const token = "12345678901234567890123456789012";
  const app = createSetupApp(token);

  it("does not expose the page without the one-time token", async () => {
    await request(app).get("/setup").expect(401);
  });

  it("exchanges the URL token for an HttpOnly strict cookie", async () => {
    const response = await request(app).get(`/setup?token=${token}`).expect(303);
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("SameSite=Strict");
    expect(response.headers.location).toBe("/setup");
  });

  it("rejects state changes without cookie and CSRF proof", async () => {
    await request(app).post("/api/apply").send(payload).expect(401);
  });
});
