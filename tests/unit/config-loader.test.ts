import { ConfigLoader } from "../../src/utils/config-loader";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

describe("ConfigLoader", () => {
  const testDir = join(__dirname, "../fixtures/config-loader-test");
  let configLoader: ConfigLoader;

  beforeEach(() => {
    configLoader = new ConfigLoader();
  });

  beforeAll(async () => {
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }
  });

  afterAll(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe("load()", () => {
    it("should return default config when no config file exists", async () => {
      const config = await configLoader.load(testDir);
      expect(config.model).toBe("claude-sonnet-4-20250514");
      expect(config.false_positive_files).toEqual([]);
      expect(config.context_files).toEqual([]);
      expect(config.false_positive_patterns).toEqual([]);
    });

    it("should merge false_positive_files from user config", async () => {
      const githubDir = join(testDir, ".github");
      if (!existsSync(githubDir)) {
        await mkdir(githubDir, { recursive: true });
      }
      const configPath = join(githubDir, "dialectic-pr.json");
      await writeFile(
        configPath,
        JSON.stringify({
          model: "claude-sonnet-4-20250514",
          false_positive_files: [".github/review-guardrails.json"],
        })
      );

      const config = await configLoader.load(testDir);
      expect(config.false_positive_files).toEqual([
        ".github/review-guardrails.json",
      ]);
    });
  });

  describe("loadFalsePositiveFiles()", () => {
    it("should load patterns from array-format JSON file", async () => {
      const fpDir = join(testDir, ".github");
      if (!existsSync(fpDir)) {
        await mkdir(fpDir, { recursive: true });
      }

      const fpFile = join(fpDir, "fp-patterns.json");
      await writeFile(
        fpFile,
        JSON.stringify([
          {
            id: "test-pattern-1",
            category: "custom",
            explanation: "Test pattern",
            falsePositiveIndicators: ["test indicator"],
          },
        ])
      );

      const patterns = await configLoader.loadFalsePositiveFiles(testDir, [
        ".github/fp-patterns.json",
      ]);

      expect(patterns).toHaveLength(1);
      expect(patterns[0].id).toBe("test-pattern-1");
    });

    it("should load patterns from object-format JSON file", async () => {
      const fpDir = join(testDir, ".github");
      if (!existsSync(fpDir)) {
        await mkdir(fpDir, { recursive: true });
      }

      const fpFile = join(fpDir, "fp-patterns-obj.json");
      await writeFile(
        fpFile,
        JSON.stringify({
          patterns: [
            {
              id: "test-pattern-2",
              category: "sql-injection",
              explanation: "Test SQL pattern",
              falsePositiveIndicators: ["sql test"],
            },
          ],
        })
      );

      const patterns = await configLoader.loadFalsePositiveFiles(testDir, [
        ".github/fp-patterns-obj.json",
      ]);

      expect(patterns).toHaveLength(1);
      expect(patterns[0].id).toBe("test-pattern-2");
      expect(patterns[0].category).toBe("sql-injection");
    });

    it("should skip invalid patterns missing required fields", async () => {
      const fpDir = join(testDir, ".github");
      if (!existsSync(fpDir)) {
        await mkdir(fpDir, { recursive: true });
      }

      const fpFile = join(fpDir, "fp-invalid.json");
      await writeFile(
        fpFile,
        JSON.stringify([
          { id: "valid-pattern", category: "custom", explanation: "Valid", falsePositiveIndicators: ["test"] },
          { id: "invalid-no-indicators", category: "custom", explanation: "Missing indicators" },
          { category: "custom", explanation: "Missing id", falsePositiveIndicators: ["test"] },
        ])
      );

      const patterns = await configLoader.loadFalsePositiveFiles(testDir, [
        ".github/fp-invalid.json",
      ]);

      expect(patterns).toHaveLength(1);
      expect(patterns[0].id).toBe("valid-pattern");
    });

    it("should return empty array for non-existent file", async () => {
      const patterns = await configLoader.loadFalsePositiveFiles(testDir, [
        ".github/non-existent.json",
      ]);

      expect(patterns).toEqual([]);
    });

    it("should handle multiple files", async () => {
      const fpDir = join(testDir, ".github");
      if (!existsSync(fpDir)) {
        await mkdir(fpDir, { recursive: true });
      }

      await writeFile(
        join(fpDir, "fp-a.json"),
        JSON.stringify([
          { id: "pattern-a", category: "custom", explanation: "A", falsePositiveIndicators: ["a"] },
        ])
      );
      await writeFile(
        join(fpDir, "fp-b.json"),
        JSON.stringify([
          { id: "pattern-b", category: "custom", explanation: "B", falsePositiveIndicators: ["b"] },
        ])
      );

      const patterns = await configLoader.loadFalsePositiveFiles(testDir, [
        ".github/fp-a.json",
        ".github/fp-b.json",
      ]);

      expect(patterns).toHaveLength(2);
      expect(patterns.map((p) => p.id)).toEqual(["pattern-a", "pattern-b"]);
    });
  });
});
