# PR Analyzer

## Purpose

Analyzes pull request diffs to extract metrics, detect frameworks, prioritize files, and build comprehensive context for review.

## Location

→ [`src/core/analyzer.ts`](../../src/core/analyzer.ts)

## Dependencies

```yaml
internal:
  - core/types → PRAnalysis, ChangedFile, GitHubPRInfo
  - security/exclude-filter → ExcludeFilter
  - core/smart-filter → SmartFilter
  - frameworks/detector → FrameworkDetector
  - utils/metrics-calculator → MetricsCalculator
```

## Core Responsibility

Transform raw PR data into structured analysis:
1. Detect project framework (NestJS, Next.js, React, Express, Vanilla)
2. Filter out sensitive/generated files
3. Extract relevant diff (source code only)
4. Calculate comprehensive metrics
5. Detect context flags (testChanged, schemaChanged, criticalModule, etc.)
6. Identify affected areas (Auth, Payments, etc.)
7. Prioritize files by importance
8. Generate prioritized diff within token budget

## Key Interface

```typescript
class PRAnalyzer {
  constructor(
    excludeFilter: ExcludeFilter,
    smartFilter: SmartFilter,
    frameworkDetector: FrameworkDetector
  )

  async analyze(
    diff: string,
    files: ChangedFile[],
    prInfo: GitHubPRInfo,
    repoPath: string
  ): Promise<PRAnalysis>

  detectAffectedAreas(files: string[], frameworkName: string): string[]
  isConfigOnly(files: string[]): boolean
  isCriticalModule(files: string[]): boolean
}
```

## Analysis Pipeline

```
1. Framework Detection → NestJS | Next.js | React | Express | Vanilla
2. File Filtering      → Exclude .env, node_modules, dist, etc.
3. Diff Extraction     → Extract source code changes only
4. Metrics Calculation → File counts, line counts, diff size
5. Context Detection   → testChanged, schemaChanged, apiRoutesChanged, etc.
6. Area Detection      → Auth, Payments, API Layer, Database, etc.
7. File Prioritization → critical > high > normal > low
8. Diff Truncation     → Fit within token budget
```

## Context Flags

Detected automatically from file patterns:

- `testChanged` - Test files modified
- `schemaChanged` - Database schema files modified
- `apiRoutesChanged` - API routes changed (Next.js, Express)
- `controllersChanged` - Controllers changed (NestJS)
- `criticalModule` - Auth, payments, billing modules touched
- `configOnly` - Only config files changed

## Affected Areas

Framework-specific area detection:

### NestJS
- 🔐 Auth - `**/auth/**`
- 💳 Payments - `**/payments/**`
- 🎯 HTTP Layer - `*.controller.ts`, `*.guard.ts`
- ⚙️ Business Logic - `*.service.ts`, `*.repository.ts`
- 🗄️ Database Schema - `*.entity.ts`

### Next.js
- 🔌 API Routes - `**/api/**`
- 📄 Pages - `**/app/**/page.tsx`
- 🎨 Layouts - `**/layout.tsx`
- 🧩 Components - `**/components/**`

### React
- 🪝 Hooks - Custom hooks
- 🧩 Components
- 🎨 UI Layer

### Express
- 🔌 Routes
- 🛡️ Middleware
- ⚙️ Business Logic

## Output Structure

```typescript
interface PRAnalysis {
  diff: string                    // Full diff
  relevantDiff: string            // Filtered diff (source code only)
  prioritizedDiff: string         // Truncated to token budget
  metrics: PRMetrics              // File counts, line counts, size
  context: {
    framework: DetectedFramework
    affectedAreas: string[]
    flags: ContextFlags
  }
  changedFiles: string[]
  prioritizedFiles: PrioritizedFile[]
  excludedFiles: string[]         // Filtered out files (for logging)
}
```

## Key Methods

### `analyze()`
Main orchestration method that runs the full pipeline

### `detectContextFlags()`
Analyzes file paths to determine context:
- Checks for test files
- Detects schema changes
- Identifies critical modules
- Determines if config-only

### `detectAffectedAreas()`
Framework-aware area detection based on file paths

### `isConfigOnly()`
Returns true if only config files changed (package.json, tsconfig.json, etc.)

### `isCriticalModule()`
Returns true if files touch auth, payments, billing, or security modules

## Performance Considerations

- Lazy framework detection (only once per analysis)
- Efficient regex-based file filtering
- Incremental diff building
- Token estimation for truncation

## Related Specs

- [`smart-filter.spec.md`](./smart-filter.spec.md) - File prioritization logic
- [`frameworks/detector.spec.md`](../frameworks/detector.spec.md) - Framework detection
- [`metrics-calculator.spec.md`](../utils/metrics-calculator.spec.md) - Metrics computation
