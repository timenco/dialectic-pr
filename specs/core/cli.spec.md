# CLI SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - all_previous_specs
external:
  - commander
```

## FILE_PATH
```
src/cli.ts
```

## COMMANDS
```yaml
init:
  description: "Initialize Dialectic PR configuration"
  args: []
  action: create .github/dialectic-pr.json and .github/workflows/dialectic-pr-review.yml

review:
  description: "Review a Pull Request"
  options:
    - "--dry-run": test mode without posting
    - "--force-review": ignore incremental
    - "--config <path>": custom config path
    - "--log-level <level>": debug|info|warn|error
  action: run full review flow

default:
  action: same as review command
```

## INIT_COMMAND
```typescript
async function initCommand(): Promise<void> {
  const githubDir = ".github";
  const workflowsDir = join(githubDir, "workflows");

  // Create directories
  if (!existsSync(githubDir)) {
    await mkdir(githubDir, { recursive: true });
  }
  if (!existsSync(workflowsDir)) {
    await mkdir(workflowsDir, { recursive: true });
  }

  // Create dialectic-pr.json
  const configPath = join(githubDir, "dialectic-pr.json");
  const configTemplate = {
    "$schema": "https://unpkg.com/@dialectic-pr/core/config/dialectic-pr-schema.json",
    "model": "claude-sonnet-4-20250514",
    "exclude_patterns": [],
    "false_positive_patterns": [],
    "framework_specific": {}
  };
  await writeFile(configPath, JSON.stringify(configTemplate, null, 2), "utf-8");

  // Create workflow.yml
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

  console.log(`
✅ Dialectic PR 설정 완료!

생성된 파일:
  - .github/dialectic-pr.json
  - .github/workflows/dialectic-pr-review.yml

다음 단계:
  1. GitHub Secrets에 ANTHROPIC_API_KEY 추가
  2. PR을 열어 첫 리뷰 받기

문서: https://github.com/dialectic-pr/dialectic-pr#readme
  `);
}
```

## REVIEW_COMMAND
```typescript
async function reviewCommand(
  options: CLIOptions,
  dryRun: boolean,
  forceReview: boolean
): Promise<void> {
  logger.section("Dialectic PR Review");

  // 1. Privacy Guard
  const privacyGuard = new PrivacyGuard();
  privacyGuard.displayDisclaimer();
  privacyGuard.validateEnvironment(["ANTHROPIC_API_KEY", "GITHUB_TOKEN"]);

  // 2. Load config
  const configLoader = new ConfigLoader();
  const repoPath = process.cwd();
  const config = await configLoader.load(repoPath, options.configPath);

  // 3. Initialize adapters
  const claudeAdapter = new ClaudeAdapter(options.anthropicApiKey, config.model);
  const githubAdapter = new GitHubAdapter(options.githubToken);

  // 4. Initialize core components
  const excludeFilter = new ExcludeFilter(config.exclude_patterns);
  const smartFilter = new SmartFilter();
  const frameworkDetector = new FrameworkDetector();
  const prAnalyzer = new PRAnalyzer(
    excludeFilter,
    smartFilter,
    frameworkDetector
  );
  const strategySelector = new StrategySelector();

  // 5. Fetch PR data
  const prInfo = {
    owner: options.owner,
    repo: options.repo,
    pullNumber: options.pullNumber,
    baseBranch: options.baseBranch,
    headBranch: ""
  };

  logger.info("📥 Fetching PR data...");
  const diff = await githubAdapter.getPRDiff(prInfo);
  const prFiles = await githubAdapter.getPRFiles(prInfo);

  // 6. Validate secrets
  privacyGuard.validateNoSecrets(diff);

  // 7. Convert files
  const changedFiles: ChangedFile[] = prFiles.map(f => ({
    path: f.filename,
    content: f.patch || "",
    additions: f.additions,
    deletions: f.deletions
  }));

  // 8. Analyze PR
  const analysis = await prAnalyzer.analyze(
    diff,
    changedFiles,
    prInfo,
    repoPath
  );

  // 9. Select strategy
  const strategy = strategySelector.select(analysis);

  if (strategy.name === "skip") {
    logger.warn("⚠️ PR too large for review");
    await githubAdapter.postComment(
      prInfo,
      `## 🤖 Dialectic PR Review\n\n⚠️ PR too large (${(analysis.metrics.diffSize / 1024).toFixed(1)} KB). Please split into smaller PRs.`
    );
    return;
  }

  // 10. Load conventions
  let conventions = "";
  if (config.conventions?.paths) {
    conventions = await configLoader.loadConventions(
      repoPath,
      config.conventions.paths
    );
  }

  // 11. Generate review
  const consensusEngine = new ConsensusEngine(claudeAdapter, conventions);
  const result = await consensusEngine.generateReview(
    analysis,
    strategy,
    config.false_positive_patterns
  );

  // 12. Post to GitHub
  logger.section("Review Results");
  logger.info(`Total Issues: ${result.summary.totalIssues}`);
  logger.info(`Critical Issues: ${result.summary.criticalIssues}`);
  logger.info(`Assessment: ${result.summary.overallAssessment}`);

  if (!dryRun) {
    const reviewBody = formatReviewBody(result, analysis);
    await githubAdapter.postComment(prInfo, reviewBody);
    logger.success("✅ Review posted to GitHub");
  } else {
    logger.info("🧪 Dry run - review not posted");
  }
}
```

## ENVIRONMENT_VARIABLES
```yaml
required:
  - ANTHROPIC_API_KEY
  - GITHUB_TOKEN

optional:
  - GITHUB_REPOSITORY: owner/repo
  - GITHUB_EVENT_PULL_REQUEST_NUMBER: PR number
  - GITHUB_BASE_REF: base branch
```

## EXIT_CODES
```yaml
0: success
1: failure (validation, API, or runtime error)
```

## TEST_SCENARIOS
```yaml
test_init_command:
  action: run init
  assert:
    - .github/dialectic-pr.json created
    - .github/workflows/dialectic-pr-review.yml created

test_review_end_to_end:
  action: run review with valid environment
  assert:
    - exit code 0
    - GitHub comment posted
    - contains "🤖 Dialectic PR Review"

test_missing_api_key:
  action: run review without ANTHROPIC_API_KEY
  assert:
    - exit code 1
    - ValidationError thrown
```

