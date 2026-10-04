import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ParentResultsPage from '@/pages/parent-results';

const fixture = vi.hoisted(() => ({ imageUrl: '/uploads/question.png', answer: 'A' as string | null, correct: true }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock('wouter', () => ({ useSearch: () => 'studentId=child', useLocation: () => ['/parent/results', vi.fn()] }));
vi.mock('@tanstack/react-query', () => ({ useQuery: ({ queryKey }: any) => {
  const detail = { quiz: { title: 'Image Exam' }, result: { studentId: 'child', score: 100, correctAnswersCount: 1, totalQuestions: 1 }, questions: [{ id: 'question', text: 'Find the pictured answer', imageUrl: fixture.imageUrl, studentAnswer: fixture.answer, correctAnswer: 'A', isCorrect: fixture.correct }] };
  const data = queryKey[1] === 'students' ? { students: [{ id: 'child', name: 'Linked Child' }] } : queryKey[1] === 'overview' ? { student: { id: 'child' }, results: [{ id: 'result', quiz: { title: 'Image Exam' }, score: 100 }] } : detail;
  return { data, isSuccess: true, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
} }));

describe('parent result question images and answer status', () => {
  beforeEach(() => { fixture.imageUrl = '/uploads/question.png'; fixture.answer = 'A'; fixture.correct = true; });
  const openDetail = () => { render(<ParentResultsPage />); fireEvent.click(screen.getByRole('button', { name: /^Detay$/ })); };

  it('shows the uploaded question image with a useful alternative text', () => {
    openDetail();
    expect(screen.getByRole('img', { name: 'Soru 1 görseli' })).toHaveAttribute('src', '/uploads/question.png');
  });
  it('shows an image failure message when a valid source fails to load', () => {
    openDetail();
    fireEvent.error(screen.getByRole('img', { name: 'Soru 1 görseli' }));
    expect(screen.getByText('Soru 1 görseli yüklenemedi.')).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it.each(['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml,<svg/>'])('does not render unsafe image source %s', imageUrl => {
    fixture.imageUrl = imageUrl;
    openDetail();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Soru 1 görseli yüklenemedi.')).toBeVisible();
  });
  it.each(['https://example.test/question.png', 'data:image/png;base64,aW1hZ2U='])('renders an allowed image source %s', imageUrl => {
    fixture.imageUrl = imageUrl;
    openDetail();
    expect(screen.getByRole('img', { name: 'Soru 1 görseli' })).toHaveAttribute('src', imageUrl);
  });
  it('describes unanswered questions separately from incorrect answers', () => {
    fixture.answer = null; fixture.correct = false;
    openDetail();
    expect(screen.getByText('Yanıt durumu: Yanıtsız')).toBeVisible();
  });
});
