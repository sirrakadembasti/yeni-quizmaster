import { apiFetch } from './api';
import { ApiError } from './http-error';
export interface AIModel {
    id: string;
    name: string;
    provider: string;
    model: string;
}
export interface AITest {
    revision: number;
    status: 'passed' | 'failed';
    durationMs: number;
    code?: string;
    message?: string;
    upstreamStatus?: number;
    testedAt: string;
}
export interface AIProfile extends AIModel {
    baseURL: string;
    hasApiKey: boolean;
    enabled: boolean;
    revision: number;
    timeoutMs: number;
    maxOutputTokens: number;
    thinking: 'auto' | 'enabled' | 'disabled';
    lastTests: Partial<Record<'quick' | 'questions', AITest>>;
}
export interface AIProfiles {
    profiles: AIProfile[];
    defaultProfileId: string | null;
    settingsRevision: number;
}
export interface AIProvider {
    id: string;
    name: string;
    baseURL: string;
    endpoints?: { name: string; baseURL: string }[];
}
export interface AIProfileInput {
    name: string;
    provider: string;
    model: string;
    baseURL: string;
    apiKey?: string;
    revision?: number;
    timeoutMs: number;
    maxOutputTokens: number;
    thinking: 'auto' | 'enabled' | 'disabled';
}
export interface AIUsageFilters { from?:string;to?:string;teacher?:string;course?:string;quiz?:string;model?:string;status?:string;page?:number;pageSize?:number }
export interface AIUsageRow {
  id:string;createdAt:string;teacherName:string;teacherEmail:string;courseName:string;quizTitle:string;quizId:string|null;contentType:string;
  profileName:string;provider:string;model:string;questionCount:number;validQuestionCount:number|null;
  inputTokens:number|null;outputTokens:number|null;reasoningTokens:number|null;durationMs:number|null;status:string;
}
export interface AIUsageResult {
  rows:AIUsageRow[];page:number;pageSize:number;total:number;
  summary:{requests:number;inputTokens:number;outputTokens:number;unknownUsageRequests:number};
  averages:{provider?:string;model:string;thinking:string;questionCount:number;samples:number;averageOutputTokens:number;from?:string;to?:string}[];
}
async function request<T>(path: string, signal?: AbortSignal, method = 'GET', body?: unknown): Promise<T> {
    const response = await apiFetch('/api' + path, { method, signal, credentials: 'include', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new ApiError(data.message || 'AI işlemi tamamlanamadı.', response.status);
    return data;
}
export const teacherAI = {
    models: (signal?: AbortSignal) => request<{
        models: AIModel[];
        defaultProfileId: string | null;
    }>('/ai/models', signal),
    generate: (input: {
        profileId: string;
        topic: string;
        count: number;
        difficulty: string;
        contentType: 'exam' | 'survey';
        context?: {draftId?:string;quizId?:string;quizTitle?:string;categoryId?:string|null};
    }, signal?: AbortSignal) => request<{
        questions: any[];
    }>('/ai/generate-questions', signal, 'POST', input)
};
const root = '/admin/ai';
export const adminAI = {
    usage: (filters:AIUsageFilters = {},signal?:AbortSignal) => {
        const query = new URLSearchParams();
        for (const [key,value] of Object.entries(filters)) if (value !== undefined && value !== '') query.set(key,String(value));
        return request<AIUsageResult>(root + '/usage?' + query.toString(),signal);
    },
    list: (signal?: AbortSignal) => request<AIProfiles>(root + '/profiles', signal),
    catalog: (signal?: AbortSignal) => request<{
        providers: AIProvider[];
    }>(root + '/catalog', signal),
    save: (input: AIProfileInput, id?: string, signal?: AbortSignal) => request(root + '/profiles' + (id ? '/' + encodeURIComponent(id) : ''), signal, id ? 'PUT' : 'POST', input),
    remove: (p: AIProfile, signal?: AbortSignal) => request(root + '/profiles/' + encodeURIComponent(p.id), signal, 'DELETE', { revision: p.revision }),
    enabled: (p: AIProfile, signal?: AbortSignal) => request(root + '/profiles/' + encodeURIComponent(p.id) + '/enabled', signal, 'POST', { revision: p.revision, enabled: !p.enabled }),
    default: (profileId: string | null, settingsRevision: number, signal?: AbortSignal, profileRevision?: number) => request(root + '/default', signal, 'POST', { profileId, settingsRevision, ...(profileId ? { profileRevision } : {}) }),
    models: (id: string, signal?: AbortSignal) => request<{
        models: string[];
    }>(root + '/profiles/' + encodeURIComponent(id) + '/models', signal),
    test: (p: AIProfile, mode: 'quick' | 'questions', signal?: AbortSignal) => request<{
        message: string;
    }>(root + '/profiles/' + encodeURIComponent(p.id) + '/test', signal, 'POST', { revision: p.revision, mode }),
    importGemini: (name: string, model: string, signal?: AbortSignal) => request(root + '/import-gemini', signal, 'POST', { name, model })
};
