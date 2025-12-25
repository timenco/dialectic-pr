# METRICS CALCULATOR SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - core/types.spec.md
external: []
```

## FILE_PATH
```
src/utils/metrics-calculator.ts
```

## CLASS_INTERFACE
```typescript
export class MetricsCalculator {
  calculate(diff: string, files: string[]): PRMetrics;
  estimateTokens(content: string): number;
}
```

## IMPLEMENTATION
```typescript
import { PRMetrics } from "../core/types.js";

export class MetricsCalculator {
  calculate(diff: string, files: string[]): PRMetrics {
    const lines = diff.split("\n");
    
    let addedLines = 0;
    let deletedLines = 0;
    
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        addedLines++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletedLines++;
      }
    }
    
    const coreFileCount = files.filter(f => 
      f.match(/src\/(auth|payments|billing|security|core)\//)
    ).length;
    
    const tsFileCount = files.filter(f => f.endsWith(".ts") || f.endsWith(".tsx")).length;
    const jsFileCount = files.filter(f => f.endsWith(".js") || f.endsWith(".jsx")).length;
    
    return {
      fileCount: files.length,
      addedLines,
      deletedLines,
      diffSize: Buffer.byteLength(diff, "utf8"),
      coreFileCount,
      tsFileCount,
      jsFileCount
    };
  }
  
  estimateTokens(content: string): number {
    // Approximation: 4 chars ≈ 1 token
    return Math.ceil(content.length / 4);
  }
}
```

## TEST_CASES
```yaml
test_empty_diff:
  input: ""
  output:
    fileCount: 0
    addedLines: 0
    deletedLines: 0
    diffSize: 0

test_simple_addition:
  input: "+console.log('hello');"
  output:
    addedLines: 1
    deletedLines: 0

test_token_estimation:
  input: "1234" # 4 chars
  output: 1 # 1 token
```

