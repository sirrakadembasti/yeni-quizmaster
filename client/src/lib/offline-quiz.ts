import type { User } from './api';

export interface OfflineQuestion {
  id: string;
  text: string;
  type: string;
  options?: string[];
  imageUrl?: string | null;
}

export interface OfflineQuizSession {
  version: 1;
  userId: string;
  quizId: string;
  resultId: string;
  quiz: any;
  questions: OfflineQuestion[];
  answers: Record<string, string>;
  remainingSeconds: number | null;
  timerCapturedAt: string;
  cachedAt: string;
  pendingSubmit: boolean;
  pendingAnswers?: Record<string, string>;
  answerRevisions?: Record<string, number>;
}

const SESSION_PREFIX = 'quiz-master:offline-session:';
const LIST_PREFIX = 'quiz-master:offline-list:';
const USER_KEY = 'quiz-master:offline-user';

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or quota exceeded; online behavior remains intact.
  }
}

const sessionKey = (userId: string, quizId: string) => `${SESSION_PREFIX}${userId}:${quizId}`;

export function normalizeOfflineQuestions(questions: any[]): OfflineQuestion[] {
  return questions.map(question => {
    let options = question.options;
    if (typeof options === 'string') {
      try { options = JSON.parse(options); } catch { options = []; }
    }
    return { ...question, options: Array.isArray(options) ? options : [] };
  });
}

export function saveOfflineSession(session: OfflineQuizSession) {
  writeJson(sessionKey(session.userId, session.quizId), session);
}

export function getOfflineSession(userId: string, quizId: string) {
  const session = readJson<OfflineQuizSession>(sessionKey(userId, quizId));
  return session?.version === 1 ? session : null;
}

export function getOfflineRemainingSeconds(session: OfflineQuizSession) {
  if (session.remainingSeconds === null) return null;
  const capturedAt = new Date(session.timerCapturedAt).getTime();
  const elapsed = Number.isFinite(capturedAt)
    ? Math.max(0, Math.floor((Date.now() - capturedAt) / 1000))
    : 0;
  return Math.max(0, session.remainingSeconds - elapsed);
}

export function removeOfflineSession(userId: string, quizId: string) {
  if (typeof window !== 'undefined') window.localStorage.removeItem(sessionKey(userId, quizId));
}

export function updateOfflineAnswers(userId: string, quizId: string, answers: Record<string, string>) {
  const session = getOfflineSession(userId, quizId);
  if (session) {
    const pendingAnswers = { ...session.pendingAnswers };
    const answerRevisions = { ...session.answerRevisions };
    for (const [id, answer] of Object.entries(answers)) {
      if (session.answers[id] !== answer) {
        pendingAnswers[id] = answer;
        answerRevisions[id] = (answerRevisions[id] || 0) + 1;
      }
    }
    saveOfflineSession({ ...session, answers, pendingAnswers, answerRevisions });
    return answerRevisions;
  }
}

export function acknowledgeOfflineAnswer(userId: string, quizId: string, resultId: string, questionId: string, answer: string, revision: number | undefined) {
  const session = getOfflineSession(userId, quizId);
  if (!session || session.resultId !== resultId || session.pendingAnswers?.[questionId] !== answer || revision === undefined || session.answerRevisions?.[questionId] !== revision) return;
  const pendingAnswers = { ...session.pendingAnswers };
  delete pendingAnswers[questionId];
  saveOfflineSession({ ...session, pendingAnswers });
}

// Never restore a different attempt or overwrite a newer server answer with a clean cache.
export function reconcileOfflineSession(server: OfflineQuizSession, cached: OfflineQuizSession | null): OfflineQuizSession {
  const sameAttempt = cached?.userId === server.userId && cached.quizId === server.quizId && cached.resultId === server.resultId;
  const pendingAnswers: Record<string, string> = {};
  const answerRevisions: Record<string, number> = sameAttempt ? { ...cached.answerRevisions } : {};
  if (sameAttempt) {
    const candidates = cached.pendingSubmit ? cached.answers : cached.pendingAnswers ?? Object.fromEntries(Object.entries(cached.answers).filter(([id]) => !Object.prototype.hasOwnProperty.call(server.answers, id)));
    for (const question of server.questions) {
      const answer = candidates[question.id];
      if (typeof answer === 'string' && question.options?.includes(answer) && answer !== server.answers[question.id]) {
        pendingAnswers[question.id] = answer;
        answerRevisions[question.id] ||= 1;
      }
    }
  }
  return { ...server, answers: { ...server.answers, ...pendingAnswers }, pendingAnswers, answerRevisions, pendingSubmit: Boolean(sameAttempt && cached.pendingSubmit) };
}

export function markOfflineSubmit(userId: string, quizId: string, pendingSubmit: boolean) {
  const session = getOfflineSession(userId, quizId);
  if (session) saveOfflineSession({ ...session, pendingSubmit });
}

export function saveOfflineQuizList(userId: string, quizzes: any[]) {
  writeJson(`${LIST_PREFIX}${userId}`, quizzes);
}

export function getOfflineQuizList(userId: string) {
  return readJson<any[]>(`${LIST_PREFIX}${userId}`) || [];
}

export function saveOfflineUser(user: User) {
  if (user.role === 'student') writeJson(USER_KEY, user);
}

export function getOfflineUser() {
  const user = readJson<User>(USER_KEY);
  return user?.role === 'student' ? user : null;
}

export function clearOfflineUser() {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(window.localStorage);
    for (const key of keys) {
      if (key === USER_KEY || key.startsWith(SESSION_PREFIX) || key.startsWith(LIST_PREFIX)) window.localStorage.removeItem(key);
    }
  } catch { /* Storage disabled by browser. */ }
}

// A result-specific seed keeps the displayed order stable across reloads.
export function orderQuizQuestions<T>(questions: T[], shuffle: boolean, seed: string): T[] {
  const result = [...questions];
  if (!shuffle) return result;
  let state = 2166136261;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(state / 4294967296 * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
