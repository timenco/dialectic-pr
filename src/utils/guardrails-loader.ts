import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { FalsePositivePattern, GuardrailsFile } from "../core/types.js";
import { logger, safeError } from "./logger.js";

/**
 * Guardrails Loader
 * .github/review-guardrails.json 로딩 전담
 */
export class GuardrailsLoader {
  /**
   * .github/review-guardrails.json 자동 감지 및 로드
   */
  async load(repoPath: string): Promise<GuardrailsFile> {
    const guardrailsPath = join(repoPath, ".github/review-guardrails.json");

    if (!existsSync(guardrailsPath)) {
      return {};
    }

    try {
      const content = await readFile(guardrailsPath, "utf-8");
      const parsed = JSON.parse(content);

      // 배열 형식 [...] → { patterns: [...] }
      if (Array.isArray(parsed)) {
        const validPatterns = parsed.filter((p) => GuardrailsLoader.isValidFPPattern(p));
        logger.info(`Loaded ${validPatterns.length} guardrail patterns from ${guardrailsPath}`);
        return { patterns: validPatterns as FalsePositivePattern[] };
      }

      // 객체 형식 { patterns?: [...], disabled_patterns?: [...] }
      const result: GuardrailsFile = {};

      if (Array.isArray(parsed.patterns)) {
        result.patterns = parsed.patterns.filter((p: unknown) =>
          GuardrailsLoader.isValidFPPattern(p)
        ) as FalsePositivePattern[];
      }

      if (Array.isArray(parsed.disabled_patterns)) {
        result.disabled_patterns = parsed.disabled_patterns;
      }

      logger.info(
        `Loaded guardrails from ${guardrailsPath}: ${result.patterns?.length ?? 0} patterns, ${result.disabled_patterns?.length ?? 0} disabled`
      );
      return result;
    } catch (error) {
      logger.warn(`Failed to load guardrails from ${guardrailsPath}: ${safeError(error)}`);
      return {};
    }
  }

  /**
   * FP 패턴 유효성 검증
   */
  static isValidFPPattern(raw: unknown): boolean {
    if (typeof raw !== "object" || raw === null) return false;
    const obj = raw as Record<string, unknown>;
    return (
      typeof obj.id === "string" &&
      typeof obj.category === "string" &&
      typeof obj.explanation === "string" &&
      Array.isArray(obj.falsePositiveIndicators)
    );
  }
}
