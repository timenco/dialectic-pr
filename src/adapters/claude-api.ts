import Anthropic from "@anthropic-ai/sdk";
import {
  APIError,
  ClaudeResponse,
  TokenUsage,
  AdvancedClaudeOptions,
} from "../core/types.js";
import { RetryHandler } from "./retry-handler.js";
import { logger } from "../utils/logger.js";

/**
 * Claude API Adapter
 * Anthropic Claude API 클라이언트 with Prompt Caching
 */
export class ClaudeAdapter {
  private readonly client: Anthropic;
  private readonly retryHandler: RetryHandler;
  private readonly defaultModel = "claude-sonnet-4-20250514";

  constructor(
    private apiKey: string,
    private model?: string
  ) {
    this.client = new Anthropic({
      apiKey: this.apiKey,
    });
    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelayMs: 2000,
      maxDelayMs: 10000,
    });
  }

  /**
   * Claude API 호출 (Prompt Caching + JSON Mode)
   * @param userMessage 사용자 메시지
   * @param options 고급 옵션
   */
  async sendAdvancedMessage(
    userMessage: string,
    options: AdvancedClaudeOptions
  ): Promise<ClaudeResponse> {
    const model = options.model || this.model || this.defaultModel;

    logger.info(`🤖 Sending request to Claude (${model})...`);
    logger.debug(`User message length: ${userMessage.length} chars`);
    logger.debug(`Max tokens: ${options.maxTokens}`);
    logger.debug(
      `Caching enabled: ${options.systemMessages && options.systemMessages.length > 0}`
    );

    return await this.retryHandler.execute(async () => {
      try {
        const startTime = Date.now();

        // Build request parameters
        const requestParams: Anthropic.MessageCreateParams = {
          model,
          max_tokens: options.maxTokens,
          temperature: options.temperature ?? 0,
          messages: [
            {
              role: "user",
              content: userMessage,
            },
          ],
        };

        // Add system messages with caching if provided
        if (options.systemMessages && options.systemMessages.length > 0) {
          requestParams.system = options.systemMessages.map((msg) => ({
            type: "text" as const,
            text: msg.text,
            ...(msg.cache_control && { cache_control: msg.cache_control }),
          }));
        }

        const response = await this.client.messages.create(requestParams);

        const duration = Date.now() - startTime;

        // 응답 텍스트 추출
        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => (block as { type: "text"; text: string }).text)
          .join("\n");

        // 토큰 사용량 계산 (캐시 포함)
        const usageData = response.usage as {
          input_tokens: number;
          output_tokens: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };

        const usage: TokenUsage = {
          inputTokens: usageData.input_tokens,
          outputTokens: usageData.output_tokens,
          cacheCreationTokens: usageData.cache_creation_input_tokens || 0,
          cacheReadTokens: usageData.cache_read_input_tokens || 0,
          totalCost: 0,
        };

        logger.success(`✅ Received response from Claude`);
        logger.info(
          `📊 Tokens: ${usage.inputTokens} in + ${usage.outputTokens} out`
        );
        if (usage.cacheReadTokens && usage.cacheReadTokens > 0) {
          logger.info(`🚀 Cache hit: ${usage.cacheReadTokens} tokens read from cache`);
        }
        if (usage.cacheCreationTokens && usage.cacheCreationTokens > 0) {
          logger.info(`💾 Cache created: ${usage.cacheCreationTokens} tokens cached`);
        }
        logger.info(`⏱️  Duration: ${duration}ms`);

        return {
          text,
          usage,
        };
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          logger.error(`Claude API Error: ${error.status} - ${error.message}`);

          throw new APIError(error.status ?? 500, error.message, error);
        }

        throw error;
      }
    }, [429, 500, 502, 503, 504]);
  }

  /**
   * 현재 사용 중인 모델 확인
   */
  getModel(): string {
    return this.model || this.defaultModel;
  }
}
