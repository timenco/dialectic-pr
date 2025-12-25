# CONSENSUS PROMPT SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - core/types.spec.md
external:
  - "@anthropic-ai/sdk": "^0.30.0"
```

## FILE_PATH
```
src/core/consensus-engine.ts (buildMultiPersonaPrompt method)
```

## CLAUDE_API_FEATURES_REQUIRED
```yaml
prompt_caching:
  enabled: true
  cache_breakpoints: ["system_instructions", "fp_patterns", "framework_instructions"]
  ttl: 300s

extended_thinking:
  enabled: true
  budget_tokens: 2000
  
json_mode:
  enabled: true
  schema_enforcement: strict
```

## PROMPT_STRUCTURE

### SYSTEM_MESSAGE (cacheable)
```typescript
interface SystemMessage {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

const systemMessages: SystemMessage[] = [
  {
    type: "text",
    text: AGENT_CONSENSUS_INSTRUCTIONS,
    cache_control: { type: "ephemeral" }
  },
  {
    type: "text", 
    text: formatFPPatterns(fpPatterns),
    cache_control: { type: "ephemeral" }
  },
  {
    type: "text",
    text: getFrameworkInstructions(framework),
    cache_control: { type: "ephemeral" }
  }
];
```

### AGENT_CONSENSUS_INSTRUCTIONS
```typescript
const AGENT_CONSENSUS_INSTRUCTIONS = `
SYSTEM: Multi-Persona Code Review

PERSONA_HAWK:
  role: critical_reviewer
  objectives:
    - identify_potential_issues: [bugs, security_vulnerabilities, edge_cases]
    - focus_areas: [error_handling, type_safety, async_operations]
    - output: list_of_concerns

PERSONA_OWL:
  role: pragmatic_validator
  objectives:
    - validate_hawk_concerns: true
    - filter_criteria:
      - check_false_positive_patterns: true
      - evaluate_roi: true
      - assess_production_impact: true
    - output: filtered_actionable_issues

CONSENSUS_PROCESS:
  step_1:
    actor: HAWK
    action: analyze_diff
    output: potential_issues[]
  
  step_2:
    actor: OWL
    action: validate_each_issue
    criteria:
      - NOT in false_positive_patterns
      - production_bug_prevention: true
      - high_confidence: true
      - high_roi: true
    output: consensus_issues[]
  
  step_3:
    action: report_only_consensus_issues
    format: json_schema

QUALITY_OVER_QUANTITY: true
ACTIONABLE_FEEDBACK_ONLY: true
`.trim();
```

### FALSE_POSITIVE_PATTERNS_FORMAT
```typescript
function formatFPPatterns(patterns: FalsePositivePattern[]): string {
  if (patterns.length === 0) return "FALSE_POSITIVE_PATTERNS: none";
  
  return `FALSE_POSITIVE_PATTERNS:
${patterns.map(p => `
- id: ${p.id}
  category: ${p.category}
  explanation: ${p.explanation}
  ignore_if_review_contains: ${JSON.stringify(p.falsePositiveIndicators)}
`).join('\n')}`;
}
```

### FRAMEWORK_INSTRUCTIONS_MAP
```typescript
const FRAMEWORK_INSTRUCTIONS: Record<FrameworkName, string> = {
  nestjs: `
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
COMMON_FALSE_POSITIVES:
  - "throw new Error" is acceptable with AllExceptionsFilter
  - "new" keyword is intentional for DTOs and entities
  - Logger dependency injection is project pattern
`,

  nextjs: `
FRAMEWORK: Next.js
BEST_PRACTICES:
  components:
    - prefer_server_components: true
    - mark_client_components_explicitly: true
  data_fetching:
    - use_async_server_components: true
    - avoid_useeffect_for_data: true
  api_routes:
    - validate_all_input: true
    - use_proper_http_status_codes: true
  optimization:
    - use_next_image: true
    - check_client_js_bundle_size: true
COMMON_FALSE_POSITIVES:
  - async Server Components without useEffect is correct
  - "use client" directive is intentional marking
`,

  react: `
FRAMEWORK: React
BEST_PRACTICES:
  hooks:
    - follow_rules_of_hooks: true
    - include_all_dependencies: true
    - cleanup_effects: true
  performance:
    - use_memo_appropriately: true
    - use_callback_for_child_optimization: true
  state:
    - colocate_state: true
    - lift_when_needed: true
  lists:
    - stable_unique_keys: true
COMMON_FALSE_POSITIVES:
  - intentional dependency omissions with eslint-disable
  - memo usage is performance optimization
`,

  express: `
FRAMEWORK: Express
BEST_PRACTICES:
  middleware:
    - correct_order: true
    - error_handlers_last: true
  async_handling:
    - use_async_await_with_try_catch: true
    - or_use_error_middleware: true
  validation:
    - validate_all_user_input: true
  security:
    - use_helmet: true
    - implement_rate_limiting: true
  routing:
    - use_router_for_modular_routes: true
COMMON_FALSE_POSITIVES:
  - middleware order is intentional architecture
  - custom error handler is standard pattern
`,

  vanilla: `
FRAMEWORK: TypeScript/JavaScript
BEST_PRACTICES:
  types:
    - avoid_any: true
    - use_proper_types: true
  async:
    - handle_promise_rejections: true
  errors:
    - throw_typed_errors: true
  null_safety:
    - check_null_undefined: true
`
};
```

### USER_MESSAGE (dynamic, not cached)
```typescript
function buildUserMessage(
  analysis: PRAnalysis,
  strategy: ReviewStrategy,
  projectConventions?: string
): string {
  return `
REVIEW_CONTEXT:
  framework: ${analysis.context.framework.name}
  version: ${analysis.context.framework.version || "unknown"}
  affected_areas: ${JSON.stringify(analysis.context.affectedAreas)}
  flags:
    critical_module: ${analysis.context.flags.criticalModule}
    test_changed: ${analysis.context.flags.testChanged}
    schema_changed: ${analysis.context.flags.schemaChanged}
    config_only: ${analysis.context.flags.configOnly}

STRATEGY: ${strategy.name}
INSTRUCTIONS: ${strategy.instructions}

${projectConventions ? `PROJECT_CONVENTIONS:\n${projectConventions}\n` : ''}

DIFF:
\`\`\`diff
${analysis.prioritizedDiff}
\`\`\`

OUTPUT_SCHEMA:
{
  "issues": [
    {
      "file": "string",
      "line": "number|undefined",
      "type": "bug|security|performance|maintainability",
      "confidence": "high|medium",
      "title": "string",
      "description": "string",
      "suggestion": "string|undefined"
    }
  ],
  "consensus": {
    "totalReviewed": "number",
    "issuesRaised": "number",
    "issuesFiltered": "number",
    "overallAssessment": "string"
  }
}

RESPOND_WITH_VALID_JSON_ONLY
`;
}
```

## CLAUDE_API_CALL_CONFIGURATION

```typescript
interface ClaudeCallConfig {
  model: "claude-sonnet-4-20250514";
  max_tokens: number; // from strategy
  temperature: 0;
  
  // Extended Thinking
  thinking: {
    type: "enabled";
    budget_tokens: 2000;
  };
  
  // JSON Mode
  response_format: {
    type: "json_schema";
    json_schema: {
      name: "code_review";
      strict: true;
      schema: {
        type: "object";
        properties: {
          issues: {
            type: "array";
            items: {
              type: "object";
              properties: {
                file: { type: "string" };
                line: { type: "number" };
                type: { 
                  type: "string";
                  enum: ["bug", "security", "performance", "maintainability"];
                };
                confidence: {
                  type: "string";
                  enum: ["high", "medium"];
                };
                title: { type: "string" };
                description: { type: "string" };
                suggestion: { type: "string" };
              };
              required: ["file", "type", "confidence", "title", "description"];
            };
          };
          consensus: {
            type: "object";
            properties: {
              totalReviewed: { type: "number" };
              issuesRaised: { type: "number" };
              issuesFiltered: { type: "number" };
              overallAssessment: { type: "string" };
            };
            required: ["totalReviewed", "issuesRaised", "issuesFiltered", "overallAssessment"];
          };
        };
        required: ["issues", "consensus"];
      };
    };
  };
  
  // Prompt Caching
  system: SystemMessage[];
  messages: [
    {
      role: "user";
      content: string;
    }
  ];
}
```

## CACHING_STRATEGY
```yaml
cache_breakpoints:
  1_agent_instructions:
    content: AGENT_CONSENSUS_INSTRUCTIONS
    cache: true
    ttl: 300s
    change_frequency: never
    
  2_fp_patterns:
    content: formatFPPatterns()
    cache: true
    ttl: 300s
    change_frequency: per_project
    
  3_framework_instructions:
    content: getFrameworkInstructions()
    cache: true
    ttl: 300s
    change_frequency: per_project

non_cached:
  - review_context
  - diff_content
  - project_conventions

expected_cache_hit_rate: 90%
expected_cost_reduction: 90%
```

## RESPONSE_PARSING
```typescript
function parseClaudeResponse(response: ClaudeResponse): ReviewResult {
  // With JSON mode, response.text is guaranteed valid JSON
  const parsed = JSON.parse(response.text);
  
  const issues: ReviewIssue[] = parsed.issues;
  
  const summary: ReviewSummary = {
    totalIssues: issues.length,
    criticalIssues: issues.filter(i => 
      i.type === "security" || i.type === "bug"
    ).length,
    affectedAreas: analysis.context.affectedAreas,
    overallAssessment: parsed.consensus.overallAssessment
  };
  
  return { issues, summary, metadata };
}
```

## PERFORMANCE_TARGETS
```yaml
first_call_latency: <8s
cached_call_latency: <3s
json_parse_success_rate: 100%
false_positive_rate: <10%
```

## TEST_SCENARIOS
```yaml
scenario_1_no_issues:
  input: clean_pr_diff
  expected_output:
    issues: []
    consensus:
      overallAssessment: "✅ No significant issues found"

scenario_2_critical_issue:
  input: security_vulnerability_diff
  expected_output:
    issues:
      - type: security
        confidence: high
    consensus:
      issuesRaised: >3
      issuesFiltered: >0

scenario_3_false_positive_filtered:
  input: nestjs_throw_error_with_filter
  expected_output:
    issues: []
    consensus:
      issuesRaised: 1
      issuesFiltered: 1
```

