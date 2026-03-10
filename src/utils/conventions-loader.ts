import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { logger, safeError } from "./logger.js";

/**
 * Conventions Loader
 * CLAUDE.md 프로젝트 컨벤션 파일 로딩 전담
 */
export class ConventionsLoader {
  /**
   * CLAUDE.md 자동 감지 및 로드
   */
  async load(repoPath: string): Promise<string> {
    const claudeMdPath = join(repoPath, "CLAUDE.md");

    if (!existsSync(claudeMdPath)) {
      return "";
    }

    try {
      const content = await readFile(claudeMdPath, "utf-8");
      logger.info(`Loaded project context from CLAUDE.md`);
      return content;
    } catch (error) {
      logger.warn(`Failed to load CLAUDE.md: ${safeError(error)}`);
      return "";
    }
  }
}
