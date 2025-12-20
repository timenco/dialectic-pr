import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { ConfigError, DialecticConfig } from "../core/types.js";
import { logger } from "./logger.js";

/**
 * Configuration Loader
 * .github/dialectic-pr.json 파일을 로드하고 검증
 */
export class ConfigLoader {
  private readonly defaultConfig: DialecticConfig = {
    model: "claude-sonnet-4-20250514",
    exclude_patterns: [],
    strategies: {
      small: { maxTokens: 16000 },
      medium: { maxTokens: 12000 },
      large: { maxTokens: 8000 },
    },
    false_positive_patterns: [],
    framework_specific: {},
  };

  /**
   * 설정 파일 로드
   * @param repoPath 저장소 루트 경로
   * @param configPath 커스텀 설정 파일 경로 (선택적)
   */
  async load(
    repoPath: string,
    configPath?: string
  ): Promise<DialecticConfig> {
    const configFilePath = configPath || join(repoPath, ".github/dialectic-pr.json");

    // 설정 파일이 없으면 기본 설정 사용
    if (!existsSync(configFilePath)) {
      logger.info("No config file found, using default configuration");
      return this.defaultConfig;
    }

    try {
      const content = await readFile(configFilePath, "utf-8");
      const userConfig = JSON.parse(content) as Partial<DialecticConfig>;

      // 기본 설정과 병합
      const mergedConfig: DialecticConfig = {
        ...this.defaultConfig,
        ...userConfig,
        strategies: {
          ...this.defaultConfig.strategies,
          ...userConfig.strategies,
        },
        framework_specific: {
          ...this.defaultConfig.framework_specific,
          ...userConfig.framework_specific,
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
   * 설정 검증
   */
  private validateConfig(config: DialecticConfig): void {
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

    // False positive patterns 검증
    if (!Array.isArray(config.false_positive_patterns)) {
      throw new ConfigError("false_positive_patterns must be an array");
    }

    for (const pattern of config.false_positive_patterns) {
      if (!pattern.id || !pattern.category || !pattern.explanation) {
        throw new ConfigError(
          "Each false positive pattern must have id, category, and explanation"
        );
      }
    }
  }

  /**
   * 프로젝트 컨벤션 파일 로드
   * @param repoPath 저장소 루트 경로
   * @param conventionPaths 컨벤션 파일 경로 배열
   */
  async loadConventions(
    repoPath: string,
    conventionPaths: string[]
  ): Promise<string> {
    const conventions: string[] = [];

    for (const conventionPath of conventionPaths) {
      const fullPath = join(repoPath, conventionPath);

      if (!existsSync(fullPath)) {
        logger.warn(`Convention file not found: ${conventionPath}`);
        continue;
      }

      try {
        const content = await readFile(fullPath, "utf-8");
        conventions.push(`\n## From ${conventionPath}\n\n${content}`);
        logger.debug(`Loaded convention from ${conventionPath}`);
      } catch (error) {
        logger.warn(`Failed to load convention from ${conventionPath}: ${error}`);
      }
    }

    return conventions.join("\n\n---\n\n");
  }

  /**
   * 기본 설정 가져오기
   */
  getDefaultConfig(): DialecticConfig {
    return { ...this.defaultConfig };
  }
}

