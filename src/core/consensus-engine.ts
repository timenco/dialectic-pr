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
import { logger, safeError } from "../utils/logger.js";

/**
 * Agent Consensus Instructions (cacheable - never changes)
 */
const AGENT_CONSENSUS_INSTRUCTIONS = `
SYSTEM: Dialectic Multi-Persona Code Review

You are a dialectic code review system with two internal personas: HAWK (critical reviewer) and OWL (pragmatic validator). You must produce a structured review in THREE explicit steps using natural-language markdown. The entire output will be posted as a GitHub PR comment, so make it readable and valuable.

=== OUTPUT FORMAT ===

You MUST output EXACTLY this structure:

=== STEP 1: REVIEW AGENT ANALYSIS ===

As HAWK (critical reviewer), list every potential issue using this EXACT numbered format:

Issue 1 (bug/security/performance/maintainability): Description of the issue.
  - File: path/to/file.ts, Line: 42
  - Evidence: concrete code reference from the diff
  - Impact: what could go wrong in production

Issue 2 (type): ...

List ALL concerns — do not self-filter at this stage.

=== STEP 2: DEV AGENT CHALLENGE ===

As OWL (pragmatic validator), challenge EVERY issue HAWK raised using this EXACT format:

Issue 1 Challenge: Your counterargument with evidence...
→ REJECT (reason: e.g., "stylistic preference, no production impact, ROI too low")
OR
→ AGREE (reason: e.g., "confirmed bug that could cause production failure")

Issue 2 Challenge: ...
→ REJECT (reason) / → AGREE (reason)

ROI CHECK — for each issue, ask these 3 questions:
1. Does this prevent a real bug? (not stylistic)
2. Could this cause a production incident?
3. Is the ROI of fixing this HIGH?
→ If not ALL three are "Yes", REJECT the issue.

Be SKEPTICAL — reject unless HIGH ROI and clearly a bug or security risk.
SECURITY OVERRIDE: Security issues (injection, auth bypass, data leak) are ALWAYS kept regardless of ROI.

=== STEP 3: OUTPUT ===

You MUST use this EXACT structure for STEP 3:

📋 Executive Summary
2-3 sentences summarizing the PR and review outcome.

🔴 Critical Issues
(List critical/security/bug issues that survived the debate. If none: "✅ Critical 이슈 없음")

🟡 Important Issues
(List important/performance/maintainability issues that survived. If none: "✅ Important 이슈 없음")

✅ 긍정적인 점
- Good pattern or practice observed (2-3 items)

📊 Final Verdict
결론: LGTM ✅ / Changes Requested 🔴 / Needs Discussion 💬
머지: 즉시 가능 / 수정 후 / 팀 논의 후
우선순위: P0 (긴급) / P1 (중요) / P2 (일반)

Then end with the JSON block in the schema provided.

RULES:
- QUALITY_OVER_QUANTITY: Only consensus issues survive to the final output
- Be specific: reference actual code, line numbers, variable names
- Be constructive: explain WHY and suggest HOW to fix
- Positive feedback is mandatory: acknowledge good patterns
- FALSE POSITIVE PREVENTION: When in doubt, REJECT. Only high-confidence, high-ROI issues survive.
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
    private language: string = "en"
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

CONSENSUS_JSON (place this JSON block at the very END of STEP 3, after 📊 Final Verdict):
\`\`\`json
{
  "consensus_completed": true,
  "agreed_issues": ["short summary of each agreed issue as a string"],
  "rejected_issues": [{"issue": "description", "reason": "why rejected"}],
  "verdict": "LGTM|CHANGES_REQUESTED|NEEDS_DISCUSSION",
  "false_positive_rate": 0.0
}
\`\`\`
- verdict: "LGTM" if no critical issues remain, "CHANGES_REQUESTED" if critical issues exist, "NEEDS_DISCUSSION" if ambiguous
- false_positive_rate: ratio of rejected issues to total HAWK issues (0.0 to 1.0)
- agreed_issues: array of SHORT summary strings for issues that survived the debate
- rejected_issues: array of objects with "issue" and "reason" for each rejected issue

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
      // Find the code block containing consensus_completed (not just the last block,
      // because Claude may output code suggestions after the JSON block)
      const allCodeBlocks = [...responseText.matchAll(/```(?:\w*)?\s*\n([\s\S]*?)\n```/g)];
      const consensusBlock = allCodeBlocks.find(block => block[1].includes('"consensus_completed"'));
      let jsonText: string;
      let debateNarrative: string | undefined;

      if (consensusBlock) {
        jsonText = consensusBlock[1];

        // Everything before the consensus JSON block is the debate narrative
        const blockStart = consensusBlock.index!;
        const blockEnd = blockStart + consensusBlock[0].length;
        // Narrative = text before JSON block + any text after it (code suggestions etc.)
        const before = responseText.substring(0, blockStart).trim();
        const after = responseText.substring(blockEnd).trim();
        const narrativeText = after ? `${before}\n\n${after}` : before;
        if (narrativeText.length > 0) {
          debateNarrative = narrativeText;
        }
      } else {
        // Fallback: find unfenced JSON with consensus_completed key
        const unfencedMatch = responseText.match(/\{\s*"consensus_completed"\s*:\s*[\s\S]*?\n\}/);
        if (unfencedMatch) {
          jsonText = unfencedMatch[0];
          const matchStart = unfencedMatch.index!;
          const narrativeText = responseText.substring(0, matchStart).trim();
          if (narrativeText.length > 0) {
            debateNarrative = narrativeText;
          }
        } else {
          // Last resort: try entire response as JSON
          jsonText = responseText;
        }
      }

      const cleanedJson = jsonText.trim();
      const parsed = JSON.parse(cleanedJson);

      // New format: consensus_completed / agreed_issues / rejected_issues / verdict / false_positive_rate
      const agreedIssues: string[] = Array.isArray(parsed.agreed_issues) ? parsed.agreed_issues : [];
      const rejectedIssues: Array<{ issue: string; reason: string }> = Array.isArray(parsed.rejected_issues) ? parsed.rejected_issues : [];
      const verdict = (parsed.verdict as string) || "LGTM";
      const fpRateNum = typeof parsed.false_positive_rate === "number" ? parsed.false_positive_rate : 0;
      const fpRate = `${Math.round(fpRateNum * 100)}%`;

      // Map verdict to consensus format
      const verdictMap: Record<string, string> = {
        LGTM: "APPROVE",
        CHANGES_REQUESTED: "REQUEST_CHANGES",
        NEEDS_DISCUSSION: "COMMENT",
      };

      const totalIssues = agreedIssues.length + rejectedIssues.length;

      const consensus = {
        totalReviewed: 0,
        issuesRaised: totalIssues,
        issuesFiltered: rejectedIssues.length,
        overallAssessment: agreedIssues.length > 0
          ? `Found ${agreedIssues.length} agreed issue(s) after consensus filtering.`
          : "✅ No significant issues found. Code looks good.",
        agreedIssues: agreedIssues.length,
        rejectedIssues: rejectedIssues.length,
        fpRate,
        verdict: verdictMap[verdict] || verdict,
        mergeable: verdict === "LGTM" || verdict === "NEEDS_DISCUSSION",
        priority: verdict === "CHANGES_REQUESTED" ? "high" : verdict === "NEEDS_DISCUSSION" ? "medium" : "low",
      };

      // Issues array is empty — all issue detail lives in the debateNarrative markdown
      return { issues: [], consensus, debateNarrative };
    } catch (error) {
      logger.error(`Failed to parse review response: ${safeError(error)}`);

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
    _issues: ReviewIssue[],
    analysis: PRAnalysis,
    consensus: CodeReviewResponse["consensus"]
  ): ReviewSummary {
    // totalIssues = agreed issues count (from consensus JSON)
    const totalIssues = consensus.agreedIssues ?? 0;

    // Use consensus assessment if available, otherwise generate
    let overallAssessment = consensus.overallAssessment;

    if (!overallAssessment || overallAssessment === "Failed to parse review response") {
      if (totalIssues === 0) {
        overallAssessment = "✅ No significant issues found. Code looks good.";
      } else {
        overallAssessment = `Found ${totalIssues} agreed issue(s) after consensus filtering.`;
      }
    }

    return {
      totalIssues,
      criticalIssues: 0, // detail lives in narrative markdown
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
