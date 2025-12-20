import Anthropic from "@anthropic-ai/sdk";
import {
  APIError,
  ClaudeOptions,
  ClaudeResponse,
  TokenUsage,
} from "../core/types.js";
import { RetryHandler } from "./retry-handler.js";
import { logger } from "../utils/logger.js";

/**
 * Claude API Adapter
 * Anthropic Claude API 클라이언트 (MVP: Claude만 지원)
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
    },
    "claude-3-5-sonnet-20241022": {
      input: 0.003,
      output: 0.015,
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
   * Claude API에 메시지 전송
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
        logger.info(`📊 Tokens used: ${usage.inputTokens} in + ${usage.outputTokens} out`);
        logger.info(`💰 Estimated cost: $${usage.totalCost.toFixed(4)}`);
        logger.info(`⏱️  Duration: ${duration}ms`);

        return {
          text,
          usage,
        };
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          logger.error(`Claude API Error: ${error.status} - ${error.message}`);
          
          throw new APIError(
            error.status ?? 500,
            error.message,
            error
          );
        }
        
        throw error;
      }
    }, [429, 500, 502, 503, 504]); // 재시도 가능한 HTTP 상태 코드
  }

  /**
   * 비용 계산
   * @param model 모델 이름
   * @param inputTokens 입력 토큰 수
   * @param outputTokens 출력 토큰 수
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
   * 스트리밍 응답 (추후 구현)
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
}

