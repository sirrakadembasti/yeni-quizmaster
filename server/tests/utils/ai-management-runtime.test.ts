import { it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptAPIKey, decryptAPIKey } from '../../services/ai-encryption';
import { generateProfileResponse, generateProfileResponseDetailed } from '../../services/ai-runtime';
vi.mock('../../utils/external-request', () => ({ safeExternalFetch: vi.fn(), isSafeUrl: (u: string) => u.startsWith('https://') }));
import { safeExternalFetch } from '../../utils/external-request';
it.each([429, 402])('retains numeric usage from HTTP %s errors without private diagnostics', async upstreamStatus => {
  const profile: any = { transport: 'openai', provider: 'openai', baseURL: 'https://example.com', apiKey: 'fixture-private-key', model: 'm', timeoutMs: 5000, maxOutputTokens: 256, thinking: 'auto' };
  vi.mocked(safeExternalFetch).mockResolvedValue(new Response(JSON.stringify({
    error: { message: 'fixture-private-key fixture-private-prompt diagnostic', code: 'private-code' },
    usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20, completion_tokens_details: { reasoning_tokens: 5 }, raw: 'fixture-private-key' },
  }), { status: upstreamStatus }));
  const error = await generateProfileResponseDetailed([], profile).catch(e => e);
  expect(error).toMatchObject({ upstreamStatus, usage: { inputTokens: 12, outputTokens: 8, reasoningTokens: 5, cacheReadTokens: null, cacheWriteTokens: null, totalTokens: 20 } });
  expect(String(error)).toBe('Error: AI upstream request failed.');
  expect(JSON.stringify(error)).not.toContain('private');
  expect(Object.keys(error).sort()).toEqual(['upstreamStatus', 'usage']);
});
it('keeps generic HTTP errors when upstream sends a non-JSON private body', async () => {
  vi.mocked(safeExternalFetch).mockResolvedValue(new Response('fixture-private-key and private diagnostics', { status: 429 }));
  const error = await generateProfileResponseDetailed([], { transport: 'openai', provider: 'openai', baseURL: 'https://example.com', apiKey: 'fixture-private-key', model: 'm', timeoutMs: 5000, maxOutputTokens: 256, thinking: 'auto' } as any).catch(e => e);
  expect(error).toMatchObject({ upstreamStatus: 429 });
  expect(String(error)).toBe('Error: AI upstream request failed.');
  expect(JSON.stringify(error)).not.toContain('private');
});
it('returns normalized usage and finish reason while the text wrapper preserves whitespace', async () => {
  const profile: any = { transport: 'openai', provider: 'openai', baseURL: 'https://example.com', apiKey: 'fixture-secret', model: 'm', timeoutMs: 5000, maxOutputTokens: 256, thinking: 'auto' };
  const payload = { choices: [{ message: { content: ' ok\n' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18, completion_tokens_details: { reasoning_tokens: 5 } } };
  vi.mocked(safeExternalFetch).mockImplementation(async () => new Response(JSON.stringify(payload)));
  expect(await generateProfileResponseDetailed([], profile)).toEqual({ text: ' ok\n', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 8, reasoningTokens: 5, cacheReadTokens: null, cacheWriteTokens: null, totalTokens: 18 } });
  expect(await generateProfileResponse([], profile)).toBe(' ok\n');
});
it.each(['openai', 'google', 'anthropic'])('retains safe usage on truncated and empty %s responses', async transport => {
  const profile: any = { transport, provider: transport, baseURL: 'https://example.com', apiKey: 'fixture-secret', model: 'm', timeoutMs: 5000, maxOutputTokens: 256, thinking: 'auto' };
  for (const truncated of [true, false]) {
    const payload = transport === 'google'
      ? { candidates: [{ content: { parts: [{ text: truncated ? 'fixture-secret partial' : '' }] }, finishReason: truncated ? 'MAX_TOKENS' : 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15, raw: 'fixture-secret' } }
      : transport === 'anthropic'
        ? { content: [{ type: 'text', text: truncated ? 'fixture-secret partial' : '' }], stop_reason: truncated ? 'max_tokens' : 'end_turn', usage: { input_tokens: 10, output_tokens: 5, raw: 'fixture-secret' } }
        : { choices: [{ message: { content: truncated ? 'fixture-secret partial' : '' }, finish_reason: truncated ? 'length' : 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, raw: 'fixture-secret' } };
    vi.mocked(safeExternalFetch).mockResolvedValue(new Response(JSON.stringify(payload)));
    const error = await generateProfileResponseDetailed([{ role: 'user', content: 'fixture-secret prompt' }], profile).catch(e => e);
    expect(error).toMatchObject({ code: truncated ? 'LLM_TRUNCATED' : 'LLM_EMPTY_RESPONSE', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } });
    expect(JSON.stringify(error)).not.toContain('fixture-secret');
    expect(String(error)).not.toContain('fixture-secret');
  }
});
it('encrypts and authenticates keys', () => { const k = randomBytes(32), c = encryptAPIKey('secret', k); expect(c).not.toContain('secret'); expect(decryptAPIKey(c, k)).toBe('secret'); expect(() => decryptAPIKey(c, randomBytes(32))).toThrow(); });
for (const [transport, payload] of [['openai', { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }], ['google', { candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] }], ['anthropic', { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }]] as const)
    it(transport, async () => { vi.mocked(safeExternalFetch).mockResolvedValue(new Response(JSON.stringify(payload))); expect(await generateProfileResponse([], { transport, provider: transport, baseURL: 'https://example.com', apiKey: 's', model: 'm', timeoutMs: 5000, maxOutputTokens: 256, thinking: 'auto' } as any)).toBe('ok'); });
it('rejects truncated output for every transport and purpose', async () => { for (const transport of ['openai', 'google', 'anthropic'])
    for (const purpose of ['quick', 'questions'] as const) {
        const payload = transport === 'openai' ? { choices: [{ message: { content: 'partial' }, finish_reason: 'length' }] } : transport === 'google' ? { candidates: [{ content: { parts: [{ text: 'partial' }] }, finishReason: 'MAX_TOKENS' }] } : { content: [{ type: 'text', text: 'partial' }], stop_reason: 'max_tokens' };
        vi.mocked(safeExternalFetch).mockResolvedValue(new Response(JSON.stringify(payload)));
        await expect(generateProfileResponse([], { transport, provider: transport, baseURL: 'https://example.com', apiKey: 's', model: 'm', timeoutMs: 5000, maxOutputTokens: 256, thinking: 'auto' } as any, { purpose })).rejects.toMatchObject({ code: 'LLM_TRUNCATED' });
    } });
import { classifyLLMError, fetchProfileModels } from '../../services/ai-runtime';
it('uses documented JSON mode only for supported MiMo question requests', async () => {
  const p: any = { provider:'xiaomi_mimo',transport:'openai',model:'mimo-v2.6-flash',baseURL:'https://api.xiaomimimo.com/v1',apiKey:'sk-fixture',timeoutMs:120000,maxOutputTokens:8192,thinking:'auto' };
  for(const purpose of ['quick','questions'] as const){
    vi.mocked(safeExternalFetch).mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'{"questions":[]}'}}]})));
    await generateProfileResponse([],p,{purpose,jsonObject:true} as any);
    const body=JSON.parse(vi.mocked(safeExternalFetch).mock.calls.at(-1)![1]!.body as string);
    expect(body.response_format).toEqual(purpose==='questions'?{type:'json_object'}:undefined);
  }
});
it.each([[402, 'LLM_BILLING'], [403, 'LLM_FORBIDDEN'], [401, 'LLM_AUTH']])('explains HTTP %s without exposing upstream text', (upstreamStatus, code) => {
  const result = classifyLLMError({ upstreamStatus, message: 'synthetic-secret' });
  expect(result.code).toBe(code); expect(result.retryable).toBe(false);
  expect(JSON.stringify(result)).not.toContain('synthetic-secret');
});
it('caps quick tests while preserving question generation settings', async () => {
  const profile: any = { transport: 'openai', provider: 'xiaomi_mimo', baseURL: 'https://api.xiaomimimo.com/v1', apiKey: 'sk-fixture', model: 'mimo-v2.6-flash', timeoutMs: 120000, maxOutputTokens: 32000, thinking: 'auto' };
  for (const purpose of ['quick', 'questions'] as const) {
    vi.mocked(safeExternalFetch).mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] })));
    await generateProfileResponse([], profile, { purpose });
    const opts = vi.mocked(safeExternalFetch).mock.calls.at(-1)![1]!;
    const body = JSON.parse(opts.body as string);
    expect(body.max_completion_tokens).toBe(purpose === 'quick' ? 512 : 32000);
    expect(body.thinking).toEqual(purpose === 'quick' ? { type: 'disabled' } : undefined);
    expect(opts.timeoutMs).toBe(purpose === 'quick' ? 20000 : 120000);
  }
});
it('filters unsupported Google models and deduplicates discovered IDs', async () => {
  vi.mocked(safeExternalFetch).mockResolvedValue(new Response(JSON.stringify({ models: [
    { name: 'models/embed', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/generate', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/generate', supportedGenerationMethods: ['generateContent'] },
  ] })));
  expect(await fetchProfileModels({ transport: 'google', provider: 'google', baseURL: 'https://example.com', apiKey: 'fixture', timeoutMs: 5000 } as any)).toEqual(['generate']);
});
it('follows native model pagination without forwarding credentials to another host', async () => {
  vi.mocked(safeExternalFetch).mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: 'models/first', supportedGenerationMethods: ['generateContent'] }], nextPageToken: 'page/2' }))).mockResolvedValueOnce(new Response(JSON.stringify({ models: [{ name: 'models/second', supportedGenerationMethods: ['generateContent'] }] })));
  expect(await fetchProfileModels({ transport: 'google', provider: 'google', baseURL: 'https://example.com/v1beta', apiKey: 'fixture', timeoutMs: 5000 } as any)).toEqual(['first', 'second']);
  expect(String(vi.mocked(safeExternalFetch).mock.calls.at(-1)![0])).toBe('https://example.com/v1beta/models?pageSize=100&pageToken=page%2F2');
});
it.each(['openai', 'google', 'anthropic'])('builds the %s wire request with only its own auth header', async transport => {
  const payload = transport === 'google' ? { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } : transport === 'anthropic' ? { content: [{ type: 'text', text: 'ok' }] } : { choices: [{ message: { content: 'ok' } }] };
  vi.mocked(safeExternalFetch).mockResolvedValue(new Response(JSON.stringify(payload)));
  await generateProfileResponse([{ role: 'system', content: 'rules' }, { role: 'user', content: 'question' }], { transport, provider: transport, baseURL: 'https://example.com/v1', apiKey: 'synthetic-secret', model: 'm', timeoutMs: 5000, maxOutputTokens: 256, thinking: 'auto' } as any);
  const [url, options] = vi.mocked(safeExternalFetch).mock.calls.at(-1)!;
  const headers = options!.headers as Record<string, string>, body = JSON.parse(options!.body as string);
  expect(options!.signal).toBeDefined();
  if (transport === 'google') {
    expect(url).toBe('https://example.com/v1/models/m:generateContent');
    expect(headers['x-goog-api-key']).toBe('synthetic-secret'); expect(headers.Authorization).toBeUndefined();
    expect(body.systemInstruction.parts[0].text).toBe('rules'); expect(body.contents[0].parts[0].text).toBe('question');
  } else if (transport === 'anthropic') {
    expect(url).toBe('https://example.com/v1/messages'); expect(headers['x-api-key']).toBe('synthetic-secret');
    expect(headers.Authorization).toBeUndefined(); expect(body.system).toBe('rules'); expect(body.max_tokens).toBe(256);
  } else {
    expect(url).toBe('https://example.com/v1/chat/completions'); expect(headers.Authorization).toBe('Bearer synthetic-secret');
    expect(headers['x-goog-api-key']).toBeUndefined(); expect(body.max_completion_tokens).toBe(256);
  }
});
it('redacts provider response bodies and bounds model lists', async () => { const p: any = { transport: 'openai', provider: 'openai', baseURL: 'https://example.com', apiKey: 'fixture-secret', model: 'm', timeoutMs: 5000, maxOutputTokens: 256, thinking: 'auto' }; vi.mocked(safeExternalFetch).mockResolvedValue(new Response('fixture-secret upstream diagnostic', { status: 401 })); try {
    await generateProfileResponse([], p);
    throw new Error('expected failure');
}
catch (e) {
    expect(classifyLLMError(e).code).toBe('LLM_AUTH');
    expect(JSON.stringify(classifyLLMError(e))).not.toContain('fixture-secret');
} vi.mocked(safeExternalFetch).mockResolvedValue(new Response(JSON.stringify({ data: Array.from({ length: 600 }, (_, i) => ({ id: `model-${i}` })) }))); expect(await fetchProfileModels(p)).toHaveLength(500); });
