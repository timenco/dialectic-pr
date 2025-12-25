# DIALECTIC-PR SYSTEM OVERVIEW

## METADATA
```yaml
project: dialectic-pr
version: 1.0.0
target_language: typescript
runtime: node >= 18
package_manager: npm
deployment: npm_package + github_actions
```

## ARCHITECTURE_GRAPH
```
GitHub Actions Workflow
  → CLI Entry (cli.ts)
    → Security Layer (privacy-guard.ts, exclude-filter.ts)
      → PR Analyzer (analyzer.ts)
        → Framework Detector (detector.ts)
        → Smart Filter (smart-filter.ts)
          → Strategy Selector (strategy-selector.ts)
            → Consensus Engine (consensus-engine.ts)
              → Claude API Adapter (claude-api.ts)
                → Anthropic API
              → Prompt Builder
            → Review Formatter
          → GitHub API Adapter (github-api.ts)
            → GitHub PR API
```

## SYSTEM_CONSTRAINTS
```yaml
input_size_limits:
  max_pr_size: 800KB
  max_files: unlimited
  token_strategies:
    small: 16000
    medium: 12000
    large: 8000
    xlarge: 4000

output_requirements:
  format: json
  max_issues: unlimited
  confidence_threshold: medium

api_constraints:
  claude:
    model: claude-sonnet-4-20250514
    rate_limit: anthropic_default
    retry_policy: exponential_backoff
  github:
    rate_limit: 5000_per_hour
    batch_review: true
```

## CORE_OBJECTIVES
```yaml
false_positive_reduction: 80%
roi_focus: true
framework_aware: [nestjs, nextjs, react, express, vanilla]
typescript_specialized: true
consensus_review: single_api_call_multi_persona
```

## FILE_STRUCTURE
```
src/
  cli.ts                       # entry_point
  index.ts                     # npm_exports
  core/
    types.ts                   # dependency: none
    analyzer.ts                # dependency: types, security, frameworks, smart-filter
    smart-filter.ts            # dependency: types
    strategy-selector.ts       # dependency: types
    consensus-engine.ts        # dependency: types, adapters/claude-api
  security/
    privacy-guard.ts           # dependency: types
    exclude-filter.ts          # dependency: types
  frameworks/
    detector.ts                # dependency: types
  adapters/
    claude-api.ts              # dependency: types, retry-handler
    github-api.ts              # dependency: types
    retry-handler.ts           # dependency: types
  utils/
    logger.ts                  # dependency: none
    config-loader.ts           # dependency: types
    metrics-calculator.ts      # dependency: types
```

## IMPLEMENTATION_ORDER
```yaml
phase_1_core:
  - specs/core/types.spec.md
  - specs/utils/logger.spec.md
  - specs/security/privacy-guard.spec.md
  - specs/security/exclude-filter.spec.md
  - specs/adapters/retry-handler.spec.md
  - specs/adapters/claude-api.spec.md
  - specs/adapters/github-api.spec.md
  - specs/utils/metrics-calculator.spec.md
  - specs/core/smart-filter.spec.md
  - specs/core/strategy-selector.spec.md
  - specs/frameworks/detector.spec.md
  - specs/core/analyzer.spec.md
  - specs/prompts/consensus-prompt.spec.md
  - specs/core/consensus-engine.spec.md
  - specs/utils/config-loader.spec.md
  - specs/core/cli.spec.md

phase_2_frameworks:
  - specs/frameworks/nestjs.spec.md
  - specs/frameworks/nextjs.spec.md
  - specs/frameworks/react.spec.md
  - specs/frameworks/express.spec.md

phase_3_false_positive:
  - specs/false-positive/builtin-patterns.spec.md
  - specs/false-positive/pattern-matcher.spec.md
  - specs/false-positive/project-rules.spec.md
```

## SUCCESS_CRITERIA
```yaml
technical:
  false_positive_rate: <10%
  avg_review_time_small_pr: <30s
  api_retry_success_rate: >95%
  test_coverage: >80%

functional:
  setup_time: <5min
  first_review_time: <10min
  json_parse_success_rate: 100%
```

