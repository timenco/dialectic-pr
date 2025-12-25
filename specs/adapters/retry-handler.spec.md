# RETRY HANDLER SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - utils/logger.spec.md
external: []
```

## FILE_PATH
```
src/adapters/retry-handler.ts
```

## CLASS_INTERFACE
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

## IMPLEMENTATION
```typescript
import { logger } from "../utils/logger.js";
import { APIError } from "../core/types.js";

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

export class RetryHandler {
  constructor(private config: RetryConfig) {}

  async execute<T>(
    fn: () => Promise<T>,
    retryableStatusCodes: number[] = []
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (error instanceof APIError && 
            retryableStatusCodes.includes(error.statusCode)) {
          
          if (attempt < this.config.maxRetries) {
            const delay = this.calculateDelay(attempt);
            logger.warn(
              `API error ${error.statusCode}. Retry ${attempt + 1}/${this.config.maxRetries} in ${delay}ms`
            );
            await this.sleep(delay);
            continue;
          }
        }
        
        // Non-retryable error or max retries reached
        throw error;
      }
    }
    
    throw lastError!;
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: initialDelay * 2^attempt
    const delay = this.config.initialDelayMs * Math.pow(2, attempt);
    return Math.min(delay, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## RETRY_LOGIC
```yaml
attempt_0:
  delay: 0ms
  action: execute

attempt_1:
  delay: initialDelayMs * 2^0 = 2000ms
  action: retry

attempt_2:
  delay: initialDelayMs * 2^1 = 4000ms
  action: retry

attempt_3:
  delay: initialDelayMs * 2^2 = 8000ms
  max_capped: 10000ms
  action: retry

attempt_4:
  delay: exceeded maxRetries
  action: throw
```

## TEST_CASES
```yaml
test_success_first_try:
  input: fn_returns_immediately
  assert: no_retries

test_retry_on_429:
  input: fn_throws_APIError_429_then_succeeds
  assert: retries_once

test_no_retry_on_400:
  input: fn_throws_APIError_400
  assert: throws_immediately

test_max_retries_exceeded:
  input: fn_always_fails
  assert: throws_after_3_retries
```

