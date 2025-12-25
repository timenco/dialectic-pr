# PR ANALYZER SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - core/types.spec.md
  - security/exclude-filter.spec.md
  - core/smart-filter.spec.md
  - frameworks/detector.spec.md
  - utils/metrics-calculator.spec.md
  - utils/logger.spec.md
external: []
```

## FILE_PATH
```
src/core/analyzer.ts
```

## CLASS_INTERFACE
```typescript
export class PRAnalyzer {
  constructor(
    excludeFilter: ExcludeFilter,
    smartFilter: SmartFilter,
    frameworkDetector: FrameworkDetector
  );
  
  async analyze(
    diff: string,
    files: ChangedFile[],
    prInfo: GitHubPRInfo,
    repoPath: string
  ): Promise<PRAnalysis>;
  
  detectAffectedAreas(files: string[], frameworkName: string): string[];
  isConfigOnly(files: string[]): boolean;
  isCriticalModule(files: string[]): boolean;
}
```

## IMPLEMENTATION
```typescript
import {
  PRAnalysis,
  ChangedFile,
  ContextFlags,
  GitHubPRInfo
} from "./types.js";
import { ExcludeFilter } from "../security/exclude-filter.js";
import { SmartFilter } from "./smart-filter.js";
import { MetricsCalculator } from "../utils/metrics-calculator.js";
import { FrameworkDetector } from "../frameworks/detector.js";
import { logger } from "../utils/logger.js";

export class PRAnalyzer {
  private readonly metricsCalculator = new MetricsCalculator();

  constructor(
    private excludeFilter: ExcludeFilter,
    private smartFilter: SmartFilter,
    private frameworkDetector: FrameworkDetector
  ) {}

  async analyze(
    diff: string,
    files: ChangedFile[],
    prInfo: GitHubPRInfo,
    repoPath: string
  ): Promise<PRAnalysis> {
    logger.section("PR Analysis");

    // 1. Detect framework
    const framework = await this.frameworkDetector.detect(
      repoPath,
      files.map(f => f.path)
    );

    // 2. Filter files (exclude sensitive/generated files)
    const filteredFiles = files.filter(f => 
      !this.excludeFilter.shouldExclude(f.path)
    );
    logger.info(
      `📊 Files: ${files.length} total, ${filteredFiles.length} after filtering`
    );

    // 3. Extract relevant diff (source code only)
    const relevantDiff = this.extractRelevantDiff(diff, filteredFiles);

    // 4. Calculate metrics
    const metrics = this.metricsCalculator.calculate(
      relevantDiff,
      filteredFiles.map(f => f.path)
    );

    // 5. Detect context flags
    const flags = this.detectContextFlags(filteredFiles, framework.name);

    // 6. Detect affected areas
    const affectedAreas = this.detectAffectedAreas(
      filteredFiles.map(f => f.path),
      framework.name
    );

    // 7. Prioritize files
    const prioritizedFiles = this.smartFilter.prioritizeFiles(filteredFiles);

    // 8. Build prioritized diff
    const prioritizedDiff = this.buildPrioritizedDiff(prioritizedFiles);

    // 9. Get excluded files
    const excludedFiles = files
      .filter(f => this.excludeFilter.shouldExclude(f.path))
      .map(f => f.path);

    const analysis: PRAnalysis = {
      diff,
      relevantDiff,
      prioritizedDiff,
      metrics,
      context: {
        framework,
        affectedAreas,
        flags
      },
      changedFiles: filteredFiles.map(f => f.path),
      prioritizedFiles,
      excludedFiles
    };

    this.logAnalysisSummary(analysis);

    return analysis;
  }

  private extractRelevantDiff(diff: string, files: ChangedFile[]): string {
    const sourcePaths = files
      .filter(f => this.excludeFilter.isSourceFile(f.path))
      .map(f => f.path);

    const diffBlocks = diff.split(/^diff --git /m);
    const relevantBlocks: string[] = [];

    for (const block of diffBlocks) {
      if (!block.trim()) continue;

      const pathMatch = block.match(/^a\/(.+?) b\//);
      if (pathMatch) {
        const filePath = pathMatch[1];
        if (sourcePaths.includes(filePath)) {
          relevantBlocks.push(`diff --git ${block}`);
        }
      }
    }

    return relevantBlocks.join("\n");
  }

  private buildPrioritizedDiff(files: typeof this.smartFilter.prioritizeFiles extends (f: any) => infer R ? R : never): string {
    const diffBlocks: string[] = [];

    for (const file of files) {
      diffBlocks.push(`
# File: ${file.path}
# Priority: ${file.priority} (${file.reason})

${file.content}
      `.trim());
    }

    return diffBlocks.join("\n\n" + "=".repeat(80) + "\n\n");
  }

  private detectContextFlags(
    files: ChangedFile[],
    frameworkName: string
  ): ContextFlags {
    const paths = files.map(f => f.path);

    return {
      testChanged: paths.some(p => this.excludeFilter.isTestFile(p)),
      schemaChanged: paths.some(p =>
        p.match(/\.(entity|schema|model)\.(ts|js)$/)
      ),
      apiRoutesChanged:
        frameworkName === "nextjs" && paths.some(p => p.includes("/api/")),
      controllersChanged:
        frameworkName === "nestjs" && paths.some(p => p.includes(".controller.ts")),
      criticalModule: paths.some(p =>
        p.match(/\/(auth|payments|billing|security)\//)
      ),
      configOnly: paths.every(p => this.excludeFilter.isConfigFile(p))
    };
  }

  detectAffectedAreas(files: string[], frameworkName: string): string[] {
    const areas: string[] = [];

    // Common areas
    if (files.some(f => f.includes("/auth/"))) areas.push("🔐 Auth");
    if (files.some(f => f.includes("/payments/"))) areas.push("💳 Payments");
    if (files.some(f => f.includes("/billing/"))) areas.push("💰 Billing");

    // Framework-specific
    if (frameworkName === "nestjs") {
      if (files.some(f => f.match(/\.(controller|guard|interceptor)\.ts$/))) {
        areas.push("🎯 HTTP Layer");
      }
      if (files.some(f => f.match(/\.(service|repository)\.ts$/))) {
        areas.push("⚙️ Business Logic");
      }
      if (files.some(f => f.includes(".entity.ts"))) {
        areas.push("🗄️ Database Schema");
      }
    } else if (frameworkName === "nextjs") {
      if (files.some(f => f.includes("/api/"))) areas.push("🔌 API Routes");
      if (files.some(f => f.includes("page.tsx"))) areas.push("📄 Pages");
      if (files.some(f => f.includes("layout.tsx"))) areas.push("🎨 Layouts");
    } else if (frameworkName === "react") {
      if (files.some(f => f.includes("/components/"))) areas.push("🧩 Components");
      if (files.some(f => f.includes("/hooks/"))) areas.push("🪝 Hooks");
      if (files.some(f => f.includes("/store/") || f.includes("/redux/"))) {
        areas.push("📦 State Management");
      }
    }

    // Tests
    if (files.some(f => this.excludeFilter.isTestFile(f))) {
      areas.push("🧪 Tests");
    }

    return areas;
  }

  isConfigOnly(files: string[]): boolean {
    return files.every(f => this.excludeFilter.isConfigFile(f));
  }

  isCriticalModule(files: string[]): boolean {
    return files.some(f =>
      f.match(/\/(auth|payments|billing|security)\//)
    );
  }

  private logAnalysisSummary(analysis: PRAnalysis): void {
    logger.info("\n" + "=".repeat(60));
    logger.info("📊 ANALYSIS SUMMARY");
    logger.info("=".repeat(60));
    logger.info(`Framework: ${analysis.context.framework.name} ${analysis.context.framework.version || ""}`);
    logger.info(`Files: ${analysis.metrics.fileCount}`);
    logger.info(`Core Files: ${analysis.metrics.coreFileCount}`);
    logger.info(`Changes: +${analysis.metrics.addedLines} -${analysis.metrics.deletedLines}`);
    logger.info(`Diff Size: ${(analysis.metrics.diffSize / 1024).toFixed(1)} KB`);

    if (analysis.context.affectedAreas.length > 0) {
      logger.info(`Affected Areas: ${analysis.context.affectedAreas.join(", ")}`);
    }

    if (analysis.context.flags.criticalModule) {
      logger.warn("⚠️ CRITICAL MODULE CHANGED");
    }

    if (analysis.context.flags.configOnly) {
      logger.info("ℹ️ Config-only changes");
    }

    logger.info("=".repeat(60) + "\n");
  }
}
```

## TEST_CASES
```yaml
test_nestjs_analysis:
  input:
    files: ["src/auth/auth.controller.ts", "src/auth/auth.service.ts"]
    framework: nestjs
  assert:
    context.framework.name: nestjs
    context.affectedAreas: ["🔐 Auth", "🎯 HTTP Layer", "⚙️ Business Logic"]
    context.flags.controllersChanged: true
    context.flags.criticalModule: true

test_config_only:
  input:
    files: ["package.json", "tsconfig.json"]
  assert:
    context.flags.configOnly: true

test_file_prioritization:
  input:
    files: ["src/auth/guard.ts", "README.md"]
  assert:
    prioritizedFiles[0].priority: critical
    prioritizedFiles[1].priority: low
```

