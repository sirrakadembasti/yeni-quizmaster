import { describe, expect, it } from "vitest";
import { buildDeploymentArtifacts, deploymentConfigSchema, normalizeBasePath } from "../../utils/deployment-config";

describe("deployment configuration", () => {
  it("alt yolu tek biçime getirir ve geçersiz karakterleri reddeder", () => {
    expect(normalizeBasePath("quizmaster/" )).toBe("/quizmaster");
    expect(normalizeBasePath("/")).toBe("/");
    expect(() => normalizeBasePath("/quiz master")).toThrow();
  });

  it("subpath profili için güvenli kurulum çıktıları üretir", () => {
    const config = deploymentConfigSchema.parse({
      mode: "subpath",
      publicUrl: "https://okul.example.gov.tr",
      basePath: "/quizmaster",
      allowedOrigins: ["https://okul.example.gov.tr"],
      trustProxyHops: 1,
      retention: {
        enabled: false,
        actionLogDays: 365,
        readNotificationDays: 180,
        emailLogDays: 90,
        passwordResetDays: 90,
      },
    });
    const artifacts = buildDeploymentArtifacts(config);
    expect(artifacts.envText).toContain("APP_BASE_PATH=/quizmaster");
    expect(artifacts.nginxText).toContain("location /quizmaster/");
    expect(artifacts.buildCommand).toContain("VITE_BASE_PATH");
    expect(artifacts.envText).not.toContain("actual-secret");
  });

  it("localhost profili yerel deneme için kabul edilir ve proxy gerekmediğini yazar", () => {
    const config = deploymentConfigSchema.parse({
      mode: "localhost",
      publicUrl: "http://localhost:5000",
      basePath: "/",
      allowedOrigins: ["http://localhost:5000", "http://127.0.0.1:5000"],
      trustProxyHops: 0,
      retention: {
        enabled: false,
        actionLogDays: 365,
        readNotificationDays: 180,
        emailLogDays: 90,
        passwordResetDays: 90,
      },
    });
    const artifacts = buildDeploymentArtifacts(config);
    expect(artifacts.nginxText).toContain("reverse proxy gerekmez");
    expect(artifacts.envText).toContain("TRUST_PROXY_HOPS=0");
  });

  it("localhost modunda / olmayan alt yol ve uzak adres reddedilir", () => {
    expect(() => deploymentConfigSchema.parse({
      mode: "localhost",
      publicUrl: "http://localhost:5000",
      basePath: "/quiz",
      allowedOrigins: ["http://localhost:5000"],
      trustProxyHops: 0,
      retention: { enabled: false, actionLogDays: 365, readNotificationDays: 180, emailLogDays: 90, passwordResetDays: 90 },
    })).toThrow();

    expect(() => deploymentConfigSchema.parse({
      mode: "localhost",
      publicUrl: "https://sinav.kurum.gov.tr",
      basePath: "/",
      allowedOrigins: ["https://sinav.kurum.gov.tr"],
      trustProxyHops: 0,
      retention: { enabled: false, actionLogDays: 365, readNotificationDays: 180, emailLogDays: 90, passwordResetDays: 90 },
    })).toThrow();
  });
});
