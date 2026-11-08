import crypto, { timingSafeEqual } from "crypto";
import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { createServer, type Server } from "http";
import { fileURLToPath } from "url";
import express, { type Request } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { createRuntimePrismaClient } from "../utils/sqlite-runtime";
import { ZodError } from "zod";
import { getProjectRoot } from "../utils/project-paths";
import { buildDeploymentArtifacts, saveDeploymentConfig } from "../utils/deployment-config";
import { buildServerEnv, publicAppUrl, setupPayloadSchema, toDeploymentConfig, type SetupPayload } from "./config";
import { renderSetupPage } from "./ui";
import { deploySetupDatabase } from "./migration";
import { discardStagedDatabase, needsStaging, planStagedDatabase, promoteStagedDatabase } from "./db-staging";
import { STATE_FILE_NAME, createInstallState, recordStep, writeInstallState, type InstallState } from "./install-state";

const projectRoot = getProjectRoot();
const serverRoot = path.join(projectRoot, "server");
const dataRoot = path.join(serverRoot, "data");
const envPath = path.join(serverRoot, ".env");
const lockPath = path.join(dataRoot, "installation.lock");
const pendingPath = path.join(dataRoot, "installation.pending");
const statePath = path.join(dataRoot, STATE_FILE_NAME);
const artifactRoot = path.join(dataRoot, "setup-artifacts");

function digest(value: string) {
  return crypto.createHash("sha256").update(value).digest();
}

function equalSecret(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

function cookieValue(req: Request, name: string) {
  const part = (req.headers.cookie || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
}

function writable(target: string) {
  try {
    fs.mkdirSync(target, { recursive: true });
    fs.accessSync(target, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function sameOrigin(req: Request) {
  try {
    const origin = req.get("origin");
    if (!origin) return false;
    const parsed = new URL(origin);
    return parsed.host === req.get("host") && ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function fixedPnpm(args: string[], extraEnv: NodeJS.ProcessEnv) {
  const pnpmScript = process.env.npm_execpath;
  if (!pnpmScript) throw new Error("pnpm çalıştırma yolu bulunamadı. Sihirbazı yalnız `pnpm setup` ile başlatın.");
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [pnpmScript, ...args], {
      cwd: projectRoot,
      env: { ...process.env, ...extraEnv },
      shell: false,
      windowsHide: true,
    });
    let output = "";
    const collect = (chunk: Buffer) => { output = `${output}${chunk.toString("utf8")}`.slice(-20_000); };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output) : reject(new Error(`Sabit kurulum komutu başarısız oldu (${code}).\n${output}`)));
  });
}

async function createFirstAdmin(payload: SetupPayload, databaseUrl: string) {
  process.env.DATABASE_URL = databaseUrl;
  const prisma = createRuntimePrismaClient({ databaseUrl });
  try {
    const email = payload.admin.email.toLowerCase();
    const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true, email: true } });
    // Önceki deneme yönetici adımından sonra kesildiyse (kilit yok) aynı hesap yeniden oluşturulmaz;
    // parola da değiştirilmez. Başka bir yönetici varsa mevcut kurulum devralınamaz.
    if (existingAdmin?.email.toLowerCase() === email) return;
    if (existingAdmin) throw new Error("Veritabanında zaten bir yönetici var. Mevcut kurulum sihirbazla devralınamaz.");
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new Error("Yönetici e-postası veritabanında zaten kullanılıyor.");
    }
    await prisma.user.create({
      data: {
        name: payload.admin.name,
        email,
        password: await bcrypt.hash(payload.admin.password, 12),
        role: "admin",
        emailVerified: true,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

const APPLY_STEPS = [
  { id: "prepare", label: "Kurulum ortamı hazırlanıyor" },
  { id: "buildServer", label: "Sunucu derlemesi" },
  { id: "buildClient", label: "İstemci (web) derlemesi" },
  { id: "migrate", label: "Veritabanı migration'ları" },
  { id: "admin", label: "İlk yönetici hesabı" },
  { id: "artifacts", label: "Dağıtım profili ve Nginx örneği" },
  { id: "env", label: "Gizli ayarların yazılması (server/.env)" },
  { id: "finish", label: "Kurulum kilidi ve kapanış" },
] as const;

type ApplyStepState = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  detail?: string;
};

export type ApplyJobState = {
  status: "idle" | "running" | "success" | "error";
  message: string;
  steps: ApplyStepState[];
  summary: string[];
  loginUrl: string | null;
  publicUrl: string | null;
  appPort: number | null;
  mode: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export function createApplyState(): ApplyJobState {
  return {
    status: "idle",
    message: "Kurulum henüz uygulanmadı.",
    steps: APPLY_STEPS.map((step) => ({ id: step.id, label: step.label, status: "pending" })),
    summary: [],
    loginUrl: null,
    publicUrl: null,
    appPort: null,
    mode: null,
    startedAt: null,
    finishedAt: null,
  };
}

function isPortOpen(port: number, timeoutMs = 700): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (value: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function readJson(req: any): Promise<any> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16_384) throw new Error("İstek gövdesi çok büyük.");
  }
  return body ? JSON.parse(body) : {};
}

let installState: InstallState | null = null;

function markStep(applyJob: ApplyJobState, id: string, status: ApplyStepState["status"], detail?: string) {
  applyJob.steps = applyJob.steps.map((step) =>
    step.id === id ? { ...step, status, detail: detail ?? step.detail } : step,
  );
  // Durum dosyası yazılamazsa kurulum durmamalı; yalnızca izleme kaybolur.
  if (installState) {
    try { recordStep(statePath, installState, id, status, detail); } catch { /* izleme en iyi çabayla */ }
  }
}

export async function applySetup(payload: SetupPayload, applyJob: ApplyJobState) {
  fs.mkdirSync(dataRoot, { recursive: true });
  if (fs.existsSync(lockPath)) throw new Error("Kurulum daha önce tamamlanmış. Sihirbaz yeniden çalıştırılamaz.");
  if (fs.existsSync(envPath) && !payload.overwriteExistingEnv) throw new Error("server/.env zaten var. İçeriğini doğrulayın veya yedekleyerek değiştirme onayını seçin.");
  let pendingHandle: number | undefined;
  try {
    pendingHandle = fs.openSync(pendingPath, "wx", 0o600);
  } catch {
    throw new Error("Başka bir kurulum işlemi çalışıyor veya önceki işlem yarım kaldı.");
  }

  installState = createInstallState(APPLY_STEPS.map((step) => step.id));
  try { writeInstallState(statePath, installState); } catch { installState = null; }
  // İlk kurulumda veritabanı geçici dosyada hazırlanır, en sonda quiz.db olur.
  // Mevcut bir quiz.db varsa (ör. env adımında kesilen kurulum) yerinde kullanılır.
  const dbPlan = planStagedDatabase(dataRoot);
  const staged = needsStaging(dbPlan);
  if (staged) discardStagedDatabase(dbPlan);
  const databaseUrl = staged ? dbPlan.stagingUrl : "file:../data/quiz.db";
  const envText = buildServerEnv(payload);
  const temporaryEnv = `${envPath}.setup-${process.pid}`;
  const summary: string[] = [];
  const appUrl = publicAppUrl(payload);
  applyJob.publicUrl = appUrl;
  applyJob.appPort = payload.server.port;
  applyJob.mode = payload.deployment.mode;
  // Yerelde pnpm dev arayüzü 5173'te; üretim/tek port 5000.
  applyJob.loginUrl = payload.deployment.mode === "localhost"
    ? "http://127.0.0.1:5173/auth"
    : `${appUrl.replace(/\/$/, "")}/auth`;

  try {
    markStep(applyJob, "prepare", "running");
    fs.writeFileSync(temporaryEnv, envText, { encoding: "utf8", mode: 0o600 });
    markStep(applyJob, "prepare", "done", "Geçici ortam dosyası hazırlandı.");

    if (payload.buildClient) {
      const configuredBasePath = toDeploymentConfig(payload).basePath;
      const buildEnv = { VITE_BASE_PATH: configuredBasePath === "/" ? "/" : `${configuredBasePath}/` };
      markStep(applyJob, "buildServer", "running");
      await fixedPnpm(["--filter", "quiz-master-server", "build"], buildEnv);
      markStep(applyJob, "buildServer", "done");
      markStep(applyJob, "buildClient", "running");
      await fixedPnpm(["--filter", "quiz-master-client", "build"], buildEnv);
      markStep(applyJob, "buildClient", "done");
      summary.push("Üretim derlemesi tamamlandı.");
    } else {
      markStep(applyJob, "buildServer", "skipped", "Üretim derlemesi istenmedi.");
      markStep(applyJob, "buildClient", "skipped", "Üretim derlemesi istenmedi.");
    }

    markStep(applyJob, "migrate", "running");
    await deploySetupDatabase(databaseUrl, fixedPnpm);
    markStep(applyJob, "migrate", "done");
    summary.push("Veritabanı migration'ları uygulandı.");

    markStep(applyJob, "admin", "running");
    await createFirstAdmin(payload, databaseUrl);
    markStep(applyJob, "admin", "done", payload.admin.email);
    summary.push("İlk yönetici hesabı oluşturuldu.");

    markStep(applyJob, "artifacts", "running");
    const config = saveDeploymentConfig(toDeploymentConfig(payload), "setup-wizard");
    const artifacts = buildDeploymentArtifacts(config);
    fs.mkdirSync(artifactRoot, { recursive: true });
    fs.writeFileSync(path.join(artifactRoot, "nginx.conf.example"), `${artifacts.nginxText}\n`, "utf8");
    fs.writeFileSync(path.join(artifactRoot, "deployment.env.example"), `${artifacts.envText}\n`, "utf8");
    markStep(applyJob, "artifacts", "done", "server/data/setup-artifacts");
    summary.push("Nginx örneği server/data/setup-artifacts altında üretildi.");

    markStep(applyJob, "env", "running");
    if (staged) {
      promoteStagedDatabase(dbPlan);
      summary.push("Veritabanı hazırlandı ve server/data/quiz.db olarak yerine alındı.");
    }
    if (fs.existsSync(envPath)) {
      const backupRoot = path.join(serverRoot, "backups");
      fs.mkdirSync(backupRoot, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(envPath, path.join(backupRoot, `.env-${stamp}.bak`));
      summary.push("Eski .env dosyası server/backups altında yedeklendi.");
    }
    fs.renameSync(temporaryEnv, envPath);
    try { fs.chmodSync(envPath, 0o600); } catch { /* Windows ACL'leri işletim sistemi yönetir. */ }
    markStep(applyJob, "env", "done", "server/.env");
    summary.push("Gizli ayarlar server/.env dosyasına yazıldı.");

    markStep(applyJob, "finish", "running");
    fs.writeFileSync(lockPath, `${JSON.stringify({ installedAt: new Date().toISOString(), publicUrl: publicAppUrl(payload), nodeVersion: process.version }, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    markStep(applyJob, "finish", "done", "installation.lock yazıldı");
    return summary;
  } catch (error) {
    const running = applyJob.steps.find((step) => step.status === "running");
    if (running) markStep(applyJob, running.id, "error", error instanceof Error ? error.message : "Adım başarısız oldu.");
    throw error;
  } finally {
    if (pendingHandle !== undefined) fs.closeSync(pendingHandle);
    if (fs.existsSync(pendingPath)) fs.unlinkSync(pendingPath);
    if (fs.existsSync(temporaryEnv)) fs.unlinkSync(temporaryEnv);
    // Terfi edilmediyse (hata) kalan geçici veritabanı dosyalarını temizle; quiz.db'ye dokunmaz.
    if (staged) discardStagedDatabase(dbPlan);
  }
}

export function createSetupApp(token: string, onComplete?: () => void) {
  if (token.length < 24) throw new Error("SETUP_TOKEN en az 24 karakter olmalıdır.");
  const sessionValue = crypto.createHmac("sha256", token).update("quizmaster-setup-session").digest("hex");
  const csrfToken = crypto.createHmac("sha256", token).update("quizmaster-setup-csrf").digest("hex");
  const applyJob = createApplyState();
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'unsafe-inline'"], styleSrc: ["'unsafe-inline'"], imgSrc: ["'self'", "data:"], frameAncestors: ["'none'"] } } }));
  app.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  // POST işlemleri sıkı limitte; GET /api/status kurulum sırasında canlı izleme için bol limitte.
  const strictLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
  const statusLimiter = rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false });
  app.use("/api/status", statusLimiter);
  app.use("/api", (req, res, next) => {
    if (req.path === "/status" || req.method === "GET") return next();
    return strictLimiter(req, res, next);
  });
  app.use(express.json({ limit: "64kb" }));

  app.get("/setup", (req, res) => {
    const supplied = typeof req.query.token === "string" ? req.query.token : "";
    if (supplied && equalSecret(supplied, token)) {
      res.cookie("quizmaster.setup", sessionValue, { httpOnly: true, sameSite: "strict", secure: false, maxAge: 30 * 60_000, path: "/" });
      return res.redirect(303, "/setup");
    }
    if (!equalSecret(cookieValue(req, "quizmaster.setup"), sessionValue)) return res.status(401).send("Geçersiz veya eksik kurulum anahtarı.");
    res.type("html").send(renderSetupPage(csrfToken));
  });

  app.use("/api", (req, res, next) => {
    if (!equalSecret(cookieValue(req, "quizmaster.setup"), sessionValue)) return res.status(401).json({ message: "Kurulum oturumu geçersiz." });
    if (req.method !== "GET" && (!sameOrigin(req) || !equalSecret(String(req.get("x-setup-csrf") || ""), csrfToken))) {
      return res.status(403).json({ message: "Kurulum isteği güvenlik doğrulamasından geçmedi." });
    }
    next();
  });

  app.get("/api/status", (_req, res) => {
    const networks = Object.values(os.networkInterfaces()).flat().filter((item) => item && !item.internal).map((item) => item!.address);
    res.json({
      detected: { hostname: os.hostname(), platform: `${process.platform}/${process.arch}`, node: process.version, cpus: os.cpus().length, memoryGb: Math.round(os.totalmem() / 1024 ** 3), addresses: networks },
      checks: { nodeSupported: [22, 24].includes(Number(process.versions.node.split(".")[0])), dataWritable: writable(dataRoot), uploadsWritable: writable(path.join(serverRoot, "uploads")), notInstalled: !fs.existsSync(lockPath), envAbsent: !fs.existsSync(envPath) },
      apply: applyJob,
    });
  });

  app.get("/api/app-health", async (_req, res) => {
    const mode = applyJob.mode ?? "localhost";
    const appPort = applyJob.appPort ?? 5000;
    const devPort = 5173;
    const isLocal = mode === "localhost";
    // Yerel pnpm dev: arayüz 5173, API appPort. Üretim: her ikisi appPort.
    const uiPort = isLocal ? devPort : appPort;
    const apiReachable = await isPortOpen(appPort);
    const uiReachable = isLocal ? await isPortOpen(uiPort) : apiReachable;
    const reachable = isLocal ? uiReachable : apiReachable;
    const loginUrl = isLocal && uiReachable
      ? `http://127.0.0.1:${devPort}/auth`
      : applyJob.loginUrl;
    res.json({
      reachable,
      apiReachable,
      uiReachable,
      port: appPort,
      uiPort,
      mode,
      loginUrl,
      publicUrl: applyJob.publicUrl,
      hint: reachable
        ? "Uygulama ayakta görünüyor; giriş sayfasına gidebilirsiniz."
        : isLocal
          ? `Uygulama henüz ayakta değil (API: ${appPort}, arayüz: ${devPort}).`
          : `Uygulama ${appPort} portunda dinlemiyor veya alan adı çözümlenmiyor. Nginx + DNS'i kontrol edin.`,
    });
  });

  app.post("/api/start-app", async (req, res) => {
    const body = await readJson(req).catch(() => ({}));
    const mode = applyJob.mode ?? "localhost";
    const isLocal = mode === "localhost";
    const preferDev = isLocal && body?.mode !== "production";
    const appPort = applyJob.appPort ?? 5000;
    const projectRoot = path.join(serverRoot, "..");

    const alreadyUp = await isPortOpen(appPort) || (preferDev && await isPortOpen(5173));
    if (alreadyUp) {
      const loginUrl = preferDev
        ? `http://127.0.0.1:5173/auth`
        : applyJob.loginUrl;
      return res.json({
        message: "Uygulama zaten ayakta.",
        reachable: true,
        loginUrl,
        publicUrl: applyJob.publicUrl,
      });
    }

    if (!preferDev && !fs.existsSync(path.join(projectRoot, "dist", "index.cjs"))) {
      return res.status(409).json({
        message: "Üretim derlemesi bulunamadı. 'Uygulamayı üretim için derle' seçeneğini kullanın veya pnpm build çalıştırın.",
      });
    }

    // Başlatma, PID kaydı ve log yönlendirmesi scripts/app.mjs tarafından yapılır
    // (aynı betik terminalden de kullanılır: node scripts/app.mjs start|stop|status|logs).
    const started = spawnSync(process.execPath, [path.join(projectRoot, "scripts", "app.mjs"), "start", "--mode", preferDev ? "dev" : "production", "--json"], {
      cwd: projectRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    });
    let startInfo: { started?: boolean; pid?: number; logFile?: string; message?: string } = {};
    try { startInfo = JSON.parse(String(started.stdout).trim().split("\n").pop()?.trim() || "{}"); } catch { /* aşağıda ele alınır */ }
    if (!startInfo.started || !startInfo.pid) {
      return res.status(409).json({ message: startInfo.message || `Uygulama başlatılamadı. ${String(started.stderr || "").trim()}`.trim() });
    }
    const logPath = startInfo.logFile || path.join(dataRoot, "logs", preferDev ? "app-dev.log" : "app-production.log");
    const startedPid = startInfo.pid;
    const processAlive = () => { try { process.kill(startedPid, 0); return true; } catch { return false; } };

    const watchPort = preferDev ? 5173 : appPort;
    let reachable = false;
    for (let i = 0; i < 30; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await isPortOpen(watchPort)) {
        reachable = true;
        break;
      }
      if (preferDev && await isPortOpen(appPort) && i > 8) {
        // API ayağa kalktı; arayüz biraz gecikebilir
        if (await isPortOpen(5173)) {
          reachable = true;
          break;
        }
      }
    }

    const loginUrl = preferDev
      ? `http://127.0.0.1:5173/auth`
      : applyJob.loginUrl;

    let failureTail = "";
    if (!reachable) {
      try {
        failureTail = fs.readFileSync(logPath, "utf8").slice(-1200).trim();
      } catch { /* log okunamadı */ }
    }
    const logHint = `Ayrıntı için log dosyası: ${path.relative(projectRoot, logPath)}`;
    return res.status(reachable ? 200 : 202).json({
      message: reachable
        ? (preferDev ? "Geliştirme sunucusu (pnpm dev) arka planda başlatıldı." : "Uygulama başlatıldı.")
        : !processAlive()
          ? `Uygulama başlatılamadı, süreç kapandı. ${logHint}${failureTail ? `\n\n${failureTail}` : ""}`
          : `Başlatıldı ancak port henüz açılmadı. Birkaç saniye sonra tekrar denetleyin. ${logHint}`,
      reachable,
      loginUrl,
      publicUrl: applyJob.publicUrl,
      logFile: path.relative(projectRoot, logPath),
    });
  });

  app.post("/api/apply", async (req, res) => {
    if (applyJob.status === "running") {
      return res.status(409).json({ message: "Kurulum zaten uygulanıyor; pencereyi kapatmayın." });
    }
    try {
      const payload = setupPayloadSchema.parse(req.body);
      applyJob.status = "running";
      applyJob.message = "Kurulum uygulanıyor; adımlar ekranda canlı izleniyor…";
      applyJob.summary = [];
      applyJob.steps = createApplyState().steps;
      applyJob.startedAt = new Date().toISOString();
      applyJob.finishedAt = null;
      applyJob.loginUrl = null;
      applyJob.publicUrl = null;
      applyJob.appPort = null;
      applyJob.mode = null;
      res.status(202).json({
        message: "Kurulum başladı. Aşağıdaki adımlar tamamlandıkça güncellenir.",
        steps: applyJob.steps,
      });

      void (async () => {
        try {
          const summary = await applySetup(payload, applyJob);
          applyJob.summary = summary;
          applyJob.status = "success";
          applyJob.message = "QuizMaster kurulumu tamamlandı. Aşağıdaki bağlantıdan giriş sayfasına geçebilirsiniz.";
          applyJob.finishedAt = new Date().toISOString();
          // Kullanıcı bitiş ekranını görsün ve login'e gidebilsin diye sihirbazı geç kapat.
          setTimeout(() => onComplete?.(), 20_000);
        } catch (error) {
          applyJob.status = "error";
          applyJob.message = error instanceof Error ? error.message : "Kurulum tamamlanamadı.";
          applyJob.finishedAt = new Date().toISOString();
          const failedStep = applyJob.steps.find((step) => step.status === "running");
          applyJob.steps = applyJob.steps.map((step) =>
            step.status === "running" ? { ...step, status: "error", detail: applyJob.message } : step,
          );
          if (installState && failedStep) {
            try { recordStep(statePath, installState, failedStep.id, "error", applyJob.message); } catch { /* izleme en iyi çabayla */ }
          }
        }
      })();
    } catch (error) {
      applyJob.status = "idle";
      const status = error instanceof ZodError ? 400 : 409;
      if (error instanceof ZodError) {
        return res.status(status).json({
          message: "Girilen bilgiler doğrulanamadı.",
          issues: error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path,
          })),
        });
      }
      res.status(status).json({ message: error instanceof Error ? error.message : "Kurulum tamamlanamadı." });
    }
  });
  return app;
}

export function startSetupWizard() {
  fs.mkdirSync(dataRoot, { recursive: true });
  if (fs.existsSync(lockPath)) throw new Error("Kurulum kilidi mevcut. Çalışan sistemi yeniden yapılandırmak için admin Sunucu Durumu ekranını ve sunucu belgelerini kullanın.");
  const token = process.env.SETUP_TOKEN || crypto.randomBytes(24).toString("base64url");
  // The installer is intentionally loopback-only. Reach a remote VPS through an SSH tunnel;
  // exposing the one-time installer directly to the internet is not supported.
  const host = "127.0.0.1";
  const port = Math.min(65535, Math.max(1024, Number(process.env.SETUP_PORT) || 5050));
  let server: Server;
  const app = createSetupApp(token, () => server.close());

  const onListenError = (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Kurulum sihirbazı açılamadı: 127.0.0.1:${port} portu zaten kullanımda.`);
      console.error("");
      console.error("Sihirbaz varsayılan olarak 5050, kurulum başlatıcısı 5049 portunu kullanır.");
      console.error("Bu hata, sihirbaz portunun başlatıcıyla aynı olması veya önceki sihirbazın");
      console.error("kalmış olmasından kaynaklanabilir.");
      console.error("");
      console.error("Yapılması gerekenler:");
      console.error("  1. Önceki kurulum/sihirbaz sürecini durdurun.");
      console.error(`  2. Portu tutan PID için: node scripts\\find-port-holder.mjs ${port}`);
      console.error("  3. Kuruluma kurulum.bat üzerinden yeniden başlayın.");
      console.error("");
      console.error("Not: Kurulum verileri bu hata nedeniyle değiştirilmez.");
    } else {
      console.error(`Kurulum sihirbazı açılamadı: ${error.message}`);
    }
    process.exitCode = 1;
    setImmediate(() => process.exit(1));
  };

  // Hata dinleyicisini listen'dan önce bağla; aksi halde EADDRINUSE yakalanmadan düşer.
  server = createServer(app);
  server.once("error", onListenError);
  server.listen(port, host, () => {
    console.log(`QuizMaster kurulum sihirbazı: http://${host}:${port}/setup?token=${token}`);
    console.log("Bu bağlantıyı paylaşmayın. Kurulum tamamlandığında sihirbaz otomatik kapanır.");
  });
}

if (import.meta.url && process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  startSetupWizard();
}
