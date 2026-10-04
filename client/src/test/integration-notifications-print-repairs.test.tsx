import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import ClassStatistics from '@/pages/class-statistics';

const api = vi.hoisted(() => ({ notifications: vi.fn(), markRead: vi.fn(), analytics: vi.fn(), error: vi.fn() }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'teacher', name: 'Teacher' }, role: 'teacher', logout: vi.fn() }) }));
vi.mock('@/components/layout/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('sonner', () => ({ toast: { error: api.error } }));
vi.mock('@/lib/api', () => ({
  notificationApi: { getUserNotifications: api.notifications, markAllAsRead: api.markRead, getPreferences: async () => ({ muted: false }) },
  analyticsApi: { getClassAnalytics: api.analytics }, classApi: { getAllClasses: async () => ({ classes: [] }) },
}));
// JSDOM has no chart layout. The actual print chart must not need this observer.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>, BarChart: () => <div data-testid="screen-chart" />,
  Bar: () => null, CartesianGrid: () => null, Legend: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  api.notifications.mockResolvedValue({ notifications: [], pagination: { unread: 0 } });
  api.markRead.mockResolvedValue({});
  api.analytics.mockResolvedValue({ classes: [
    { classId: 'a', className: '1-A', studentCount: 1, participantCount: 1, completedCount: 1, participationRate: 100, averageScore: 50 },
    { classId: 'b', className: '1-B', studentCount: 1, participantCount: 1, completedCount: 1, participationRate: 100, averageScore: 70 },
  ] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });
function mount(children = <DashboardLayout>Page</DashboardLayout>) {
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
function open() { fireEvent.click(screen.getByRole('button', { name: 'Bildirimleri aç' })); }

it('distinguishes initial loading, failed fetch and a successful empty retry', async () => {
  let reject!: (error: Error) => void;
  api.notifications.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  mount(); open();
  expect(screen.getByRole('status')).toHaveTextContent('Bildirimler yükleniyor');
  expect(screen.queryByText('Henüz bildirim yok')).not.toBeInTheDocument();
  await act(async () => reject(new Error('500')));
  expect(await screen.findByRole('alert')).toHaveTextContent('Bildirimler yüklenemedi');
  expect(screen.queryByText('Henüz bildirim yok')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
  expect(await screen.findByText('Henüz bildirim yok')).toBeVisible();
});

it('reports mark-all failure and keeps the unread cache and badge', async () => {
  api.notifications.mockResolvedValue({ notifications: [{ id: 'n', title: 'Unread notice', createdAt: '2026-10-01T10:00:00Z', isRead: false }], pagination: { unread: 1 } });
  api.markRead.mockRejectedValue(new Error('500'));
  mount(); open();
  fireEvent.click(await screen.findByRole('button', { name: 'Hepsini Oku' }));
  await screen.findByText('Unread notice');
  await act(async () => {});
  expect(api.error).toHaveBeenCalledWith('Bildirimler okundu olarak işaretlenemedi. Lütfen tekrar deneyin.');
  expect(client.getQueryData<any>(['notifications', 'nav']).pagination.unread).toBe(1);
  expect(screen.getByRole('button', { name: 'Hepsini Oku' })).toBeEnabled();
});

it('has complete 100% printable bars immediately when data arrives and after changing filters', async () => {
  mount(<ClassStatistics />);
  await screen.findByTestId('screen-chart');
  const chart = () => screen.getByRole('img', { name: 'Sınıfların katılım ve başarı grafiği' });
  const verify = () => {
    fireEvent(window, new Event('beforeprint'));
    const bars = chart().querySelectorAll('rect[data-series="participationRate"]');
    expect(bars).toHaveLength(2);
    expect(Array.from(bars).map(bar => bar.getAttribute('height'))).toEqual(['160', '160']);
    expect(chart()).toHaveTextContent('1-A'); expect(chart()).toHaveTextContent('1-B');
  };
  verify();
  fireEvent.change(screen.getByLabelText('Başlangıç Tarihi'), { target: { value: '2026-09-01' } });
  await screen.findByTestId('screen-chart');
  verify();
});

it('prints all 30 classes in readable bounded chart groups immediately and after a filter update', async () => {
  const classes = Array.from({ length: 30 }, (_, index) => ({
    classId: `class-${index}`, className: `${index + 1}-Uzun Anadolu Hazırlık Sınıfı`,
    studentCount: 1, participantCount: 1, completedCount: 1, participationRate: 100, averageScore: 50,
  }));
  api.analytics.mockResolvedValueOnce({ classes }).mockResolvedValue({ classes: classes.map(item => ({ ...item, participationRate: 75, averageScore: 25 })) });
  mount(<ClassStatistics />);
  await screen.findByTestId('screen-chart');
  const verify = (participationHeight: number) => {
    fireEvent(window, new Event('beforeprint'));
    const charts = screen.getAllByRole('img', { name: /^Sınıfların katılım ve başarı grafiği bölüm \d\/6$/ });
    expect(charts).toHaveLength(6);
    for (const chart of charts) {
      expect(chart).toHaveAttribute('viewBox', '0 0 600 240');
      expect(chart).toHaveClass('print:h-[280px]', 'break-inside-avoid');
      expect(chart.querySelectorAll('rect[data-series="participationRate"]')).toHaveLength(5);
      expect(chart.querySelectorAll('rect[data-series="averageScore"]')).toHaveLength(5);
      expect(Array.from(chart.querySelectorAll('rect[data-series="participationRate"]')).map(bar => Number(bar.getAttribute('height')))).toEqual(Array(5).fill(participationHeight));
      for (const label of chart.querySelectorAll('text[data-class-label]')) {
        expect(label).toHaveAttribute('font-size', '11');
        expect(label.querySelectorAll('tspan').length).toBeLessThanOrEqual(2);
        expect(Array.from(label.querySelectorAll('tspan')).every(line => (line.textContent?.length || 0) <= 10)).toBe(true);
      }
    }
    expect(charts.flatMap(chart => Array.from(chart.querySelectorAll('title')).map(title => title.textContent))).toEqual(classes.map(item => item.className));
    const printedClassNames = Array.from(document.querySelectorAll('.class-analysis-table tbody tr')).map(row => row.querySelector('td')?.textContent);
    expect(printedClassNames).toEqual(classes.map(item => item.className));
  };
  verify(160);
  fireEvent.change(screen.getByLabelText('Başlangıç Tarihi'), { target: { value: '2026-09-01' } });
  await waitFor(() => expect(document.querySelector('rect[data-series="participationRate"]')).toHaveAttribute('height', '120'));
  verify(120);
});
