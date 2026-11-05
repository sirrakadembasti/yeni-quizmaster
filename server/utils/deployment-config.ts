import fs from "fs";
import path from "path";
import { z } from "zod";
import { getProjectRoot } from "./project-paths";

const retentionSchema = z.object({
  enabled: z.boolean().default(false),
  actionLogDays: z.number().int().min(30).max(3650).default(365),
  readNotificationDays: z.number().int().min(7).max(3650).default(180),
  emailLogDays: z.number().int().min(7).max(3650).default(90),
  passwordResetDays: z.number().int().min(7).max(3650).default(90),
});

const originSchema = z.string().url().refine((value) => {
  let parsed: URL;
  try { parsed = new URL(value); } catch { return false; }
  const normalized = value.replace(/\/$/, "");
  return !parsed.username
    && !parsed.password
    && !parsed.search
    && !parsed.hash
    && parsed.pathname === "/"
    && normalized === parsed.origin;
}, "Yalnız şema ve domain içeren bir origin girin (ör. https://sinav.kurum.gov.tr)." )
  .transform((value) => value.replace(/\/$/, ""));

export const deploymentConfigSchema = z.object({
  mode: z.enum(["localhost", "subdomain", "subpath"]).default("subdomain"),
  publicUrl: originSchema,
  basePath: z.string().max(80).default("/"),
  allowedOrigins: z.array(originSchema).min(1).max(10),
  trustProxyHops: z.number().int().min(0).max(5).default(1),
  retention: retentionSchema.default({
    enabled: false,
    actionLogDays: 365,
    readNotificationDays: 180,
    emailLogDays: 90,
    passwordResetDays: 90,
  }),
  updatedAt: z.string().datetime().optional(),
  updatedBy: z.string().optional(),
}).superRefine((value, context) => {
  let basePath: string;
  try {
    basePath = normalizeBasePath(value.basePath);
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["basePath"],
      message: error instanceof Error ? error.message : "Alt yol geçersiz.",
    });
    return;
  }
  if (value.mode === "localhost" && basePath !== "/") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["basePath"], message: "Yerel kurulumda alt yol / olmalıdır." });
  }
  if (value.mode === "subdomain" && basePath !== "/") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["basePath"], message: "Subdomain kurulumunda alt yol / olmalıdır." });
  }
  if (value.mode === "subpath" && basePath === "/") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["basePath"], message: "Alt yol kurulumunda /quizmaster gibi bir yol gereklidir." });
  }
  if (value.mode === "localhost") {
    let host: string;
    try { host = new URL(value.publicUrl).hostname; } catch { return; }
    if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publicUrl"],
        message: "Yerel kurulumda adres localhost veya 127.0.0.1 olmalıdır (ör. http://localhost:5000).",
      });
    }
  }
});

export type DeploymentConfig = z.infer<typeof deploymentConfigSchema>;

const defaultRetention: DeploymentConfig["retention"] = {
  enabled: false,
  actionLogDays: 365,
  readNotificationDays: 180,
  emailLogDays: 90,
  passwordResetDays: 90,
};

export const deploymentConfigPath = path.join(
  getProjectRoot(),
  "server",
  "data",
  "deployment-config.json",
);

export function normalizeBasePath(value: string | undefined): string {
  const trimmed = (value || "/").trim();
  if (!trimmed || trimmed === "/") return "/";
  const normalized = `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
  if (!/^\/[a-zA-Z0-9/_-]+$/.test(normalized) || normalized.includes("//")) {
    throw new Error("Alt yol yalnız harf, rakam, tire, alt çizgi ve / içerebilir.");
  }
  return normalized;
}

function envOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function loadSavedDeploymentConfig(): DeploymentConfig | null {
  try {
    if (!fs.existsSync(deploymentConfigPath)) return null;
    const parsed = deploymentConfigSchema.parse(
      JSON.parse(fs.readFileSync(deploymentConfigPath, "utf8")),
    );
    return { ...parsed, basePath: normalizeBasePath(parsed.basePath) };
  } catch (error) {
    throw new Error(`Sunucu yapılandırması okunamadı: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function getEffectiveDeploymentConfig(): DeploymentConfig {
  const hasExplicitEnvBasePath = Boolean(process.env.APP_BASE_PATH && process.env.APP_BASE_PATH.trim());
  const isDemoModeEnv = process.env.APP_DEMO_MODE === "true" || process.env.APP_DEMO_MODE === "1";
  const saved = loadSavedDeploymentConfig();
  if (saved && !hasExplicitEnvBasePath && !isDemoModeEnv) return saved;

  const publicUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  const envBasePath = normalizeBasePath(process.env.APP_BASE_PATH);
  const isLocalHost = /^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/i.test(publicUrl);
  return {
    mode: isLocalHost && envBasePath === "/" ? "localhost" : envBasePath === "/" ? "subdomain" : "subpath",
    publicUrl,
    basePath: envBasePath,
    allowedOrigins: envOrigins(),
    trustProxyHops: Math.min(5, Math.max(0, Number(process.env.TRUST_PROXY_HOPS) || (isLocalHost ? 0 : 1))),
    retention: defaultRetention,
  };
}

export function saveDeploymentConfig(
  input: unknown,
  updatedBy: string,
): DeploymentConfig {
  const parsed = deploymentConfigSchema.parse(input);
  const config: DeploymentConfig = {
    ...parsed,
    publicUrl: parsed.publicUrl.replace(/\/$/, ""),
    basePath: normalizeBasePath(parsed.basePath),
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  fs.mkdirSync(path.dirname(deploymentConfigPath), { recursive: true });
  const temporaryPath = `${deploymentConfigPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, deploymentConfigPath);
  return config;
}

export function getPublicAppUrl(): string {
  const config = getEffectiveDeploymentConfig();
  return `${config.publicUrl}${config.basePath === "/" ? "" : config.basePath}`;
}

export function buildDeploymentArtifacts(config: DeploymentConfig) {
  const url = new URL(config.publicUrl);
  const basePath = normalizeBasePath(config.basePath);
  const basePathWithSlash = basePath === "/" ? "/" : `${basePath}/`;
  const envText = [
    "NODE_ENV=production",
    "PORT=5000",
    `FRONTEND_URL=${config.publicUrl}`,
    `APP_BASE_PATH=${basePath}`,
    `ALLOWED_ORIGINS=${config.allowedOrigins.join(",")}`,
    `TRUST_PROXY_HOPS=${config.trustProxyHops}`,
    "DATABASE_URL=file:../data/quiz.db",
    "SESSION_SECRET=<SECRET_MANAGER_ILE_GUCLU_DEGER>",
    "EMAIL_USER=<GMAIL_ADRESI>",
    "EMAIL_PASS=<GOOGLE_UYGULAMA_PAROLASI>",
    "EMAIL_FROM=<GMAIL_ADRESI>",
    "EMAIL_FROM_NAME=QuizMaster",
  ].join("\n");

  const proxyHeaders = [
    "proxy_http_version 1.1;",
    "proxy_set_header Host $host;",
    "proxy_set_header X-Real-IP $remote_addr;",
    "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    "proxy_set_header X-Forwarded-Proto $scheme;",
    "proxy_set_header Upgrade $http_upgrade;",
    "proxy_set_header Connection \"upgrade\";",
  ].map((line) => `        ${line}`).join("\n");

  const nginxText = config.mode === "localhost"
    ? `# Yerel (localhost) kurulum: reverse proxy gerekmez.\n# Uygulama doğrudan http://${url.hostname}:${process.env.PORT || 5000} üzerinden açılır.\n# Üretime çıkarken subdomain veya subpath profilini kullanın.`
    : config.mode === "subdomain"
    ? `server {\n    listen 443 ssl http2;\n    server_name ${url.hostname};\n\n    location / {\n        proxy_pass http://127.0.0.1:5000;\n${proxyHeaders}\n    }\n}`
    : `# Ana kurum sunucusundaki mevcut server bloğuna ekleyin.\nlocation = ${basePath} { return 301 ${basePathWithSlash}; }\nlocation ${basePathWithSlash} {\n    proxy_pass http://127.0.0.1:5000${basePathWithSlash};\n${proxyHeaders}\n}\n# İstemcinin kullandığı servis yolları; kurum sitesinde çakışmadığını doğrulayın.\nlocation /api/ { proxy_pass http://127.0.0.1:5000/api/; ${proxyHeaders.replace(/\n/g, " ")} }\nlocation /uploads/ { proxy_pass http://127.0.0.1:5000/uploads/; }\nlocation /socket.io/ { proxy_pass http://127.0.0.1:5000/socket.io/; ${proxyHeaders.replace(/\n/g, " ")} }`;

  return {
    envText,
    nginxText,
    buildCommand: basePath === "/"
      ? "pnpm build"
      : `$env:VITE_BASE_PATH=\"${basePathWithSlash}\"; pnpm build`,
    restartRequired: true,
  };
}
