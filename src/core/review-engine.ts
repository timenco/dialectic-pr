import {
  ReviewOptions,
  ReviewOutput,
  ReviewResult,
  PRAnalysis,
  ChangedFile,
} from "./types.js";
import { logger } from "../utils/logger.js";
import { PrivacyGuard } from "../security/privacy-guard.js";
import { ExcludeFilter } from "../security/exclude-filter.js";
import { SmartFilter } from "./smart-filter.js";
import { PRAnalyzer } from "./analyzer.js";
import { StrategySelector } from "./strategy-selector.js";
import { ConsensusEngine } from "./consensus-engine.js";
import { ClaudeAdapter } from "../adapters/claude-api.js";
import { GitHubAdapter } from "../adapters/github-api.js";
import { FrameworkDetector } from "../frameworks/detector.js";
import { ConfigLoader } from "../utils/config-loader.js";
import { ProjectRulesLoader } from "../false-positive/project-rules-loader.js";

/**
 * Format review result into a GitHub comment body
 */
function formatReviewBody(result: ReviewResult, analysis: PRAnalysis): string {
  const lines: string[] = [];

  lines.push("## 🤖 Dialectic PR Review");
  lines.push("");
  lines.push(
    `**Framework**: ${analysis.context.framework.name} ${analysis.context.framework.version || ""}`
  );
  lines.push(`**Strategy**: ${result.metadata.strategy}`);
  lines.push(`**Files Reviewed**: ${result.metadata.filesReviewed}`);
  lines.push("");

  if (result.summary.affectedAreas.length > 0) {
    lines.push(
      `**Affected Areas**: ${result.summary.affectedAreas.join(", ")}`
    );
    lines.push("");
  }

  lines.push("### Summary");
  lines.push("");
  lines.push(result.summary.overallAssessment);
  lines.push("");

  if (result.issues.length > 0) {
    lines.push("### Issues");
    lines.push("");

    for (const issue of result.issues) {
      const emoji = {
        security: "🔐",
        bug: "🐛",
        performance: "⚡",
        maintainability: "🔧",
      }[issue.type];

      lines.push(`#### ${emoji} ${issue.title}`);
      lines.push("");
      lines.push(
        `**File**: \`${issue.file}\`${issue.line ? ` (Line ${issue.line})` : ""}`
      );
      lines.push(`**Type**: ${issue.type}`);
      lines.push(`**Confidence**: ${issue.confidence}`);
      lines.push("");
      lines.push(issue.description);

      if (issue.suggestion) {
        lines.push("");
        lines.push("**Suggestion**:");
        lines.push("");
        lines.push(issue.suggestion);
      }

      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  lines.push("### Metadata");
  lines.push("");
  lines.push(`- Tokens Used: ${result.metadata.tokensUsed.toLocaleString()}`);
  lines.push(
    `- Duration: ${(result.metadata.reviewDuration / 1000).toFixed(2)}s`
  );
  lines.push("");
  lines.push(
    "*Powered by [Dialectic PR](https://github.com/timenco/dialectic-pr)*"
  );

  return lines.join("\n");
}

/**
 * Run a full PR review
 *
 * Shared orchestration logic used by both CLI and GitHub Action entry points.
 * Does NOT call process.exit() — callers are responsible for exit behavior.
 */
export async function runReview(options: ReviewOptions): Promise<ReviewOutput> {
  logger.section("Dialectic PR Review");

  // 1. Privacy Guard
  const privacyGuard = new PrivacyGuard();
  privacyGuard.displayDisclaimer();
  privacyGuard.validateEnvironment(["ANTHROPIC_API_KEY", "GITHUB_TOKEN"]);

  // 2. Load config
  const configLoader = new ConfigLoader();
  const repoPath = process.cwd();
  const config = await configLoader.load(repoPath, options.configPath);

  // 3. Adapters
  const claudeAdapter = new ClaudeAdapter(
    options.anthropicApiKey,
    config.model
  );
  const githubAdapter = new GitHubAdapter(options.githubToken);

  // 4. Core components
  const excludeFilter = new ExcludeFilter(config.exclude_patterns);
  const smartFilter = new SmartFilter();
  const frameworkDetector = new FrameworkDetector();
  const prAnalyzer = new PRAnalyzer(excludeFilter, smartFilter, frameworkDetector);
  const strategySelector = new StrategySelector();

  // 5. PR info
  const prInfo = {
    owner: options.owner,
    repo: options.repo,
    pullNumber: options.pullNumber,
    baseBranch: options.baseBranch,
    headBranch: "",
  };

  // 6. Fetch PR data
  logger.info("📥 Fetching PR data from GitHub...");
  const diff = await githubAdapter.getPRDiff(prInfo);
  const prFiles = await githubAdapter.getPRFiles(prInfo);

  // 7. Secrets validation
  privacyGuard.validateNoSecrets(diff);

  // 8. File transformation
  const changedFiles: ChangedFile[] = prFiles.map((f) => ({
    path: f.filename,
    content: f.patch || "",
    additions: f.additions,
    deletions: f.deletions,
  }));

  // 9. PR analysis
  const analysis = await prAnalyzer.analyze(diff, changedFiles, prInfo, repoPath);

  // 10. Strategy selection
  const strategy = strategySelector.select(analysis);

  // Skip strategy — post warning and return early
  if (strategy.name === "skip") {
    logger.warn("⚠️ PR is too large for meaningful review");
    const skipBody = `## 🤖 Dialectic PR Review\n\n⚠️ **PR Too Large**: This PR is too large for meaningful AI review (${(analysis.metrics.diffSize / 1024).toFixed(1)} KB).\n\nPlease split this into smaller PRs for better review quality.`;

    let posted = false;
    if (!options.dryRun) {
      await githubAdapter.postComment(prInfo, skipBody);
      posted = true;
    }

    return {
      issues: [],
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        affectedAreas: analysis.context.affectedAreas,
        overallAssessment: "PR too large for meaningful review",
      },
      metadata: {
        framework: analysis.context.framework,
        strategy: strategy.name,
        tokensUsed: 0,
        filesReviewed: 0,
        filesExcluded: analysis.excludedFiles.length,
        reviewDuration: 0,
      },
      commentBody: skipBody,
      posted,
    };
  }

  // 11. CLAUDE.md 자동 감지
  const conventions = await configLoader.loadClaudeMd(repoPath);

  // 11b. guardrails.json 자동 감지
  const guardrails = await configLoader.loadGuardrails(repoPath);

  // 11c. FP 패턴 조합 (builtin + framework - disabled + project)
  const rulesLoader = new ProjectRulesLoader();
  const basePatterns = rulesLoader.load(
    analysis.context.framework.name,
    guardrails.disabled_patterns || []
  );
  const allPatternsMap = new Map(basePatterns.map(p => [p.id, p]));
  for (const p of guardrails.patterns || []) {
    allPatternsMap.set(p.id, p); // 프로젝트 패턴이 빌트인 override
  }
  const allPatterns = Array.from(allPatternsMap.values());

  // 12. Consensus Engine — pass language
  const consensusEngine = new ConsensusEngine(
    claudeAdapter,
    conventions,
    config.language
  );
  const result = await consensusEngine.generateReview(
    analysis,
    strategy,
    allPatterns
  );

  // 13. Log results
  logger.section("Review Results");
  logger.info(`Total Issues: ${result.summary.totalIssues}`);
  logger.info(`Critical Issues: ${result.summary.criticalIssues}`);
  logger.info(`Assessment: ${result.summary.overallAssessment}`);

  // 14. Format and post
  let commentBody: string;
  let posted = false;

  if (result.issues.length > 0) {
    commentBody = formatReviewBody(result, analysis);
  } else {
    commentBody = `## 🤖 Dialectic PR Review\n\n✅ ${result.summary.overallAssessment}`;
  }

  if (!options.dryRun) {
    await githubAdapter.postComment(prInfo, commentBody);
    posted = true;
    logger.success(
      result.issues.length > 0
        ? "✅ Review posted to GitHub"
        : "✅ Review posted to GitHub (no issues found)"
    );
  } else {
    logger.info("🧪 Dry run mode - review not posted to GitHub");
  }

  return {
    issues: result.issues,
    summary: result.summary,
    metadata: result.metadata,
    commentBody,
    posted,
  };
}
