import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminQuizzesPage from '@/pages/admin-quizzes';
import QuizzesPage from '@/pages/quizzes';
import ClassStatisticsPage from '@/pages/class-statistics';
import { QuestionItem } from '@/components/quiz/QuestionItem';
import { QuizSettings } from '@/components/quiz/QuizSettings';

const state = vi.hoisted(() => ({ quizzes: [] as any[], classes: [] as any[], fail: false, deleted: null as any }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({children}: any) => children }));
vi.mock('@/components/print/PrintTools', () => ({ PrintButton: () => null, PrintMeta: () => null }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({role: 'admin', user: {id: 'admin'}}) }));
vi.mock('@/hooks/use-toast', () => ({useToast: () => ({toast: vi.fn()})}));
vi.mock('@/components/ui/image-upload', () => ({ImageUpload: () => null}));
vi.mock('@/lib/quiz-delete', () => ({ deleteQuizWithReason: async (id: string, reason: string) => {state.deleted = {id, reason}; state.quizzes = state.quizzes.filter(q => q.id !== id); } }));
vi.mock('@/lib/api', () => ({
  quizApi: {getAllAdminQuizzes: async () => { if(state.fail) throw new Error('offline'); return {quizzes: state.quizzes}; }, getAllQuizzes: async () => ({quizzes: state.quizzes}), deleteQuiz: async (id: string) => {state.quizzes = state.quizzes.filter(q => q.id !== id);} },
  userApi: {getAllUsers: async () => ({users: []})}, categoryApi: {getAllCategories: async () => []},
  classApi: {getAllClasses: async () => ({classes: []})}, analyticsApi: {getClassAnalytics: async () => {if(state.fail) throw new Error('offline'); return {classes: state.classes};}},
}));
vi.mock('recharts', () => Object.fromEntries(['Bar', 'BarChart', 'CartesianGrid', 'Legend', 'ResponsiveContainer', 'Tooltip', 'XAxis', 'YAxis'].map(name => [name, () => null])));
function mount(element: React.ReactNode) {return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}})}>{element}</QueryClientProvider>);}
beforeEach(() => {
 state.fail = false; state.deleted = null; state.classes = []; state.quizzes = [];
 HTMLElement.prototype.scrollIntoView = vi.fn(); HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false); HTMLElement.prototype.setPointerCapture = vi.fn(); HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);
const quiz = (i: number) => ({id: `quiz-${i}`, title: `Exam ${i}`, category: 'Math', status: 'archived', createdAt: '2026-09-30'});

it('shows a load failure and successfully retries the admin list', async () => {
 state.fail = true; mount(<AdminQuizzesPage />);
 expect(await screen.findByRole('alert')).toHaveTextContent('Sınavlar yüklenemedi');
 expect(screen.queryByText('Sınav bulunamadı.')).not.toBeInTheDocument();
 state.fail = false; state.quizzes = [quiz(1)]; await userEvent.setup().click(screen.getByRole('button', {name: 'Yeniden dene'}));
 expect(await screen.findByText('Exam 1')).toBeInTheDocument();
});
it.each([AdminQuizzesPage, QuizzesPage])('clamps the last page after deletion and labels archived exams', async (Page) => {
 state.quizzes = Array.from({length: 11}, (_, i) => quiz(i)); mount(<Page />);
 expect((await screen.findAllByText('Arşivlenmiş')).length).toBeGreaterThan(0);
 const user = userEvent.setup(); await user.click(screen.getByRole('button', {name: 'Sonraki'}));
 await user.click(screen.getByRole('button', {name: 'Exam 10 işlemleri'})); await user.click(screen.getByRole('menuitem', {name: 'Sil'}));
 const dialog = screen.getByRole('dialog'); expect(dialog).toHaveTextContent('sonuç');
 await user.type(within(dialog).getByLabelText('Silme Nedeni'), 'Duplicate exam');
 await user.click(within(dialog).getByRole('button', {name: /Kalıcı Olarak Sil/}));
 expect(await screen.findByText('10 kayıt · Sayfa 1/1')).toBeInTheDocument();
 expect(screen.getByText('Exam 0')).toBeInTheDocument(); expect(state.deleted).toEqual({id:'quiz-10', reason:'Duplicate exam'});
});
it.each([AdminQuizzesPage, QuizzesPage])('invalidates previously visited related screens after permanent deletion', async (Page) => {
 state.quizzes = [quiz(1)];
 const client = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity},mutations:{retry:false}}});
 const related = [['quizzes'],['admin-quizzes'],['/api/admin/quizzes'],['archive-candidates'],['results','admin'],['dashboard-stats','admin'],['dashboard-overview','admin'],['dashboard-logs','admin'],['class-analytics','admin']];
 for(const key of related) client.setQueryData(key, key[0] === 'quizzes' || key[0] === 'admin-quizzes' || key[0] === '/api/admin/quizzes' ? {quizzes:state.quizzes} : {cached:true});
 client.setQueryData(['categories'], []);
 render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
 const user = userEvent.setup(); await user.click(await screen.findByRole('button',{name:'Exam 1 işlemleri'})); await user.click(screen.getByRole('menuitem',{name:'Sil'}));
 const dialog = screen.getByRole('dialog'); await user.type(within(dialog).getByLabelText('Silme Nedeni'),'Duplicate exam'); await user.click(within(dialog).getByRole('button',{name:/Kalıcı Olarak Sil/}));
 await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 const ownKey = Page === AdminQuizzesPage ? 'admin-quizzes' : 'quizzes';
 for(const key of related.filter(key => key[0] !== ownKey)) expect(client.getQueryState(key)?.isInvalidated, `cache ${key.join('/')}`).toBe(true);
 expect(client.getQueryState(['categories'])?.isInvalidated).toBe(false);
 client.clear();
});
it('weights aggregate participation by students and score by completed attempts', async () => {
 state.classes = [{classId: 'a', className:'Small', studentCount:1, participantCount:1, participationRate:100, averageScore:100, completedCount:1}, {classId:'b', className:'Large', studentCount:99, participantCount:0, participationRate:0, averageScore:0, completedCount:0}];
 mount(<ClassStatisticsPage />); await screen.findByRole('cell', {name:'Small'});
 const participation = screen.getByText('Katılım Oranı', {selector:'p'}).parentElement!;
 expect(within(participation).getByText('%1')).toBeInTheDocument();
 expect(within(screen.getByText('Ortalama Başarı', {selector:'p'}).parentElement!).getByText('%100')).toBeInTheDocument();
});
it('shows a statistics failure without fabricated zero KPI values', async () => {
 state.fail = true; mount(<ClassStatisticsPage />);
 expect(await screen.findByRole('alert')).toHaveTextContent('İstatistikler yüklenemedi');
 expect(screen.queryByText('Toplam Öğrenci')).not.toBeInTheDocument();
 state.fail = false; await userEvent.setup().click(screen.getByRole('button', {name:'Yeniden dene'}));
 expect(await screen.findByText('Toplam Öğrenci')).toBeInTheDocument();
});
it('gives question actions contextual names and exposes correct answer selection', () => {
 render(<QuestionItem question={{id:1,type:'multiple-choice',text:'Text',options:['A','B','C'],correctAnswer:1}} index={0} totalQuestions={2} isFirst contentType="exam" onUpdate={vi.fn()} onRemove={vi.fn()} onUpdateOption={vi.fn()} onRemoveOption={vi.fn()} />);
 expect(screen.getByLabelText('Soru Metni')).toHaveValue('Text');
 expect(screen.getByRole('button',{name:'1. soru: 2. seçenek doğru cevap'})).toHaveAttribute('aria-pressed','true');
 expect(screen.getByRole('button',{name:'1. soruyu sil'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'1. soru: 1. seçeneği sil'})).toBeInTheDocument();
});
it('names rule switches and category selection', () => {
 render(<QuizSettings contentType="exam" title="Exam" description="" category="" dbCategories={[]} teacherClasses={[]} assignedClassIds={[]} timeLimitEnabled={false} shuffleQuestions={false} setTitle={vi.fn()} setDescription={vi.fn()} setCategory={vi.fn()} toggleClass={vi.fn()} setTimeLimitEnabled={vi.fn()} setTimeLimit={vi.fn()} setShuffleQuestions={vi.fn()} />);
 expect(screen.getByRole('switch',{name:'Süre Sınırı'})).toBeInTheDocument(); expect(screen.getByRole('switch',{name:'Soruları Karıştır'})).toBeInTheDocument(); expect(screen.getByRole('combobox',{name:'Ders / Kategori'})).toBeInTheDocument();
});
