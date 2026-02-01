import { SmartFilter } from "../../src/core/smart-filter";
import { ChangedFile } from "../../src/core/types";

describe("SmartFilter", () => {
  let filter: SmartFilter;

  beforeEach(() => {
    filter = new SmartFilter();
  });

  describe("prioritizeFiles", () => {
    it("should assign critical priority to auth files", () => {
      const files: ChangedFile[] = [
        {
          path: "src/auth/auth.service.ts",
          content: "auth code",
          additions: 10,
          deletions: 5,
        },
      ];

      const result = filter.prioritizeFiles(files);
      expect(result[0].priority).toBe("critical");
      expect(result[0].reason).toContain("Security-critical");
    });

    it("should assign critical priority to security files", () => {
      const files: ChangedFile[] = [
        {
          path: "src/security/encryption.ts",
          content: "encryption code",
          additions: 10,
          deletions: 5,
        },
      ];

      const result = filter.prioritizeFiles(files);
      expect(result[0].priority).toBe("critical");
    });

    it("should assign critical priority to controller files", () => {
      const files: ChangedFile[] = [
        {
          path: "src/users/users.controller.ts",
          content: "controller code",
          additions: 10,
          deletions: 5,
        },
      ];

      const result = filter.prioritizeFiles(files);
      expect(result[0].priority).toBe("critical");
      expect(result[0].reason).toContain("HTTP security layer");
    });

    it("should assign high priority to service files", () => {
      const files: ChangedFile[] = [
        {
          path: "src/users/users.service.ts",
          content: "service code",
          additions: 10,
          deletions: 5,
        },
      ];

      const result = filter.prioritizeFiles(files);
      expect(result[0].priority).toBe("high");
      expect(result[0].reason).toContain("Business layer");
    });

    it("should assign low priority to test files", () => {
      const files: ChangedFile[] = [
        {
          path: "src/users/users.test.ts",
          content: "test code",
          additions: 10,
          deletions: 5,
        },
      ];

      const result = filter.prioritizeFiles(files);
      expect(result[0].priority).toBe("low");
      expect(result[0].reason).toContain("Test file");
    });

    it("should sort files by priority", () => {
      const files: ChangedFile[] = [
        {
          path: "src/users/users.test.ts",
          content: "test",
          additions: 1,
          deletions: 0,
        },
        {
          path: "src/auth/auth.service.ts",
          content: "auth",
          additions: 1,
          deletions: 0,
        },
        {
          path: "src/utils/helper.ts",
          content: "helper",
          additions: 1,
          deletions: 0,
        },
      ];

      const result = filter.prioritizeFiles(files);
      expect(result[0].priority).toBe("critical"); // auth
      expect(result[1].priority).toBe("high"); // utils
      expect(result[2].priority).toBe("low"); // test
    });
  });

  describe("truncateToTokenLimit", () => {
    it("should include files within token limit", () => {
      const files = [
        { path: "a.ts", content: "a".repeat(100), priority: "high" as const, reason: "test" },
        { path: "b.ts", content: "b".repeat(100), priority: "high" as const, reason: "test" },
      ];

      const result = filter.truncateToTokenLimit(files, 100);
      expect(result.included.length).toBe(2);
      expect(result.excluded.length).toBe(0);
    });

    it("should exclude files exceeding token limit", () => {
      const files = [
        { path: "a.ts", content: "a".repeat(400), priority: "critical" as const, reason: "test" },
        { path: "b.ts", content: "b".repeat(400), priority: "high" as const, reason: "test" },
      ];

      // Token limit that fits only one file (400 chars / 4 = 100 tokens)
      const result = filter.truncateToTokenLimit(files, 150);
      expect(result.included.length).toBe(1);
      expect(result.excluded.length).toBe(1);
      expect(result.included[0].path).toBe("a.ts"); // Critical priority first
    });

    it("should preserve priority order when truncating", () => {
      const files = [
        { path: "critical.ts", content: "x".repeat(100), priority: "critical" as const, reason: "test" },
        { path: "high.ts", content: "x".repeat(100), priority: "high" as const, reason: "test" },
        { path: "low.ts", content: "x".repeat(100), priority: "low" as const, reason: "test" },
      ];

      // Limit that fits only 2 files (100 chars = 25 tokens, so 50 tokens = 2 files)
      const result = filter.truncateToTokenLimit(files, 50);
      expect(result.included.length).toBe(2);
      expect(result.included[0].priority).toBe("critical");
      expect(result.included[1].priority).toBe("high");
    });
  });

  describe("getPriorityStats", () => {
    it("should return correct priority counts", () => {
      const files = [
        { path: "a.ts", content: "", priority: "critical" as const, reason: "test" },
        { path: "b.ts", content: "", priority: "critical" as const, reason: "test" },
        { path: "c.ts", content: "", priority: "high" as const, reason: "test" },
        { path: "d.ts", content: "", priority: "low" as const, reason: "test" },
      ];

      const stats = filter.getPriorityStats(files);
      expect(stats.critical).toBe(2);
      expect(stats.high).toBe(1);
      expect(stats.normal).toBe(0);
      expect(stats.low).toBe(1);
    });
  });
});
