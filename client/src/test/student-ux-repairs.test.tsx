import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TakeSurvey from '@/pages/take-survey';
import Quizzes from '@/pages/student-quizzes';
import Quiz from '@/pages/student-quiz';
import Dashboard from '@/pages/student-dashboard';
import Stats from '@/pages/student-stats';
import Results from '@/pages/results';
import { ApiError } from '@/lib/http-error';
import * as offline from '@/lib/offline-quiz';

const fixture = vi.hoisted(() => ({ failure: 0, offline: false, role: 'student', score: 80, completed: true }));
const identity = vi.hoisted(() => ({ id: 'student-1' }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ role: fixture.role, user: identity }) }));
vi.mock('wouter', () => ({ useParams: () => ({ id: 'survey', quizId: 'quiz' }), useLocation: () => ['', vi.fn()] }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
// This unit covers queued-session reconciliation; the actual worker readiness,
// failed shell and v2 migration are independently exercised in Chromium.
vi.mock('@/lib/offline-shell', () => ({ ensureOfflineShell: async () => {} }));
vi.mock('@/lib/api', () => ({
  refreshCsrfToken: async () => {},
  authApi: { getCurrentUser: async () => ({ user: { name: 'Öğrenci' } }) },
  classApi: { getAllClasses: async () => ({ classes: [] }), getTeacherClasses: async () => ({ classes: [] }) },
  categoryApi: { getAllCategories: async () => [] }, userApi: { getAllUsers: async () => ({ users: [] }) },
  surveyApi: { getSurvey: async () => {
    if (fixture.failure) throw new ApiError('Request failed', fixture.failure);
    return { survey: { title: 'Anket' }, submitted: false, questions: [
      { id: 'text', text: 'Görüşünüz', type: 'open-text' },
      { id: 'choice', text: 'Tercihiniz', type: 'single-choice', options: ['A', 'B'] },
    ] };
  }, submitSurvey: async () => ({}) },
  quizApi: { prepareQuizOffline: async () => ({ quiz: { id: 'quiz', title: 'Sınav' }, resultId: 'result', existingAnswers: { q: 'A' }, questions: [{ id: 'q', text: 'Bir soru', options: ['A', 'B'] }], preparedAt: '2026-10-04T12:00:00Z' }), getAllQuizzes: async () => ({ quizzes: [] }), startQuiz: async () => ({ quiz: { title: 'Sınav' }, resultId: 'result', existingAnswers: {}, questions: [{ id: 'q', text: 'Bir soru', options: ['A', 'B'] }] }), submitAnswer: async () => ({}), getStudentQuizzes: async () => { if (fixture.offline) throw new Error('offline'); return { quizzes: [{ id: 'quiz', title: 'Sınav' }] }; } },
  resultApi: { getFilteredResults: async () => ({ results: [{ id: 'result', quizId: 'quiz', quizTitle: 'Sınav', score: 80, status: 'completed', createdBy: 'student-1', submittedAt: '2026-10-01T00:00:00Z' }] }), getStudentResults: async () => { if (fixture.offline) throw new Error('offline'); return { results: [{ id: 'result', quizId: 'quiz', quizTitle: 'Sınav', score: fixture.score, status: fixture.completed ? 'completed' : 'in_progress' }] }; } },
}));
let client: QueryClient;
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); fixture.completed = true; fixture.score = 80; fixture.failure = 0; fixture.offline = false; fixture.role = 'student'; localStorage.clear(); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
afterEach(() => { cleanup(); client.clear(); });
const mount = (element: React.ReactNode) => render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);

it('survey controls have question names, selected state and reject whitespace', async () => {
  mount(<TakeSurvey />);
  await screen.findByText('Anket');
  const text = screen.getByRole('textbox', { name: /Görüşünüz/ });
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'A' }));
  expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true');
  await user.type(text, '   ');
  expect(screen.getByRole('button', { name: 'Anketi Gönder' })).toBeDisabled();
  await user.type(text, 'Yanıt');
  expect(screen.getByRole('button', { name: 'Anketi Gönder' })).toBeEnabled();
});
it.each([[403, /yetkiniz/i], [404, /bulunamadı/i], [500, /yüklenemedi/i]])('survey %s error has distinct recovery UI', async (status, message) => {
  fixture.failure = status as number; mount(<TakeSurvey />);
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  fixture.failure = 0;
  await userEvent.setup().click(screen.getByRole('button', { name: /yeniden dene/i }));
  expect(await screen.findByRole('textbox', { name: /Görüşünüz/ })).toBeInTheDocument();
});
it('keeps completed results after list requests go offline and names the filters', async () => {
  mount(<Quizzes />);
  await screen.findByText('Tamamlandı');
  expect(screen.getByRole('textbox')).toHaveAccessibleName('Sınav Ara');
  expect(screen.getByRole('combobox')).toHaveAccessibleName('Sınav Durumu');
  cleanup(); fixture.offline = true; mount(<Quizzes />);
  expect(await screen.findByText('Tamamlandı')).toBeInTheDocument();
  expect(screen.getByText('%80.0')).toBeInTheDocument();
});
it('cached list results are isolated by identity and legacy lists stay readable', () => {
  offline.saveOfflineQuizList('student-1', [{ id: 'quiz' }], [{ quizId: 'quiz', status: 'completed' }]);
  expect(offline.getOfflineQuizResults('student-1')).toEqual([{ quizId: 'quiz', status: 'completed' }]);
  expect(offline.getOfflineQuizResults('student-2')).toEqual([]);
  localStorage.setItem('quiz-master:offline-list:legacy', JSON.stringify([{ id: 'old' }]));
  expect(offline.getOfflineQuizList('legacy')).toEqual([{ id: 'old' }]);
  expect(offline.getOfflineQuizResults('legacy')).toEqual([]);
});
it('list cache keeps only result display fields', () => {
  offline.saveOfflineQuizList('student-1', [{ id: 'quiz' }], [{ id: 'result', quizId: 'quiz', status: 'completed', score: 75, answers: [{ correctAnswer: 'secret' }] }]);
  expect(offline.getOfflineQuizResults('student-1')).toEqual([{ id: 'result', quizId: 'quiz', status: 'completed', score: 75 }]);
});
it('quiz answers expose selection and navigator exposes current answered question', async () => {
  mount(<Quiz />); await screen.findByText('Bir soru');
  const answer = screen.getByRole('button', { name: 'A) A' });
  await userEvent.setup().click(answer);
  expect(answer).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /Soru 1, cevaplandı/ })).toHaveAttribute('aria-current', 'step');
});
it.each(['student', 'teacher'])('completion modal correctly describes %s result persistence', async (role) => {
  fixture.role = role; mount(<Quiz />); await screen.findByText('Bir soru');
  await userEvent.setup().click(screen.getByRole('button', { name: role === 'teacher' ? 'Önizlemeyi Bitir' : 'Quizi Bitir' }));
  const modal = screen.getByRole('alertdialog');
  expect(modal).toHaveTextContent(role === 'teacher' ? /kaydedilmeyecek/ : /kaydedilecek/);
});
it('dashboard details have a usable action name', async () => {
  mount(<Dashboard />); expect(await screen.findByRole('button', { name: /Sınav.*sonuç detaylarını gör/i })).toBeInTheDocument();
});
it('stats names the browser print action accurately', async () => {
  mount(<Stats />); expect(await screen.findByRole('button', { name: 'Yazdır / PDF olarak kaydet' })).toBeInTheDocument();
});
it('result search keeps a visible label', async () => {
  fixture.role = 'teacher'; mount(<Results />); expect(await screen.findByRole('textbox', { name: 'Sınav veya ders ara' })).toBeInTheDocument();
  expect(screen.getByText('Sınav veya ders ara', { selector: 'label' })).toBeVisible();
});
it.each([[50, false], [69, false], [70, true]])('dashboard trophy agrees with statistics for score %s', async (score, success) => {
  fixture.score = score as number; mount(<Dashboard />);
  const detail = await screen.findByRole('button', { name: /Sınav.*sonuç detaylarını gör/i });
  expect(Boolean(detail.parentElement?.parentElement?.querySelector('svg.lucide-trophy'))).toBe(success);
});
it('offline list separates pending submission from unfinished work', async () => {
  fixture.offline = true;
  offline.saveOfflineQuizList('student-1', [{ id: 'quiz', title: 'Sınav' }, { id: 'next', title: 'Devam' }]);
  const base = { version: 1 as const, userId: 'student-1', quizId: 'quiz', resultId: 'result', quiz: {}, questions: [], answers: { q: 'A' }, remainingSeconds: null, timerCapturedAt: new Date().toISOString(), cachedAt: new Date().toISOString(), pendingSubmit: true };
  offline.saveOfflineSession(base);
  offline.saveOfflineSession({ ...base, quizId: 'next', pendingSubmit: false });
  mount(<Quizzes />);
  expect(await screen.findByText('Teslim Bekliyor')).toBeInTheDocument();
  expect(screen.getByText('Devam Ediyor')).toBeInTheDocument();
  offline.cacheOfflineCompletion('student-1', 'quiz', 'result');
  expect(offline.getOfflineQuizResults('student-1')).toEqual([{ id: 'result', quizId: 'quiz', status: 'completed' }]);
});
it('a started blank attempt is different from an unopened offline preparation', async () => {
  fixture.offline = true;
  offline.saveOfflineQuizList('student-1', [{ id: 'quiz', title: 'Sınav' }]);
  offline.saveOfflineSession({ version: 1, userId: 'student-1', quizId: 'quiz', resultId: 'result', quiz: {}, questions: [], answers: {}, started: true, remainingSeconds: null, timerCapturedAt: new Date().toISOString(), cachedAt: new Date().toISOString(), pendingSubmit: false });
  mount(<Quizzes />);
  expect(await screen.findByText('Devam Ediyor')).toBeInTheDocument();
});
it('preparing again preserves queued submission and newer unsent answers for the same attempt', async () => {
  fixture.completed = false;
  offline.saveOfflineUser({ id: 'student-1', role: 'student' } as any);
  offline.saveOfflineSession({ version: 1, userId: 'student-1', quizId: 'quiz', resultId: 'result', started: true, quiz: {}, questions: [{ id: 'q', text: 'Bir soru', type: 'multiple_choice', options: ['A', 'B'] }], answers: { q: 'B' }, pendingAnswers: { q: 'B' }, answerRevisions: { q: 2 }, remainingSeconds: null, timerCapturedAt: new Date().toISOString(), cachedAt: new Date().toISOString(), pendingSubmit: true });
  mount(<Quizzes />);
  // A legacy session without the current bundle readiness marker is honestly
  // unprepared until this new shell/session preparation completes.
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Çevrimdışı Hazırla' }));
  await screen.findByRole('button', { name: 'Çevrimdışı Hazır' });
  await screen.findByText('Teslim Bekliyor');
  expect(offline.getOfflineSession('student-1', 'quiz')).toMatchObject({ answers: { q: 'B' }, pendingAnswers: { q: 'B' }, pendingSubmit: true, answerRevisions: { q: 2 }, started: true, offlinePrepared: true });
});
