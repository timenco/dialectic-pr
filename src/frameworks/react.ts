import { ContextFlags, FalsePositivePattern, PriorityRule } from "../core/types.js";
import { BaseFramework } from "./base-framework.js";

/**
 * React Framework Implementation
 * React 프로젝트에 특화된 리뷰 룰과 패턴
 */
export class ReactFramework extends BaseFramework {
  readonly name = "react" as const;

  getReviewInstructions(): string {
    return `
FRAMEWORK: React
BEST_PRACTICES:
  waterfalls_and_async: [CRITICAL]
    - defer_await_until_needed: true
    - parallelize_independent_operations: true
  bundle_size: [CRITICAL]
    - avoid_barrel_file_imports: true
    - dynamic_imports_for_heavy_components: true
  hooks:
    - follow_rules_of_hooks: true
    - include_all_dependencies: true
    - cleanup_effects: true
    - avoid_unnecessary_effects: true
    - narrow_effect_dependencies: true
    - interaction_logic_in_event_handlers: true
  performance:
    - use_memo_appropriately: true
    - use_callback_for_child_optimization: true
    - avoid_inline_object_creation_in_render: true
    - dont_define_components_inside_components: true
    - use_functional_setState: true
    - use_lazy_state_initialization: true
    - use_transitions_for_non_urgent_updates: true
    - use_virtualization_for_long_lists: true
  rendering:
    - hoist_static_jsx_outside_component: true
    - use_explicit_conditional_rendering: true
    - prevent_hydration_mismatch: true
  state:
    - colocate_state: true
    - lift_when_needed: true
    - avoid_prop_drilling_with_context: true
    - calculate_derived_state_during_render: true
  lists:
    - stable_unique_keys: true
    - avoid_index_as_key_for_dynamic_lists: true
  components:
    - prefer_composition_over_inheritance: true
    - single_responsibility: true
    - controlled_vs_uncontrolled: be_consistent
  js_performance:
    - use_set_map_for_O1_lookups: true
    - avoid_layout_thrashing: true
    - hoist_regexp_creation: true
COMMON_FALSE_POSITIVES:
  - intentional dependency omissions with eslint-disable
  - memo usage is performance optimization
  - empty dependency array for mount-only effects is correct
  - useCallback for event handlers passed to children is valid
  - index as key is acceptable for static lists
  - simple expressions do not need useMemo
  - internal module barrel imports have minimal impact
  - deriving state during render is correct pattern
`.trim();
  }

  getFalsePositivePatterns(): FalsePositivePattern[] {
    return [
      {
        id: "react-empty-deps-array",
        category: "validation",
        explanation: "Empty dependency array is correct for mount-only effects",
        falsePositiveIndicators: [
          "missing dependencies in useEffect",
          "empty dependency array",
          "should include all dependencies",
        ],
      },
      {
        id: "react-memo-usage",
        category: "validation",
        explanation: "React.memo is a valid performance optimization pattern",
        falsePositiveIndicators: [
          "unnecessary memo",
          "premature optimization",
          "memo is not needed",
        ],
      },
      {
        id: "react-use-callback",
        category: "validation",
        explanation: "useCallback prevents unnecessary re-renders of child components",
        falsePositiveIndicators: [
          "useCallback is unnecessary",
          "inline function is fine",
        ],
      },
      {
        id: "react-eslint-disable-deps",
        category: "validation",
        explanation: "eslint-disable for exhaustive-deps may be intentional",
        falsePositiveIndicators: [
          "remove eslint-disable",
          "fix dependency array",
        ],
      },
      {
        id: "react-simple-usememo",
        category: "performance",
        explanation: "Simple expressions (primitives, short calculations) do not need useMemo wrapping",
        falsePositiveIndicators: [
          "wrap in useMemo",
          "memoize this value",
          "should use useMemo",
        ],
      },
      {
        id: "react-barrel-import-internal",
        category: "performance",
        explanation: "Barrel imports from internal modules have minimal bundle impact when tree-shaking is configured",
        falsePositiveIndicators: [
          "barrel import increases bundle",
          "import from barrel file",
          "re-export causes larger bundle",
        ],
      },
      {
        id: "react-derived-state",
        category: "validation",
        explanation: "Calculating derived state during render is the correct React pattern instead of using useEffect to sync state",
        falsePositiveIndicators: [
          "derive state in useEffect",
          "should store derived value in state",
          "missing state update for derived value",
        ],
      },
    ];
  }

  detectAffectedAreas(files: string[]): string[] {
    const areas = super.detectAffectedAreas(files);

    // React-specific areas
    if (files.some((f) => f.includes("/components/"))) {
      areas.push("🧩 Components");
    }
    if (files.some((f) => f.includes("/hooks/") || f.includes(".hook."))) {
      areas.push("🪝 Hooks");
    }
    if (files.some((f) => f.includes("/store/") || f.includes("/redux/") || f.includes("/zustand/"))) {
      areas.push("📦 State Management");
    }
    if (files.some((f) => f.includes("/context/") || f.includes(".context."))) {
      areas.push("🔄 Context");
    }
    if (files.some((f) => f.includes("/utils/") || f.includes("/helpers/"))) {
      areas.push("🔧 Utilities");
    }
    if (files.some((f) => f.includes("/services/") || f.includes("/api/"))) {
      areas.push("🌐 API/Services");
    }

    return [...new Set(areas)];
  }

  getPriorityRules(): PriorityRule[] {
    return [
      // Critical: Auth and security
      {
        pattern: /\/(auth|security)\//,
        priority: "critical",
        reason: "Security-critical",
      },
      // High: Custom hooks
      {
        pattern: /\/hooks\/.*\.(ts|tsx|js|jsx)$/,
        priority: "high",
        reason: "Custom hook",
      },
      {
        pattern: /\.hook\.(ts|tsx|js|jsx)$/,
        priority: "high",
        reason: "Custom hook",
      },
      // High: State management
      {
        pattern: /\/(store|redux|zustand)\//,
        priority: "high",
        reason: "State management",
      },
      // High: Context
      {
        pattern: /\/context\/.*\.(ts|tsx|js|jsx)$/,
        priority: "high",
        reason: "React Context",
      },
      // Normal: Components
      {
        pattern: /\/components\/.*\.(tsx|jsx)$/,
        priority: "normal",
        reason: "React component",
      },
      // Normal: Pages (for React Router based apps)
      {
        pattern: /\/pages\/.*\.(tsx|jsx)$/,
        priority: "normal",
        reason: "Page component",
      },
      ...super.getPriorityRules(),
    ];
  }

  isCriticalModule(filePath: string): boolean {
    if (super.isCriticalModule(filePath)) return true;
    const reactCriticalPatterns = [
      /\/(auth|security)\//,
      /AuthContext/,
      /useAuth/,
    ];
    return reactCriticalPatterns.some((p) => p.test(filePath));
  }

  extractContextFlags(files: string[]): ContextFlags {
    const baseFlags = super.extractContextFlags(files);
    
    return {
      ...baseFlags,
      hooksChanged: files.some((f) => f.includes("/hooks/") || f.includes(".hook.")),
      storeChanged: files.some((f) => 
        f.includes("/store/") || f.includes("/redux/") || f.includes("/zustand/")
      ),
      contextChanged: files.some((f) => f.includes("/context/") || f.includes(".context.")),
      componentsChanged: files.some((f) => f.includes("/components/")),
    };
  }
}
