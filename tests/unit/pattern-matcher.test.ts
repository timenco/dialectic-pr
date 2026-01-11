import { PatternMatcher } from "../../src/false-positive/pattern-matcher";
import { FalsePositivePattern, ReviewIssue } from "../../src/core/types";

describe("PatternMatcher", () => {
  let matcher: PatternMatcher;

  beforeEach(() => {
    matcher = new PatternMatcher();
  });

  describe("constructor", () => {
    it("should initialize with empty patterns", () => {
      expect(matcher.patternCount).toBe(0);
    });

    it("should initialize with provided patterns", () => {
      const patterns: FalsePositivePattern[] = [
        {
          id: "test-pattern",
          category: "validation",
          explanation: "Test pattern",
          falsePositiveIndicators: ["test indicator"],
        },
      ];
      const matcherWithPatterns = new PatternMatcher(patterns);
      expect(matcherWithPatterns.patternCount).toBe(1);
    });
  });

  describe("setPatterns", () => {
    it("should set patterns", () => {
      const patterns: FalsePositivePattern[] = [
        {
          id: "pattern-1",
          category: "validation",
          explanation: "Pattern 1",
          falsePositiveIndicators: ["indicator 1"],
        },
        {
          id: "pattern-2",
          category: "error-handling",
          explanation: "Pattern 2",
          falsePositiveIndicators: ["indicator 2"],
        },
      ];
      matcher.setPatterns(patterns);
      expect(matcher.patternCount).toBe(2);
    });
  });

  describe("checkIssue", () => {
    const testPattern: FalsePositivePattern = {
      id: "nestjs-throw-error",
      category: "error-handling",
      explanation: "NestJS error handling pattern",
      falsePositiveIndicators: [
        "throw new Error should be InternalServerErrorException",
        "DB error exposure risk",
      ],
    };

    beforeEach(() => {
      matcher.setPatterns([testPattern]);
    });

    it("should detect false positive when indicator matches", () => {
      const issue: ReviewIssue = {
        file: "test.ts",
        line: 10,
        type: "bug",
        confidence: "high",
        title: "Error handling issue",
        description:
          "throw new Error should be InternalServerErrorException for proper HTTP responses",
      };

      const result = matcher.checkIssue(issue);
      expect(result.isFalsePositive).toBe(true);
      expect(result.matchedPattern?.id).toBe("nestjs-throw-error");
      expect(result.matchedIndicators.length).toBeGreaterThan(0);
    });

    it("should not flag issue without matching indicators", () => {
      const issue: ReviewIssue = {
        file: "test.ts",
        line: 10,
        type: "bug",
        confidence: "high",
        title: "Memory leak",
        description: "Potential memory leak in event listener",
      };

      const result = matcher.checkIssue(issue);
      expect(result.isFalsePositive).toBe(false);
      expect(result.matchedPattern).toBeUndefined();
    });

    it("should be case insensitive", () => {
      const issue: ReviewIssue = {
        file: "test.ts",
        type: "bug",
        confidence: "high",
        title: "Error handling",
        description:
          "THROW NEW ERROR SHOULD BE INTERNALSERVERERROREXCEPTION for proper handling",
      };

      const result = matcher.checkIssue(issue);
      expect(result.isFalsePositive).toBe(true);
    });
  });

  describe("filterIssues", () => {
    beforeEach(() => {
      matcher.setPatterns([
        {
          id: "console-log",
          category: "logging",
          explanation: "Console statements may be intentional",
          falsePositiveIndicators: ["remove console.log", "use proper logger"],
        },
      ]);
    });

    it("should filter out false positive issues", () => {
      const issues: ReviewIssue[] = [
        {
          file: "a.ts",
          type: "maintainability",
          confidence: "medium",
          title: "Console statement",
          description: "Remove console.log statement",
        },
        {
          file: "b.ts",
          type: "bug",
          confidence: "high",
          title: "Null reference",
          description: "Potential null pointer dereference",
        },
      ];

      const result = matcher.filterIssues(issues);
      expect(result.filtered.length).toBe(1);
      expect(result.removed.length).toBe(1);
      expect(result.filtered[0].file).toBe("b.ts");
      expect(result.removed[0].issue.file).toBe("a.ts");
    });

    it("should return all issues when no patterns match", () => {
      const issues: ReviewIssue[] = [
        {
          file: "a.ts",
          type: "bug",
          confidence: "high",
          title: "Bug 1",
          description: "Description 1",
        },
        {
          file: "b.ts",
          type: "bug",
          confidence: "high",
          title: "Bug 2",
          description: "Description 2",
        },
      ];

      const result = matcher.filterIssues(issues);
      expect(result.filtered.length).toBe(2);
      expect(result.removed.length).toBe(0);
    });
  });

  describe("getPatternStats", () => {
    it("should return correct statistics", () => {
      matcher.setPatterns([
        {
          id: "p1",
          category: "validation",
          explanation: "P1",
          falsePositiveIndicators: [],
          severity: "high",
        },
        {
          id: "p2",
          category: "validation",
          explanation: "P2",
          falsePositiveIndicators: [],
          severity: "low",
        },
        {
          id: "p3",
          category: "error-handling",
          explanation: "P3",
          falsePositiveIndicators: [],
        },
      ]);

      const stats = matcher.getPatternStats();
      expect(stats.total).toBe(3);
      expect(stats.byCategory["validation"]).toBe(2);
      expect(stats.byCategory["error-handling"]).toBe(1);
      expect(stats.bySeverity["high"]).toBe(1);
      expect(stats.bySeverity["low"]).toBe(1);
      expect(stats.bySeverity["medium"]).toBe(1); // default severity
    });
  });
});
