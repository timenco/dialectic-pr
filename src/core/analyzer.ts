import {
  PRAnalysis,
  ChangedFile,
  ContextFlags,
  GitHubPRInfo,
  CRITICAL_MODULE_PATTERN,
} from "./types.js";
import { isSchemaFile } from "../utils/file-classifier.js";
import { ExcludeFilter } from "../security/exclude-filter.js";
import { SmartFilter } from "./smart-filter.js";
import { MetricsCalculator } from "../utils/metrics-calculator.js";
import { FrameworkDetector } from "../frameworks/detector.js";
import { logger } from "../utils/logger.js";

/**
 * PR Analyzer
 * PR의 변경사항을 분석하고 메트릭 계산
 */
export class PRAnalyzer {
  private readonly metricsCalculator = new MetricsCalculator();

  constructor(
    private excludeFilter: ExcludeFilter,
    private smartFilter: SmartFilter,
    private frameworkDetector: FrameworkDetector
  ) {}

  /**
   * PR 분석
   * @param diff PR diff 문자열
   * @param files 변경된 파일 정보
   * @param prInfo PR 정보
   * @param repoPath 저장소 루트 경로
   */
  async analyze(
    diff: string,
    files: ChangedFile[],
    prInfo: GitHubPRInfo,
    repoPath: string
  ): Promise<PRAnalysis> {
    logger.section("PR Analysis");

    // 1. 프레임워크 감지
    const framework = await this.frameworkDetector.detect(
      repoPath,
      files.map((f) => f.path)
    );

    // 2. 파일 필터링 (민감 파일 제외)
    const filteredFiles = this.filterFiles(files);
    logger.info(`📊 Files: ${files.length} total, ${filteredFiles.length} after filtering`);

    // 3. 관련 diff만 추출 (소스 코드만)
    const relevantDiff = this.extractRelevantDiff(diff, filteredFiles);

    // 4. 메트릭 계산
    const metrics = this.metricsCalculator.calculate(
      relevantDiff,
      filteredFiles.map((f) => f.path)
    );

    // 5. 컨텍스트 플래그 감지
    const flags = this.detectContextFlags(filteredFiles, framework.name);

    // 6. 영향받는 영역 감지
    const affectedAreas = this.detectAffectedAreas(
      filteredFiles.map((f) => f.path),
      framework.name
    );

    // 7. 파일 우선순위 지정
    const prioritizedFiles = this.smartFilter.prioritizeFiles(filteredFiles);

    // 8. 우선순위 정렬된 diff 생성
    const prioritizedDiff = this.buildPrioritizedDiff(prioritizedFiles);

    // 9. 제외된 파일 목록
    const excludedFiles = this.excludeFilter.getExcludedFiles(
      files.map((f) => f.path)
    );

    const analysis: PRAnalysis = {
      diff,
      relevantDiff,
      prioritizedDiff,
      metrics,
      context: {
        framework,
        affectedAreas,
        flags,
      },
      changedFiles: filteredFiles.map((f) => f.path),
      prioritizedFiles,
      excludedFiles,
    };

    this.logAnalysisSummary(analysis);

    return analysis;
  }

  /**
   * 파일 필터링 (제외 패턴 적용)
   */
  private filterFiles(files: ChangedFile[]): ChangedFile[] {
    return files.filter((f) => !this.excludeFilter.shouldExclude(f.path));
  }

  /**
   * 소스 코드 diff만 추출
   */
  private extractRelevantDiff(diff: string, files: ChangedFile[]): string {
    // 소스 파일 경로 목록
    const sourcePaths = files
      .filter((f) => this.excludeFilter.isSourceFile(f.path))
      .map((f) => f.path);

    // diff를 파일별로 분리
    const diffBlocks = diff.split(/^diff --git /m);
    const relevantBlocks: string[] = [];

    for (const block of diffBlocks) {
      if (!block.trim()) continue;

      // 파일 경로 추출
      const pathMatch = block.match(/^a\/(.+?) b\//);
      if (pathMatch) {
        const filePath = pathMatch[1];
        if (sourcePaths.some((p) => p === filePath)) {
          relevantBlocks.push(`diff --git ${block}`);
        }
      }
    }

    return relevantBlocks.join("\n");
  }

  /**
   * 우선순위 정렬된 diff 생성
   */
  private buildPrioritizedDiff(files: typeof this.smartFilter.prioritizeFiles extends (files: any) => infer R ? R : never): string {
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

  /**
   * 컨텍스트 플래그 감지
   */
  private detectContextFlags(
    files: ChangedFile[],
    frameworkName: string
  ): ContextFlags {
    const paths = files.map((f) => f.path);

    return {
      testChanged: paths.some((p) => this.excludeFilter.isTestFile(p)),
      schemaChanged: paths.some((p) => isSchemaFile(p)),
      apiRoutesChanged:
        frameworkName === "nextjs" &&
        paths.some((p) => p.includes("/api/")),
      controllersChanged:
        frameworkName === "nestjs" &&
        paths.some((p) => p.includes(".controller.ts")),
      criticalModule: paths.some((p) => CRITICAL_MODULE_PATTERN.test(p)),
      configOnly: paths.every((p) => this.excludeFilter.isConfigFile(p)),
    };
  }

  /**
   * 영향받는 영역 감지
   */
  detectAffectedAreas(files: string[], frameworkName: string): string[] {
    const areas: string[] = [];

    // 공통 영역
    if (files.some((f) => f.includes("/auth/"))) {
      areas.push("🔐 Auth");
    }
    if (files.some((f) => f.includes("/payments/"))) {
      areas.push("💳 Payments");
    }
    if (files.some((f) => f.includes("/billing/"))) {
      areas.push("💰 Billing");
    }

    // 프레임워크별 영역
    if (frameworkName === "nestjs") {
      if (files.some((f) => f.match(/\.(controller|guard|interceptor)\.ts$/))) {
        areas.push("🎯 HTTP Layer");
      }
      if (files.some((f) => f.match(/\.(service|repository)\.ts$/))) {
        areas.push("⚙️ Business Logic");
      }
      if (files.some((f) => f.includes(".entity.ts"))) {
        areas.push("🗄️ Database Schema");
      }
    } else if (frameworkName === "nextjs") {
      if (files.some((f) => f.includes("/api/"))) {
        areas.push("🔌 API Routes");
      }
      if (files.some((f) => f.includes("page.tsx"))) {
        areas.push("📄 Pages");
      }
      if (files.some((f) => f.includes("layout.tsx"))) {
        areas.push("🎨 Layouts");
      }
    } else if (frameworkName === "react") {
      if (files.some((f) => f.includes("/components/"))) {
        areas.push("🧩 Components");
      }
      if (files.some((f) => f.includes("/hooks/"))) {
        areas.push("🪝 Hooks");
      }
      if (files.some((f) => f.includes("/store/") || f.includes("/redux/"))) {
        areas.push("📦 State Management");
      }
    }

    // 테스트
    if (files.some((f) => this.excludeFilter.isTestFile(f))) {
      areas.push("🧪 Tests");
    }

    return areas;
  }

  /**
   * Config-only 변경인지 확인
   */
  isConfigOnly(files: string[]): boolean {
    return files.every((f) => this.excludeFilter.isConfigFile(f));
  }

  /**
   * Critical 모듈 변경인지 확인
   */
  isCriticalModule(files: string[]): boolean {
    return files.some((f) => CRITICAL_MODULE_PATTERN.test(f));
  }

  /**
   * 분석 요약 로그
   */
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


