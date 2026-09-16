import nodemailer from "nodemailer";

// Configure email transporter
// In production, these should come from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.EMAIL_PORT || "587", 10),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER || "test@example.com",
    pass: process.env.EMAIL_PASS || "password",
  },
});

/**
 * [YEREL GELİŞTİRME NOTU]
 * Sunucu her başladığında SMTP bağlantısını doğrulamak için aşağıdaki satırları kullanabilirsiniz.
 * Eğer .env dosyasında geçerli bir SMTP bilgileriniz yoksa hata almamak için kapalı tutulmuştur.
 * Gerçek bir e-posta gönderimi yapacaksanız bu bloğu aktifleştirin.
 */
/*
transporter.verify((error) => {
  if (error) {
    console.error("[Email] Transporter connection error:", error.message);
  } else {
    console.log("[Email] Server is ready to take our messages");
  }
});
*/

/**
 * Generic email sender
 */
export const sendEmail = async (options: nodemailer.SendMailOptions) => {
  try {
    const info = await transporter.sendMail({
      from: `"QuizMaster Support" <${process.env.EMAIL_FROM || "noreply@quizmaster.com"}>`,
      ...options,
    });
    console.log("[Email] Sent: %s", info.messageId);
    return info;
  } catch (error) {
    // Yerel geliştirme sırasında SMTP hatası alınırsa sunucunun çökmemesi için hata loglanır
    console.error("[Email] Error sending email (Check SMTP settings):", error instanceof Error ? error.message : error);
    throw error;
  }
};

/**
 * Send reset password email
 */
export const sendResetPasswordEmail = async (email: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${token}`;

  return sendEmail({
    to: email,
    subject: "Şifre Sıfırlama İsteği",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Şifre Sıfırlama</h2>
        <p>Hesabınız için bir şifre sıfırlama talebinde bulundunuz.</p>
        <p>Şifrenizi sıfırlamak için lütfen aşağıdaki butona tıklayın:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Şifremi Sıfırla</a>
        </div>
        <p>Eğer bu talebi siz yapmadıysanız, bu e-postayı dikkate almayabilirsiniz. Şifreniz değişmeyecektir.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777;">Bu bağlantı 1 saat boyunca geçerlidir.</p>
        <p style="font-size: 11px; color: #999; margin-top: 20px;">
          Eğer buton çalışmıyorsa şu bağlantıyı tarayıcınıza yapıştırın:<br>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
      </div>
    `,
  });
};
