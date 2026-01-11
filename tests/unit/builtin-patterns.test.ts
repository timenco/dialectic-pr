import {
  BUILTIN_PATTERNS,
  getPatternsByCategory,
  getPatternById,
  getAllPatternIds,
} from "../../src/false-positive/builtin-patterns";

describe("Builtin Patterns", () => {
  describe("BUILTIN_PATTERNS", () => {
    it("should have patterns defined", () => {
      expect(BUILTIN_PATTERNS.length).toBeGreaterThan(0);
    });

    it("should have unique IDs", () => {
      const ids = BUILTIN_PATTERNS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have required fields for all patterns", () => {
      for (const pattern of BUILTIN_PATTERNS) {
        expect(pattern.id).toBeDefined();
        expect(pattern.category).toBeDefined();
        expect(pattern.explanation).toBeDefined();
        expect(pattern.falsePositiveIndicators).toBeDefined();
        expect(Array.isArray(pattern.falsePositiveIndicators)).toBe(true);
      }
    });

    it("should include SQL injection patterns", () => {
      const sqlPatterns = BUILTIN_PATTERNS.filter(
        (p) => p.category === "sql-injection"
      );
      expect(sqlPatterns.length).toBeGreaterThan(0);
      const ids = sqlPatterns.map((p) => p.id);
      expect(ids).toContain("prisma-tagged-template-safe");
    });

    it("should include error handling patterns", () => {
      const errorPatterns = BUILTIN_PATTERNS.filter(
        (p) => p.category === "error-handling"
      );
      expect(errorPatterns.length).toBeGreaterThan(0);
      const ids = errorPatterns.map((p) => p.id);
      expect(ids).toContain("nestjs-throw-error-with-filter");
    });

    it("should include validation patterns", () => {
      const validationPatterns = BUILTIN_PATTERNS.filter(
        (p) => p.category === "validation"
      );
      expect(validationPatterns.length).toBeGreaterThan(0);
    });
  });

  describe("getPatternsByCategory", () => {
    it("should return patterns for a valid category", () => {
      const patterns = getPatternsByCategory("error-handling");
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((p) => {
        expect(p.category).toBe("error-handling");
      });
    });

    it("should return empty array for non-existent category", () => {
      const patterns = getPatternsByCategory("non-existent" as any);
      expect(patterns).toEqual([]);
    });
  });

  describe("getPatternById", () => {
    it("should return pattern by ID", () => {
      const pattern = getPatternById("prisma-tagged-template-safe");
      expect(pattern).toBeDefined();
      expect(pattern?.id).toBe("prisma-tagged-template-safe");
      expect(pattern?.category).toBe("sql-injection");
    });

    it("should return undefined for non-existent ID", () => {
      const pattern = getPatternById("non-existent-pattern");
      expect(pattern).toBeUndefined();
    });
  });

  describe("getAllPatternIds", () => {
    it("should return all pattern IDs", () => {
      const ids = getAllPatternIds();
      expect(ids.length).toBe(BUILTIN_PATTERNS.length);
      expect(ids).toContain("prisma-tagged-template-safe");
      expect(ids).toContain("nestjs-throw-error-with-filter");
      expect(ids).toContain("react-empty-deps");
    });
  });

  describe("Pattern categories coverage", () => {
    const expectedCategories = [
      "sql-injection",
      "error-handling",
      "dependency-injection",
      "logging",
      "authentication",
      "validation",
      "performance",
    ];

    it.each(expectedCategories)("should have patterns for %s category", (category) => {
      const patterns = getPatternsByCategory(category as any);
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe("React-specific patterns", () => {
    it("should include React hook patterns", () => {
      const reactPattern = getPatternById("react-empty-deps");
      expect(reactPattern).toBeDefined();
      expect(reactPattern?.falsePositiveIndicators).toContain(
        "missing dependencies in useEffect"
      );
    });

    it("should include React memo pattern", () => {
      const memoPattern = getPatternById("react-memo-optimization");
      expect(memoPattern).toBeDefined();
      expect(memoPattern?.category).toBe("performance");
    });
  });

  describe("Next.js-specific patterns", () => {
    it("should include server component pattern", () => {
      const pattern = getPatternById("nextjs-server-component");
      expect(pattern).toBeDefined();
      expect(pattern?.explanation).toContain("Server Component");
    });

    it("should include use client pattern", () => {
      const pattern = getPatternById("nextjs-use-client");
      expect(pattern).toBeDefined();
      expect(pattern?.explanation).toContain("use client");
    });
  });

  describe("NestJS-specific patterns", () => {
    it("should include error handling pattern", () => {
      const pattern = getPatternById("nestjs-throw-error-with-filter");
      expect(pattern).toBeDefined();
      expect(pattern?.contextRequired).toContain("AllExceptionsFilter");
    });

    it("should include DI pattern", () => {
      const pattern = getPatternById("nestjs-constructor-di");
      expect(pattern).toBeDefined();
      expect(pattern?.category).toBe("dependency-injection");
    });
  });
});
