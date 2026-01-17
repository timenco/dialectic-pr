# Types Specification

## Purpose

Central type definitions for the entire Dialectic PR system. This file has no dependencies and serves as the foundation for all other modules.

## Location

→ [`src/core/types.ts`](../../src/core/types.ts)

## Dependencies

```yaml
external: []
internal: []
```

## Type Categories

### CLI & Configuration
- `CLIOptions` - Command-line interface options
- `Config` - User configuration structure (`.github/dialectic-pr.json`)

### Framework Types
- `FrameworkName` - `"nestjs" | "nextjs" | "react" | "express" | "vanilla"`
- `DetectedFramework` - Framework detection result with confidence

### File & Priority
- `ChangedFile` - File with additions/deletions
- `PrioritizedFile` - File with priority level and reason
- `FilePriority` - `"critical" | "high" | "normal" | "low"`
- `PriorityRule` - Pattern matching rule for priority assignment

### PR Analysis
- `PRMetrics` - File counts, line counts, diff size
- `ContextFlags` - Boolean flags (testChanged, schemaChanged, criticalModule, etc.)
- `PRContext` - Framework, affected areas, flags
- `PRAnalysis` - Complete PR analysis result
- `GitHubPRInfo` - PR identification (owner, repo, number, branches)

### Strategy Types
- `StrategyName` - `"small" | "medium" | "large" | "xlarge" | "skip"`
- `ReviewStrategy` - Strategy with token limits and instructions

### False Positive Types
- `FalsePositivePattern` - Pattern definition for FP detection
  - `id`, `category`, `explanation`
  - `falsePositiveIndicators` - Phrases that indicate false positive

### Review Result Types
- `IssueType` - `"bug" | "security" | "performance" | "maintainability"`
- `ConfidenceLevel` - `"high" | "medium"`
- `ReviewIssue` - Single issue with file, line, type, description, suggestion
- `ReviewSummary` - Total issues, critical count, affected areas, assessment
- `ReviewMetadata` - Framework, strategy, tokens used, duration
- `ReviewResult` - Complete review output (issues, summary, metadata)

### API Types

#### Claude API
- `ClaudeOptions` - API call options (maxTokens, model, temperature)
- `TokenUsage` - Input/output tokens and cost
- `ClaudeResponse` - Text response with usage

#### GitHub API
- `GitHubFile` - File with status, additions, deletions, patch
- `GitHubComment` - Path, position, body for batch review

### Error Types
- `ValidationError` - Input validation errors
- `APIError` - External API errors with status code

### Logger Types
- `LogLevel` - `"debug" | "info" | "warn" | "error"`

## Validation Rules

```yaml
all_exports_must_be_typed: true
no_any_types: true
strict_null_checks: true
readonly_where_possible: true
```

## Key Design Principles

1. **Zero Dependencies**: This file must not import from any other internal module
2. **Immutability**: Use `readonly` for all properties where appropriate
3. **Strict Typing**: No `any` types allowed
4. **Comprehensive**: All shared types must be defined here to avoid circular dependencies

## Usage Examples

See implementation file for detailed usage: [`src/core/types.ts`](../../src/core/types.ts)

Key patterns:
- All modules import types from this single source
- Enables type-safe cross-module communication
- Prevents circular dependency issues
- Facilitates refactoring and type evolution
