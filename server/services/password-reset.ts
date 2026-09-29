import crypto from "crypto";
import type { User } from "@prisma/client";
import { storage } from "../storage";
import { sendResetPasswordEmail } from "../utils/email";

export const hashResetToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function issuePasswordReset(user: User, options: { requestedBy?: string | null; requestIp?: string | null } = {}) {
  await storage.cancelPendingPasswordResetRequests(user.id);
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await storage.updateUser(user.id, { resetToken: tokenHash, resetTokenExpiry: expiresAt });
  const request = await storage.createPasswordResetRequest({ userId: user.id, email: user.email, tokenHash, expiresAt, requestedBy: options.requestedBy, requestIp: options.requestIp });
  try {
    const queuedEmail = await sendResetPasswordEmail(user.email, token);
    return await storage.updatePasswordResetRequest(request.id, { emailQueueId: queuedEmail.id, status: "pending" });
  } catch (error) {
    await storage.updatePasswordResetRequest(request.id, { status: "failed" });
    throw error;
  }
}
