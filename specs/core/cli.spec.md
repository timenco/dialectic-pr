# CLI

## Purpose

Command-line interface for local development and debugging. The primary distribution is via GitHub Action (`action.ts`), but the CLI provides `init` and `review` commands for local use.

## Location

→ [`src/cli.ts`](../../src/cli.ts)

## Dependencies

```yaml
internal:
  - core/review-engine (runReview)
  - core/types (ReviewOptions, ValidationError)
external:
  - commander (CLI framework)
```

## Core Responsibility

Provide CLI interface with:
1. **init** command - Create config and workflow files
2. **review** command (default) - Execute PR review via `runReview()`
3. Environment variable parsing (GITHUB_EVENT_PATH for PR number)
4. Error handling and exit codes

## Commands

### `dialectic-pr init`
Initialize project configuration:
```bash
node dist/cli.js init
```

Actions:
1. Create `.github/` directory if needed
2. Generate `.github/dialectic-pr.json` with template
3. Create `.github/workflows/dialectic-pr-review.yml` (uses action)
4. Print setup instructions

### `dialectic-pr review`
Execute PR review (delegates to `runReview()`):
```bash
node dist/cli.js review [options]
```

Options:
- `--dry-run` - Test mode, no GitHub posting
- `--force-review` - Ignore incremental review cache
- `--config <path>` - Custom config file path
- `--log-level <level>` - Set log level (debug|info|warn|error)

Environment Variables (required):
- `ANTHROPIC_API_KEY` - Claude API key
- `GITHUB_TOKEN` - GitHub token for PR access
- `GITHUB_REPOSITORY` - owner/repo
- `GITHUB_BASE_REF` - Base branch
- `GITHUB_EVENT_PATH` - Event payload path (for PR number extraction)

## GitHub Action Entry Point

The primary entry point for production usage is `src/action.ts`, which:
1. Reads inputs via `@actions/core`
2. Gets PR context via `@actions/github`
3. Calls `runReview()` from `review-engine.ts`
4. Sets outputs (issues_count, critical_count, review_posted)

## Usage in GitHub Actions

```yaml
steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0

  - uses: timenco/dialectic-pr@v1
    with:
      anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Related Specs

- [`config-loader.spec.md`](../utils/config-loader.spec.md) - Configuration loading
- [`privacy-guard.spec.md`](../security/privacy-guard.spec.md) - Privacy disclaimer
- [`github-api.spec.md`](../adapters/github-api.spec.md) - GitHub integration
