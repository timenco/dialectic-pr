# Exclude Filter

## Purpose

Filters out files that should not be reviewed, including sensitive files, generated artifacts, binaries, and user-configured patterns using glob matching.

## Location

[src/security/exclude-filter.ts](../../src/security/exclude-filter.ts)

## Dependencies

```yaml
internal: []
external:
  - minimatch
```

## Core Responsibility

- Filter files based on default exclusion patterns
- Support custom exclusion patterns from config
- Identify sensitive files (`.env`, secrets, keys)
- Skip generated/build artifacts (lock files, dist, node_modules)
- Exclude binary files (images, minified code)
- Provide utility methods for file type classification

## Key Interface

```typescript
export class ExcludeFilter {
  constructor(customExcludes?: string[]);

  shouldExclude(filePath: string): boolean;
  filterFiles(files: string[]): string[];
  getExcludedFiles(files: string[]): string[];

  isSourceFile(filePath: string): boolean;
  isTestFile(filePath: string): boolean;
  isConfigFile(filePath: string): boolean;
}
```

## Default Exclusion Patterns

**Sensitive files:**
- `**/.env*`
- `**/secrets/**`
- `**/*.pem`, `**/*.key`

**Generated files:**
- `**/*.lock` (package-lock.json, yarn.lock, pnpm-lock.yaml)
- `**/*.min.js`, `**/*.min.css`

**Binary files:**
- `**/*.svg`, `**/*.png`, `**/*.jpg`, `**/*.ico`

**Build artifacts:**
- `**/dist/**`, `**/build/**`, `**/node_modules/**`
- `**/__pycache__/**`, `**/.next/**`, `**/.nuxt/**`

Custom patterns from config are merged with defaults.

## Related Specs

- [privacy-guard.spec.md](./privacy-guard.spec.md) - Content-level secret detection (complementary)
- [config-loader.spec.md](../utils/config-loader.spec.md) - Loads custom exclusion patterns
