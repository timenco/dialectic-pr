import { ContextFlags, FalsePositivePattern, PriorityRule } from "../core/types.js";
import { BaseFramework } from "./base-framework.js";

/**
 * NestJS Framework Implementation
 * NestJS 프로젝트에 특화된 리뷰 룰과 패턴
 */
export class NestJSFramework extends BaseFramework {
  readonly name = "nestjs" as const;

  getReviewInstructions(): string {
    return `
FRAMEWORK: NestJS
BEST_PRACTICES:
  dependency_injection:
    - use_constructor_injection: true
    - avoid_property_injection: true
  error_handling:
    - use_exception_filters: true
    - throw_http_exceptions: true
  validation:
    - use_class_validator_dtos: true
  architecture:
    - avoid_circular_dependencies: true
    - single_responsibility_modules: true
  guards_and_interceptors:
    - guards_for_authorization: true
    - interceptors_for_transformation: true
  modules:
    - providers_properly_exported: true
    - avoid_barrel_imports_in_modules: true
COMMON_FALSE_POSITIVES:
  - "throw new Error" is acceptable with AllExceptionsFilter
  - "new" keyword is intentional for DTOs and entities
  - Logger dependency injection is project pattern
  - @Inject() for custom providers is correct
  - circular dependency warnings may be false positive with forwardRef
`.trim();
  }

  getFalsePositivePatterns(): FalsePositivePattern[] {
    return [
      {
        id: "nestjs-circular-dependency",
        category: "dependency-injection",
        explanation: "forwardRef() handles intentional circular dependencies",
        falsePositiveIndicators: [
          "circular dependency detected",
          "module import cycle",
        ],
      },
      {
        id: "nestjs-decorator-return",
        category: "validation",
        explanation: "Decorators don't need explicit return in many cases",
        falsePositiveIndicators: [
          "decorator should return",
          "missing return statement in decorator",
        ],
      },
    ];
  }

  detectAffectedAreas(files: string[]): string[] {
    const areas = super.detectAffectedAreas(files);

    // NestJS-specific areas
    if (files.some((f) => f.match(/\.(controller|guard|interceptor)\.ts$/))) {
      areas.push("🎯 HTTP Layer");
    }
    if (files.some((f) => f.match(/\.(service|repository)\.ts$/))) {
      areas.push("⚙️ Business Logic");
    }
    if (files.some((f) => f.includes(".entity.ts"))) {
      areas.push("🗄️ Database Schema");
    }
    if (files.some((f) => f.includes(".module.ts"))) {
      areas.push("📦 Module Structure");
    }
    if (files.some((f) => f.includes(".dto.ts"))) {
      areas.push("📋 Data Transfer");
    }
    if (files.some((f) => f.includes(".pipe.ts"))) {
      areas.push("🔧 Validation Pipes");
    }

    return [...new Set(areas)]; // Remove duplicates
  }

  getPriorityRules(): PriorityRule[] {
    return [
      // Critical: HTTP security layer
      {
        pattern: /\.(controller|guard|middleware)\.ts$/,
        priority: "critical",
        reason: "HTTP security layer",
      },
      // Critical: Security-related
      {
        pattern: /\/(auth|security|payments|billing)\//,
        priority: "critical",
        reason: "Security-critical module",
      },
      // High: Business logic
      {
        pattern: /\.(service|repository)\.ts$/,
        priority: "high",
        reason: "Business logic",
      },
      // High: Database schema
      {
        pattern: /\.entity\.ts$/,
        priority: "high",
        reason: "Database schema",
      },
      // High: Interceptors
      {
        pattern: /\.interceptor\.ts$/,
        priority: "high",
        reason: "Request/Response transformation",
      },
      // Normal: DTOs and pipes
      {
        pattern: /\.(dto|pipe)\.ts$/,
        priority: "normal",
        reason: "Data transfer/validation",
      },
      // Normal: Modules
      {
        pattern: /\.module\.ts$/,
        priority: "normal",
        reason: "Module definition",
      },
      ...super.getPriorityRules(),
    ];
  }

  isCriticalModule(filePath: string): boolean {
    if (super.isCriticalModule(filePath)) return true;
    const nestjsCriticalPatterns = [
      /\/(auth|security|payments|billing)\//,
      /\.(guard|middleware)\.ts$/,
      /auth\.(controller|service)\.ts$/,
    ];
    return nestjsCriticalPatterns.some((p) => p.test(filePath));
  }

  extractContextFlags(files: string[]): ContextFlags {
    const baseFlags = super.extractContextFlags(files);
    
    return {
      ...baseFlags,
      controllersChanged: files.some((f) => f.includes(".controller.ts")),
      guardsChanged: files.some((f) => f.includes(".guard.ts")),
      modulesChanged: files.some((f) => f.includes(".module.ts")),
      entitiesChanged: files.some((f) => f.includes(".entity.ts")),
    };
  }
}
