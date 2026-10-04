import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as offline from './offline-quiz';
import {
  orderQuizQuestions,
  clearOfflineUser, saveOfflineUser, saveOfflineQuizList, getOfflineQuizList,
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

  it('tracks unsent changes without marking unchanged server answers dirty', () => {
    saveOfflineSession({ ...session, answers: { 'question-1': 'A' } });
    updateOfflineAnswers('student-1', 'quiz-1', { 'question-1': 'A', 'question-2': 'B' });
    expect(getOfflineSession('student-1', 'quiz-1')).toMatchObject({ pendingAnswers: { 'question-2': 'B' } });
  });
});

describe('offline answer reconciliation', () => {
  beforeEach(() => localStorage.clear());

  it('preserves only unsent answers for the current attempt and current questions', () => {
    const cached = { ...session, answers: { 'question-1': 'B', gone: 'A' }, pendingAnswers: { 'question-1': 'B', gone: 'A' }, pendingSubmit: true };
    const resumed = offline.reconcileOfflineSession({ ...session, answers: { 'question-1': 'A' } }, cached);
    expect(resumed).toMatchObject({ answers: { 'question-1': 'B' }, pendingAnswers: { 'question-1': 'B' }, pendingSubmit: true });
    expect(offline.reconcileOfflineSession(session, { ...cached, resultId: 'old-result' })).toMatchObject({ answers: {}, pendingAnswers: {}, pendingSubmit: false });
    expect(offline.reconcileOfflineSession(session, { ...cached, userId: 'other' })).toMatchObject({ answers: {}, pendingAnswers: {} });
    expect(offline.reconcileOfflineSession(session, { ...cached, quizId: 'other' })).toMatchObject({ answers: {}, pendingAnswers: {} });
  });

  it('keeps server changes over clean cache and migrates only missing legacy answers', () => {
    expect(offline.reconcileOfflineSession({ ...session, answers: { 'question-1': 'B' } }, { ...session, answers: { 'question-1': 'A' }, pendingAnswers: {} }).answers).toEqual({ 'question-1': 'B' });
    expect(offline.reconcileOfflineSession(session, { ...session, answers: { 'question-1': 'A' } })).toMatchObject({ answers: { 'question-1': 'A' }, pendingAnswers: { 'question-1': 'A' } });
    expect(offline.reconcileOfflineSession({ ...session, answers: { 'question-1': 'B' } }, { ...session, answers: { 'question-1': 'A' } }).answers).toEqual({ 'question-1': 'B' });
  });

  it('does not acknowledge a newer answer or another attempt with a late response', () => {
    saveOfflineSession(session);
    updateOfflineAnswers(session.userId, session.quizId, { 'question-1': 'A' });
    updateOfflineAnswers(session.userId, session.quizId, { 'question-1': 'B' });
    offline.acknowledgeOfflineAnswer(session.userId, session.quizId, session.resultId, 'question-1', 'A', 1);
    expect(getOfflineSession(session.userId, session.quizId)?.pendingAnswers).toEqual({ 'question-1': 'B' });
    offline.acknowledgeOfflineAnswer(session.userId, session.quizId, 'old-result', 'question-1', 'B', 2);
    expect(getOfflineSession(session.userId, session.quizId)?.pendingAnswers).toEqual({ 'question-1': 'B' });
    offline.acknowledgeOfflineAnswer(session.userId, session.quizId, session.resultId, 'question-1', 'B', 2);
    expect(getOfflineSession(session.userId, session.quizId)?.pendingAnswers).toEqual({});
  });

  it('does not let the first A response acknowledge a later A after A to B to A', () => {
    saveOfflineSession(session);
    const first = offline.updateOfflineAnswers(session.userId, session.quizId, { 'question-1': 'A' })?.['question-1'];
    offline.updateOfflineAnswers(session.userId, session.quizId, { 'question-1': 'B' });
    const last = offline.updateOfflineAnswers(session.userId, session.quizId, { 'question-1': 'A' })?.['question-1'];
    offline.acknowledgeOfflineAnswer(session.userId, session.quizId, session.resultId, 'question-1', 'A', first);
    expect(getOfflineSession(session.userId, session.quizId)?.pendingAnswers).toEqual({ 'question-1': 'A' });
    expect(last).not.toBe(first);
    offline.acknowledgeOfflineAnswer(session.userId, session.quizId, session.resultId, 'question-1', 'A', last);
    expect(getOfflineSession(session.userId, session.quizId)?.pendingAnswers).toEqual({});
  });

  it('preserves a legacy queued submission snapshot when server has an older answer', () => {
    const queued = { ...session, answers: { 'question-1': 'B' }, pendingSubmit: true };
    expect(offline.reconcileOfflineSession({ ...session, answers: { 'question-1': 'A' } }, queued)).toMatchObject({ answers: { 'question-1': 'B' }, pendingSubmit: true });
  });
});

describe('offline logout privacy',()=>{
 it('removes saved answers and quiz lists when clearing the offline identity',()=>{
  const user={id:'student',role:'student',name:'Student'} as any;
  saveOfflineUser(user);saveOfflineQuizList(user.id,[{id:'quiz'}]);
  saveOfflineSession({version:1,userId:user.id,quizId:'quiz',resultId:'result',quiz:{},questions:[],answers:{q:'A'},remainingSeconds:null,timerCapturedAt:new Date().toISOString(),cachedAt:new Date().toISOString(),pendingSubmit:true});
  clearOfflineUser();
  expect(getOfflineSession(user.id,'quiz')).toBeNull();expect(getOfflineQuizList(user.id)).toEqual([]);
 });
});

describe('stable quiz question order',()=>{
 it('shuffles enabled quizzes consistently on resume without mutating source',()=>{
  const rows=Array.from({length:8},(_,i)=>({id:String(i)}));
  const shuffled=orderQuizQuestions(rows,true,'result-123');
  expect(shuffled).not.toEqual(rows);
  expect(orderQuizQuestions(rows,true,'result-123')).toEqual(shuffled);
  expect(rows.map(q=>q.id)).toEqual(['0','1','2','3','4','5','6','7']);
 });
 it('preserves teacher order when shuffling is disabled',()=>expect(orderQuizQuestions([{id:'a'},{id:'b'}],false,'result')).toEqual([{id:'a'},{id:'b'}]));
});
