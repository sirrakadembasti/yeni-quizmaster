import { storage } from "../storage";
import { logger } from "../utils/logger";

let expiredResultTimer: NodeJS.Timeout | null = null;

export function startExpiredResultWorker(intervalMs = 60_000) {
  if (expiredResultTimer) return;

  const run = () => {
    storage.completeExpiredResults()
      .then((completed) => {
        if (completed > 0) logger.info({ completed }, "[ExpiredResults] Süresi dolan sınav oturumları kapatıldı");
      })
      .catch((error) => {
        logger.error({ err: error }, "[ExpiredResults] Süresi dolan oturumlar kapatılamadı");
      });
  };

  expiredResultTimer = setInterval(run, intervalMs);
  expiredResultTimer.unref();
  logger.info("[ExpiredResults] Süresi dolan oturum işçisi başlatıldı");
}
