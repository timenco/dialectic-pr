import { FalsePositivePattern } from "../core/types.js";

/**
 * Built-in False Positive Patterns
 * TypeScript/JavaScript 생태계에서 흔히 발생하는 False Positive 패턴들
 */
export const BUILTIN_PATTERNS: FalsePositivePattern[] = [
  // ============================================================================
  // SQL Injection & Database
  // ============================================================================
  {
    id: "prisma-tagged-template-safe",
    category: "sql-injection",
    pattern: /\$executeRaw`.*\$\{.*\}`/,
    explanation:
      "Prisma tagged template literals auto-escape all ${} values, preventing SQL injection",
    severity: "critical",
    falsePositiveIndicators: [
      "SQL Injection in Prisma $executeRaw",
      "parameter binding bypass",
      "constant directly inserted",
      "unsafe raw query",
    ],
  },
  {
    id: "prisma-queryraw-safe",
    category: "sql-injection",
    pattern: /\$queryRaw`.*\$\{.*\}`/,
    explanation: "Prisma $queryRaw with tagged template is parameterized and safe",
    severity: "critical",
    falsePositiveIndicators: [
      "SQL injection in queryRaw",
      "unparameterized query",
    ],
  },
  {
    id: "typeorm-query-builder",
    category: "sql-injection",
    explanation:
      "TypeORM QueryBuilder with parameters (:param) is safe from SQL injection",
    falsePositiveIndicators: [
      "SQL injection in QueryBuilder",
      "unsanitized input in query",
    ],
  },
  {
    id: "knex-parameterized",
    category: "sql-injection",
    explanation: "Knex.js with ? placeholders or object syntax is parameterized",
    falsePositiveIndicators: [
      "SQL injection in Knex query",
      "raw SQL vulnerability",
    ],
  },

  // ============================================================================
  // Error Handling
  // ============================================================================
  {
    id: "nestjs-throw-error-with-filter",
    category: "error-handling",
    explanation:
      "AllExceptionsFilter in NestJS converts all errors to proper HTTP responses without exposing internals",
    contextRequired: ["AllExceptionsFilter", "common/filters"],
    severity: "high",
    falsePositiveIndicators: [
      "throw new Error should be InternalServerErrorException",
      "DB error exposure risk",
      "internal error leaked to client",
    ],
  },
  {
    id: "express-error-middleware",
    category: "error-handling",
    explanation:
      "Express error middleware with 4 parameters handles errors centrally",
    falsePositiveIndicators: [
      "unhandled error in route",
      "error not caught",
      "missing error handling",
    ],
  },
  {
    id: "async-error-wrapper",
    category: "error-handling",
    explanation:
      "Async error wrapper utilities (express-async-handler, catchAsync) handle promise rejections",
    falsePositiveIndicators: [
      "unhandled promise rejection",
      "missing try-catch in async",
      "promise rejection not handled",
    ],
  },
  {
    id: "intentional-throw",
    category: "error-handling",
    explanation:
      "Throwing errors in validation or business logic is intentional control flow",
    falsePositiveIndicators: [
      "should not throw here",
      "use return instead of throw",
    ],
  },

  // ============================================================================
  // Dependency Injection
  // ============================================================================
  {
    id: "nestjs-constructor-di",
    category: "dependency-injection",
    explanation:
      "NestJS manages DI lifecycle; 'new' keyword is intentional for DTOs, entities, and value objects",
    falsePositiveIndicators: [
      "should use dependency injection instead of new",
      "tight coupling with new keyword",
      "manual instantiation anti-pattern",
    ],
  },
  {
    id: "nestjs-inject-decorator",
    category: "dependency-injection",
    explanation: "@Inject() for custom providers and tokens is correct NestJS pattern",
    falsePositiveIndicators: [
      "use constructor injection",
      "@Inject is unnecessary",
    ],
  },
  {
    id: "inversify-inject",
    category: "dependency-injection",
    explanation: "InversifyJS @inject decorators are standard DI pattern",
    falsePositiveIndicators: [
      "avoid decorator injection",
      "use constructor params",
    ],
  },

  // ============================================================================
  // Logging
  // ============================================================================
  {
    id: "nestjs-logger-pattern",
    category: "logging",
    explanation:
      "Logger with constructor name (new Logger(ClassName.name)) is standard NestJS pattern",
    falsePositiveIndicators: [
      "Logger should not use DI",
      "new Logger(ClassName.name) is anti-pattern",
      "should inject Logger",
    ],
  },
  {
    id: "console-in-cli",
    category: "logging",
    explanation: "console.log in CLI tools and scripts is acceptable and intentional",
    falsePositiveIndicators: [
      "remove console.log",
      "use proper logger instead of console",
      "console statement should be removed",
    ],
  },
  {
    id: "debug-logging",
    category: "logging",
    explanation: "Debug logging statements may be intentional for development",
    falsePositiveIndicators: [
      "debug log should be removed",
      "verbose logging unnecessary",
    ],
  },

  // ============================================================================
  // Authentication & Security
  // ============================================================================
  {
    id: "jwt-secret-env",
    category: "authentication",
    explanation: "JWT secrets loaded from environment variables are secure",
    falsePositiveIndicators: [
      "hardcoded JWT secret",
      "secret should not be in code",
    ],
  },
  {
    id: "bcrypt-rounds",
    category: "authentication",
    explanation: "bcrypt with 10-12 rounds is industry standard",
    falsePositiveIndicators: [
      "insufficient hash rounds",
      "weak password hashing",
    ],
  },
  {
    id: "auth-decorator",
    category: "authentication",
    explanation: "Custom auth decorators (@Auth, @Public) are valid patterns",
    falsePositiveIndicators: [
      "missing authentication check",
      "unprotected endpoint",
    ],
  },

  // ============================================================================
  // Validation
  // ============================================================================
  {
    id: "class-validator-dto",
    category: "validation",
    explanation: "class-validator decorators on DTOs handle input validation",
    falsePositiveIndicators: [
      "missing input validation",
      "unvalidated user input",
      "should validate input",
    ],
  },
  {
    id: "zod-schema",
    category: "validation",
    explanation: "Zod schemas provide runtime type validation",
    falsePositiveIndicators: [
      "type not validated at runtime",
      "missing validation",
    ],
  },
  {
    id: "joi-schema",
    category: "validation",
    explanation: "Joi schemas validate input data",
    falsePositiveIndicators: [
      "input not validated",
      "missing schema validation",
    ],
  },

  // ============================================================================
  // TypeScript Specific
  // ============================================================================
  {
    id: "ts-any-intentional",
    category: "validation",
    explanation:
      "Some 'any' types are intentional for third-party lib compatibility or dynamic data",
    falsePositiveIndicators: [
      "should not use any",
      "replace any with proper type",
      "any is dangerous",
      "avoid using any",
    ],
  },
  {
    id: "ts-type-assertion",
    category: "validation",
    explanation:
      "Type assertions (as X) may be intentional for known-safe type narrowing",
    falsePositiveIndicators: [
      "avoid type assertions",
      "type assertion is unsafe",
      "use type guard instead",
    ],
  },
  {
    id: "ts-non-null-assertion",
    category: "validation",
    explanation:
      "Non-null assertion (!) may be valid when nullability is guaranteed by prior checks",
    falsePositiveIndicators: [
      "avoid non-null assertion",
      "! operator is dangerous",
      "use optional chaining",
    ],
  },
  {
    id: "ts-empty-interface",
    category: "validation",
    explanation:
      "Empty interfaces may be intentional for future extension or type branding",
    falsePositiveIndicators: [
      "empty interface",
      "interface has no members",
    ],
  },

  // ============================================================================
  // React Specific
  // ============================================================================
  {
    id: "react-empty-deps",
    category: "validation",
    explanation:
      "Empty dependency array [] is correct for mount-only effects",
    falsePositiveIndicators: [
      "missing dependencies in useEffect",
      "empty dependency array",
      "exhaustive deps warning",
    ],
  },
  {
    id: "react-memo-optimization",
    category: "performance",
    explanation: "React.memo is a valid performance optimization pattern",
    falsePositiveIndicators: [
      "unnecessary memo",
      "premature optimization",
      "memo is not needed",
    ],
  },
  {
    id: "react-index-key-static",
    category: "validation",
    explanation:
      "Index as key is acceptable for static, non-reorderable lists",
    falsePositiveIndicators: [
      "don't use index as key",
      "index key is anti-pattern",
    ],
  },
  {
    id: "react-eslint-disable",
    category: "validation",
    explanation:
      "eslint-disable comments for hooks deps may be intentional",
    falsePositiveIndicators: [
      "remove eslint-disable",
      "fix the underlying issue",
    ],
  },

  // ============================================================================
  // Next.js Specific
  // ============================================================================
  {
    id: "nextjs-server-component",
    category: "validation",
    explanation:
      "Async Server Components without useEffect are the correct Next.js 13+ pattern",
    falsePositiveIndicators: [
      "async component without useEffect",
      "should use useEffect for data",
      "missing loading state",
    ],
  },
  {
    id: "nextjs-use-client",
    category: "validation",
    explanation: "'use client' directive marks intentional client components",
    falsePositiveIndicators: [
      "use client unnecessary",
      "should be server component",
    ],
  },
  {
    id: "nextjs-default-export",
    category: "validation",
    explanation:
      "Default exports for pages/layouts are required Next.js convention",
    falsePositiveIndicators: [
      "prefer named exports",
      "default export anti-pattern",
    ],
  },

  // ============================================================================
  // Express Specific
  // ============================================================================
  {
    id: "express-middleware-order",
    category: "validation",
    explanation: "Middleware order is intentional architecture decision",
    falsePositiveIndicators: [
      "middleware order wrong",
      "reorder middleware",
      "incorrect placement",
    ],
  },
  {
    id: "express-error-handler-params",
    category: "error-handling",
    explanation:
      "Error handler with 4 params (err, req, res, next) is Express convention",
    falsePositiveIndicators: [
      "unused next parameter",
      "unused error parameter",
    ],
  },
  {
    id: "express-res-json-return",
    category: "validation",
    explanation:
      "res.json() without explicit return is valid when it's the last statement",
    falsePositiveIndicators: [
      "missing return before res",
      "should return res.json",
    ],
  },
];

/**
 * Get built-in patterns by category
 */
export function getPatternsByCategory(
  category: FalsePositivePattern["category"]
): FalsePositivePattern[] {
  return BUILTIN_PATTERNS.filter((p) => p.category === category);
}

/**
 * Get pattern by ID
 */
export function getPatternById(id: string): FalsePositivePattern | undefined {
  return BUILTIN_PATTERNS.find((p) => p.id === id);
}

/**
 * Get all pattern IDs
 */
export function getAllPatternIds(): string[] {
  return BUILTIN_PATTERNS.map((p) => p.id);
}
