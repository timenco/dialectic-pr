# STRATEGY SELECTOR SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - core/types.spec.md
  - utils/logger.spec.md
external: []
```

## FILE_PATH
```
src/core/strategy-selector.ts
```

## CLASS_INTERFACE
```typescript
export class StrategySelector {
  select(analysis: PRAnalysis): ReviewStrategy;
  getStrategyDescription(strategy: ReviewStrategy): string;
  setCustomStrategy(name: StrategyName, strategy: Partial<ReviewStrategy>): void;
  getAllStrategies(): Record<StrategyName, ReviewStrategy>;
}
```

## STRATEGIES
```typescript
const STRATEGIES: Record<StrategyName, ReviewStrategy> = {
  small: {
    name: "small",
    maxTokens: 16000,
    contextTokenBudget: 4000,
    instructions: "Comprehensive review of all changes with detailed feedback."
  },
  medium: {
    name: "medium",
    maxTokens: 12000,
    contextTokenBudget: 3000,
    instructions: "Focus on critical issues and potential bugs. Skip minor style suggestions."
  },
  large: {
    name: "large",
    maxTokens: 8000,
    contextTokenBudget: 2000,
    instructions: "Focus only on critical security and bug issues. No style or minor suggestions."
  },
  xlarge: {
    name: "xlarge",
    maxTokens: 4000,
    contextTokenBudget: 1000,
    instructions: "Critical security issues only. Very large PR - recommend splitting."
  },
  skip: {
    name: "skip",
    maxTokens: 0,
    contextTokenBudget: 0,
    instructions: "PR is too large for meaningful review. Please split into smaller PRs."
  }
};
```

## IMPLEMENTATION
```typescript
import { PRAnalysis, ReviewStrategy, StrategyName } from "./types.js";
import { logger } from "../utils/logger.js";

export class StrategySelector {
  private readonly strategies: Record<StrategyName, ReviewStrategy> = STRATEGIES;

  select(analysis: PRAnalysis): ReviewStrategy {
    const { diffSize } = analysis.metrics;
    const { criticalModule, configOnly } = analysis.context.flags;

    // Config-only: quick review
    if (configOnly) {
      logger.info("📝 Config-only changes, using small strategy");
      return {
        ...this.strategies.small,
        instructions: "Quick review of configuration changes only."
      };
    }

    // Critical module: boost token budget
    const criticalBoost = criticalModule ? 1.5 : 1;

    // Select base strategy by size
    let strategy: ReviewStrategy;

    if (diffSize < 51200) {
      // < 50KB
      strategy = this.strategies.small;
    } else if (diffSize < 153600) {
      // < 150KB
      strategy = this.strategies.medium;
    } else if (diffSize < 204800) {
      // < 200KB
      strategy = this.strategies.large;
    } else if (diffSize < 819200) {
      // < 800KB
      strategy = this.strategies.xlarge;
    } else {
      strategy = this.strategies.skip;
    }

    // Apply critical boost
    if (criticalBoost > 1) {
      logger.info(
        `🔐 Critical module: boosting token budget by ${(criticalBoost - 1) * 100}%`
      );
      strategy = {
        ...strategy,
        maxTokens: Math.floor(strategy.maxTokens * criticalBoost),
        contextTokenBudget: Math.floor(
          strategy.contextTokenBudget * criticalBoost
        )
      };
    }

    logger.info(`📊 Strategy: ${strategy.name} (${strategy.maxTokens} tokens)`);

    return strategy;
  }

  getStrategyDescription(strategy: ReviewStrategy): string {
    return `Strategy: ${strategy.name.toUpperCase()}
Max Tokens: ${strategy.maxTokens}
Context Budget: ${strategy.contextTokenBudget}
Instructions: ${strategy.instructions}`;
  }

  setCustomStrategy(name: StrategyName, strategy: Partial<ReviewStrategy>): void {
    this.strategies[name] = {
      ...this.strategies[name],
      ...strategy,
      name
    };
  }

  getAllStrategies(): Record<StrategyName, ReviewStrategy> {
    return { ...this.strategies };
  }
}
```

## SIZE_THRESHOLDS
```yaml
small:
  max_size: 50KB
  tokens: 16000

medium:
  max_size: 150KB
  tokens: 12000

large:
  max_size: 200KB
  tokens: 8000

xlarge:
  max_size: 800KB
  tokens: 4000

skip:
  above: 800KB
  tokens: 0
```

## TEST_CASES
```yaml
test_small_pr:
  input: diffSize = 40KB
  assert: strategy = small

test_critical_boost:
  input:
    diffSize: 40KB
    criticalModule: true
  assert:
    strategy: small
    maxTokens: 24000  # 16000 * 1.5

test_config_only:
  input: configOnly = true
  assert:
    strategy: small
    instructions: contains "configuration"

test_too_large:
  input: diffSize = 900KB
  assert: strategy = skip
```

