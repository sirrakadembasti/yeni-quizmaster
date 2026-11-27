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
// Yansıdaki dosya, kaynağın zaman damgasından en fazla bu kadar geride olsa da güncel sayılır:
// utimes ms'ye yuvarlar (Linux) ve FAT/exFAT harici diskler 2 sn hassasiyetle kaydeder.
const MIRROR_MTIME_TOLERANCE_MS = 2000;

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
      if (targetStat && targetStat.size === sourceStat.size && sourceStat.mtimeMs - targetStat.mtimeMs <= MIRROR_MTIME_TOLERANCE_MS) continue;
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

export interface OffsiteSyncOptions {
  sourceDir: string;
  /** Ağ paylaşımı veya harici disk altındaki hedef klasör. Üst dizini önceden var olmalıdır (bağlı olmayan paylaşım yerelde klasör açtırmaz). */
  targetDir: string;
  keep: number;
}

// Yerel yedeklerden hedefte eksik olanları kopyalar (önce .tmp, sonra rename), hedefte son `keep` yedeği tutar.
// Yerel yedeğin alınmasından bağımsız çalışır: paylaşım o gün erişilemediyse sonraki denetimde tamamlanır.
export async function syncOffsiteBackups(options: OffsiteSyncOptions) {
  const { sourceDir, targetDir } = options;
  const keep = Math.max(1, Math.floor(options.keep));
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir); // recursive değil: üst dizin yoksa hata verir
  removeStaleTemporaryFiles(targetDir);

  const copied: string[] = [];
  const localNames = fs.readdirSync(sourceDir).filter(name => BACKUP_NAME.test(name)).sort();
  for (const name of localNames) {
    const source = path.join(sourceDir, name);
    const target = path.join(targetDir, name);
    const size = fs.statSync(source).size;
    if (fs.existsSync(target) && fs.statSync(target).size === size) continue;
    const temporary = `${target}.tmp`;
    try {
      fs.copyFileSync(source, temporary);
      if (fs.statSync(temporary).size !== size) throw new Error(`Dış kopya eksik yazıldı: ${name}`);
      fs.renameSync(temporary, target);
    } catch (error) {
      fs.rmSync(temporary, { force: true });
      throw error;
    }
    copied.push(name);
  }

  const uploadsSource = path.join(sourceDir, "uploads");
  const uploadsCopied = fs.existsSync(uploadsSource) ? mirrorUploads(uploadsSource, path.join(targetDir, "uploads")) : 0;

  const removed = fs.readdirSync(targetDir)
    .filter(name => BACKUP_NAME.test(name))
    .sort()
    .reverse()
    .slice(keep);
  for (const name of removed) fs.rmSync(path.join(targetDir, name), { force: true });

  return { copied, removed, uploadsCopied };
}

// server/.env: BACKUP_OFFSITE_DIR (ör. \\nas\quiz-yedek\quizmaster), BACKUP_OFFSITE_KEEP (varsayılan 14).
export function getOffsiteConfig(env: NodeJS.ProcessEnv = process.env) {
  const targetDir = (env.BACKUP_OFFSITE_DIR ?? "").trim();
  if (!targetDir) return null;
  const keep = Number(env.BACKUP_OFFSITE_KEEP);
  return { targetDir, keep: Number.isFinite(keep) && keep >= 1 ? Math.floor(keep) : 14 };
}

export async function runScheduledBackup(now = new Date()) {
  const policy = getEffectiveDeploymentConfig().backup;
  if (!policy.enabled) return { enabled: false, skipped: true } as const;
  const backupDir = path.join(getProjectRoot(), "server", "backups", "auto");
  const result = await runAutoBackup({
    databaseFile: resolveRuntimeSQLitePath(),
    backupDir,
    uploadsDir: policy.includeUploads ? uploadsDirectory : null,
    keep: policy.keep,
    now,
  });
  if (!result.skipped) logger.info({ file: path.basename(result.file), removed: result.removed.length, uploadsCopied: result.uploadsCopied }, "[Backup] Günlük yedek alındı");

  // Dış kopya hatası yerel yedeği etkilemez; hata günlüğe yazılır, sonraki denetimde yeniden denenir.
  const offsite = getOffsiteConfig();
  if (offsite) {
    try {
      const sync = await syncOffsiteBackups({ sourceDir: backupDir, ...offsite });
      if (sync.copied.length) logger.info({ copied: sync.copied, removed: sync.removed.length }, "[Backup] Dış kopya alındı");
    } catch (error) {
      logger.error({ err: error }, "[Backup] Dış kopya başarısız (paylaşım erişilebilir mi?)");
    }
  }
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
