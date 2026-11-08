import { describe, expect, it } from "vitest";
import { buildLocalPayload, generateAdminPassword, parseArgs } from "../../setup-wizard/cli";

describe("kurulum CLI argümanları", () => {
  it("varsayılan olarak yerel moddadır ve --yes'i tanır", () => {
    expect(parseArgs(["--yes"])).toMatchObject({ yes: true, mode: "local", help: false });
    expect(parseArgs(["--", "-y", "--config", "a.json"])).toMatchObject({ yes: true, config: "a.json" });
  });

  it("geçersiz seçenekleri ve eksik değerleri reddeder", () => {
    expect(() => parseArgs(["--bilinmeyen"])).toThrow(/Bilinmeyen/);
    expect(() => parseArgs(["--mode", "x"])).toThrow(/--mode/);
    expect(() => parseArgs(["--config"])).toThrow(/--config/);
  });
});

describe("yerel kurulum yükü", () => {
  it("üretilen parola şema kurallarını sağlar ve her seferinde farklıdır", () => {
    const first = generateAdminPassword();
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/\d/);
    expect(first.length).toBeGreaterThanOrEqual(12);
    expect(generateAdminPassword()).not.toBe(first);
  });

  it("ortamdan parola verilirse yeni parola üretmez", () => {
    const result = buildLocalPayload({ QUIZMASTER_ADMIN_PASSWORD: "Ornek-Parola-2026x" });
    expect(result.generatedPassword).toBeNull();
    expect(result.payload.admin.password).toBe("Ornek-Parola-2026x");
    expect(result.payload.deployment.mode).toBe("localhost");
    expect(result.payload.buildClient).toBe(false);
  });

  it("parola yoksa üretir, port ve e-postayı ortamdan alır", () => {
    const result = buildLocalPayload({ QUIZMASTER_PORT: "5100", QUIZMASTER_ADMIN_EMAIL: "yonetici@okul.test" });
    expect(result.generatedPassword).toBeTruthy();
    expect(result.payload.server.port).toBe(5100);
    expect(result.payload.admin.email).toBe("yonetici@okul.test");
  });
});
