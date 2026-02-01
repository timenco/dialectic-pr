import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { DetectedFramework } from "../core/types.js";
import { logger } from "../utils/logger.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Framework Detector
 * package.json과 파일 구조를 분석하여 프레임워크 자동 감지
 */
export class FrameworkDetector {
  /**
   * 프레임워크 감지
   * @param rootPath 저장소 루트 경로
   * @param files 변경된 파일 목록
   */
  async detect(
    rootPath: string,
    files: string[]
  ): Promise<DetectedFramework> {
    logger.info("🔍 Detecting framework...");

    // 1. package.json 읽기
    const packageJson = await this.readPackageJson(rootPath);

    // 2. 프레임워크 감지 (우선순위 순서)
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

    // 3. 기본값: vanilla TypeScript/JavaScript
    logger.info("ℹ️  No specific framework detected, using vanilla TS/JS");
    return { name: "vanilla", confidence: "high" };
  }

  /**
   * package.json 읽기
   */
  private async readPackageJson(rootPath: string): Promise<PackageJson> {
    const packageJsonPath = join(rootPath, "package.json");

    if (!existsSync(packageJsonPath)) {
      logger.warn("⚠️ package.json not found");
      return {};
    }

    try {
      const content = await readFile(packageJsonPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to read package.json: ${error}`);
      return {};
    }
  }

  /**
   * NestJS 감지
   */
  private isNestJS(pkg: PackageJson, files: string[]): boolean {
    // package.json에 @nestjs/core 의존성 확인
    if (this.hasDependency(pkg, "@nestjs/core")) {
      return true;
    }

    // 파일 구조 패턴 확인
    const nestjsPatterns = [
      "main.ts",
      ".module.ts",
      ".controller.ts",
      ".service.ts",
      "nest-cli.json",
    ];

    return files.some((f) =>
      nestjsPatterns.some((pattern) => f.includes(pattern))
    );
  }

  /**
   * Next.js 감지
   */
  private isNextJS(pkg: PackageJson, files: string[]): boolean {
    // package.json에 next 의존성 확인
    if (this.hasDependency(pkg, "next")) {
      return true;
    }

    // 파일 구조 패턴 확인
    const nextjsPatterns = [
      "next.config",
      "/app/page.tsx",
      "/app/layout.tsx",
      "/pages/_app.",
      "/pages/index.",
    ];

    return files.some((f) =>
      nextjsPatterns.some((pattern) => f.includes(pattern))
    );
  }

  /**
   * React 감지 (Next.js가 아닌 순수 React)
   */
  private isReact(pkg: PackageJson, files: string[]): boolean {
    // Next.js는 이미 감지되었으므로 제외
    if (this.hasDependency(pkg, "next")) {
      return false;
    }

    // React 의존성 확인
    if (this.hasDependency(pkg, "react")) {
      return true;
    }

    // React 파일 패턴 확인
    const reactPatterns = [".tsx", ".jsx"];

    return files.some((f) =>
      reactPatterns.some((pattern) => f.endsWith(pattern))
    );
  }

  /**
   * Express 감지
   */
  private isExpress(pkg: PackageJson, _files: string[]): boolean {
    // package.json에 express 의존성 확인
    if (this.hasDependency(pkg, "express")) {
      return true;
    }

    // 파일 내용까지 확인하려면 비용이 크므로 의존성만 확인
    return false;
  }

  /**
   * 의존성 존재 확인
   */
  private hasDependency(pkg: PackageJson, name: string): boolean {
    return !!(
      pkg.dependencies?.[name] ||
      pkg.devDependencies?.[name]
    );
  }

  /**
   * 패키지 버전 가져오기
   */
  private getVersion(pkg: PackageJson, name: string): string | undefined {
    const version =
      pkg.dependencies?.[name] || pkg.devDependencies?.[name];
    
    if (!version) {
      return undefined;
    }

    // 버전 문자열에서 실제 버전 번호만 추출 (^, ~, >= 등 제거)
    return version.replace(/^[\^~>=<]+/, "");
  }

  /**
   * 프레임워크 신뢰도 평가
   */
  getConfidenceReason(framework: DetectedFramework): string {
    switch (framework.name) {
      case "nestjs":
        return "@nestjs/core dependency found in package.json";
      case "nextjs":
        return "next dependency found in package.json";
      case "react":
        return "react dependency found in package.json";
      case "express":
        return "express dependency found in package.json (medium confidence)";
      case "vanilla":
        return "No framework-specific patterns detected";
      default:
        return "Unknown";
    }
  }
}


