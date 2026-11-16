import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7'de package.json#prisma kalkacak: yapılandırma bu dosyadadır.
// prisma.config.ts varken Prisma .env dosyasını kendisi yüklemez; önceki davranışı koruruz.
// process.loadEnvFile mevcut ortam değişkenlerini ezmez (kurulum sihirbazı DATABASE_URL'i ortamdan verir).
try {
  process.loadEnvFile(".env");
} catch {
  // .env yok: değişkenler ortamdan okunur.
}

// Prisma 6'da göreli `file:` yolları schema.prisma'nın dizinine (server/prisma) göreliydi; Prisma 7 bunları
// yapılandırma dosyasının dizinine (server) göreli çözer. Çalışma zamanı (utils/sqlite-runtime-config.ts) ve
// mevcut kurulumların .env dosyaları (`file:../data/quiz.db`) eski kuralı kullanır: migration yanlış dosyayı
// yaratmasın diye yol burada eski kurala göre mutlak hâle getirilir.
function resolveDatabaseUrl(url: string): string {
  if (!url.startsWith("file:")) return url;
  const [target, ...query] = url.slice(5).split("?");
  if (!target || target === ":memory:" || path.isAbsolute(target)) return url;
  const absolute = path.resolve(__dirname, "prisma", target).split(path.sep).join("/");
  return `file:${absolute}${query.length ? `?${query.join("?")}` : ""}`;
}

// Veritabanı gerektirmeyen komutlar (generate: temiz kurulumdaki postinstall) DATABASE_URL olmadan da çalışır.
// Diğer her komutta (migrate, db ...) eksik değişken sessizce varsayılan bir dosya yaratmasın diye hata verilir.
const withoutDatabase = ["generate", "validate", "format", "version", "--version", "-v", "--help", "-h"];
function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return resolveDatabaseUrl(url);
  if (process.argv.slice(2).some((argument) => withoutDatabase.includes(argument))) return "file:./unused-without-database.db";
  throw new Error("DATABASE_URL tanımlı değil (server/.env dosyasını veya ortam değişkenini kontrol edin).");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: databaseUrl() },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
