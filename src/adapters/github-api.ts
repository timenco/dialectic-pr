import { Octokit } from "@octokit/rest";
import {
  GitHubPRInfo,
  APIError,
} from "../core/types.js";
import { logger, safeError } from "../utils/logger.js";

function toAPIError(error: unknown, message: string): APIError {
  return new APIError(
    (error as { status?: number }).status ?? 500,
    `${message}: ${safeError(error)}`
  );
}

/**
 * GitHub API Adapter
 * GitHub REST API 클라이언트 (Batch Review 방식)
 */
export class GitHubAdapter {
  private readonly octokit: Octokit;

  constructor(private githubToken: string) {
    this.octokit = new Octokit({
      auth: this.githubToken,
    });
  }

  /**
   * PR Diff 가져오기
   * @param prInfo PR 정보
   */
  async getPRDiff(prInfo: GitHubPRInfo): Promise<string> {
    logger.info(`📥 Fetching PR diff for #${prInfo.pullNumber}...`);

    try {
      const { data } = await this.octokit.pulls.get({
        owner: prInfo.owner,
        repo: prInfo.repo,
        pull_number: prInfo.pullNumber,
        mediaType: {
          format: "diff",
        },
      });

      // Octokit types this as object, but mediaType "diff" returns raw string
      const diff = data as unknown as string;
      logger.success(`✅ Fetched PR diff (${diff.length} bytes)`);
      return diff;
    } catch (error) {
      logger.error(`Failed to fetch PR diff: ${safeError(error)}`);
      throw toAPIError(error, "Failed to fetch PR diff");
    }
  }

  /**
   * PR 파일 목록 가져오기
   * @param prInfo PR 정보
   */
  async getPRFiles(prInfo: GitHubPRInfo): Promise<
    Array<{
      filename: string;
      additions: number;
      deletions: number;
      changes: number;
      patch?: string;
    }>
  > {
    logger.info(`📥 Fetching PR files for #${prInfo.pullNumber}...`);

    try {
      const { data } = await this.octokit.pulls.listFiles({
        owner: prInfo.owner,
        repo: prInfo.repo,
        pull_number: prInfo.pullNumber,
        per_page: 100,
      });

      logger.success(`✅ Fetched ${data.length} changed files`);
      return data;
    } catch (error) {
      logger.error(`Failed to fetch PR files: ${safeError(error)}`);
      throw toAPIError(error, "Failed to fetch PR files");
    }
  }

  /**
   * PR에 일반 코멘트 작성
   * @param prInfo PR 정보
   * @param body 코멘트 내용
   */
  async postComment(prInfo: GitHubPRInfo, body: string): Promise<void> {
    logger.info(`💬 Posting comment to PR #${prInfo.pullNumber}...`);

    try {
      await this.octokit.issues.createComment({
        owner: prInfo.owner,
        repo: prInfo.repo,
        issue_number: prInfo.pullNumber,
        body,
      });

      logger.success(`✅ Posted comment`);
    } catch (error) {
      logger.error(`Failed to post comment: ${safeError(error)}`);
      throw toAPIError(error, "Failed to post comment");
    }
  }

}
