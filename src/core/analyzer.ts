import {
  PRAnalysis,
  ChangedFile,
  PrioritizedFile,
} from "./types.js";
import { ExcludeFilter } from "../security/exclude-filter.js";
import { SmartFilter } from "./smart-filter.js";
import { MetricsCalculator } from "../utils/metrics-calculator.js";
import { FrameworkDetector } from "../frameworks/detector.js";
import { isSourceFile } from "../utils/file-classifier.js";
import type { IFrameworkService } from "../frameworks/framework-service.js";
import { logger } from "../utils/logger.js";

/**
 * PR Analyzer
 * PR의 변경사항을 분석하고 메트릭 계산
 */
export class PRAnalyzer {
  constructor(
    private excludeFilter: ExcludeFilter,
    private smartFilter: SmartFilter,
    private frameworkDetector: FrameworkDetector,
    private frameworkService: IFrameworkService
  ) {}

  /**
   * PR 분석
   * @param diff PR diff 문자열
   * @param files 변경된 파일 정보
   * @param repoPath 저장소 루트 경로
   */
  async analyze(
    diff: string,
    files: ChangedFile[],
    repoPath: string
  ): Promise<PRAnalysis> {
    logger.section("PR Analysis");

    // 1. 프레임워크 감지
    const framework = await this.frameworkDetector.detect(
      repoPath,
      files.map((f) => f.path)
    );

    // 1b. Framework 인스턴스 획득
    const frameworkInstance = this.frameworkService.getFramework(framework.name);
    const frameworkRules = frameworkInstance?.getPriorityRules();

    // 2. 파일 필터링 (민감 파일 제외)
    const filteredFiles = this.filterFiles(files);
    logger.info(`📊 Files: ${files.length} total, ${filteredFiles.length} after filtering`);

    // 3. 관련 diff만 추출 (소스 코드만)
    const relevantDiff = this.extractRelevantDiff(diff, filteredFiles);

    // 4. 메트릭 계산
    const metrics = MetricsCalculator.calculate(
      relevantDiff,
      filteredFiles.map((f) => f.path)
    );

    const filePaths = filteredFiles.map((f) => f.path);

    // 5. 컨텍스트 플래그 감지 — Framework 위임
    const flags = frameworkInstance
      ? frameworkInstance.extractContextFlags(filePaths)
      : {
          testChanged: false,
          schemaChanged: false,
          apiRoutesChanged: false,
          controllersChanged: false,
          criticalModule: false,
          configOnly: false,
        };

    // 6. 영향받는 영역 감지 — Framework 위임
    const affectedAreas = frameworkInstance?.detectAffectedAreas(filePaths) ?? [];

    // 7. 파일 우선순위 지정
    const prioritizedFiles = this.smartFilter.prioritizeFiles(filteredFiles, frameworkRules);

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
      .filter((f) => isSourceFile(f.path))
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
  private buildPrioritizedDiff(files: PrioritizedFile[]): string {
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


