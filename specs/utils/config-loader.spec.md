# Config Loader

## Purpose

Loads and merges user configuration from `.github/dialectic-pr.json` with sensible defaults, and loads project conventions from custom documentation files.

## Location

[src/utils/config-loader.ts](../../src/utils/config-loader.ts)

## Dependencies

```yaml
internal:
  - core/types.spec.md
external:
  - fs/promises
```

## Core Responsibility

- Load configuration from `.github/dialectic-pr.json`
- Merge user config with default values
- Provide sensible defaults when config file missing
- Load project conventions from documentation files (e.g., CLAUDE.md)
- Concatenate multiple convention files with source attribution
- Handle missing files gracefully

## Key Interface

```typescript
export class ConfigLoader {
  async load(repoPath: string, configPath?: string): Promise<Config>;
  async loadConventions(repoPath: string, paths: string[]): Promise<string>;
}

interface Config {
  model: string;
  exclude_patterns: string[];
  false_positive_patterns: FalsePositivePattern[];
}
```

## Default Configuration

```json
{
  "model": "claude-sonnet-4-20250514",
  "exclude_patterns": [],
  "false_positive_patterns": []
}
```

User-provided patterns are merged with (not replaced) defaults.

## Convention Files

Supports loading project-specific conventions from files like:
- `CLAUDE.md`
- `CONVENTIONS.md`
- `CODE_STYLE.md`

Each file's content is prefixed with `# From {filename}` for context.

## Related Specs

- [types.spec.md](../core/types.spec.md) - Config, FalsePositivePattern types
- [exclude-filter.spec.md](../security/exclude-filter.spec.md) - Uses exclude_patterns
- [consensus-engine.spec.md](../core/consensus-engine.spec.md) - Uses false_positive_patterns
