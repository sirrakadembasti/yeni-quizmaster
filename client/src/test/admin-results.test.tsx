import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import ResultsPage from '@/pages/results';
import userEvent from '@testing-library/user-event';

const data = vi.hoisted(() => ({ results: [] as any[] }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ role: 'admin', user: { id: 'admin' } }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => children }));
vi.mock('@/components/print/PrintTools', () => ({ PrintButton: () => null, PrintMeta: () => null }));
vi.mock('@/lib/api', () => ({
  quizApi: {
    getAllQuizzes: async () => ({ quizzes: [{ id: 'exam', title: 'Mixed results exam' }] }),
    getAllAdminQuizzes: async () => ({ quizzes: [{ id: 'exam', title: 'Mixed results exam' }, { id: 'teacher-exam', title: 'Teacher exam' }] }),
  },
  classApi: { getAllClasses: async () => ({ classes: [] }) },
  categoryApi: { getAllCategories: async () => [] },
  userApi: { getAllUsers: async () => ({ users: [] }) },
  resultApi: { getFilteredResults: async () => ({ results: data.results }) },
}));
// jsdom has no chart geometry; expose the data passed to the chart renderer.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => children,
  BarChart: ({ data }: any) => <output aria-label="chart data">{JSON.stringify(data)}</output>,
  Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
  Tooltip: () => null, Cell: () => null,
}));
beforeEach(() => { window.history.replaceState({}, '', '/results'); });
afterEach(cleanup);
const result = (status: string, score: number | null) => ({ quizId: 'exam', quizTitle: 'Mixed results exam', status, score });

it('excludes unfinished and ungraded attempts from average and failing grades', async () => {
  data.results = [result('completed', 100), result('in_progress', null), result('completed', null)];
  render(<ResultsPage />);
  const row = (await screen.findByText('Mixed results exam')).closest('tr')!;
  expect(within(row).getByText('%100')).toBeInTheDocument();
  const grades = JSON.parse(screen.getAllByLabelText('chart data')[0].textContent!);
  expect(grades.find((g: any) => g.name.startsWith('Geçmez')).value).toBe(0);
  expect(screen.getByText(/Devam eden: 1/)).toBeInTheDocument();
});

it('includes completed zero scores in the average and failing grades', async () => {
  data.results = [result('completed', 100), result('completed', 0), result('in_progress', null)];
  render(<ResultsPage />);
  const row = (await screen.findByText('Mixed results exam')).closest('tr')!;
  expect(within(row).getByText('%50')).toBeInTheDocument();
  const grades = JSON.parse(screen.getAllByLabelText('chart data')[0].textContent!);
  expect(grades.find((g: any) => g.name.startsWith('Geçmez')).value).toBe(1);
});

it('shows no average instead of zero when every attempt is unfinished', async () => {
  data.results = [result('in_progress', null)];
  render(<ResultsPage />);
  const row = (await screen.findByText('Mixed results exam')).closest('tr')!;
  expect(within(row).queryByText('%0')).not.toBeInTheDocument();
  expect(within(row).getByText('Henüz yok')).toBeInTheDocument();
});

it('lets an admin select exams created by teachers', async () => {
  data.results = [result('completed', 100)];
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  render(<ResultsPage />);
  await screen.findByText('Mixed results exam');
  await userEvent.setup().click(screen.getAllByRole('combobox')[2]);
  expect(screen.getByRole('option', { name: 'Teacher exam' })).toBeInTheDocument();
});
