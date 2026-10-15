import "dotenv/config";
import bcrypt from "bcryptjs";
import { createRuntimePrismaClient } from "../utils/sqlite-runtime";

const prisma = createRuntimePrismaClient();

async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Sistem Yöneticisi";
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || "";
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL geçerli bir e-posta olmalıdır.");
  }
  if (password.length < 12 || /quizmaster|password|123456/i.test(password)) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD en az 12 karakter ve tahmin edilmesi zor olmalıdır.");
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  if (existingAdmin) {
    throw new Error("Sistemde zaten bir yönetici var. Bootstrap komutu yeniden çalıştırılmadı.");
  }
  const existingEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingEmail) {
    throw new Error("Bu e-posta başka bir kullanıcıya ait. Rol yükseltme web yönetiminden yapılmalıdır.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      role: "admin",
      emailVerified: true,
    },
  });
  console.log(`İlk yönetici oluşturuldu: ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
