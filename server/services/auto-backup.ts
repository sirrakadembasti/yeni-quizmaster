import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getEffectiveDeploymentConfig } from "../utils/deployment-config";
import { getProjectRoot } from "../utils/project-paths";
import { resolveRuntimeSQLitePath } from "../utils/sqlite-runtime-config";
import { uploadsDirectory } from "../utils/upload-paths";
import { logger } from "../utils/logger";

// S-09: uygulama çalışırken (durdurmadan) günlük veritabanı yedeği. better-sqlite3'ün çevrimiçi
// backup() API'si WAL modunda güvenlidir. Yedekler server/backups/auto/ altında tutulur.

export interface AutoBackupOptions {
  databaseFile: string;
  backupDir: string;
  /** Verilirse yüklenen dosyalar backupDir/uploads altına artımlı yansıtılır (silinenler yansıdan silinmez). */
  uploadsDir?: string | null;
  keep: number;
  now?: Date;
}

export type AutoBackupResult =
  | { skipped: true; reason: "exists"; file: string }
  | { skipped: false; file: string; removed: string[]; uploadsCopied: number };

const BACKUP_NAME = /^quiz-\d{8}\.db$/;

function stamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function removeStaleTemporaryFiles(backupDir: string) {
  for (const name of fs.readdirSync(backupDir)) {
    if (/^quiz-\d{8}\.db\.tmp$/.test(name)) fs.rmSync(path.join(backupDir, name), { force: true });
  }
}

async function snapshotDatabase(databaseFile: string, target: string) {
  const source = new Database(databaseFile, { readonly: true, fileMustExist: true });
  try {
    await source.backup(target);
  } finally {
    source.close();
  }
  // Yedek bağımsız bir veritabanı olmalı (WAL yan dosyaları olmadan) ve sağlam olduğu doğrulanmalı.
  const snapshot = new Database(target);
  try {
    if (snapshot.pragma("journal_mode = DELETE", { simple: true }) !== "delete") throw new Error("SQLite yedeği bağımsız değil");
    if (snapshot.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("SQLite yedeği bütünlük denetiminden geçmedi");
    if ((snapshot.pragma("foreign_key_check") as unknown[]).length) throw new Error("SQLite yedeği yabancı anahtar denetiminden geçmedi");
  } finally {
    snapshot.close();
  }
}

function mirrorUploads(sourceDir: string, targetDir: string): number {
  if (!fs.existsSync(sourceDir)) return 0;
  let copied = 0;
  const walk = (from: string, to: string) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const source = path.join(from, entry.name);
      const target = path.join(to, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { walk(source, target); continue; }
      if (!entry.isFile()) continue;
      const sourceStat = fs.statSync(source);
      const targetStat = fs.existsSync(target) ? fs.statSync(target) : null;
      if (targetStat && targetStat.size === sourceStat.size && targetStat.mtimeMs >= Math.floor(sourceStat.mtimeMs)) continue; // utimes milisaniyeye yuvarlar
      fs.copyFileSync(source, target);
      fs.utimesSync(target, sourceStat.atime, sourceStat.mtime);
      copied += 1;
    }
  };
  walk(sourceDir, targetDir);
  return copied;
}

export async function runAutoBackup(options: AutoBackupOptions): Promise<AutoBackupResult> {
  const { databaseFile, backupDir, uploadsDir = null, now = new Date() } = options;
  const keep = Math.max(1, Math.floor(options.keep));
  fs.mkdirSync(backupDir, { recursive: true });
  removeStaleTemporaryFiles(backupDir);

  const finalFile = path.join(backupDir, `quiz-${stamp(now)}.db`);
  if (fs.existsSync(finalFile)) return { skipped: true, reason: "exists", file: finalFile };

  const temporary = `${finalFile}.tmp`;
  try {
    await snapshotDatabase(databaseFile, temporary);
    fs.renameSync(temporary, finalFile);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }

  const uploadsCopied = uploadsDir ? mirrorUploads(uploadsDir, path.join(backupDir, "uploads")) : 0;

  const removed = fs.readdirSync(backupDir)
    .filter(name => BACKUP_NAME.test(name))
    .sort()
    .reverse()
    .slice(keep);
  for (const name of removed) fs.rmSync(path.join(backupDir, name), { force: true });

  return { skipped: false, file: finalFile, removed, uploadsCopied };
}

export async function runScheduledBackup(now = new Date()) {
  const policy = getEffectiveDeploymentConfig().backup;
  if (!policy.enabled) return { enabled: false, skipped: true } as const;
  const result = await runAutoBackup({
    databaseFile: resolveRuntimeSQLitePath(),
    backupDir: path.join(getProjectRoot(), "server", "backups", "auto"),
    uploadsDir: policy.includeUploads ? uploadsDirectory : null,
    keep: policy.keep,
    now,
  });
  if (!result.skipped) logger.info({ file: path.basename(result.file), removed: result.removed.length, uploadsCopied: result.uploadsCopied }, "[Backup] Günlük yedek alındı");
  return { enabled: true, ...result } as const;
}

let backupTimer: NodeJS.Timeout | null = null;
let initialTimer: NodeJS.Timeout | null = null;

export function startAutoBackupWorker() {
  if (backupTimer) return;
  const run = () => {
    runScheduledBackup().catch(error => logger.error({ err: error }, "[Backup] Günlük yedek başarısız"));
  };
  // Bugünün yedeği yoksa her saat denenir: kapalı kalınan günlerden sonra ilk fırsatta yedek alınır.
  initialTimer = setTimeout(run, 2 * 60_000);
  initialTimer.unref();
  backupTimer = setInterval(run, 60 * 60_000);
  backupTimer.unref();
  logger.info("[Backup] Günlük otomatik yedek denetleyicisi başlatıldı");
}

export function stopAutoBackupWorker() {
  if (initialTimer) clearTimeout(initialTimer);
  if (backupTimer) clearInterval(backupTimer);
  initialTimer = null;
  backupTimer = null;
}
