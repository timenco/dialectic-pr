# CONFIG LOADER SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - core/types.spec.md
external:
  - fs/promises
```

## FILE_PATH
```
src/utils/config-loader.ts
```

## CLASS_INTERFACE
```typescript
export class ConfigLoader {
  async load(repoPath: string, configPath?: string): Promise<Config>;
  async loadConventions(repoPath: string, paths: string[]): Promise<string>;
}
```

## IMPLEMENTATION
```typescript
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { Config } from "../core/types.js";
import { logger } from "./logger.js";

export class ConfigLoader {
  private readonly defaultConfig: Config = {
    model: "claude-sonnet-4-20250514",
    exclude_patterns: [],
    false_positive_patterns: []
  };

  async load(repoPath: string, configPath?: string): Promise<Config> {
    const path = configPath || join(repoPath, ".github/dialectic-pr.json");
    
    if (!existsSync(path)) {
      logger.info("No config file found, using defaults");
      return this.defaultConfig;
    }
    
    try {
      const content = await readFile(path, "utf-8");
      const userConfig = JSON.parse(content);
      
      return {
        ...this.defaultConfig,
        ...userConfig,
        exclude_patterns: [
          ...this.defaultConfig.exclude_patterns,
          ...(userConfig.exclude_patterns || [])
        ],
        false_positive_patterns: [
          ...this.defaultConfig.false_positive_patterns,
          ...(userConfig.false_positive_patterns || [])
        ]
      };
    } catch (error) {
      logger.error(`Failed to load config: ${error}`);
      return this.defaultConfig;
    }
  }

  async loadConventions(repoPath: string, paths: string[]): Promise<string> {
    const conventions: string[] = [];
    
    for (const path of paths) {
      const fullPath = join(repoPath, path);
      
      if (existsSync(fullPath)) {
        try {
          const content = await readFile(fullPath, "utf-8");
          conventions.push(`# From ${path}\n${content}`);
        } catch (error) {
          logger.warn(`Failed to load convention file ${path}: ${error}`);
        }
      }
    }
    
    return conventions.join("\n\n");
  }
}
```

## DEFAULT_CONFIG
```json
{
  "model": "claude-sonnet-4-20250514",
  "exclude_patterns": [],
  "false_positive_patterns": []
}
```

## TEST_CASES
```yaml
test_no_config_file:
  assert: returns defaultConfig

test_valid_config:
  input: valid dialectic-pr.json
  assert: merged with defaults

test_conventions_loaded:
  input: ["CLAUDE.md"]
  assert: file content returned
```

