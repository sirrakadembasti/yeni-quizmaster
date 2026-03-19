import { Router, type Response } from "express";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth";

const router: Router = Router();

// ==================== AI UTILS ====================

function extractJsonArray(content: string): any[] {
  try {
    // Try direct parse first
    const trimmed = content.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return JSON.parse(trimmed);
    }
    
    // Try to extract from markdown blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    
    // Try to find the first [ and last ]
    const startBracket = content.indexOf('[');
    const endBracket = content.lastIndexOf(']');
    if (startBracket !== -1 && endBracket !== -1) {
      const potentialJson = content.substring(startBracket, endBracket + 1).trim();
      return JSON.parse(potentialJson);
    }
    
    throw new Error("Could not extract JSON array from AI response");
  } catch (e) {
    console.error("[AI Parse Error] Content:", content);
    throw e;
  }
}

// ==================== AI ROUTES ====================

router.post("/test-config", requireAuth, requireRole(["admin", "teacher"]), async (req: AuthRequest, res: Response) => {
  try {
    const { 
      baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/", 
      apiKey = process.env.GEMINI_API_KEY, 
      model = "gemini-1.5-flash" 
    } = req.body;

    if (!apiKey) {
      return res.status(400).json({ message: "API anahtarı bulunamadı." });
    }

    const response = await fetch(`${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      res.json({ success: true, message: "Bağlantı başarılı!" });
    } else {
      const errorData = (await response.json().catch(() => ({}))) as any;
      res.status(response.status).json({
        success: false,
        message: "Bağlantı başarısız.",
        details: errorData.error?.message || "Servis sağlayıcı hatası."      });
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
      model = "gemini-1.5-flash",
      customBaseUrl,
      customApiKey
    } = req.body;

    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    const baseUrl = customBaseUrl || "https://generativelanguage.googleapis.com/v1beta/openai/";

    if (!apiKey) {
      return res.status(500).json({ message: "API anahtarı yapılandırılmamış." });
    }

    console.log(`[AI] Generating questions for topic: "${topic}" using model: ${model} via ${baseUrl}`);

    const prompt = `Generate ${count} multiple-choice questions about "${topic}" at a medium difficulty level.
Each question MUST have exactly 5 options.
Respond ONLY with a valid JSON array of objects, where each object has the following structure:
{
  "text": "The question text",
  "type": "multiple-choice",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
  "correctAnswer": "The exact text of the correct option"
}
Do not include markdown code blocks, just the raw JSON array.`;

    const endpoint = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}chat/completions`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as any;
      console.error("AI Provider error status:", response.status);
      return res.status(500).json({
        message: "AI sağlayıcısından soru oluşturulamadı.",
        details: errorData.error?.message || "Bilinmeyen hata"
      });
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return res.status(500).json({ message: "AI sağlayıcısından boş içerik döndü." });
    }

    let questions = [];
    try {
      const rawQuestions = extractJsonArray(content);
      
      if (!Array.isArray(rawQuestions)) throw new Error("AI did not return an array");

      questions = rawQuestions.map((q: any) => {
        const options = Array.isArray(q.options) ? [...q.options] : ["A", "B", "C", "D", "E"];
        const correctText = q.correctAnswer || options[0];
        
        // Shuffle options
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [options[i], options[j]] = [options[j], options[i]];
        }
        
        const newCorrectIndex = options.indexOf(correctText);
        return {
          text: q.text || "İsimsiz Soru",
          type: "multiple-choice",
          options,
          correctAnswerIndex: newCorrectIndex !== -1 ? newCorrectIndex : 0
        };
      });
    } catch (parseError) {
      console.error("AI data processing error:", parseError);
      return res.status(500).json({ message: "AI verisi işlenemedi. Lütfen tekrar deneyin." });
    }

    res.json({ questions });
  } catch (error) {
    console.error("AI Generation error:", error);
    res.status(500).json({ message: "Sunucu hatası oluştu." });
  }
});

export default router;
