import { apiFetch, handleResponse } from './api';

export async function deleteQuizWithReason(id: string, reason: string) {
  const response = await apiFetch(`/api/quizzes/${encodeURIComponent(id)}`, {
    method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason.trim() }),
  });
  return handleResponse<{ message: string }>(response);
}
