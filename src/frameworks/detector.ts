import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { DetectedFramework } from "../core/types.js";
import { logger, safeError } from "../utils/logger.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PythonRequirements {
  packages: string[];
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

    if (this.isExpress(packageJson)) {
      const version = this.getVersion(packageJson, "express");
      logger.success(`✅ Detected: Express ${version || "unknown"}`);
      return { name: "express", confidence: "medium", version };
    }

    // 2.5. Python 프레임워크 감지 (JS 프레임워크 미감지 시)
    const hasPythonFiles = files.some((f) => f.endsWith(".py"));
    if (hasPythonFiles) {
      const pythonReqs = await this.readPythonRequirements(rootPath);
      if (this.isFastAPI(pythonReqs)) {
        logger.success("✅ Detected: FastAPI (Python)");
        return { name: "fastapi", confidence: "high" };
      }
      // Python 프로젝트이지만 FastAPI가 아닌 경우 vanilla fallback
      logger.info("ℹ️  Python project detected, but not FastAPI. Using vanilla.");
      return { name: "vanilla", confidence: "medium" };
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
      logger.error(`Failed to read package.json: ${safeError(error)}`);
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
  private isExpress(pkg: PackageJson): boolean {
    // package.json에 express 의존성 확인
    if (this.hasDependency(pkg, "express")) {
      return true;
    }

    // 파일 내용까지 확인하려면 비용이 크므로 의존성만 확인
    return false;
  }

  /**
   * Python requirements 읽기 (requirements.txt + pyproject.toml)
   */
  private async readPythonRequirements(rootPath: string): Promise<PythonRequirements> {
    const packages: string[] = [];

    // requirements.txt 파싱
    const reqPath = join(rootPath, "requirements.txt");
    if (existsSync(reqPath)) {
      try {
        const content = await readFile(reqPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("-")) {
            // "fastapi>=0.100.0" → "fastapi"
            const pkgName = trimmed.split(/[>=<!\[;]/)[0].trim().toLowerCase();
            if (pkgName) packages.push(pkgName);
          }
        }
      } catch (error) {
        logger.warn(`⚠️ Failed to read requirements.txt: ${safeError(error)}`);
      }
    }

    // pyproject.toml 간단 파싱
    const pyprojectPath = join(rootPath, "pyproject.toml");
    if (existsSync(pyprojectPath)) {
      try {
        const content = await readFile(pyprojectPath, "utf-8");
        this.parsePyprojectToml(content, packages);
      } catch (error) {
        logger.warn(`⚠️ Failed to read pyproject.toml: ${safeError(error)}`);
      }
    }

    return { packages };
  }

  /**
   * pyproject.toml에서 dependencies 추출
   * [project] dependencies 배열 또는 [tool.poetry.dependencies] 섹션만 파싱
   */
  private parsePyprojectToml(content: string, packages: string[]): void {
    // 1. PEP 621: [project] dependencies = ["fastapi>=0.100", ...]
    const pep621Match = content.match(
      /\[project\][^[]*?dependencies\s*=\s*\[([\s\S]*?)\]/
    );
    if (pep621Match) {
      const entries = pep621Match[1].matchAll(/"([a-zA-Z0-9_-]+)/g);
      for (const m of entries) {
        const pkg = m[1].toLowerCase();
        if (pkg && !packages.includes(pkg)) packages.push(pkg);
      }
    }

    // 2. Poetry: [tool.poetry.dependencies] 섹션의 키
    const poetryMatch = content.match(
      /\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/
    );
    if (poetryMatch) {
      const lines = poetryMatch[1].split("\n");
      for (const line of lines) {
        const kv = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
        if (kv) {
          const pkg = kv[1].toLowerCase();
          if (pkg !== "python" && !packages.includes(pkg)) packages.push(pkg);
        }
      }
    }
  }

  /**
   * FastAPI 프로젝트 여부 확인
   */
  private isFastAPI(reqs: PythonRequirements): boolean {
    return reqs.packages.includes("fastapi");
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

}
