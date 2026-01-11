/**
 * Core type definitions for Dialectic PR
 */

// ============================================================================
// Framework Detection
// ============================================================================

export type FrameworkName = "nestjs" | "nextjs" | "react" | "express" | "vanilla";

export interface DetectedFramework {
  name: FrameworkName;
  version?: string;
  confidence: "high" | "medium" | "low";
}

// ============================================================================
// PR Analysis
// ============================================================================

export interface PRAnalysis {
  diff: string; // 전체 diff
  relevantDiff: string; // 필터링된 diff (TS/JS 소스코드만)
  prioritizedDiff: string; // 우선순위 정렬된 diff (토큰 제한 내)
  metrics: Metrics;
  context: PRContext;
  changedFiles: string[];
  prioritizedFiles: PrioritizedFile[];
  excludedFiles: string[]; // 제외된 파일 (로깅용)
}

export interface Metrics {
  fileCount: number;
  addedLines: number;
  deletedLines: number;
  diffSize: number; // bytes
  coreFileCount: number; // 핵심 파일 수
  tsFileCount: number; // TypeScript 파일 수
  jsFileCount: number; // JavaScript 파일 수
}

export interface PRContext {
  framework: DetectedFramework;
  affectedAreas: string[]; // ["Auth", "Payments"]
  flags: ContextFlags;
}

export interface ContextFlags {
  testChanged: boolean;
  schemaChanged: boolean;
  apiRoutesChanged: boolean; // Next.js API routes
  controllersChanged: boolean; // NestJS controllers
  criticalModule: boolean;
  configOnly: boolean;
}

// ============================================================================
// File Prioritization
// ============================================================================

export type FilePriority = "critical" | "high" | "normal" | "low";

export interface PrioritizedFile {
  path: string;
  content: string;
  priority: FilePriority;
  reason: string; // 우선순위 결정 이유
}

export interface PriorityRule {
  pattern: RegExp | string;
  priority: FilePriority;
  reason: string;
}

export interface ChangedFile {
  path: string;
  content: string;
  additions: number;
  deletions: number;
}

// ============================================================================
// Review Strategy
// ============================================================================

export type StrategyName = "small" | "medium" | "large" | "xlarge" | "skip";

export interface ReviewStrategy {
  name: StrategyName;
  maxTokens: number;
  contextTokenBudget: number; // 컨텍스트용 토큰 예산
  instructions: string; // 전략별 리뷰 지침
}

// ============================================================================
// False Positive Defense
// ============================================================================

export type FPCategory =
  | "sql-injection"
  | "error-handling"
  | "dependency-injection"
  | "logging"
  | "authentication"
  | "validation"
  | "performance"
  | "custom";

export interface FalsePositivePattern {
  id: string;
  category: FPCategory;
  pattern?: RegExp;
  explanation: string;
  severity?: "critical" | "high" | "medium" | "low";
  contextRequired?: string[];
  falsePositiveIndicators: string[]; // AI가 이런 표현을 쓰면 FP로 간주
}

export interface ProjectRules {
  patterns: FalsePositivePattern[];
  conventions: string;
  overrides?: Record<string, unknown>;
  excludePatterns: string[];
}

// ============================================================================
// Review Result
// ============================================================================

export interface ReviewResult {
  issues: ReviewIssue[];
  summary: ReviewSummary;
  metadata: ReviewMetadata;
}

export interface ReviewIssue {
  file: string;
  line?: number;
  type: "bug" | "security" | "performance" | "maintainability";
  confidence: "high" | "medium";
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
  reviewDuration: number; // milliseconds
}

// ============================================================================
// API Adapters
// ============================================================================

export interface ClaudeOptions {
  model?: string;
  maxTokens: number;
  temperature?: number;
  /** Enable extended thinking for complex analysis */
  enableThinking?: boolean;
  /** Token budget for extended thinking (default: 2000) */
  thinkingBudget?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  totalCost: number; // USD 기준
}

export interface ClaudeResponse {
  text: string;
  usage: TokenUsage;
  /** Thinking content if extended thinking was enabled */
  thinking?: string;
}

/**
 * System message with optional caching support
 */
export interface CachedSystemMessage {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

/**
 * Advanced Claude API call configuration
 */
export interface AdvancedClaudeOptions extends ClaudeOptions {
  /** System messages with caching support */
  systemMessages?: CachedSystemMessage[];
  /** Enable JSON schema mode for structured output */
  jsonSchema?: CodeReviewSchema;
}

/**
 * JSON Schema for code review output
 */
export interface CodeReviewSchema {
  name: string;
  strict: boolean;
  schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Parsed code review response from Claude
 */
export interface CodeReviewResponse {
  issues: ReviewIssue[];
  consensus: {
    totalReviewed: number;
    issuesRaised: number;
    issuesFiltered: number;
    overallAssessment: string;
  };
}

export interface GitHubPRInfo {
  owner: string;
  repo: string;
  pullNumber: number;
  baseBranch: string;
  headBranch: string;
}

export interface GitHubComment {
  path: string;
  position: number; // diff position
  body: string;
}

export interface BatchReviewParams {
  owner: string;
  repo: string;
  prNumber: number;
  comments: GitHubComment[];
  body: string;
  event?: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
}

// ============================================================================
// CLI Options
// ============================================================================

export interface CLIOptions {
  anthropicApiKey: string; // ANTHROPIC_API_KEY (필수)
  githubToken: string; // GITHUB_TOKEN (필수)
  owner: string; // PR owner
  repo: string; // PR repo
  pullNumber: number; // PR number
  baseBranch: string; // 베이스 브랜치
  configPath?: string; // 커스텀 설정 경로
  dryRun?: boolean; // 테스트 모드
  forceReview?: boolean; // 증분 리뷰 무시하고 전체 리뷰
}

// ============================================================================
// Configuration
// ============================================================================

export interface DialecticConfig {
  model: string;
  exclude_patterns: string[];
  strategies: StrategyConfig;
  false_positive_patterns: FalsePositivePattern[];
  framework_specific: FrameworkSpecificConfig;
  conventions?: ConventionsConfig;
}

export interface StrategyConfig {
  small: { maxTokens: number };
  medium: { maxTokens: number };
  large: { maxTokens: number };
  xlarge?: { maxTokens: number };
}

export interface FrameworkSpecificConfig {
  nestjs?: {
    disabled_builtin_patterns?: string[];
    custom_patterns?: FalsePositivePattern[];
    priority_modules?: string[];
  };
  nextjs?: {
    app_router?: boolean;
    check_client_components?: boolean;
  };
  [key: string]: unknown;
}

export interface ConventionsConfig {
  paths: string[];
  sections?: Record<string, string[]>;
}

// ============================================================================
// Error Types
// ============================================================================

export class DialecticError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "DialecticError";
  }
}

export class APIError extends DialecticError {
  constructor(
    public statusCode: number,
    message: string,
    details?: unknown
  ) {
    super(message, "API_ERROR", details);
    this.name = "APIError";
  }
}

export class ConfigError extends DialecticError {
  constructor(message: string, details?: unknown) {
    super(message, "CONFIG_ERROR", details);
    this.name = "ConfigError";
  }
}

export class ValidationError extends DialecticError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}


