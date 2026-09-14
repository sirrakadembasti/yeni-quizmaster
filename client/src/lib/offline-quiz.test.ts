import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getOfflineRemainingSeconds,
  getOfflineSession,
  markOfflineSubmit,
  saveOfflineSession,
  updateOfflineAnswers,
  type OfflineQuizSession,
} from './offline-quiz';

const session: OfflineQuizSession = {
  version: 1,
  userId: 'student-1',
  quizId: 'quiz-1',
  resultId: 'result-1',
  quiz: { id: 'quiz-1', title: 'Deneme' },
  questions: [{ id: 'question-1', text: 'Soru', type: 'multiple_choice', options: ['A', 'B'] }],
  answers: {},
  remainingSeconds: null,
  timerCapturedAt: '2026-09-14T10:00:00.000Z',
  cachedAt: '2026-09-14T10:00:00.000Z',
  pendingSubmit: false,
};

describe('offline quiz storage', () => {
  beforeEach(() => localStorage.clear());

  it('stores answers and a pending submission per student and quiz', () => {
    saveOfflineSession(session);
    updateOfflineAnswers('student-1', 'quiz-1', { 'question-1': 'A' });
    markOfflineSubmit('student-1', 'quiz-1', true);
    expect(getOfflineSession('student-1', 'quiz-1')).toMatchObject({
      answers: { 'question-1': 'A' },
      pendingSubmit: true,
    });
  });

  it('reduces a cached timed quiz using elapsed wall time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T10:00:30.000Z'));
    expect(getOfflineRemainingSeconds({ ...session, remainingSeconds: 120 })).toBe(90);
    vi.useRealTimers();
  });
});
