import nodemailer from "nodemailer";
import { storage } from "../storage";
import { logger } from "./logger";
import { getPublicAppUrl } from "./deployment-config";

// Yalnızca Gmail SMTP kullanılır. EMAIL_HOST/PORT/SECURE gibi alternatif SMTP
// değişkenleri bilinçli olarak yok sayılır; böylece yanlışlıkla başka bir sunucuya
// kimlik bilgisi gönderilemez.
export function getEmailConfiguration() {
  const user = process.env.EMAIL_USER?.trim() || "";
  const password = process.env.EMAIL_PASS || "";
  const fromEmail = process.env.EMAIL_FROM?.trim() || user;
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || "QuizMaster";
  const requestedPort = Number.parseInt(process.env.EMAIL_PORT || "587", 10);
  const port = requestedPort === 465 ? 465 : 587;

  return {
    host: "smtp.gmail.com",
    port,
    secure: port === 465,
    user,
    password,
    fromEmail,
    fromName,
    authConfigured: Boolean(user && password),
  };
}

let transporter: nodemailer.Transporter | null = null;
let transporterKey = "";

function getTransporter() {
  const config = getEmailConfiguration();
  const nextKey = [config.host, config.port, config.secure, config.user, config.password].join("|");
  if (!transporter || transporterKey !== nextKey) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: Number.parseInt(process.env.EMAIL_CONNECTION_TIMEOUT || "10000", 10),
      greetingTimeout: Number.parseInt(process.env.EMAIL_GREETING_TIMEOUT || "10000", 10),
      socketTimeout: Number.parseInt(process.env.EMAIL_SOCKET_TIMEOUT || "20000", 10),
    });
    transporterKey = nextKey;
  }
  return transporter;
}

export const getEmailStatus = () => {
  const config = getEmailConfiguration();
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    authConfigured: config.authConfigured,
    provider: "gmail",
  };
};

export const verifyEmailTransport = async () => {
  const config = getEmailConfiguration();
  if (!config.authConfigured) throw Object.assign(new Error("Gmail kullanıcı adı veya uygulama parolası eksik."), { code: "GMAIL_NOT_CONFIGURED" });
  await getTransporter().verify();
  return getEmailStatus();
};

/** Direct email sender (underlying SMTP call). */
export const sendDirectEmail = async (options: nodemailer.SendMailOptions) => {
  const config = getEmailConfiguration();
  const from = options.from || `"${config.fromName.replace(/[\r\n"]/g, "")}" <${config.fromEmail}>`;
  return getTransporter().sendMail({ ...options, from });
};
/**
 * Queue an email in database for asynchronous Outbox delivery
 */
export const queueEmail = async (params: {
  to: string;
  subject: string;
  body: string;
  type?: string;
  maxAttempts?: number;
}) => {
  const queued = await storage.enqueueEmail(params);
  // Trigger immediate non-blocking processing
  setImmediate(() => {
    processEmailQueue().catch((err) => {
      logger.error({ err }, "[EmailQueue] Error in background dispatch");
    });
  });
  return queued;
};

let isProcessing = false;

/**
 * Process pending emails in the queue
 */
export const processEmailQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pendingEmails = await storage.getPendingEmails(10);
    for (const email of pendingEmails) {
      try {
        await sendDirectEmail({
          to: email.to,
          subject: email.subject,
          html: email.body,
        });

        await storage.updateEmailStatus(email.id, "sent", null);
        logger.info({ emailId: email.id, to: email.to }, "[EmailQueue] Successfully sent email");
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        const newAttempts = email.attempts + 1;
        const newStatus = newAttempts >= email.maxAttempts ? "failed" : "pending";

        await storage.updateEmailStatus(email.id, newStatus, errorMsg);
        logger.warn(
          { emailId: email.id, to: email.to, attempt: newAttempts, error: errorMsg },
          `[EmailQueue] Failed to send email (attempt ${newAttempts}/${email.maxAttempts})`
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "[EmailQueue] Critical error in queue processing");
  } finally {
    isProcessing = false;
  }
};

let workerTimer: NodeJS.Timeout | null = null;

/**
 * Start recurring background worker for email queue
 */
export const startEmailWorker = (intervalMs = 5000) => {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    processEmailQueue().catch((err) => {
      logger.error({ err }, "[EmailWorker] Error during queue check");
    });
  }, intervalMs);
  logger.info("[EmailWorker] Background email worker started (interval: %dms)", intervalMs);
};

export const stopEmailWorker = () => {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
};

/**
 * Send reset password email via Outbox queue
 */
export const sendResetPasswordEmail = async (email: string, token: string) => {
  const resetUrl = `${getPublicAppUrl()}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800;">QuizMaster</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Sınav ve Değerlendirme Sistemi</p>
      </div>
      <div style="padding: 20px; background-color: #f8fafc; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 18px;">Şifre Sıfırlama Talebi</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Hesabınız için bir şifre sıfırlama talebinde bulunuldu. Şifrenizi belirlemek için lütfen aşağıdaki butona tıklayın:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
            Şifremi Sıfırla
          </a>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
          Eğer bu talebi siz yapmadıysanız, bu e-postayı güvenle göz ardı edebilirsiniz. Mevcut şifreniz değişmeyecektir.
        </p>
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        Bu bağlantı <strong>1 saat</strong> süreyle geçerlidir.<br>
        Buton çalışmıyorsa aşağıdaki bağlantıyı tarayıcınıza kopyalayın:<br>
        <a href="${resetUrl}" style="color: #4f46e5; word-break: break-all;">${resetUrl}</a>
      </p>
    </div>
  `;

  return queueEmail({
    to: email,
    subject: "QuizMaster - Şifre Sıfırlama İsteği",
    body: html,
    type: "password_reset",
  });
};

// Backwards compatibility alias
export const sendEmail = sendDirectEmail;
