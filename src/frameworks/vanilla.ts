import { FalsePositivePattern, PriorityRule } from "../core/types.js";
import { BaseFramework, FrameworkContextFlags } from "./base-framework.js";

/**
 * Vanilla TypeScript/JavaScript Framework Implementation
 * 특정 프레임워크가 감지되지 않은 프로젝트에 대한 기본 룰과 패턴
 */
export class VanillaFramework extends BaseFramework {
  readonly name = "vanilla" as const;

  getReviewInstructions(): string {
    return `
FRAMEWORK: TypeScript/JavaScript
BEST_PRACTICES:
  types:
    - avoid_any: true
    - use_proper_types: true
    - prefer_interfaces_for_objects: true
    - use_type_guards: true
  async:
    - handle_promise_rejections: true
    - use_async_await_over_then: true
    - avoid_callback_hell: true
  errors:
    - throw_typed_errors: true
    - use_custom_error_classes: true
    - include_error_context: true
  null_safety:
    - check_null_undefined: true
    - use_optional_chaining: true
    - use_nullish_coalescing: true
  code_quality:
    - single_responsibility: true
    - avoid_deep_nesting: true
    - prefer_pure_functions: true
    - meaningful_names: true
COMMON_FALSE_POSITIVES:
  - Intentional any for third-party library compatibility
  - Type assertions for known safe operations
  - Empty catch blocks with explicit comments
  - Console statements in CLI tools are acceptable
`.trim();
  }

  getFalsePositivePatterns(): FalsePositivePattern[] {
    return [
      ...super.getFalsePositivePatterns(),
      {
        id: "ts-any-intentional",
        category: "validation",
        explanation: "Some 'any' types are intentional for third-party lib compatibility",
        falsePositiveIndicators: [
          "should not use any",
          "replace any with proper type",
          "any is dangerous",
        ],
      },
      {
        id: "ts-type-assertion",
        category: "validation",
        explanation: "Type assertions (as X) may be intentional for known-safe operations",
        falsePositiveIndicators: [
          "avoid type assertions",
          "type assertion is unsafe",
        ],
      },
      {
        id: "ts-empty-catch",
        category: "error-handling",
        explanation: "Empty catch blocks with comments may be intentional",
        falsePositiveIndicators: [
          "empty catch block",
          "swallowing errors",
        ],
      },
      {
        id: "ts-console-cli",
        category: "logging",
        explanation: "Console statements in CLI tools and scripts are acceptable",
        falsePositiveIndicators: [
          "remove console.log",
          "use proper logger",
        ],
      },
      {
        id: "ts-non-null-assertion",
        category: "validation",
        explanation: "Non-null assertion (!) may be valid when nullability is guaranteed",
        falsePositiveIndicators: [
          "avoid non-null assertion",
          "use optional chaining instead",
        ],
      },
    ];
  }

  detectAffectedAreas(files: string[]): string[] {
    const areas = super.detectAffectedAreas(files);

    // Vanilla project common patterns
    if (files.some((f) => f.includes("/utils/") || f.includes("/helpers/"))) {
      areas.push("🔧 Utilities");
    }
    if (files.some((f) => f.includes("/lib/") || f.includes("/core/"))) {
      areas.push("📚 Core Library");
    }
    if (files.some((f) => f.includes("/types/") || f.includes(".d.ts"))) {
      areas.push("📝 Type Definitions");
    }
    if (files.some((f) => f.includes("/config/") || f.includes(".config."))) {
      areas.push("⚙️ Configuration");
    }
    if (files.some((f) => f.includes("/scripts/") || f.includes("/bin/"))) {
      areas.push("📜 Scripts");
    }

    return [...new Set(areas)];
  }

  getPriorityRules(): PriorityRule[] {
    return [
      // Critical: Core/lib code
      {
        pattern: /\/(core|lib)\/.*\.(ts|js)$/,
        priority: "high",
        reason: "Core library code",
      },
      // High: Type definitions
      {
        pattern: /\.d\.ts$/,
        priority: "high",
        reason: "Type definitions",
      },
      // Normal: Utils
      {
        pattern: /\/(utils|helpers)\/.*\.(ts|js)$/,
        priority: "normal",
        reason: "Utility functions",
      },
      // Normal: Scripts
      {
        pattern: /\/(scripts|bin)\/.*\.(ts|js)$/,
        priority: "normal",
        reason: "Script file",
      },
      ...super.getPriorityRules(),
    ];
  }

  isCriticalModule(filePath: string): boolean {
    // For vanilla projects, rely on base critical patterns
    return super.isCriticalModule(filePath);
  }

  extractContextFlags(files: string[]): FrameworkContextFlags {
    const baseFlags = super.extractContextFlags(files);
    
    return {
      ...baseFlags,
      typesChanged: files.some((f) => f.includes("/types/") || f.endsWith(".d.ts")),
      coreChanged: files.some((f) => f.includes("/core/") || f.includes("/lib/")),
      scriptsChanged: files.some((f) => f.includes("/scripts/") || f.includes("/bin/")),
    };
  }
}
