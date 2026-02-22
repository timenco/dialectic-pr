# Dialectic PR

> **AI code reviewer for TypeScript projects with multi-persona consensus**

False Positive를 최소화하고 프레임워크 컨텍스트를 깊이 이해하는 지능형 PR 리뷰 시스템

## 🎯 핵심 차별화

- **TypeScript/JavaScript 전용**: NestJS, Next.js, React, Express에 특화
- **Consensus Review**: 두 AI 페르소나(Hawk & Owl)의 내부 대화로 노이즈 80% 감소
- **Claude 최적화**: Prompt Caching으로 비용 90% 절감
- **Framework-Aware**: 프레임워크별 Best Practice 자동 적용
- **Smart Filtering**: 핵심 파일 우선순위 기반 지능형 리뷰
- **False Positive Defense**: 30+ 내장 패턴으로 노이즈 최소화

## 🚀 빠른 시작

### 1. 워크플로우 추가

`.github/workflows/dialectic-pr-review.yml`:

```yaml
name: Dialectic PR Review
on:
  pull_request:
    types: [opened, synchronize, labeled]
permissions:
  contents: read
  pull-requests: write
jobs:
  review:
    runs-on: ubuntu-latest
    if: |
      github.event.pull_request.draft == false &&
      !contains(github.event.pull_request.labels.*.name, 'skip-ai-review')
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: timenco/dialectic-pr@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 2. GitHub Secrets 설정

```
ANTHROPIC_API_KEY: your-claude-api-key
```

### 3. PR 열기

PR을 열면 자동으로 리뷰가 시작됩니다!

## ⚙️ 설정 옵션

`.github/dialectic-pr.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/timenco/dialectic-pr/main/config/dialectic-pr-schema.json",
  "model": "claude-sonnet-4-20250514",
  "language": "ko",
  "context_files": ["CLAUDE.md", "CONVENTIONS.md"],
  "exclude_patterns": ["**/.env*", "**/secrets/**"],
  "false_positive_patterns": [
    {
      "id": "custom-pattern",
      "category": "custom",
      "explanation": "프로젝트 특화 패턴 설명",
      "falsePositiveIndicators": ["무시할 문구"]
    }
  ],
  "framework_specific": {
    "nestjs": {
      "priority_modules": ["auth", "payments"]
    }
  },
  "conventions": {
    "paths": ["CLAUDE.md", "CONVENTIONS.md"]
  }
}
```

### Action Inputs

| Input | 필수 | 기본값 | 설명 |
|-------|------|--------|------|
| `anthropic_api_key` | ✅ | — | Anthropic API key |
| `github_token` | — | `${{ github.token }}` | GitHub token |
| `config_path` | — | `.github/dialectic-pr.json` | 설정 파일 경로 |
| `log_level` | — | `info` | 로그 레벨 (debug\|info\|warn\|error) |
| `dry_run` | — | `false` | 리뷰 포스트 없이 실행 |

### Action Outputs

| Output | 설명 |
|--------|------|
| `issues_count` | 발견된 총 이슈 수 |
| `critical_count` | 크리티컬 이슈 수 |
| `review_posted` | 리뷰 포스트 여부 |

## 🏗️ 아키텍처

```
GitHub Actions
  → action.ts (Action Entry)
    → review-engine.ts (runReview)
      → Security Layer (privacy-guard, exclude-filter)
        → PR Analyzer → Framework Detector → Smart Filter
          → Strategy Selector
            → Consensus Engine (Hawk + Owl personas)
              → Claude API → Review Formatter → GitHub API
```

## 🤖 Multi-Persona Consensus System

Dialectic PR은 단일 API 호출 내에서 두 AI 페르소나가 협력하여 리뷰합니다:

### Hawk (Critical Reviewer)

- 버그, 보안 취약점, 에지 케이스 탐지
- 에러 핸들링, 타입 안전성 집중
- 잠재적 이슈 목록 생성

### Owl (Pragmatic Validator)

- Hawk의 우려사항 검증
- False Positive 패턴 체크
- ROI 평가 및 실용적 필터링

**결과**: 두 페르소나가 **합의한 이슈만** 보고 → 노이즈 80% 감소

## 💰 비용 최적화

### Prompt Caching (90% 비용 절감)

```typescript
const systemMessages = [
  { text: AGENT_INSTRUCTIONS, cache_control: { type: "ephemeral" } },
  { text: FP_PATTERNS, cache_control: { type: "ephemeral" } },
  { text: FRAMEWORK_RULES, cache_control: { type: "ephemeral" } },
];
```

### 예상 비용

- 첫 PR 리뷰: ~$0.05
- 이후 (캐시 히트): ~$0.005

## 🧪 개발

```bash
# 단위 테스트
npm test

# 타입 체크
npm run build

# Action 번들 빌드
npm run build:all

# Lint
npm run lint
```

## 📁 프로젝트 구조

```
dialectic-pr/
├── src/
│   ├── core/           # 핵심 리뷰 로직
│   ├── adapters/       # Claude & GitHub API
│   ├── security/       # 보안 레이어
│   ├── frameworks/     # 프레임워크 특화 룰
│   ├── false-positive/ # FP 방어 시스템
│   ├── utils/          # 유틸리티
│   ├── action.ts       # GitHub Action 진입점
│   ├── cli.ts          # CLI 진입점 (로컬 디버깅용)
│   └── index.ts        # 모듈 exports
├── tests/
│   └── unit/           # 단위 테스트
├── config/             # 기본 설정 & JSON Schema
├── dist/action/        # 번들된 Action (커밋됨)
├── action.yml          # GitHub Action 메타데이터
└── specs/              # 상세 스펙 문서
```

## 🎯 지원 프레임워크

| Framework | 감지 | 특화 룰 | FP 패턴 |
| --------- | ---- | ------- | ------- |
| NestJS    | ✅   | ✅      | ✅      |
| Next.js   | ✅   | ✅      | ✅      |
| React     | ✅   | ✅      | ✅      |
| Express   | ✅   | ✅      | ✅      |
| Vanilla   | ✅   | ✅      | ✅      |

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이센스

MIT

## 📮 지원

- [GitHub Issues](https://github.com/timenco/dialectic-pr/issues)
- [Documentation](https://github.com/timenco/dialectic-pr#readme)
