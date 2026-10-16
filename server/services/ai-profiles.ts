import type { PrismaClient, AIProfile as Row } from "@prisma/client";
import { PROVIDERS } from "./ai-providers";
import { encryptAPIKey, decryptAPIKey } from "./ai-encryption";
import { normalizeRuntimeOptions } from "./ai-runtime";
import { isSafeUrl } from "../utils/external-request";
import { credentialEndpointProblem } from './ai-provider-validation';
import { classifyLLMError } from './ai-runtime';
export class AIManagementError extends Error {
    constructor(public status: number, public code: string, message: string) {
        super(message);
        this.name = "AIManagementError";
    }
}
export type AITestMode = "quick" | "questions";
export type AITestResult = {
    revision: number;
    status: "passed" | "failed";
    durationMs: number;
    code?: string;
    message?: string;
    upstreamStatus?: number;
    testedAt: string;
};
export type PublicAIProfile = {
    id: string;
    name: string;
    provider: string;
    model: string;
    baseURL: string;
    hasApiKey: boolean;
    enabled: boolean;
    revision: number;
    timeoutMs: number;
    maxOutputTokens: number;
    thinking: string;
    lastTests: Partial<Record<AITestMode, AITestResult>>;
};
export type InternalAIProfile = PublicAIProfile & {
    apiKey: string;
    transport: string;
};
export type AIProfileInput = {
    name: string;
    provider: string;
    model: string;
    baseURL: string;
    apiKey?: string;
    revision?: number;
    timeoutMs?: number;
    maxOutputTokens?: number;
    thinking?: string;
};
export type AIProfileList = {
    profiles: PublicAIProfile[];
    defaultProfileId: string | null;
    settingsRevision: number;
};
export type AIKeyGetter = () => Buffer | Promise<Buffer>;
const fail = (code: string, status = 400): never => {
    throw new AIManagementError(status, code, code === "AI_REVISION_CONFLICT" ? "AI ayarlar\u0131 de\u011Fi\u015Fti. Listeyi yenileyin." : "AI profil ayarlar\u0131 ge\u00E7ersiz veya kullan\u0131lam\u0131yor.");
};
function publicProfile(r: Row): PublicAIProfile {
    return {
        id: r.id,
        name: r.name,
        provider: r.provider,
        model: r.model,
        baseURL: r.baseURL,
        hasApiKey: !!r.encryptedApiKey,
        enabled: r.enabled,
        revision: r.revision,
        timeoutMs: r.timeoutMs,
        maxOutputTokens: r.maxOutputTokens,
        thinking: r.thinking,
        lastTests: JSON.parse(r.lastTestsJson)
    };
}
export class AIProfileStore {
    constructor(private db: PrismaClient, private getKey: AIKeyGetter) {
    }
    private async config(db: any = this.db) {
        return db.aIConfiguration.upsert({
            where: {
                id: "singleton"
            },
            create: {
                id: "singleton"
            },
            update: {}
        });
    }
    async list(): Promise<AIProfileList> {
        return this.db.$transaction(async (tx) => {
            const c = await this.config(tx);
            const rows = await tx.aIProfile.findMany({
                orderBy: {
                    name: "asc"
                }
            });
            return {
                profiles: rows.map(publicProfile),
                defaultProfileId: c.defaultProfileId,
                settingsRevision: c.revision
            };
        });
    }
    async getForAdmin(id: string): Promise<InternalAIProfile | null> {
        const r = await this.db.aIProfile.findUnique({
            where: {
                id
            }
        });
        if (!r)
            return null;
        try {
            return {
                ...publicProfile(r),
                apiKey: decryptAPIKey(r.encryptedApiKey, await this.getKey()),
                transport: PROVIDERS.find(p => p.id === r.provider)?.transport ?? "openai"
            };
        }
        catch {
            throw new AIManagementError(503, "AI_ENCRYPTION_UNAVAILABLE", "AI \u015Fifreleme anahtar\u0131 kullan\u0131lam\u0131yor.");
        }
    }
    async getEnabled(id: string): Promise<InternalAIProfile | null> {
        const state = await this.db.aIProfile.findUnique({where:{id},select:{enabled:true}});
        if (!state?.enabled) return null;
        const p = await this.getForAdmin(id);
        return p?.enabled ? p : null;
    }
    async save(input: AIProfileInput, id?: string): Promise<PublicAIProfile> {
        if (!input || typeof input !== "object" || typeof input.name !== "string" || typeof input.provider !== "string" || typeof input.model !== "string" || typeof input.baseURL !== "string" || (input.apiKey !== undefined && typeof input.apiKey !== "string")) return fail("AI_INVALID_PROFILE");
        const provider = PROVIDERS.find(p => p.id === input.provider);
        let u: URL;
        try {
            u = new URL(input.baseURL);
        }
        catch {
            return fail("AI_INVALID_PROFILE");
        }
        if (!provider || !isSafeUrl(input.baseURL) || u.search || u.hash || !input.name?.trim() || input.name.length > 120 || !input.model?.trim() || input.model.length > 256 || input.apiKey && input.apiKey.length > 8192)
            return fail("AI_INVALID_PROFILE");
        let opts;
        try {
            opts = normalizeRuntimeOptions(input);
        }
        catch {
            return fail("AI_INVALID_PROFILE");
        }
        const baseURL = input.baseURL.replace(/\/+$/, "");
        const key = input.apiKey?.trim();
        if (key) {
            const problem = credentialEndpointProblem(input.provider, baseURL, key);
            if (problem) throw new AIManagementError(400, 'AI_CREDENTIAL_ENDPOINT_MISMATCH', problem);
        }
        const encryptedApiKey = key ? encryptAPIKey(key, await this.getKey()) : undefined;
        return this.db.$transaction(async (tx) => {
            const old = id ? await tx.aIProfile.findUnique({
                where: {
                    id
                }
            }) : null;
            if (id && !old)
                return fail("AI_PROFILE_NOT_FOUND", 404);
            if (old && (!Number.isInteger(input.revision) || old.revision !== input.revision))
                return fail("AI_REVISION_CONFLICT", 409);
            if (!encryptedApiKey && (!old || old.provider !== input.provider || old.baseURL !== baseURL))
                return fail("AI_NEW_KEY_REQUIRED");
            const data = {
                name: input.name.trim(),
                provider: input.provider,
                model: input.model.trim(),
                baseURL,
                ...opts,
                encryptedApiKey: encryptedApiKey ?? old!.encryptedApiKey,
                enabled: false,
                lastTestsJson: "{}"
            };
            let result: Row;
            if (old) {
                const updated = await tx.aIProfile.updateMany({
                    where: {
                        id,
                        revision: input.revision
                    },
                    data: {
                        ...data,
                        revision: {
                            increment: 1
                        }
                    }
                });
                if (!updated.count)
                    return fail("AI_REVISION_CONFLICT", 409);
                result = (await tx.aIProfile.findUnique({
                    where: {
                        id
                    }
                }))!;
                await this.clearDefault(tx, id!);
            }
            else
                result = await tx.aIProfile.create({
                    data
                });
            return publicProfile(result);
        });
    }
    private async clearDefault(tx: any, id: string) {
        await tx.aIConfiguration.updateMany({
            where: {
                id: "singleton",
                defaultProfileId: id
            },
            data: {
                defaultProfileId: null,
                revision: {
                    increment: 1
                }
            }
        });
    }
    async remove(id: string, revision: number): Promise<void> {
        await this.db.$transaction(async (tx) => {
            if (!Number.isInteger(revision))
                return fail("AI_REVISION_CONFLICT", 409);
            const r = await tx.aIProfile.deleteMany({
                where: {
                    id,
                    revision
                }
            });
            if (!r.count)
                return fail("AI_REVISION_CONFLICT", 409);
            await this.clearDefault(tx, id);
        });
    }
    async setEnabled(id: string, revision: number, enabled: boolean): Promise<PublicAIProfile> {
        return this.db.$transaction(async (tx) => {
            const r = await tx.aIProfile.findUnique({
                where: {
                    id
                }
            });
            if (!r || !Number.isInteger(revision) || r.revision !== revision)
                return fail("AI_REVISION_CONFLICT", 409);
            const tests = JSON.parse(r.lastTestsJson);
            if (enabled && (tests.quick?.revision !== revision || tests.quick?.status !== "passed"))
                return fail("AI_TEST_REQUIRED");
            const nextRevision = revision + 1;
            if (tests.quick?.revision === revision)
                tests.quick.revision = nextRevision;
            const changed = await tx.aIProfile.updateMany({
                where: {
                    id,
                    revision
                },
                data: {
                    enabled,
                    revision: nextRevision,
                    lastTestsJson: JSON.stringify(tests)
                }
            });
            if (!changed.count)
                return fail("AI_REVISION_CONFLICT", 409);
            if (!enabled)
                await this.clearDefault(tx, id);
            return publicProfile((await tx.aIProfile.findUnique({
                where: {
                    id
                }
            }))!);
        });
    }
    async setDefault(id: string | null, settingsRevision: number, profileRevision?: number): Promise<AIProfileList> {
        await this.db.$transaction(async (tx) => {
            const c = await this.config(tx);
            if (!Number.isInteger(settingsRevision) || c.revision !== settingsRevision)
                return fail("AI_REVISION_CONFLICT", 409);
            if (id) {
                const p = await tx.aIProfile.findUnique({
                    where: {
                        id
                    }
                });
                if (!p?.enabled)
                    return fail("AI_PROFILE_DISABLED");
                if (!Number.isInteger(profileRevision) || p.revision !== profileRevision)
                    return fail("AI_REVISION_CONFLICT", 409);
            }
            const r = await tx.aIConfiguration.updateMany({
                where: {
                    id: "singleton",
                    revision: settingsRevision
                },
                data: {
                    defaultProfileId: id,
                    revision: {
                        increment: 1
                    }
                }
            });
            if (!r.count)
                return fail("AI_REVISION_CONFLICT", 409);
        });
        return this.list();
    }
    async recordTest(id: string, revision: number, mode: AITestMode, status: "passed" | "failed", details: {
        durationMs: number;
        code?: string;
        upstreamStatus?: number | null;
    }): Promise<boolean> {
        if (!["quick", "questions"].includes(mode) || !["passed", "failed"].includes(status))
            return fail("AI_INVALID_TEST");
        return this.db.$transaction(async (tx) => {
            const row = await tx.aIProfile.findUnique({
                where: {
                    id
                }
            });
            if (!row || row.revision !== revision)
                return false;
            const tests = JSON.parse(row.lastTestsJson);
            tests[mode] = {
                revision,
                status,
                durationMs: Math.max(0, Math.min(300000, Number(details.durationMs) || 0)),
                ...(details.code && /^(AI|LLM)_[A-Z_]+$/.test(details.code) ? {
                    code: details.code,
                    message: details.code === 'AI_INVALID_QUESTIONS' ? 'Model geçerli örnek soru üretemedi.' : classifyLLMError({ code: details.code, upstreamStatus: details.upstreamStatus }).message,
                } : {}),
                ...(Number.isInteger(details.upstreamStatus) && details.upstreamStatus! >= 400 && details.upstreamStatus! <= 599 ? { upstreamStatus: details.upstreamStatus! } : {}),
                testedAt: new Date().toISOString()
            };
            return (await tx.aIProfile.updateMany({
                where: {
                    id,
                    revision
                },
                data: {
                    lastTestsJson: JSON.stringify(tests)
                }
            })).count === 1;
        });
    }
}
