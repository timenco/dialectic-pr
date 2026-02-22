# Module Exports

## Purpose

Main entry point for Dialectic PR, exporting all public APIs for internal module usage.

## Location

→ [`src/index.ts`](../../src/index.ts)

## Exported Modules

### Core Types
```typescript
export * from "./core/types.js"
```
All TypeScript interfaces and types for the system.

### Core Components
```typescript
export { PRAnalyzer } from "./core/analyzer.js"
export { SmartFilter } from "./core/smart-filter.js"
export { StrategySelector } from "./core/strategy-selector.js"
export { ConsensusEngine } from "./core/consensus-engine.js"
export { runReview } from "./core/review-engine.js"
```

### Adapters
```typescript
export { ClaudeAdapter } from "./adapters/claude-api.js"
export { GitHubAdapter } from "./adapters/github-api.js"
export { RetryHandler } from "./adapters/retry-handler.js"
```

### Security
```typescript
export { PrivacyGuard } from "./security/privacy-guard.js"
export { ExcludeFilter } from "./security/exclude-filter.js"
```

### Frameworks
```typescript
export { FrameworkDetector } from "./frameworks/detector.js"
```

### Utilities
```typescript
export { logger } from "./utils/logger.js"
export { ConfigLoader } from "./utils/config-loader.js"
export { MetricsCalculator } from "./utils/metrics-calculator.js"
```

## Key Dependencies
- `@anthropic-ai/sdk` - Claude API client
- `@octokit/rest` - GitHub API client
- `@actions/core` - GitHub Action runtime
- `@actions/github` - GitHub Action context
- `minimatch` - File pattern matching

## Engine Requirements

- Node.js >= 18
- TypeScript 5.3+

## Related Files

- CLI implementation: [`cli.spec.md`](./cli.spec.md)
- Type definitions: [`types.spec.md`](./types.spec.md)
