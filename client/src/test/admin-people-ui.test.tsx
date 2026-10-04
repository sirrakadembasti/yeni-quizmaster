import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Students from '@/pages/students';
import Teachers from '@/pages/teachers';
import Classes from '@/pages/classlist';
import TeacherDetail from '@/pages/teacher-detail';
import AdminClass from '@/pages/admin-class-detail';
import Guardians from '@/pages/guardian-management';
import { UserFormModal } from '@/components/management/UserFormModal';
import { UserManagementTable } from '@/components/management/UserManagementTable';
import userEvent from '@testing-library/user-event';

// jsdom omits browser layout/pointer APIs used by the real Radix components.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};

const api = vi.hoisted(() => ({ users: vi.fn(), classes: vi.fn(), categories: vi.fn(), quizzes: vi.fn(), parents: vi.fn(), links: vi.fn(), remove: vi.fn(), unlink: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/api', () => ({ userApi: { getAllUsers: api.users }, classApi: { getAllClasses: api.classes, getClass: api.classes, removeStudentFromClass: api.remove }, categoryApi: { getAllCategories: api.categories }, quizApi: { getAllQuizzes: api.quizzes, getAllAdminQuizzes: api.quizzes }, parentApi: { getParents: api.parents, getParentStudents: api.links, unlinkParent: api.unlink } }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ role: 'admin', user: { id: 'admin' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: api.toast }) }));
vi.mock('wouter', () => ({ useParams: () => ({ id: 'teacher' }), useLocation: () => ['', vi.fn()], Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a> }));
const clients: QueryClient[] = [];
function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); vi.resetAllMocks(); });
function defaults() {
  api.users.mockResolvedValue({ users: [{ id: 'teacher', name: 'Öğretmen', email: 't@example.com', role: 'teacher' }] });
  api.classes.mockResolvedValue({ classes: [], class: { id: 'class', name: '5-A', classTeacherId: 'teacher', classTeacher: { name: 'Öğretmen' }, teacherAssignments: [{ id: 'assignment', teacherId: 'teacher', teacher: { name: 'Öğretmen' }, category: { name: 'Matematik' } }] }, students: [{ id: 'student', name: 'Ayşe', email: 's@example.com' }] });
  api.categories.mockResolvedValue([]); api.quizzes.mockResolvedValue({ quizzes: [] }); api.parents.mockResolvedValue({ parents: [] }); api.links.mockResolvedValue({ students: [] });
}
it.each([['öğrenciler', Students], ['öğretmenler', Teachers], ['sınıflar', Classes], ['öğretmen detayı', TeacherDetail], ['sınıf yönetimi', AdminClass], ['veli yönetimi', Guardians]])('%s sorgu hatasını ve yeniden denemeyi gösterir', async (_name, Page) => {
  defaults(); api.users.mockRejectedValueOnce(new Error('Ağ kesildi'));
  mount(<Page />);
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/yüklenemedi/i);
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
it('öğretmenin on birinci sınavını da gösterir', async () => {
  defaults(); api.quizzes.mockResolvedValue({ quizzes: Array.from({ length: 11 }, (_, i) => ({ id: String(i), title: `Sınav ${i + 1}`, createdBy: 'teacher' })) });
  mount(<TeacherDetail />);
  expect(await screen.findByText('Sınav 11')).toBeVisible();
});
it('sınıf sayıları kullanıcı sorgusu bitmeden sıfır gibi sunulmaz', async () => {
  defaults(); api.users.mockImplementation(() => new Promise(() => {}));
  api.classes.mockResolvedValue({ classes: [{ id: 'class', name: '5-A' }] });
  mount(<Classes />);
  expect(await screen.findByRole('status')).toHaveTextContent(/yükleniyor/i);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('büyük öğretmen sınav geçmişinin sonraki sayfasına ulaşılır', async () => {
  defaults(); api.quizzes.mockResolvedValue({ quizzes: Array.from({ length: 26 }, (_, i) => ({ id: String(i), title: `Sınav ${i + 1}`, createdBy: 'teacher' })) });
  mount(<TeacherDetail />);
  fireEvent.click(await screen.findByRole('button', { name: 'Sonraki Sayfa' }));
  expect(screen.getByText('Sınav 11')).toBeVisible();
  expect(screen.getByText('Sayfa 2 / 3')).toBeVisible();
  // Off-page rows remain mounted for print; jsdom does not generate Tailwind CSS.
  expect(screen.getByText('Sınav 1').parentElement?.parentElement).toHaveClass('hidden', 'print:flex');
  expect(screen.getByText('Sınav 11').parentElement?.parentElement).toHaveClass('flex');
});
it('sınıftan çıkarma odaklanabilir adlandırılmış bir düğmedir ve beklerken tekrar gönderilmez', async () => {
  defaults(); let reject!: (error: Error) => void; api.remove.mockImplementation(() => new Promise((_r, j) => { reject = j; }));
  mount(<AdminClass />);
  const remove = await screen.findByRole('button', { name: 'Ayşe öğrencisini sınıftan çıkar' });
  fireEvent.click(remove); await waitFor(() => expect(remove).toBeDisabled());
  reject(new Error('403 erişim reddedildi'));
  await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: '403 erişim reddedildi' })));
  expect(screen.getByText('Ayşe')).toBeVisible();
});
it('sorumlu öğretmenin bağımsız kalan dersini mevcut atamalardan açıklar', async () => {
  defaults(); mount(<AdminClass />);
  expect(await screen.findByText(/Sorumlu öğretmen atamasını kaldırmak bağımsız ders atamalarını kaldırmaz/)).toBeVisible();
  expect(screen.getByText(/Kalan dersler: Matematik/)).toBeVisible();
});
it('öğretmen formu etiketlerle doldurulur ve seçili ders klavyeyle kaldırılır', async () => {
  defaults(); api.categories.mockResolvedValue([{ id: 'math', name: 'Matematik' }]);
  mount(<UserFormModal isOpen onOpenChange={() => {}} mode="create" role="teacher" isPending={false} onSubmit={() => {}} />);
  expect(screen.getByLabelText('Tam İsim')).toHaveAttribute('id');
  expect(screen.getByLabelText('E-posta Adresi')).toHaveAttribute('id');
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Matematik' }));
  const remove = screen.getByRole('button', { name: 'Matematik dersini kaldır' });
  remove.focus(); expect(remove).toHaveFocus(); await userEvent.setup().keyboard('{Enter}');
  expect(screen.getByRole('checkbox', { name: 'Matematik' })).not.toBeChecked();
});
it('öğrenci satırının işlem menüsü öğrencinin adıyla okunur', () => {
  mount(<UserManagementTable users={[{ id: 's', name: 'Ayşe', email: 'a@example.com', role: 'student' }]} isLoading={false} role="student" canManage onDelete={() => {}} />);
  expect(screen.getByRole('button', { name: 'Ayşe için işlemler' })).toBeVisible();
});
it('veli bağlantısı sorgu hatasını boş öğrenci listesi gibi sunmaz', async () => {
  defaults(); api.parents.mockResolvedValue({ parents: [{ id: 'guardian', name: 'Veli', email: 'v@example.com' }] });
  api.links.mockRejectedValue(new Error('500 sunucu hatası'));
  mount(<Guardians />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('combobox', { name: 'Veli hesabı' }));
  await user.click(await screen.findByRole('option', { name: /Veli ·/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/yüklenemedi/i);
  expect(screen.queryByText('Bu veliye bağlı öğrenci yok.')).not.toBeInTheDocument();
});
it('veli bağlantısını kaldırırken yeniden istek engellenir ve hata mevcut bağı korur', async () => {
  defaults(); api.parents.mockResolvedValue({ parents: [{ id: 'guardian', name: 'Veli', email: 'v@example.com' }] });
  api.links.mockResolvedValue({ students: [{ id: 'link', studentId: 'student', student: { name: 'Ayşe' }, relation: 'Anne' }] });
  let reject!: (error: Error) => void; api.unlink.mockImplementation(() => new Promise((_r, j) => { reject = j; }));
  mount(<Guardians />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('combobox', { name: 'Veli hesabı' }));
  await user.click(await screen.findByRole('option', { name: /Veli ·/ }));
  const remove = await screen.findByRole('button', { name: 'Ayşe veli bağlantısını kaldır' });
  await user.click(remove); await waitFor(() => expect(remove).toBeDisabled());
  reject(new Error('403 erişim reddedildi'));
  await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: '403 erişim reddedildi' })));
  expect(screen.getByText('Ayşe')).toBeVisible();
});
