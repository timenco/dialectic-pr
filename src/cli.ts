#!/usr/bin/env node

import { Command } from "commander";
import { existsSync, readFileSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { logger } from "./utils/logger.js";
import { runReview } from "./core/review-engine.js";
import { ReviewOptions, ValidationError } from "./core/types.js";

const program = new Command();

program
  .name("dialectic-pr")
  .description("The AI Code Reviewer for TypeScript Projects")
  .version("1.0.0");

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
  - .github/review-guardrails.json (FP 패턴 설정)
  - .github/workflows/dialectic-pr-review.yml (워크플로우)

다음 단계:
  1. GitHub Secrets에 ANTHROPIC_API_KEY 추가
  2. PR을 열어 첫 리뷰 받기
  3. (선택) CLAUDE.md에 프로젝트 컨텍스트 작성

문서: https://github.com/timenco/dialectic-pr#readme
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
      logger.setLogLevel(options.logLevel);

      const reviewOptions = loadOptionsFromEnv(options);
      await runReview(reviewOptions);

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
  const reviewOptions = loadOptionsFromEnv({});
  await runReview(reviewOptions);
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
  "$schema": "https://raw.githubusercontent.com/timenco/dialectic-pr/main/config/dialectic-pr-schema.json",
  "model": "claude-sonnet-4-20250514",
  "exclude_patterns": []
}
`;

  await writeFile(configPath, configTemplate, "utf-8");
  logger.success(`Created ${configPath}`);

  // 1b. review-guardrails.json 스텁 생성
  const guardrailsPath = join(githubDir, "review-guardrails.json");
  if (!existsSync(guardrailsPath)) {
    const guardrailsTemplate = `{
  "patterns": [],
  "disabled_patterns": []
}
`;
    await writeFile(guardrailsPath, guardrailsTemplate, "utf-8");
    logger.success(`Created ${guardrailsPath}`);
  }

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
        uses: timenco/dialectic-pr@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
`;

  await writeFile(workflowPath, workflowTemplate, "utf-8");
  logger.success(`Created ${workflowPath}`);
}

/**
 * 환경변수에서 CLI 옵션 로드
 */
function loadOptionsFromEnv(cmdOptions: Record<string, any>): ReviewOptions {
  const getEnvOrThrow = (key: string): string => {
    const value = process.env[key];
    if (!value) {
      throw new ValidationError(`Required environment variable missing: ${key}`);
    }
    return value;
  };

  // PR 번호: GITHUB_EVENT_PATH에서 읽기
  let pullNumber = 0;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    try {
      const event = JSON.parse(readFileSync(eventPath, "utf-8"));
      pullNumber = event.pull_request?.number || 0;
    } catch {
      // ignore parse errors
    }
  }

  return {
    anthropicApiKey: getEnvOrThrow("ANTHROPIC_API_KEY"),
    githubToken: getEnvOrThrow("GITHUB_TOKEN"),
    owner: process.env.GITHUB_REPOSITORY?.split("/")[0] || "",
    repo: process.env.GITHUB_REPOSITORY?.split("/")[1] || "",
    pullNumber,
    baseBranch: process.env.GITHUB_BASE_REF || "main",
    configPath: cmdOptions.config,
    dryRun: cmdOptions.dryRun || false,
    forceReview: cmdOptions.forceReview || false,
    logLevel: cmdOptions.logLevel,
  };
}
