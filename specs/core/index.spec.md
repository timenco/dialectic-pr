# NPM Package Exports

## Purpose

Main entry point for `@dialectic-pr/core` npm package, exporting all public APIs for programmatic usage.

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

## Package Configuration

### package.json
```json
{
  "name": "@dialectic-pr/core",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "dialectic-pr": "./dist/cli.js"
  },
  "files": ["dist", "config", "templates"]
}
```

### Key Dependencies
- `@anthropic-ai/sdk` - Claude API client
- `@octokit/rest` - GitHub API client
- `commander` - CLI framework
- `minimatch` - File pattern matching

## Usage

### As CLI (Primary)
```bash
npx @dialectic-pr/core
npx @dialectic-pr/core init
```

### As Library (Advanced)
```typescript
import {
  PRAnalyzer,
  ConsensusEngine,
  ClaudeAdapter,
  type PRAnalysis,
  type ReviewResult
} from "@dialectic-pr/core"

// Build custom workflows
const analyzer = new PRAnalyzer(...)
const engine = new ConsensusEngine(...)
```

## Engine Requirements

- Node.js >= 18
- TypeScript 5.3+

## Related Files

- CLI implementation: [`cli.spec.md`](./cli.spec.md)
- Type definitions: [`types.spec.md`](./types.spec.md)
