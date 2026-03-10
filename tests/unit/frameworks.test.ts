import { NestJSFramework } from "../../src/frameworks/nestjs";
import { NextJSFramework } from "../../src/frameworks/nextjs";
import { ReactFramework } from "../../src/frameworks/react";
import { ExpressFramework } from "../../src/frameworks/express";
import { VanillaFramework } from "../../src/frameworks/vanilla";
import { FrameworkRegistry, registerAllFrameworks } from "../../src/frameworks/index";

describe("Framework Implementations", () => {
  describe("NestJSFramework", () => {
    const framework = new NestJSFramework();

    it("should have correct name", () => {
      expect(framework.name).toBe("nestjs");
    });

    it("should return review instructions", () => {
      const instructions = framework.getReviewInstructions();
      expect(instructions).toContain("NestJS");
      expect(instructions).toContain("dependency_injection");
      expect(instructions).toContain("exception_filters");
    });

    it("should return false positive patterns", () => {
      const patterns = framework.getFalsePositivePatterns();
      expect(patterns.length).toBeGreaterThan(0);
      const ids = patterns.map((p) => p.id);
      expect(ids).toContain("nestjs-circular-dependency");
      expect(ids).toContain("nestjs-decorator-return");
    });

    it("should detect affected areas", () => {
      const files = [
        "src/auth/auth.controller.ts",
        "src/users/users.service.ts",
        "src/users/user.entity.ts",
      ];
      const areas = framework.detectAffectedAreas(files);
      expect(areas).toContain("🔐 Auth");
      expect(areas).toContain("🎯 HTTP Layer");
      expect(areas).toContain("⚙️ Business Logic");
      expect(areas).toContain("🗄️ Database Schema");
    });

    it("should identify critical modules", () => {
      expect(framework.isCriticalModule("src/auth/auth.controller.ts")).toBe(true);
      expect(framework.isCriticalModule("src/auth/auth.guard.ts")).toBe(true);
      expect(framework.isCriticalModule("src/users/users.service.ts")).toBe(false);
    });

    it("should extract context flags", () => {
      const files = [
        "src/auth/auth.controller.ts",
        "src/users/users.module.ts",
        "src/users/user.entity.ts",
      ];
      const flags = framework.extractContextFlags(files);
      expect(flags.criticalModule).toBe(true);
      expect(flags.controllersChanged).toBe(true);
      expect(flags.modulesChanged).toBe(true);
      expect(flags.entitiesChanged).toBe(true);
    });
  });

  describe("NextJSFramework", () => {
    const framework = new NextJSFramework();

    it("should have correct name", () => {
      expect(framework.name).toBe("nextjs");
    });

    it("should return review instructions", () => {
      const instructions = framework.getReviewInstructions();
      expect(instructions).toContain("Next.js");
      expect(instructions).toContain("server_components");
      expect(instructions).toContain("api_routes");
    });

    it("should return false positive patterns", () => {
      const patterns = framework.getFalsePositivePatterns();
      const ids = patterns.map((p) => p.id);
      expect(ids).toContain("nextjs-server-component-async");
      expect(ids).toContain("nextjs-use-client-directive");
    });

    it("should detect affected areas", () => {
      const files = [
        "app/api/users/route.ts",
        "app/dashboard/page.tsx",
        "app/layout.tsx",
      ];
      const areas = framework.detectAffectedAreas(files);
      expect(areas).toContain("🔌 API Routes");
      expect(areas).toContain("📄 Pages");
      expect(areas).toContain("🎨 Layouts");
    });

    it("should identify critical modules", () => {
      expect(framework.isCriticalModule("app/api/users/route.ts")).toBe(true);
      expect(framework.isCriticalModule("middleware.ts")).toBe(true);
      expect(framework.isCriticalModule("app/about/page.tsx")).toBe(false);
    });
  });

  describe("ReactFramework", () => {
    const framework = new ReactFramework();

    it("should have correct name", () => {
      expect(framework.name).toBe("react");
    });

    it("should return review instructions", () => {
      const instructions = framework.getReviewInstructions();
      expect(instructions).toContain("React");
      expect(instructions).toContain("hooks");
      expect(instructions).toContain("state");
    });

    it("should return false positive patterns", () => {
      const patterns = framework.getFalsePositivePatterns();
      const ids = patterns.map((p) => p.id);
      expect(ids).toContain("react-empty-deps-array");
      expect(ids).toContain("react-memo-usage");
    });

    it("should detect affected areas", () => {
      const files = [
        "src/components/Button.tsx",
        "src/hooks/useAuth.ts",
        "src/store/userSlice.ts",
      ];
      const areas = framework.detectAffectedAreas(files);
      expect(areas).toContain("🧩 Components");
      expect(areas).toContain("🪝 Hooks");
      expect(areas).toContain("📦 State Management");
    });
  });

  describe("ExpressFramework", () => {
    const framework = new ExpressFramework();

    it("should have correct name", () => {
      expect(framework.name).toBe("express");
    });

    it("should return review instructions", () => {
      const instructions = framework.getReviewInstructions();
      expect(instructions).toContain("Express");
      expect(instructions).toContain("middleware");
      expect(instructions).toContain("routing");
    });

    it("should return false positive patterns", () => {
      const patterns = framework.getFalsePositivePatterns();
      const ids = patterns.map((p) => p.id);
      expect(ids).toContain("express-error-handler");
      expect(ids).toContain("express-async-wrapper");
    });

    it("should detect affected areas", () => {
      const files = [
        "src/routes/users.routes.ts",
        "src/middleware/auth.middleware.ts",
        "src/controllers/users.controller.ts",
      ];
      const areas = framework.detectAffectedAreas(files);
      expect(areas).toContain("🛤️ Routes");
      expect(areas).toContain("🔧 Middleware");
      expect(areas).toContain("🎮 Controllers");
    });

    it("should identify critical modules", () => {
      expect(framework.isCriticalModule("src/auth/index.ts")).toBe(true);
      expect(framework.isCriticalModule("src/middleware/auth.middleware.ts")).toBe(true);
      expect(framework.isCriticalModule("src/utils/helper.ts")).toBe(false);
    });
  });

  describe("VanillaFramework", () => {
    const framework = new VanillaFramework();

    it("should have correct name", () => {
      expect(framework.name).toBe("vanilla");
    });

    it("should return review instructions", () => {
      const instructions = framework.getReviewInstructions();
      expect(instructions).toContain("TypeScript/JavaScript");
      expect(instructions).toContain("types");
      expect(instructions).toContain("async");
    });

    it("should return false positive patterns", () => {
      const patterns = framework.getFalsePositivePatterns();
      const ids = patterns.map((p) => p.id);
      expect(ids).toContain("ts-empty-catch");
      expect(ids).toContain("ts-console-cli");
    });
  });

  describe("FrameworkRegistry", () => {
    beforeAll(() => {
      // Ensure frameworks are registered
      registerAllFrameworks();
    });

    it("should have all frameworks registered", () => {
      const names = FrameworkRegistry.getRegisteredNames();
      expect(names).toContain("nestjs");
      expect(names).toContain("nextjs");
      expect(names).toContain("react");
      expect(names).toContain("express");
      expect(names).toContain("vanilla");
    });

    it("should return framework by name", () => {
      const nestjs = FrameworkRegistry.get("nestjs");
      expect(nestjs).toBeDefined();
      expect(nestjs?.name).toBe("nestjs");
    });

    it("should check if framework exists", () => {
      expect(FrameworkRegistry.has("nestjs")).toBe(true);
      expect(FrameworkRegistry.has("unknown" as any)).toBe(false);
    });
  });
});
