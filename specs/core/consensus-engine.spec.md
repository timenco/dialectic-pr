# CONSENSUS ENGINE SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - core/types.spec.md
  - adapters/claude-api.spec.md
  - prompts/consensus-prompt.spec.md
  - utils/logger.spec.md
external:
  - none
```

## FILE_PATH
```
src/core/consensus-engine.ts
```

## CLASS_INTERFACE
```typescript
export class ConsensusEngine {
  constructor(
    claudeAdapter: ClaudeAdapter,
    projectConventions?: string
  );
  
  async generateReview(
    analysis: PRAnalysis,
    strategy: ReviewStrategy,
    fpPatterns: FalsePositivePattern[]
  ): Promise<ReviewResult>;
}
```

## IMPLEMENTATION

### CLASS_STRUCTURE
```typescript
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

export class ConsensusEngine {
  constructor(
    private claudeAdapter: ClaudeAdapter,
    private projectConventions?: string
  ) {}

  async generateReview(
    analysis: PRAnalysis,
    strategy: ReviewStrategy,
    fpPatterns: FalsePositivePattern[]
  ): Promise<ReviewResult> {
    logger.section("Generating Review");
    const startTime = Date.now();

    // Build prompt with caching optimization
    const prompt = this.buildMultiPersonaPrompt(analysis, strategy, fpPatterns);

    // Call Claude API
    logger.info("🤖 Calling Claude API with Multi-Persona prompt...");
    const response = await this.claudeAdapter.sendMessage(prompt, {
      maxTokens: strategy.maxTokens
    });

    // Parse response (guaranteed valid JSON with schema mode)
    const issues = this.parseReviewResponse(response.text);

    // Generate summary
    const summary = this.generateSummary(issues, analysis);

    // Build metadata
    const metadata: ReviewMetadata = {
      framework: analysis.context.framework,
      strategy: strategy.name,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      filesReviewed: analysis.prioritizedFiles.length,
      filesExcluded: analysis.excludedFiles.length,
      reviewDuration: Date.now() - startTime
    };

    logger.success(`✅ Review generated: ${issues.length} issues`);
    logger.info(`⏱️  Duration: ${metadata.reviewDuration}ms`);
    logger.info(`💰 Cost: $${response.usage.totalCost.toFixed(4)}`);

    return { issues, summary, metadata };
  }
}
```

### BUILD_MULTI_PERSONA_PROMPT
```typescript
private buildMultiPersonaPrompt(
  analysis: PRAnalysis,
  strategy: ReviewStrategy,
  fpPatterns: FalsePositivePattern[]
): string {
  const agentInstructions = this.getAgentInstructions();
  const fpPatternsText = this.formatFPPatterns(fpPatterns);
  const frameworkInstructions = this.getFrameworkInstructions(analysis.context.framework.name);
  const reviewContext = this.buildReviewContext(analysis, strategy);
  
  return `${agentInstructions}

${fpPatternsText}

${frameworkInstructions}

${reviewContext}`;
}
```

### GET_AGENT_INSTRUCTIONS
```typescript
private getAgentInstructions(): string {
  return `SYSTEM: Multi-Persona Code Review

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
ACTIONABLE_FEEDBACK_ONLY: true`;
}
```

### FORMAT_FP_PATTERNS
```typescript
private formatFPPatterns(patterns: FalsePositivePattern[]): string {
  if (patterns.length === 0) {
    return "FALSE_POSITIVE_PATTERNS: none";
  }

  return `FALSE_POSITIVE_PATTERNS:
${patterns.map(p => `
- id: ${p.id}
  category: ${p.category}
  explanation: ${p.explanation}
  ignore_if_review_contains: ${JSON.stringify(p.falsePositiveIndicators)}
`).join('')}`;
}
```

### GET_FRAMEWORK_INSTRUCTIONS
```typescript
private getFrameworkInstructions(frameworkName: string): string {
  const instructions: Record<string, string> = {
    nestjs: `FRAMEWORK: NestJS
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
COMMON_FALSE_POSITIVES:
  - "throw new Error" is acceptable with AllExceptionsFilter
  - "new" keyword is intentional for DTOs and entities
  - Logger dependency injection is project pattern`,

    nextjs: `FRAMEWORK: Next.js
BEST_PRACTICES:
  components:
    - prefer_server_components: true
    - mark_client_components_explicitly: true
  data_fetching:
    - use_async_server_components: true
    - avoid_useeffect_for_data: true
  api_routes:
    - validate_all_input: true
  optimization:
    - use_next_image: true
COMMON_FALSE_POSITIVES:
  - async Server Components without useEffect is correct
  - "use client" directive is intentional`,

    react: `FRAMEWORK: React
BEST_PRACTICES:
  hooks:
    - follow_rules_of_hooks: true
    - include_all_dependencies: true
    - cleanup_effects: true
  performance:
    - use_memo_appropriately: true
  state:
    - colocate_state: true
  lists:
    - stable_unique_keys: true`,

    express: `FRAMEWORK: Express
BEST_PRACTICES:
  middleware:
    - correct_order: true
    - error_handlers_last: true
  async_handling:
    - use_async_await_with_try_catch: true
  validation:
    - validate_all_user_input: true
  security:
    - use_helmet: true
    - implement_rate_limiting: true`,

    vanilla: `FRAMEWORK: TypeScript/JavaScript
BEST_PRACTICES:
  types:
    - avoid_any: true
  async:
    - handle_promise_rejections: true
  errors:
    - throw_typed_errors: true
  null_safety:
    - check_null_undefined: true`
  };

  return instructions[frameworkName] || instructions.vanilla;
}
```

### BUILD_REVIEW_CONTEXT
```typescript
private buildReviewContext(
  analysis: PRAnalysis,
  strategy: ReviewStrategy
): string {
  return `REVIEW_CONTEXT:
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

${this.projectConventions ? `PROJECT_CONVENTIONS:\n${this.projectConventions}\n` : ''}

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

RESPOND_WITH_VALID_JSON_ONLY`;
}
```

### PARSE_REVIEW_RESPONSE
```typescript
private parseReviewResponse(responseText: string): ReviewIssue[] {
  try {
    // With JSON schema mode, response is guaranteed valid JSON
    const parsed = JSON.parse(responseText);

    if (!parsed.issues || !Array.isArray(parsed.issues)) {
      logger.warn("⚠️ Invalid response format, no issues array");
      return [];
    }

    return parsed.issues.map((issue: any) => ({
      file: issue.file,
      line: issue.line,
      type: issue.type,
      confidence: issue.confidence,
      title: issue.title,
      description: issue.description,
      suggestion: issue.suggestion
    }));
  } catch (error) {
    logger.error(`Failed to parse review response: ${error}`);
    logger.debug(`Response text: ${responseText.substring(0, 500)}`);
    return [];
  }
}
```

### GENERATE_SUMMARY
```typescript
private generateSummary(
  issues: ReviewIssue[],
  analysis: PRAnalysis
): ReviewSummary {
  const criticalIssues = issues.filter(
    i => i.type === "security" || i.type === "bug"
  ).length;

  let overallAssessment: string;

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
    overallAssessment
  };
}
```

## BEHAVIOR_SPECIFICATIONS

### SCENARIO: No Issues Found
```yaml
given:
  - clean_pr_with_no_problems
when:
  - generateReview() called
then:
  - issues: []
  - summary.overallAssessment: "✅ No significant issues found"
  - metadata.filesReviewed: > 0
```

### SCENARIO: Critical Security Issue
```yaml
given:
  - pr_with_sql_injection_vulnerability
when:
  - generateReview() called
then:
  - issues.length: > 0
  - issues[0].type: "security"
  - issues[0].confidence: "high"
  - summary.criticalIssues: > 0
```

### SCENARIO: False Positive Filtered
```yaml
given:
  - nestjs_pr_with_throw_error
  - fpPatterns includes nestjs-throw-error-with-filter
when:
  - generateReview() called
then:
  - issues: []
  - consensus.issuesFiltered: > 0
```

### SCENARIO: Large PR Token Limit
```yaml
given:
  - pr_size: 800KB
  - strategy: xlarge (4000 tokens)
when:
  - generateReview() called
then:
  - prompt includes only prioritized files
  - critical files included
  - low priority files may be excluded
```

## PERFORMANCE_TARGETS
```yaml
latency:
  small_pr: <5s
  medium_pr: <8s
  large_pr: <12s

accuracy:
  false_positive_rate: <10%
  json_parse_success: 100%

cost:
  per_review_with_cache: <$0.01
  per_review_without_cache: <$0.10
```

## TEST_CASES
```typescript
// test_no_issues.ts
const analysis: PRAnalysis = createCleanPRAnalysis();
const result = await engine.generateReview(analysis, strategy, []);
assert(result.issues.length === 0);
assert(result.summary.overallAssessment.includes("✅"));

// test_security_issue.ts
const analysis: PRAnalysis = createSQLInjectionPRAnalysis();
const result = await engine.generateReview(analysis, strategy, []);
assert(result.issues.length > 0);
assert(result.issues[0].type === "security");
assert(result.summary.criticalIssues > 0);

// test_false_positive.ts
const fpPatterns: FalsePositivePattern[] = [NESTJS_THROW_ERROR_PATTERN];
const analysis: PRAnalysis = createNestJSThrowErrorPRAnalysis();
const result = await engine.generateReview(analysis, strategy, fpPatterns);
assert(result.issues.length === 0);
```

