import {
  ChangedFile,
  FilePriority,
  PrioritizedFile,
  PriorityRule,
} from "./types.js";
import { logger } from "../utils/logger.js";
import { MetricsCalculator } from "../utils/metrics-calculator.js";

/**
 * Smart Filter
 * 핵심 파일 우선순위 큐 관리 및 토큰 제한 내 파일 선택
 */
export class SmartFilter {
  private readonly metricsCalculator = new MetricsCalculator();

  private readonly defaultPriorityRules: PriorityRule[] = [
    // Critical: 핵심 비즈니스 로직 및 보안
    {
      pattern: /src\/(auth|payments|billing|security)\//,
      priority: "critical",
      reason: "Security-critical module",
    },
    {
      pattern: /src\/core\//,
      priority: "critical",
      reason: "Core business logic",
    },
    {
      pattern: /\.(controller|guard|middleware)\.ts$/,
      priority: "critical",
      reason: "HTTP security layer",
    },

    // High: 중요 소스 코드
    {
      pattern: /src\/.*\.(ts|tsx|js|jsx|py|java|go)$/,
      priority: "high",
      reason: "Source code",
    },
    {
      pattern: /\.(service|repository|handler)\.(ts|js)$/,
      priority: "high",
      reason: "Business layer",
    },
    {
      pattern: /\.entity\.ts$/,
      priority: "high",
      reason: "Database schema",
    },

    // Normal: 일반 코드
    {
      pattern: /\.(ts|tsx|js|jsx|py|java|go)$/,
      priority: "normal",
      reason: "Code file",
    },

    // Low: 낮은 우선순위
    {
      pattern: /\.test\.(ts|tsx|js|jsx)$/,
      priority: "low",
      reason: "Test file",
    },
    {
      pattern: /\.spec\.(ts|tsx|js|jsx)$/,
      priority: "low",
      reason: "Spec file",
    },
    {
      pattern: /\.(md|txt|json|yaml|yml)$/,
      priority: "low",
      reason: "Config/Doc file",
    },
  ];

  constructor(private customRules: PriorityRule[] = []) {}

  /**
   * 파일 우선순위 지정 및 정렬
   * @param files 변경된 파일 목록
   */
  prioritizeFiles(files: ChangedFile[]): PrioritizedFile[] {
    const allRules = [...this.defaultPriorityRules, ...this.customRules];

    return files
      .map((file) => ({
        path: file.path,
        content: file.content,
        priority: this.determinePriority(file.path, allRules),
        reason: this.getPriorityReason(file.path, allRules),
      }))
      .sort(
        (a, b) =>
          this.priorityOrder(a.priority) - this.priorityOrder(b.priority)
      );
  }

  /**
   * 토큰 제한 내에서 파일 선택
   * @param prioritizedFiles 우선순위 정렬된 파일
   * @param tokenLimit 토큰 한도
   */
  truncateToTokenLimit(
    prioritizedFiles: PrioritizedFile[],
    tokenLimit: number
  ): { included: PrioritizedFile[]; excluded: PrioritizedFile[] } {
    const included: PrioritizedFile[] = [];
    const excluded: PrioritizedFile[] = [];
    let currentTokens = 0;

    for (const file of prioritizedFiles) {
      const fileTokens = this.metricsCalculator.estimateTokens(file.content);

      if (currentTokens + fileTokens <= tokenLimit) {
        included.push(file);
        currentTokens += fileTokens;
      } else {
        excluded.push(file);
      }
    }

    // 제외된 파일이 있으면 경고 로그
    if (excluded.length > 0) {
      logger.warn(
        `⚠️ Token limit reached. ${excluded.length} files excluded from review:`
      );
      excluded
        .slice(0, 5)
        .forEach((f) =>
          logger.warn(`   - ${f.path} (${f.priority}: ${f.reason})`)
        );
      if (excluded.length > 5) {
        logger.warn(`   ... and ${excluded.length - 5} more`);
      }
    }

    logger.info(`📊 Included: ${included.length} files (~${currentTokens} tokens)`);
    logger.info(`📊 Excluded: ${excluded.length} files`);

    return { included, excluded };
  }

  /**
   * 파일 우선순위 결정
   */
  private determinePriority(
    filePath: string,
    rules: PriorityRule[]
  ): FilePriority {
    // 첫 번째 매칭되는 룰의 우선순위 반환
    for (const rule of rules) {
      if (this.matchesPattern(filePath, rule.pattern)) {
        return rule.priority;
      }
    }

    return "low"; // 기본값
  }

  /**
   * 우선순위 결정 이유
   */
  private getPriorityReason(filePath: string, rules: PriorityRule[]): string {
    for (const rule of rules) {
      if (this.matchesPattern(filePath, rule.pattern)) {
        return rule.reason;
      }
    }

    return "Unknown file type";
  }

  /**
   * 패턴 매칭
   */
  private matchesPattern(filePath: string, pattern: RegExp | string): boolean {
    if (typeof pattern === "string") {
      return filePath.includes(pattern);
    }
    return pattern.test(filePath);
  }

  /**
   * 우선순위 순서 (숫자가 작을수록 높은 우선순위)
   */
  private priorityOrder(priority: FilePriority): number {
    const order = { critical: 0, high: 1, normal: 2, low: 3 };
    return order[priority];
  }

  /**
   * 우선순위 통계
   */
  getPriorityStats(files: PrioritizedFile[]): Record<FilePriority, number> {
    const stats: Record<FilePriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    for (const file of files) {
      stats[file.priority]++;
    }

    return stats;
  }

  /**
   * 추가 우선순위 룰 설정
   */
  addCustomRules(rules: PriorityRule[]): void {
    this.customRules.push(...rules);
  }
}


