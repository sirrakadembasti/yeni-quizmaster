import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CLEAN_INSTALL_CONFIRMATION,
  getSetupPaths,
  inspectInstallationState,
  readConfiguredPort,
  resetInstallation,
  validateRuntime,
} from "./setup-bootstrap-lib.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quizmaster-bootstrap-"));
  const paths = getSetupPaths(root);
  fs.mkdirSync(paths.dataRoot, { recursive: true });
  fs.mkdirSync(paths.uploadsRoot, { recursive: true });
  fs.mkdirSync(paths.backupsRoot, { recursive: true });
  fs.writeFileSync(path.join(paths.dataRoot, "README.md"), "korunacak\n", "utf8");
  fs.writeFileSync(path.join(paths.uploadsRoot, ".gitkeep"), "", "utf8");
  return { root, paths, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("yalnız Node.js 22/24 ve pnpm 9.15.1 kabul edilir", () => {
  assert.equal(validateRuntime("v22.23.0", "9.15.1").nodeSupported, true);
  assert.equal(validateRuntime("24.21.0", "9.15.1").pnpmSupported, true);
  assert.equal(validateRuntime("20.20.0", "9.15.1").nodeSupported, false);
  assert.equal(validateRuntime("24.21.0", "11.19.0").pnpmSupported, false);
});

test("boş dizin yeni kurulum olarak algılanır", (t) => {
  const item = fixture();
  t.after(item.cleanup);
  const state = inspectInstallationState(item.root);
  assert.equal(state.state, "fresh");
  assert.equal(state.evidence.installationLock, false);
});

test("env veya veritabanı varsa yarım kurulum algılanır", (t) => {
  const item = fixture();
  t.after(item.cleanup);
  fs.writeFileSync(item.paths.env, "PORT=5055\n", "utf8");
  fs.writeFileSync(item.paths.quizDb, "db-content", "utf8");
  assert.equal(inspectInstallationState(item.root).state, "partial");
  assert.equal(readConfiguredPort(item.root), 5055);
});

test("yanlış doğrulama metni hiçbir veriyi değiştirmez", (t) => {
  const item = fixture();
  t.after(item.cleanup);
  fs.writeFileSync(item.paths.quizDb, "important-data", "utf8");
  assert.throws(() => resetInstallation(item.root, {
    confirmation: "SİL",
    backupAcknowledged: true,
  }), /onay metni/);
  assert.equal(fs.readFileSync(item.paths.quizDb, "utf8"), "important-data");
});

test("harici veya özel veritabanı otomatik temizlenmez", (t) => {
  const item = fixture();
  t.after(item.cleanup);
  fs.writeFileSync(item.paths.env, "DATABASE_URL=postgresql://db.example/quizmaster\n", "utf8");
  assert.throws(() => resetInstallation(item.root, {
    confirmation: CLEAN_INSTALL_CONFIRMATION,
    backupAcknowledged: true,
  }), /yalnız standart yerel SQLite/);
  assert.equal(fs.existsSync(item.paths.env), true);
  assert.equal(fs.readdirSync(item.paths.backupsRoot).length, 0);
});

test("temiz kurulum önce doğrulanmış yedek alır ve yalnız çalışma verilerini temizler", (t) => {
  const item = fixture();
  t.after(item.cleanup);
  fs.mkdirSync(item.paths.setupArtifacts, { recursive: true });
  fs.writeFileSync(item.paths.env, "SESSION_SECRET=secret\nPORT=5000\n", "utf8");
  fs.writeFileSync(item.paths.quizDb, "quiz-data", "utf8");
  fs.writeFileSync(item.paths.sessionsDb, "session-data", "utf8");
  fs.writeFileSync(item.paths.lock, "{}\n", "utf8");
  fs.writeFileSync(item.paths.deploymentConfig, "{}\n", "utf8");
  fs.writeFileSync(path.join(item.paths.setupArtifacts, "nginx.conf.example"), "proxy", "utf8");
  fs.writeFileSync(path.join(item.paths.uploadsRoot, "question.png"), "image", "utf8");

  const result = resetInstallation(item.root, {
    confirmation: CLEAN_INSTALL_CONFIRMATION,
    backupAcknowledged: true,
  });

  assert.equal(fs.existsSync(path.join(result.backupRoot, "manifest.json")), true);
  const manifest = JSON.parse(fs.readFileSync(path.join(result.backupRoot, "manifest.json"), "utf8"));
  assert.ok(manifest.files.some((entry) => entry.source === "server/data/quiz.db" && entry.sha256));
  assert.ok(manifest.files.some((entry) => entry.source === "server/.env" && entry.sha256));
  assert.equal(fs.existsSync(item.paths.quizDb), false);
  assert.equal(fs.existsSync(item.paths.env), false);
  assert.equal(fs.existsSync(item.paths.lock), false);
  assert.equal(fs.existsSync(path.join(item.paths.uploadsRoot, "question.png")), false);
  assert.equal(fs.existsSync(path.join(item.paths.uploadsRoot, ".gitkeep")), true);
  assert.equal(fs.existsSync(path.join(item.paths.dataRoot, "README.md")), true);
  assert.equal(result.state.state, "fresh");
});
