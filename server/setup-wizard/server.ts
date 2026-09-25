import crypto, { timingSafeEqual } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import type { Server } from "http";
import { fileURLToPath } from "url";
import express, { type Request } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { getProjectRoot } from "../utils/project-paths";
import { buildDeploymentArtifacts, saveDeploymentConfig } from "../utils/deployment-config";
import { buildServerEnv, publicAppUrl, setupPayloadSchema, toDeploymentConfig, type SetupPayload } from "./config";
import { renderSetupPage } from "./ui";

const projectRoot = getProjectRoot();
const serverRoot = path.join(projectRoot, "server");
const dataRoot = path.join(serverRoot, "data");
const envPath = path.join(serverRoot, ".env");
const lockPath = path.join(dataRoot, "installation.lock");
const pendingPath = path.join(dataRoot, "installation.pending");
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
  const prisma = new PrismaClient();
  try {
    const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
    if (existingAdmin) throw new Error("Veritabanında zaten bir yönetici var. Mevcut kurulum sihirbazla devralınamaz.");
    const email = payload.admin.email.toLowerCase();
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

async function applySetup(payload: SetupPayload) {
  fs.mkdirSync(dataRoot, { recursive: true });
  if (fs.existsSync(lockPath)) throw new Error("Kurulum daha önce tamamlanmış. Sihirbaz yeniden çalıştırılamaz.");
  if (fs.existsSync(envPath) && !payload.overwriteExistingEnv) throw new Error("server/.env zaten var. İçeriğini doğrulayın veya yedekleyerek değiştirme onayını seçin.");
  let pendingHandle: number | undefined;
  try {
    pendingHandle = fs.openSync(pendingPath, "wx", 0o600);
  } catch {
    throw new Error("Başka bir kurulum işlemi çalışıyor veya önceki işlem yarım kaldı.");
  }

  const databaseUrl = "file:../data/quiz.db";
  const envText = buildServerEnv(payload);
  const temporaryEnv = `${envPath}.setup-${process.pid}`;
  const summary: string[] = [];
  try {
    fs.writeFileSync(temporaryEnv, envText, { encoding: "utf8", mode: 0o600 });
    if (payload.buildClient) {
      const configuredBasePath = toDeploymentConfig(payload).basePath;
      const buildEnv = { VITE_BASE_PATH: configuredBasePath === "/" ? "/" : `${configuredBasePath}/` };
      await fixedPnpm(["--filter", "quiz-master-server", "build"], buildEnv);
      await fixedPnpm(["--filter", "quiz-master-client", "build"], buildEnv);
      summary.push("Üretim derlemesi tamamlandı.");
    }
    await fixedPnpm(["--filter", "quiz-master-server", "db:deploy"], { DATABASE_URL: databaseUrl });
    summary.push("Veritabanı migration'ları uygulandı.");
    await createFirstAdmin(payload, databaseUrl);
    summary.push("İlk yönetici hesabı oluşturuldu.");

    const config = saveDeploymentConfig(toDeploymentConfig(payload), "setup-wizard");
    const artifacts = buildDeploymentArtifacts(config);
    fs.mkdirSync(artifactRoot, { recursive: true });
    fs.writeFileSync(path.join(artifactRoot, "nginx.conf.example"), `${artifacts.nginxText}\n`, "utf8");
    fs.writeFileSync(path.join(artifactRoot, "deployment.env.example"), `${artifacts.envText}\n`, "utf8");

    if (fs.existsSync(envPath)) {
      const backupRoot = path.join(serverRoot, "backups");
      fs.mkdirSync(backupRoot, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(envPath, path.join(backupRoot, `.env-${stamp}.bak`));
      summary.push("Eski .env dosyası server/backups altında yedeklendi.");
    }
    fs.renameSync(temporaryEnv, envPath);
    try { fs.chmodSync(envPath, 0o600); } catch { /* Windows ACL'leri işletim sistemi yönetir. */ }
    fs.writeFileSync(lockPath, `${JSON.stringify({ installedAt: new Date().toISOString(), publicUrl: publicAppUrl(payload), nodeVersion: process.version }, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    summary.push("Gizli ayarlar server/.env dosyasına yazıldı.");
    summary.push("Nginx örneği server/data/setup-artifacts altında üretildi.");
    return summary;
  } finally {
    if (pendingHandle !== undefined) fs.closeSync(pendingHandle);
    if (fs.existsSync(pendingPath)) fs.unlinkSync(pendingPath);
    if (fs.existsSync(temporaryEnv)) fs.unlinkSync(temporaryEnv);
  }
}

export function createSetupApp(token: string, onComplete?: () => void) {
  if (token.length < 24) throw new Error("SETUP_TOKEN en az 24 karakter olmalıdır.");
  const sessionValue = crypto.createHmac("sha256", token).update("quizmaster-setup-session").digest("hex");
  const csrfToken = crypto.createHmac("sha256", token).update("quizmaster-setup-csrf").digest("hex");
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'unsafe-inline'"], styleSrc: ["'unsafe-inline'"], imgSrc: ["'self'", "data:"], frameAncestors: ["'none'"] } } }));
  app.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use(rateLimit({ windowMs: 15 * 60_000, limit: 100, standardHeaders: true, legacyHeaders: false }));
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
      checks: { nodeSupported: Number(process.versions.node.split(".")[0]) >= 20, dataWritable: writable(dataRoot), uploadsWritable: writable(path.join(serverRoot, "uploads")), notInstalled: !fs.existsSync(lockPath), envAbsent: !fs.existsSync(envPath) },
    });
  });

  app.post("/api/apply", async (req, res) => {
    try {
      const payload = setupPayloadSchema.parse(req.body);
      const summary = await applySetup(payload);
      res.json({ message: "QuizMaster kurulumu tamamlandı. Sihirbaz güvenlik için kapanacak.", summary });
      setTimeout(() => onComplete?.(), 750);
    } catch (error) {
      const status = error instanceof ZodError ? 400 : 409;
      res.status(status).json({ message: error instanceof Error ? error.message : "Kurulum tamamlanamadı.", issues: error instanceof ZodError ? error.issues : undefined });
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
  server = app.listen(port, host, () => {
    console.log(`QuizMaster kurulum sihirbazı: http://${host}:${port}/setup?token=${token}`);
    console.log("Bu bağlantıyı paylaşmayın. Kurulum tamamlandığında sihirbaz otomatik kapanır.");
  });
}

if (import.meta.url && process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  startSetupWizard();
}
