import { ReviewOptions, DialecticConfig } from "./types.js";
import { PrivacyGuard } from "../security/privacy-guard.js";
import { ExcludeFilter } from "../security/exclude-filter.js";
import { SmartFilter } from "./smart-filter.js";
import { PRAnalyzer } from "./analyzer.js";
import { StrategySelector } from "./strategy-selector.js";
import { ClaudeAdapter } from "../adapters/claude-api.js";
import { GitHubAdapter } from "../adapters/github-api.js";
import { FrameworkDetector } from "../frameworks/detector.js";
import { ProjectRulesLoader } from "../false-positive/project-rules-loader.js";
import { FrameworkService, IFrameworkService } from "../frameworks/framework-service.js";

/**
 * Components created by the review factory
 */
export interface ReviewComponents {
  privacyGuard: PrivacyGuard;
  claudeAdapter: ClaudeAdapter;
  githubAdapter: GitHubAdapter;
  prAnalyzer: PRAnalyzer;
  strategySelector: StrategySelector;
  rulesLoader: ProjectRulesLoader;
  frameworkService: IFrameworkService;
}

/**
 * Create all components needed for a review
 */
export function createReviewComponents(
  options: ReviewOptions,
  config: DialecticConfig
): ReviewComponents {
  const privacyGuard = new PrivacyGuard();
  const claudeAdapter = new ClaudeAdapter(options.anthropicApiKey, config.model);
  const githubAdapter = new GitHubAdapter(options.githubToken);

  const frameworkService = new FrameworkService();
  const excludeFilter = new ExcludeFilter(config.exclude_patterns);
  const smartFilter = new SmartFilter();
  const frameworkDetector = new FrameworkDetector();
  const prAnalyzer = new PRAnalyzer(excludeFilter, smartFilter, frameworkDetector, frameworkService);

  const strategySelector = new StrategySelector();
  const rulesLoader = new ProjectRulesLoader(frameworkService);

  return {
    privacyGuard,
    claudeAdapter,
    githubAdapter,
    prAnalyzer,
    strategySelector,
    rulesLoader,
    frameworkService,
  };
}
