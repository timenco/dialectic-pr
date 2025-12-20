import { Metrics } from "../core/types.js";

/**
 * Metrics Calculator
 * PR 변경사항 메트릭 계산
 */
export class MetricsCalculator {
  /**
   * Diff에서 메트릭 계산
   * @param diff Git diff 문자열
   * @param files 변경된 파일 목록
   */
  calculate(diff: string, files: string[]): Metrics {
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

    const tsFileCount = files.filter((f) =>
      f.match(/\.(ts|tsx)$/)
    ).length;

    const jsFileCount = files.filter((f) =>
      f.match(/\.(js|jsx|mjs|cjs)$/)
    ).length;

    const coreFileCount = this.countCoreFiles(files);

    return {
      fileCount: files.length,
      addedLines,
      deletedLines,
      diffSize: Buffer.byteLength(diff, "utf8"),
      coreFileCount,
      tsFileCount,
      jsFileCount,
    };
  }

  /**
   * 핵심 파일 수 계산 (테스트, 설정 파일 제외)
   */
  private countCoreFiles(files: string[]): number {
    return files.filter((f) => {
      // 테스트 파일 제외
      if (f.includes(".test.") || f.includes(".spec.")) {
        return false;
      }

      // 설정 파일 제외
      if (
        f.endsWith(".json") ||
        f.endsWith(".yaml") ||
        f.endsWith(".yml") ||
        f.endsWith(".md")
      ) {
        return false;
      }

      // 소스 파일만 포함
      return f.match(/\.(ts|tsx|js|jsx|mjs|cjs)$/);
    }).length;
  }

  /**
   * 토큰 수 추정 (대략 4 chars ≈ 1 token)
   * @param text 텍스트
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * 메트릭 요약 문자열 생성
   */
  summarize(metrics: Metrics): string {
    return `
Files: ${metrics.fileCount} (${metrics.tsFileCount} TS, ${metrics.jsFileCount} JS)
Core Files: ${metrics.coreFileCount}
Changes: +${metrics.addedLines} -${metrics.deletedLines}
Size: ${this.formatBytes(metrics.diffSize)}
Estimated Tokens: ~${this.estimateTokens(metrics.diffSize.toString())}
    `.trim();
  }

  /**
   * 바이트를 읽기 쉬운 형식으로 변환
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

