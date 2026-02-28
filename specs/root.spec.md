# Longblack PR Review - Architecture Reference

> 내부 개발 참조 문서. 사용자 가이드는 [README.md](../README.md) 참조.

## 시스템 개요

```yaml
project: longblack-pr-review
version: 1.0.0
runtime: node >= 18
language: typescript (ESM)
deployment: github_action
model: claude-sonnet-4-20250514
tests: 106 passing (7 suites)
builtin_fp_patterns: 38
```

## 아키텍처

```
GitHub Actions / CLI
  ↓
review-engine.ts (runReview — 메인 오케스트레이션)
  ├── PrivacyGuard          — 환경 변수 검증, 시크릿 탐지
  ├── ExcludeFilter         — 민감/생성 파일 제외 (glob)
  ├── ConfigLoader          — .github/longblack-pr-review.json 로드 + 머지
  │   └── loadFalsePositiveFiles()  — 외부 FP JSON 파일 로드
  ├── PRAnalyzer            — diff 분석, 메트릭, 컨텍스트 플래그
  │   ├── FrameworkDetector — NestJS/Next.js/React/Express/Vanilla 자동 감지
  │   └── SmartFilter       — 우선순위 기반 파일 정렬 + 토큰 예산 내 자르기
  ├── StrategySelector      — PR 크기 → 리뷰 전략 결정
  ├── ProjectRulesLoader    — 빌트인 38개 + 프레임워크별 FP 패턴 통합
  └── ConsensusEngine       — Hawk/Owl 프롬프트 빌드 + Claude API 호출
      ├── ClaudeAdapter     — Anthropic SDK, prompt caching, 비용 추적
      └── PatternMatcher    — 리뷰 결과에서 FP 필터링
  ↓
GitHubAdapter               — PR 코멘트 포스트
```

## 파일 구조

```
src/
  action.ts                    # GitHub Action 진입점
  cli.ts                       # CLI 진입점 (init, review, --dry-run)
  index.ts                     # 모듈 exports

  core/
    types.ts                   # 모든 타입 정의 (의존성 없음)
    review-engine.ts           # runReview() — 메인 오케스트레이션
    analyzer.ts                # PR diff 분석, 메트릭, 컨텍스트 플래그
    smart-filter.ts            # 우선순위 기반 파일 필터링
    strategy-selector.ts       # PR 크기 → 리뷰 전략
    consensus-engine.ts        # Hawk/Owl 프롬프트 + Claude 호출

  adapters/
    claude-api.ts              # Anthropic SDK 래퍼 (prompt caching)
    github-api.ts              # Octokit 래퍼 (diff, files, comment)
    retry-handler.ts           # 지수 백오프 재시도

  security/
    privacy-guard.ts           # 환경 변수 검증 + 시크릿 탐지
    exclude-filter.ts          # 파일 제외 (glob matching)

  frameworks/
    detector.ts                # 프레임워크 자동 감지
    base-framework.ts          # 프레임워크 레지스트리 + 베이스 클래스
    nestjs-framework.ts        # NestJS 특화 룰
    nextjs-framework.ts        # Next.js 특화 룰
    react-framework.ts         # React 특화 룰
    express-framework.ts       # Express 특화 룰

  false-positive/
    builtin-patterns.ts        # 38개 내장 FP 패턴
    pattern-matcher.ts         # 리뷰 이슈 vs FP 패턴 매칭
    project-rules-loader.ts    # 프로젝트별 규칙 로드 (빌트인 + 프레임워크 + 커스텀)

  utils/
    config-loader.ts           # 설정 로드 + 컨벤션 로드 + FP 파일 로드
    logger.ts                  # 구조화된 로깅
    metrics-calculator.ts      # diff 메트릭 계산

tests/
  unit/
    builtin-patterns.test.ts   # FP 패턴 검증
    config-loader.test.ts      # 설정 로더 + FP 파일 로드
    frameworks.test.ts         # 프레임워크 감지
    pattern-matcher.test.ts    # 패턴 매칭
    smart-filter.test.ts       # 파일 필터링
    strategy-selector.test.ts  # 전략 선택
  integration.test.ts          # 모듈 통합 테스트

config/
  default.json                 # 기본 설정
  longblack-pr-review-schema.json     # JSON Schema (에디터 자동완성 지원)
```

## 핵심 타입 (types.ts)

```typescript
// 설정
interface LongblackConfig {
  model: string;
  language?: string;
  context_files?: string[];           // 컨텍스트 파일 (→ User Message)
  false_positive_files?: string[];    // 외부 FP JSON 파일 (→ System Message)
  exclude_patterns: string[];
  strategies: StrategyConfig;
  false_positive_patterns: FalsePositivePattern[];  // 인라인 FP 패턴
  framework_specific: FrameworkSpecificConfig;
  conventions?: ConventionsConfig;
}

// FP 패턴
interface FalsePositivePattern {
  id: string;
  category: FPCategory;
  pattern?: RegExp;
  explanation: string;
  severity?: "critical" | "high" | "medium" | "low";
  falsePositiveIndicators: string[];  // AI가 이 표현을 쓰면 FP로 간주
}

// 리뷰 결과
interface ReviewResult {
  issues: ReviewIssue[];
  summary: ReviewSummary;
  metadata: ReviewMetadata;
}
```

## review-engine.ts 흐름 (runReview)

```
1. PrivacyGuard         — 환경 변수 확인, 데이터 전송 고지
2. ConfigLoader.load()  — .github/longblack-pr-review.json 로드
3. Adapters 초기화      — ClaudeAdapter, GitHubAdapter
4. ExcludeFilter        — 제외 패턴 설정
5. PR 데이터 가져오기   — diff + files from GitHub API
6. PrivacyGuard         — diff 내 시크릿 검사
7. PRAnalyzer.analyze() — 프레임워크 감지, 메트릭, 우선순위, 컨텍스트 플래그
8. StrategySelector     — PR 크기 → 전략 (skip이면 경고 코멘트 후 종료)
9. Conventions 로드     — conventions.paths + context_files
10. FP 패턴 통합:
    a. ProjectRulesLoader.load()         — 빌트인 38개 + 프레임워크별
    b. ConfigLoader.loadFalsePositiveFiles() — false_positive_files 외부 JSON
    c. config.false_positive_patterns    — 인라인 패턴
    d. 중복 제거 (ID 기준, 후순위 우선)
11. ConsensusEngine.generateReview()     — Hawk/Owl 프롬프트 + Claude 호출
12. 결과 포맷팅 + GitHub 코멘트 포스트
```

## FP 규칙 시스템과 Owl의 판별 경로

Owl은 Hawk가 제기한 이슈를 두 경로로 검증:

```
경로 1 — 정밀 매칭 (System Message, 캐시됨):
  FALSE_POSITIVE_PATTERNS 블록에서 falsePositiveIndicators 문자열 매칭
  ├── 빌트인 38개 (builtin-patterns.ts)
  ├── 프레임워크별 패턴 (FrameworkRegistry)
  ├── false_positive_files 외부 JSON ← 프로젝트 고유 FP
  └── false_positive_patterns 인라인 ← 간편 오버라이드

경로 2 — 맥락 판단 (User Message, 비캐시):
  PROJECT_CONVENTIONS 블록에서 자연어로 맥락 해석
  └── context_files 내용 (CLAUDE-review.md 등)
```

**핵심 차이**: 경로 1은 "이 표현이 있으면 FP" (좁고 정확), 경로 2는 "이 프로젝트의 맥락상 정상인가" (넓고 해석적). "안전한 패턴"은 경로 1로, "아키텍처 맥락"은 경로 2로 분리해야 Owl의 정밀도가 유지됨.

**중복 제거**: 동일 ID 패턴이 여러 소스에 있으면 후순위(인라인 > 외부파일 > 프레임워크 > 빌트인)가 우선.

## Prompt Caching 전략

```typescript
// System messages — 캐시됨 (cache_control: { type: "ephemeral" })
[
  { text: "Hawk/Owl 합의 지침 + FP 패턴", cache_control: { type: "ephemeral" } },
  { text: "프레임워크 Best Practice",       cache_control: { type: "ephemeral" } },
  { text: "언어 설정 (optional)",           cache_control: { type: "ephemeral" } },
]

// User message — 매번 다름 (캐시 안 됨)
"리뷰 컨텍스트 + 컨벤션 + Diff + 출력 스키마"
```

## 빌트인 FP 패턴 분류 (38개)

| 카테고리 | 패턴 수 | 대표 ID |
|----------|---------|---------|
| sql-injection | 5 | prisma-tagged-template-safe, prisma-queryrawsafe-params |
| error-handling | 5 | nestjs-throw-error-with-filter, async-error-wrapper |
| dependency-injection | 3 | nestjs-constructor-di, nestjs-inject-decorator |
| logging | 3 | nestjs-logger-pattern, console-in-cli |
| authentication | 3 | jwt-secret-env, bcrypt-rounds, auth-decorator |
| validation | 9 | class-validator-dto, zod-schema, null-undefined-intentional-separation |
| performance | 1 | react-memo-optimization |
| custom | 1 | prisma-bigint-serialization-check |

## 리뷰 전략 테이블

| 전략 | diff 크기 | 토큰 예산 | 컨텍스트 예산 |
|------|-----------|-----------|--------------|
| small | < 50KB | 16,000 | 4,000 |
| medium | < 150KB | 12,000 | 3,000 |
| large | < 200KB | 8,000 | 2,000 |
| xlarge | < 800KB | 4,000 | 1,000 |
| skip | >= 800KB | — | — |

크리티컬 모듈(auth, payments, billing, security) 변경 시 토큰 예산 1.5배.

## 설계 결정

| 결정 | 이유 |
|------|------|
| TypeScript/JavaScript 전용 | 프레임워크 특화 FP 패턴으로 정확도 향상 |
| Claude 전용 | 단일 LLM으로 프롬프트 최적화 집중 |
| 단일 API 호출 Hawk/Owl | 두 번 호출 대비 ~50% 토큰 절감 |
| JSON은 프롬프트 엔지니어링 | API-level JSON Schema Mode 미사용 (프롬프트로 대체) |
| 프레임워크 자동 감지 | package.json + 파일 패턴으로 설정 없이 동작 |

## 알려진 제한사항

- **Extended Thinking**: 코드에 파라미터 있으나 SDK에서 미활성화
- **JSON Schema Mode**: 프롬프트 기반 (`RESPOND_WITH_VALID_JSON_ONLY`), API 강제 아님
- **Privacy Guard**: 시크릿 감지 시 경고만 (차단 아님)
- **파싱 실패**: Claude가 비-JSON 응답 시 빈 이슈 배열 반환 (사일런트)

## 테스트 현황

```
7 suites, 106 tests passing
├── builtin-patterns.test.ts   — FP 패턴 구조, 카테고리, 유틸리티
├── config-loader.test.ts      — 설정 로드, FP 파일 로드, 검증
├── frameworks.test.ts         — 프레임워크 감지
├── pattern-matcher.test.ts    — 리뷰 이슈 FP 매칭
├── smart-filter.test.ts       — 파일 우선순위, 토큰 자르기
├── strategy-selector.test.ts  — 전략 선택, 크리티컬 부스트
└── integration.test.ts        — 모듈 초기화, 분석 플로우
```
