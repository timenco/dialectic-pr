# Metrics Calculator

## Purpose

Analyzes PR diffs and file lists to extract quantitative metrics about the change, including line counts, affected files, and token estimates for API usage.

## Location

[src/utils/metrics-calculator.ts](../../src/utils/metrics-calculator.ts)

## Dependencies

```yaml
internal:
  - core/types.spec.md
external: []
```

## Core Responsibility

- Count added and deleted lines from unified diff format
- Calculate total diff size in bytes
- Identify core/critical files based on directory patterns
- Categorize files by language (TypeScript vs JavaScript)
- Estimate token count for API cost prediction
- Return structured metrics for logging and strategy selection

## Key Interface

```typescript
export class MetricsCalculator {
  calculate(diff: string, files: string[]): PRMetrics;
  estimateTokens(content: string): number;
}

interface PRMetrics {
  fileCount: number;
  addedLines: number;
  deletedLines: number;
  diffSize: number;
  coreFileCount: number;
  tsFileCount: number;
  jsFileCount: number;
}
```

## Calculation Logic

**Line counting**: Parses unified diff format, counting lines starting with `+` (added) or `-` (deleted), excluding file headers (`+++`, `---`).

**Core files**: Files in critical directories like `src/auth/`, `src/payments/`, `src/billing/`, `src/security/`, `src/core/`.

**Token estimation**: Approximates 4 characters = 1 token (conservative estimate for Claude API).

## Related Specs

- [types.spec.md](../core/types.spec.md) - PRMetrics type definition
- [strategy-selector.spec.md](../strategies/strategy-selector.spec.md) - Uses metrics for strategy selection
