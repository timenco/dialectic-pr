# PHASE 1 INTEGRATION CHECKLIST

## OVERVIEW
```yaml
phase: 1_core_engine
goal: end_to_end_pr_review_working
entry_point: src/cli.ts
exit_point: github_pr_comment_posted
```

## MODULE_DEPENDENCY_GRAPH
```
types.ts (no deps)
  ↓
logger.ts (no deps)
  ↓
├─ privacy-guard.ts
├─ exclude-filter.ts
├─ metrics-calculator.ts
└─ retry-handler.ts
     ↓
   claude-api.ts
     ↓
   github-api.ts
     ↓
├─ smart-filter.ts
├─ strategy-selector.ts
├─ detector.ts
└─ config-loader.ts
     ↓
   analyzer.ts
     ↓
   consensus-engine.ts
     ↓
   cli.ts
```

## IMPLEMENTATION_ORDER
```yaml
step_1_foundation:
  - specs/core/types.spec.md
    output: src/core/types.ts
    test: types compile without errors
  
  - specs/utils/logger.spec.md
    output: src/utils/logger.ts
    test: log messages appear correctly

step_2_security:
  - specs/security/privacy-guard.spec.md
    output: src/security/privacy-guard.ts
    test: disclaimer displays, secrets detected
  
  - specs/security/exclude-filter.spec.md
    output: src/security/exclude-filter.ts
    test: sensitive files excluded

step_3_adapters:
  - specs/adapters/retry-handler.spec.md
    output: src/adapters/retry-handler.ts
    test: exponential backoff works
  
  - specs/adapters/claude-api.spec.md
    output: src/adapters/claude-api.ts
    test: API call with caching succeeds
  
  - specs/adapters/github-api.spec.md
    output: src/adapters/github-api.ts
    test: PR diff fetched, comment posted

step_4_core_logic:
  - specs/utils/metrics-calculator.spec.md
    output: src/utils/metrics-calculator.ts
    test: metrics calculated correctly
  
  - specs/core/smart-filter.spec.md
    output: src/core/smart-filter.ts
    test: files prioritized by rules
  
  - specs/core/strategy-selector.spec.md
    output: src/core/strategy-selector.ts
    test: correct strategy selected by size
  
  - specs/frameworks/detector.spec.md
    output: src/frameworks/detector.ts
    test: nestjs/nextjs/react detected

step_5_analysis:
  - specs/core/analyzer.spec.md
    output: src/core/analyzer.ts
    test: PR analyzed with all metrics
  
  - specs/utils/config-loader.spec.md
    output: src/utils/config-loader.ts
    test: config and conventions loaded

step_6_review_engine:
  - specs/prompts/consensus-prompt.spec.md
    note: this is logic in consensus-engine
  
  - specs/core/consensus-engine.spec.md
    output: src/core/consensus-engine.ts
    test: review generated with JSON output

step_7_cli:
  - specs/core/cli.spec.md
    output: src/cli.ts
    test: end-to-end flow completes

step_8_entry_point:
  - specs/core/index.spec.md
    output: src/index.ts
    test: npm package exports work
```

## END_TO_END_TEST_SCENARIO
```yaml
test_name: complete_review_flow
prerequisites:
  - ANTHROPIC_API_KEY set
  - GITHUB_TOKEN set
  - test repository accessible

steps:
  1_setup:
    - create test PR in repository
    - PR has 3 TypeScript files changed
    - PR includes intentional security issue
  
  2_execute:
    - run: npx ts-node src/cli.ts
    - environment:
        ANTHROPIC_API_KEY: $API_KEY
        GITHUB_TOKEN: $GITHUB_TOKEN
        GITHUB_REPOSITORY: owner/repo
        GITHUB_EVENT_PULL_REQUEST_NUMBER: 123
  
  3_verify:
    - CLI exits with code 0
    - GitHub PR has new comment
    - comment contains "🤖 Dialectic PR Review"
    - comment lists security issue found
    - comment has framework badge (NestJS/Next.js/React)
    - comment has token usage stats
  
  4_performance:
    - total_duration: <30s for small PR
    - API_calls: 1 (to Claude)
    - cost: <$0.10 (or <$0.01 if cached)
```

## INTEGRATION_VALIDATION
```yaml
validation_1_data_flow:
  - GitHub API → PR diff → Analyzer
  - Analyzer → SmartFilter → prioritized files
  - SmartFilter → StrategySelector → strategy
  - Analyzer + Strategy → ConsensusEngine
  - ConsensusEngine → Claude API → ReviewResult
  - ReviewResult → GitHub API → PR comment

validation_2_error_handling:
  - missing API keys → ValidationError
  - Claude API 429 → retry 3 times
  - GitHub API failure → logged error
  - secrets in diff → aborted review

validation_3_optimization:
  - prompt caching enabled: true
  - cache hit on 2nd PR: >90%
  - JSON parse success: 100%
  - false positive rate: <10%
```

## SUCCESS_CRITERIA
```yaml
functional:
  - [ ] init command creates config files
  - [ ] review command completes end-to-end
  - [ ] GitHub PR comment posted successfully
  - [ ] security issues detected
  - [ ] false positives filtered

technical:
  - [ ] prompt caching working
  - [ ] JSON schema mode working
  - [ ] extended thinking enabled
  - [ ] all TypeScript compiles
  - [ ] no runtime errors

performance:
  - [ ] small PR review <30s
  - [ ] cost with cache <$0.01
  - [ ] JSON parse 100% success

quality:
  - [ ] false positive rate <10%
  - [ ] actionable issues only
  - [ ] framework detected correctly
```

## COMPLETION_DEFINITION
```
Phase 1 is complete when:
1. All modules in step_1 through step_8 implemented
2. End-to-end test passes
3. All success criteria checked
4. Ready for Phase 2 (Framework specialization)
```

## ROLLOUT_PLAN
```yaml
day_1:
  - implement types, logger
  - implement security layer
  
day_2:
  - implement adapters (retry, claude, github)
  - test Claude API integration
  
day_3:
  - implement core logic (metrics, filter, strategy, detector)
  - implement analyzer
  
day_4:
  - implement consensus engine with optimizations
  - implement config loader
  
day_5:
  - implement CLI
  - end-to-end testing
  - bug fixes
```

