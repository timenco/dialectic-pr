import {
  PRAnalysis,
  ReviewStrategy,
  FalsePositivePattern,
  ReviewResult,
  ReviewIssue,
  ReviewSummary,
  ReviewMetadata,
  CachedSystemMessage,
  FrameworkName,
  CodeReviewResponse,
} from "./types.js";
import { ClaudeAdapter } from "../adapters/claude-api.js";
import { logger } from "../utils/logger.js";

/**
 * Agent Consensus Instructions (cacheable - never changes)
 */
const AGENT_CONSENSUS_INSTRUCTIONS = `
SYSTEM: Multi-Persona Code Review

PERSONA_HAWK:
  role: critical_reviewer
  objectives:
    - identify_potential_issues: [bugs, security_vulnerabilities, edge_cases]
    - focus_areas: [error_handling, type_safety, async_operations]
    - output: list_of_concerns

PERSONA_OWL:
  role: pragmatic_validator
  objectives:
    - validate_hawk_concerns: true
    - filter_criteria:
      - check_false_positive_patterns: true
      - evaluate_roi: true
      - assess_production_impact: true
    - output: filtered_actionable_issues

CONSENSUS_PROCESS:
  step_1:
    actor: HAWK
    action: analyze_diff
    output: potential_issues[]
  
  step_2:
    actor: OWL
    action: validate_each_issue
    criteria:
      - NOT in false_positive_patterns
      - production_bug_prevention: true
      - high_confidence: true
      - high_roi: true
    output: consensus_issues[]
  
  step_3:
    action: report_only_consensus_issues
    format: json_schema

QUALITY_OVER_QUANTITY: true
ACTIONABLE_FEEDBACK_ONLY: true
`.trim();

/**
 * Framework-specific instructions (cacheable - changes per project)
 */
const FRAMEWORK_INSTRUCTIONS: Record<FrameworkName, string> = {
  nestjs: `
FRAMEWORK: NestJS
BEST_PRACTICES:
  dependency_injection:
    - use_constructor_injection: true
    - avoid_property_injection: true
  error_handling:
    - use_exception_filters: true
    - throw_http_exceptions: true
  validation:
    - use_class_validator_dtos: true
  architecture:
    - avoid_circular_dependencies: true
    - single_responsibility_modules: true
COMMON_FALSE_POSITIVES:
  - "throw new Error" is acceptable with AllExceptionsFilter
  - "new" keyword is intentional for DTOs and entities
  - Logger dependency injection is project pattern
`.trim(),

  nextjs: `
FRAMEWORK: Next.js
BEST_PRACTICES:
  components:
    - prefer_server_components: true
    - mark_client_components_explicitly: true
  data_fetching:
    - use_async_server_components: true
    - avoid_useeffect_for_data: true
  api_routes:
    - validate_all_input: true
    - use_proper_http_status_codes: true
  optimization:
    - use_next_image: true
    - check_client_js_bundle_size: true
COMMON_FALSE_POSITIVES:
  - async Server Components without useEffect is correct
  - "use client" directive is intentional marking
`.trim(),

  react: `
FRAMEWORK: React
BEST_PRACTICES:
  hooks:
    - follow_rules_of_hooks: true
    - include_all_dependencies: true
    - cleanup_effects: true
  performance:
    - use_memo_appropriately: true
    - use_callback_for_child_optimization: true
  state:
    - colocate_state: true
    - lift_when_needed: true
  lists:
    - stable_unique_keys: true
COMMON_FALSE_POSITIVES:
  - intentional dependency omissions with eslint-disable
  - memo usage is performance optimization
`.trim(),

  express: `
FRAMEWORK: Express
BEST_PRACTICES:
  middleware:
    - correct_order: true
    - error_handlers_last: true
  async_handling:
    - use_async_await_with_try_catch: true
    - or_use_error_middleware: true
  validation:
    - validate_all_user_input: true
  security:
    - use_helmet: true
    - implement_rate_limiting: true
  routing:
    - use_router_for_modular_routes: true
COMMON_FALSE_POSITIVES:
  - middleware order is intentional architecture
  - custom error handler is standard pattern
`.trim(),

  vanilla: `
FRAMEWORK: TypeScript/JavaScript
BEST_PRACTICES:
  types:
    - avoid_any: true
    - use_proper_types: true
  async:
    - handle_promise_rejections: true
  errors:
    - throw_typed_errors: true
  null_safety:
    - check_null_undefined: true
`.trim(),
};

/**
 * Consensus Engine
 * Single-Call Multi-Persona Consensus Review with Prompt Caching
 */
export class ConsensusEngine {
  constructor(
    private claudeAdapter: ClaudeAdapter,
    private projectConventions?: string
  ) {}

  /**
   * 리뷰 생성 (Advanced API with Caching)
   * @param analysis PR 분석 결과
   * @param strategy 리뷰 전략
   * @param fpPatterns False Positive 패턴 목록
   */
  async generateReview(
    analysis: PRAnalysis,
    strategy: ReviewStrategy,
    fpPatterns: FalsePositivePattern[]
  ): Promise<ReviewResult> {
    logger.section("Generating Review");

    const startTime = Date.now();

    // 1. Build cacheable system messages
    const systemMessages = this.buildSystemMessages(
      analysis.context.framework.name,
      fpPatterns
    );

    // 2. Build dynamic user message
    const userMessage = this.buildUserMessage(analysis, strategy);

    // 3. Call Claude API with advanced features
    logger.info("🤖 Calling Claude API with Prompt Caching enabled...");
    const response = await this.claudeAdapter.sendAdvancedMessage(userMessage, {
      maxTokens: strategy.maxTokens,
      systemMessages,
      enableThinking: true,
      thinkingBudget: 2000,
    });

    // 4. Parse response
    const parsed = this.parseReviewResponse(response.text);

    // 5. Generate summary
    const summary = this.generateSummary(parsed.issues, analysis, parsed.consensus);

    // 6. Build metadata
    const metadata: ReviewMetadata = {
      framework: analysis.context.framework,
      strategy: strategy.name,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      filesReviewed: analysis.prioritizedFiles.length,
      filesExcluded: analysis.excludedFiles.length,
      reviewDuration: Date.now() - startTime,
    };

    logger.success(`✅ Review generated with ${parsed.issues.length} issues`);
    logger.info(`⏱️  Duration: ${metadata.reviewDuration}ms`);
    logger.info(`💰 Cost: $${response.usage.totalCost.toFixed(4)}`);

    return {
      issues: parsed.issues,
      summary,
      metadata,
    };
  }

  /**
   * Build cacheable system messages
   * These messages are cached by Claude API to reduce cost and latency
   */
  private buildSystemMessages(
    frameworkName: FrameworkName,
    fpPatterns: FalsePositivePattern[]
  ): CachedSystemMessage[] {
    return [
      // 1. Agent consensus instructions (never changes, always cached)
      {
        type: "text",
        text: AGENT_CONSENSUS_INSTRUCTIONS,
        cache_control: { type: "ephemeral" },
      },
      // 2. False positive patterns (changes per project, cached per session)
      {
        type: "text",
        text: this.formatFPPatterns(fpPatterns),
        cache_control: { type: "ephemeral" },
      },
      // 3. Framework instructions (changes per project, cached per session)
      {
        type: "text",
        text: FRAMEWORK_INSTRUCTIONS[frameworkName] || FRAMEWORK_INSTRUCTIONS.vanilla,
        cache_control: { type: "ephemeral" },
      },
    ];
  }

  /**
   * Build dynamic user message (not cached)
   */
  private buildUserMessage(
    analysis: PRAnalysis,
    strategy: ReviewStrategy
  ): string {
    return `
REVIEW_CONTEXT:
  framework: ${analysis.context.framework.name}
  version: ${analysis.context.framework.version || "unknown"}
  affected_areas: ${JSON.stringify(analysis.context.affectedAreas)}
  flags:
    critical_module: ${analysis.context.flags.criticalModule}
    test_changed: ${analysis.context.flags.testChanged}
    schema_changed: ${analysis.context.flags.schemaChanged}
    config_only: ${analysis.context.flags.configOnly}

STRATEGY: ${strategy.name}
INSTRUCTIONS: ${strategy.instructions}

${this.projectConventions ? `PROJECT_CONVENTIONS:\n${this.projectConventions}\n` : ""}

DIFF:
\`\`\`diff
${analysis.prioritizedDiff}
\`\`\`

OUTPUT_SCHEMA:
{
  "issues": [
    {
      "file": "string",
      "line": "number|undefined",
      "type": "bug|security|performance|maintainability",
      "confidence": "high|medium",
      "title": "string",
      "description": "string",
      "suggestion": "string|undefined"
    }
  ],
  "consensus": {
    "totalReviewed": "number",
    "issuesRaised": "number",
    "issuesFiltered": "number",
    "overallAssessment": "string"
  }
}

RESPOND_WITH_VALID_JSON_ONLY
    `.trim();
  }

  /**
   * Format False Positive patterns for prompt
   */
  private formatFPPatterns(patterns: FalsePositivePattern[]): string {
    if (patterns.length === 0) {
      return "FALSE_POSITIVE_PATTERNS: none";
    }

    const formatted = patterns
      .map(
        (p) => `
- id: ${p.id}
  category: ${p.category}
  explanation: ${p.explanation}
  ignore_if_review_contains: ${JSON.stringify(p.falsePositiveIndicators)}`
      )
      .join("\n");

    return `FALSE_POSITIVE_PATTERNS:\n${formatted}`;
  }

  /**
   * Parse Claude response into structured format
   */
  private parseReviewResponse(responseText: string): CodeReviewResponse {
    try {
      // Try to extract JSON from code block first
      const jsonMatch = responseText.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;

      // Clean up any potential issues
      const cleanedJson = jsonText.trim();
      const parsed = JSON.parse(cleanedJson);

      // Validate structure
      if (!parsed.issues || !Array.isArray(parsed.issues)) {
        logger.warn("⚠️ Invalid response format, no issues array found");
        return {
          issues: [],
          consensus: {
            totalReviewed: 0,
            issuesRaised: 0,
            issuesFiltered: 0,
            overallAssessment: "Failed to parse review response",
          },
        };
      }

      // Normalize issues
      const issues: ReviewIssue[] = parsed.issues.map((issue: Record<string, unknown>) => ({
        file: (issue.file as string) || "unknown",
        line: issue.line as number | undefined,
        type: (issue.type as ReviewIssue["type"]) || "maintainability",
        confidence: (issue.confidence as ReviewIssue["confidence"]) || "medium",
        title: (issue.title as string) || "Issue",
        description: (issue.description as string) || "",
        suggestion: issue.suggestion as string | undefined,
      }));

      // Normalize consensus
      const consensus = parsed.consensus || {
        totalReviewed: 0,
        issuesRaised: issues.length,
        issuesFiltered: 0,
        overallAssessment: issues.length > 0 ? "Issues found" : "No issues found",
      };

      return { issues, consensus };
    } catch (error) {
      logger.error(`Failed to parse review response: ${error}`);
      logger.debug(`Response text: ${responseText.substring(0, 500)}`);
      return {
        issues: [],
        consensus: {
          totalReviewed: 0,
          issuesRaised: 0,
          issuesFiltered: 0,
          overallAssessment: "Failed to parse review response",
        },
      };
    }
  }

  /**
   * Generate review summary
   */
  private generateSummary(
    issues: ReviewIssue[],
    analysis: PRAnalysis,
    consensus: CodeReviewResponse["consensus"]
  ): ReviewSummary {
    const criticalIssues = issues.filter(
      (i) => i.type === "security" || i.type === "bug"
    ).length;

    // Use consensus assessment if available, otherwise generate
    let overallAssessment = consensus.overallAssessment;

    if (!overallAssessment || overallAssessment === "Failed to parse review response") {
      if (issues.length === 0) {
        overallAssessment = "✅ No significant issues found. Code looks good.";
      } else if (criticalIssues > 0) {
        overallAssessment = `⚠️ Found ${criticalIssues} critical issue(s) that should be addressed before merging.`;
      } else {
        overallAssessment = `Found ${issues.length} issue(s) to consider for improved code quality.`;
      }
    }

    return {
      totalIssues: issues.length,
      criticalIssues,
      affectedAreas: analysis.context.affectedAreas,
      overallAssessment,
    };
  }

  /**
   * Get framework instructions for external use
   */
  static getFrameworkInstructions(frameworkName: FrameworkName): string {
    return FRAMEWORK_INSTRUCTIONS[frameworkName] || FRAMEWORK_INSTRUCTIONS.vanilla;
  }

  /**
   * Get agent consensus instructions for external use
   */
  static getAgentInstructions(): string {
    return AGENT_CONSENSUS_INSTRUCTIONS;
  }
}
