import * as core from "@actions/core";
import * as github from "@actions/github";
import { runReview } from "./core/review-engine.js";
import { logger } from "./utils/logger.js";

async function run(): Promise<void> {
  try {
    const anthropicApiKey = core.getInput("anthropic_api_key", { required: true });
    const githubToken = core.getInput("github_token", { required: true });

    // GitHub Actions maps `with:` inputs to INPUT_* env vars, but
    // review-engine validates process.env directly. Bridge the gap.
    process.env.ANTHROPIC_API_KEY = anthropicApiKey;
    process.env.GITHUB_TOKEN = githubToken;
    const configPath = core.getInput("config_path") || undefined;
    const logLevel = (core.getInput("log_level") || "info") as
      | "debug"
      | "info"
      | "warn"
      | "error";
    const dryRun = core.getInput("dry_run") === "true";

    logger.setLogLevel(logLevel);

    const ctx = github.context;
    const pr = ctx.payload.pull_request;

    if (!pr) {
      core.info("Not a pull_request event. Skipping.");
      return;
    }
    if (pr.draft) {
      core.info("Draft PR. Skipping.");
      return;
    }
    if (
      (pr.labels || []).some(
        (l: { name: string }) => l.name === "skip-ai-review"
      )
    ) {
      core.info("skip-ai-review label found. Skipping.");
      return;
    }

    const result = await runReview({
      anthropicApiKey,
      githubToken,
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
      pullNumber: pr.number,
      baseBranch: pr.base.ref,
      configPath,
      dryRun,
      logLevel,
    });

    core.setOutput("issues_count", String(result.summary.totalIssues));
    core.setOutput("critical_count", String(result.summary.criticalIssues));
    core.setOutput("review_posted", String(result.posted));
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
