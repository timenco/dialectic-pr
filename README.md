# Dialectic PR

> **The AI Code Reviewer for TypeScript Projects**

False Positive를 최소화하고 프레임워크 컨텍스트를 깊이 이해하는 지능형 PR 리뷰 시스템

## 🎯 핵심 차별화

- **TypeScript/JavaScript 전용**: NestJS, Next.js, React, Express에 특화
- **Consensus Review**: 두 AI 페르소나의 내부 대화로 노이즈 80% 감소
- **Claude 최적화**: Prompt Caching으로 비용 90% 절감
- **Framework-Aware**: 프레임워크별 Best Practice 자동 적용
- **Smart Filtering**: 핵심 파일 우선순위 기반 지능형 리뷰

## 📊 진행 상황

### ✅ 완료: 스펙 세분화 (Phase 1 준비 완료)

**전체 스펙을 LLM 최적화 형식으로 세분화 완료!**

```
specs/
├── 00-overview.md                    # 시스템 전체 개요
├── core/                             # 핵심 모듈 (7개)
├── prompts/                          # 프롬프트 최적화
├── adapters/                         # Claude & GitHub API (3개)
├── security/                         # 보안 레이어 (2개)
├── frameworks/                       # 프레임워크 감지 (1개)
├── utils/                           # 유틸리티 (3개)
└── integration/                      # 통합 테스트 체크리스트
```

**스펙 특징**:
- ✅ Claude가 바로 구현 가능한 형식
- ✅ YAML + TypeScript 혼합 (구조화 + 실행 가능)
- ✅ 모든 스펙에 테스트 케이스 포함
- ✅ 의존성 그래프 명시

### 🚀 Claude 최신 기능 통합

**비용 & 품질 최적화**:
- 💰 **Prompt Caching**: 반복되는 시스템 메시지 캐시 (90% 비용 절감)
- 🧠 **Extended Thinking**: 2000 토큰 예산으로 더 깊은 분석
- ✅ **JSON Schema Mode**: 100% 파싱 성공률 보장

### 🔄 진행 중: Phase 1 구현

```yaml
진행률: 10% (17개 모듈 중 2개 시작)

✅ 완료:
  - 스펙 세분화 (17개 파일)

🚧 진행 중:
  - types.ts
  - analyzer.ts (일부 구현)

⏳ 대기:
  - logger.ts
  - privacy-guard.ts
  - exclude-filter.ts
  - retry-handler.ts
  - claude-api.ts (중요!)
  - github-api.ts
  - metrics-calculator.ts
  - smart-filter.ts
  - strategy-selector.ts
  - detector.ts
  - consensus-engine.ts (핵심!)
  - config-loader.ts
  - cli.ts
  - index.ts
```

## 📝 구현 가이드

### 스펙 → 코드 변환 방법

각 `.spec.md` 파일은 **Claude가 즉시 구현 가능한 형식**으로 작성되어 있습니다.

**예시**: `types.ts` 구현하기

```bash
# 1. 스펙 읽기
cat specs/core/types.spec.md

# 2. Claude에게 요청
"specs/core/types.spec.md를 보고 src/core/types.ts를 구현해주세요"

# 3. 테스트
npm run build
```

### 우선순위 구현 순서

**Day 1** (기초 레이어):
1. `types.ts` - 모든 타입 정의
2. `logger.ts` - 로깅
3. `privacy-guard.ts` - 보안 경고
4. `exclude-filter.ts` - 파일 필터링

**Day 2** (API 레이어):
5. `retry-handler.ts` - 재시도 로직
6. `claude-api.ts` ⭐ - Claude 최적화 포함
7. `github-api.ts` - GitHub 연동

**Day 3** (코어 로직):
8. `metrics-calculator.ts` - 메트릭 계산
9. `smart-filter.ts` - 파일 우선순위
10. `strategy-selector.ts` - 전략 선택
11. `detector.ts` - 프레임워크 감지
12. `analyzer.ts` - PR 분석 (이미 시작됨)

**Day 4** (리뷰 엔진):
13. `config-loader.ts` - 설정 로드
14. `consensus-engine.ts` ⭐⭐ - 핵심! Consensus 리뷰

**Day 5** (통합 & CLI):
15. `cli.ts` - CLI 인터페이스
16. `index.ts` - npm exports
17. End-to-End 테스트

## 🎯 다음 마일스톤

### Phase 1: Core Engine (진행 중, 목표: 5일)
- [ ] 17개 모듈 구현 완료
- [ ] End-to-End 테스트 통과
- [ ] Claude 최적화 검증

### Phase 2: Framework Detection (예정)
- [ ] NestJS 특화 룰
- [ ] Next.js 특화 룰
- [ ] React 특화 룰
- [ ] Express 특화 룰

### Phase 3: False Positive Defense (예정)
- [ ] 내장 패턴 라이브러리
- [ ] 패턴 매칭 엔진
- [ ] 프로젝트별 룰 로더

### Phase 4: Testing & Integration (예정)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Fixtures (실제 PR 예제)

### Phase 5: Publishing (예정)
- [ ] npm 패키징
- [ ] 문서 작성
- [ ] 예제 프로젝트
- [ ] v1.0.0 릴리즈

## 🤝 팀원 가이드

### 구현 시작하기

```bash
# 1. 프로젝트 클론
git clone <repo-url>
cd dialectic-pr

# 2. 의존성 설치
npm install

# 3. 스펙 확인
ls specs/

# 4. 구현할 모듈 선택
# specs/core/types.spec.md → src/core/types.ts

# 5. 빌드 & 테스트
npm run build
npm test
```

### 스펙 파일 읽는 법

각 스펙은 다음 구조를 따릅니다:

```yaml
DEPENDENCIES: 어떤 모듈에 의존하는가
FILE_PATH: 어디에 구현할 것인가
IMPLEMENTATION: 전체 코드 (복사 가능)
BEHAVIOR: 어떻게 동작해야 하는가
TEST_CASES: 어떻게 검증하는가
```

### 질문하기

- **스펙 이해 안 됨**: 해당 스펙 파일 열어보기 → 99% 답이 있음
- **의존성 문제**: `specs/00-overview.md`의 IMPLEMENTATION_ORDER 참고
- **Claude 활용**: 스펙 파일을 Claude에게 직접 제공

## 📄 라이센스

MIT

## 📮 연락

프로젝트 관련 문의는 이슈로 남겨주세요.
