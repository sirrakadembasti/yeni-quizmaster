import { apiFetch, handleResponse } from './api';
export interface AcademicYear { id: string; label: string; status: string; scheduledCloseAt: string; closedAt?: string | null; canClose?: boolean }
export interface ArchiveBlocker { id: string; status: string; code?: string; reason: string; remedy: string }
export interface ArchiveJob { id: string; academicYearId: string; label: string; mode: string; status: string; attempts: number; createdAt: string; completedAt?: string | null; error?: string | null; sizeBytes?: number | null; zipSha256?: string | null; recoveryCount?: number; lifetimeAttempts?: number; blockers?: ArchiveBlocker[]; canCancel?: boolean }
export interface TransitionRule { fromClassId: string; toClassId: string | null; graduate: boolean }
export interface ArchivePreview { quizzes: number; results: number; surveySubmissions: number; questions: number }
const base = '/api/admin/archive';
const idPath = (id: string) => encodeURIComponent(id);
async function request<T>(route: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  return handleResponse<T>(await apiFetch(`${base}${route}`, { method, credentials: 'include', signal, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }));
}
export const archiveApi = {
  years: () => request<{ serverNow: string; years: AcademicYear[] }>('/years'),
  jobs: () => request<{ jobs: ArchiveJob[] }>('/jobs'),
  job: (id: string) => request<{ job: ArchiveJob }>(`/jobs/${idPath(id)}`),
  logs: (id: string) => request<{ logs: { id: string; action: string; createdAt: string }[] }>(`/jobs/${idPath(id)}/logs`),
  preview: (quizIds: string[], academicYearId?: string, signal?: AbortSignal) => request<ArchivePreview>('/preview', 'POST', { quizIds, academicYearId }, signal),
  create: (quizIds: string[], academicYearId?: string) => request<{ job: ArchiveJob }>('', 'POST', { mode: 'manual', quizIds, academicYearId }),
  closeYear: (academicYearId: string) => request<{ job: ArchiveJob }>('/close-year', 'POST', { academicYearId }),
  retry: (id: string) => request<{ job: ArchiveJob }>(`/jobs/${idPath(id)}/retry`, 'POST'),
  cancel: (id: string) => request<{ job: ArchiveJob }>(`/jobs/${idPath(id)}/cancel`, 'POST'),
  rules: (id: string) => request<{ rules: TransitionRule[] }>(`/years/${idPath(id)}/rules`),
  saveRules: (id: string, rules: TransitionRule[]) => request<{ rules: TransitionRule[] }>(`/years/${idPath(id)}/rules`, 'PUT', { rules }),
  authorizeDownload: (id: string, password: string) => request<{ expiresAt: number }>(`/jobs/${idPath(id)}/download-authorize`, 'POST', { password }),
  async download(id: string) {
    const response = await apiFetch(`${base}/jobs/${idPath(id)}/download`, { credentials: 'include' });
    if (!response.ok) await handleResponse(response);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `archive-${id}.zip`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
