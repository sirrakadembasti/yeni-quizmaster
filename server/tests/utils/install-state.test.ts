import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createInstallState,
  firstUnfinishedStep,
  readInstallState,
  recordStep,
  writeInstallState,
} from "../../setup-wizard/install-state";

const ORDER = ["prepare", "migrate", "admin", "finish"] as const;

describe("kurulum durum dosyası", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "quizmaster-install-state-"));
    file = path.join(dir, "installation.state.json");
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("tüm adımları 'pending' başlatır ve diske yazar", () => {
    const state = createInstallState(ORDER);
    writeInstallState(file, state);
    const read = readInstallState(file);
    expect(read?.version).toBe(1);
    expect(Object.keys(read!.steps)).toEqual([...ORDER]);
    expect(Object.values(read!.steps).every((s) => s.status === "pending")).toBe(true);
    expect(read!.lastError).toBeNull();
  });

  it("adım geçişlerini ve son hatayı kaydeder; geçici dosya bırakmaz", () => {
    const state = createInstallState(ORDER);
    recordStep(file, state, "prepare", "done");
    recordStep(file, state, "migrate", "error", "migration başarısız");
    const read = readInstallState(file)!;
    expect(read.steps.prepare.status).toBe("done");
    expect(read.steps.migrate).toMatchObject({ status: "error", detail: "migration başarısız" });
    expect(read.lastError).toBe("migration başarısız");
    expect(fs.readdirSync(dir)).toEqual(["installation.state.json"]);
  });

  it("devam edilecek ilk bitmemiş adımı bulur; 'skipped' tamamlanmış sayılır", () => {
    const state = createInstallState(ORDER);
    recordStep(file, state, "prepare", "done");
    recordStep(file, state, "migrate", "skipped");
    recordStep(file, state, "admin", "error", "hata");
    expect(firstUnfinishedStep(state, ORDER)).toBe("admin");
    recordStep(file, state, "admin", "done");
    recordStep(file, state, "finish", "done");
    expect(firstUnfinishedStep(state, ORDER)).toBeNull();
  });

  it("bozuk veya uyumsuz dosyada null döner", () => {
    fs.writeFileSync(file, "{bozuk");
    expect(readInstallState(file)).toBeNull();
    fs.writeFileSync(file, JSON.stringify({ version: 2, steps: {} }));
    expect(readInstallState(file)).toBeNull();
    expect(readInstallState(path.join(dir, "yok.json"))).toBeNull();
  });
});
