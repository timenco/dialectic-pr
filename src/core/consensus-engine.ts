import {
  PRAnalysis,
  ReviewStrategy,
  FalsePositivePattern,
  ReviewResult,
  ReviewIssue,
  ReviewSummary,
  ReviewMetadata,
} from "./types.js";
import { ClaudeAdapter } from "../adapters/claude-api.js";
import { logger } from "../utils/logger.js";

/**
 * Consensus Engine
 * Single-Call Multi-Persona Consensus Review 구현
 */
export class ConsensusEngine {
  constructor(
    private claudeAdapter: ClaudeAdapter,
    private projectConventions?: string
  ) {}

  /**
   * 리뷰 생성
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

    // 1. Multi-Persona Consensus 프롬프트 구성
    const prompt = this.buildMultiPersonaPrompt(
      analysis,
      strategy,
      fpPatterns
    );

    // 2. Claude API 호출
    logger.info("🤖 Calling Claude API with Multi-Persona prompt...");
    const response = await this.claudeAdapter.sendMessage(prompt, {
      maxTokens: strategy.maxTokens,
    });

    // 3. 응답 파싱
    const issues = this.parseReviewResponse(response.text);

    // 4. 요약 생성
    const summary = this.generateSummary(issues, analysis);

    // 5. 메타데이터 생성
    const metadata: ReviewMetadata = {
      framework: analysis.context.framework,
      strategy: strategy.name,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      filesReviewed: analysis.prioritizedFiles.length,
      filesExcluded: analysis.excludedFiles.length,
      reviewDuration: Date.now() - startTime,
    };

    logger.success(`✅ Review generated with ${issues.length} issues`);
    logger.info(`⏱️  Duration: ${metadata.reviewDuration}ms`);
    logger.info(`💰 Cost: $${response.usage.totalCost.toFixed(4)}`);

    return {
      issues,
      summary,
      metadata,
    };
  }

  /**
   * Multi-Persona Consensus 프롬프트 구성
   */
  private buildMultiPersonaPrompt(
    analysis: PRAnalysis,
    strategy: ReviewStrategy,
    fpPatterns: FalsePositivePattern[]
  ): string {
    return `
# AGENT CONSENSUS REVIEW SYSTEM

You are TWO distinct code review personas working together to provide high-quality, actionable feedback on this ${analysis.context.framework.name} pull request.

## PERSONA A: "Hawk" (The Critical Reviewer)
- Finds potential issues, bugs, security vulnerabilities
- Tends to raise concerns and ask questions
- Focuses on edge cases and error handling
- Looks for TypeScript/JavaScript-specific issues

## PERSONA B: "Owl" (The Pragmatic Validator)
- Validates Hawk's concerns against project context
- Considers false positive patterns
- Filters out noise and non-actionable feedback
- Ensures recommendations are practical and ROI-positive

## REVIEW PROCESS (Internal Dialogue)

1. **Hawk** reviews the diff and identifies potential issues
2. **Owl** validates each issue against:
   - Project's known false positive patterns
   - ${analysis.context.framework.name} framework conventions
   - Context and project conventions
   - ROI (Is this worth mentioning?)
3. **Both personas must agree** before reporting an issue
4. Only report issues that meet ALL THREE criteria:
   - ✅ Prevents production bugs
   - ✅ High confidence (not speculation)
   - ✅ High ROI (valuable to fix)

## FALSE POSITIVE PATTERNS TO IGNORE

${this.formatFPPatterns(fpPatterns)}

## PROJECT CONTEXT

### Framework: ${analysis.context.framework.name} ${analysis.context.framework.version || ""}

${this.getFrameworkInstructions(analysis.context.framework.name)}

### Affected Areas
${analysis.context.affectedAreas.join(", ") || "None"}

### Context Flags
- Critical Module: ${analysis.context.flags.criticalModule ? "⚠️ YES" : "No"}
- Test Changed: ${analysis.context.flags.testChanged ? "Yes" : "No"}
- Schema Changed: ${analysis.context.flags.schemaChanged ? "Yes" : "No"}
- Config Only: ${analysis.context.flags.configOnly ? "Yes" : "No"}

${this.projectConventions ? `### Project Conventions\n\n${this.projectConventions}` : ""}

## REVIEW STRATEGY: ${strategy.name.toUpperCase()}

${strategy.instructions}

## DIFF TO REVIEW

\`\`\`diff
${analysis.prioritizedDiff}
\`\`\`

---

## OUTPUT FORMAT

**IMPORTANT**: Return your response in JSON format ONLY, with no additional text before or after:

\`\`\`json
{
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "type": "bug|security|performance|maintainability",
      "confidence": "high|medium",
      "title": "Brief title",
      "description": "Clear explanation",
      "suggestion": "Optional fix recommendation"
    }
  ],
  "consensus": {
    "totalReviewed": 10,
    "issuesRaised": 2,
    "issuesFiltered": 5,
    "overallAssessment": "Brief 1-2 sentence summary"
  }
}
\`\`\`

If **no consensus issues** found, return:

\`\`\`json
{
  "issues": [],
  "consensus": {
    "totalReviewed": 10,
    "issuesRaised": 0,
    "issuesFiltered": 3,
    "overallAssessment": "✅ No significant issues found. Code looks good."
  }
}
\`\`\`

## REMEMBER

- **Quality over quantity**: One actionable issue is better than ten noisy ones
- **Be specific**: Always include file path and line number when possible
- **Be pragmatic**: Only report issues worth fixing
- **Respect patterns**: Don't flag known false positives
- **Framework-aware**: Apply ${analysis.context.framework.name}-specific knowledge
    `.trim();
  }

  /**
   * False Positive 패턴 포맷팅
   */
  private formatFPPatterns(patterns: FalsePositivePattern[]): string {
    if (patterns.length === 0) {
      return "No custom patterns defined.";
    }

    return patterns
      .map((p) => {
        return `
### ${p.id}
- **Category**: ${p.category}
- **Explanation**: ${p.explanation}
- **Indicators**: ${p.falsePositiveIndicators.join(", ")}
        `.trim();
      })
      .join("\n\n");
  }

  /**
   * 프레임워크별 리뷰 지침
   */
  private getFrameworkInstructions(frameworkName: string): string {
    const instructions: Record<string, string> = {
      nestjs: `
**NestJS Best Practices**:
- Dependency Injection: Use constructor injection
- Guards vs Interceptors: Guards for auth, Interceptors for transformation
- Exception Filters: Custom filters for consistent error responses
- DTOs: Use class-validator for validation
- Modules: Avoid circular dependencies
      `.trim(),

      nextjs: `
**Next.js Best Practices**:
- Server Components: Prefer Server Components by default
- Data Fetching: Use async Server Components, not useEffect
- API Routes: Validate input, use proper HTTP status codes
- Metadata: Use generateMetadata for SEO
- Image: Always use next/image for optimization
      `.trim(),

      react: `
**React Best Practices**:
- Hooks: Follow Rules of Hooks
- useEffect: Include all dependencies, cleanup when needed
- Performance: Use memo/useMemo/useCallback appropriately
- State: Keep state close to where it's used
- Keys: Use stable, unique keys in lists
      `.trim(),

      express: `
**Express Best Practices**:
- Middleware: Order matters, error handlers last
- Error Handling: Use async/await with try-catch or error middleware
- Validation: Validate all user input
- Security: Use helmet, rate limiting
- Routing: Use Router for modular routes
      `.trim(),

      vanilla: `
**TypeScript/JavaScript Best Practices**:
- Type Safety: Avoid 'any', use proper types
- Async/Await: Handle promise rejections
- Error Handling: Throw typed errors
- Null Safety: Check for null/undefined
      `.trim(),
    };

    return instructions[frameworkName] || instructions.vanilla;
  }

  /**
   * 리뷰 응답 파싱
   */
  private parseReviewResponse(responseText: string): ReviewIssue[] {
    try {
      // JSON 코드 블록 추출
      const jsonMatch = responseText.match(/```json\s*\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;

      const parsed = JSON.parse(jsonText);

      if (!parsed.issues || !Array.isArray(parsed.issues)) {
        logger.warn("⚠️ Invalid response format, no issues found");
        return [];
      }

      return parsed.issues.map((issue: any) => ({
        file: issue.file || "unknown",
        line: issue.line,
        type: issue.type || "maintainability",
        confidence: issue.confidence || "medium",
        title: issue.title || "Issue",
        description: issue.description || "",
        suggestion: issue.suggestion,
      }));
    } catch (error) {
      logger.error(`Failed to parse review response: ${error}`);
      logger.debug(`Response text: ${responseText.substring(0, 500)}`);
      return [];
    }
  }

  /**
   * 리뷰 요약 생성
   */
  private generateSummary(
    issues: ReviewIssue[],
    analysis: PRAnalysis
  ): ReviewSummary {
    const criticalIssues = issues.filter(
      (i) => i.type === "security" || i.type === "bug"
    ).length;

    let overallAssessment = "";

    if (issues.length === 0) {
      overallAssessment = "✅ No significant issues found. Code looks good.";
    } else if (criticalIssues > 0) {
      overallAssessment = `⚠️ Found ${criticalIssues} critical issue(s) that should be addressed before merging.`;
    } else {
      overallAssessment = `Found ${issues.length} issue(s) to consider for improved code quality.`;
    }

    return {
      totalIssues: issues.length,
      criticalIssues,
      affectedAreas: analysis.context.affectedAreas,
      overallAssessment,
    };
  }
}

