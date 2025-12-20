import { Octokit } from "@octokit/rest";
import {
  GitHubPRInfo,
  GitHubComment,
  BatchReviewParams,
  APIError,
} from "../core/types.js";
import { logger } from "../utils/logger.js";

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

      logger.success(`✅ Fetched PR diff (${(data as unknown as string).length} bytes)`);
      return data as unknown as string;
    } catch (error) {
      logger.error(`Failed to fetch PR diff: ${error}`);
      throw new APIError(
        (error as { status?: number }).status ?? 500,
        `Failed to fetch PR diff: ${error}`,
        error
      );
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
      logger.error(`Failed to fetch PR files: ${error}`);
      throw new APIError(
        (error as { status?: number }).status ?? 500,
        `Failed to fetch PR files: ${error}`,
        error
      );
    }
  }

  /**
   * Batch Review 작성
   * 여러 코멘트를 하나의 Review로 묶어서 전송
   * @param params Batch Review 파라미터
   */
  async postBatchReview(params: BatchReviewParams): Promise<void> {
    logger.info(
      `💬 Posting batch review with ${params.comments.length} comments...`
    );

    try {
      await this.octokit.pulls.createReview({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.prNumber,
        body: params.body,
        event: params.event || "COMMENT",
        comments: params.comments.map((c) => ({
          path: c.path,
          position: c.position,
          body: c.body,
        })),
      });

      logger.success(
        `✅ Posted batch review with ${params.comments.length} comments`
      );
    } catch (error) {
      logger.error(`Failed to post batch review: ${error}`);
      throw new APIError(
        (error as { status?: number }).status ?? 500,
        `Failed to post batch review: ${error}`,
        error
      );
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
      logger.error(`Failed to post comment: ${error}`);
      throw new APIError(
        (error as { status?: number }).status ?? 500,
        `Failed to post comment: ${error}`,
        error
      );
    }
  }

  /**
   * PR에 라벨 추가
   * @param prInfo PR 정보
   * @param labels 추가할 라벨 목록
   */
  async addLabels(prInfo: GitHubPRInfo, labels: string[]): Promise<void> {
    logger.info(`🏷️  Adding labels: ${labels.join(", ")}`);

    try {
      await this.octokit.issues.addLabels({
        owner: prInfo.owner,
        repo: prInfo.repo,
        issue_number: prInfo.pullNumber,
        labels,
      });

      logger.success(`✅ Added labels`);
    } catch (error) {
      logger.error(`Failed to add labels: ${error}`);
      throw new APIError(
        (error as { status?: number }).status ?? 500,
        `Failed to add labels: ${error}`,
        error
      );
    }
  }

  /**
   * PR 정보 가져오기
   * @param prInfo PR 정보
   */
  async getPRInfo(prInfo: GitHubPRInfo): Promise<{
    title: string;
    body: string | null;
    state: string;
    isDraft: boolean;
    additions: number;
    deletions: number;
    changedFiles: number;
  }> {
    logger.info(`📥 Fetching PR info for #${prInfo.pullNumber}...`);

    try {
      const { data } = await this.octokit.pulls.get({
        owner: prInfo.owner,
        repo: prInfo.repo,
        pull_number: prInfo.pullNumber,
      });

      logger.success(`✅ Fetched PR info`);

      return {
        title: data.title,
        body: data.body,
        state: data.state,
        isDraft: data.draft || false,
        additions: data.additions,
        deletions: data.deletions,
        changedFiles: data.changed_files,
      };
    } catch (error) {
      logger.error(`Failed to fetch PR info: ${error}`);
      throw new APIError(
        (error as { status?: number }).status ?? 500,
        `Failed to fetch PR info: ${error}`,
        error
      );
    }
  }

  /**
   * 저장소 파일 내용 가져오기
   * @param owner 저장소 소유자
   * @param repo 저장소 이름
   * @param path 파일 경로
   * @param ref 브랜치 또는 커밋 SHA
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<string> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if ("content" in data && typeof data.content === "string") {
        return Buffer.from(data.content, "base64").toString("utf-8");
      }

      throw new Error("File content not found");
    } catch (error) {
      logger.error(`Failed to get file content for ${path}: ${error}`);
      throw new APIError(
        (error as { status?: number }).status ?? 500,
        `Failed to get file content: ${error}`,
        error
      );
    }
  }

  /**
   * Rate limit 상태 확인
   */
  async checkRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
  }> {
    try {
      const { data } = await this.octokit.rateLimit.get();

      return {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: new Date(data.rate.reset * 1000),
      };
    } catch (error) {
      logger.error(`Failed to check rate limit: ${error}`);
      throw new APIError(
        (error as { status?: number }).status ?? 500,
        `Failed to check rate limit: ${error}`,
        error
      );
    }
  }
}

