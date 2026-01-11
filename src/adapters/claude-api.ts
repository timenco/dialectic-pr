import Anthropic from "@anthropic-ai/sdk";
import {
  APIError,
  ClaudeOptions,
  ClaudeResponse,
  TokenUsage,
  CachedSystemMessage,
  AdvancedClaudeOptions,
  CodeReviewSchema,
} from "../core/types.js";
import { RetryHandler } from "./retry-handler.js";
import { logger } from "../utils/logger.js";

/**
 * Default JSON Schema for code review output
 */
const CODE_REVIEW_SCHEMA: CodeReviewSchema = {
  name: "code_review",
  strict: true,
  schema: {
    type: "object",
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            file: { type: "string" },
            line: { type: "number" },
            type: {
              type: "string",
              enum: ["bug", "security", "performance", "maintainability"],
            },
            confidence: {
              type: "string",
              enum: ["high", "medium"],
            },
            title: { type: "string" },
            description: { type: "string" },
            suggestion: { type: "string" },
          },
          required: ["file", "type", "confidence", "title", "description"],
        },
      },
      consensus: {
        type: "object",
        properties: {
          totalReviewed: { type: "number" },
          issuesRaised: { type: "number" },
          issuesFiltered: { type: "number" },
          overallAssessment: { type: "string" },
        },
        required: [
          "totalReviewed",
          "issuesRaised",
          "issuesFiltered",
          "overallAssessment",
        ],
      },
    },
    required: ["issues", "consensus"],
  },
};

/**
 * Claude API Adapter
 * Anthropic Claude API 클라이언트 with Prompt Caching, Extended Thinking, JSON Mode
 */
export class ClaudeAdapter {
  private readonly client: Anthropic;
  private readonly retryHandler: RetryHandler;
  private readonly defaultModel = "claude-sonnet-4-20250514";

  // Claude API pricing (as of 2025)
  private readonly pricing = {
    "claude-sonnet-4-20250514": {
      input: 0.003, // per 1K tokens
      output: 0.015, // per 1K tokens
      cacheWrite: 0.00375, // per 1K tokens (cache creation)
      cacheRead: 0.0003, // per 1K tokens (cache hit)
    },
    "claude-3-5-sonnet-20241022": {
      input: 0.003,
      output: 0.015,
      cacheWrite: 0.00375,
      cacheRead: 0.0003,
    },
  };

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
   * Claude API에 메시지 전송 (기본 버전)
   * @param prompt 프롬프트
   * @param options Claude 옵션
   */
  async sendMessage(
    prompt: string,
    options: ClaudeOptions
  ): Promise<ClaudeResponse> {
    const model = options.model || this.model || this.defaultModel;

    logger.info(`🤖 Sending request to Claude (${model})...`);
    logger.debug(`Prompt length: ${prompt.length} chars`);
    logger.debug(`Max tokens: ${options.maxTokens}`);

    return await this.retryHandler.execute(async () => {
      try {
        const startTime = Date.now();

        const response = await this.client.messages.create({
          model,
          max_tokens: options.maxTokens,
          temperature: options.temperature ?? 0,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        const duration = Date.now() - startTime;

        // 응답 텍스트 추출
        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => (block as { type: "text"; text: string }).text)
          .join("\n");

        // 토큰 사용량 계산
        const usage: TokenUsage = {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalCost: this.calculateCost(
            model,
            response.usage.input_tokens,
            response.usage.output_tokens
          ),
        };

        logger.success(`✅ Received response from Claude`);
        logger.info(
          `📊 Tokens used: ${usage.inputTokens} in + ${usage.outputTokens} out`
        );
        logger.info(`💰 Estimated cost: $${usage.totalCost.toFixed(4)}`);
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
    }, [429, 500, 502, 503, 504]); // 재시도 가능한 HTTP 상태 코드
  }

  /**
   * 고급 Claude API 호출 (Prompt Caching + Extended Thinking + JSON Mode)
   * @param userMessage 사용자 메시지
   * @param options 고급 옵션
   */
  async sendAdvancedMessage(
    userMessage: string,
    options: AdvancedClaudeOptions
  ): Promise<ClaudeResponse> {
    const model = options.model || this.model || this.defaultModel;

    logger.info(`🤖 Sending advanced request to Claude (${model})...`);
    logger.debug(`User message length: ${userMessage.length} chars`);
    logger.debug(`Max tokens: ${options.maxTokens}`);
    logger.debug(
      `Caching enabled: ${options.systemMessages && options.systemMessages.length > 0}`
    );
    logger.debug(`Extended thinking: ${options.enableThinking || false}`);

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

        // Note: Extended thinking and JSON schema mode would be configured here
        // when the Anthropic SDK fully supports these features.
        // For now, we rely on prompt engineering for JSON output.

        const response = await this.client.messages.create(requestParams);

        const duration = Date.now() - startTime;

        // 응답 텍스트 추출
        let text = "";
        let thinking = "";

        for (const block of response.content) {
          if (block.type === "text") {
            text += block.text;
          }
          // Handle thinking blocks if extended thinking is enabled
          // Note: "thinking" type is available in newer Anthropic SDK versions
          const blockType = (block as { type: string }).type;
          if (blockType === "thinking") {
            thinking += (block as unknown as { thinking: string }).thinking;
          }
        }

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
          totalCost: this.calculateAdvancedCost(model, usageData),
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
        logger.info(`💰 Estimated cost: $${usage.totalCost.toFixed(4)}`);
        logger.info(`⏱️  Duration: ${duration}ms`);

        return {
          text,
          usage,
          ...(thinking && { thinking }),
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
   * 기본 비용 계산
   */
  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing =
      this.pricing[model as keyof typeof this.pricing] ||
      this.pricing[this.defaultModel as keyof typeof this.pricing];

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * 고급 비용 계산 (캐싱 포함)
   */
  private calculateAdvancedCost(
    model: string,
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    }
  ): number {
    const pricing =
      this.pricing[model as keyof typeof this.pricing] ||
      this.pricing[this.defaultModel as keyof typeof this.pricing];

    // Regular input tokens (excluding cached)
    const regularInputTokens =
      usage.input_tokens -
      (usage.cache_creation_input_tokens || 0) -
      (usage.cache_read_input_tokens || 0);

    const inputCost = (regularInputTokens / 1000) * pricing.input;
    const outputCost = (usage.output_tokens / 1000) * pricing.output;
    const cacheWriteCost =
      ((usage.cache_creation_input_tokens || 0) / 1000) * pricing.cacheWrite;
    const cacheReadCost =
      ((usage.cache_read_input_tokens || 0) / 1000) * pricing.cacheRead;

    return inputCost + outputCost + cacheWriteCost + cacheReadCost;
  }

  /**
   * 스트리밍 응답
   */
  async sendMessageStream(
    prompt: string,
    options: ClaudeOptions,
    onChunk: (text: string) => void
  ): Promise<ClaudeResponse> {
    const model = options.model || this.model || this.defaultModel;

    logger.info(`🤖 Sending streaming request to Claude (${model})...`);

    const stream = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens,
      temperature: options.temperature ?? 0,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      stream: true,
    });

    let fullText = "";
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          const chunk = event.delta.text;
          fullText += chunk;
          onChunk(chunk);
        }
      } else if (event.type === "message_start") {
        inputTokens = event.message.usage.input_tokens;
      } else if (event.type === "message_delta") {
        outputTokens = event.usage.output_tokens;
      }
    }

    const usage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalCost: this.calculateCost(model, inputTokens, outputTokens),
    };

    logger.success(`✅ Streaming completed`);
    logger.info(`📊 Tokens: ${inputTokens} in + ${outputTokens} out`);
    logger.info(`💰 Cost: $${usage.totalCost.toFixed(4)}`);

    return {
      text: fullText,
      usage,
    };
  }

  /**
   * 현재 사용 중인 모델 확인
   */
  getModel(): string {
    return this.model || this.defaultModel;
  }

  /**
   * API 키 유효성 확인 (간단한 테스트 요청)
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: "test",
          },
        ],
      });
      return true;
    } catch (error) {
      logger.error(`API key validation failed: ${error}`);
      return false;
    }
  }

  /**
   * 기본 코드 리뷰 JSON 스키마 가져오기
   */
  static getCodeReviewSchema(): CodeReviewSchema {
    return CODE_REVIEW_SCHEMA;
  }
}
