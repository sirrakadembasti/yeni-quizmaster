import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

export const SUPPORTED_NODE_MAJORS = Object.freeze([22, 24]);
export const REQUIRED_PNPM_VERSION = "9.15.1";
export const CLEAN_INSTALL_CONFIRMATION = "QUIZMASTER VERİLERİNİ SİL";

function isInside(parent, target) {
  const relative = path.relative(path.resolve(parent), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertInside(parent, target) {
  if (!isInside(parent, target)) {
    throw new Error(`Güvenli dizin sınırı ihlali: ${target}`);
  }
}

export function getSetupPaths(projectRoot) {
  const root = path.resolve(projectRoot);
  const serverRoot = path.join(root, "server");
  const dataRoot = path.join(serverRoot, "data");
  const uploadsRoot = path.join(serverRoot, "uploads");
  const backupsRoot = path.join(serverRoot, "backups");
  const values = {
    projectRoot: root,
    serverRoot,
    dataRoot,
    uploadsRoot,
    backupsRoot,
    archiveBackupsRoot: path.join(dataRoot, "backups"),
    env: path.join(serverRoot, ".env"),
    quizDb: path.join(dataRoot, "quiz.db"),
    quizDbWal: path.join(dataRoot, "quiz.db-wal"),
    quizDbShm: path.join(dataRoot, "quiz.db-shm"),
    quizDbJournal: path.join(dataRoot, "quiz.db-journal"),
    sessionsDb: path.join(dataRoot, "sessions.db"),
    sessionsDbWal: path.join(dataRoot, "sessions.db-wal"),
    sessionsDbShm: path.join(dataRoot, "sessions.db-shm"),
    sessionsDbJournal: path.join(dataRoot, "sessions.db-journal"),
    lock: path.join(dataRoot, "installation.lock"),
    pending: path.join(dataRoot, "installation.pending"),
    deploymentConfig: path.join(dataRoot, "deployment-config.json"),
    deploymentConfigTemp: path.join(dataRoot, "deployment-config.json.tmp"),
    setupArtifacts: path.join(dataRoot, "setup-artifacts"),
    nodeModules: path.join(root, "node_modules", ".pnpm"),
  };
  for (const target of Object.values(values).filter((value) => typeof value === "string")) {
    assertInside(root, target);
  }
  return values;
}

function hasUploadedFiles(uploadsRoot) {
  if (!fs.existsSync(uploadsRoot)) return false;
  return fs.readdirSync(uploadsRoot).some((name) => name !== ".gitkeep");
}

function anyExists(...targets) {
  return targets.some((target) => fs.existsSync(target));
}

export function checkDependencies(projectRoot) {
  const paths = getSetupPaths(projectRoot);
  const rootPackages = fs.existsSync(paths.nodeModules);
  const serverModules = fs.existsSync(path.join(paths.serverRoot, "node_modules"));
  const clientRoot = path.join(paths.projectRoot, "client");
  const clientModules = fs.existsSync(path.join(clientRoot, "node_modules"));
  const serverEntry = fs.existsSync(path.join(paths.serverRoot, "package.json"));
  const clientEntry = fs.existsSync(path.join(clientRoot, "package.json"));
  const ready = rootPackages && serverModules && clientModules && serverEntry && clientEntry;
  return {
    ready,
    rootPackages,
    serverModules,
    clientModules,
    serverEntry,
    clientEntry,
  };
}

export function inspectInstallationState(projectRoot) {
  const paths = getSetupPaths(projectRoot);
  const deps = checkDependencies(projectRoot);
  const evidence = {
    installationLock: fs.existsSync(paths.lock),
    environmentFile: fs.existsSync(paths.env),
    applicationDatabase: anyExists(paths.quizDb, paths.quizDbWal, paths.quizDbShm, paths.quizDbJournal),
    sessionDatabase: anyExists(paths.sessionsDb, paths.sessionsDbWal, paths.sessionsDbShm, paths.sessionsDbJournal),
    deploymentConfig: fs.existsSync(paths.deploymentConfig),
    pendingInstallation: fs.existsSync(paths.pending),
    uploadedFiles: hasUploadedFiles(paths.uploadsRoot),
    dependenciesInstalled: deps.ready,
  };

  let state = "fresh";
  if (evidence.installationLock) state = "installed";
  else if (Object.entries(evidence).some(([key, present]) => key !== "dependenciesInstalled" && present)) state = "partial";

  return { state, evidence, dependencies: deps };
}

export function validateRuntime(nodeVersion, pnpmVersion) {
  const normalizedNode = String(nodeVersion || "").replace(/^v/i, "");
  const nodeMajor = Number(normalizedNode.split(".")[0]);
  const normalizedPnpm = String(pnpmVersion || "").trim();
  return {
    nodeVersion: normalizedNode || null,
    nodeSupported: SUPPORTED_NODE_MAJORS.includes(nodeMajor),
    supportedNodeMajors: [...SUPPORTED_NODE_MAJORS],
    pnpmVersion: normalizedPnpm || null,
    pnpmSupported: normalizedPnpm === REQUIRED_PNPM_VERSION,
    requiredPnpmVersion: REQUIRED_PNPM_VERSION,
  };
}

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function collectFiles(target, base = target) {
  if (!fs.existsSync(target)) return [];
  const stats = fs.statSync(target);
  if (stats.isFile()) return [{ absolute: target, relative: path.basename(target) }];
  const files = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const absolute = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolute, base));
    else if (entry.isFile()) files.push({ absolute, relative: path.relative(base, absolute) });
  }
  return files;
}

function backupItems(paths) {
  return [
    { source: paths.env, destination: path.join("server", ".env") },
    { source: paths.quizDb, destination: path.join("server", "data", "quiz.db") },
    { source: paths.quizDbWal, destination: path.join("server", "data", "quiz.db-wal") },
    { source: paths.quizDbShm, destination: path.join("server", "data", "quiz.db-shm") },
    { source: paths.quizDbJournal, destination: path.join("server", "data", "quiz.db-journal") },
    { source: paths.sessionsDb, destination: path.join("server", "data", "sessions.db") },
    { source: paths.sessionsDbWal, destination: path.join("server", "data", "sessions.db-wal") },
    { source: paths.sessionsDbShm, destination: path.join("server", "data", "sessions.db-shm") },
    { source: paths.sessionsDbJournal, destination: path.join("server", "data", "sessions.db-journal") },
    { source: paths.lock, destination: path.join("server", "data", "installation.lock") },
    { source: paths.pending, destination: path.join("server", "data", "installation.pending") },
    { source: paths.deploymentConfig, destination: path.join("server", "data", "deployment-config.json") },
    { source: paths.setupArtifacts, destination: path.join("server", "data", "setup-artifacts") },
    { source: paths.archiveBackupsRoot, destination: path.join("server", "data", "backups") },
    { source: paths.uploadsRoot, destination: path.join("server", "uploads") },
  ];
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function createVerifiedBackup(projectRoot, backupName = `reinstall-${timestamp()}`) {
  const paths = getSetupPaths(projectRoot);
  fs.mkdirSync(paths.backupsRoot, { recursive: true });
  const backupRoot = path.join(paths.backupsRoot, backupName);
  assertInside(paths.backupsRoot, backupRoot);
  if (fs.existsSync(backupRoot)) throw new Error("Aynı adlı temiz kurulum yedeği zaten mevcut.");
  fs.mkdirSync(backupRoot, { recursive: false, mode: 0o700 });

  const copied = [];
  try {
    for (const item of backupItems(paths)) {
      if (!fs.existsSync(item.source)) continue;
      assertInside(paths.projectRoot, item.source);
      const destination = path.join(backupRoot, item.destination);
      assertInside(backupRoot, destination);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.cpSync(item.source, destination, { recursive: true, errorOnExist: true });

      const sourceFiles = collectFiles(item.source);
      const destinationFiles = collectFiles(destination);
      if (sourceFiles.length !== destinationFiles.length) throw new Error(`Yedek dosya sayısı doğrulanamadı: ${item.destination}`);
      for (const sourceFile of sourceFiles) {
        const destinationFile = fs.statSync(item.source).isFile()
          ? destination
          : path.join(destination, sourceFile.relative);
        const sourceHash = hashFile(sourceFile.absolute);
        const destinationHash = hashFile(destinationFile);
        if (sourceHash !== destinationHash) throw new Error(`Yedek özeti eşleşmedi: ${item.destination}`);
        copied.push({
          source: path.relative(paths.projectRoot, sourceFile.absolute).replaceAll(path.sep, "/"),
          backup: path.relative(backupRoot, destinationFile).replaceAll(path.sep, "/"),
          bytes: fs.statSync(sourceFile.absolute).size,
          sha256: sourceHash,
        });
      }
    }

    const manifest = {
      createdAt: new Date().toISOString(),
      projectRoot: paths.projectRoot,
      reason: "QuizMaster temiz kurulum öncesi zorunlu yedek",
      files: copied,
    };
    fs.writeFileSync(path.join(backupRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    return { backupRoot, files: copied.length };
  } catch (error) {
    fs.rmSync(backupRoot, { recursive: true, force: true });
    throw error;
  }
}

function clearUploads(uploadsRoot) {
  if (!fs.existsSync(uploadsRoot)) return;
  for (const name of fs.readdirSync(uploadsRoot)) {
    if (name === ".gitkeep") continue;
    const target = path.join(uploadsRoot, name);
    assertInside(uploadsRoot, target);
    fs.rmSync(target, { recursive: true, force: true });
  }
}

export function resetInstallation(projectRoot, options = {}) {
  if (options.confirmation !== CLEAN_INSTALL_CONFIRMATION) {
    throw new Error("Temiz kurulum onay metni eşleşmiyor.");
  }
  if (options.backupAcknowledged !== true) {
    throw new Error("Zorunlu yedek onayı verilmedi.");
  }

  const current = inspectInstallationState(projectRoot);
  if (current.state === "fresh") throw new Error("Temizlenecek mevcut veya yarım kurulum bulunamadı.");
  const paths = getSetupPaths(projectRoot);
  if (fs.existsSync(paths.env)) {
    const match = fs.readFileSync(paths.env, "utf8").match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if (match && match[1].trim() !== "file:../data/quiz.db") {
      throw new Error("Otomatik temiz kurulum yalnız standart yerel SQLite veritabanında kullanılabilir. Harici/özel veritabanını kurum yöneticisi yedekleyip temizlemelidir.");
    }
  }
  const backup = createVerifiedBackup(projectRoot);

  const removable = [
    paths.env,
    paths.quizDb,
    paths.quizDbWal,
    paths.quizDbShm,
    paths.quizDbJournal,
    paths.sessionsDb,
    paths.sessionsDbWal,
    paths.sessionsDbShm,
    paths.sessionsDbJournal,
    paths.lock,
    paths.pending,
    paths.deploymentConfig,
    paths.deploymentConfigTemp,
    paths.setupArtifacts,
  ];
  for (const target of removable) {
    assertInside(paths.projectRoot, target);
    fs.rmSync(target, { recursive: true, force: true });
  }
  clearUploads(paths.uploadsRoot);
  return { ...backup, state: inspectInstallationState(projectRoot) };
}

export function readConfiguredPort(projectRoot) {
  const { env } = getSetupPaths(projectRoot);
  if (!fs.existsSync(env)) return 5000;
  const match = fs.readFileSync(env, "utf8").match(/^\s*PORT\s*=\s*["']?(\d+)["']?\s*$/m);
  const port = Number(match?.[1] || 5000);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 5000;
}

export function isLocalPortOpen(port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (value) => {
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

export function stopPortProcess(port) {
  const holder = findListeningProcess(port);
  if (!holder?.pid) {
    return { stopped: false, pid: null, message: `127.0.0.1:${port} için süreç bulunamadı.` };
  }
  if (holder.pid === process.pid) {
    return { stopped: false, pid: holder.pid, message: "Kendi kurulum başlatıcı sürecinizi durduramazsınız." };
  }
  let killed = false;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(holder.pid), "/F"], {
      encoding: "utf8",
      windowsHide: true,
      shell: false,
    });
    killed = result.status === 0;
  } else {
    const pid = holder.pid;
    try {
      process.kill(pid, "SIGTERM");
      killed = true;
      // SIGTERM yanıt vermezse SIGKILL
      setTimeout(() => {
        try {
          process.kill(pid, 0);
          process.kill(pid, "SIGKILL");
        } catch {
          /* zaten kapandı */
        }
      }, 800);
    } catch {
      try {
        process.kill(pid, "SIGKILL");
        killed = true;
      } catch {
        killed = false;
      }
    }
  }
  return {
    stopped: killed,
    pid: holder.pid,
    name: holder.name,
    message: killed
      ? `PID ${holder.pid} durduruldu.`
      : `PID ${holder.pid} durdurulamadı. Elle deneyin.`,
  };
}

function runCapture(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });
  return result.status === 0 ? String(result.stdout || "") : "";
}

export function findListeningProcess(port) {
  const wanted = Number(port);
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > 65535) return null;

  let pid = null;
  if (process.platform === "win32") {
    for (const line of runCapture("netstat", ["-ano", "-p", "TCP"]).split(/\r?\n/)) {
      const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
      if (match && Number(match[1]) === wanted) {
        pid = Number(match[2]);
        break;
      }
    }
  } else {
    const lsof = runCapture("lsof", ["-nP", `-iTCP:${wanted}`, "-sTCP:LISTEN", "-t"]);
    const first = lsof.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (first) pid = Number(first);
  }

  if (!Number.isInteger(pid) || pid <= 0) return null;

  let name = null;
  let commandLine = null;
  if (process.platform === "win32") {
    const tasklist = runCapture("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]);
    const csv = tasklist.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (csv) {
      const columns = csv.match(/"([^"]*)"/g)?.map((value) => value.slice(1, -1));
      if (columns?.[0]) name = columns[0];
    }
    const wmic = runCapture("wmic", ["process", "where", `ProcessId=${pid}`, "get", "CommandLine", "/value"]);
    const match = wmic.match(/CommandLine=(.+)/i);
    if (match?.[1]) commandLine = match[1].trim();
  } else {
    const ps = runCapture("ps", ["-p", String(pid), "-o", "comm=,args="]);
    const line = ps.split(/\r?\n/).map((value) => value.trim()).find(Boolean);
    if (line) {
      const [comm, ...rest] = line.split(/\s+/);
      name = comm || null;
      commandLine = rest.length ? line : null;
    }
  }

  return { pid, name, commandLine };
}

export function describePortConflict(port) {
  const holder = findListeningProcess(port);
  const lines = [
    `Kurulum başlangıç sunucusu açılamadı: 127.0.0.1:${port} portu zaten kullanımda.`,
    "",
    "Bu hata, önceki kurulum penceresi / kurulum.bat kapatıldığında arka planda",
    "kalan kurulum sürecinin portu bırakmamasından kaynaklanır.",
  ];
  if (holder) {
    lines.push(
      "",
      `Portu tutan süreç: PID ${holder.pid}${holder.name ? ` (${holder.name})` : ""}`,
    );
    if (holder.commandLine) lines.push(`Komut: ${holder.commandLine}`);
    if (process.platform === "win32") {
      lines.push(
        "",
        "Süreci durdurmak için yönetici olmayan bir terminalde:",
        `  taskkill /PID ${holder.pid} /F`,
      );
    } else {
      lines.push(
        "",
        "Süreci durdurmak için:",
        `  kill ${holder.pid}`,
      );
    }
  } else {
    lines.push(
      "",
      "Portu tutan süreç otomatik bulunamadı. Elle denetleyin:",
      process.platform === "win32"
        ? `  netstat -ano | findstr ":${port}"`
        : `  lsof -nP -iTCP:${port} -sTCP:LISTEN`,
    );
  }
  lines.push(
    "",
    "Yapılması gerekenler:",
    "  1. Hâlâ açık bir kurulum penceresi varsa onu kullanın veya kapatın.",
    "  2. Yukarıdaki komutla kalan kurulum sürecini durdurun.",
    "  3. kurulum.bat dosyasını yeniden çalıştırın.",
    "",
    "Not: Kurulum verileri bu hata nedeniyle değiştirilmez.",
  );
  return {
    port,
    holder,
    message: lines.join("\n"),
  };
}
