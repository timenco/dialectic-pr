import { StrategySelector } from "../../src/core/strategy-selector";
import { PRAnalysis, Metrics, PRContext, ContextFlags, DetectedFramework } from "../../src/core/types";

describe("StrategySelector", () => {
  let selector: StrategySelector;

  const createMockAnalysis = (
    diffSize: number,
    criticalModule: boolean = false,
    configOnly: boolean = false
  ): PRAnalysis => {
    const metrics: Metrics = {
      fileCount: 5,
      addedLines: 100,
      deletedLines: 50,
      diffSize,
      coreFileCount: 3,
      tsFileCount: 4,
      jsFileCount: 1,
    };

    const flags: ContextFlags = {
      testChanged: false,
      schemaChanged: false,
      apiRoutesChanged: false,
      controllersChanged: false,
      criticalModule,
      configOnly,
    };

    const framework: DetectedFramework = {
      name: "vanilla",
      confidence: "high",
    };

    const context: PRContext = {
      framework,
      affectedAreas: [],
      flags,
    };

    return {
      diff: "",
      relevantDiff: "",
      prioritizedDiff: "",
      metrics,
      context,
      changedFiles: [],
      prioritizedFiles: [],
      excludedFiles: [],
    };
  };

  beforeEach(() => {
    selector = new StrategySelector();
  });

  describe("select", () => {
    it("should select small strategy for small diffs (<50KB)", () => {
      const analysis = createMockAnalysis(30000); // 30KB
      const strategy = selector.select(analysis);
      expect(strategy.name).toBe("small");
      expect(strategy.maxTokens).toBe(16000);
    });

    it("should select medium strategy for medium diffs (50-150KB)", () => {
      const analysis = createMockAnalysis(100000); // 100KB
      const strategy = selector.select(analysis);
      expect(strategy.name).toBe("medium");
      expect(strategy.maxTokens).toBe(12000);
    });

    it("should select large strategy for large diffs (150-200KB)", () => {
      const analysis = createMockAnalysis(180000); // 180KB
      const strategy = selector.select(analysis);
      expect(strategy.name).toBe("large");
      expect(strategy.maxTokens).toBe(8000);
    });

    it("should select xlarge strategy for very large diffs (200-800KB)", () => {
      const analysis = createMockAnalysis(500000); // 500KB
      const strategy = selector.select(analysis);
      expect(strategy.name).toBe("xlarge");
      expect(strategy.maxTokens).toBe(4000);
    });

    it("should select skip strategy for extremely large diffs (>800KB)", () => {
      const analysis = createMockAnalysis(1000000); // 1MB
      const strategy = selector.select(analysis);
      expect(strategy.name).toBe("skip");
      expect(strategy.maxTokens).toBe(0);
    });

    it("should use small strategy for config-only changes", () => {
      const analysis = createMockAnalysis(100000, false, true); // 100KB but config only
      const strategy = selector.select(analysis);
      expect(strategy.name).toBe("small");
      expect(strategy.instructions).toContain("Config");
    });

    it("should boost token budget for critical modules", () => {
      const normalAnalysis = createMockAnalysis(30000, false);
      const criticalAnalysis = createMockAnalysis(30000, true);

      const normalStrategy = selector.select(normalAnalysis);
      const criticalStrategy = selector.select(criticalAnalysis);

      expect(criticalStrategy.maxTokens).toBeGreaterThan(normalStrategy.maxTokens);
      expect(criticalStrategy.maxTokens).toBe(Math.floor(16000 * 1.5));
    });
  });

  describe("getStrategyDescription", () => {
    it("should return formatted description", () => {
      const analysis = createMockAnalysis(30000);
      const strategy = selector.select(analysis);
      const description = selector.getStrategyDescription(strategy);

      expect(description).toContain("Strategy: SMALL");
      expect(description).toContain("Max Tokens: 16000");
      expect(description).toContain("Instructions:");
    });
  });

  describe("setCustomStrategy", () => {
    it("should allow customizing strategy tokens", () => {
      selector.setCustomStrategy("small", { maxTokens: 20000 });

      const analysis = createMockAnalysis(30000);
      const strategy = selector.select(analysis);

      expect(strategy.name).toBe("small");
      expect(strategy.maxTokens).toBe(20000);
    });

    it("should preserve strategy name when customizing", () => {
      selector.setCustomStrategy("medium", {
        maxTokens: 15000,
        instructions: "Custom instructions",
      });

      const allStrategies = selector.getAllStrategies();
      expect(allStrategies.medium.name).toBe("medium");
      expect(allStrategies.medium.maxTokens).toBe(15000);
      expect(allStrategies.medium.instructions).toBe("Custom instructions");
    });
  });

  describe("getAllStrategies", () => {
    it("should return all strategies", () => {
      const strategies = selector.getAllStrategies();
      expect(Object.keys(strategies)).toEqual([
        "small",
        "medium",
        "large",
        "xlarge",
        "skip",
      ]);
    });
  });
});
