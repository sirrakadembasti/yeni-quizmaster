// İlk kurulumda veritabanı doğrudan quiz.db üzerinde değil, geçici bir dosyada
// hazırlanır; tüm adımlar başarılı olunca yerine taşınır. Yarıda kesilen kurulum
// böylece yarım bir quiz.db bırakmaz.
import fs from "node:fs";
import path from "node:path";

export const STAGING_SUFFIX = ".setup-tmp";
const SIDECARS = ["", "-journal", "-wal", "-shm"] as const;

export type StagedDatabase = {
  /** Gerçek hedef (ör. server/data/quiz.db). */
  finalPath: string;
  /** Geçici dosya (ör. server/data/quiz.db.setup-tmp). */
  stagingPath: string;
  /** Prisma DATABASE_URL (server/prisma dizinine göre göreli). */
  stagingUrl: string;
};

export function planStagedDatabase(dataRoot: string, fileName = "quiz.db"): StagedDatabase {
  const finalPath = path.join(dataRoot, fileName);
  return {
    finalPath,
    stagingPath: `${finalPath}${STAGING_SUFFIX}`,
    stagingUrl: `file:../data/${fileName}${STAGING_SUFFIX}`,
  };
}

/** Hedef veritabanı yoksa hazırlama gerekir; varsa mevcut veri yerinde korunur. */
export function needsStaging(plan: StagedDatabase): boolean {
  return !SIDECARS.some((suffix) => fs.existsSync(`${plan.finalPath}${suffix}`));
}

/** Yalnızca geçici dosyaları siler; gerçek veritabanına dokunmaz. */
export function discardStagedDatabase(plan: StagedDatabase): void {
  for (const suffix of SIDECARS) {
    fs.rmSync(`${plan.stagingPath}${suffix}`, { force: true, maxRetries: 5, retryDelay: 100 });
  }
}

/** Geçici veritabanını gerçek yerine taşır. Hedef doluysa hiçbir şeyi ezmez. */
export function promoteStagedDatabase(plan: StagedDatabase): void {
  if (!needsStaging(plan)) throw new Error(`${path.basename(plan.finalPath)} bu sırada oluşturulmuş; üzerine yazılmadı.`);
  if (!fs.existsSync(plan.stagingPath)) throw new Error("Hazırlanan veritabanı bulunamadı.");
  for (const suffix of SIDECARS) {
    const from = `${plan.stagingPath}${suffix}`;
    if (fs.existsSync(from)) fs.renameSync(from, `${plan.finalPath}${suffix}`);
  }
}
