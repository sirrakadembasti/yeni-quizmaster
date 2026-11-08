import { randomBytes } from "crypto";
import { z } from "zod";
import { deploymentConfigSchema, normalizeBasePath, type DeploymentConfig } from "../utils/deployment-config";

const cleanText = (max: number, min = 1) => z.string().trim().min(min).max(max).refine(
  (value) => !/[\r\n\0]/.test(value),
  "Satır sonu veya kontrol karakteri kullanılamaz.",
);

const gmailAddress = z.string().trim().email().max(254).refine(
  (value) => /@gmail\.com$/i.test(value),
  "Yalnız Gmail adresi kullanılabilir.",
);

export const setupPayloadSchema = z.object({
  deployment: deploymentConfigSchema,
  server: z.object({
    host: z.enum(["127.0.0.1", "0.0.0.0"]),
    port: z.number().int().min(1024).max(65535),
  }),
  admin: z.object({
    name: cleanText(100, 2),
    email: z.string().trim().email().max(254),
    password: z.string().min(12).max(128)
      .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), "Parola büyük/küçük harf ve rakam içermelidir.")
      .refine((value) => !/quizmaster|password|123456|qwerty/i.test(value), "Kolay tahmin edilen parola kullanılamaz."),
  }),
  email: z.discriminatedUnion("enabled", [
    z.object({ enabled: z.literal(false) }),
    z.object({
      enabled: z.literal(true),
      user: gmailAddress,
      password: z.string().transform((value) => value.replace(/\s/g, "")).refine((value) => value.length >= 16 && value.length <= 128, "Geçerli Gmail uygulama parolası girin."),
      fromEmail: gmailAddress,
      fromName: cleanText(100),
    }),
  ]),
  buildClient: z.boolean().default(true),
  overwriteExistingEnv: z.boolean().default(false),
});

export type SetupPayload = z.infer<typeof setupPayloadSchema>;

function envValue(value: string | number) {
  return JSON.stringify(String(value));
}

export function createSessionSecret() {
  return randomBytes(64).toString("hex");
}

export function buildServerEnv(payload: SetupPayload, sessionSecret = createSessionSecret()) {
  const deployment = payload.deployment;
  const basePath = normalizeBasePath(deployment.basePath);
  const publicAppUrl = `${deployment.publicUrl}${basePath === "/" ? "" : basePath}`;
  const isLocal = deployment.mode === "localhost";
  // Yerelde geliştirme sunucusu: arayüz 5173, API 5000. Cookie secure olmamalı → NODE_ENV=development.
  const origins = isLocal
    ? Array.from(new Set([
        ...deployment.allowedOrigins,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        `http://localhost:${payload.server.port}`,
        `http://127.0.0.1:${payload.server.port}`,
      ]))
    : deployment.allowedOrigins;
  const frontendUrl = isLocal ? "http://127.0.0.1:5173" : deployment.publicUrl;
  const nodeEnv = isLocal ? "development" : "production";
  const lines = [
    "# QuizMaster kurulum sihirbazı tarafından oluşturuldu.",
    "# Gizli değerleri Git'e eklemeyin.",
    `DATABASE_URL=${envValue("file:../data/quiz.db")}`,
    `SESSION_SECRET=${envValue(sessionSecret)}`,
    `NODE_ENV=${nodeEnv}`,
    `HOST=${envValue(payload.server.host)}`,
    `PORT=${payload.server.port}`,
    `FRONTEND_URL=${envValue(frontendUrl)}`,
    `APP_BASE_PATH=${envValue(basePath)}`,
    `ALLOWED_ORIGINS=${envValue(origins.join(","))}`,
    `TRUST_PROXY_HOPS=${deployment.trustProxyHops}`,
    "ALLOW_RUNTIME_DEPLOYMENT_CHANGES=false",
    "EMAIL_PORT=587",
  ];

  if (payload.email.enabled) {
    lines.push(
      `EMAIL_USER=${envValue(payload.email.user)}`,
      `EMAIL_PASS=${envValue(payload.email.password)}`,
      `EMAIL_FROM=${envValue(payload.email.fromEmail)}`,
      `EMAIL_FROM_NAME=${envValue(payload.email.fromName)}`,
    );
  } else {
    lines.push("# Gmail gönderimi kurulum sırasında etkinleştirilmedi.");
  }

  lines.push(
    "EMAIL_CONNECTION_TIMEOUT=10000",
    "EMAIL_GREETING_TIMEOUT=10000",
    "EMAIL_SOCKET_TIMEOUT=20000",
    `# Uygulama adresi: ${publicAppUrl}`,
    "",
  );
  return lines.join("\n");
}

export function toDeploymentConfig(payload: SetupPayload): DeploymentConfig {
  return {
    ...payload.deployment,
    basePath: normalizeBasePath(payload.deployment.basePath),
  };
}

export function publicAppUrl(payload: SetupPayload) {
  const basePath = normalizeBasePath(payload.deployment.basePath);
  return `${payload.deployment.publicUrl}${basePath === "/" ? "" : basePath}`;
}
