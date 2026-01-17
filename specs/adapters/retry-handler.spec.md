# Retry Handler

## Purpose

Implements exponential backoff retry logic for API calls, handling transient failures like rate limits and server errors.

## Location

[src/adapters/retry-handler.ts](../../src/adapters/retry-handler.ts)

## Dependencies

```yaml
internal:
  - utils/logger.spec.md
  - core/types.spec.md (APIError)
external: []
```

## Core Responsibility

- Execute functions with automatic retry on specified errors
- Implement exponential backoff with configurable delays
- Cap maximum delay to prevent excessive wait times
- Log retry attempts with clear status information
- Distinguish between retryable and non-retryable errors
- Respect maximum retry limits

## Key Interface

```typescript
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

export class RetryHandler {
  constructor(config: RetryConfig);

  async execute<T>(
    fn: () => Promise<T>,
    retryableStatusCodes: number[]
  ): Promise<T>;
}
```

## Retry Strategy

Exponential backoff formula: `delay = min(initialDelay * 2^attempt, maxDelay)`

Example with config `{ maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 10000 }`:
- Attempt 0: Execute immediately
- Attempt 1: Wait 2s (2000 * 2^0)
- Attempt 2: Wait 4s (2000 * 2^1)
- Attempt 3: Wait 8s (2000 * 2^2)
- Attempt 4: Throw error (max retries exceeded)

## Error Handling

Only retries on errors matching retryable status codes:
- 429 (rate limit)
- 500, 502, 503, 504 (server errors)

Immediately throws on client errors (400, 401, 403, 404).

## Related Specs

- [claude-api.spec.md](./claude-api.spec.md) - Primary consumer for API retry logic
- [types.spec.md](../core/types.spec.md) - APIError type definition
