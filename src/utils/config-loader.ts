import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { ConfigError, LongblackConfig, FalsePositivePattern, GuardrailsFile } from "../core/types.js";
import { logger } from "./logger.js";

/**
 * Configuration Loader
 * .github/longblack-pr-review.json 파일을 로드하고 검증
 */
export class ConfigLoader {
  private readonly defaultConfig: LongblackConfig = {
    model: "claude-sonnet-4-20250514",
    language: undefined,
    exclude_patterns: [],
    strategies: {
      small: { maxTokens: 16000 },
      medium: { maxTokens: 12000 },
      large: { maxTokens: 8000 },
    },
  };

  /** Deprecated field names that should trigger a warning */
  private static readonly DEPRECATED_FIELDS = [
    "context_files",
    "false_positive_files",
    "false_positive_patterns",
    "framework_specific",
    "conventions",
  ];

  /**
   * 설정 파일 로드
   * @param repoPath 저장소 루트 경로
   * @param configPath 커스텀 설정 파일 경로 (선택적)
   */
  async load(
    repoPath: string,
    configPath?: string
  ): Promise<LongblackConfig> {
    const configFilePath = configPath || join(repoPath, ".github/longblack-pr-review.json");

    // 설정 파일이 없으면 기본 설정 사용
    if (!existsSync(configFilePath)) {
      logger.info("No config file found, using default configuration");
      return this.defaultConfig;
    }

    try {
      const content = await readFile(configFilePath, "utf-8");
      const userConfig = JSON.parse(content) as Record<string, unknown>;

      // Deprecation warnings
      this.warnDeprecatedFields(userConfig);

      // 기본 설정과 병합
      const mergedConfig: LongblackConfig = {
        ...this.defaultConfig,
        ...this.pickValidFields(userConfig),
        strategies: {
          ...this.defaultConfig.strategies,
          ...(userConfig.strategies as LongblackConfig["strategies"] | undefined),
        },
      };

      this.validateConfig(mergedConfig);
      logger.info(`Loaded config from ${configFilePath}`);

      return mergedConfig;
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }

      throw new ConfigError(
        `Failed to load config from ${configFilePath}: ${error}`,
        { path: configFilePath, error }
      );
    }
  }

  /**
   * .github/review-guardrails.json 자동 감지 및 로드
   */
  async loadGuardrails(repoPath: string): Promise<GuardrailsFile> {
    const guardrailsPath = join(repoPath, ".github/review-guardrails.json");

    if (!existsSync(guardrailsPath)) {
      return {};
    }

    try {
      const content = await readFile(guardrailsPath, "utf-8");
      const parsed = JSON.parse(content);

      // 배열 형식 [...] → { patterns: [...] }
      if (Array.isArray(parsed)) {
        const validPatterns = parsed.filter((p) => this.isValidFPPattern(p));
        logger.info(`Loaded ${validPatterns.length} guardrail patterns from ${guardrailsPath}`);
        return { patterns: validPatterns as FalsePositivePattern[] };
      }

      // 객체 형식 { patterns?: [...], disabled_patterns?: [...] }
      const result: GuardrailsFile = {};

      if (Array.isArray(parsed.patterns)) {
        result.patterns = parsed.patterns.filter((p: unknown) =>
          this.isValidFPPattern(p)
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
      logger.warn(`Failed to load guardrails from ${guardrailsPath}: ${error}`);
      return {};
    }
  }

  /**
   * CLAUDE.md 자동 감지 및 로드
   */
  async loadClaudeMd(repoPath: string): Promise<string> {
    const claudeMdPath = join(repoPath, "CLAUDE.md");

    if (!existsSync(claudeMdPath)) {
      return "";
    }

    try {
      const content = await readFile(claudeMdPath, "utf-8");
      logger.info(`Loaded project context from CLAUDE.md`);
      return content;
    } catch (error) {
      logger.warn(`Failed to load CLAUDE.md: ${error}`);
      return "";
    }
  }

  /**
   * 설정 검증
   */
  private validateConfig(config: LongblackConfig): void {
    // 모델 이름 검증
    if (!config.model || typeof config.model !== "string") {
      throw new ConfigError("Invalid model configuration");
    }

    // Strategies 검증
    if (!config.strategies || typeof config.strategies !== "object") {
      throw new ConfigError("Invalid strategies configuration");
    }

    const requiredStrategies = ["small", "medium", "large"];
    for (const strategy of requiredStrategies) {
      const strategyConfig = config.strategies[strategy as keyof typeof config.strategies];
      if (
        !strategyConfig ||
        typeof strategyConfig.maxTokens !== "number"
      ) {
        throw new ConfigError(`Invalid strategy configuration for: ${strategy}`);
      }
    }

    // Exclude patterns 검증
    if (!Array.isArray(config.exclude_patterns)) {
      throw new ConfigError("exclude_patterns must be an array");
    }
  }

  /**
   * Pick only valid LongblackConfig fields from user config
   */
  private pickValidFields(
    userConfig: Record<string, unknown>
  ): Partial<LongblackConfig> {
    const result: Partial<LongblackConfig> = {};
    if (typeof userConfig.model === "string") result.model = userConfig.model;
    if (typeof userConfig.language === "string") result.language = userConfig.language;
    if (Array.isArray(userConfig.exclude_patterns)) {
      result.exclude_patterns = userConfig.exclude_patterns as string[];
    }
    return result;
  }

  /**
   * Warn about deprecated config fields
   */
  private warnDeprecatedFields(userConfig: Record<string, unknown>): void {
    for (const field of ConfigLoader.DEPRECATED_FIELDS) {
      if (field in userConfig) {
        logger.warn(
          `⚠️  Config field "${field}" is deprecated and will be ignored. ` +
          `Use .github/review-guardrails.json for FP patterns or CLAUDE.md for project context.`
        );
      }
    }
  }

  /**
   * FP 패턴 유효성 검증
   */
  private isValidFPPattern(raw: unknown): boolean {
    if (typeof raw !== "object" || raw === null) return false;
    const obj = raw as Record<string, unknown>;
    return (
      typeof obj.id === "string" &&
      typeof obj.category === "string" &&
      typeof obj.explanation === "string" &&
      Array.isArray(obj.falsePositiveIndicators)
    );
  }

  /**
   * 기본 설정 가져오기
   */
  getDefaultConfig(): LongblackConfig {
    return { ...this.defaultConfig };
  }
}
