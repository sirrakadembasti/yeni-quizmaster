export type AIUsageMetadata = {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  totalTokens: number | null;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function count(value: unknown): number | null {
  // AIUsage persists counts as Prisma Int; reject out-of-range provider values
  // (and derived sums) rather than losing the entire usage row on persistence.
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647 ? value : null;
}

function sum(...values: (number | null)[]): number | null {
  if (values.some(value => value === null)) return null;
  return count(values.reduce<number>((total, value) => total + value!, 0));
}

// An omitted optional provider component contributes no tokens, but its display
// field stays unknown. A present malformed component must invalidate the sum.
function component(usage: Record<string, unknown>, key: string): number | null {
  return usage[key] === undefined ? 0 : count(usage[key]);
}

/** Extract only numeric metadata; never retain provider content or diagnostics. */
export function normalizeAIUsageMetadata(transport: string, payload: unknown): AIUsageMetadata {
  const response = record(payload);
  const result: AIUsageMetadata = { inputTokens: null, outputTokens: null, reasoningTokens: null, cacheReadTokens: null, cacheWriteTokens: null, totalTokens: null };
  if (transport === 'google') {
    const usage = record(response.usageMetadata);
    // Cached content is already included in promptTokenCount. Tool-use prompts
    // are an additional input component; thoughts are additional output tokens.
    result.inputTokens = sum(count(usage.promptTokenCount), component(usage, 'toolUsePromptTokenCount'));
    result.outputTokens = sum(count(usage.candidatesTokenCount), component(usage, 'thoughtsTokenCount'));
    result.reasoningTokens = count(usage.thoughtsTokenCount);
    result.cacheReadTokens = count(usage.cachedContentTokenCount);
    result.totalTokens = count(usage.totalTokenCount) ?? sum(result.inputTokens, result.outputTokens);
  } else if (transport === 'anthropic') {
    const usage = record(response.usage);
    // Anthropic input_tokens excludes cache creation and reads. The nested
    // cache_creation breakdown is already included in cache_creation_input_tokens.
    result.inputTokens = sum(count(usage.input_tokens), component(usage, 'cache_read_input_tokens'), component(usage, 'cache_creation_input_tokens'));
    result.outputTokens = count(usage.output_tokens);
    result.cacheReadTokens = count(usage.cache_read_input_tokens);
    result.cacheWriteTokens = count(usage.cache_creation_input_tokens);
    result.totalTokens = sum(result.inputTokens, result.outputTokens);
  } else if (transport === 'openai') {
    const usage = record(response.usage);
    result.inputTokens = count(usage.prompt_tokens);
    result.outputTokens = count(usage.completion_tokens);
    result.reasoningTokens = count(record(usage.completion_tokens_details).reasoning_tokens);
    result.cacheReadTokens = count(record(usage.prompt_tokens_details).cached_tokens);
    result.totalTokens = count(usage.total_tokens) ?? sum(result.inputTokens, result.outputTokens);
  }
  return result;
}
