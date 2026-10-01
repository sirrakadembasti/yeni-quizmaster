export function hasInvalidQuestions(contentType: 'exam' | 'survey', questions: Array<{text: string; type: string; options: unknown; correctAnswer?: string | null}>) {
  const surveyTypes = new Set(['single-choice', 'multiple-choice', 'open-text', 'rating', 'likert']);
  return questions.some(question => {
    if (!question.text.trim()) return true;
    if (!Array.isArray(question.options) || question.options.some(option => typeof option !== 'string')) return true;
    if (contentType === 'exam' ? question.type !== 'multiple-choice' : !surveyTypes.has(question.type)) return true;
    if (contentType === 'exam' || ['single-choice', 'multiple-choice', 'likert'].includes(question.type)) {
      const options = question.options.map(option => option.trim());
      if (options.length < 2 || options.some(option => !option) || new Set(options).size !== options.length) return true;
    }
    return contentType === 'exam' && (!question.correctAnswer || !question.options.includes(question.correctAnswer));
  });
}
