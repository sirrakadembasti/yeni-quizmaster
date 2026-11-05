import { describe, expect, it } from 'vitest';
import * as metadata from '../../services/ai-usage-metadata';

const unknown = { inputTokens: null, outputTokens: null, reasoningTokens: null, cacheReadTokens: null, cacheWriteTokens: null, totalTokens: null };

describe('provider usage normalization', () => {
  it('keeps OpenAI and MiMo reasoning/cache as subsets of billed token counts', () => {
    expect(metadata.normalizeAIUsageMetadata('openai', { usage: {
      prompt_tokens: 100, completion_tokens: 80, total_tokens: 180,
      prompt_tokens_details: { cached_tokens: 60 }, completion_tokens_details: { reasoning_tokens: 50 },
      raw_error: 'fixture-secret',
    } })).toEqual({ inputTokens: 100, outputTokens: 80, reasoningTokens: 50, cacheReadTokens: 60, cacheWriteTokens: null, totalTokens: 180 });
  });

  it('includes Google thoughts in output without adding cached prompt tokens again', () => {
    expect(metadata.normalizeAIUsageMetadata('google', { usageMetadata: {
      promptTokenCount: 100, candidatesTokenCount: 30, thoughtsTokenCount: 50,
      cachedContentTokenCount: 60, totalTokenCount: 180,
    } })).toEqual({ inputTokens: 100, outputTokens: 80, reasoningTokens: 50, cacheReadTokens: 60, cacheWriteTokens: null, totalTokens: 180 });
  });

  it('preserves provider total including Google tool-use prompt tokens', () => {
    expect(metadata.normalizeAIUsageMetadata('google', { usageMetadata: {
      promptTokenCount: 100, toolUsePromptTokenCount: 20, candidatesTokenCount: 30,
      thoughtsTokenCount: 50, totalTokenCount: 200,
    } })).toMatchObject({ inputTokens: 120, outputTokens: 80, totalTokens: 200 });
  });

  it('includes Anthropic cache read and creation in input once', () => {
    expect(metadata.normalizeAIUsageMetadata('anthropic', { usage: {
      input_tokens: 2048, cache_read_input_tokens: 1800, cache_creation_input_tokens: 248, output_tokens: 503,
      cache_creation: { ephemeral_5m_input_tokens: 148, ephemeral_1h_input_tokens: 100 },
    } })).toEqual({ inputTokens: 4096, outputTokens: 503, reasoningTokens: null, cacheReadTokens: 1800, cacheWriteTokens: 248, totalTokens: 4599 });
  });

  it.each(['openai', 'google', 'anthropic'])('keeps missing %s usage unknown', transport => {
    expect(metadata.normalizeAIUsageMetadata(transport, {})).toEqual(unknown);
    expect(metadata.normalizeAIUsageMetadata(transport, null)).toEqual(unknown);
  });

  it.each([-1, 1.5, Infinity, NaN, '12', true, {}, Number.MAX_SAFE_INTEGER + 1])('rejects invalid token count %s without coercion', value => {
    expect(metadata.normalizeAIUsageMetadata('openai', { usage: {
      prompt_tokens: value, completion_tokens: value, total_tokens: value,
      prompt_tokens_details: { cached_tokens: value }, completion_tokens_details: { reasoning_tokens: value },
    } })).toEqual(unknown);
  });

  it('retains explicit zeros and leaves absent subcounts unknown', () => {
    expect(metadata.normalizeAIUsageMetadata('openai', { usage: { prompt_tokens: 0, completion_tokens: 0 } }))
      .toEqual({ ...unknown, inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    expect(metadata.normalizeAIUsageMetadata('anthropic', { usage: { input_tokens: 10, output_tokens: 5 } }))
      .toEqual({ ...unknown, inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(metadata.normalizeAIUsageMetadata('google', { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } }))
      .toEqual({ ...unknown, inputTokens: 10, outputTokens: 5, totalTokens: 15 });
  });

  it('does not infer missing top-level counts from provider totals', () => {
    expect(metadata.normalizeAIUsageMetadata('openai', { usage: { total_tokens: 15 } }))
      .toEqual({ ...unknown, totalTokens: 15 });
  });

  it('does not overflow derived totals or accept malformed cache components as zero', () => {
    expect(metadata.normalizeAIUsageMetadata('openai', { usage: { prompt_tokens: Number.MAX_SAFE_INTEGER, completion_tokens: 1 } }).totalTokens).toBeNull();
    expect(metadata.normalizeAIUsageMetadata('anthropic', { usage: { input_tokens: 10, cache_read_input_tokens: -1, output_tokens: 5 } }))
      .toMatchObject({ inputTokens: null, outputTokens: 5, totalTokens: null });
  });

  it('keeps normalized and derived counts within the persisted signed Int range', () => {
    expect(metadata.normalizeAIUsageMetadata('openai', { usage: {
      prompt_tokens: 2147483648, completion_tokens: 2147483647,
      prompt_tokens_details: { cached_tokens: 2147483648 }, completion_tokens_details: { reasoning_tokens: 2147483648 },
    } })).toEqual({ ...unknown, outputTokens: 2147483647 });
    expect(metadata.normalizeAIUsageMetadata('google', { usageMetadata: {
      promptTokenCount: 2147483647, toolUsePromptTokenCount: 1, candidatesTokenCount: 2147483647, thoughtsTokenCount: 1,
    } })).toMatchObject({ inputTokens: null, outputTokens: null, totalTokens: null, reasoningTokens: 1 });
    expect(metadata.normalizeAIUsageMetadata('anthropic', { usage: {
      input_tokens: 2147483647, cache_read_input_tokens: 1, output_tokens: 1,
    } })).toMatchObject({ inputTokens: null, outputTokens: 1, totalTokens: null });
  });
});
