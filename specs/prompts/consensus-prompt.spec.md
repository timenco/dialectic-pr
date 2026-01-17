# Consensus Prompt

## Purpose

Defines the multi-persona prompt structure sent to Claude API, implementing the Hawk-Owl consensus pattern with prompt caching, extended thinking, and JSON schema enforcement.

## Location

[src/core/consensus-engine.ts](../../src/core/consensus-engine.ts) (buildMultiPersonaPrompt method)

## Dependencies

```yaml
internal:
  - core/types.spec.md
external:
  - "@anthropic-ai/sdk": "^0.30.0"
```

## Core Responsibility

- Structure prompt into cacheable system messages and dynamic user messages
- Define Hawk persona (critical reviewer) and Owl persona (pragmatic validator)
- Include framework-specific best practices and false positive patterns
- Format output schema for guaranteed JSON parsing
- Optimize for prompt caching to reduce costs by 90%
- Enable extended thinking for higher quality reviews

## Prompt Architecture

**Cacheable System Messages (300s TTL):**
1. Agent consensus instructions (Hawk-Owl pattern)
2. False positive patterns for the project
3. Framework-specific best practices and conventions

**Dynamic User Message (not cached):**
1. Review context (framework, flags, affected areas)
2. Strategy instructions
3. Project conventions (optional)
4. PR diff content

## Persona Pattern

**HAWK** (Critical Reviewer):
- Identifies potential issues: bugs, security vulnerabilities, edge cases
- Focuses on error handling, type safety, async operations
- Raises all concerns without filtering

**OWL** (Pragmatic Validator):
- Validates Hawk's concerns against false positive patterns
- Filters based on ROI and production impact
- Outputs only high-confidence, actionable issues

**Consensus Process**:
1. Hawk analyzes diff and raises all potential issues
2. Owl validates each issue against false positive patterns
3. Only issues passing Owl's validation are reported
4. Consensus metadata tracks issues raised vs filtered

## Framework-Specific Instructions

Each framework has tailored best practices:
- **NestJS**: Dependency injection, exception filters, circular dependencies
- **Next.js**: Server components, data fetching, bundle optimization
- **React**: Hooks rules, performance optimization, state management
- **Express**: Middleware order, async handling, security
- **Vanilla**: Type safety, error handling, null checking

## Claude API Configuration

```typescript
{
  model: "claude-sonnet-4-20250514",
  temperature: 0,
  thinking: { type: "enabled", budget_tokens: 2000 },
  response_format: {
    type: "json_schema",
    json_schema: { name: "code_review", strict: true, schema: {...} }
  },
  system: [/* cacheable messages with cache_control */],
  messages: [{ role: "user", content: "..." }]
}
```

## Output Schema

```typescript
{
  issues: Array<{
    file: string;
    line?: number;
    type: "bug" | "security" | "performance" | "maintainability";
    confidence: "high" | "medium";
    title: string;
    description: string;
    suggestion?: string;
  }>;
  consensus: {
    totalReviewed: number;
    issuesRaised: number;
    issuesFiltered: number;
    overallAssessment: string;
  };
}
```

## Caching Performance

- First PR in repo: 0% cache hit
- Second PR in repo: ~90% cache hit (system messages cached)
- Cost reduction: $0.10 → $0.01 per review
- Latency reduction: 8s → 3s

## Related Specs

- [claude-api.spec.md](../adapters/claude-api.spec.md) - Implements prompt caching and API call
- [consensus-engine.spec.md](../core/consensus-engine.spec.md) - Builds and sends prompt
- [false-positive-patterns.spec.md](../patterns/false-positive-patterns.spec.md) - Pattern definitions
