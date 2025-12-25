# TYPES SPECIFICATION

## DEPENDENCIES
```yaml
external: []
internal: []
```

## FILE_PATH
```
src/core/types.ts
```

## IMPLEMENTATION

```typescript
// ============================================================================
// CLI & Configuration Types
// ============================================================================

export interface CLIOptions {
  anthropicApiKey: string;
  githubToken: string;
  owner: string;
  repo: string;
  pullNumber: number;
  baseBranch: string;
  configPath?: string;
  dryRun?: boolean;
  forceReview?: boolean;
}

export interface Config {
  model: string;
  exclude_patterns: string[];
  false_positive_patterns: FalsePositivePattern[];
  strategies?: {
    small?: Partial<ReviewStrategy>;
    medium?: Partial<ReviewStrategy>;
    large?: Partial<ReviewStrategy>;
    xlarge?: Partial<ReviewStrategy>;
  };
  framework_specific?: Record<string, any>;
  conventions?: {
    paths: string[];
    sections?: Record<string, string[]>;
  };
}

// ============================================================================
// Framework Types
// ============================================================================

export type FrameworkName = "nestjs" | "nextjs" | "react" | "express" | "vanilla";

export interface DetectedFramework {
  name: FrameworkName;
  version?: string;
  confidence: "high" | "medium" | "low";
}

// ============================================================================
// File & Priority Types
// ============================================================================

export interface ChangedFile {
  path: string;
  content: string;
  additions: number;
  deletions: number;
}

export type FilePriority = "critical" | "high" | "normal" | "low";

export interface PrioritizedFile {
  path: string;
  content: string;
  priority: FilePriority;
  reason: string;
}

export interface PriorityRule {
  pattern: RegExp | string;
  priority: FilePriority;
  reason: string;
}

// ============================================================================
// PR Analysis Types
// ============================================================================

export interface PRMetrics {
  fileCount: number;
  addedLines: number;
  deletedLines: number;
  diffSize: number;
  coreFileCount: number;
  tsFileCount: number;
  jsFileCount: number;
}

export interface ContextFlags {
  testChanged: boolean;
  schemaChanged: boolean;
  apiRoutesChanged: boolean;
  controllersChanged: boolean;
  criticalModule: boolean;
  configOnly: boolean;
}

export interface PRContext {
  framework: DetectedFramework;
  affectedAreas: string[];
  flags: ContextFlags;
}

export interface PRAnalysis {
  diff: string;
  relevantDiff: string;
  prioritizedDiff: string;
  metrics: PRMetrics;
  context: PRContext;
  changedFiles: string[];
  prioritizedFiles: PrioritizedFile[];
  excludedFiles: string[];
}

export interface GitHubPRInfo {
  owner: string;
  repo: string;
  pullNumber: number;
  baseBranch: string;
  headBranch: string;
}

// ============================================================================
// Strategy Types
// ============================================================================

export type StrategyName = "small" | "medium" | "large" | "xlarge" | "skip";

export interface ReviewStrategy {
  name: StrategyName;
  maxTokens: number;
  contextTokenBudget: number;
  instructions: string;
}

// ============================================================================
// False Positive Types
// ============================================================================

export interface FalsePositivePattern {
  id: string;
  category: string;
  pattern?: RegExp;
  explanation: string;
  severity?: string;
  contextRequired?: string[];
  falsePositiveIndicators: string[];
}

// ============================================================================
// Review Result Types
// ============================================================================

export type IssueType = "bug" | "security" | "performance" | "maintainability";
export type ConfidenceLevel = "high" | "medium";

export interface ReviewIssue {
  file: string;
  line?: number;
  type: IssueType;
  confidence: ConfidenceLevel;
  title: string;
  description: string;
  suggestion?: string;
}

export interface ReviewSummary {
  totalIssues: number;
  criticalIssues: number;
  affectedAreas: string[];
  overallAssessment: string;
}

export interface ReviewMetadata {
  framework: DetectedFramework;
  strategy: StrategyName;
  tokensUsed: number;
  filesReviewed: number;
  filesExcluded: number;
  reviewDuration: number;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  summary: ReviewSummary;
  metadata: ReviewMetadata;
}

// ============================================================================
// Claude API Types
// ============================================================================

export interface ClaudeOptions {
  maxTokens: number;
  model?: string;
  temperature?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

export interface ClaudeResponse {
  text: string;
  usage: TokenUsage;
}

// ============================================================================
// GitHub API Types
// ============================================================================

export interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface GitHubComment {
  path: string;
  position: number;
  body: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = "APIError";
  }
}

// ============================================================================
// Logger Types
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";
```

## VALIDATION_RULES
```yaml
all_exports_must_be_typed: true
no_any_types: true
strict_null_checks: true
readonly_where_possible: true
```

## USAGE_EXAMPLES
```typescript
// Example 1: Creating PR analysis result
const analysis: PRAnalysis = {
  diff: "...",
  relevantDiff: "...",
  prioritizedDiff: "...",
  metrics: {
    fileCount: 5,
    addedLines: 100,
    deletedLines: 20,
    diffSize: 12000,
    coreFileCount: 3,
    tsFileCount: 4,
    jsFileCount: 1
  },
  context: {
    framework: { name: "nestjs", version: "10.0.0", confidence: "high" },
    affectedAreas: ["🔐 Auth", "⚙️ Business Logic"],
    flags: {
      testChanged: false,
      schemaChanged: true,
      apiRoutesChanged: false,
      controllersChanged: true,
      criticalModule: true,
      configOnly: false
    }
  },
  changedFiles: ["src/auth/auth.service.ts"],
  prioritizedFiles: [],
  excludedFiles: []
};

// Example 2: Creating review result
const result: ReviewResult = {
  issues: [
    {
      file: "src/auth/auth.service.ts",
      line: 42,
      type: "security",
      confidence: "high",
      title: "Missing input validation",
      description: "User input not validated before database query",
      suggestion: "Add class-validator DTO validation"
    }
  ],
  summary: {
    totalIssues: 1,
    criticalIssues: 1,
    affectedAreas: ["🔐 Auth"],
    overallAssessment: "⚠️ Found 1 critical issue that should be addressed"
  },
  metadata: {
    framework: { name: "nestjs", confidence: "high" },
    strategy: "small",
    tokensUsed: 12000,
    filesReviewed: 3,
    filesExcluded: 2,
    reviewDuration: 5000
  }
};
```

## TEST_CASES
```yaml
type_definitions:
  - all_interfaces_compile: true
  - no_circular_dependencies: true
  - exports_accessible: true
```

