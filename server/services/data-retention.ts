import { storage } from "../storage";
import { getEffectiveDeploymentConfig } from "../utils/deployment-config";
import { logger } from "../utils/logger";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RetentionPolicy = ReturnType<typeof getEffectiveDeploymentConfig>["retention"];

export function retentionCutoffs(policy: RetentionPolicy, now = new Date()) {
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
  return {
    actionLogsBefore: before(policy.actionLogDays),
    readNotificationsBefore: before(policy.readNotificationDays),
    emailLogsBefore: before(policy.emailLogDays),
    passwordResetsBefore: before(policy.passwordResetDays),
  };
}

export async function runDataRetention(now = new Date()) {
  const policy = getEffectiveDeploymentConfig().retention;
  if (!policy.enabled) {
    return { enabled: false, skipped: true } as const;
  }

  const result = await storage.pruneOperationalData(retentionCutoffs(policy, now));
  logger.info({ policy, result }, "[Retention] Eski operasyon kayıtları temizlendi");
  return { enabled: true, skipped: false, policy, result } as const;
}

let retentionTimer: NodeJS.Timeout | null = null;

export function startDataRetentionWorker() {
  if (retentionTimer) return;

  const run = () => {
    runDataRetention().catch((error) => {
      logger.error({ err: error }, "[Retention] Temizleme işi başarısız");
    });
  };

  const initialTimer = setTimeout(run, 60_000);
  initialTimer.unref();
  retentionTimer = setInterval(run, DAY_MS);
  retentionTimer.unref();
  logger.info("[Retention] Günlük bakım denetleyicisi başlatıldı");
}
