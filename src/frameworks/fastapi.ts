import { ContextFlags, FalsePositivePattern, PriorityRule } from "../core/types.js";
import { BaseFramework } from "./base-framework.js";

/**
 * FastAPI Framework Implementation
 * Python/FastAPI 프로젝트에 특화된 리뷰 룰과 패턴
 */
export class FastAPIFramework extends BaseFramework {
  readonly name = "fastapi" as const;

  getReviewInstructions(): string {
    return `
FRAMEWORK: FastAPI (Python)
BEST_PRACTICES:
  async:
    - use_async_def_for_io_endpoints: true
    - use_sync_def_for_cpu_bound: true
    - avoid_blocking_calls_in_async: true
  dependency_injection:
    - use_depends_for_di: true
    - avoid_global_state: true
    - compose_dependencies: true
  validation:
    - use_pydantic_models: true
    - validate_request_body_with_basemodel: true
    - use_field_validators: true
  database:
    - use_sqlalchemy_sessions_via_depends: true
    - avoid_raw_sql_without_parameterization: true
    - use_alembic_for_migrations: true
  error_handling:
    - raise_httpexception_with_status_codes: true
    - use_exception_handlers: true
    - dont_expose_internal_errors: true
  security:
    - validate_auth_tokens: true
    - use_depends_for_auth: true
    - implement_rate_limiting: true
COMMON_FALSE_POSITIVES:
  - Pydantic class attributes are not unused variables
  - Depends() injection parameter is intentional pattern
  - async def without await is valid for FastAPI route handlers
  - SQLAlchemy text() is safe with bound parameters
  - os.environ at module level is standard configuration pattern
  - bare except with logging is acceptable in background tasks
`.trim();
  }

  getFalsePositivePatterns(): FalsePositivePattern[] {
    return [
      {
        id: "pydantic-class-attrs",
        category: "validation",
        explanation: "Pydantic model class attributes define schema, not unused variables",
        falsePositiveIndicators: [
          "unused class attribute",
          "class variable never used",
          "field defined but not referenced",
        ],
      },
      {
        id: "depends-di",
        category: "dependency-injection",
        explanation: "FastAPI Depends() is the standard DI mechanism",
        falsePositiveIndicators: [
          "unused function parameter",
          "parameter assigned but not used",
          "Depends should be called directly",
        ],
      },
      {
        id: "async-no-await",
        category: "performance",
        explanation: "FastAPI async route handlers don't always need await - framework handles them",
        falsePositiveIndicators: [
          "async function without await",
          "unnecessary async",
          "should be sync function",
        ],
      },
      {
        id: "sqlalchemy-text",
        category: "sql-injection",
        explanation: "SQLAlchemy text() with bound parameters is safe from SQL injection",
        falsePositiveIndicators: [
          "raw SQL query",
          "SQL injection risk with text()",
          "use ORM instead of raw SQL",
        ],
      },
      {
        id: "os-environ-module",
        category: "performance",
        explanation: "os.environ at module level is standard Python configuration pattern",
        falsePositiveIndicators: [
          "os.environ should not be at module level",
          "environment variable read at import time",
        ],
      },
      {
        id: "bare-except-logging",
        category: "error-handling",
        explanation: "Bare except with logging is acceptable in background tasks and cleanup code",
        falsePositiveIndicators: [
          "bare except clause",
          "too broad exception clause",
          "catch specific exceptions",
        ],
      },
    ];
  }

  detectAffectedAreas(files: string[]): string[] {
    const areas = super.detectAffectedAreas(files);

    // FastAPI-specific areas
    if (files.some((f) => f.includes("/routers/") || f.includes("/routes/") || f.includes("/endpoints/"))) {
      areas.push("🛤️ API Endpoints");
    }
    if (files.some((f) => f.includes("/agent/") || f.includes("agent.py"))) {
      areas.push("🤖 AI Agent");
    }
    if (files.some((f) => f.includes("/clients/") || f.includes("client.py"))) {
      areas.push("🔗 External Clients");
    }
    if (files.some((f) => f.includes("/models/") || f.includes("/schemas/") || f.includes("models.py") || f.includes("schemas.py"))) {
      areas.push("📊 Data Models");
    }
    if (files.some((f) => f.includes("/dependencies/") || f.includes("deps.py"))) {
      areas.push("💉 Dependencies");
    }
    if (files.some((f) => f.includes("/crud/") || f.includes("crud.py"))) {
      areas.push("🗄️ CRUD");
    }

    return [...new Set(areas)];
  }

  getPriorityRules(): PriorityRule[] {
    return [
      // Critical: Auth/security
      {
        pattern: /\/(auth|security|permissions)\//,
        priority: "critical",
        reason: "Auth/Security",
      },
      {
        pattern: /middleware\.py$/,
        priority: "critical",
        reason: "Middleware",
      },
      // High: API routes and agent
      {
        pattern: /\/routers\/.*\.py$/,
        priority: "high",
        reason: "API router",
      },
      {
        pattern: /\/routes\/.*\.py$/,
        priority: "high",
        reason: "API route",
      },
      {
        pattern: /\/endpoints\/.*\.py$/,
        priority: "high",
        reason: "API endpoint",
      },
      {
        pattern: /\/agent\/.*\.py$/,
        priority: "high",
        reason: "AI Agent logic",
      },
      {
        pattern: /main\.py$/,
        priority: "high",
        reason: "Application entry point",
      },
      // High: Dependencies and services
      {
        pattern: /\/dependencies\/.*\.py$/,
        priority: "high",
        reason: "DI dependency",
      },
      {
        pattern: /\/services\/.*\.py$/,
        priority: "high",
        reason: "Service layer",
      },
      // Normal: Models, schemas, CRUD
      {
        pattern: /\/models\/.*\.py$/,
        priority: "normal",
        reason: "Data model",
      },
      {
        pattern: /\/schemas\/.*\.py$/,
        priority: "normal",
        reason: "Pydantic schema",
      },
      {
        pattern: /\/crud\/.*\.py$/,
        priority: "normal",
        reason: "CRUD operation",
      },
      // Low: Tests
      {
        pattern: /test_.*\.py$/,
        priority: "low",
        reason: "Test file",
      },
      {
        pattern: /_test\.py$/,
        priority: "low",
        reason: "Test file",
      },
      {
        pattern: /conftest\.py$/,
        priority: "low",
        reason: "Test fixture",
      },
      ...super.getPriorityRules(),
    ];
  }

  isCriticalModule(filePath: string): boolean {
    if (super.isCriticalModule(filePath)) return true;
    const fastapiCriticalPatterns = [
      /\/(auth|security|permissions)\//,
      /middleware\.py$/,
    ];
    return fastapiCriticalPatterns.some((p) => p.test(filePath));
  }

  extractContextFlags(files: string[]): ContextFlags {
    const baseFlags = super.extractContextFlags(files);

    return {
      ...baseFlags,
      apiEndpointsChanged: files.some((f) =>
        f.includes("/routers/") || f.includes("/routes/") || f.includes("/endpoints/")
      ),
      agentChanged: files.some((f) =>
        f.includes("/agent/") || f.includes("agent.py")
      ),
    };
  }
}
