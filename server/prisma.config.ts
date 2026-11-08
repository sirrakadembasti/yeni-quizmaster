import { defineConfig } from "prisma/config";

// Prisma 7'de package.json#prisma kalkacak: yapılandırma bu dosyadadır.
// prisma.config.ts varken Prisma .env dosyasını kendisi yüklemez; önceki davranışı koruruz.
// process.loadEnvFile mevcut ortam değişkenlerini ezmez (kurulum sihirbazı DATABASE_URL'i ortamdan verir).
try {
  process.loadEnvFile(".env");
} catch {
  // .env yok: değişkenler ortamdan okunur.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
