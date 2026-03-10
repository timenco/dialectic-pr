import { FastAPIFramework } from "../../src/frameworks/fastapi";

describe("FastAPIFramework", () => {
  const framework = new FastAPIFramework();

  it("should have correct name", () => {
    expect(framework.name).toBe("fastapi");
  });

  it("should return review instructions", () => {
    const instructions = framework.getReviewInstructions();
    expect(instructions).toContain("FastAPI");
    expect(instructions).toContain("async");
    expect(instructions).toContain("dependency_injection");
    expect(instructions).toContain("pydantic");
  });

  it("should return false positive patterns", () => {
    const patterns = framework.getFalsePositivePatterns();
    expect(patterns.length).toBeGreaterThan(0);
    const ids = patterns.map((p) => p.id);
    expect(ids).toContain("pydantic-class-attrs");
    expect(ids).toContain("depends-di");
    expect(ids).toContain("async-no-await");
    expect(ids).toContain("sqlalchemy-text");
  });

  it("should detect affected areas", () => {
    const files = [
      "src/routers/users.py",
      "src/models/user.py",
      "src/agent/handler.py",
    ];
    const areas = framework.detectAffectedAreas(files);
    expect(areas).toContain("🛤️ API Endpoints");
    expect(areas).toContain("📊 Data Models");
    expect(areas).toContain("🤖 AI Agent");
  });

  it("should identify critical modules", () => {
    expect(framework.isCriticalModule("src/auth/login.py")).toBe(true);
    expect(framework.isCriticalModule("src/security/tokens.py")).toBe(true);
    expect(framework.isCriticalModule("middleware.py")).toBe(true);
    expect(framework.isCriticalModule("src/models/user.py")).toBe(false);
  });

  it("should inherit base critical module detection", () => {
    // Base checks /auth/ /payments/ /billing/ /security/ paths
    expect(framework.isCriticalModule("src/payments/stripe.py")).toBe(true);
    expect(framework.isCriticalModule("src/billing/invoice.py")).toBe(true);
  });

  it("should extract context flags", () => {
    const files = [
      "src/auth/deps.py",
      "src/routers/users.py",
      "src/agent/handler.py",
      "tests/test_users.py",
    ];
    const flags = framework.extractContextFlags(files);
    expect(flags.criticalModule).toBe(true);
    expect(flags.apiEndpointsChanged).toBe(true);
    expect(flags.agentChanged).toBe(true);
    expect(flags.testChanged).toBe(true);
  });

  it("should return priority rules", () => {
    const rules = framework.getPriorityRules();
    expect(rules.length).toBeGreaterThan(0);
    // Should include FastAPI-specific and base rules
    const reasons = rules.map((r) => r.reason);
    expect(reasons).toContain("Auth/Security");
    expect(reasons).toContain("API router");
  });
});
