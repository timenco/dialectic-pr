# Dialectic PR - Project Specification

## Project Overview

**Dialectic PR** is an AI-powered code reviewer specialized for TypeScript/JavaScript projects, designed to minimize false positives while providing framework-aware, high-ROI feedback.

### Core Differentiators

- **TS/JS Specialized**: Optimized for npm ecosystem (NestJS, Next.js, React, Express)
- **Consensus Review**: Multi-persona internal dialog in single API call (cost-efficient)
- **False Positive Defense**: 80% noise reduction through pattern matching
- **ROI-Focused**: Only reports issues meeting all three criteria: production bug prevention, high confidence, high ROI
- **Smart Filtering**: Intelligent context management based on file priority
- **Framework-Aware**: Automatic detection and application of framework-specific best practices

### Target Users

- TypeScript/JavaScript developers
- Projects using NestJS, Next.js, React, Express
- Teams using npm/pnpm/yarn in Node.js ecosystem

### Distribution

- **npm Package**: `@dialectic-pr/core`
- **Usage**: `npx @dialectic-pr/core` in GitHub Actions
- **License**: MIT

## Architecture

```
GitHub Actions
  ↓
CLI Entry (cli.ts)
  ↓
Security Layer (privacy-guard, exclude-filter)
  ↓
PR Analyzer → Framework Detector → Smart Filter
  ↓
Strategy Selector
  ↓
Consensus Engine (Hawk + Owl personas)
  ↓
Claude API → Review Formatter → GitHub API
```

For detailed architecture, see → [`00-overview.md`](./00-overview.md)

## Core Components

### Entry & Configuration
- **CLI** → [`core/cli.spec.md`](./core/cli.spec.md) - Entry point with `init`, `--dry-run`, `--force-review`
- **Types** → [`core/types.spec.md`](./core/types.spec.md) - Central type definitions
- **Config Loader** → [`utils/config-loader.spec.md`](./utils/config-loader.spec.md) - Configuration management

### Security Layer
- **Privacy Guard** → [`security/privacy-guard.spec.md`](./security/privacy-guard.spec.md) - Data transfer warnings and secret detection
- **Exclude Filter** → [`security/exclude-filter.spec.md`](./security/exclude-filter.spec.md) - Sensitive file exclusion

### Analysis & Filtering
- **PR Analyzer** → [`core/analyzer.spec.md`](./core/analyzer.spec.md) - Diff analysis and metrics calculation
- **Framework Detector** → [`frameworks/detector.spec.md`](./frameworks/detector.spec.md) - Auto-detect NestJS, Next.js, React, Express
- **Smart Filter** → [`core/smart-filter.spec.md`](./core/smart-filter.spec.md) - Priority-based file filtering
- **Strategy Selector** → [`core/strategy-selector.spec.md`](./core/strategy-selector.spec.md) - Size-based review strategy selection

### Review Engine
- **Consensus Engine** → [`core/consensus-engine.spec.md`](./core/consensus-engine.spec.md) - Multi-persona review orchestration
- **Consensus Prompt** → [`prompts/consensus-prompt.spec.md`](./prompts/consensus-prompt.spec.md) - Hawk/Owl prompt templates

### Adapters
- **Claude API** → [`adapters/claude-api.spec.md`](./adapters/claude-api.spec.md) - Claude API client (only LLM supported)
- **GitHub API** → [`adapters/github-api.spec.md`](./adapters/github-api.spec.md) - GitHub PR API with batch review
- **Retry Handler** → [`adapters/retry-handler.spec.md`](./adapters/retry-handler.spec.md) - Exponential backoff retry logic

### Utilities
- **Logger** → [`utils/logger.spec.md`](./utils/logger.spec.md) - Structured logging
- **Metrics Calculator** → [`utils/metrics-calculator.spec.md`](./utils/metrics-calculator.spec.md) - PR metrics computation

## Package Structure

```
dialectic-pr/
├── src/
│   ├── cli.ts                    # CLI entry point
│   ├── index.ts                  # npm package exports
│   ├── core/                     # Core engine
│   ├── frameworks/               # Framework detection
│   ├── adapters/                 # External API adapters
│   ├── security/                 # Security layer
│   ├── prompts/                  # Prompt templates
│   └── utils/                    # Utilities
├── config/
│   ├── default-config.json       # Default settings
│   └── dialectic-pr-schema.json  # JSON schema
├── templates/
│   ├── dialectic-pr.json         # Config template for init
│   └── workflow.yml              # GitHub Actions workflow template
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/                 # Test case repos
```

## Implementation Phases

### Phase 1: Core Engine ✅
- CLI interface (`init`, `--dry-run`, `--force-review`)
- Security layer (Privacy Guard, Exclude Filter)
- PR Analyzer, Smart Filter, Strategy Selector
- Consensus Engine (Multi-Persona Prompting)
- Claude API Adapter, GitHub API Adapter

See → [`integration/phase1-checklist.spec.md`](./integration/phase1-checklist.spec.md)

### Phase 2: Framework Detection (Week 2)
- Framework Detector (auto-detection)
- NestJS, Next.js, React, Express, Vanilla TS/JS frameworks
- Framework-specific rules and FP patterns

### Phase 3: False Positive Defense (Week 2-3)
- Built-in TS/JS patterns
- Pattern matcher engine
- Project rules loader
- `dialectic-pr.json` schema

### Phase 4: Integration & Testing (Week 3)
- Integration with current project
- Unit and integration tests
- Framework-specific fixtures
- Documentation

### Phase 5: Publishing (Week 4)
- npm publishing preparation
- Example projects (NestJS, Next.js, React+Express)
- Before/After comparison materials
- v1.0.0 release

## Configuration

### User Configuration: `.github/dialectic-pr.json`

```json
{
  "$schema": "https://unpkg.com/@dialectic-pr/core/config/dialectic-pr-schema.json",
  "model": "claude-sonnet-4-20250514",
  "exclude_patterns": ["**/.env*", "**/secrets/**"],
  "false_positive_patterns": [
    {
      "id": "custom-pattern",
      "category": "custom",
      "explanation": "Project-specific FP pattern",
      "false_positive_indicators": ["phrase to ignore"]
    }
  ],
  "framework_specific": {
    "nestjs": {
      "priority_modules": ["auth", "payments"]
    }
  }
}
```

### GitHub Actions Workflow

```yaml
name: Dialectic PR Review
on:
  pull_request:
    types: [opened, synchronize, labeled]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Dialectic PR Review
        run: npx @dialectic-pr/core
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Success Metrics

### Technical Metrics
- False Positive Rate: **< 10%**
- Average review time (small PR): **< 30s**
- API retry success rate: **> 95%**
- Test coverage: **> 80%**

### Usability Metrics
- Setup time: **< 5 min** (with `init` command)
- First review time: **< 10 min**
- Documentation read time: **< 15 min**

### Business Metrics
- npm weekly downloads: **> 100** (first month)
- GitHub Stars: **> 50** (first month)
- Issue response time: **< 24 hours**

## Out of Scope (MVP)

- ❌ Other languages (Python, Java, Go)
- ❌ Other LLMs (OpenAI, Gemini)
- ❌ Incremental review (deferred to v1.1)
- ❌ Cyclomatic complexity analysis (deferred to v1.3)

## Future Roadmap

### v1.1: Incremental Review
- Cache reviewed commits
- Review only changed files
- `--force-review` to override

### v1.2: TS/JS Ecosystem Expansion
- Additional frameworks: Remix, SvelteKit, Astro, Solid.js
- Monorepo support: Turborepo, Nx, pnpm workspaces
- Testing framework patterns: Jest, Vitest, Playwright

### v1.3: Advanced Analysis
- Cyclomatic complexity tracking
- Bundle size impact analysis
- Performance regression detection
- Review history analysis

### v1.4: Multi-Language (Separate Packages)
- `@dialectic-pr/python` - Django, FastAPI, Flask
- `@dialectic-pr/go` - Gin, Echo, Chi
- `@dialectic-pr/rust` - Actix, Rocket, Axum

### v1.5: Enterprise Features
- On-premise Claude (AWS Bedrock)
- Self-hosted option
- SSO integration
- Audit logs
- Team-based custom rulesets

## Quality Standards

### Code Quality
- TypeScript strict mode
- ESLint + Prettier
- JSDoc for all public APIs
- 100% type coverage

### Testing
- Unit tests (per module)
- Integration tests (full flow)
- Fixtures (real PR examples)
- E2E tests (GitHub Actions)

### Documentation
- README.md: 5-minute quickstart
- API.md: Full API reference
- ARCHITECTURE.md: Architecture explanation
- CONTRIBUTING.md: Contribution guide
- PRIVACY.md: Data privacy guide
- examples/: Real usage examples

## Key Design Decisions

### Why TypeScript/JavaScript Only?
- Focus enables deeper specialization
- Better false positive detection
- Optimized for npm ecosystem patterns
- Faster time to market

### Why Claude Only?
- Single LLM for consistent quality
- Optimized prompts for Claude's strengths
- Simplified maintenance
- Other LLMs in future versions

### Why Single-Call Multi-Persona?
- 50% cost reduction vs. two API calls
- Maintains consensus benefits
- Faster review generation
- Prompt caching optimization

### Why Framework-Aware?
- Each framework has unique patterns
- Generic tools miss framework-specific issues
- False positives vary by framework
- Better developer experience

## Getting Started

1. Install: `npm install -D @dialectic-pr/core`
2. Initialize: `npx @dialectic-pr/core init`
3. Add API key to GitHub Secrets: `ANTHROPIC_API_KEY`
4. Open a PR and get your first review!

For detailed setup, see README.md in the repository root.

---

**Project Status**: Phase 1 Complete ✅
**Current Version**: 1.0.0
**Last Updated**: 2026-01-17
