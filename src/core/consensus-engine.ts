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
SYSTEM: Dialectic Multi-Persona Code Review

You are a dialectic code review system with two internal personas: HAWK (critical reviewer) and OWL (pragmatic validator). You must produce a structured review in THREE explicit steps using natural-language markdown. The entire output will be posted as a GitHub PR comment, so make it readable and valuable.

=== OUTPUT FORMAT ===

You MUST output EXACTLY this structure:

=== STEP 1: REVIEW AGENT (HAWK) ANALYSIS ===

As HAWK, perform a thorough analysis of the diff. For each potential issue found:
- State the file, line, and issue type (bug/security/performance/maintainability)
- Explain WHY it is a problem with concrete evidence from the diff
- Assess confidence (high/medium) and production impact
- List ALL concerns — do not self-filter at this stage

=== STEP 2: DEV AGENT (OWL) CHALLENGE ===

As OWL, challenge EVERY issue HAWK raised:
- For each HAWK issue, explicitly AGREE or REJECT with reasoning
- Apply false-positive pattern checks
- Evaluate ROI: is the fix worth the effort?
- Check: would this actually cause a production bug, or is it stylistic/theoretical?
- Provide a verdict: APPROVE / REQUEST_CHANGES / COMMENT

=== STEP 3: FINAL CONSENSUS ===

Synthesize the debate into a final consensus:
1. Executive summary of the review (2-3 sentences)
2. Highlight what the PR does well (positive feedback)
3. List only the AGREED issues (issues both HAWK and OWL accept)
4. End with a JSON block in the schema provided

RULES:
- QUALITY_OVER_QUANTITY: Only consensus issues survive to the final JSON
- Be specific: reference actual code, line numbers, variable names
- Be constructive: explain WHY and suggest HOW to fix
- Positive feedback is mandatory: acknowledge good patterns
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
    private projectConventions?: string,
    private language?: string
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
      debateNarrative: parsed.debateNarrative,
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
    const messages: CachedSystemMessage[] = [
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

    // 4. Language instruction (if non-English)
    if (this.language && this.language !== "en") {
      messages.push({
        type: "text",
        text: `RESPONSE_LANGUAGE: You MUST write ALL review output in ${this.getLanguageName(this.language)}.`,
        cache_control: { type: "ephemeral" },
      });
    }

    return messages;
  }

  private getLanguageName(code: string): string {
    const map: Record<string, string> = {
      ko: "Korean (한국어)",
      ja: "Japanese (日本語)",
      zh: "Chinese (中文)",
    };
    return map[code] || code;
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

METRICS:
  files_changed: ${analysis.metrics.fileCount}
  lines_added: ${analysis.metrics.addedLines}
  lines_deleted: ${analysis.metrics.deletedLines}
  core_files: ${analysis.metrics.coreFileCount}

STRATEGY: ${strategy.name}
INSTRUCTIONS: ${strategy.instructions}

${this.projectConventions ? `PROJECT_CONVENTIONS:\n${this.projectConventions}\n` : ""}

DIFF:
\`\`\`diff
${analysis.prioritizedDiff}
\`\`\`

STEP_3_JSON_SCHEMA (place this JSON block at the END of STEP 3):
\`\`\`json
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
    "totalReviewed": "number (files reviewed)",
    "issuesRaised": "number (HAWK issues before filtering)",
    "issuesFiltered": "number (issues rejected by OWL)",
    "agreedIssues": "number (issues both agree on)",
    "rejectedIssues": "number (issues OWL rejected)",
    "fpRate": "string (e.g. '2/5 = 40%')",
    "verdict": "APPROVE|REQUEST_CHANGES|COMMENT",
    "mergeable": "boolean",
    "priority": "critical|high|medium|low",
    "overallAssessment": "string"
  }
}
\`\`\`

Now produce the full 3-step review. Write STEP 1, STEP 2, STEP 3 in natural language markdown, then end STEP 3 with the JSON block.
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
      // Find the LAST ```json ``` block (STEP 3 JSON)
      const jsonBlocks = [...responseText.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)];
      let jsonText: string;
      let debateNarrative: string | undefined;

      if (jsonBlocks.length > 0) {
        // Use the last JSON block
        const lastBlock = jsonBlocks[jsonBlocks.length - 1];
        jsonText = lastBlock[1];

        // Everything before the last JSON block is the debate narrative
        const lastBlockStart = lastBlock.index!;
        const narrativeText = responseText.substring(0, lastBlockStart).trim();
        if (narrativeText.length > 0) {
          debateNarrative = narrativeText;
        }
      } else {
        // Fallback: try entire response as JSON (backward compat)
        jsonText = responseText;
      }

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
          debateNarrative,
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

      // Normalize consensus (with extended fields)
      const consensus = {
        totalReviewed: parsed.consensus?.totalReviewed ?? 0,
        issuesRaised: parsed.consensus?.issuesRaised ?? issues.length,
        issuesFiltered: parsed.consensus?.issuesFiltered ?? 0,
        overallAssessment: parsed.consensus?.overallAssessment ??
          (issues.length > 0 ? "Issues found" : "No issues found"),
        agreedIssues: parsed.consensus?.agreedIssues as number | undefined,
        rejectedIssues: parsed.consensus?.rejectedIssues as number | undefined,
        fpRate: parsed.consensus?.fpRate as string | undefined,
        verdict: parsed.consensus?.verdict as string | undefined,
        mergeable: parsed.consensus?.mergeable as boolean | undefined,
        priority: parsed.consensus?.priority as string | undefined,
      };

      return { issues, consensus, debateNarrative };
    } catch (error) {
      logger.error(`Failed to parse review response: ${error}`);
      logger.debug(`Response text: ${responseText.substring(0, 500)}`);

      // Even if JSON parsing fails, try to salvage the narrative
      const hasStepMarkers = responseText.includes("STEP 1") || responseText.includes("STEP 2");
      return {
        issues: [],
        consensus: {
          totalReviewed: 0,
          issuesRaised: 0,
          issuesFiltered: 0,
          overallAssessment: "Failed to parse review response",
        },
        debateNarrative: hasStepMarkers ? responseText : undefined,
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
      verdict: consensus.verdict,
      mergeable: consensus.mergeable,
      priority: consensus.priority,
      fpRate: consensus.fpRate,
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
