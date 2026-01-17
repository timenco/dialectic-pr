# CLI

## Purpose

Command-line interface and entry point for Dialectic PR, providing `init` and review commands for GitHub Actions integration.

## Location

→ [`src/cli.ts`](../../src/cli.ts)

## Dependencies

```yaml
internal:
  - All core, adapter, security, framework, and utility modules
external:
  - commander (CLI framework)
```

## Core Responsibility

Provide CLI interface with:
1. **init** command - Create config and workflow files
2. **review** command (default) - Execute PR review
3. Environment variable parsing
4. Error handling and exit codes
5. User-friendly output

## Commands

### `dialectic-pr init`
Initialize project configuration:
```bash
npx @dialectic-pr/core init
```

Actions:
1. Create `.github/` directory if needed
2. Generate `.github/dialectic-pr.json` with template
3. Create `.github/workflows/dialectic-pr-review.yml`
4. Print setup instructions

Output:
```
✅ Dialectic PR setup complete!

Created files:
  - .github/dialectic-pr.json
  - .github/workflows/dialectic-pr-review.yml

Next steps:
  1. Add ANTHROPIC_API_KEY to GitHub Secrets
  2. Open a PR to get your first review

Docs: https://github.com/dialectic-pr/dialectic-pr#readme
```

### `dialectic-pr` (default) or `dialectic-pr review`
Execute PR review:
```bash
npx @dialectic-pr/core [options]
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
- `GITHUB_REF` - PR reference
- `GITHUB_EVENT_PATH` - Event payload path

## Review Flow

```
1. Parse CLI options and env vars
2. Load configuration (.github/dialectic-pr.json)
3. Display privacy disclaimer (PrivacyGuard)
4. Fetch PR diff and files (GitHubAdapter)
5. Analyze PR (PRAnalyzer)
6. Select strategy (StrategySelector)
7. Load FP patterns and conventions
8. Generate review (ConsensusEngine)
9. Post review to GitHub (GitHubAdapter)
10. Exit with code 0 (success) or 1 (failure)
```

## Exit Codes

- `0` - Success
- `1` - Error (API failure, invalid config, etc.)
- Logs errors to stderr before exit

## Privacy Disclaimer

Displayed on every review:
```
╔════════════════════════════════════════════════════════════════════╗
║  ⚠️  DATA PRIVACY NOTICE                                           ║
║                                                                    ║
║  Your code diff will be sent to Anthropic's Claude API for        ║
║  analysis. By continuing, you acknowledge this data transfer.     ║
║                                                                    ║
║  To exclude sensitive files, configure 'exclude_patterns' in      ║
║  your .github/dialectic-pr.json                                   ║
║                                                                    ║
║  Docs: https://github.com/dialectic-pr/dialectic-pr#privacy       ║
╚════════════════════════════════════════════════════════════════════╝
```

## Error Handling

Graceful error handling with user-friendly messages:
- Missing API keys → "ANTHROPIC_API_KEY not found"
- Invalid config → Show JSON validation error
- API failures → Retry with exponential backoff
- Network errors → Clear error message
- GitHub API rate limit → Wait and retry

## Configuration Loading

Priority order:
1. CLI flag: `--config path/to/config.json`
2. Default: `.github/dialectic-pr.json`
3. Fallback: Built-in defaults

## Usage in GitHub Actions

```yaml
steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0

  - name: Dialectic PR Review
    run: npx @dialectic-pr/core
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Related Specs

- [`config-loader.spec.md`](../utils/config-loader.spec.md) - Configuration loading
- [`privacy-guard.spec.md`](../security/privacy-guard.spec.md) - Privacy disclaimer
- [`github-api.spec.md`](../adapters/github-api.spec.md) - GitHub integration
