import { z } from 'zod';

export const managedQuestionRequest = z.object({
  profileId: z.string().trim().min(1).max(100),
  topic: z.string().trim().min(1).max(8000),
  count: z.number().int().min(1).max(10).default(3),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  questionType: z.enum(['multiple-choice', 'true-false', 'short-answer']).default('multiple-choice'),
  contentType: z.enum(['exam', 'survey']).default('exam'),
  context: z.object({
    draftId: z.string().uuid().optional(), quizId: z.string().min(1).max(100).optional(),
    quizTitle: z.string().trim().max(100).optional(), categoryId: z.string().uuid().nullable().optional(),
  }).strict().optional(),
}).strict();
export type QuestionInput = Omit<z.infer<typeof managedQuestionRequest>, 'profileId'>;

export function buildQuestionPrompt(input: QuestionInput, options: { jsonObject?: boolean } = {}): string {
  const { topic, count, difficulty, questionType, contentType } = input;
  const prompt = contentType === 'survey'
    ? `Generate ${count} survey questions in Turkish about "${topic}". Use a useful mix of single-choice, multiple-choice, open-text, rating and likert types.
Respond ONLY with a valid JSON array. Each item must follow: {"text":"...","type":"single-choice|multiple-choice|open-text|rating|likert","options":[],"correctAnswer":null,"config":null}.
Use options for choice and likert questions. For rating use {"max":5} in config. Do not score answers and do not include a correct answer.`
    : `Generate ${count} ${questionType} questions in Turkish about "${topic}" at a ${difficulty} difficulty level.
Respond ONLY with a valid JSON array of objects.
Structure: {"text":"...","type":"multiple-choice","options":["A","B","C","D","E"],"correctAnswer":"A"}.
Use the requested question type. For true-false use two options. For multiple-choice and true-false questions, correctAnswer must be the EXACT option text, not its letter or index. For short-answer questions, provide the answer text and an empty options array.
Output ONLY raw JSON.`;
  return options.jsonObject ? prompt.replace('Respond ONLY with a valid JSON array.', 'Respond ONLY with a valid JSON object {"questions":[...]}.')
    .replace('Respond ONLY with a valid JSON array of objects.', 'Respond ONLY with a valid JSON object {"questions":[...]}. Each array item is a question object.') : prompt;
}

const examQuestion = z.object({
  text: z.string().trim().min(1), type: z.enum(['multiple-choice', 'true-false', 'short-answer']),
  options: z.array(z.string().trim().min(1)).default([]),
  correctAnswer: z.union([z.string().trim().min(1), z.number().int().nonnegative()]),
});
const surveyQuestion = z.object({
  text: z.string().trim().min(1), type: z.enum(['single-choice', 'multiple-choice', 'open-text', 'rating', 'likert']),
  options: z.array(z.string().trim().min(1)).default([]), correctAnswer: z.null().optional(),
  config: z.record(z.any()).optional().nullable(),
});
export interface GeneratedQuestion { text: string; type: string; options: string[]; correctAnswer?: string | number | null; correctAnswerIndex?: number; config?: Record<string, unknown> | null }

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const start = content.indexOf('['), end = content.lastIndexOf(']');
  for (const candidate of [content.trim(), fenced?.[1], start >= 0 && end > start ? content.slice(start, end + 1) : undefined]) {
    if (!candidate) continue;
    try { const parsed = JSON.parse(candidate); return Array.isArray(parsed) ? parsed : parsed.questions; } catch { /* try next existing fallback */ }
  }
  throw new Error('AI yanıtından geçerli soru listesi alınamadı.');
}

export function parseGeneratedQuestions(content: string, count: number, contentType: 'exam' | 'survey'): GeneratedQuestion[] {
  const raw = extractJson(content);
  if (contentType === 'survey') {
    const questions = z.array(surveyQuestion).length(count).parse(raw);
    return questions.map(q => ({ ...q, correctAnswer: null }));
  }
  return z.array(examQuestion).length(count).parse(raw).map(q => {
    if (q.type === 'short-answer') return { ...q, options: [], correctAnswer: String(q.correctAnswer) };
    const options = [...q.options];
    if (options.length < 2 || new Set(options).size !== options.length || (q.type === 'true-false' && options.length !== 2)) throw new Error('AI seçenekleri geçersiz.');
    const value = String(q.correctAnswer), candidates = new Set<number>();
    options.forEach((option, index) => { if (option === value) candidates.add(index); });
    if (/^[A-Z]$/i.test(value)) { const index = value.toUpperCase().charCodeAt(0) - 65; if (index < options.length) candidates.add(index); }
    if (/^(0|[1-9]\d*)$/.test(value) && Number(value) < options.length) candidates.add(Number(value));
    if (candidates.size !== 1) throw new Error('AI doğru cevabı geçersiz veya belirsiz.');
    const correctAnswer = options[[...candidates][0]];
    if (q.type === 'multiple-choice') for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
    return { ...q, options, correctAnswer, correctAnswerIndex: options.indexOf(correctAnswer) };
  });
}
