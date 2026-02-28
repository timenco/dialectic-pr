# Longblack PR Review

> **TypeScript/JavaScript 프로젝트를 위한 AI 코드 리뷰어**

NestJS, Next.js, React, Express 프레임워크에 특화된 Claude 기반 PR 리뷰 GitHub Action

## 특징

- **Hawk/Owl 합의 시스템**: Hawk(비판적 리뷰어)가 이슈를 찾고, Owl(실용적 검증자)이 ROI 기반으로 필터링
- **38개 내장 FP 패턴**: SQL injection, 에러 핸들링, DI 등 알려진 오탐을 자동 억제
- **Convention over Configuration**: `CLAUDE.md`와 `.github/review-guardrails.json`을 자동 감지하여 별도 설정 없이 동작
- **Prompt Caching**: 시스템 메시지 캐싱으로 반복 리뷰 비용 최대 90% 절감
- **Framework-Aware**: NestJS, Next.js, React, Express 자동 감지 및 프레임워크별 리뷰 규칙
- **Smart Filtering**: 파일 우선순위 기반으로 토큰 예산 내에서 중요 파일 먼저 리뷰

## 빠른 시작

### 1. 워크플로우 추가

`.github/workflows/longblack-pr-review.yml`:

```yaml
name: Longblack PR Review
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
      - uses: timenco/longblack-pr-review@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 2. GitHub Secrets 설정

```
ANTHROPIC_API_KEY: your-claude-api-key
```

### 3. PR 열기

PR을 열면 자동으로 리뷰가 시작됩니다.

## 설정

`.github/longblack-pr-review.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/timenco/longblack-pr-review/main/config/longblack-pr-review-schema.json",
  "model": "claude-sonnet-4-20250514",
  "language": "ko",
  "exclude_patterns": ["**/*.lock", "**/dist/**", "**/coverage/**"]
}
```

### 자동 감지 파일

별도 설정 없이 다음 파일이 존재하면 자동으로 로드됩니다:

| 파일 | 용도 |
|------|------|
| `CLAUDE.md` | 프로젝트 컨텍스트 (아키텍처, 컨벤션 등) → User Message에 주입 |
| `.github/review-guardrails.json` | 프로젝트 고유 FP 패턴 → System Message에 주입 |

### 설정 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `model` | string | `claude-sonnet-4-20250514` | 사용할 Claude 모델 |
| `language` | string | — | 리뷰 출력 언어 (ISO 639-1, 예: `ko`, `en`, `ja`) |
| `exclude_patterns` | string[] | `[]` | 리뷰에서 제외할 글로브 패턴 |
| `strategies` | object | — | PR 크기별 토큰 예산 오버라이드 |

### Action Inputs

| Input | 필수 | 기본값 | 설명 |
|-------|------|--------|------|
| `anthropic_api_key` | ✅ | — | Anthropic API key |
| `github_token` | — | `${{ github.token }}` | GitHub token |
| `config_path` | — | `.github/longblack-pr-review.json` | 설정 파일 경로 |
| `log_level` | — | `info` | 로그 레벨 (debug\|info\|warn\|error) |
| `dry_run` | — | `false` | 리뷰 포스트 없이 실행 |

### Action Outputs

| Output | 설명 |
|--------|------|
| `issues_count` | 발견된 총 이슈 수 |
| `critical_count` | 크리티컬 이슈 수 |
| `review_posted` | 리뷰 포스트 여부 |

## FP 규칙 구성 가이드

### 프롬프트 흐름과 각 설정의 위치

```
System Message (캐시됨, Owl의 FP 판별 기준):
  ├── Hawk/Owl 합의 지침                          ← 자동 (불변)
  ├── FALSE_POSITIVE_PATTERNS:                     ← 아래 소스가 머지됨
  │     빌트인 38개                                  자동 (프레임워크별)
  │     + .github/review-guardrails.json             자동 감지
  ├── Framework Best Practices                     ← 자동 (감지된 프레임워크)
  └── Language 지시                                ← language 설정

User Message (매 PR마다 변경, Owl의 맥락 판단 근거):
  ├── REVIEW_CONTEXT (framework, flags)            ← 자동
  ├── STRATEGY + INSTRUCTIONS                      ← 자동 (PR 크기 기반)
  ├── PROJECT_CONVENTIONS:                         ← CLAUDE.md 내용 (자동 감지)
  │     {CLAUDE.md 파일 전문}
  └── DIFF                                         ← PR diff
```

Owl은 Hawk가 제기한 이슈를 두 곳에서 검증합니다:
1. **FALSE_POSITIVE_PATTERNS** — "이 표현이 리뷰에 있으면 FP" (정밀 매칭)
2. **PROJECT_CONVENTIONS** — "이 프로젝트의 맥락상 정상인가" (자연어 판단)

이 차이가 핵심입니다. FP 패턴은 **좁고 정확하게** 작동하고, 컨텍스트 파일은 **넓고 해석적으로** 작동합니다.

### 무엇을 어디에 넣을 것인가

#### `.github/review-guardrails.json` — 프로젝트 고유의 구조화된 FP 패턴

**용도**: 빌트인 38개가 커버하지 못하는, 이 프로젝트만의 안전한 패턴.

**넣어야 하는 것**:
- 프로젝트가 사용하는 라이브러리/인프라의 안전한 패턴
- 반복적으로 FP가 발생하는 프로젝트 고유 코드 패턴
- 명확한 기술적 근거가 있는 예외

**파일 형식** (배열 또는 `{ "patterns": [...] }` 모두 지원):

```json
[
  {
    "id": "aurora-connection-pool-settings",
    "category": "performance",
    "severity": "medium",
    "explanation": "Aurora Serverless v2 커넥션 풀은 인프라 레벨에서 관리되며, connection_limit 값은 Aurora 인스턴스 크기에 맞게 튜닝됨",
    "falsePositiveIndicators": [
      "connection pool size too small",
      "connection pool size too large",
      "커넥션 풀 설정"
    ]
  }
]
```

**필드 설명**:

| 필드 | 필수 | 설명 |
|------|------|------|
| `id` | ✅ | 고유 ID. `{주제}-{세부}` 형식 권장. 빌트인과 동일 ID면 오버라이드 |
| `category` | ✅ | `sql-injection` \| `error-handling` \| `dependency-injection` \| `logging` \| `authentication` \| `validation` \| `performance` \| `custom` |
| `explanation` | ✅ | 왜 이것이 FP인지 기술적 근거. Owl이 이것을 읽고 판단함 |
| `falsePositiveIndicators` | ✅ | Hawk의 리뷰에 이 문구가 포함되면 FP로 간주. **구체적일수록 정밀함** |
| `severity` | — | `critical` \| `high` \| `medium` \| `low`. 프롬프트에 참고 정보로 포함 |

**`falsePositiveIndicators` 작성 규칙**:

```
좋은 예 (구체적 → 정밀 매칭):
  "Prisma $executeRaw에서 SQL injection"
  "$queryRawSafe is unsafe"
  "BigInt should be Int"

나쁜 예 (모호 → 과도한 FP 억제):
  "SQL 관련 이슈"
  "데이터베이스 문제"
  "타입 관련"
```

규칙: **Hawk가 실제로 쓸 법한 문장**을 넣으세요. 리뷰 출력에서 이 문자열이 부분 매칭됩니다.

#### `CLAUDE.md` — 서술형 프로젝트 맥락

**용도**: 기술적 제약과 아키텍처 결정을 자연어로 기술. Owl이 맥락 판단에 사용.

**넣어야 하는 것** (기술적 제약):
```markdown
## Architecture
- AllExceptionsFilter가 모든 에러를 HttpException으로 변환
- BigInt 필드: orderId, paymentId (schema.prisma 기준)
- Timezone: Asia/Seoul (dayjs utc + tz)

## Critical Modules
- auth, payments, memberships — 변경 시 높은 주의 필요
```

**넣지 말아야 하는 것** (리뷰 품질 저하):
```markdown
## 코드 스타일                    ← Owl과 무관, 토큰 낭비
- camelCase 사용
- import 순서: external → internal

## 허용 예외                       ← 위험: Owl 과도 관대화
- 테스트에서 as any 허용           ← review-guardrails.json으로 이동
- console.log 허용                 ← 빌트인 패턴이 이미 커버
```

**핵심 원칙**: `CLAUDE.md`에는 "무엇이 안전한가"가 아니라 "이 프로젝트가 어떻게 구성되어 있는가"를 넣으세요. "안전한 패턴"은 `.github/review-guardrails.json`의 구조화된 패턴으로 표현해야 Owl이 정밀하게 동작합니다.

### 설정 우선순위와 중복 제거

```
로드 순서 (후순위가 동일 ID를 오버라이드):
  1. 빌트인 패턴 38개
  2. 프레임워크별 패턴 (FrameworkRegistry)
  3. .github/review-guardrails.json (자동 감지)
```

예: 빌트인의 `prisma-tagged-template-safe`를 프로젝트에서 재정의하고 싶으면, `.github/review-guardrails.json`에 동일 `id`로 새 `explanation`과 `falsePositiveIndicators`를 정의하면 됩니다.

### 실전 예시: NestJS + Prisma + Aurora 프로젝트

```
.github/
  longblack-pr-review.json    # 메인 설정
  review-guardrails.json       # 프로젝트 FP 패턴 (6개)
CLAUDE.md                      # 프로젝트 컨텍스트 (자동 감지)
```

**`.github/longblack-pr-review.json`**:
```json
{
  "$schema": "https://raw.githubusercontent.com/timenco/longblack-pr-review/main/config/longblack-pr-review-schema.json",
  "model": "claude-sonnet-4-20250514",
  "language": "ko",
  "exclude_patterns": ["**/*.lock", "**/dist/**", "**/coverage/**", "**/cdk.out/**"]
}
```

**`.github/review-guardrails.json`** (빌트인이 커버하지 못하는 프로젝트 고유 패턴만):
```json
[
  {
    "id": "prisma-tagged-template-constants",
    "category": "sql-injection",
    "severity": "critical",
    "explanation": "Prisma tagged template ($executeRaw`...${val}`)은 상수/변수 무관하게 모든 ${} 값을 자동 파라미터화하므로 안전",
    "falsePositiveIndicators": [
      "상수가 템플릿에 직접 삽입",
      "constant directly inserted into query"
    ]
  },
  {
    "id": "error-rethrow-in-service",
    "category": "error-handling",
    "severity": "medium",
    "explanation": "Service catch 블록에서 에러를 rethrow하는 패턴은 AllExceptionsFilter와 조합하여 스택 트레이스를 보존하면서 컨텍스트를 추가하는 의도적 설계",
    "falsePositiveIndicators": [
      "error rethrow without handling",
      "catch block only rethrows",
      "에러를 다시 throw"
    ]
  },
  {
    "id": "aurora-connection-pool-settings",
    "category": "performance",
    "severity": "medium",
    "explanation": "Aurora Serverless v2 커넥션 풀은 인스턴스 크기에 맞게 튜닝되며, connection_limit은 인프라 팀이 관리",
    "falsePositiveIndicators": [
      "connection pool size",
      "커넥션 풀 설정"
    ]
  }
]
```

**`CLAUDE.md`** (프로젝트 컨텍스트, 자동 감지):
```markdown
# Review Context

## Architecture
- NestJS 10 + Prisma 5 + AWS Aurora Serverless v2
- AllExceptionsFilter → 모든 에러를 HttpException으로 변환
- JwtGuard + RolesGuard → @Auth() 데코레이터 패턴

## Database
- BigInt 필드: orderId, paymentId, membershipId
- Timezone: Asia/Seoul (dayjs utc + tz plugin)
- null = DB에 값 없음, undefined = 필드 미설정

## Critical Modules
- auth, payments, memberships, orders
```

## Hawk/Owl 합의 시스템

단일 Claude API 호출 내에서 두 역할을 프롬프트로 정의합니다:

### Hawk (Critical Reviewer)
- 버그, 보안 취약점, 에지 케이스 탐지
- 에러 핸들링, 타입 안전성 집중
- 잠재적 이슈 목록 생성

### Owl (Pragmatic Validator)
- Hawk의 이슈를 False Positive 패턴(빌트인 + guardrails)과 대조
- ROI 평가 및 실용적 필터링
- 프로덕션 영향도 기반 검증

**결과**: Owl의 필터링을 통과한 이슈만 보고

## 아키텍처

```
GitHub Actions
  → action.ts (Action Entry) / cli.ts (CLI Entry)
    → review-engine.ts (runReview)
      → Security Layer (privacy-guard, exclude-filter)
        → PR Analyzer → Framework Detector → Smart Filter
          → Strategy Selector
            → ProjectRulesLoader (빌트인 + 프레임워크 FP 패턴)
            → ConfigLoader.loadGuardrails (review-guardrails.json 자동 감지)
              → Consensus Engine (Hawk + Owl)
                → Claude API (prompt caching) → GitHub API
```

### 리뷰 전략

PR 크기에 따라 자동으로 전략을 선택합니다:

| 전략 | 크기 | 토큰 예산 | 리뷰 초점 |
|------|------|-----------|----------|
| small | < 50KB | 16,000 | 포괄적 리뷰 |
| medium | < 150KB | 12,000 | 핵심 이슈 + 버그 |
| large | < 200KB | 8,000 | 보안 + 버그만 |
| xlarge | < 800KB | 4,000 | 보안 이슈만 |
| skip | >= 800KB | — | PR 분할 권고 |

크리티컬 모듈(auth, payments 등) 변경 시 토큰 예산이 1.5배로 증가합니다.

## 비용 구조

Claude API 비용은 사용자 본인의 Anthropic API 키로 직접 지불합니다.

시스템 메시지(에이전트 지침, FP 패턴, 프레임워크 룰)에 `cache_control`을 설정하여 캐시 할인을 받습니다:

- 첫 PR 리뷰: 전체 토큰 비용 (캐시 생성)
- 이후 리뷰 (캐시 히트 시): 시스템 메시지 부분 캐시 읽기 요금 적용

## 개발

```bash
# 단위 테스트 (106개)
npm test

# 타입 체크 + 빌드
npm run build

# Action 번들 빌드 (tsc + ncc)
npm run build:all

# Lint
npm run lint
```

## 프로젝트 구조

```
longblack-pr-review/
├── src/
│   ├── core/              # 리뷰 엔진, 분석기, 전략, 합의 엔진
│   ├── adapters/          # Claude API, GitHub API, 재시도 핸들러
│   ├── security/          # 프라이버시 가드, 파일 제외 필터
│   ├── frameworks/        # 프레임워크 감지 및 특화 룰
│   ├── false-positive/    # 빌트인 FP 패턴, 패턴 매처, 프로젝트 룰 로더
│   ├── utils/             # 설정 로더, 로거, 메트릭 계산기
│   ├── action.ts          # GitHub Action 진입점
│   ├── cli.ts             # CLI 진입점 (로컬 디버깅용)
│   └── index.ts           # 모듈 exports
├── tests/
│   └── unit/              # 단위 테스트 (106개)
├── config/                # JSON Schema, 기본 설정
├── dist/action/           # 번들된 Action (커밋됨)
├── action.yml             # GitHub Action 메타데이터
└── specs/                 # 아키텍처 참조 문서
```

## 지원 프레임워크

| Framework | 감지 | 프롬프트 룰 | FP 패턴 |
| --------- | ---- | ----------- | ------- |
| NestJS    | ✅   | ✅          | ✅      |
| Next.js   | ✅   | ✅          | ✅      |
| React     | ✅   | ✅          | ✅      |
| Express   | ✅   | ✅          | ✅      |
| Vanilla   | ✅   | ✅          | ✅      |

## 내장 FP 패턴 카테고리

총 38개 패턴이 다음 카테고리에 분포:

| 카테고리 | 패턴 수 | 예시 |
|----------|---------|------|
| sql-injection | 5 | Prisma tagged template, $queryRawSafe |
| error-handling | 5 | NestJS AllExceptionsFilter, async wrapper |
| dependency-injection | 3 | NestJS constructor DI, @Inject |
| logging | 3 | NestJS Logger 패턴, CLI console |
| authentication | 3 | JWT env secret, bcrypt rounds |
| validation | 9 | class-validator DTO, Zod, null/undefined 분리 |
| performance | 1 | React.memo |
| custom | 1 | Prisma BigInt 직렬화 |
| React/Next.js/Express | 8 | Server Components, hooks, middleware |

## 라이센스

MIT
