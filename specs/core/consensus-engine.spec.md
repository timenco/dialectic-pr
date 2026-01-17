# Consensus Engine

## Purpose

Orchestrates the multi-persona code review system where two AI personas (Hawk and Owl) collaborate within a single API call to produce high-quality, low-noise review results.

## Location

→ [`src/core/consensus-engine.ts`](../../src/core/consensus-engine.ts)

## Dependencies

```yaml
internal:
  - core/types → PRAnalysis, ReviewStrategy, ReviewResult
  - adapters/claude-api → ClaudeAdapter
  - utils/logger → logger
```

## Core Responsibility

Execute consensus-based code review by:
1. Building multi-persona prompts with FP patterns and framework context
2. Calling Claude API with optimized prompts (with caching)
3. Parsing structured JSON responses
4. Generating review summaries and metadata

## Key Interface

```typescript
class ConsensusEngine {
  constructor(
    claudeAdapter: ClaudeAdapter,
    projectConventions?: string
  )

  async generateReview(
    analysis: PRAnalysis,
    strategy: ReviewStrategy,
    fpPatterns: FalsePositivePattern[]
  ): Promise<ReviewResult>
}
```

## Multi-Persona System

### PERSONA: Hawk (Critical Reviewer)
- **Role**: Identify potential issues, bugs, security vulnerabilities
- **Focus**: Edge cases, error handling, type safety, async operations
- **Output**: List of concerns

### PERSONA: Owl (Pragmatic Validator)
- **Role**: Validate Hawk's concerns against project context
- **Filter Criteria**:
  - Check against false positive patterns
  - Evaluate ROI (return on investment)
  - Assess production impact
  - Require high confidence
- **Output**: Filtered actionable issues

### Consensus Process

```
Step 1: Hawk analyzes diff → potential_issues[]
Step 2: Owl validates each issue against:
        - False positive patterns
        - Production bug prevention value
        - Confidence level
        - ROI
Step 3: Report only consensus_issues[]
```

## Prompt Structure

The engine builds a comprehensive prompt containing:

1. **Agent Instructions**: Multi-persona system description
2. **FP Patterns**: Known false positive patterns to ignore
3. **Framework Instructions**: Framework-specific best practices (NestJS, Next.js, React, Express)
4. **Review Context**:
   - Framework and version
   - Affected areas (Auth, Payments, etc.)
   - Context flags (criticalModule, testChanged, schemaChanged, etc.)
   - Strategy instructions
   - Project conventions (if provided)
5. **Diff**: Prioritized diff content
6. **Output Schema**: JSON structure for structured responses

## Key Methods

### `generateReview()`
Main entry point that orchestrates the entire review process:
- Builds multi-persona prompt
- Calls Claude API
- Parses JSON response
- Generates summary
- Returns complete `ReviewResult`

### `buildMultiPersonaPrompt()`
Constructs the comprehensive prompt by combining:
- Agent system instructions
- False positive patterns (formatted)
- Framework-specific guidelines
- Review context and diff

### `parseReviewResponse()`
Parses Claude's JSON response into `ReviewIssue[]`
- Guaranteed valid JSON (schema mode)
- Handles parsing errors gracefully
- Returns empty array on failure

### `generateSummary()`
Creates review summary:
- Counts total and critical issues
- Extracts affected areas
- Generates overall assessment message

## Framework-Specific Instructions

The engine injects framework-aware guidelines:

- **NestJS**: DI patterns, exception filters, DTO validation
- **Next.js**: Server components, data fetching, API routes
- **React**: Hooks rules, effect cleanup, state management
- **Express**: Middleware order, async handling, security
- **Vanilla**: TypeScript best practices, null safety

See implementation for complete framework instructions.

## Performance Characteristics

```yaml
latency:
  small_pr: <5s
  medium_pr: <8s
  large_pr: <12s

accuracy:
  false_positive_rate: <10%
  json_parse_success: 100%

cost:
  with_prompt_caching: <$0.01 per review
  without_caching: <$0.10 per review
```

## Key Behaviors

### Scenario: Clean PR
- Input: PR with no issues
- Output: Empty issues array, "✅ No significant issues found"

### Scenario: Critical Security Issue
- Input: PR with SQL injection vulnerability
- Output: Issue with type="security", confidence="high"

### Scenario: False Positive Filtered
- Input: NestJS PR with `throw new Error` pattern
- FP Pattern: `nestjs-throw-error-with-filter`
- Output: No issues reported (filtered by Owl persona)

### Scenario: Token Limit Reached
- Input: Large PR (800KB)
- Strategy: xlarge (4000 tokens)
- Behavior: Only prioritized critical files included in prompt

## Design Rationale

### Why Single API Call?
- **50% cost reduction** vs. two separate API calls
- Maintains consensus benefits
- Faster review generation
- Better prompt caching efficiency

### Why JSON Schema Mode?
- Guaranteed valid JSON responses
- No parsing failures
- Structured output for GitHub comments
- Easier testing and validation

### Why Project Conventions?
- Respects team-specific patterns
- Reduces false positives on intentional choices
- Improves context awareness
- Loaded from `CLAUDE.md`, `principles/`, etc.

## Testing

For test cases and fixtures, see:
- Unit tests: [`tests/unit/consensus-engine.test.ts`](../../tests/unit/consensus-engine.test.ts)
- Integration tests: [`tests/integration/consensus-flow.test.ts`](../../tests/integration/consensus-flow.test.ts)

## Related Specs

- [`claude-api.spec.md`](../adapters/claude-api.spec.md) - API client used for LLM calls
- [`consensus-prompt.spec.md`](../prompts/consensus-prompt.spec.md) - Prompt templates
- [`types.spec.md`](./types.spec.md) - Type definitions
