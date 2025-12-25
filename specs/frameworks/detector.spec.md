# FRAMEWORK DETECTOR SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - core/types.spec.md
  - utils/logger.spec.md
external:
  - fs/promises
```

## FILE_PATH
```
src/frameworks/detector.ts
```

## CLASS_INTERFACE
```typescript
export class FrameworkDetector {
  async detect(rootPath: string, files: string[]): Promise<DetectedFramework>;
}
```

## DETECTION_LOGIC
```yaml
nestjs:
  dependencies: ["@nestjs/core"]
  file_patterns: ["main.ts", ".module.ts", ".controller.ts", ".service.ts", "nest-cli.json"]
  confidence: high

nextjs:
  dependencies: ["next"]
  file_patterns: ["next.config", "/app/page.tsx", "/app/layout.tsx", "/pages/_app."]
  confidence: high

react:
  dependencies: ["react"]
  exclude_dependencies: ["next"]
  file_patterns: [".tsx", ".jsx"]
  confidence: high

express:
  dependencies: ["express"]
  confidence: medium

vanilla:
  default: true
  confidence: high
```

## IMPLEMENTATION
```typescript
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { DetectedFramework } from "../core/types.js";
import { logger } from "../utils/logger.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class FrameworkDetector {
  async detect(
    rootPath: string,
    files: string[]
  ): Promise<DetectedFramework> {
    logger.info("🔍 Detecting framework...");

    const packageJson = await this.readPackageJson(rootPath);

    // Priority order: NestJS > Next.js > React > Express > Vanilla
    if (this.isNestJS(packageJson, files)) {
      const version = this.getVersion(packageJson, "@nestjs/core");
      logger.success(`✅ Detected: NestJS ${version || "unknown"}`);
      return { name: "nestjs", confidence: "high", version };
    }

    if (this.isNextJS(packageJson, files)) {
      const version = this.getVersion(packageJson, "next");
      logger.success(`✅ Detected: Next.js ${version || "unknown"}`);
      return { name: "nextjs", confidence: "high", version };
    }

    if (this.isReact(packageJson, files)) {
      const version = this.getVersion(packageJson, "react");
      logger.success(`✅ Detected: React ${version || "unknown"}`);
      return { name: "react", confidence: "high", version };
    }

    if (this.isExpress(packageJson, files)) {
      const version = this.getVersion(packageJson, "express");
      logger.success(`✅ Detected: Express ${version || "unknown"}`);
      return { name: "express", confidence: "medium", version };
    }

    logger.info("ℹ️  No framework detected, using vanilla TS/JS");
    return { name: "vanilla", confidence: "high" };
  }

  private async readPackageJson(rootPath: string): Promise<PackageJson> {
    const path = join(rootPath, "package.json");

    if (!existsSync(path)) {
      logger.warn("⚠️ package.json not found");
      return {};
    }

    try {
      const content = await readFile(path, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to read package.json: ${error}`);
      return {};
    }
  }

  private isNestJS(pkg: PackageJson, files: string[]): boolean {
    if (this.hasDependency(pkg, "@nestjs/core")) {
      return true;
    }

    const nestjsPatterns = [
      "main.ts",
      ".module.ts",
      ".controller.ts",
      ".service.ts",
      "nest-cli.json"
    ];

    return files.some(f =>
      nestjsPatterns.some(pattern => f.includes(pattern))
    );
  }

  private isNextJS(pkg: PackageJson, files: string[]): boolean {
    if (this.hasDependency(pkg, "next")) {
      return true;
    }

    const nextjsPatterns = [
      "next.config",
      "/app/page.tsx",
      "/app/layout.tsx",
      "/pages/_app.",
      "/pages/index."
    ];

    return files.some(f =>
      nextjsPatterns.some(pattern => f.includes(pattern))
    );
  }

  private isReact(pkg: PackageJson, files: string[]): boolean {
    if (this.hasDependency(pkg, "next")) {
      return false; // Next.js already detected
    }

    if (this.hasDependency(pkg, "react")) {
      return true;
    }

    const reactPatterns = [".tsx", ".jsx"];
    return files.some(f => reactPatterns.some(pattern => f.endsWith(pattern)));
  }

  private isExpress(pkg: PackageJson, files: string[]): boolean {
    return this.hasDependency(pkg, "express");
  }

  private hasDependency(pkg: PackageJson, name: string): boolean {
    return !!(
      pkg.dependencies?.[name] ||
      pkg.devDependencies?.[name]
    );
  }

  private getVersion(pkg: PackageJson, name: string): string | undefined {
    const version =
      pkg.dependencies?.[name] || pkg.devDependencies?.[name];
    
    if (!version) {
      return undefined;
    }

    // Remove ^, ~, >=, etc.
    return version.replace(/^[\^~>=<]+/, "");
  }
}
```

## TEST_CASES
```yaml
test_nestjs_detection:
  package_json:
    dependencies:
      "@nestjs/core": "^10.0.0"
  assert:
    name: nestjs
    version: "10.0.0"
    confidence: high

test_nextjs_detection:
  package_json:
    dependencies:
      next: "^14.0.0"
  assert:
    name: nextjs
    version: "14.0.0"
    confidence: high

test_vanilla_fallback:
  package_json: {}
  files: ["src/utils.ts"]
  assert:
    name: vanilla
    confidence: high
```

