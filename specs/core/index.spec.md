# NPM PACKAGE EXPORTS SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - all_implemented_modules
external: []
```

## FILE_PATH
```
src/index.ts
```

## EXPORTS
```typescript
// Core Types
export * from "./core/types.js";

// Core Components
export { PRAnalyzer } from "./core/analyzer.js";
export { SmartFilter } from "./core/smart-filter.js";
export { StrategySelector } from "./core/strategy-selector.js";
export { ConsensusEngine } from "./core/consensus-engine.js";

// Adapters
export { ClaudeAdapter } from "./adapters/claude-api.js";
export { GitHubAdapter } from "./adapters/github-api.js";
export { RetryHandler } from "./adapters/retry-handler.js";

// Security
export { PrivacyGuard } from "./security/privacy-guard.js";
export { ExcludeFilter } from "./security/exclude-filter.js";

// Frameworks
export { FrameworkDetector } from "./frameworks/detector.js";

// Utils
export { logger } from "./utils/logger.js";
export { ConfigLoader } from "./utils/config-loader.js";
export { MetricsCalculator } from "./utils/metrics-calculator.js";
```

## PACKAGE_JSON
```json
{
  "name": "@dialectic-pr/core",
  "version": "1.0.0",
  "description": "AI Code Reviewer for TypeScript Projects",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "dialectic-pr": "./dist/cli.js"
  },
  "files": [
    "dist",
    "config",
    "templates"
  ],
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "keywords": [
    "code-review",
    "ai",
    "typescript",
    "claude",
    "github-actions"
  ],
  "author": "Dialectic PR",
  "license": "MIT",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@octokit/rest": "^20.0.0",
    "commander": "^11.0.0",
    "minimatch": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jest": "^29.0.0",
    "typescript": "^5.3.0",
    "jest": "^29.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

## TEST
```yaml
test_exports:
  action: import all exports in test file
  assert: all imports succeed without errors
```

