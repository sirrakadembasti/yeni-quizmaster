import rateLimit from 'express-rate-limit';

// Kayıt başına e-posta gönderilir ve yöneticilere bildirim yazılır. Genel auth sınırlayıcısı
// IP+e-posta anahtarlı olduğundan farklı e-postalarla aşılabilir; bu sınırlayıcı yalnız IP'ye bakar.
export function createRegisterLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    keyGenerator: (req) => req.ip || 'unknown',
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin.' },
  });
}
