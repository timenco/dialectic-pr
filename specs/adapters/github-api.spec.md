# GitHub API Adapter

## Purpose

Provides a clean interface to GitHub's REST API for fetching PR metadata, diffs, and posting review comments using Octokit.

## Location

[src/adapters/github-api.ts](../../src/adapters/github-api.ts)

## Dependencies

```yaml
internal:
  - core/types.spec.md
  - utils/logger.spec.md
external:
  - "@octokit/rest": "^20.0.0"
```

## Core Responsibility

- Authenticate with GitHub using personal access token
- Fetch PR diff in unified diff format
- Fetch PR file metadata (additions, deletions, patches)
- Post general PR comments
- Post batch review comments with inline file/line positions
- Handle GitHub API rate limiting (5000 requests/hour)

## Key Interface

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

interface GitHubPRInfo {
  owner: string;
  repo: string;
  pullNumber: number;
}

interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface GitHubComment {
  path: string;
  position: number;
  body: string;
}
```

## API Endpoints

- `GET /repos/{owner}/{repo}/pulls/{pull_number}` (mediaType: diff)
- `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`
- `POST /repos/{owner}/{repo}/issues/{issue_number}/comments`
- `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`

All endpoints respect GitHub's 5000 requests/hour rate limit.

## Related Specs

- [types.spec.md](../core/types.spec.md) - GitHubPRInfo, GitHubFile types
- [reviewer.spec.md](../core/reviewer.spec.md) - Main consumer of GitHub data
