/**
 * @dialectic-pr/core
 * The AI Code Reviewer for TypeScript Projects
 */

// Core Types
export * from "./core/types.js";

// Core Components
export { PRAnalyzer } from "./core/analyzer.js";
export { SmartFilter } from "./core/smart-filter.js";
export { StrategySelector } from "./core/strategy-selector.js";
export { ConsensusEngine } from "./core/consensus-engine.js";

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
  FrameworkContextFlags,
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

