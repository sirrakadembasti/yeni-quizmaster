import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TeacherDetail from '@/pages/teacher-detail';

const fixture = vi.hoisted(() => ({
  role: 'admin', ownQuizzes: vi.fn(), adminQuizzes: vi.fn(), export: vi.fn(),
}));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ role: fixture.role, user: { id: fixture.role } }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('wouter', () => ({
  useParams: () => ({ id: 'teacher' }), useLocation: () => ['', vi.fn()],
  Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));
vi.mock('@/lib/export', () => ({ downloadCsv: fixture.export }));
vi.mock('@/lib/api', () => ({
  userApi: { getAllUsers: async () => ({ users: [{ id: 'teacher', name: 'Şule İğde', email: 'teacher@example.test', role: 'teacher' }] }) },
  classApi: { getAllClasses: async () => ({ classes: [{ id: 'class', name: '1-Çığ', classTeacherId: 'teacher' }] }) },
  quizApi: { getAllQuizzes: fixture.ownQuizzes, getAllAdminQuizzes: fixture.adminQuizzes },
}));

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  fixture.role = 'admin';
  fixture.ownQuizzes.mockResolvedValue({ quizzes: [{ id: 'admin-exam', title: 'Yöneticinin kendi sınavı', createdBy: 'admin', status: 'published' }] });
  fixture.adminQuizzes.mockResolvedValue({ quizzes: [
    { id: 'teacher-exam', title: 'Öğretmenin sınavı', createdBy: 'teacher', status: 'published' },
    { id: 'other-exam', title: 'Başka öğretmenin sınavı', createdBy: 'other', status: 'published' },
  ] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });

function mount() { render(<QueryClientProvider client={client}><TeacherDetail /></QueryClientProvider>); }

it('admin teacher detail shows and exports the teacher exam despite a warm owner-only quiz cache', async () => {
  // Removing the admin endpoint/cache separation would reuse this owner's list,
  // leaving the teacher's exam absent from both the screen and export.
  client.setQueryData(['quizzes'], { quizzes: [{ id: 'admin-exam', title: 'Yöneticinin kendi sınavı', createdBy: 'admin' }] });
  mount();
  expect(await screen.findByText('Öğretmenin sınavı')).toBeVisible();
  expect(screen.queryByText('Başka öğretmenin sınavı')).not.toBeInTheDocument();
  expect(screen.queryByText('Yöneticinin kendi sınavı')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
  expect(fixture.export).toHaveBeenCalledWith(expect.objectContaining({ rows: [
    { type: 'Sınıf', name: '1-Çığ', detail: 'Sorumlu öğretmen' },
    { type: 'Sınav', name: 'Öğretmenin sınavı', detail: 'published' },
  ] }));
});

it('teacher detail preserves the teacher owner-list contract', async () => {
  fixture.role = 'teacher';
  fixture.ownQuizzes.mockResolvedValue({ quizzes: [{ id: 'own-exam', title: 'Kendi öğretmen sınavı', createdBy: 'teacher', status: 'draft' }] });
  mount();
  expect(await screen.findByText('Kendi öğretmen sınavı')).toBeVisible();
  expect(screen.queryByText('Öğretmenin sınavı')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Excel' })).not.toBeInTheDocument();
});

it('prints all 21 teacher quizzes while screen pagination and Excel preserve their contracts', async () => {
  const quizzes = Array.from({ length: 21 }, (_, index) => ({
    id: `teacher-exam-${index + 1}`, title: `Öğretmen sınavı ${String(index + 1).padStart(2, '0')}`,
    createdBy: 'teacher', status: 'published',
  }));
  fixture.adminQuizzes.mockResolvedValue({ quizzes });
  mount();
  await screen.findByText(quizzes[0].title);
  const titles = () => screen.getAllByText(/^Öğretmen sınavı \d{2}$/);
  const rows = () => titles().map(title => title.closest('.rounded-xl')!);
  // Tail records must exist in the printable DOM, not only in the exported data.
  expect(titles()).toHaveLength(21);
  expect(rows().every(row => row.classList.contains('print:flex'))).toBe(true);
  expect(titles().filter(title => !title.closest('.rounded-xl')!.classList.contains('hidden')).map(title => title.textContent))
    .toEqual(quizzes.slice(0, 10).map(quiz => quiz.title));
  fireEvent.click(screen.getByRole('button', { name: 'Sonraki Sayfa' }));
  expect(titles().filter(title => !title.closest('.rounded-xl')!.classList.contains('hidden')).map(title => title.textContent))
    .toEqual(quizzes.slice(10, 20).map(quiz => quiz.title));
  expect(rows()).toHaveLength(21);
  fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
  expect(fixture.export.mock.calls[0][0].rows.filter((row: any) => row.type === 'Sınav').map((row: any) => row.name))
    .toEqual(quizzes.map(quiz => quiz.title));
});
