import { FalsePositivePattern, ReviewIssue } from "../core/types.js";
import { logger } from "../utils/logger.js";

/**
 * Pattern Match Result
 */
export interface PatternMatchResult {
  /** Whether a false positive was detected */
  isFalsePositive: boolean;
  /** The pattern that matched (if any) */
  matchedPattern?: FalsePositivePattern;
  /** Confidence in the match (0-1) */
  confidence: number;
  /** Matched indicators */
  matchedIndicators: string[];
}

/**
 * Pattern Matcher
 * AI 리뷰 결과에서 False Positive를 탐지하는 패턴 매칭 엔진
 */
export class PatternMatcher {
  private patterns: FalsePositivePattern[] = [];

  constructor(patterns: FalsePositivePattern[] = []) {
    this.patterns = patterns;
  }

  /**
   * 리뷰 이슈가 False Positive인지 확인
   * @param issue 리뷰 이슈
   * @param fileContent 파일 내용 (선택적, 컨텍스트 확인용)
   */
  checkIssue(
    issue: ReviewIssue,
    fileContent?: string
  ): PatternMatchResult {
    const issueText = `${issue.title} ${issue.description} ${issue.suggestion || ""}`.toLowerCase();

    for (const pattern of this.patterns) {
      const result = this.matchPattern(pattern, issueText, fileContent);
      if (result.isFalsePositive) {
        logger.debug(
          `🎯 FP detected: "${issue.title}" matched pattern "${pattern.id}"`
        );
        return result;
      }
    }

    return {
      isFalsePositive: false,
      confidence: 0,
      matchedIndicators: [],
    };
  }

  /**
   * 여러 이슈 필터링
   * @param issues 리뷰 이슈 목록
   * @param fileContents 파일 내용 맵 (경로 -> 내용)
   */
  filterIssues(
    issues: ReviewIssue[],
    fileContents?: Map<string, string>
  ): {
    filtered: ReviewIssue[];
    removed: Array<{ issue: ReviewIssue; reason: PatternMatchResult }>;
  } {
    const filtered: ReviewIssue[] = [];
    const removed: Array<{ issue: ReviewIssue; reason: PatternMatchResult }> = [];

    for (const issue of issues) {
      const fileContent = fileContents?.get(issue.file);
      const result = this.checkIssue(issue, fileContent);

      if (result.isFalsePositive) {
        removed.push({ issue, reason: result });
      } else {
        filtered.push(issue);
      }
    }

    if (removed.length > 0) {
      logger.info(
        `🔇 Filtered ${removed.length} false positive(s) from ${issues.length} issues`
      );
    }

    return { filtered, removed };
  }

  /**
   * 단일 패턴 매칭
   */
  private matchPattern(
    pattern: FalsePositivePattern,
    issueText: string,
    fileContent?: string
  ): PatternMatchResult {
    const matchedIndicators: string[] = [];
    let score = 0;

    // 1. Check false positive indicators (main matching method)
    for (const indicator of pattern.falsePositiveIndicators) {
      const indicatorLower = indicator.toLowerCase();
      if (issueText.includes(indicatorLower)) {
        matchedIndicators.push(indicator);
        score += 1;
      }
    }

    // 2. Check pattern regex if available
    if (pattern.pattern && fileContent) {
      if (pattern.pattern.test(fileContent)) {
        score += 0.5;
      }
    }

    // 3. Check context requirements if specified
    if (pattern.contextRequired && fileContent) {
      const contextMatched = pattern.contextRequired.some((ctx) =>
        fileContent.includes(ctx)
      );
      if (contextMatched) {
        score += 0.3;
      } else {
        // Context required but not found - reduce confidence
        score -= 0.5;
      }
    }

    // Calculate confidence (0-1)
    const maxPossibleScore =
      pattern.falsePositiveIndicators.length +
      (pattern.pattern ? 0.5 : 0) +
      (pattern.contextRequired ? 0.3 : 0);

    const confidence = maxPossibleScore > 0 ? Math.min(score / maxPossibleScore, 1) : 0;

    // Threshold for false positive detection
    const isFalsePositive = matchedIndicators.length >= 1 && confidence >= 0.3;

    return {
      isFalsePositive,
      matchedPattern: isFalsePositive ? pattern : undefined,
      confidence,
      matchedIndicators,
    };
  }

  /**
   * 패턴 통계 가져오기
   */
  getPatternStats(): {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const pattern of this.patterns) {
      // Category stats
      byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1;

      // Severity stats
      const severity = pattern.severity || "medium";
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    }

    return {
      total: this.patterns.length,
      byCategory,
      bySeverity,
    };
  }

}
