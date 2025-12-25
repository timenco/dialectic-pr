# GITHUB API ADAPTER SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - core/types.spec.md
  - utils/logger.spec.md
external:
  - "@octokit/rest": "^20.0.0"
```

## FILE_PATH
```
src/adapters/github-api.ts
```

## CLASS_INTERFACE
```typescript
export class GitHubAdapter {
  constructor(token: string);
  async getPRDiff(prInfo: GitHubPRInfo): Promise<string>;
  async getPRFiles(prInfo: GitHubPRInfo): Promise<GitHubFile[]>;
  async postComment(prInfo: GitHubPRInfo, body: string): Promise<void>;
  async postBatchReview(
    prInfo: GitHubPRInfo,
    body: string,
    comments: GitHubComment[]
  ): Promise<void>;
}
```

## IMPLEMENTATION
```typescript
import { Octokit } from "@octokit/rest";
import { GitHubPRInfo, GitHubFile, GitHubComment } from "../core/types.js";
import { logger } from "../utils/logger.js";

export class GitHubAdapter {
  private readonly octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getPRDiff(prInfo: GitHubPRInfo): Promise<string> {
    logger.info(`📥 Fetching PR diff for #${prInfo.pullNumber}`);
    
    const { data } = await this.octokit.pulls.get({
      owner: prInfo.owner,
      repo: prInfo.repo,
      pull_number: prInfo.pullNumber,
      mediaType: { format: "diff" }
    });

    return data as unknown as string;
  }

  async getPRFiles(prInfo: GitHubPRInfo): Promise<GitHubFile[]> {
    logger.info(`📥 Fetching PR files for #${prInfo.pullNumber}`);
    
    const { data } = await this.octokit.pulls.listFiles({
      owner: prInfo.owner,
      repo: prInfo.repo,
      pull_number: prInfo.pullNumber
    });

    return data.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch
    }));
  }

  async postComment(prInfo: GitHubPRInfo, body: string): Promise<void> {
    logger.info(`💬 Posting comment to PR #${prInfo.pullNumber}`);
    
    await this.octokit.issues.createComment({
      owner: prInfo.owner,
      repo: prInfo.repo,
      issue_number: prInfo.pullNumber,
      body
    });
  }

  async postBatchReview(
    prInfo: GitHubPRInfo,
    body: string,
    comments: GitHubComment[]
  ): Promise<void> {
    logger.info(`💬 Posting batch review to PR #${prInfo.pullNumber}`);
    
    await this.octokit.pulls.createReview({
      owner: prInfo.owner,
      repo: prInfo.repo,
      pull_number: prInfo.pullNumber,
      body,
      event: "COMMENT",
      comments: comments.map(c => ({
        path: c.path,
        position: c.position,
        body: c.body
      }))
    });
  }
}
```

## API_ENDPOINTS
```yaml
get_pr_diff:
  endpoint: GET /repos/{owner}/{repo}/pulls/{pull_number}
  media_type: application/vnd.github.v3.diff
  rate_limit: 5000_per_hour

get_pr_files:
  endpoint: GET /repos/{owner}/{repo}/pulls/{pull_number}/files
  rate_limit: 5000_per_hour

post_comment:
  endpoint: POST /repos/{owner}/{repo}/issues/{issue_number}/comments
  rate_limit: 5000_per_hour

post_review:
  endpoint: POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
  rate_limit: 5000_per_hour
```

## TEST_CASES
```yaml
test_get_diff:
  mock: octokit.pulls.get returns diff string
  assert: diff string returned

test_get_files:
  mock: octokit.pulls.listFiles returns file array
  assert: GitHubFile[] returned

test_post_comment:
  mock: octokit.issues.createComment succeeds
  assert: no exception
```

