import "dotenv/config";
import bcrypt from "bcryptjs";
import { storage, closeStorage } from "../storage";
import { issueOfflinePasswordReset } from "../services/password-reset";

async function main() {
  const emailArgIndex = process.argv.indexOf("--email");
  const emailFromArg = emailArgIndex !== -1 ? process.argv[emailArgIndex + 1] : undefined;
  const targetEmail = (emailFromArg || process.env.RESET_ADMIN_EMAIL || "").trim().toLowerCase();
  const newPassword = process.env.RESET_ADMIN_PASSWORD || "";

  let adminUser = targetEmail ? await storage.getUserByEmail(targetEmail) : undefined;
  if (!adminUser && !targetEmail) {
    const allUsers = await storage.getAllUsers();
    const admins = allUsers.filter((u) => u.role === "admin");
    if (admins.length === 0) {
      throw new Error("Sistemde yönetici (admin) hesabı bulunamadı.");
    }
    if (admins.length > 1) {
      throw new Error(
        `Sistemde birden fazla yönetici var (${admins.map((a) => a.email).join(", ")}). Lütfen RESET_ADMIN_EMAIL veya --email <adres> belirtin.`
      );
    }
    adminUser = admins[0];
  }

  if (!adminUser) {
    throw new Error(`Kullanıcı bulunamadı: ${targetEmail}`);
  }
  if (adminUser.role !== "admin") {
    throw new Error(`Belirtilen hesap yönetici (admin) rolünde değil: ${adminUser.email} (${adminUser.role})`);
  }

  if (newPassword) {
    if (newPassword.length < 6) {
      throw new Error("RESET_ADMIN_PASSWORD en az 6 karakter olmalıdır.");
    }
    await storage.cancelPendingPasswordResetRequests(adminUser.id);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await storage.updateUser(adminUser.id, {
      password: passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    });
    await storage.createLog(adminUser.id, "CLI_PASSWORD_RESET", "Admin password updated directly via CLI");
    console.log(`Yönetici şifresi doğrudan güncellendi: ${adminUser.email}`);
    return;
  }

  const { resetUrl, expiresAt } = await issueOfflinePasswordReset(adminUser, {
    requestedBy: "cli",
    requestIp: "127.0.0.1",
  });
  await storage.createLog(adminUser.id, "CLI_PASSWORD_RESET_LINK", "Offline password reset link generated via CLI");
  console.log(`Yönetici hesabı: ${adminUser.email}`);
  console.log(`Son geçerlilik : ${expiresAt.toLocaleString("tr-TR")}`);
  console.log(`Sıfırlama linki: ${resetUrl}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeStorage();
  });
