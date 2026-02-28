import { PRAnalysis, ReviewStrategy, StrategyName } from "./types.js";
import { logger } from "../utils/logger.js";

/**
 * Strategy Selector
 * PR 크기와 컨텍스트에 따라 리뷰 전략 선택
 */
export class StrategySelector {
  private readonly strategies: Record<StrategyName, ReviewStrategy> = {
    small: {
      name: "small",
      maxTokens: 16000,
      contextTokenBudget: 4000,
      instructions: "Comprehensive review of all changes with detailed feedback.",
    },
    medium: {
      name: "medium",
      maxTokens: 12000,
      contextTokenBudget: 3000,
      instructions:
        "Focus on critical issues and potential bugs. Skip minor style suggestions.",
    },
    large: {
      name: "large",
      maxTokens: 8000,
      contextTokenBudget: 2000,
      instructions:
        "Focus only on critical security and bug issues. No style or minor suggestions.",
    },
    xlarge: {
      name: "xlarge",
      maxTokens: 4000,
      contextTokenBudget: 1000,
      instructions:
        "Critical security issues only. Very large PR - recommend splitting.",
    },
    skip: {
      name: "skip",
      maxTokens: 0,
      contextTokenBudget: 0,
      instructions: "PR is too large for meaningful review. Please split into smaller PRs.",
    },
  };

  /**
   * PR 분석 결과를 기반으로 리뷰 전략 선택
   * @param analysis PR 분석 결과
   */
  select(analysis: PRAnalysis): ReviewStrategy {
    const { diffSize } = analysis.metrics;
    const { criticalModule, configOnly } = analysis.context.flags;

    // Config-only 변경은 빠르게 처리
    if (configOnly) {
      logger.info("📝 Config-only changes detected, using small strategy");
      return {
        ...this.strategies.small,
        instructions: "Quick review of configuration changes only.",
      };
    }

    // Critical 모듈은 토큰 예산 증가
    const criticalBoost = criticalModule ? 1.5 : 1;

    // 기본 전략 선택 (현재 워크플로우의 68-83줄 로직)
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

    // Critical boost 적용
    if (criticalBoost > 1) {
      logger.info(
        `🔐 Critical module detected, boosting token budget by ${(criticalBoost - 1) * 100}%`
      );
      strategy = {
        ...strategy,
        maxTokens: Math.floor(strategy.maxTokens * criticalBoost),
        contextTokenBudget: Math.floor(
          strategy.contextTokenBudget * criticalBoost
        ),
      };
    }

    logger.info(`📊 Selected strategy: ${strategy.name} (${strategy.maxTokens} tokens)`);

    return strategy;
  }

}
