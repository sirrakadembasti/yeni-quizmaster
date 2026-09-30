import { beforeEach, describe, expect, it, vi } from 'vitest';
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
