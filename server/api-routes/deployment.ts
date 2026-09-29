import fs from "fs";
import os from "os";
import { Router, type Response } from "express";
import { ZodError } from "zod";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { uploadsDirectory } from "../utils/upload-paths";
import { getEmailStatus } from "../utils/email";
import {
  buildDeploymentArtifacts,
  deploymentConfigPath,
  getEffectiveDeploymentConfig,
  loadSavedDeploymentConfig,
  saveDeploymentConfig,
} from "../utils/deployment-config";
import { runDataRetention } from "../services/data-retention";
import { logger } from "../utils/logger";

const router: Router = Router();
router.use(requireAuth, requireRole(["admin"]));

export function runtimeDeploymentChangesAllowed() {
  return process.env.ALLOW_RUNTIME_DEPLOYMENT_CHANGES === "true";
}

function requireRuntimeChanges(_req: AuthRequest, res: Response, next: () => void) {
  if (!runtimeDeploymentChangesAllowed()) {
    return res.status(403).json({
      message: "Çalışan uygulamada sunucu ayarı değiştirme kapalıdır. Değişiklik için sunucu yöneticisiyle görüşün.",
    });
  }
  next();
}

function detectedOrigin(req: AuthRequest) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol;
  const host = req.get("host") || "";
  return host ? `${protocol}://${host}` : null;
}

router.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    const config = getEffectiveDeploymentConfig();
    const saved = loadSavedDeploymentConfig();
    let uploadsWritable = false;
    try {
      fs.mkdirSync(uploadsDirectory, { recursive: true });
      fs.accessSync(uploadsDirectory, fs.constants.W_OK);
      uploadsWritable = true;
    } catch {
      uploadsWritable = false;
    }

    const databaseReady = await storage.databaseHealth();
    res.json({
      config,
      artifacts: buildDeploymentArtifacts(config),
      source: saved ? "web-profile" : "environment",
      runtimeChangesAllowed: runtimeDeploymentChangesAllowed(),
      restartRequiredForSavedChanges: true,
      detected: {
        origin: detectedOrigin(req),
        forwardedProto: req.headers["x-forwarded-proto"] || null,
        forwardedHost: req.headers["x-forwarded-host"] || null,
        forwardedForPresent: Boolean(req.headers["x-forwarded-for"]),
        hostname: os.hostname(),
        platform: `${process.platform}/${process.arch}`,
        nodeVersion: process.version,
        nodeEnvironment: process.env.NODE_ENV || "development",
        databaseProvider: process.env.DATABASE_URL?.startsWith("postgres") ? "postgresql" : "sqlite",
      },
      checks: {
        databaseReady,
        uploadsWritable,
        sessionSecretConfigured: Boolean(process.env.SESSION_SECRET),
        email: getEmailStatus(),
        productionMode: process.env.NODE_ENV === "production",
        httpsDetected: detectedOrigin(req)?.startsWith("https://") || false,
      },
      secrets: {
        databaseUrl: process.env.DATABASE_URL ? "configured" : "missing",
        sessionSecret: process.env.SESSION_SECRET ? "configured" : "missing",
        emailPassword: process.env.EMAIL_PASS ? "configured" : "missing",
      },
      configFileExists: fs.existsSync(deploymentConfigPath),
    });
  } catch (error) {
    logger.error({ err: error }, "[Deployment] Durum okunamadı");
    res.status(500).json({ message: "Sunucu durumu okunamadı." });
  }
});

router.put("/configuration", requireRuntimeChanges, async (req: AuthRequest, res: Response) => {
  try {
    const config = saveDeploymentConfig(req.body, req.user!.id);
    await storage.createLog(
      req.user!.id,
      "UPDATE_DEPLOYMENT_CONFIG",
      `Dağıtım profili güncellendi: ${config.mode}, ${config.publicUrl}, ${config.basePath}`,
    );
    res.json({
      message: "Yapılandırma profili kaydedildi. Etkinleşmesi için uygulamayı yeniden başlatın; alt yol değiştiyse istemciyi yeniden derleyin.",
      config,
      artifacts: buildDeploymentArtifacts(config),
      restartRequired: true,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: "Yapılandırma geçersiz.", issues: error.issues });
    }
    logger.error({ err: error }, "[Deployment] Yapılandırma kaydedilemedi");
    res.status(500).json({ message: "Yapılandırma kaydedilemedi." });
  }
});

router.post("/retention/run", requireRuntimeChanges, async (req: AuthRequest, res: Response) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ message: "Temizleme için açık onay gereklidir." });
  }

  try {
    const result = await runDataRetention();
    if (result.skipped) {
      return res.status(409).json({ message: "Saklama politikası etkin değil.", result });
    }
    await storage.createLog(req.user!.id, "RUN_DATA_RETENTION", JSON.stringify(result.result));
    res.json({ message: "Saklama politikası uygulandı.", ...result });
  } catch (error) {
    logger.error({ err: error }, "[Deployment] Saklama politikası çalıştırılamadı");
    res.status(500).json({ message: "Saklama politikası çalıştırılamadı." });
  }
});

export default router;
