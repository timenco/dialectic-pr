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
      expect(config.exclude_patterns).toEqual([]);
    });

    it("should load and merge user config", async () => {
      const githubDir = join(testDir, ".github");
      if (!existsSync(githubDir)) {
        await mkdir(githubDir, { recursive: true });
      }
      const configPath = join(githubDir, "longblack-pr-review.json");
      await writeFile(
        configPath,
        JSON.stringify({
          model: "claude-sonnet-4-20250514",
          exclude_patterns: ["**/*.lock"],
        })
      );

      const config = await configLoader.load(testDir);
      expect(config.exclude_patterns).toEqual(["**/*.lock"]);
    });

    it("should warn about deprecated fields", async () => {
      const githubDir = join(testDir, ".github");
      if (!existsSync(githubDir)) {
        await mkdir(githubDir, { recursive: true });
      }
      const configPath = join(githubDir, "longblack-pr-review.json");
      await writeFile(
        configPath,
        JSON.stringify({
          model: "claude-sonnet-4-20250514",
          false_positive_patterns: [],
          framework_specific: {},
        })
      );

      // Should not throw, just warn
      const config = await configLoader.load(testDir);
      expect(config.model).toBe("claude-sonnet-4-20250514");
    });
  });

  describe("loadGuardrails()", () => {
    it("should return empty object when file does not exist", async () => {
      const guardrails = await configLoader.loadGuardrails("/nonexistent/path");
      expect(guardrails).toEqual({});
    });

    it("should load array-format guardrails file", async () => {
      const githubDir = join(testDir, ".github");
      if (!existsSync(githubDir)) {
        await mkdir(githubDir, { recursive: true });
      }

      await writeFile(
        join(githubDir, "review-guardrails.json"),
        JSON.stringify([
          {
            id: "test-pattern-1",
            category: "custom",
            explanation: "Test pattern",
            falsePositiveIndicators: ["test indicator"],
          },
        ])
      );

      const guardrails = await configLoader.loadGuardrails(testDir);
      expect(guardrails.patterns).toHaveLength(1);
      expect(guardrails.patterns![0].id).toBe("test-pattern-1");
    });

    it("should load object-format guardrails file", async () => {
      const githubDir = join(testDir, ".github");
      if (!existsSync(githubDir)) {
        await mkdir(githubDir, { recursive: true });
      }

      await writeFile(
        join(githubDir, "review-guardrails.json"),
        JSON.stringify({
          patterns: [
            {
              id: "test-pattern-2",
              category: "sql-injection",
              explanation: "Test SQL pattern",
              falsePositiveIndicators: ["sql test"],
            },
          ],
          disabled_patterns: ["builtin-1"],
        })
      );

      const guardrails = await configLoader.loadGuardrails(testDir);
      expect(guardrails.patterns).toHaveLength(1);
      expect(guardrails.patterns![0].id).toBe("test-pattern-2");
      expect(guardrails.disabled_patterns).toEqual(["builtin-1"]);
    });

    it("should skip invalid patterns", async () => {
      const githubDir = join(testDir, ".github");
      if (!existsSync(githubDir)) {
        await mkdir(githubDir, { recursive: true });
      }

      await writeFile(
        join(githubDir, "review-guardrails.json"),
        JSON.stringify([
          {
            id: "valid",
            category: "custom",
            explanation: "Valid",
            falsePositiveIndicators: ["test"],
          },
          { id: "invalid-no-indicators", category: "custom", explanation: "Missing" },
        ])
      );

      const guardrails = await configLoader.loadGuardrails(testDir);
      expect(guardrails.patterns).toHaveLength(1);
      expect(guardrails.patterns![0].id).toBe("valid");
    });
  });

  describe("loadClaudeMd()", () => {
    it("should return empty string when CLAUDE.md does not exist", async () => {
      const content = await configLoader.loadClaudeMd("/nonexistent/path");
      expect(content).toBe("");
    });

    it("should load CLAUDE.md content", async () => {
      await writeFile(join(testDir, "CLAUDE.md"), "# Project Context\nTest content");

      const content = await configLoader.loadClaudeMd(testDir);
      expect(content).toBe("# Project Context\nTest content");
    });
  });
});
