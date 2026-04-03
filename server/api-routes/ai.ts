import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";
import { logger } from "../index";
import { z } from "zod";

const router: Router = Router();

// ==================== SSRF KORUMASI ====================

// Resmi Google Gemini endpoint'i — bu URL için env API key kullanılmasına izin verilir.
const OFFICIAL_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

/**
 * Verilen URL'nin SSRF saldırılarına karşı güvenli olup olmadığını kontrol eder.
 * Kural: Sadece HTTPS + genel internet adresleri kabul edilir.
 * localhost, 127.x, 10.x, 172.16-31.x, 192.168.x ve IPv6 loopback reddedilir.
 */
function isSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") return false;
    const h = url.hostname;
    const blocked = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^0\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
    ];
    return !blocked.some((pattern) => pattern.test(h));
  } catch {
    return false;
  }
}

/**
 * API key izolasyon kuralı:
 * - Resmi endpoint → env key fallback'e izin verilir.
 * - Özel/bilinmeyen URL → yalnızca kullanıcının sağladığı key kullanılır;
 *   env key ASLA gönderilmez (SSRF ile token hırsızlığını engeller).
 */
function resolveApiKey(
  requestApiKey: string | undefined,
  requestBaseUrl: string | undefined
): string | undefined {
  const isOfficial = !requestBaseUrl || requestBaseUrl === OFFICIAL_BASE_URL;
  return isOfficial
    ? requestApiKey || process.env.GEMINI_API_KEY
    : requestApiKey; // Özel URL — env key kullanma
}

// test-config için kısıtlayıcı rate limiter (harici HTTP isteği yapıyor)
const aiTestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10,                   // IP başına 15 dakikada en fazla 10 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Çok fazla bağlantı testi yapıldı, lütfen daha sonra tekrar deneyin." },
});

// ==================== SCHEMAS ====================

const QuestionSchema = z.object({
  text: z.string().min(1, "Soru metni boş olamaz"),
  type: z.enum(["multiple-choice", "true-false", "short-answer"]),
  options: z.array(z.string()).default([]),
  correctAnswer: z.string().min(1, "Doğru cevap belirtilmelidir"),
});

const AIResponseSchema = z.array(QuestionSchema).or(z.object({
  questions: z.array(QuestionSchema)
}));

// ==================== AI UTILS ====================

function extractJsonArray(content: string): any[] {
  const trimmed = content.trim();

  // Strateji 1: Doğrudan JSON parse dene
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : (parsed.questions || []);
  } catch {
    // Bu strateji başarısız — sonraki stratejiye geç
  }

  // Strateji 2: Markdown bloklarını ayıkla (```json ... ``` veya ``` ... ```)
  // Her strateji kendi try-catch'ine sahip; biri hata verse bile fallback devreye girer.
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      return Array.isArray(parsed) ? parsed : (parsed.questions || []);
    } catch {
      // Markdown bloğu var ama içindeki JSON bozuk — sonraki stratejiye geç
    }
  }

  // Strateji 3: İlk [ ve son ] arasını bul
  const startBracket = content.indexOf('[');
  const endBracket = content.lastIndexOf(']');
  if (startBracket !== -1 && endBracket !== -1 && startBracket < endBracket) {
    try {
      const potentialJson = content.substring(startBracket, endBracket + 1).trim();
      const parsed = JSON.parse(potentialJson);
      return Array.isArray(parsed) ? parsed : (parsed.questions || []);
    } catch {
      // Bracket aralığı da geçersiz JSON — tüm stratejiler tükendi
    }
  }

  // Tüm stratejiler başarısız
  const err = new Error("AI yanıtından JSON dizisi ayıklanamadı");
  logger.error({ err }, "[AI] JSON parse hatası — AI yanıtı beklenmedik formatta.");
  throw err;
}

// ==================== AI ROUTES ====================

router.post("/test-config", aiTestLimiter, requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const {
      baseUrl: rawBaseUrl,
      apiKey: requestApiKey,
      model = "gemini-3-flash-preview",
    } = req.body;

    const baseUrl: string = rawBaseUrl || OFFICIAL_BASE_URL;

    // 1. URL güvenlik kontrolü: localhost / private IP / HTTP engellenir
    if (!isSafeUrl(baseUrl)) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz URL. Sadece HTTPS ve genel internet adresleri kabul edilir.",
      });
    }

    // 2. Key izolasyonu: özel URL kullanılıyorsa env key asla gönderilmez
    const apiKey = resolveApiKey(requestApiKey, rawBaseUrl);
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: rawBaseUrl && rawBaseUrl !== OFFICIAL_BASE_URL
          ? "Özel URL kullanıldığında API anahtarı zorunludur."
          : "API anahtarı bulunamadı.",
      });
    }

    const endpoint = `${baseUrl.endsWith("/") ? baseUrl : baseUrl + "/"}chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      res.json({ success: true, message: "Bağlantı başarılı!" });
    } else {
      const errorData = (await response.json().catch(() => ({}))) as any;
      res.status(response.status).json({
        success: false,
        message: "Bağlantı başarısız.",
        details: errorData.error?.message || "Servis sağlayıcı hatası.",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Bağlantı testi sırasında bir hata oluştu." });
  }
});

router.post("/generate-questions", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      topic, 
      count = 3, 
      difficulty = "medium", 
      model = "gemini-3-flash-preview",
      customBaseUrl,
      customApiKey,
      questionType = "multiple-choice"
    } = req.body;

    const baseUrl = customBaseUrl || OFFICIAL_BASE_URL;

    // URL güvenlik kontrolü
    if (!isSafeUrl(baseUrl)) {
      return res.status(400).json({ message: "Geçersiz URL. Sadece HTTPS ve genel internet adresleri kabul edilir." });
    }

    // Key izolasyonu: özel URL kullanılıyorsa env key asla gönderilmez
    const apiKey = resolveApiKey(customApiKey, customBaseUrl);
    if (!apiKey) {
      return res.status(500).json({
        message: customBaseUrl && customBaseUrl !== OFFICIAL_BASE_URL
          ? "Özel URL kullanıldığında API anahtarı zorunludur."
          : "API anahtarı yapılandırılmamış.",
      });
    }

    // customApiKey asla log'a yazılmıyor — sadece topic ve model bilgisi loglanıyor
    logger.info({ topic, model, questionType, count, difficulty }, "[AI] Soru üretimi başlatılıyor.");

    const prompt = `Generate ${count} ${questionType} questions about "${topic}" at a ${difficulty} difficulty level.
Respond ONLY with a valid JSON array of objects.
Structure for ${questionType}:
${questionType === "true-false" ? 
  '{"text": "...", "type": "true-false", "options": ["Doğru", "Yanlış"], "correctAnswer": "Doğru"}' : 
  questionType === "short-answer" ? 
  '{"text": "...", "type": "short-answer", "options": [], "correctAnswer": "answer"}' : 
  '{"text": "...", "type": "multiple-choice", "options": ["A", "B", "C", "D", "E"], "correctAnswer": "A"}'
}
Output ONLY raw JSON.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    let response;
    try {
      response = await fetch(`${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2048
        }),
        signal: controller.signal
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      logger.error({ err: fetchError }, "[AI] Dış servis bağlantı hatası (Fetch Error)");
      return res.status(502).json({ 
        message: fetchError.name === 'AbortError' 
          ? "AI sağlayıcısı çok geç yanıt verdi (Timeout)." 
          : "AI sağlayıcısına bağlanılamadı." 
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as any;
      logger.warn({ statusCode: response.status, aiError: errorData.error?.message }, "[AI] Sağlayıcıdan hata yanıtı alındı.");
      return res.status(500).json({
        message: "AI sağlayıcısından soru oluşturulamadı.",
        details: errorData.error?.message || "Bilinmeyen hata"
      });
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return res.status(500).json({ message: "AI sağlayıcısından boş içerik döndü." });
    }

    try {
      const rawData = extractJsonArray(content);
      const validation = AIResponseSchema.safeParse(rawData);
      
      if (!validation.success) {
        logger.error({ validationError: validation.error.format() }, "[AI] Yanıt şema doğrulaması başarısız.");
        return res.status(500).json({ message: "AI yanıtı beklenen formatta değil." });
      }

      const validatedQuestions = Array.isArray(validation.data) 
        ? validation.data 
        : validation.data.questions;

      const questions = validatedQuestions.map((q) => {
        let options = [...q.options];
        let correctText = q.correctAnswer;

        if (q.type === "multiple-choice" && options.length > 0) {
          // Shuffle options but keep correct answer reference
          for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
          }
        }

        return {
          ...q,
          options,
          correctAnswerIndex: options.indexOf(correctText) !== -1 ? options.indexOf(correctText) : 0
        };
      });

      res.json({ questions });
    } catch (parseError) {
      logger.error({ err: parseError }, "[AI] Yanıt verisi işlenemedi.");
      res.status(500).json({ message: "AI verisi işlenemedi." });
    }
  } catch (error) {
    logger.error({ err: error }, "[AI] Soru üretimi sırasında sunucu hatası.");
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

export default router;