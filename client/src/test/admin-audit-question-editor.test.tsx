import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuizBuilder } from '@/pages/create-quiz';

const mocks = vi.hoisted(() => ({
  saveContent: vi.fn(),
  addQuestions: vi.fn(), createQuiz: vi.fn(), createSurvey: vi.fn(),
  syncQuestions: vi.fn(), toast: vi.fn(),
}));
vi.mock('@/lib/content-save', () => ({ contentSaveApi: { save: mocks.saveContent } }));
vi.mock('@/lib/api', () => ({
  categoryApi: { getAllCategories: vi.fn().mockResolvedValue([]) },
  classApi: { getTeacherClasses: vi.fn().mockResolvedValue({ classes: [] }) },
  quizApi: { createQuiz: mocks.createQuiz, addQuestions: mocks.addQuestions, updateQuiz: vi.fn() },
  surveyApi: { createSurvey: mocks.createSurvey, syncQuestions: mocks.syncQuestions, updateSurvey: vi.fn() },
}));
vi.mock('wouter', () => ({ useLocation: () => ['/create-quiz', vi.fn()], useParams: () => ({}) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => children }));
vi.mock('@/components/quiz/AIQuestionGenerator', () => ({ AIQuestionGenerator: () => null }));
vi.mock('@/components/ui/image-upload', () => ({ ImageUpload: () => null }));

// Only browser APIs absent in jsdom are polyfilled; the editor, its state updates,
// question item, Radix Select and Tabs are real production components.
beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveContent.mockResolvedValue({ quiz: { id: 'audit-quiz' }, questions: [] });
  mocks.createQuiz.mockResolvedValue({ quiz: { id: 'audit-quiz' } });
  mocks.createSurvey.mockResolvedValue({ survey: { id: 'audit-survey' } });
  mocks.addQuestions.mockResolvedValue({ questions: [] });
  mocks.syncQuestions.mockResolvedValue({ questions: [] });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.history.replaceState({}, '', '/create-quiz');
});
afterEach(cleanup);

function renderEditor(contentType: 'survey' | 'exam') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><QuizBuilder contentTypeMode={contentType} embedded /></QueryClientProvider>);
  return userEvent.setup();
}

describe('Admin question editor data preservation', () => {
  it.each(['Açık Uçlu', 'Derecelendirme', 'Likert Ölçeği'])(
    'keeps the requested %s survey type during batched updates', async (label) => {
      const user = renderEditor('survey');
      await user.type(screen.getByLabelText(/Anket Başlığı/), 'Typed survey');
      await user.click(screen.getByRole('tab', { name: /Sorular/ }));
      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: new RegExp('^' + label + '$') }));
      expect(screen.getByRole('combobox')).toHaveTextContent(label);
      if (label === 'Açık Uçlu') expect(screen.queryByPlaceholderText('1. seçenek')).not.toBeInTheDocument();
      if (label === 'Derecelendirme') expect(screen.queryByPlaceholderText('1. seçenek')).not.toBeInTheDocument();
      if (label === 'Likert Ölçeği') expect(screen.getByPlaceholderText('1. seçenek')).toHaveValue('Kesinlikle katılmıyorum');
      await user.type(document.querySelector<HTMLTextAreaElement>('textarea')!, 'Survey question');
      await user.click(screen.getByRole('button', { name: /Taslak/ }));
      await waitFor(() => expect(mocks.saveContent).toHaveBeenCalledTimes(1));
      const savedQuestion = mocks.saveContent.mock.calls[0][2].questions[0];
      expect(savedQuestion.type).toBe(label === 'Açık Uçlu' ? 'open-text' : label === 'Derecelendirme' ? 'rating' : 'likert');
      expect(savedQuestion.correctAnswer).toBeNull();
    },
  );

  it('saves B as correct after choosing B and deleting the preceding A option', async () => {
    const user = renderEditor('exam');
    await user.type(screen.getByLabelText(/Sınav Başlığı/), 'Audit exam');
    await user.click(screen.getByRole('tab', { name: /Sorular/ }));
    // This textarea currently lacks a programmatic label (Q14 in the report).
    await user.type(document.querySelector<HTMLTextAreaElement>('textarea')!, 'Choose B');
    for (const [index, value] of ['A', 'B', 'C', 'D', 'E'].entries()) {
      await user.type(screen.getByPlaceholderText(`${index + 1}. seçenek`), value);
    }
    await user.click(screen.getByRole('button', { name: '1. soru: 2. seçenek doğru cevap' }));
    const firstRow = screen.getByPlaceholderText('1. seçenek').parentElement!;
    const removeOptionButton = within(firstRow).getByRole('button', { name: /seçeneği sil/ });
    await user.click(removeOptionButton);
    expect(screen.getByPlaceholderText('1. seçenek')).toHaveValue('B');
    await user.click(screen.getByRole('button', { name: /Taslak/ }));
    await waitFor(() => expect(mocks.saveContent).toHaveBeenCalledTimes(1));
    const question = mocks.saveContent.mock.calls[0][2].questions[0];
    expect(question.options).toEqual(['B', 'C', 'D', 'E']);
    expect(question.correctAnswer).toBe('B');
  });
  it('requires a new correct answer after deleting the selected option', async () => {
    const user = renderEditor('exam');
    await user.type(screen.getByLabelText(/Sınav Başlığı/), 'Audit exam');
    await user.click(screen.getByRole('tab', { name: /Sorular/ }));
    await user.type(document.querySelector<HTMLTextAreaElement>('textarea')!, 'Choose an answer');
    for (const [index, value] of ['A', 'B', 'C'].entries()) {
      await user.type(screen.getByPlaceholderText(`${index + 1}. seçenek`), value);
    }
    await user.click(screen.getByRole('button', { name: '1. soru: 2. seçenek doğru cevap' }));
    const secondRow = screen.getByPlaceholderText('2. seçenek').parentElement!;
    await user.click(within(secondRow).getByRole('button', { name: /seçeneği sil/ }));
    await user.click(screen.getByRole('button', { name: /Taslak/ }));
    expect(mocks.saveContent).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
  it('reuses the same UUID on a failed new-content save retry', async () => {
    mocks.saveContent.mockRejectedValueOnce(new Error('Connection lost'));
    const user = renderEditor('exam');
    await user.type(screen.getByLabelText(/Sınav Başlığı/), 'Retry exam');
    await user.click(screen.getByRole('tab', { name: /Sorular/ }));
    await user.type(document.querySelector<HTMLTextAreaElement>('textarea')!, 'Choose A');
    await user.type(screen.getByPlaceholderText('1. seçenek'), 'A');
    await user.type(screen.getByPlaceholderText('2. seçenek'), 'B');
    await user.click(screen.getByRole('button', { name: /Taslak/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Connection lost' })));
    await user.click(screen.getByRole('button', { name: /Taslak/ }));
    await waitFor(() => expect(mocks.saveContent).toHaveBeenCalledTimes(2));
    expect(mocks.saveContent.mock.calls[1][1]).toBe(mocks.saveContent.mock.calls[0][1]);
    expect(mocks.saveContent.mock.calls[0][1]).toMatch(/^[\da-f-]{36}$/i);
    expect(mocks.saveContent.mock.calls[0][2]).toMatchObject({ description: null, timeLimit: null, status: 'draft' });
  });
});
