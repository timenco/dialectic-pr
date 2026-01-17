# Smart Filter

## Purpose

Intelligent file prioritization system that manages token budgets by ranking files based on their importance and ensuring critical files are reviewed first.

## Location

→ [`src/core/smart-filter.ts`](../../src/core/smart-filter.ts)

## Dependencies

```yaml
internal:
  - core/types → ChangedFile, PrioritizedFile, FilePriority, PriorityRule
  - utils/metrics-calculator → Token estimation
```

## Core Responsibility

Maximize review quality within token constraints:
1. Assign priority levels to files based on patterns
2. Sort files by priority (critical → high → normal → low)
3. Truncate file list to fit token budget
4. Report which files were excluded
5. Support custom priority rules

## Key Interface

```typescript
class SmartFilter {
  constructor(customRules?: PriorityRule[])

  prioritizeFiles(files: ChangedFile[]): PrioritizedFile[]

  truncateToTokenLimit(
    prioritizedFiles: PrioritizedFile[],
    tokenLimit: number
  ): { included: PrioritizedFile[]; excluded: PrioritizedFile[] }

  getPriorityStats(files: PrioritizedFile[]): Record<FilePriority, number>
  addCustomRules(rules: PriorityRule[]): void
}
```

## Priority Levels

### Critical
- Security modules: `**/auth/**`, `**/payments/**`, `**/billing/**`, `**/security/**`
- Core business logic: `**/core/**`
- HTTP security layer: `*.controller.ts`, `*.guard.ts`, `*.middleware.ts`

### High
- Source code in src: `src/**/*.{ts,tsx,js,jsx}`
- Business layer: `*.service.ts`, `*.repository.ts`, `*.handler.ts`
- Database schema: `*.entity.ts`

### Normal
- General code files: `*.{ts,tsx,js,jsx}`
- Utilities and helpers

### Low
- Test files: `*.test.ts`, `*.spec.ts`
- Config files: `*.json`, `*.yaml`, `*.yml`
- Documentation: `*.md`, `*.txt`

## How It Works

### 1. File Prioritization
```typescript
const rules: PriorityRule[] = [
  {
    pattern: /src\/(auth|payments)\//,
    priority: "critical",
    reason: "Security-critical module"
  },
  // ... more rules
]
```

### 2. Priority Assignment
Each file is matched against rules (first match wins):
```
src/auth/auth.service.ts → critical (Security-critical module)
src/users/users.service.ts → high (Business layer)
src/utils/helpers.ts → normal (Code file)
README.md → low (Documentation)
```

### 3. Sorting
Files sorted by priority order: `critical < high < normal < low`

### 4. Token Budget Management
```typescript
const { included, excluded } = smartFilter.truncateToTokenLimit(
  prioritizedFiles,
  tokenLimit
)
```

Includes files until token budget exhausted, warns about exclusions.

## Custom Rules

Projects can add framework-specific or custom rules:

```typescript
const nestjsRules: PriorityRule[] = [
  {
    pattern: /\.dto\.ts$/,
    priority: "high",
    reason: "Input validation DTO"
  }
]

smartFilter.addCustomRules(nestjsRules)
```

## Token Estimation

Uses simple heuristic: **1 token ≈ 4 characters**

More accurate estimation possible via tokenizer libraries if needed.

## Behavior on Token Limit

When token limit reached:
1. Include as many high-priority files as possible
2. Log excluded files with their priority and reason
3. Return both included and excluded lists
4. Console warning for visibility

Example output:
```
⚠️ Token limit reached. 12 files excluded from review:
   - tests/auth.test.ts (low: Test file)
   - README.md (low: Documentation)
   - src/utils/cache.ts (normal: Code file)
   ... and 9 more
```

## Integration with PR Analyzer

```
PR Analyzer
  ↓ (all changed files)
Smart Filter
  ↓ (prioritized files)
Truncate to Token Limit
  ↓ (included files only)
Consensus Engine
```

## Performance

- **O(n × m)** where n = files, m = rules
- Typically < 1ms for < 100 files
- No I/O operations (pure computation)

## Related Specs

- [`analyzer.spec.md`](./analyzer.spec.md) - Uses SmartFilter for prioritization
- [`strategy-selector.spec.md`](./strategy-selector.spec.md) - Provides token limits
- [`types.spec.md`](./types.spec.md) - Priority type definitions
