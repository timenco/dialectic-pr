# Claude API Adapter

## Purpose

Manages communication with Anthropic's Claude API, implementing advanced features including prompt caching, extended thinking, JSON schema mode, and comprehensive cost tracking with cache optimization.

## Location

[src/adapters/claude-api.ts](../../src/adapters/claude-api.ts)

## Dependencies

```yaml
external:
  - "@anthropic-ai/sdk": "^0.30.0"
internal:
  - core/types.spec.md
  - adapters/retry-handler.spec.md
  - utils/logger.spec.md
```

## Core Responsibility

- Send messages to Claude API with optimized configuration
- Parse prompts into cacheable system messages and dynamic user messages
- Enable extended thinking for complex reasoning (2000 token budget)
- Enforce JSON schema for guaranteed valid structured output
- Implement prompt caching for 90% cost reduction on repeated calls
- Calculate costs accounting for cache hits/misses and token usage
- Support both streaming and non-streaming responses
- Validate API keys before use

## Key Interface

```typescript
export class ClaudeAdapter {
  constructor(apiKey: string, model?: string);

  async sendMessage(
    prompt: string,
    options: ClaudeOptions
  ): Promise<ClaudeResponse>;

  async sendMessageStream(
    prompt: string,
    options: ClaudeOptions,
    onChunk: (text: string) => void
  ): Promise<ClaudeResponse>;

  getModel(): string;
  async validateApiKey(): Promise<boolean>;
}

interface ClaudeOptions {
  model?: string;
  maxTokens: number;
  temperature?: number;
}

interface ClaudeResponse {
  text: string;
  usage: TokenUsage;
}
```

## Claude Sonnet 4 Features

This adapter leverages three key Claude Sonnet 4 optimizations:

1. **Prompt Caching**: System messages (agent instructions, false positive patterns, framework rules) are marked with cache_control breakpoints, achieving 90% cost savings on subsequent reviews in the same repo.

2. **Extended Thinking**: Enabled with 2000 token budget, allowing Claude to reason internally before responding, improving issue detection quality.

3. **JSON Schema Mode**: Enforces strict structured output matching the ReviewResult schema, eliminating JSON parsing errors.

## Cost Optimization

Cache-aware pricing calculation:
- Regular input tokens: $0.003 per 1K
- Cache creation tokens: $0.003 per 1K (first call)
- Cache read tokens: $0.0003 per 1K (90% discount)
- Output tokens: $0.015 per 1K

Expected performance:
- First PR in repo: ~$0.10 per review
- Subsequent PRs: ~$0.01 per review (90% savings)
- Cache hit latency: 3s vs 8s without cache

## Error Handling

Integrates with RetryHandler for automatic retry on:
- 429 (rate limit)
- 500, 502, 503, 504 (server errors)

Non-retryable errors (400, 401, 403) throw immediately.

## Related Specs

- [retry-handler.spec.md](./retry-handler.spec.md) - Exponential backoff retry logic
- [consensus-prompt.spec.md](../prompts/consensus-prompt.spec.md) - Prompt structure for caching
- [types.spec.md](../core/types.spec.md) - TokenUsage, APIError types
