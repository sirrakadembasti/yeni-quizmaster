// Arayüzsüz kurulum: SSH, CI ve otomatik testler için.
//   pnpm run setup:cli -- --yes                  (yerel kurulum, varsayılanlar)
//   pnpm run setup:cli -- --config kurulum.json  (tam SetupPayload JSON'u)
// Yönetici parolası komut satırına yazılmaz: QUIZMASTER_ADMIN_PASSWORD ortam değişkeni
// kullanılır; verilmezse rastgele üretilip bir kez ekrana yazılır.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupPayloadSchema, type SetupPayload } from "./config";
import { applySetup, createApplyState } from "./server";

type Parsed = { yes: boolean; mode: "local" | "server"; config?: string; help: boolean };

export function parseArgs(argv: string[]): Parsed {
  const parsed: Parsed = { yes: false, mode: "local", help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    else if (arg === "--yes" || arg === "-y") parsed.yes = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--mode") {
      const value = argv[++i];
      if (value !== "local" && value !== "server") throw new Error("--mode yalnız 'local' veya 'server' olabilir.");
      parsed.mode = value;
    } else if (arg === "--config") {
      const value = argv[++i];
      if (!value) throw new Error("--config bir dosya yolu bekler.");
      parsed.config = value;
    } else throw new Error(`Bilinmeyen seçenek: ${arg}`);
  }
  return parsed;
}

export function generateAdminPassword() {
  // Şemadaki kuralları (büyük/küçük harf + rakam, ≥12) her zaman sağlar.
  return `Qm${crypto.randomBytes(12).toString("base64url")}9a`;
}

export function buildLocalPayload(env: NodeJS.ProcessEnv): { payload: SetupPayload; generatedPassword: string | null } {
  const generatedPassword = env.QUIZMASTER_ADMIN_PASSWORD ? null : generateAdminPassword();
  const port = Number(env.QUIZMASTER_PORT) || 5000;
  const payload = setupPayloadSchema.parse({
    deployment: {
      mode: "localhost",
      publicUrl: "http://127.0.0.1:5173",
      basePath: "/",
      allowedOrigins: ["http://127.0.0.1:5173", "http://localhost:5173"],
      trustProxyHops: 0,
    },
    server: { host: "127.0.0.1", port },
    admin: {
      name: env.QUIZMASTER_ADMIN_NAME || "Yönetici",
      email: env.QUIZMASTER_ADMIN_EMAIL || "admin@example.com",
      password: env.QUIZMASTER_ADMIN_PASSWORD || generatedPassword,
    },
    email: { enabled: false },
    buildClient: false,
    overwriteExistingEnv: env.QUIZMASTER_OVERWRITE_ENV === "1",
  });
  return { payload, generatedPassword };
}

const HELP = `QuizMaster arayüzsüz kurulum

Kullanım: pnpm run setup:cli -- --yes [--mode local] | --config dosya.json

  --yes, -y        Soru sormadan kur (zorunlu; yanlışlıkla çalıştırmayı önler)
  --mode local     Varsayılan. Yerel geliştirme kurulumu, derleme yok.
  --config <dosya> Tam kurulum yükü (JSON). Sunucu kurulumu için bunu kullanın.

Ortam değişkenleri (yerel mod): QUIZMASTER_ADMIN_EMAIL, QUIZMASTER_ADMIN_NAME,
QUIZMASTER_ADMIN_PASSWORD, QUIZMASTER_PORT, QUIZMASTER_OVERWRITE_ENV=1
`;

export async function runCli(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  let args: Parsed;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(HELP);
    return 2;
  }
  if (args.help) { console.log(HELP); return 0; }
  if (!args.yes) {
    console.error("Sorusuz kurulum için --yes gereklidir (ayrıntı: --help).");
    return 2;
  }
  if (args.mode === "server" && !args.config) {
    console.error("Sunucu kurulumu için --config <dosya.json> gereklidir.");
    return 2;
  }

  let payload: SetupPayload;
  let generatedPassword: string | null = null;
  try {
    if (args.config) {
      payload = setupPayloadSchema.parse(JSON.parse(fs.readFileSync(path.resolve(args.config), "utf8")));
    } else {
      ({ payload, generatedPassword } = buildLocalPayload(env));
    }
  } catch (error) {
    console.error(`Kurulum yapılandırması geçersiz: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  const job = createApplyState();
  let printed = 0;
  const report = setInterval(() => {
    for (const step of job.steps) {
      if (step.status === "pending" || step.status === "running") continue;
      const index = job.steps.indexOf(step);
      if (index < printed) continue;
      console.log(`[${step.status}] ${step.label}${step.detail ? ` — ${step.detail}` : ""}`);
      printed = index + 1;
    }
  }, 200);
  try {
    const summary = await applySetup(payload, job);
    clearInterval(report);
    for (const step of job.steps.slice(printed)) console.log(`[${step.status}] ${step.label}${step.detail ? ` — ${step.detail}` : ""}`);
    summary.forEach((line) => console.log(`✓ ${line}`));
    console.log(`Yönetici: ${payload.admin.email}`);
    if (generatedPassword) console.log(`Üretilen yönetici parolası (bir kez gösterilir, kaydedin): ${generatedPassword}`);
    return 0;
  } catch (error) {
    clearInterval(report);
    for (const step of job.steps.slice(printed)) {
      if (step.status !== "pending") console.log(`[${step.status}] ${step.label}${step.detail ? ` — ${step.detail}` : ""}`);
    }
    console.error(`Kurulum başarısız: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Ayrıntı: server/data/installation.state.json. Sorunu giderip komutu yeniden çalıştırabilirsiniz.");
    return 1;
  }
}

if (import.meta.url && process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runCli(process.argv.slice(2)).then((code) => process.exit(code));
}
