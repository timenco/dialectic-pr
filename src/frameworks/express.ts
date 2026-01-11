import { FalsePositivePattern, PriorityRule } from "../core/types.js";
import { BaseFramework, FrameworkContextFlags } from "./base-framework.js";

/**
 * Express Framework Implementation
 * Express 프로젝트에 특화된 리뷰 룰과 패턴
 */
export class ExpressFramework extends BaseFramework {
  readonly name = "express" as const;

  getReviewInstructions(): string {
    return `
FRAMEWORK: Express
BEST_PRACTICES:
  middleware:
    - correct_order: true
    - error_handlers_last: true
    - use_next_properly: true
  async_handling:
    - use_async_await_with_try_catch: true
    - or_use_error_middleware: true
    - wrap_async_handlers: true
  validation:
    - validate_all_user_input: true
    - sanitize_inputs: true
    - use_validation_libraries: [joi, zod, express-validator]
  security:
    - use_helmet: true
    - implement_rate_limiting: true
    - prevent_injection: true
    - cors_configuration: proper
  routing:
    - use_router_for_modular_routes: true
    - restful_conventions: follow
  error_handling:
    - centralized_error_handler: true
    - dont_expose_stack_traces: true
COMMON_FALSE_POSITIVES:
  - middleware order is intentional architecture
  - custom error handler is standard pattern
  - next() call pattern is correct
  - async wrapper utility handles errors
  - response.json() without explicit return is valid
`.trim();
  }

  getFalsePositivePatterns(): FalsePositivePattern[] {
    return [
      ...super.getFalsePositivePatterns(),
      {
        id: "express-middleware-order",
        category: "validation",
        explanation: "Middleware order is intentional and architecture-specific",
        falsePositiveIndicators: [
          "middleware order is wrong",
          "should reorder middleware",
          "incorrect middleware placement",
        ],
      },
      {
        id: "express-error-handler",
        category: "error-handling",
        explanation: "Custom error handler with 4 params (err, req, res, next) is standard",
        falsePositiveIndicators: [
          "unused next parameter",
          "error handler signature",
        ],
      },
      {
        id: "express-async-wrapper",
        category: "error-handling",
        explanation: "Async wrapper utilities (express-async-handler) handle errors",
        falsePositiveIndicators: [
          "unhandled promise rejection",
          "missing try-catch in async handler",
        ],
      },
      {
        id: "express-response-json",
        category: "validation",
        explanation: "res.json() without return is valid when it's the last statement",
        falsePositiveIndicators: [
          "missing return before res.json",
          "should return res.json",
        ],
      },
      {
        id: "express-next-call",
        category: "validation",
        explanation: "next() call pattern for middleware chaining is correct",
        falsePositiveIndicators: [
          "next() called unnecessarily",
          "should not call next",
        ],
      },
    ];
  }

  detectAffectedAreas(files: string[]): string[] {
    const areas = super.detectAffectedAreas(files);

    // Express-specific areas
    if (files.some((f) => f.includes("/routes/") || f.includes(".routes."))) {
      areas.push("🛤️ Routes");
    }
    if (files.some((f) => f.includes("/middleware/") || f.includes(".middleware."))) {
      areas.push("🔧 Middleware");
    }
    if (files.some((f) => f.includes("/controllers/") || f.includes(".controller."))) {
      areas.push("🎮 Controllers");
    }
    if (files.some((f) => f.includes("/services/") || f.includes(".service."))) {
      areas.push("⚙️ Services");
    }
    if (files.some((f) => f.includes("/models/") || f.includes(".model."))) {
      areas.push("📊 Models");
    }
    if (files.some((f) => f.includes("/validators/") || f.includes(".validator."))) {
      areas.push("✅ Validators");
    }

    return [...new Set(areas)];
  }

  getPriorityRules(): PriorityRule[] {
    return [
      // Critical: Auth middleware and security
      {
        pattern: /\/(auth|security)\/.*\.(ts|js)$/,
        priority: "critical",
        reason: "Auth/Security",
      },
      {
        pattern: /auth\.middleware\.(ts|js)$/,
        priority: "critical",
        reason: "Auth middleware",
      },
      // High: Routes and controllers
      {
        pattern: /\/routes\/.*\.(ts|js)$/,
        priority: "high",
        reason: "Route definitions",
      },
      {
        pattern: /\.routes?\.(ts|js)$/,
        priority: "high",
        reason: "Route file",
      },
      {
        pattern: /\/controllers\/.*\.(ts|js)$/,
        priority: "high",
        reason: "Controller",
      },
      // High: Middleware
      {
        pattern: /\/middleware\/.*\.(ts|js)$/,
        priority: "high",
        reason: "Middleware",
      },
      // High: Services
      {
        pattern: /\/services\/.*\.(ts|js)$/,
        priority: "high",
        reason: "Service layer",
      },
      // Normal: Models and validators
      {
        pattern: /\/models\/.*\.(ts|js)$/,
        priority: "normal",
        reason: "Data model",
      },
      {
        pattern: /\/validators\/.*\.(ts|js)$/,
        priority: "normal",
        reason: "Validator",
      },
      ...super.getPriorityRules(),
    ];
  }

  isCriticalModule(filePath: string): boolean {
    const expressCriticalPatterns = [
      /\/(auth|security)\//,
      /auth\.middleware/,
      /security\.middleware/,
      /rate[-_]?limit/,
    ];
    return expressCriticalPatterns.some((p) => p.test(filePath));
  }

  extractContextFlags(files: string[]): FrameworkContextFlags {
    const baseFlags = super.extractContextFlags(files);
    
    return {
      ...baseFlags,
      routesChanged: files.some((f) => f.includes("/routes/") || f.includes(".routes.")),
      middlewareChanged: files.some((f) => f.includes("/middleware/") || f.includes(".middleware.")),
      controllersChanged: files.some((f) => f.includes("/controllers/") || f.includes(".controller.")),
      servicesChanged: files.some((f) => f.includes("/services/") || f.includes(".service.")),
    };
  }
}
