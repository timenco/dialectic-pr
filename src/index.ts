/**
 * Dialectic PR
 * AI code reviewer for TypeScript projects with multi-persona consensus
 */

// Core Types
export * from "./core/types.js";

// Core Components
export { PRAnalyzer } from "./core/analyzer.js";
export { SmartFilter } from "./core/smart-filter.js";
export { StrategySelector } from "./core/strategy-selector.js";
export { ConsensusEngine } from "./core/consensus-engine.js";
export { runReview } from "./core/review-engine.js";
export { formatReviewBody, formatModelName, extractConsensusData, formatFallbackIssues } from "./core/review-formatter.js";
export { createReviewComponents, ReviewComponents } from "./core/review-factory.js";

// Adapters
export { ClaudeAdapter } from "./adapters/claude-api.js";
export { GitHubAdapter } from "./adapters/github-api.js";
export { RetryHandler } from "./adapters/retry-handler.js";

// Security
export { PrivacyGuard } from "./security/privacy-guard.js";
export { ExcludeFilter } from "./security/exclude-filter.js";

// Frameworks
export {
  FrameworkDetector,
  Framework,
  BaseFramework,
  FrameworkRegistry,
  FrameworkService,
  IFrameworkService,
  NestJSFramework,
  NextJSFramework,
  ReactFramework,
  ExpressFramework,
  VanillaFramework,
  registerAllFrameworks,
} from "./frameworks/index.js";

// Utils
export { logger } from "./utils/logger.js";
export { ConfigLoader } from "./utils/config-loader.js";
export { MetricsCalculator } from "./utils/metrics-calculator.js";
export { GuardrailsLoader } from "./utils/guardrails-loader.js";
export { ConventionsLoader } from "./utils/conventions-loader.js";
export { isSourceFile, isTestFile, isSchemaFile, isConfigFile } from "./utils/file-classifier.js";

// False Positive Defense
export {
  BUILTIN_PATTERNS,
  getPatternsByCategory,
  getPatternById,
  getAllPatternIds,
  PatternMatcher,
  PatternMatchResult,
  ProjectRulesLoader,
} from "./false-positive/index.js";

