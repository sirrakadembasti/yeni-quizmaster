// Kurulum adımlarının durumunu `installation.state.json` dosyasında tutar.
// Dosya atomik yazılır (geçici dosya + rename); yarıda kesilen kurulumun hangi
// adımda kaldığı bu dosyadan okunabilir. Gizli bilgi (parola, anahtar) yazılmaz.
import fs from "node:fs";
import path from "node:path";

export type InstallStepStatus = "pending" | "running" | "done" | "error" | "skipped";

export type InstallState = {
  version: 1;
  startedAt: string;
  updatedAt: string;
  steps: Record<string, { status: InstallStepStatus; detail?: string; at: string }>;
  lastError: string | null;
};

export const STATE_FILE_NAME = "installation.state.json";

export function createInstallState(stepIds: readonly string[], now = new Date()): InstallState {
  const at = now.toISOString();
  return {
    version: 1,
    startedAt: at,
    updatedAt: at,
    steps: Object.fromEntries(stepIds.map((id) => [id, { status: "pending" as const, at }])),
    lastError: null,
  };
}

export function readInstallState(file: string): InstallState | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed?.version !== 1 || typeof parsed.steps !== "object" || parsed.steps === null) return null;
    return parsed as InstallState;
  } catch {
    return null;
  }
}

export function writeInstallState(file: string, state: InstallState): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, file);
}

export function recordStep(
  file: string,
  state: InstallState,
  id: string,
  status: InstallStepStatus,
  detail?: string,
  now = new Date(),
): void {
  const at = now.toISOString();
  state.steps[id] = { status, at, ...(detail ? { detail } : {}) };
  state.updatedAt = at;
  if (status === "error") state.lastError = detail ?? `${id} adımı başarısız oldu.`;
  writeInstallState(file, state);
}

/** Başarısız (veya yarıda kalmış) ilk adımın kimliği; yoksa null. */
export function firstUnfinishedStep(state: InstallState, order: readonly string[]): string | null {
  for (const id of order) {
    const status = state.steps[id]?.status ?? "pending";
    if (status !== "done" && status !== "skipped") return id;
  }
  return null;
}
