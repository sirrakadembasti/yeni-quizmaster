import { toast } from "sonner";

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

export const DEMO_READ_ONLY_CODE = "DEMO_MODE_READ_ONLY";
export const DEMO_READ_ONLY_MESSAGE =
  "Demo modundasınız: Bu işlem örnek amaçlıdır, veritabanında değişiklik yapılmaz.";

export const DEFAULT_DEMO_SHOWCASE_ACCOUNTS: readonly DemoShowcaseAccount[] = [
  {
    key: "demo-admin",
    role: "admin",
    label: "Demo Yönetici",
    name: "Demo Yönetici (Okul Müdürü)",
    email: "demo-admin@quizmaster.com",
    password: "demo123456",
    description: "Okul geneli sınıflar, öğretmenler, sınavlar, analizler, AI ve arşiv yönetimi ekranlarını inceleyin.",
  },
  {
    key: "demo-ogretmen",
    role: "teacher",
    label: "Demo Öğretmen",
    name: "Demo Öğretmen (Matematik Zümresi)",
    email: "demo-ogretmen@quizmaster.com",
    password: "demo123456",
    description: "Atanmış sınıflar, sınav oluşturma, sınıf istatistikleri, öğrenci analizleri ve anket sonuçlarını inceleyin.",
  },
  {
    key: "demo-ogrenci",
    role: "student",
    label: "Demo Öğrenci",
    name: "Demo Öğrenci (9-A Sınıfı)",
    email: "demo-ogrenci@quizmaster.com",
    password: "demo123456",
    description: "Öğrenci dashboard'u, atanmış sınavlar, tamamlanan sınav karneleri ve konu istatistiklerini inceleyin.",
  },
  {
    key: "demo-veli",
    role: "parent",
    label: "Demo Veli",
    name: "Demo Veli (Öğrenci Velisi)",
    email: "demo-veli@quizmaster.com",
    password: "demo123456",
    description: "Bağlı öğrencilerin başarı durumu, tamamlanan sınav sonuçları ve soru/cevap detaylarını inceleyin.",
  },
] as const;

declare global {
  interface Window {
    __APP_BASE_PATH__?: string;
    __APP_DEMO_MODE__?: boolean;
  }
}

export function getAppBasePath(): string {
  if (typeof window !== "undefined" && typeof window.__APP_BASE_PATH__ === "string") {
    return window.__APP_BASE_PATH__.replace(/\/$/, "");
  }
  const envBase = import.meta.env.BASE_URL || "/";
  return envBase === "/" ? "" : envBase.replace(/\/$/, "");
}

export function withAppBasePath(url: string): string {
  const basePath = getAppBasePath();
  if (!basePath) return url;
  if (url.startsWith(`${basePath}/`)) return url;
  if (url === "/api" || url.startsWith("/api/") || url.startsWith("/uploads/")) {
    return `${basePath}${url}`;
  }
  return url;
}

export function isClientDemoMode(): boolean {
  if (typeof window !== "undefined" && window.__APP_DEMO_MODE__ === true) {
    return true;
  }
  return getAppBasePath() === "/demo";
}

export function isDemoShowcaseUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return DEFAULT_DEMO_SHOWCASE_ACCOUNTS.some((item) => item.email.toLowerCase() === normalized);
}

let lastToastTimestamp = 0;

export function notifyDemoReadOnly(message?: string): void {
  const now = Date.now();
  if (now - lastToastTimestamp < 800) return;
  lastToastTimestamp = now;
  toast.info("Demo Modu (Salt Okunur)", {
    description: message || DEMO_READ_ONLY_MESSAGE,
  });
}
