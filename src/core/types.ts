/**
 * Core type definitions for Dialectic PR
 */

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_MODEL = "claude-opus-4-8";

/** 보안/결제 등 크리티컬 모듈 경로 그룹 (regex 조합용) */
export const CRITICAL_MODULE_PATH = "(auth|payments|billing|security)";

/** 보안/결제 등 크리티컬 모듈 경로 패턴 */
export const CRITICAL_MODULE_PATTERN = new RegExp(`\\/${CRITICAL_MODULE_PATH}\\/`);

/** PR diff 크기별 전략 선택 임계값 (bytes) */
export const STRATEGY_THRESHOLDS = {
  SMALL: 51_200,    // 50KB
  MEDIUM: 153_600,  // 150KB
  LARGE: 204_800,   // 200KB
  XLARGE: 819_200,  // 800KB
} as const;

// ============================================================================
// Framework Detection
// ============================================================================

export type FrameworkName = "nestjs" | "nextjs" | "react" | "express" | "fastapi" | "vanilla";

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
  /** 프레임워크별 추가 플래그 수용 */
  [key: string]: boolean;
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

export interface GuardrailsFile {
  patterns?: FalsePositivePattern[];
  disabled_patterns?: string[];
}

// ============================================================================
// Review Result
// ============================================================================

export interface ReviewResult {
  issues: ReviewIssue[];
  summary: ReviewSummary;
  metadata: ReviewMetadata;
  debateNarrative?: string;
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
  verdict?: string;
  mergeable?: boolean;
  priority?: string;
  fpRate?: string;
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
// Review Engine
// ============================================================================

export interface ReviewOptions {
  anthropicApiKey: string;
  githubToken: string;
  owner: string;
  repo: string;
  pullNumber: number;
  baseBranch: string;
  configPath?: string;
  dryRun?: boolean;
  logLevel?: "debug" | "info" | "warn" | "error";
}

export interface ReviewOutput {
  issues: ReviewIssue[];
  summary: ReviewSummary;
  metadata: ReviewMetadata;
  commentBody: string;
  posted: boolean;
}

// ============================================================================
// API Adapters
// ============================================================================

export interface ClaudeOptions {
  model?: string;
  maxTokens: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export interface ClaudeResponse {
  text: string;
  usage: TokenUsage;
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
    agreedIssues?: number;
    rejectedIssues?: number;
    fpRate?: string;
    verdict?: string;
    mergeable?: boolean;
    priority?: string;
  };
  debateNarrative?: string;
}

export interface GitHubPRInfo {
  owner: string;
  repo: string;
  pullNumber: number;
  baseBranch: string;
}

// ============================================================================
// Configuration
// ============================================================================

export interface DialecticConfig {
  model: string;
  language: string;
  exclude_patterns: string[];
  strategies: StrategyConfig;
}

export interface StrategyConfig {
  small: { maxTokens: number };
  medium: { maxTokens: number };
  large: { maxTokens: number };
  xlarge?: { maxTokens: number };
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


