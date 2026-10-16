import { safeExternalFetch, isSafeUrl } from "../utils/external-request";
import type { InternalAIProfile } from "./ai-profiles";
import { credentialEndpointProblem, supportsQuestionJSON } from './ai-provider-validation';
import { normalizeAIUsageMetadata, type AIUsageMetadata } from './ai-usage-metadata';
export type { AIUsageMetadata } from './ai-usage-metadata';
export type AIResponseDetailed = { text: string; usage: AIUsageMetadata; finishReason?: string };
export type AIMessage = {
    role: "system" | "assistant" | "user";
    content: string;
};
export type AIRuntimeOptions = {
    signal?: AbortSignal;
    purpose?: "quick" | "questions";
    jsonObject?: boolean;
};
export function normalizeRuntimeOptions(input: {
    timeoutMs?: number;
    maxOutputTokens?: number;
    thinking?: string;
} = {}) {
    const timeoutMs = input.timeoutMs ?? 120000, maxOutputTokens = input.maxOutputTokens ?? 8192, thinking = input.thinking ?? "auto";
    if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 300000 || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 32768 || !["auto", "enabled", "disabled"].includes(thinking))
        throw new Error("Invalid AI runtime settings.");
    return {
        timeoutMs,
        maxOutputTokens,
        thinking
    };
}
export function classifyLLMError(error: unknown) {
    const e = error as any, upstreamStatus = Number(e?.upstreamStatus) || null;
    let code = "LLM_PROVIDER_ERROR", status = 502, message = "Model sa\u011Flay\u0131c\u0131s\u0131ndan yan\u0131t al\u0131namad\u0131.", retryable = true;
    if (/timeout|abort/i.test(String(e?.name) + " " + String(e?.message))) {
        code = "LLM_TIMEOUT";
        status = 504;
        message = "Model yan\u0131t\u0131 s\u00FCre s\u0131n\u0131r\u0131n\u0131 a\u015Ft\u0131.";
    }
    else if (upstreamStatus === 429) {
        code = "LLM_RATE_LIMIT";
        message = "Sa\u011Flay\u0131c\u0131 h\u0131z veya kota s\u0131n\u0131r\u0131na ula\u015F\u0131ld\u0131.";
    }
    else if (upstreamStatus === 402) {
        code = 'LLM_BILLING';
        message = 'Sağlayıcı ödeme veya bakiye nedeniyle isteği reddetti. Hesabınızdaki bakiye ve aboneliği kontrol edin.';
        retryable = false;
    }
    else if (upstreamStatus === 403) {
        code = 'LLM_FORBIDDEN';
        message = 'Bu anahtarın model veya hizmet erişim izni yok. Sağlayıcı hesabındaki yetkileri kontrol edin.';
        retryable = false;
    }
    else if (e?.code === 'AI_CREDENTIAL_ENDPOINT_MISMATCH') {
        code = 'AI_CREDENTIAL_ENDPOINT_MISMATCH';
        message = 'Xiaomi anahtar türü ile API adresi eşleşmiyor. PAYG / Token Plan hizmetini ve bölgesini kontrol edin.';
        retryable = false;
    }
    else if (upstreamStatus === 401) {
        code = "LLM_AUTH";
        message = "Sa\u011Flay\u0131c\u0131 anahtar\u0131 veya model eri\u015Fimini reddetti.";
        retryable = false;
    }
    else if (upstreamStatus === 400 || upstreamStatus === 404) {
        code = "LLM_REQUEST_REJECTED";
        message = "Sa\u011Flay\u0131c\u0131 model veya istek ayarlar\u0131n\u0131 reddetti.";
        retryable = false;
    }
    else if (["LLM_EMPTY_RESPONSE", "LLM_TRUNCATED"].includes(e?.code)) {
        code = e.code;
        message = code === "LLM_TRUNCATED" ? "Model yan\u0131t\u0131 token s\u0131n\u0131r\u0131nda kesildi." : "Model kullan\u0131labilir yan\u0131t \u00FCretmedi.";
    }
    else if (/network|fetch|DNS|ECONN|ENOTFOUND/i.test(String(e?.message))) {
        code = "LLM_NETWORK";
        message = "Sa\u011Flay\u0131c\u0131ya a\u011F ba\u011Flant\u0131s\u0131 kurulamad\u0131.";
    }
    const savedCodes: Record<string, string> = {
        LLM_TIMEOUT: 'Model yanıtı süre sınırını aştı.',
        LLM_NETWORK: 'Sağlayıcıya ağ bağlantısı kurulamadı.',
        LLM_AUTH: 'Sağlayıcı anahtarı kabul etmedi. Anahtar türünü ve hizmet adresini kontrol edin.',
        LLM_BILLING: 'Sağlayıcı ödeme veya bakiye nedeniyle isteği reddetti. Hesabınızdaki bakiye ve aboneliği kontrol edin.',
        LLM_FORBIDDEN: 'Bu anahtarın model veya hizmet erişim izni yok.',
        LLM_RATE_LIMIT: 'Sağlayıcı hız veya kota sınırına ulaşıldı.',
        LLM_REQUEST_REJECTED: 'Sağlayıcı model veya istek ayarlarını reddetti.',
    };
    if (!upstreamStatus && savedCodes[e?.code]) { code = e.code; message = savedCodes[code]; }
    return {
        code,
        status,
        message,
        error: message,
        retryable,
        upstreamStatus
    };
}
function baseURL(profile: InternalAIProfile) {
    if (!isSafeUrl(profile.baseURL))
        throw new Error("UNSAFE_EXTERNAL_URL");
    const u = new URL(profile.baseURL);
    if (u.search || u.hash)
        throw new Error("UNSAFE_EXTERNAL_URL");
    return profile.baseURL.replace(/\/+$/, "").replace(/\/(chat\/completions|messages|models)$/, "");
}
function headers(p: InternalAIProfile): Record<string, string> {
    return p.transport === "google" ? {
        "x-goog-api-key": p.apiKey
    } : p.transport === "anthropic" ? {
        "x-api-key": p.apiKey,
        "anthropic-version": "2023-06-01"
    } : {
        Authorization: `Bearer ${p.apiKey}`
    };
}
async function call(url: string, p: InternalAIProfile, options: RequestInit) {
    if (credentialEndpointProblem(p.provider, p.baseURL, p.apiKey))
        throw Object.assign(new Error('Credential endpoint mismatch'), { code: 'AI_CREDENTIAL_ENDPOINT_MISMATCH' });
    const response = await safeExternalFetch(url, {
        ...options,
        headers: {
            ...headers(p),
            "content-type": "application/json"
        },
        signal: options.signal ?? AbortSignal.timeout(p.timeoutMs),
        timeoutMs: p.timeoutMs
    });
    if (!response.ok) {
        // safeExternalFetch bounds the body size before returning this response.
        // Error bodies may contain billed usage; retain only normalized numbers,
        // never the upstream message, raw payload, or JSON parsing exception.
        let usage: AIUsageMetadata | undefined;
        try { usage = normalizeAIUsageMetadata(p.transport, await response.json()); }
        catch { /* Non-JSON error pages still retain their HTTP classification. */ }
        throw Object.assign(new Error("AI upstream request failed."), {
            upstreamStatus: response.status,
            ...(usage ? { usage } : {})
        });
    }
    return response.json();
}
export async function generateProfileResponse(messages: AIMessage[], profile: InternalAIProfile, options: AIRuntimeOptions = {}): Promise<string> {
    return (await generateProfileResponseDetailed(messages, profile, options)).text;
}
export async function generateProfileResponseDetailed(messages: AIMessage[], profile: InternalAIProfile, options: AIRuntimeOptions = {}): Promise<AIResponseDetailed> {
    const { timeoutMs, maxOutputTokens, thinking } = resolveRuntimePolicy(profile, options), base = baseURL(profile), system = messages.filter(m => m.role === "system").map(m => m.content).join("\n");
    let url = base + "/chat/completions";
    let body: any = {
        model: profile.model,
        messages,
        [profile.provider === "openai" || profile.provider === "xiaomi_mimo" ? "max_completion_tokens" : "max_tokens"]: maxOutputTokens
    };
    if (profile.transport === "google") {
        url = base + "/models/" + encodeURIComponent(profile.model) + ":generateContent";
        body = {
            generationConfig: {
                maxOutputTokens
            },
            contents: messages.filter(m => m.role !== "system").map(m => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{
                        text: m.content
                    }]
            })),
            ...(system ? {
                systemInstruction: {
                    parts: [{
                            text: system
                        }]
                }
            } : {})
        };
    }
    else if (profile.transport === "anthropic") {
        url = base + "/messages";
        body = {
            model: profile.model,
            max_tokens: maxOutputTokens,
            messages: messages.filter(m => m.role !== "system"),
            system
        };
    }
    else if (profile.provider === "xiaomi_mimo" && thinking !== "auto")
        body.thinking = {
            type: thinking
        };
    if (options.purpose === 'questions' && options.jsonObject && supportsQuestionJSON(profile)) body.response_format = { type: 'json_object' };
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
    const p: any = await call(url, { ...profile, timeoutMs }, {
        method: "POST",
        body: JSON.stringify(body),
        signal
    });
    const finish = p.choices?.[0]?.finish_reason ?? p.candidates?.[0]?.finishReason ?? p.stop_reason;
    const usage = normalizeAIUsageMetadata(profile.transport, p);
    if (["length", "MAX_TOKENS", "max_tokens"].includes(finish))
        throw Object.assign(new Error("AI response truncated."), {
            code: "LLM_TRUNCATED", usage
        });
    const content = profile.transport === "google" ? p.candidates?.[0]?.content?.parts?.map((v: any) => v.text ?? "").join("\n") : profile.transport === "anthropic" ? p.content?.filter((v: any) => v.type === "text").map((v: any) => v.text).join("\n") : p.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim())
        throw Object.assign(new Error("AI response empty."), {
            code: "LLM_EMPTY_RESPONSE", usage
        });
    return { text: content, usage, ...(typeof finish === 'string' ? { finishReason: finish } : {}) };
}
export async function fetchProfileModels(profile: InternalAIProfile, options: {
    signal?: AbortSignal;
} = {}): Promise<string[]> {
    const deadline = AbortSignal.timeout(Math.min(profile.timeoutMs, 10000));
    const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
    const models = new Set<string>();
    let cursor = '';
    const seen = new Set<string>();
    for (let page = 0; page < 10; page++) {
        const url = new URL(baseURL(profile) + '/models');
        if (profile.transport === 'google') { url.searchParams.set('pageSize', '100'); if (cursor) url.searchParams.set('pageToken', cursor); }
        if (profile.transport === 'anthropic') { url.searchParams.set('limit', '100'); if (cursor) url.searchParams.set('after_id', cursor); }
        const p: any = await call(url.toString(), { ...profile, timeoutMs: Math.min(profile.timeoutMs, 10000) }, { method: 'GET', signal });
        const rows = profile.transport === 'google' ? p.models : p.data;
        if (!Array.isArray(rows)) break;
        for (const row of rows) {
            if (profile.transport === 'google' && !row.supportedGenerationMethods?.includes('generateContent')) continue;
            const id = String(row.id ?? row.name ?? '').replace(/^models\//, '');
            if (id.length > 0 && id.length <= 160) models.add(id);
            if (models.size >= 500) return [...models];
        }
        const next = profile.transport === 'google' ? p.nextPageToken : profile.transport === 'anthropic' && p.has_more ? p.last_id : '';
        if (typeof next !== 'string' || !next || seen.has(next)) break;
        seen.add(next); cursor = next;
    }
    return [...models];
}

export function resolveRuntimePolicy(profile: Pick<InternalAIProfile, 'timeoutMs' | 'maxOutputTokens' | 'thinking' | 'provider'>, options: AIRuntimeOptions = {}) {
    const settings = normalizeRuntimeOptions(profile);
    return options.purpose === 'quick' ? { ...settings, timeoutMs: Math.min(settings.timeoutMs, 20000), maxOutputTokens: Math.min(settings.maxOutputTokens, 512), thinking: profile.provider === 'xiaomi_mimo' ? 'disabled' : settings.thinking } : settings;
}
