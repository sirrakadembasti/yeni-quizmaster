import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIQuestionGenerator } from '@/components/quiz/AIQuestionGenerator';

const api = vi.hoisted(() => ({ testAIConfig: vi.fn(), generateQuestions: vi.fn() }));
vi.mock('@/lib/api', () => ({ aiApi: api }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

beforeEach(() => {
  api.testAIConfig.mockReset().mockResolvedValue({ success: true, message: 'Ready' });
  api.generateQuestions.mockReset();
});
afterEach(cleanup);

async function openConfig() {
  const user = userEvent.setup();
  render(<AIQuestionGenerator onGenerate={vi.fn()} quizTitle="Synthetic arithmetic" />);
  await user.click(screen.getByRole('button', { name: 'AI ile Soruları Üret' }));
  await user.click(screen.getByRole('button', { name: /Gelişmiş Yapılandırma/ }));
  return user;
}

it.each(['base', 'key', 'model'])('editing the %s clears successful readiness and requires a new probe', async (field) => {
  const user = await openConfig();
  await user.click(screen.getByRole('button', { name: 'Yapılandırmayı Test Et' }));
  await screen.findByText('HAZIR');
  expect(screen.getByRole('button', { name: 'Sınav Sorularını Üret' })).toBeEnabled();
  const placeholders = { base: 'https://.../v1/', key: 'Girilmezse sunucu anahtarı kullanılır', model: 'Örn: gpt-4o, claude-3-opus...' };
  fireEvent.change(screen.getByPlaceholderText(placeholders[field as keyof typeof placeholders]), { target: { value: field === 'base' ? 'https://provider.example/v1/' : 'changed-value' } });
  expect(screen.queryByText('HAZIR')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sınav Sorularını Üret' })).toBeDisabled();
});

it('a probe response for settings edited while pending cannot restore readiness', async () => {
  let resolveProbe!: (result: any) => void;
  api.testAIConfig.mockImplementation(() => new Promise((resolve) => { resolveProbe = resolve; }));
  const user = await openConfig();
  await user.click(screen.getByRole('button', { name: 'Yapılandırmayı Test Et' }));
  fireEvent.change(screen.getByPlaceholderText('https://.../v1/'), { target: { value: 'https://provider.example/v1/' } });
  resolveProbe({ success: true, message: 'Old settings ready' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Yapılandırmayı Test Et' })).toBeEnabled());
  expect(screen.queryByText('HAZIR')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sınav Sorularını Üret' })).toBeDisabled();
});
