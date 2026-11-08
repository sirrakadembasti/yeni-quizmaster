import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discardStagedDatabase, needsStaging, planStagedDatabase, promoteStagedDatabase } from "../../setup-wizard/db-staging";

describe("kurulum geçici veritabanı", () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "quizmaster-db-staging-")); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("yolları ve Prisma URL'sini üretir", () => {
    const plan = planStagedDatabase(dir);
    expect(plan.finalPath).toBe(path.join(dir, "quiz.db"));
    expect(plan.stagingPath).toBe(path.join(dir, "quiz.db.setup-tmp"));
    expect(plan.stagingUrl).toBe("file:../data/quiz.db.setup-tmp");
  });

  it("yalnız hedef veritabanı yokken hazırlama ister", () => {
    const plan = planStagedDatabase(dir);
    expect(needsStaging(plan)).toBe(true);
    fs.writeFileSync(plan.finalPath, "gercek");
    expect(needsStaging(plan)).toBe(false);
  });

  it("geçici dosyayı (ve -wal/-shm yan dosyalarını) yerine taşır", () => {
    const plan = planStagedDatabase(dir);
    fs.writeFileSync(plan.stagingPath, "veri");
    fs.writeFileSync(`${plan.stagingPath}-wal`, "wal");
    promoteStagedDatabase(plan);
    expect(fs.readFileSync(plan.finalPath, "utf8")).toBe("veri");
    expect(fs.readFileSync(`${plan.finalPath}-wal`, "utf8")).toBe("wal");
    expect(fs.existsSync(plan.stagingPath)).toBe(false);
  });

  it("hedef doluysa mevcut veritabanını ezmez", () => {
    const plan = planStagedDatabase(dir);
    fs.writeFileSync(plan.finalPath, "gercek");
    fs.writeFileSync(plan.stagingPath, "gecici");
    expect(() => promoteStagedDatabase(plan)).toThrow(/üzerine yazılmadı/);
    expect(fs.readFileSync(plan.finalPath, "utf8")).toBe("gercek");
  });

  it("hazırlanan dosya yoksa net hata verir", () => {
    expect(() => promoteStagedDatabase(planStagedDatabase(dir))).toThrow(/bulunamadı/);
  });

  it("temizlik yalnız geçici dosyaları siler, gerçek veritabanına dokunmaz", () => {
    const plan = planStagedDatabase(dir);
    fs.writeFileSync(plan.finalPath, "gercek");
    fs.writeFileSync(plan.stagingPath, "gecici");
    fs.writeFileSync(`${plan.stagingPath}-journal`, "j");
    discardStagedDatabase(plan);
    expect(fs.readdirSync(dir)).toEqual(["quiz.db"]);
  });
});
