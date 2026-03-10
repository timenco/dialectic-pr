import {
  ReviewOptions,
  ReviewOutput,
  ChangedFile,
} from "./types.js";
import { logger } from "../utils/logger.js";
import { ConsensusEngine } from "./consensus-engine.js";
import { ConfigLoader } from "../utils/config-loader.js";
import { createReviewComponents } from "./review-factory.js";
import { formatReviewBody } from "./review-formatter.js";
import { registerAllFrameworks } from "../frameworks/index.js";

/**
 * Run a full PR review
 *
 * Shared orchestration logic used by both CLI and GitHub Action entry points.
 * Does NOT call process.exit() — callers are responsible for exit behavior.
 */
export async function runReview(options: ReviewOptions): Promise<ReviewOutput> {
  logger.section("Dialectic PR Review");

  // 0. 프레임워크 등록 보장
  registerAllFrameworks();

  // 1. Load config
  const configLoader = new ConfigLoader();
  const repoPath = process.cwd();
  const config = await configLoader.load(repoPath, options.configPath);

  // 2. Create components
  const {
    privacyGuard,
    claudeAdapter,
    githubAdapter,
    prAnalyzer,
    strategySelector,
    rulesLoader,
    frameworkService,
  } = createReviewComponents(options, config);

  // 3. Privacy Guard
  privacyGuard.displayDisclaimer();

  // 4. PR info
  const prInfo = {
    owner: options.owner,
    repo: options.repo,
    pullNumber: options.pullNumber,
    baseBranch: options.baseBranch,
  };

  // 5. Fetch PR data
  logger.info("📥 Fetching PR data from GitHub...");
  const diff = await githubAdapter.getPRDiff(prInfo);
  const prFiles = await githubAdapter.getPRFiles(prInfo);

  // 6. Secrets validation
  privacyGuard.validateNoSecrets(diff);

  // 7. File transformation
  const changedFiles: ChangedFile[] = prFiles.map((f) => ({
    path: f.filename,
    content: f.patch || "",
    additions: f.additions,
    deletions: f.deletions,
  }));

  // 8. PR analysis
  const analysis = await prAnalyzer.analyze(diff, changedFiles, repoPath);

  // 9. Strategy selection
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

  // 10. CLAUDE.md 자동 감지
  const conventions = await configLoader.loadClaudeMd(repoPath);

  // 11. guardrails.json 자동 감지
  const guardrails = await configLoader.loadGuardrails(repoPath);

  // 12. FP 패턴 조합 (builtin + framework - disabled + project)
  const basePatterns = rulesLoader.load(
    analysis.context.framework.name,
    guardrails.disabled_patterns || []
  );
  const allPatternsMap = new Map(basePatterns.map(p => [p.id, p]));
  for (const p of guardrails.patterns || []) {
    allPatternsMap.set(p.id, p); // 프로젝트 패턴이 빌트인 override
  }
  const allPatterns = Array.from(allPatternsMap.values());

  // 13. Consensus Engine — pass language + framework instructions
  const consensusEngine = new ConsensusEngine(
    claudeAdapter,
    conventions,
    config.language
  );
  const frameworkInstance = frameworkService.getFramework(analysis.context.framework.name);
  const frameworkInstructions = frameworkInstance?.getReviewInstructions();
  const result = await consensusEngine.generateReview(
    analysis,
    strategy,
    allPatterns,
    frameworkInstructions
  );

  // 14. Log results
  logger.section("Review Results");
  logger.info(`Total Issues: ${result.summary.totalIssues}`);
  logger.info(`Critical Issues: ${result.summary.criticalIssues}`);
  logger.info(`Assessment: ${result.summary.overallAssessment}`);

  // 15. Format and post
  const commentBody = formatReviewBody(result, analysis, config.model);
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
