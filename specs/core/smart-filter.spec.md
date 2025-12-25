# SMART FILTER SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - core/types.spec.md
  - utils/logger.spec.md
  - utils/metrics-calculator.spec.md
external: []
```

## FILE_PATH
```
src/core/smart-filter.ts
```

## CLASS_INTERFACE
```typescript
export class SmartFilter {
  constructor(customRules?: PriorityRule[]);
  prioritizeFiles(files: ChangedFile[]): PrioritizedFile[];
  truncateToTokenLimit(
    prioritizedFiles: PrioritizedFile[],
    tokenLimit: number
  ): { included: PrioritizedFile[]; excluded: PrioritizedFile[] };
  getPriorityStats(files: PrioritizedFile[]): Record<FilePriority, number>;
  addCustomRules(rules: PriorityRule[]): void;
}
```

## DEFAULT_PRIORITY_RULES
```typescript
const DEFAULT_RULES: PriorityRule[] = [
  // Critical: Security and core business logic
  {
    pattern: /src\/(auth|payments|billing|security)\//,
    priority: "critical",
    reason: "Security-critical module"
  },
  {
    pattern: /src\/core\//,
    priority: "critical",
    reason: "Core business logic"
  },
  {
    pattern: /\.(controller|guard|middleware)\.ts$/,
    priority: "critical",
    reason: "HTTP security layer"
  },
  
  // High: Important source code
  {
    pattern: /src\/.*\.(ts|tsx|js|jsx)$/,
    priority: "high",
    reason: "Source code"
  },
  {
    pattern: /\.(service|repository|handler)\.(ts|js)$/,
    priority: "high",
    reason: "Business layer"
  },
  {
    pattern: /\.entity\.ts$/,
    priority: "high",
    reason: "Database schema"
  },
  
  // Normal: General code
  {
    pattern: /\.(ts|tsx|js|jsx)$/,
    priority: "normal",
    reason: "Code file"
  },
  
  // Low: Tests and config
  {
    pattern: /\.test\.(ts|tsx|js|jsx)$/,
    priority: "low",
    reason: "Test file"
  },
  {
    pattern: /\.spec\.(ts|tsx|js|jsx)$/,
    priority: "low",
    reason: "Spec file"
  },
  {
    pattern: /\.(md|txt|json|yaml|yml)$/,
    priority: "low",
    reason: "Config/Doc file"
  }
];
```

## IMPLEMENTATION
```typescript
import {
  ChangedFile,
  FilePriority,
  PrioritizedFile,
  PriorityRule
} from "./types.js";
import { logger } from "../utils/logger.js";
import { MetricsCalculator } from "../utils/metrics-calculator.js";

export class SmartFilter {
  private readonly metricsCalculator = new MetricsCalculator();
  private readonly defaultPriorityRules: PriorityRule[] = DEFAULT_RULES;

  constructor(private customRules: PriorityRule[] = []) {}

  prioritizeFiles(files: ChangedFile[]): PrioritizedFile[] {
    const allRules = [...this.defaultPriorityRules, ...this.customRules];

    return files
      .map(file => ({
        path: file.path,
        content: file.content,
        priority: this.determinePriority(file.path, allRules),
        reason: this.getPriorityReason(file.path, allRules)
      }))
      .sort(
        (a, b) =>
          this.priorityOrder(a.priority) - this.priorityOrder(b.priority)
      );
  }

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

    if (excluded.length > 0) {
      logger.warn(
        `⚠️ Token limit reached. ${excluded.length} files excluded:`
      );
      excluded
        .slice(0, 5)
        .forEach(f =>
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

  getPriorityStats(files: PrioritizedFile[]): Record<FilePriority, number> {
    const stats: Record<FilePriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0
    };

    for (const file of files) {
      stats[file.priority]++;
    }

    return stats;
  }

  addCustomRules(rules: PriorityRule[]): void {
    this.customRules.push(...rules);
  }

  private determinePriority(
    filePath: string,
    rules: PriorityRule[]
  ): FilePriority {
    for (const rule of rules) {
      if (this.matchesPattern(filePath, rule.pattern)) {
        return rule.priority;
      }
    }
    return "low";
  }

  private getPriorityReason(filePath: string, rules: PriorityRule[]): string {
    for (const rule of rules) {
      if (this.matchesPattern(filePath, rule.pattern)) {
        return rule.reason;
      }
    }
    return "Unknown file type";
  }

  private matchesPattern(filePath: string, pattern: RegExp | string): boolean {
    if (typeof pattern === "string") {
      return filePath.includes(pattern);
    }
    return pattern.test(filePath);
  }

  private priorityOrder(priority: FilePriority): number {
    const order = { critical: 0, high: 1, normal: 2, low: 3 };
    return order[priority];
  }
}
```

## BEHAVIOR
```yaml
file_src_auth_service_ts:
  matched_rule: "src/(auth|...)"
  priority: critical
  reason: "Security-critical module"

file_src_utils_helper_ts:
  matched_rule: "src/.*\\.(ts|...)"
  priority: high
  reason: "Source code"

file_README_md:
  matched_rule: "\\.(md|...)"
  priority: low
  reason: "Config/Doc file"
```

## TEST_CASES
```yaml
test_critical_priority:
  input: "src/auth/auth.service.ts"
  assert:
    priority: critical
    reason: "Security-critical module"

test_sorting:
  input: [low_file, critical_file, high_file]
  assert: [critical_file, high_file, low_file]

test_token_truncation:
  input:
    files: [critical_1k_tokens, high_2k_tokens]
    limit: 2000
  assert:
    included: [critical_1k_tokens]
    excluded: [high_2k_tokens]
```

