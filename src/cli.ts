#!/usr/bin/env node

import { Command } from "commander";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { logger } from "./utils/logger.js";
import { PrivacyGuard } from "./security/privacy-guard.js";
import { ExcludeFilter } from "./security/exclude-filter.js";
import { SmartFilter } from "./core/smart-filter.js";
import { PRAnalyzer } from "./core/analyzer.js";
import { StrategySelector } from "./core/strategy-selector.js";
import { ConsensusEngine } from "./core/consensus-engine.js";
import { ClaudeAdapter } from "./adapters/claude-api.js";
import { GitHubAdapter } from "./adapters/github-api.js";
import { FrameworkDetector } from "./frameworks/detector.js";
import { ConfigLoader } from "./utils/config-loader.js";
import { CLIOptions, ChangedFile, ValidationError } from "./core/types.js";

const program = new Command();

program
  .name("dialectic-pr")
  .description("The AI Code Reviewer for TypeScript Projects")
  .version("0.1.0");

/**
 * init 명령어: 초기 설정 파일 생성
 */
program
  .command("init")
  .description("Initialize Dialectic PR configuration")
  .action(async () => {
    try {
      logger.section("Dialectic PR Initialization");

      await initCommand();

      logger.success("\n✅ Dialectic PR 설정 완료!");
      console.log(`
생성된 파일:
  - .github/dialectic-pr.json (설정 파일)
  - .github/workflows/dialectic-pr-review.yml (워크플로우)

다음 단계:
  1. GitHub Secrets에 ANTHROPIC_API_KEY 추가
  2. PR을 열어 첫 리뷰 받기

문서: https://github.com/dialectic-pr/dialectic-pr#readme
      `);

      process.exit(0);
    } catch (error) {
      logger.error(`Initialization failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * review 명령어 (기본): PR 리뷰 실행
 */
program
  .command("review")
  .description("Review a Pull Request")
  .option("--dry-run", "Test mode without posting to GitHub")
  .option("--force-review", "Force full review (ignore incremental)")
  .option("--config <path>", "Custom config file path")
  .option("--log-level <level>", "Log level (debug|info|warn|error)", "info")
  .action(async (options) => {
    try {
      // 로그 레벨 설정
      logger.setLogLevel(options.logLevel);

      // 환경변수에서 옵션 로드
      const cliOptions = loadOptionsFromEnv(options);

      await reviewCommand(cliOptions, options.dryRun, options.forceReview);

      process.exit(0);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`❌ Validation Error: ${error.message}`);
      } else {
        logger.error(`❌ Review failed: ${error}`);
      }
      process.exit(1);
    }
  });

// 기본 명령어는 review
program.action(async () => {
  const cliOptions = loadOptionsFromEnv({});
  await reviewCommand(cliOptions, false, false);
});

program.parse();

/**
 * init 명령어 구현
 */
async function initCommand(): Promise<void> {
  const githubDir = ".github";
  const workflowsDir = join(githubDir, "workflows");

  // .github 디렉토리 생성
  if (!existsSync(githubDir)) {
    await mkdir(githubDir, { recursive: true });
    logger.info("Created .github directory");
  }

  // .github/workflows 디렉토리 생성
  if (!existsSync(workflowsDir)) {
    await mkdir(workflowsDir, { recursive: true });
    logger.info("Created .github/workflows directory");
  }

  // 1. dialectic-pr.json 생성
  const configPath = join(githubDir, "dialectic-pr.json");
  const configTemplate = `{
  "$schema": "https://unpkg.com/@dialectic-pr/core/config/dialectic-pr-schema.json",
  "model": "claude-sonnet-4-20250514",
  "exclude_patterns": [],
  "false_positive_patterns": [],
  "framework_specific": {}
}
`;

  await writeFile(configPath, configTemplate, "utf-8");
  logger.success(`Created ${configPath}`);

  // 2. workflow.yml 생성
  const workflowPath = join(workflowsDir, "dialectic-pr-review.yml");
  const workflowTemplate = `name: Dialectic PR Review

on:
  pull_request:
    types: [opened, synchronize, labeled]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    if: |
      github.event.pull_request.draft == false &&
      !contains(github.event.pull_request.labels.*.name, 'skip-ai-review')

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Dialectic PR Review
        run: npx @dialectic-pr/core@latest
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

  await writeFile(workflowPath, workflowTemplate, "utf-8");
  logger.success(`Created ${workflowPath}`);
}

/**
 * review 명령어 구현
 */
async function reviewCommand(
  options: CLIOptions,
  dryRun: boolean,
  forceReview: boolean
): Promise<void> {
  logger.section("Dialectic PR Review");

  // 1. Privacy Guard 초기화 및 경고 표시
  const privacyGuard = new PrivacyGuard();
  privacyGuard.displayDisclaimer();

  // 2. 필수 환경변수 검증
  privacyGuard.validateEnvironment(["ANTHROPIC_API_KEY", "GITHUB_TOKEN"]);

  // 3. 설정 로드
  const configLoader = new ConfigLoader();
  const repoPath = process.cwd();
  const config = await configLoader.load(repoPath, options.configPath);

  // 4. Adapters 초기화
  const claudeAdapter = new ClaudeAdapter(options.anthropicApiKey, config.model);
  const githubAdapter = new GitHubAdapter(options.githubToken);

  // 5. Core Components 초기화
  const excludeFilter = new ExcludeFilter(config.exclude_patterns);
  const smartFilter = new SmartFilter();
  const frameworkDetector = new FrameworkDetector();
  const prAnalyzer = new PRAnalyzer(
    excludeFilter,
    smartFilter,
    frameworkDetector
  );
  const strategySelector = new StrategySelector();

  // 6. PR 정보
  const prInfo = {
    owner: options.owner,
    repo: options.repo,
    pullNumber: options.pullNumber,
    baseBranch: options.baseBranch,
    headBranch: "", // TODO: fetch from GitHub API
  };

  // 7. PR Diff 및 파일 목록 가져오기
  logger.info("📥 Fetching PR data from GitHub...");
  const diff = await githubAdapter.getPRDiff(prInfo);
  const prFiles = await githubAdapter.getPRFiles(prInfo);

  // 8. 시크릿 검증
  privacyGuard.validateNoSecrets(diff);

  // 9. 파일 변환
  const changedFiles: ChangedFile[] = prFiles.map((f) => ({
    path: f.filename,
    content: f.patch || "",
    additions: f.additions,
    deletions: f.deletions,
  }));

  // 10. PR 분석
  const analysis = await prAnalyzer.analyze(
    diff,
    changedFiles,
    prInfo,
    repoPath
  );

  // 11. 전략 선택
  const strategy = strategySelector.select(analysis);

  // Skip 전략이면 중단
  if (strategy.name === "skip") {
    logger.warn("⚠️ PR is too large for meaningful review");
    await githubAdapter.postComment(
      prInfo,
      `## 🤖 Dialectic PR Review\n\n⚠️ **PR Too Large**: This PR is too large for meaningful AI review (${(analysis.metrics.diffSize / 1024).toFixed(1)} KB).\n\nPlease split this into smaller PRs for better review quality.`
    );
    return;
  }

  // 12. 컨벤션 로드
  let conventions = "";
  if (config.conventions?.paths) {
    conventions = await configLoader.loadConventions(
      repoPath,
      config.conventions.paths
    );
  }

  // 13. Consensus Engine 초기화 및 리뷰 생성
  const consensusEngine = new ConsensusEngine(claudeAdapter, conventions);
  const result = await consensusEngine.generateReview(
    analysis,
    strategy,
    config.false_positive_patterns
  );

  // 14. 리뷰 결과 출력
  logger.section("Review Results");
  logger.info(`Total Issues: ${result.summary.totalIssues}`);
  logger.info(`Critical Issues: ${result.summary.criticalIssues}`);
  logger.info(`Assessment: ${result.summary.overallAssessment}`);

  // 15. GitHub에 리뷰 포스트 (dry-run이 아닌 경우)
  if (!dryRun) {
    if (result.issues.length > 0) {
      // 코멘트 형식으로 변환
      const reviewBody = formatReviewBody(result, analysis);
      
      await githubAdapter.postComment(prInfo, reviewBody);
      
      logger.success("✅ Review posted to GitHub");
    } else {
      // 이슈가 없으면 간단한 코멘트만
      await githubAdapter.postComment(
        prInfo,
        `## 🤖 Dialectic PR Review\n\n✅ ${result.summary.overallAssessment}`
      );
      
      logger.success("✅ Review posted to GitHub (no issues found)");
    }
  } else {
    logger.info("🧪 Dry run mode - review not posted to GitHub");
  }
}

/**
 * 환경변수에서 CLI 옵션 로드
 */
function loadOptionsFromEnv(cmdOptions: Record<string, any>): CLIOptions {
  const getEnvOrThrow = (key: string): string => {
    const value = process.env[key];
    if (!value) {
      throw new ValidationError(`Required environment variable missing: ${key}`);
    }
    return value;
  };

  return {
    anthropicApiKey: getEnvOrThrow("ANTHROPIC_API_KEY"),
    githubToken: getEnvOrThrow("GITHUB_TOKEN"),
    owner: process.env.GITHUB_REPOSITORY?.split("/")[0] || "",
    repo: process.env.GITHUB_REPOSITORY?.split("/")[1] || "",
    pullNumber: parseInt(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER || "0", 10),
    baseBranch: process.env.GITHUB_BASE_REF || "main",
    configPath: cmdOptions.config,
    dryRun: cmdOptions.dryRun || false,
    forceReview: cmdOptions.forceReview || false,
  };
}

/**
 * 리뷰 결과를 GitHub 코멘트 형식으로 포맷팅
 */
function formatReviewBody(
  result: typeof ConsensusEngine.prototype.generateReview extends (...args: any[]) => Promise<infer R> ? R : never,
  analysis: typeof PRAnalyzer.prototype.analyze extends (...args: any[]) => Promise<infer R> ? R : never
): string {
  const lines: string[] = [];

  lines.push("## 🤖 Dialectic PR Review");
  lines.push("");
  lines.push(`**Framework**: ${analysis.context.framework.name} ${analysis.context.framework.version || ""}`);
  lines.push(`**Strategy**: ${result.metadata.strategy}`);
  lines.push(`**Files Reviewed**: ${result.metadata.filesReviewed}`);
  lines.push("");

  if (result.summary.affectedAreas.length > 0) {
    lines.push(`**Affected Areas**: ${result.summary.affectedAreas.join(", ")}`);
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
      lines.push(`**File**: \`${issue.file}\`${issue.line ? ` (Line ${issue.line})` : ""}`);
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
  lines.push(`- Duration: ${(result.metadata.reviewDuration / 1000).toFixed(2)}s`);
  lines.push("");
  lines.push("*Powered by [Dialectic PR](https://github.com/dialectic-pr/dialectic-pr)*");

  return lines.join("\n");
}

