import { describe, it, expect } from 'vitest';
import { managedQuestionRequest, buildQuestionPrompt, parseGeneratedQuestions } from '../../services/ai-question-format';

describe('managed AI question behavior', () => {
  it('supports a JSON object envelope without changing question validation',()=>{
    const prompt=buildQuestionPrompt({topic:'Tarih',count:1,difficulty:'easy',questionType:'multiple-choice',contentType:'exam'}, {jsonObject:true} as any);
    expect(prompt).toContain('"questions"');
    expect(prompt).not.toContain('Respond ONLY with a valid JSON array');
    const result=parseGeneratedQuestions('{"questions":[{"text":"Başkent?","type":"multiple-choice","options":["Ankara","İstanbul"],"correctAnswer":"Ankara"}]}',1,'exam');
    expect(result[0].correctAnswer).toBe('Ankara');
  });
  it.each(['customBaseUrl', 'customApiKey', 'model'])('rejects teacher %s override', field => {
    expect(managedQuestionRequest.safeParse({ profileId: 'p', topic: 'Tarih', [field]: 'override' }).success).toBe(false);
  });
  it('requires a managed profile and bounds question count', () => {
    expect(managedQuestionRequest.safeParse({ topic: 'Tarih' }).success).toBe(false);
    expect(managedQuestionRequest.safeParse({ profileId: 'p', topic: 'Tarih', count: 11 }).success).toBe(false);
  });
  it('preserves correct option text/index after shuffling', () => {
    const questions = parseGeneratedQuestions('```json\n[{"text":"Bir artı iki?","type":"multiple-choice","options":["2","3","4"],"correctAnswer":"B"}]\n```', 1, 'exam');
    expect(questions[0].correctAnswer).toBe('3');
    expect(questions[0].options[questions[0].correctAnswerIndex!]).toBe('3');
  });
  it('rejects an ambiguous choice and wrong count rather than inventing an answer', () => {
    const content = '[{"text":"Soru","type":"multiple-choice","options":["B","A"],"correctAnswer":"A"}]';
    expect(() => parseGeneratedQuestions(content, 1, 'exam')).toThrow();
    expect(() => parseGeneratedQuestions('[]', 1, 'exam')).toThrow();
  });
  it('keeps survey rating config and never adds scored answers', () => {
    const questions = parseGeneratedQuestions('{"questions":[{"text":"Memnuniyet?","type":"rating","options":[],"correctAnswer":null,"config":{"max":5}}]}', 1, 'survey');
    expect(questions[0]).toMatchObject({ correctAnswer: null, config: { max: 5 } });
    expect(buildQuestionPrompt({ topic: 'Tarih', count: 1, difficulty: 'medium', questionType: 'multiple-choice', contentType: 'survey' })).toContain('Do not score');
  });
});
