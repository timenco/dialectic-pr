# Strategy Selector

## Purpose

Selects the appropriate review strategy based on PR size and context, determining token budgets and review focus level.

## Location

→ [`src/core/strategy-selector.ts`](../../src/core/strategy-selector.ts)

## Dependencies

```yaml
internal:
  - core/types → PRAnalysis, ReviewStrategy, StrategyName
```

## Core Responsibility

Optimize review approach based on PR characteristics:
1. Analyze PR size (diffSize in bytes)
2. Consider context flags (criticalModule, configOnly)
3. Select appropriate strategy with token limits
4. Adjust instructions for review focus
5. Apply critical module boost when needed

## Key Interface

```typescript
class StrategySelector {
  select(analysis: PRAnalysis): ReviewStrategy
  getStrategyDescription(strategy: ReviewStrategy): string
  setCustomStrategy(name: StrategyName, strategy: Partial<ReviewStrategy>): void
  getAllStrategies(): Record<StrategyName, ReviewStrategy>
}
```

## Strategies

### Small (< 50KB)
```yaml
maxTokens: 16000
contextTokenBudget: 4000
instructions: "Comprehensive review of all changes with detailed feedback"
typical_pr: 5-20 files, 200-500 lines
```

### Medium (< 150KB)
```yaml
maxTokens: 12000
contextTokenBudget: 3000
instructions: "Focus on critical issues and potential bugs. Skip minor style suggestions"
typical_pr: 20-50 files, 500-1500 lines
```

### Large (< 200KB)
```yaml
maxTokens: 8000
contextTokenBudget: 2000
instructions: "Focus only on critical security and bug issues. No style or minor suggestions"
typical_pr: 50-100 files, 1500-3000 lines
```

### XLarge (< 800KB)
```yaml
maxTokens: 4000
contextTokenBudget: 1000
instructions: "Critical security issues only. Very large PR - recommend splitting"
typical_pr: 100+ files, 3000+ lines
```

### Skip (≥ 800KB)
```yaml
maxTokens: 0
instructions: "PR is too large for meaningful review. Please split into smaller PRs"
action: Skip review, post warning comment
```

## Selection Logic

```
1. Check if config-only → Use small strategy with adjusted instructions
2. Determine base strategy by diff size
3. Apply critical module boost (1.5×) if needed
4. Return final strategy with adjusted token budget
```

## Critical Module Boost

When PR touches critical modules (auth, payments, billing, security):
- Token budget multiplied by 1.5
- Ensures thorough review of sensitive code
- Example: Medium strategy 12000 → 18000 tokens

## Config-Only Optimization

When only config files changed:
- Use small strategy
- Custom instructions: "Quick review of configuration changes only"
- Faster, focused review

## Size Thresholds

```
< 50KB   (51,200 bytes)    → small
< 150KB  (153,600 bytes)   → medium
< 200KB  (204,800 bytes)   → large
< 800KB  (819,200 bytes)   → xlarge
≥ 800KB                    → skip
```

## Custom Strategies

Projects can override default strategies:

```typescript
strategySelector.setCustomStrategy("medium", {
  maxTokens: 15000,
  instructions: "Custom focus areas for our project..."
})
```

## Integration Flow

```
PR Analyzer
  ↓ (PRAnalysis with metrics)
Strategy Selector
  ↓ (ReviewStrategy)
Consensus Engine (uses maxTokens)
  ↓
Smart Filter (uses contextTokenBudget)
```

## Token Budget Allocation

Example for medium strategy (12000 tokens):
- **Prompt structure**: ~3000 tokens (system, FP patterns, framework instructions)
- **Diff content**: ~8000 tokens (from contextTokenBudget)
- **Response**: ~1000 tokens (issues JSON)

## Related Specs

- [`analyzer.spec.md`](./analyzer.spec.md) - Provides PRAnalysis input
- [`smart-filter.spec.md`](./smart-filter.spec.md) - Uses contextTokenBudget
- [`consensus-engine.spec.md`](./consensus-engine.spec.md) - Uses maxTokens
