import { logger } from "../utils/logger.js";

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Retry Handler
 * Exponential backoff를 사용한 재시도 로직
 */
export class RetryHandler {
  private readonly config: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.config = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      ...options,
    };
  }

  /**
   * 재시도 로직과 함께 함수 실행
   * @param fn 실행할 비동기 함수
   * @param retryableErrors 재시도 가능한 에러 코드 (선택적)
   */
  async execute<T>(
    fn: () => Promise<T>,
    retryableErrors?: number[]
  ): Promise<T> {
    const maxRetries = this.config.maxRetries;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          logger.success(`✅ Retry succeeded on attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;

        // 마지막 시도면 재시도 하지 않음
        if (attempt === maxRetries) {
          break;
        }

        // 재시도 가능한 에러인지 확인
        if (retryableErrors && !this.isRetryableError(error, retryableErrors)) {
          logger.error("Non-retryable error encountered");
          throw error;
        }

        // 지연 시간 계산 (exponential backoff)
        const delay = this.calculateDelay(attempt);
        
        logger.warn(
          `⚠️ Attempt ${attempt + 1}/${maxRetries + 1} failed: ${(error as Error).message}`
        );
        logger.info(`⏳ Retrying in ${delay}ms...`);

        await this.sleep(delay);
      }
    }

    // 모든 재시도 실패
    logger.error(`❌ All ${maxRetries + 1} attempts failed`);
    throw lastError;
  }

  /**
   * 재시도 가능한 에러인지 확인
   */
  private isRetryableError(error: unknown, retryableCodes: number[]): boolean {
    if (typeof error === "object" && error !== null) {
      const code =
        ("statusCode" in error ? (error as { statusCode: number }).statusCode : undefined) ??
        ("status" in error ? (error as { status: number }).status : undefined);
      if (code !== undefined) {
        return retryableCodes.includes(code);
      }
    }
    return false;
  }

  /**
   * Exponential backoff 지연 시간 계산
   */
  private calculateDelay(attempt: number): number {
    const { initialDelayMs, maxDelayMs, backoffMultiplier } = this.config;
    const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
    return Math.min(delay, maxDelayMs);
  }

  /**
   * Promise를 사용한 sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}


