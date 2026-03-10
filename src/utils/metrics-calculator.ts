import { Metrics } from "../core/types.js";
import { isTestFile, isConfigFile, isSourceFile } from "./file-classifier.js";

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
  static calculate(diff: string, files: string[]): Metrics {
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

    let tsFileCount = 0;
    let jsFileCount = 0;
    for (const f of files) {
      if (/\.(ts|tsx)$/.test(f)) tsFileCount++;
      else if (/\.(js|jsx|mjs|cjs)$/.test(f)) jsFileCount++;
    }

    const coreFileCount = MetricsCalculator.countCoreFiles(files);

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
  private static countCoreFiles(files: string[]): number {
    return files.filter((f) => {
      if (isTestFile(f)) return false;
      if (isConfigFile(f)) return false;
      return isSourceFile(f);
    }).length;
  }

  /**
   * 토큰 수 추정 (대략 4 chars ≈ 1 token)
   * @param text 텍스트
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

}
