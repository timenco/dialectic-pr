import {
  formatModelName,
  extractConsensusData,
  formatFallbackIssues,
  formatReviewBody,
} from "../../src/core/review-formatter";
import type { ReviewResult, PRAnalysis } from "../../src/core/types";

describe("review-formatter", () => {
  describe("formatModelName", () => {
    it("should format claude model IDs", () => {
      expect(formatModelName("claude-opus-4-6")).toBe("Claude Opus 4.6");
      expect(formatModelName("claude-sonnet-4-6")).toBe("Claude Sonnet 4.6");
      expect(formatModelName("claude-haiku-4-5")).toBe("Claude Haiku 4.5");
    });

    it("should return unknown model IDs as-is", () => {
      expect(formatModelName("gpt-4")).toBe("gpt-4");
      expect(formatModelName("custom-model")).toBe("custom-model");
    });
  });

  describe("extractConsensusData", () => {
    it("should extract existing verdict and fpRate", () => {
      const result: ReviewResult = {
        issues: [],
        summary: {
          totalIssues: 0,
          criticalIssues: 0,
          affectedAreas: [],
          overallAssessment: "OK",
          verdict: "APPROVE",
          fpRate: "50%",
        },
        metadata: {
          framework: { name: "vanilla", confidence: "high" },
          strategy: "small",
          tokensUsed: 100,
          filesReviewed: 1,
          filesExcluded: 0,
          reviewDuration: 1000,
        },
      };

      const { verdict, fpRate } = extractConsensusData(result);
      expect(verdict).toBe("APPROVE");
      expect(fpRate).toBe("50%");
    });

    it("should infer APPROVE when no issues and no verdict", () => {
      const result: ReviewResult = {
        issues: [],
        summary: {
          totalIssues: 0,
          criticalIssues: 0,
          affectedAreas: [],
          overallAssessment: "OK",
        },
        metadata: {
          framework: { name: "vanilla", confidence: "high" },
          strategy: "small",
          tokensUsed: 100,
          filesReviewed: 1,
          filesExcluded: 0,
          reviewDuration: 1000,
        },
      };

      const { verdict, fpRate } = extractConsensusData(result);
      expect(verdict).toBe("APPROVE");
      expect(fpRate).toBe("—");
    });

    it("should infer COMMENT when there are issues but no verdict", () => {
      const result: ReviewResult = {
        issues: [
          {
            file: "test.ts",
            type: "bug",
            confidence: "high",
            title: "Bug",
            description: "desc",
          },
        ],
        summary: {
          totalIssues: 1,
          criticalIssues: 0,
          affectedAreas: [],
          overallAssessment: "Found issues",
        },
        metadata: {
          framework: { name: "vanilla", confidence: "high" },
          strategy: "small",
          tokensUsed: 100,
          filesReviewed: 1,
          filesExcluded: 0,
          reviewDuration: 1000,
        },
      };

      const { verdict } = extractConsensusData(result);
      expect(verdict).toBe("COMMENT");
    });
  });

  describe("formatFallbackIssues", () => {
    it("should show assessment when no issues", () => {
      const result: ReviewResult = {
        issues: [],
        summary: {
          totalIssues: 0,
          criticalIssues: 0,
          affectedAreas: [],
          overallAssessment: "Code looks good",
        },
        metadata: {
          framework: { name: "vanilla", confidence: "high" },
          strategy: "small",
          tokensUsed: 100,
          filesReviewed: 1,
          filesExcluded: 0,
          reviewDuration: 1000,
        },
      };

      const output = formatFallbackIssues(result);
      expect(output).toContain("### Review");
      expect(output).toContain("Code looks good");
    });

    it("should format issues with correct emojis", () => {
      const result: ReviewResult = {
        issues: [
          {
            file: "src/auth.ts",
            line: 42,
            type: "security",
            confidence: "high",
            title: "SQL Injection",
            description: "Raw query used",
            suggestion: "Use parameterized query",
          },
          {
            file: "src/perf.ts",
            type: "performance",
            confidence: "medium",
            title: "N+1 Query",
            description: "Query in loop",
          },
        ],
        summary: {
          totalIssues: 2,
          criticalIssues: 1,
          affectedAreas: [],
          overallAssessment: "Found issues",
        },
        metadata: {
          framework: { name: "vanilla", confidence: "high" },
          strategy: "small",
          tokensUsed: 100,
          filesReviewed: 1,
          filesExcluded: 0,
          reviewDuration: 1000,
        },
      };

      const output = formatFallbackIssues(result);
      expect(output).toContain("### Issues");
      expect(output).toContain("🔐 SQL Injection");
      expect(output).toContain("⚡ N+1 Query");
      expect(output).toContain("Line 42");
      expect(output).toContain("Use parameterized query");
    });
  });

  describe("formatReviewBody", () => {
    const makeAnalysis = (): PRAnalysis => ({
      diff: "",
      relevantDiff: "",
      prioritizedDiff: "",
      metrics: {
        fileCount: 3,
        addedLines: 50,
        deletedLines: 10,
        diffSize: 1024,
        coreFileCount: 2,
        tsFileCount: 3,
        jsFileCount: 0,
      },
      context: {
        framework: { name: "nestjs", confidence: "high" },
        affectedAreas: ["🔐 Auth"],
        flags: {
          testChanged: true,
          schemaChanged: false,
          apiRoutesChanged: false,
          controllersChanged: true,
          criticalModule: true,
          configOnly: false,
        },
      },
      changedFiles: ["src/auth.ts"],
      prioritizedFiles: [],
      excludedFiles: [],
    });

    const makeResult = (): ReviewResult => ({
      issues: [],
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        affectedAreas: ["🔐 Auth"],
        overallAssessment: "Code looks good",
        verdict: "APPROVE",
        fpRate: "100%",
      },
      metadata: {
        framework: { name: "nestjs", confidence: "high" },
        strategy: "small",
        tokensUsed: 5000,
        filesReviewed: 3,
        filesExcluded: 0,
        reviewDuration: 2000,
      },
      debateNarrative: "## Debate narrative here",
    });

    it("should include header and metrics", () => {
      const body = formatReviewBody(makeResult(), makeAnalysis(), "claude-opus-4-6");

      expect(body).toContain("## 🤖 Dialectic PR Review");
      expect(body).toContain("### 📊 리뷰 메트릭");
      expect(body).toContain("+50/-10");
      expect(body).toContain("3개");
    });

    it("should include consensus verdict", () => {
      const body = formatReviewBody(makeResult(), makeAnalysis(), "claude-opus-4-6");

      expect(body).toContain("✅ LGTM");
      expect(body).toContain("FP Rate: 100%");
    });

    it("should show flags when present", () => {
      const body = formatReviewBody(makeResult(), makeAnalysis(), "claude-opus-4-6");

      expect(body).toContain("🔴 크리티컬 모듈");
      expect(body).toContain("🧪 테스트 포함");
    });

    it("should include debate narrative when present", () => {
      const body = formatReviewBody(makeResult(), makeAnalysis(), "claude-opus-4-6");

      expect(body).toContain("## Debate narrative here");
    });

    it("should use fallback when no narrative", () => {
      const result = makeResult();
      delete result.debateNarrative;

      const body = formatReviewBody(result, makeAnalysis(), "claude-opus-4-6");

      expect(body).toContain("### Review");
      expect(body).toContain("Code looks good");
    });

    it("should include footer with model name", () => {
      const body = formatReviewBody(makeResult(), makeAnalysis(), "claude-opus-4-6");

      expect(body).toContain("Claude Opus 4.6");
      expect(body).toContain("Dialectic PR Review");
    });
  });
});
