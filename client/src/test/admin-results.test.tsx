import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import ResultsPage from '@/pages/results';
import userEvent from '@testing-library/user-event';

const data = vi.hoisted(() => ({ results: [] as any[], users: [] as any[] }));
const downloaded = vi.hoisted(() => ({ options: null as any, bytes: null as Uint8Array | null }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ role: 'admin', user: { id: 'admin' } }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => children }));
// jsdom cannot consume a browser download. Keep the real workbook encoder and
// replace only its DOM download boundary; E2E covers the real browser artifact.
vi.mock('@/lib/export', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/export')>();
  return { ...actual, downloadCsv: (options: any) => { downloaded.options = options; downloaded.bytes = actual.createExcelBytes(options); } };
});
vi.mock('@/lib/api', () => ({
  quizApi: {
    getAllQuizzes: async () => ({ quizzes: [{ id: 'exam', title: 'Mixed results exam' }] }),
    getAllAdminQuizzes: async () => ({ quizzes: [{ id: 'exam', title: 'Mixed results exam' }, { id: 'teacher-exam', title: 'Teacher exam' }] }),
  },
  classApi: { getAllClasses: async () => ({ classes: [] }) },
  categoryApi: { getAllCategories: async () => [] },
  userApi: { getAllUsers: async () => ({ users: data.users }) },
  resultApi: { getFilteredResults: async () => ({ results: data.results }) },
}));
// jsdom has no chart geometry; expose the data passed to the chart renderer.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => children,
  BarChart: ({ data }: any) => <output aria-label="chart data">{JSON.stringify(data)}</output>,
  Bar: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
  Tooltip: () => null, Cell: () => null,
}));
beforeEach(() => {
  window.history.replaceState({}, '', '/results');
  data.users = [];
  downloaded.options = null;
  downloaded.bytes = null;
});
afterEach(cleanup);
const result = (status: string, score: number | null) => ({ quizId: 'exam', quizTitle: 'Mixed results exam', status, score });

it('names every result filter using its visible label', async () => {
  data.results = [result('completed', 0)];
  render(<ResultsPage />);
  await screen.findByText('Mixed results exam');
  for (const name of ['Sınıf', 'Ders/Kategori', 'Sınav Adı', 'Öğretmen', 'Öğrenci']) {
    expect(screen.getByRole('combobox', { name })).toBeVisible();
  }
});

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

it('exports authorized student email and selected teacher/student provenance into Excel and print metadata', async () => {
  data.users = [
    { id: 'teacher', role: 'teacher', name: 'Şule İğde', email: 'sule@example.test' },
    { id: 'student', role: 'student', name: 'Çağrı Işık', email: 'cagri@example.test' },
    { id: 'other', role: 'student', name: 'Diğer Öğrenci', email: 'other@example.test' },
  ];
  data.results = [
    { ...result('completed', 0), studentId: 'student', createdBy: 'teacher', student: { id: 'student', name: 'Çağrı Işık' } },
    { ...result('in_progress', null), studentId: 'other', createdBy: 'teacher', student: { id: 'other', name: 'Diğer Öğrenci' } },
  ];
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  const user = userEvent.setup();
  const { container } = render(<ResultsPage />);
  await screen.findByText('Mixed results exam');
  await user.click(screen.getAllByRole('combobox')[3]);
  await user.click(screen.getByRole('option', { name: 'Şule İğde' }));
  await user.click(screen.getAllByRole('combobox')[4]);
  await user.click(screen.getByRole('option', { name: 'Çağrı Işık' }));
  await user.click(screen.getByRole('button', { name: 'Excel' }));
  expect(downloaded.options.rows).toHaveLength(1);
  expect(downloaded.options.filters).toEqual(expect.arrayContaining([
    { label: 'Öğretmen', value: 'Şule İğde' },
    { label: 'Öğrenci', value: 'Çağrı Işık' },
  ]));
  // Text remains readable in the generated XLSX, even when the result endpoint
  // intentionally omits email from its minimal student relation.
  const workbookXml = new TextDecoder().decode(downloaded.bytes!);
  expect(workbookXml).toContain('cagri@example.test');
  expect(workbookXml).not.toContain('other@example.test');
  const printMeta = container.querySelector('.print-report-meta')!;
  expect(printMeta).toHaveTextContent('Şule İğde');
  expect(printMeta).toHaveTextContent('Çağrı Işık');
});

it('resolves email through nested student identity and keeps email already supplied by a result', async () => {
  data.users = [{ id: 'student', role: 'student', name: 'Çağrı Işık', email: 'authorized@example.test' }];
  data.results = [
    { ...result('completed', 0), student: { id: 'student', name: 'Çağrı Işık' } },
    { ...result('completed', 100), studentId: 'student', student: { id: 'student', name: 'Çağrı Işık', email: 'provided@example.test' } },
  ];
  render(<ResultsPage />);
  await screen.findByText('Mixed results exam');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Excel' }));
  const workbookXml = new TextDecoder().decode(downloaded.bytes!);
  expect(workbookXml).toContain('authorized@example.test');
  expect(workbookXml).toContain('provided@example.test');
});
