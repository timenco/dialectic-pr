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
 * Extract consensus data from summary, with fallback inference from issues
 */
function extractConsensusData(result: ReviewResult): {
  verdict: string;
  mergeable: string;
  priority: string;
} {
  let verdict = result.summary.verdict || "";
  let mergeable = result.summary.mergeable !== undefined
    ? (result.summary.mergeable ? "Yes" : "No")
    : "";
  let priority = result.summary.priority || "";

  // Fallback inference if not provided by consensus
  if (!verdict) {
    const hasCritical = result.issues.some(
      (i) => i.type === "security" || i.type === "bug"
    );
    if (result.issues.length === 0) verdict = "APPROVE";
    else if (hasCritical) verdict = "REQUEST_CHANGES";
    else verdict = "COMMENT";
  }
  if (!mergeable) {
    mergeable = verdict === "REQUEST_CHANGES" ? "No" : "Yes";
  }
  if (!priority) {
    if (verdict === "REQUEST_CHANGES") priority = "high";
    else if (result.issues.length > 0) priority = "medium";
    else priority = "low";
  }

  return { verdict, mergeable, priority };
}

/**
 * Format issues as a flat list (fallback when no debateNarrative)
 */
function formatFallbackIssues(result: ReviewResult): string {
  const lines: string[] = [];

  if (result.issues.length === 0) {
    lines.push("### Review");
    lines.push("");
    lines.push(result.summary.overallAssessment);
    return lines.join("\n");
  }

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
    lines.push(`**Type**: ${issue.type} | **Confidence**: ${issue.confidence}`);
    lines.push("");
    lines.push(issue.description);

    if (issue.suggestion) {
      lines.push("");
      lines.push(`> **Suggestion**: ${issue.suggestion}`);
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format review result into a GitHub comment body
 */
function formatReviewBody(result: ReviewResult, analysis: PRAnalysis): string {
  const lines: string[] = [];
  const { verdict, mergeable, priority } = extractConsensusData(result);

  // Header
  lines.push("## 🤖 Dialectic PR Review");
  lines.push("");

  // Metrics table
  lines.push("### 📊 Review Metrics");
  lines.push("");
  lines.push("| Strategy | Files | Lines Changed | Affected Areas | Consensus | Flags |");
  lines.push("|----------|-------|---------------|----------------|-----------|-------|");

  const flagParts: string[] = [];
  if (analysis.context.flags.criticalModule) flagParts.push("🔴 Critical");
  if (analysis.context.flags.schemaChanged) flagParts.push("📐 Schema");
  if (analysis.context.flags.testChanged) flagParts.push("🧪 Tests");
  if (analysis.context.flags.configOnly) flagParts.push("⚙️ Config");
  const flags = flagParts.length > 0 ? flagParts.join(", ") : "—";

  const areas = result.summary.affectedAreas.length > 0
    ? result.summary.affectedAreas.join(", ")
    : "—";

  lines.push(
    `| ${result.metadata.strategy} | ${result.metadata.filesReviewed} | +${analysis.metrics.addedLines} / -${analysis.metrics.deletedLines} | ${areas} | ${verdict} | ${flags} |`
  );
  lines.push("");

  // Debate narrative (STEP 1, 2, 3) or fallback
  if (result.debateNarrative) {
    lines.push(result.debateNarrative);
  } else {
    lines.push(formatFallbackIssues(result));
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  // Final Verdict table
  lines.push("### 📊 Final Verdict");
  lines.push("");
  lines.push("| Verdict | Mergeable | Priority |");
  lines.push("|---------|-----------|----------|");
  lines.push(`| ${verdict} | ${mergeable} | ${priority} |`);
  lines.push("");

  // Metadata in collapsible section
  lines.push("<details>");
  lines.push("<summary>📋 Review Metadata</summary>");
  lines.push("");
  lines.push(`- **Framework**: ${analysis.context.framework.name} ${analysis.context.framework.version || ""}`);
  lines.push(`- **Tokens Used**: ${result.metadata.tokensUsed.toLocaleString()}`);
  lines.push(`- **Duration**: ${(result.metadata.reviewDuration / 1000).toFixed(2)}s`);
  lines.push(`- **Files Excluded**: ${result.metadata.filesExcluded}`);
  if (result.summary.fpRate) {
    lines.push(`- **FP Rate**: ${result.summary.fpRate}`);
  }
  lines.push("");
  lines.push("</details>");
  lines.push("");
  lines.push(
    "*Powered by [Dialectic PR Review](https://github.com/timenco/dialectic-pr)*"
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
  const commentBody = formatReviewBody(result, analysis);
  let posted = false;

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
