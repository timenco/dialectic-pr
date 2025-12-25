# CLAUDE API ADAPTER SPECIFICATION

## DEPENDENCIES
```yaml
external:
  - "@anthropic-ai/sdk": "^0.30.0"
internal:
  - core/types.spec.md
  - adapters/retry-handler.spec.md
  - utils/logger.spec.md
```

## FILE_PATH
```
src/adapters/claude-api.ts
```

## CLASS_INTERFACE

```typescript
export class ClaudeAdapter {
  constructor(
    apiKey: string,
    model?: string
  );
  
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
```

## IMPLEMENTATION_SPEC

### INITIALIZATION
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { ClaudeOptions, ClaudeResponse, TokenUsage, APIError } from "../core/types.js";
import { RetryHandler } from "./retry-handler.js";
import { logger } from "../utils/logger.js";

export class ClaudeAdapter {
  private readonly client: Anthropic;
  private readonly retryHandler: RetryHandler;
  private readonly defaultModel = "claude-sonnet-4-20250514";
  
  private readonly pricing = {
    "claude-sonnet-4-20250514": {
      input: 0.003,
      output: 0.015,
      cached_input: 0.0003  // 90% discount
    },
    "claude-3-5-sonnet-20241022": {
      input: 0.003,
      output: 0.015,
      cached_input: 0.0003
    }
  };

  constructor(
    private apiKey: string,
    private model?: string
  ) {
    this.client = new Anthropic({ apiKey: this.apiKey });
    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelayMs: 2000,
      maxDelayMs: 10000
    });
  }
}
```

### SEND_MESSAGE_WITH_OPTIMIZATIONS
```typescript
async sendMessage(
  prompt: string,
  options: ClaudeOptions
): Promise<ClaudeResponse> {
  const model = options.model || this.model || this.defaultModel;

  logger.info(`🤖 Claude API call: ${model}`);
  logger.debug(`Prompt: ${prompt.length} chars, MaxTokens: ${options.maxTokens}`);

  return await this.retryHandler.execute(async () => {
    try {
      const startTime = Date.now();

      // Parse prompt structure to identify system vs user content
      const { systemMessages, userMessage } = this.parsePromptStructure(prompt);

      const response = await this.client.messages.create({
        model,
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0,
        
        // Extended Thinking (Claude Sonnet 4 feature)
        thinking: {
          type: "enabled",
          budget_tokens: 2000
        },
        
        // JSON Schema Mode (strict structured output)
        response_format: this.buildJsonSchema(),
        
        // Prompt Caching (system messages)
        system: systemMessages,
        
        // User message (not cached)
        messages: [
          {
            role: "user",
            content: userMessage
          }
        ]
      });

      const duration = Date.now() - startTime;

      // Extract text from response
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { type: "text"; text: string }).text)
        .join("\n");

      // Calculate usage with cache metrics
      const usage: TokenUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalCost: this.calculateCostWithCache(
          model,
          response.usage.input_tokens,
          response.usage.output_tokens,
          response.usage.cache_creation_input_tokens || 0,
          response.usage.cache_read_input_tokens || 0
        )
      };

      logger.success(`✅ Claude response received`);
      logger.info(`📊 Tokens: ${usage.inputTokens} in + ${usage.outputTokens} out`);
      if (response.usage.cache_read_input_tokens) {
        logger.info(`💾 Cache hit: ${response.usage.cache_read_input_tokens} tokens`);
      }
      logger.info(`💰 Cost: $${usage.totalCost.toFixed(4)}`);
      logger.info(`⏱️  Duration: ${duration}ms`);

      return { text, usage };
      
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        logger.error(`Claude API Error: ${error.status} - ${error.message}`);
        throw new APIError(error.status ?? 500, error.message, error);
      }
      throw error;
    }
  }, [429, 500, 502, 503, 504]); // Retryable status codes
}
```

### PARSE_PROMPT_STRUCTURE
```typescript
private parsePromptStructure(prompt: string): {
  systemMessages: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
  userMessage: string;
} {
  // Parse structured prompt into cacheable system messages and dynamic user message
  // Expected format:
  // AGENT_CONSENSUS_INSTRUCTIONS (cacheable)
  // FALSE_POSITIVE_PATTERNS (cacheable)
  // FRAMEWORK_INSTRUCTIONS (cacheable)
  // REVIEW_CONTEXT + DIFF (not cacheable)
  
  const sections = this.splitPromptSections(prompt);
  
  const systemMessages = [
    {
      type: "text" as const,
      text: sections.agentInstructions,
      cache_control: { type: "ephemeral" as const }
    },
    {
      type: "text" as const,
      text: sections.fpPatterns,
      cache_control: { type: "ephemeral" as const }
    },
    {
      type: "text" as const,
      text: sections.frameworkInstructions,
      cache_control: { type: "ephemeral" as const }
    }
  ];
  
  const userMessage = sections.reviewContext + "\n\n" + sections.diff;
  
  return { systemMessages, userMessage };
}

private splitPromptSections(prompt: string): {
  agentInstructions: string;
  fpPatterns: string;
  frameworkInstructions: string;
  reviewContext: string;
  diff: string;
} {
  // Split based on markers in prompt
  const agentMatch = prompt.match(/SYSTEM: Multi-Persona Code Review[\s\S]*?(?=FALSE_POSITIVE_PATTERNS:)/);
  const fpMatch = prompt.match(/FALSE_POSITIVE_PATTERNS:[\s\S]*?(?=FRAMEWORK:)/);
  const frameworkMatch = prompt.match(/FRAMEWORK:[\s\S]*?(?=REVIEW_CONTEXT:)/);
  const contextMatch = prompt.match(/REVIEW_CONTEXT:[\s\S]*?(?=DIFF:)/);
  const diffMatch = prompt.match(/DIFF:[\s\S]*/);
  
  return {
    agentInstructions: agentMatch?.[0] || "",
    fpPatterns: fpMatch?.[0] || "FALSE_POSITIVE_PATTERNS: none",
    frameworkInstructions: frameworkMatch?.[0] || "",
    reviewContext: contextMatch?.[0] || "",
    diff: diffMatch?.[0] || ""
  };
}
```

### BUILD_JSON_SCHEMA
```typescript
private buildJsonSchema() {
  return {
    type: "json_schema" as const,
    json_schema: {
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
                  enum: ["bug", "security", "performance", "maintainability"]
                },
                confidence: {
                  type: "string",
                  enum: ["high", "medium"]
                },
                title: { type: "string" },
                description: { type: "string" },
                suggestion: { type: "string" }
              },
              required: ["file", "type", "confidence", "title", "description"],
              additionalProperties: false
            }
          },
          consensus: {
            type: "object",
            properties: {
              totalReviewed: { type: "number" },
              issuesRaised: { type: "number" },
              issuesFiltered: { type: "number" },
              overallAssessment: { type: "string" }
            },
            required: ["totalReviewed", "issuesRaised", "issuesFiltered", "overallAssessment"],
            additionalProperties: false
          }
        },
        required: ["issues", "consensus"],
        additionalProperties: false
      }
    }
  };
}
```

### CALCULATE_COST_WITH_CACHE
```typescript
private calculateCostWithCache(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number
): number {
  const pricing = this.pricing[model as keyof typeof this.pricing] 
    || this.pricing[this.defaultModel as keyof typeof this.pricing];
  
  // Regular input tokens
  const regularInputTokens = inputTokens - cacheCreationTokens - cacheReadTokens;
  const regularInputCost = (regularInputTokens / 1000) * pricing.input;
  
  // Cache creation (same price as regular input)
  const cacheCreationCost = (cacheCreationTokens / 1000) * pricing.input;
  
  // Cache reads (90% discount)
  const cacheReadCost = (cacheReadTokens / 1000) * pricing.cached_input;
  
  // Output tokens
  const outputCost = (outputTokens / 1000) * pricing.output;
  
  return regularInputCost + cacheCreationCost + cacheReadCost + outputCost;
}
```

### STREAMING_SUPPORT
```typescript
async sendMessageStream(
  prompt: string,
  options: ClaudeOptions,
  onChunk: (text: string) => void
): Promise<ClaudeResponse> {
  const model = options.model || this.model || this.defaultModel;
  
  logger.info(`🤖 Claude streaming call: ${model}`);
  
  const { systemMessages, userMessage } = this.parsePromptStructure(prompt);
  
  const stream = await this.client.messages.create({
    model,
    max_tokens: options.maxTokens,
    temperature: options.temperature ?? 0,
    thinking: { type: "enabled", budget_tokens: 2000 },
    response_format: this.buildJsonSchema(),
    system: systemMessages,
    messages: [{ role: "user", content: userMessage }],
    stream: true
  });
  
  let fullText = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  
  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        const chunk = event.delta.text;
        fullText += chunk;
        onChunk(chunk);
      }
    } else if (event.type === "message_start") {
      inputTokens = event.message.usage.input_tokens;
      cacheReadTokens = event.message.usage.cache_read_input_tokens || 0;
    } else if (event.type === "message_delta") {
      outputTokens = event.usage.output_tokens;
    }
  }
  
  const usage: TokenUsage = {
    inputTokens,
    outputTokens,
    totalCost: this.calculateCostWithCache(model, inputTokens, outputTokens, 0, cacheReadTokens)
  };
  
  return { text: fullText, usage };
}
```

### UTILITY_METHODS
```typescript
getModel(): string {
  return this.model || this.defaultModel;
}

async validateApiKey(): Promise<boolean> {
  try {
    await this.client.messages.create({
      model: this.defaultModel,
      max_tokens: 10,
      messages: [{ role: "user", content: "test" }]
    });
    return true;
  } catch (error) {
    logger.error(`API key validation failed: ${error}`);
    return false;
  }
}
```

## OPTIMIZATION_METRICS
```yaml
cache_hit_targets:
  first_pr_in_repo: 0%
  second_pr_in_repo: 90%
  subsequent_prs: 95%

cost_reduction:
  without_cache: $0.10_per_review
  with_cache: $0.01_per_review
  savings: 90%

latency_improvement:
  without_cache: 8s
  with_cache: 3s
  improvement: 62.5%

json_parse_reliability:
  without_json_mode: 95%
  with_json_mode: 100%
```

## ERROR_HANDLING
```yaml
retry_conditions:
  - status_code: 429
    reason: rate_limit
    strategy: exponential_backoff
  - status_code: [500, 502, 503, 504]
    reason: server_error
    strategy: exponential_backoff
  - status_code: [400, 401, 403]
    reason: client_error
    strategy: no_retry_throw_immediately

timeout: 60s
max_retries: 3
```

## TEST_CASES
```yaml
test_prompt_caching:
  scenario: same_project_multiple_prs
  assert: cache_read_tokens > 0

test_json_schema_enforcement:
  scenario: any_review_response
  assert: JSON.parse(response.text) succeeds

test_extended_thinking:
  scenario: complex_security_issue
  assert: higher_quality_issues_detected

test_cost_calculation:
  scenario: cached_request
  assert: cost < non_cached_cost * 0.2
```

