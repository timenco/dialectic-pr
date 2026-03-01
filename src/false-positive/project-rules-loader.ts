import {
  FalsePositivePattern,
  FrameworkName,
} from "../core/types.js";
import { logger } from "../utils/logger.js";
import { BUILTIN_PATTERNS } from "./builtin-patterns.js";
import { FrameworkRegistry } from "../frameworks/base-framework.js";

/**
 * Project Rules Loader
 * 빌트인 + 프레임워크별 FP 패턴을 조합하고, disabled 패턴을 필터링합니다.
 * 순수 함수 — 파일 I/O 없음.
 */
export class ProjectRulesLoader {
  /**
   * FP 패턴 조합
   * @param frameworkName 감지된 프레임워크 이름
   * @param disabledPatterns 비활성화할 패턴 ID 목록
   */
  load(
    frameworkName: FrameworkName,
    disabledPatterns: string[] = []
  ): FalsePositivePattern[] {
    logger.info("📜 Loading project rules...");

    // 1. Start with builtin patterns
    let patterns = [...BUILTIN_PATTERNS];

    // 2. Add framework-specific patterns
    const framework = FrameworkRegistry.get(frameworkName);
    if (framework) {
      const frameworkPatterns = framework.getFalsePositivePatterns();
      patterns = [...patterns, ...frameworkPatterns];
      logger.debug(
        `Added ${frameworkPatterns.length} patterns for ${frameworkName}`
      );
    }

    // 3. Filter out disabled patterns
    if (disabledPatterns.length > 0) {
      const disabledSet = new Set(disabledPatterns);
      patterns = patterns.filter((p) => !disabledSet.has(p.id));
      logger.debug(`Disabled ${disabledPatterns.length} patterns`);
    }

    logger.success(`✅ Loaded ${patterns.length} FP patterns`);
    return patterns;
  }
}
