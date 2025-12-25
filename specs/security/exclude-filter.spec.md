# EXCLUDE FILTER SPECIFICATION

## DEPENDENCIES
```yaml
internal: []
external:
  - minimatch
```

## FILE_PATH
```
src/security/exclude-filter.ts
```

## CLASS_INTERFACE
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

## IMPLEMENTATION
```typescript
import { minimatch } from "minimatch";

export class ExcludeFilter {
  private readonly defaultExcludes = [
    // Sensitive files
    "**/.env*",
    "**/secrets/**",
    "**/*.pem",
    "**/*.key",
    
    // Binary/generated files
    "**/*.lock",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/*.min.js",
    "**/*.min.css",
    "**/*.svg",
    "**/*.png",
    "**/*.jpg",
    "**/*.ico",
    
    // Build artifacts
    "**/dist/**",
    "**/build/**",
    "**/node_modules/**",
    "**/__pycache__/**",
    "**/.next/**",
    "**/.nuxt/**"
  ];

  private readonly allPatterns: string[];

  constructor(customExcludes: string[] = []) {
    this.allPatterns = [...this.defaultExcludes, ...customExcludes];
  }

  shouldExclude(filePath: string): boolean {
    return this.allPatterns.some(pattern => minimatch(filePath, pattern));
  }

  filterFiles(files: string[]): string[] {
    return files.filter(f => !this.shouldExclude(f));
  }

  getExcludedFiles(files: string[]): string[] {
    return files.filter(f => this.shouldExclude(f));
  }

  isSourceFile(filePath: string): boolean {
    return /\.(ts|tsx|js|jsx)$/.test(filePath);
  }

  isTestFile(filePath: string): boolean {
    return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath);
  }

  isConfigFile(filePath: string): boolean {
    return /\.(json|yaml|yml|toml|ini|env)$/.test(filePath) ||
           /\.(config|rc)\.(ts|js)$/.test(filePath);
  }
}
```

## DEFAULT_EXCLUDES
```yaml
sensitive:
  - "**/.env*"
  - "**/secrets/**"
  - "**/*.pem"
  - "**/*.key"

generated:
  - "**/*.lock"
  - "**/*.min.js"
  - "**/*.min.css"

binary:
  - "**/*.svg"
  - "**/*.png"
  - "**/*.jpg"

build:
  - "**/dist/**"
  - "**/build/**"
  - "**/node_modules/**"
```

## TEST_CASES
```yaml
test_exclude_env:
  input: ".env.local"
  assert: shouldExclude = true

test_exclude_lock:
  input: "package-lock.json"
  assert: shouldExclude = true

test_include_source:
  input: "src/index.ts"
  assert: shouldExclude = false
```

