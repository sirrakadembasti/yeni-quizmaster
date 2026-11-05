import { normalizeBasePath } from "./deployment-config";

export type DemoRoleKey = "demo-admin" | "demo-ogretmen" | "demo-ogrenci" | "demo-veli";

export interface DemoShowcaseAccount {
  key: DemoRoleKey;
  role: "admin" | "teacher" | "student" | "parent";
  label: string;
  name: string;
  email: string;
  password: string;
  description: string;
}

export const DEMO_SHOWCASE_PASSWORD = process.env.DEMO_SHOWCASE_PASSWORD || "demo123456";

export const DEMO_SHOWCASE_ACCOUNTS: readonly DemoShowcaseAccount[] = [
  {
    key: "demo-admin",
    role: "admin",
    label: "Demo Yönetici",
    name: "Demo Yönetici (Okul Müdürü)",
    email: "demo-admin@quizmaster.com",
    password: DEMO_SHOWCASE_PASSWORD,
    description: "Okul geneli sınıflar, öğretmenler, sınavlar, analizler, AI ve arşiv yönetimi ekranlarını inceleyin.",
  },
  {
    key: "demo-ogretmen",
    role: "teacher",
    label: "Demo Öğretmen",
    name: "Demo Öğretmen (Matematik Zümresi)",
    email: "demo-ogretmen@quizmaster.com",
    password: DEMO_SHOWCASE_PASSWORD,
    description: "Atanmış sınıflar, sınav oluşturma, sınıf istatistikleri, öğrenci analizleri ve anket sonuçlarını inceleyin.",
  },
  {
    key: "demo-ogrenci",
    role: "student",
    label: "Demo Öğrenci",
    name: "Demo Öğrenci (9-A Sınıfı)",
    email: "demo-ogrenci@quizmaster.com",
    password: DEMO_SHOWCASE_PASSWORD,
    description: "Öğrenci dashboard'u, atanmış sınavlar, tamamlanan sınav karneleri ve konu istatistiklerini inceleyin.",
  },
  {
    key: "demo-veli",
    role: "parent",
    label: "Demo Veli",
    name: "Demo Veli (Öğrenci Velisi)",
    email: "demo-veli@quizmaster.com",
    password: DEMO_SHOWCASE_PASSWORD,
    description: "Bağlı öğrencilerin başarı durumu, tamamlanan sınav sonuçları ve soru/cevap detaylarını inceleyin.",
  },
] as const;

const DEMO_EMAIL_SET = new Set(
  DEMO_SHOWCASE_ACCOUNTS.map((account) => account.email.toLowerCase()),
);

export const DEMO_READ_ONLY_CODE = "DEMO_MODE_READ_ONLY";
export const DEMO_READ_ONLY_MESSAGE =
  "Demo modundasınız: Bu işlem örnek amaçlıdır, veritabanında değişiklik yapılmaz.";

export function isDemoInstanceEnabled(): boolean {
  if (process.env.APP_DEMO_MODE === "true" || process.env.APP_DEMO_MODE === "1") {
    return true;
  }
  try {
    return normalizeBasePath(process.env.APP_BASE_PATH) === "/demo";
  } catch {
    return false;
  }
}

export function isDemoShowcaseEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEMO_EMAIL_SET.has(String(email).trim().toLowerCase());
}

export function findDemoShowcaseAccount(keyOrEmail: string | null | undefined): DemoShowcaseAccount | undefined {
  if (!keyOrEmail) return undefined;
  const normalized = String(keyOrEmail).trim().toLowerCase();
  return DEMO_SHOWCASE_ACCOUNTS.find(
    (account) => account.key === normalized || account.email.toLowerCase() === normalized,
  );
}

export function getSessionCookieName(): string {
  return isDemoInstanceEnabled() ? "quizmaster.demo.sid" : "quizmaster.sid";
}
