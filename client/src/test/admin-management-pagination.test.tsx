import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Page from '@/pages/admin-management';

const api = vi.hoisted(() => ({ users: vi.fn(), categories: vi.fn(), classes: vi.fn(), logs: vi.fn(), emails: vi.fn(), resets: vi.fn(), system: vi.fn(), createCategory: vi.fn(), createOfflineLink: vi.fn(), regenerateOfflineLink: vi.fn(), toast: vi.fn() }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => children }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: api.toast }) }));
vi.mock('@/lib/api', () => ({ userApi: { getAllUsers: api.users }, categoryApi: { getAllCategories: api.categories, createCategory: api.createCategory }, classApi: { getAllClasses: api.classes }, adminApi: { getLogs: api.logs, getEmailLogs: api.emails, getPasswordResetRequests: api.resets, getSystemLogs: api.system, createOfflinePasswordResetLink: api.createOfflineLink, regenerateOfflinePasswordResetLink: api.regenerateOfflineLink } }));
let client: QueryClient;
const cases = [
  ['Kullanıcı Logları', 'logs', 'İşlem ara (örn: create, delete, login)...'],
  ['E-Posta Logları', 'emails', 'Alıcı e-posta veya konu ara...'],
  ['Şifre Talepleri', 'resets', 'Ad veya e-posta ara...'],
  ['Sistem Hata & İşlemleri', 'system', 'Sistem işlem veya hata ara (örn: archive, purge, hata)...'],
] as const;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {}; Element.prototype.releasePointerCapture = () => {};
  api.users.mockResolvedValue({ users: [] }); api.categories.mockResolvedValue([]); api.classes.mockResolvedValue({ classes: [] });
  for (const key of ['logs', 'emails', 'resets', 'system'] as const) api[key].mockImplementation(async ({ page = 1 }: any = {}) => ({
    logs: [{ id: String(page), action: 'login', details: `Record ${page}`, createdAt: new Date().toISOString() }],
    emails: [{ id: String(page), subject: `Record ${page}`, to: 'a@example.com', status: 'sent', createdAt: new Date().toISOString() }],
    requests: [{ id: String(page), email: `Record ${page}`, status: 'completed', createdAt: new Date().toISOString(), expiresAt: new Date().toISOString() }],
    counts: { total: 51, sent: 51, pending: 0, completed: 51, failed: 0, cancelled: 0 }, pagination: { page, limit: 50, total: 51, totalPages: 2 },
  }));
});
afterEach(() => { cleanup(); client.clear(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
function mount() { render(<QueryClientProvider client={client}><Page /></QueryClientProvider>); }
async function openLogTab(tab: string) {
  await userEvent.click(screen.getByRole('tab', { name: 'Loglar' }));
  await userEvent.click(screen.getByRole('button', { name: new RegExp(tab.replace('&', '\\&')) }));
}
it.each(cases)('%s sunucudaki ikinci sayfaya ulaşır ve sınırda durur', async (tab, key) => {
  mount(); await openLogTab(tab); await screen.findByText('Record 1');
  expect(screen.getByRole('button', { name: 'Önceki' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
  expect(await screen.findByText('Record 2')).toBeInTheDocument();
  expect(api[key]).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 50 }));
  expect(screen.getByRole('button', { name: 'Sonraki' })).toBeDisabled();
});
it.each(cases)('%s arama değişince ilk sayfaya döner', async (tab, key, placeholder) => {
  mount(); await openLogTab(tab); await screen.findByText('Record 1');
  await userEvent.click(screen.getByRole('button', { name: 'Sonraki' })); await screen.findByText('Record 2');
  await userEvent.type(screen.getByPlaceholderText(placeholder), 'a');
  await waitFor(() => expect(api[key]).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
  expect(await screen.findByText('Record 1')).toBeInTheDocument();
});
it.each(cases)('%s sorgu hatası boş liste değildir ve tekrar denenir', async (tab, key) => {
  api[key].mockRejectedValueOnce(new Error('Ağ kesildi')); mount(); await openLogTab(tab);
  expect(await screen.findByRole('alert')).toHaveTextContent(/yüklenemedi/i);
  expect(screen.queryByText(/Kayıt bulunamadı|log kaydı bulunmuyor|talebi bulunmuyor|hata kaydı bulunamadı/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));
  expect(await screen.findByText('Record 1')).toBeInTheDocument();
});
it.each([['Dersler', 'categories'], ['Sınıflar', 'classes'], ['Kullanıcılar', 'users']] as const)('%s sorgusu hata verdiğinde boş kayıt gösterilmez', async (tab, key) => {
  api[key].mockRejectedValueOnce(new Error('Ağ kesildi')); mount(); await userEvent.click(screen.getByRole('tab', { name: tab }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/yüklenemedi/i);
  expect(screen.queryByText(/Kayıtlı ders bulunamadı|Henüz sınıf|Kullanıcı bulunamadı/)).not.toBeInTheDocument();
});
it('ders kaydetme beklerken tekrar gönderim engellenir ve hata formu korur', async () => {
  let reject!: (error: Error) => void; api.createCategory.mockImplementation(() => new Promise((_r, j) => { reject = j; }));
  mount(); await userEvent.click(screen.getByRole('tab', { name: 'Dersler' }));
  await userEvent.click(screen.getByRole('button', { name: 'Yeni Ders Ekle' }));
  await userEvent.type(screen.getByPlaceholderText('Örn: GÖRSEL PROGRAMLAMA'), 'Matematik');
  const save = screen.getByRole('button', { name: 'Dersi Kaydet' }); await userEvent.click(save);
  await waitFor(() => expect(save).toBeDisabled()); reject(new Error('500 kayıt başarısız'));
  await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
  expect(screen.getByPlaceholderText('Örn: GÖRSEL PROGRAMLAMA')).toHaveValue('MATEMATİK');
});
it('şifre taleplerinde uygulanmayan tarih filtresi gösterilmez, tarih destekleyen günlüklerde korunur', async () => {
  mount(); await openLogTab('Şifre Talepleri'); await screen.findByText('Record 1');
  expect(screen.queryByRole('combobox', { name: 'Günlük tarih aralığı' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Kullanıcı Logları' }));
  expect(await screen.findByRole('combobox', { name: 'Günlük tarih aralığı' })).toBeVisible();
});

it('şifre taleplerinde SMTP olmadan tek kullanımlık sıfırlama bağlantısı üretir ve gösterir', async () => {
  api.createOfflineLink.mockResolvedValue({
    message: 'Tek kullanımlık şifre sıfırlama bağlantısı üretildi.',
    request: { id: 'r-offline-1', email: 'ogretmen@okul.com', status: 'pending' },
    resetUrl: 'http://localhost:5000/reset-password?token=testtoken123',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });
  mount();
  await openLogTab('Şifre Talepleri');
  await screen.findByText('Record 1');

  await userEvent.type(screen.getByLabelText('Kullanıcı E-postası'), 'ogretmen@okul.com');
  await userEvent.click(screen.getByRole('button', { name: /Bağlantı Üret \(SMTP'siz\)/i }));

  expect(api.createOfflineLink).toHaveBeenCalledWith('ogretmen@okul.com');
  expect(await screen.findByDisplayValue(/\/reset-password\?token=testtoken123/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Bağlantıyı Kopyala/i })).toBeInTheDocument();
});
