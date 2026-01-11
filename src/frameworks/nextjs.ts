import { FalsePositivePattern, PriorityRule } from "../core/types.js";
import { BaseFramework, FrameworkContextFlags } from "./base-framework.js";

/**
 * Next.js Framework Implementation
 * Next.js 프로젝트에 특화된 리뷰 룰과 패턴
 */
export class NextJSFramework extends BaseFramework {
  readonly name = "nextjs" as const;

  getReviewInstructions(): string {
    return `
FRAMEWORK: Next.js
BEST_PRACTICES:
  components:
    - prefer_server_components: true
    - mark_client_components_explicitly: true
    - avoid_unnecessary_use_client: true
  data_fetching:
    - use_async_server_components: true
    - avoid_useeffect_for_data: true
    - use_server_actions_for_mutations: true
  api_routes:
    - validate_all_input: true
    - use_proper_http_status_codes: true
    - handle_errors_gracefully: true
  optimization:
    - use_next_image: true
    - check_client_js_bundle_size: true
    - use_dynamic_imports_for_heavy_components: true
  routing:
    - use_app_router_conventions: true
    - proper_loading_and_error_boundaries: true
  metadata:
    - use_generateMetadata_for_seo: true
COMMON_FALSE_POSITIVES:
  - async Server Components without useEffect is correct
  - "use client" directive is intentional marking
  - default export for pages is required convention
  - Server Actions (use server) are intentional
  - Dynamic route params typing is Next.js pattern
`.trim();
  }

  getFalsePositivePatterns(): FalsePositivePattern[] {
    return [
      ...super.getFalsePositivePatterns(),
      {
        id: "nextjs-server-component-async",
        category: "validation",
        explanation: "Async Server Components are the recommended pattern in Next.js 13+",
        falsePositiveIndicators: [
          "async component without useEffect",
          "await in component body",
          "should use useEffect for data fetching",
        ],
      },
      {
        id: "nextjs-use-client-directive",
        category: "validation",
        explanation: "'use client' marks intentional client components",
        falsePositiveIndicators: [
          "use client is unnecessary",
          "should be server component",
        ],
      },
      {
        id: "nextjs-default-export",
        category: "validation",
        explanation: "Pages and layouts require default exports in Next.js",
        falsePositiveIndicators: [
          "prefer named exports",
          "default export is anti-pattern",
        ],
      },
      {
        id: "nextjs-server-action",
        category: "validation",
        explanation: "'use server' directive for Server Actions is correct",
        falsePositiveIndicators: [
          "use server is unknown",
          "invalid directive",
        ],
      },
      {
        id: "nextjs-image-component",
        category: "performance",
        explanation: "next/image is the optimized way to handle images",
        falsePositiveIndicators: [
          "should use native img",
          "next/image is overkill",
        ],
      },
    ];
  }

  detectAffectedAreas(files: string[]): string[] {
    const areas = super.detectAffectedAreas(files);

    // Next.js-specific areas
    if (files.some((f) => f.includes("/api/") || f.includes("/route."))) {
      areas.push("🔌 API Routes");
    }
    if (files.some((f) => f.includes("page.tsx") || f.includes("page.ts"))) {
      areas.push("📄 Pages");
    }
    if (files.some((f) => f.includes("layout.tsx") || f.includes("layout.ts"))) {
      areas.push("🎨 Layouts");
    }
    if (files.some((f) => f.includes("/components/"))) {
      areas.push("🧩 Components");
    }
    if (files.some((f) => f.includes("loading.tsx") || f.includes("error.tsx"))) {
      areas.push("⏳ Loading/Error States");
    }
    if (files.some((f) => f.includes("middleware.ts"))) {
      areas.push("🔧 Middleware");
    }
    if (files.some((f) => f.includes("/actions/") || f.includes(".action.ts"))) {
      areas.push("⚡ Server Actions");
    }

    return [...new Set(areas)];
  }

  getPriorityRules(): PriorityRule[] {
    return [
      // Critical: API endpoints
      {
        pattern: /\/api\/.*\.(ts|js)$/,
        priority: "critical",
        reason: "API endpoint",
      },
      {
        pattern: /route\.(ts|js)$/,
        priority: "critical",
        reason: "Route handler",
      },
      // Critical: Auth-related
      {
        pattern: /\/auth\/.*\.(tsx?|jsx?)$/,
        priority: "critical",
        reason: "Auth logic",
      },
      // Critical: Middleware
      {
        pattern: /middleware\.(ts|js)$/,
        priority: "critical",
        reason: "Middleware",
      },
      // High: Pages and layouts
      {
        pattern: /page\.(tsx|ts|jsx|js)$/,
        priority: "high",
        reason: "Page component",
      },
      {
        pattern: /layout\.(tsx|ts|jsx|js)$/,
        priority: "high",
        reason: "Layout component",
      },
      // High: Server actions
      {
        pattern: /\.action\.(ts|js)$/,
        priority: "high",
        reason: "Server Action",
      },
      // Normal: Components
      {
        pattern: /\/components\/.*\.(tsx|jsx)$/,
        priority: "normal",
        reason: "Component",
      },
      ...super.getPriorityRules(),
    ];
  }

  isCriticalModule(filePath: string): boolean {
    const nextjsCriticalPatterns = [
      /\/api\//,
      /route\.(ts|js)$/,
      /middleware\.(ts|js)$/,
      /\/auth\//,
    ];
    return nextjsCriticalPatterns.some((p) => p.test(filePath));
  }

  extractContextFlags(files: string[]): FrameworkContextFlags {
    const baseFlags = super.extractContextFlags(files);
    
    return {
      ...baseFlags,
      apiRoutesChanged: files.some((f) => f.includes("/api/") || f.includes("route.")),
      pagesChanged: files.some((f) => f.includes("page.")),
      layoutsChanged: files.some((f) => f.includes("layout.")),
      middlewareChanged: files.some((f) => f.includes("middleware.")),
      serverActionsChanged: files.some((f) => f.includes(".action.") || f.includes("/actions/")),
    };
  }
}
