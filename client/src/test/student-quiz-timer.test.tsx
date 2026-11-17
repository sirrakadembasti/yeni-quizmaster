import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import Quiz from '@/pages/student-quiz';

const api = vi.hoisted(() => ({
  startQuiz: vi.fn(),
  submitQuiz: vi.fn(),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => <main>{children}</main> }));
const identity = vi.hoisted(() => ({ id: 'student-1' }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ role: 'student', user: identity }) }));
vi.mock('wouter', () => ({ useParams: () => ({ quizId: 'quiz' }), useLocation: () => ['', vi.fn()] }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/offline-shell', () => ({ ensureOfflineShell: async () => {} }));
vi.mock('@/lib/api', () => ({
  refreshCsrfToken: async () => {},
  quizApi: {
    startQuiz: (...args: unknown[]) => api.startQuiz(...args),
    submitQuiz: (...args: unknown[]) => api.submitQuiz(...args),
    submitAnswer: async () => ({}),
  },
}));

const started = (remainingSeconds: number) => ({
  quiz: { title: 'Sınav', timeLimit: 10 },
  resultId: 'r1',
  existingAnswers: {},
  questions: [{ id: 'q', text: 'Bir soru', options: ['A', 'B'] }],
  remainingSeconds,
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  localStorage.clear();
  api.startQuiz.mockReset();
  api.submitQuiz.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('süre dolunca teslim isteği yalnız bir kez gönderilir', async () => {
  api.startQuiz.mockResolvedValue(started(2));
  api.submitQuiz.mockReturnValue(new Promise(() => {}));
  render(<Quiz />);
  await screen.findByText('Bir soru');
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(api.submitQuiz).toHaveBeenCalledTimes(1);
});

it('sekme arka planda kısılsa da sayaç duvar saatine göre ilerler', async () => {
  api.startQuiz.mockResolvedValue(started(600));
  render(<Quiz />);
  await screen.findByText('Bir soru');
  expect(screen.getByText('10:00')).toBeInTheDocument();
  await act(async () => {
    vi.setSystemTime(Date.now() + 30_000);
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByText(/^9:(2[89]|30)$/)).toBeInTheDocument();
});
