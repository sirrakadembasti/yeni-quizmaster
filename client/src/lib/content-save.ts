import { apiFetch, handleResponse } from './api';

export const contentSaveApi = {
  async save(contentType: 'exam' | 'survey', id: string, payload: Record<string, unknown>) {
    const response = await apiFetch(`/api/${contentType === 'survey' ? 'surveys' : 'quizzes'}/${id}/content`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload),
    });
    return handleResponse<{ quiz?: { id: string }; survey?: { id: string }; questions: unknown[] }>(response);
  },
};
