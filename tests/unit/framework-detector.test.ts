import { FrameworkDetector } from "../../src/frameworks/detector";
import * as path from "path";

describe("FrameworkDetector", () => {
  const detector = new FrameworkDetector();

  it("should detect NestJS from controller files", async () => {
    const files = [
      "src/auth/auth.controller.ts",
      "src/users/users.service.ts",
    ];
    const result = await detector.detect(process.cwd(), files);
    expect(result.name).toBe("nestjs");
    expect(result.confidence).toBe("high");
  });

  it("should detect NestJS from module files", async () => {
    const files = ["src/app.module.ts", "src/main.ts"];
    const result = await detector.detect(process.cwd(), files);
    expect(result.name).toBe("nestjs");
  });

  it("should detect Next.js from next.config", async () => {
    const files = ["next.config.ts", "app/page.tsx"];
    const result = await detector.detect("/tmp/nonexistent", files);
    expect(result.name).toBe("nextjs");
  });

  it("should detect React from JSX/TSX files when no framework deps or Next patterns", async () => {
    const files = ["src/components/App.tsx", "src/index.tsx"];
    const result = await detector.detect("/tmp/nonexistent", files);
    expect(result.name).toBe("react");
  });

  it("should fallback to vanilla for unknown projects", async () => {
    const files = ["src/utils/helper.ts", "src/index.ts"];
    const result = await detector.detect("/tmp/nonexistent", files);
    expect(result.name).toBe("vanilla");
    expect(result.confidence).toBe("high");
  });

  it("should detect framework from current project (which has @nestjs/core)", async () => {
    const result = await detector.detect(process.cwd(), []);
    // This project has @nestjs/core in devDependencies
    expect(["nestjs", "vanilla"]).toContain(result.name);
  });

  it("should handle missing package.json gracefully", async () => {
    const files = ["src/index.ts"];
    const result = await detector.detect("/tmp/nonexistent-dir", files);
    expect(result).toBeDefined();
    expect(result.name).toBeDefined();
  });
});
