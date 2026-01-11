import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import {
  FalsePositivePattern,
  ProjectRules,
  FrameworkName,
} from "../core/types.js";
import { logger } from "../utils/logger.js";
import { BUILTIN_PATTERNS } from "./builtin-patterns.js";
import { FrameworkRegistry } from "../frameworks/base-framework.js";

/**
 * Project-specific configuration from dialectic-pr.json
 */
interface ProjectConfig {
  false_positive_patterns?: FalsePositivePattern[];
  disabled_builtin_patterns?: string[];
  framework_specific?: {
    [key: string]: {
      disabled_builtin_patterns?: string[];
      custom_patterns?: FalsePositivePattern[];
    };
  };
  conventions?: {
    paths?: string[];
    sections?: Record<string, string[]>;
  };
  exclude_patterns?: string[];
}

/**
 * Project Rules Loader
 * 프로젝트별 False Positive 규칙과 컨벤션을 로드합니다.
 */
export class ProjectRulesLoader {
  /**
   * 프로젝트 규칙 로드
   * @param repoPath 저장소 루트 경로
   * @param frameworkName 감지된 프레임워크 이름
   */
  async load(
    repoPath: string,
    frameworkName: FrameworkName
  ): Promise<ProjectRules> {
    logger.info("📜 Loading project rules...");

    // 1. Load project config if exists
    const config = await this.loadProjectConfig(repoPath);

    // 2. Get builtin patterns (excluding disabled ones)
    let patterns = this.getEnabledBuiltinPatterns(config);

    // 3. Add framework-specific patterns
    patterns = this.addFrameworkPatterns(patterns, frameworkName, config);

    // 4. Add project-specific custom patterns
    if (config?.false_positive_patterns) {
      patterns = [...patterns, ...config.false_positive_patterns];
      logger.debug(
        `Added ${config.false_positive_patterns.length} custom patterns from config`
      );
    }

    // 5. Load conventions
    const conventions = await this.loadConventions(repoPath, config);

    // 6. Get exclude patterns
    const excludePatterns = config?.exclude_patterns || [];

    const rules: ProjectRules = {
      patterns,
      conventions,
      excludePatterns,
      overrides: config?.framework_specific,
    };

    logger.success(
      `✅ Loaded ${patterns.length} FP patterns, ${excludePatterns.length} exclude patterns`
    );

    return rules;
  }

  /**
   * Load project configuration from dialectic-pr.json
   */
  private async loadProjectConfig(
    repoPath: string
  ): Promise<ProjectConfig | null> {
    const configPaths = [
      join(repoPath, ".github/dialectic-pr.json"),
      join(repoPath, "dialectic-pr.json"),
      join(repoPath, ".dialectic-pr.json"),
    ];

    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          const content = await readFile(configPath, "utf-8");
          const config = JSON.parse(content) as ProjectConfig;
          logger.debug(`Loaded config from ${configPath}`);
          return config;
        } catch (error) {
          logger.warn(`Failed to parse config from ${configPath}: ${error}`);
        }
      }
    }

    logger.debug("No project config found, using defaults");
    return null;
  }

  /**
   * Get enabled builtin patterns (filter out disabled ones)
   */
  private getEnabledBuiltinPatterns(
    config: ProjectConfig | null
  ): FalsePositivePattern[] {
    const disabledIds = config?.disabled_builtin_patterns || [];

    if (disabledIds.length > 0) {
      logger.debug(`Disabling ${disabledIds.length} builtin patterns`);
    }

    return BUILTIN_PATTERNS.filter((p) => !disabledIds.includes(p.id));
  }

  /**
   * Add framework-specific patterns
   */
  private addFrameworkPatterns(
    patterns: FalsePositivePattern[],
    frameworkName: FrameworkName,
    config: ProjectConfig | null
  ): FalsePositivePattern[] {
    // Get framework from registry
    const framework = FrameworkRegistry.get(frameworkName);

    if (framework) {
      const frameworkPatterns = framework.getFalsePositivePatterns();
      patterns = [...patterns, ...frameworkPatterns];
      logger.debug(
        `Added ${frameworkPatterns.length} patterns for ${frameworkName}`
      );
    }

    // Add framework-specific patterns from config
    const frameworkConfig = config?.framework_specific?.[frameworkName];

    if (frameworkConfig) {
      // Filter out framework-specific disabled patterns
      if (frameworkConfig.disabled_builtin_patterns) {
        const disabledIds = frameworkConfig.disabled_builtin_patterns;
        patterns = patterns.filter((p) => !disabledIds.includes(p.id));
        logger.debug(
          `Disabled ${disabledIds.length} patterns for ${frameworkName}`
        );
      }

      // Add framework-specific custom patterns
      if (frameworkConfig.custom_patterns) {
        patterns = [...patterns, ...frameworkConfig.custom_patterns];
        logger.debug(
          `Added ${frameworkConfig.custom_patterns.length} custom patterns for ${frameworkName}`
        );
      }
    }

    return patterns;
  }

  /**
   * Load project conventions from various sources
   */
  private async loadConventions(
    repoPath: string,
    config: ProjectConfig | null
  ): Promise<string> {
    const conventions: string[] = [];

    // Common convention file paths
    const defaultPaths = [
      "CLAUDE.md",
      "CONVENTIONS.md",
      "CONTRIBUTING.md",
      "docs/conventions.md",
      "principles/",
    ];

    // Paths from config
    const configPaths = config?.conventions?.paths || [];
    const allPaths = [...new Set([...defaultPaths, ...configPaths])];

    for (const relativePath of allPaths) {
      const fullPath = join(repoPath, relativePath);

      if (!existsSync(fullPath)) {
        continue;
      }

      try {
        // Check if it's a directory
        const content = await this.loadConventionFile(fullPath);
        if (content) {
          conventions.push(content);
          logger.debug(`Loaded conventions from ${relativePath}`);
        }
      } catch (error) {
        logger.debug(`Could not load conventions from ${relativePath}: ${error}`);
      }
    }

    if (conventions.length === 0) {
      logger.debug("No project conventions found");
      return "";
    }

    return conventions.join("\n\n---\n\n");
  }

  /**
   * Load a single convention file or directory
   */
  private async loadConventionFile(path: string): Promise<string | null> {
    try {
      const content = await readFile(path, "utf-8");
      return content;
    } catch {
      // Might be a directory
      return null;
    }
  }

  /**
   * Merge multiple project rules
   */
  static mergeRules(...rules: ProjectRules[]): ProjectRules {
    const mergedPatterns: FalsePositivePattern[] = [];
    const seenIds = new Set<string>();
    const conventions: string[] = [];
    const excludePatterns: string[] = [];

    for (const rule of rules) {
      // Merge patterns (deduplicate by ID)
      for (const pattern of rule.patterns) {
        if (!seenIds.has(pattern.id)) {
          seenIds.add(pattern.id);
          mergedPatterns.push(pattern);
        }
      }

      // Merge conventions
      if (rule.conventions) {
        conventions.push(rule.conventions);
      }

      // Merge exclude patterns
      excludePatterns.push(...rule.excludePatterns);
    }

    return {
      patterns: mergedPatterns,
      conventions: conventions.join("\n\n"),
      excludePatterns: [...new Set(excludePatterns)],
    };
  }
}
