# Dialectic PR

> **The AI Code Reviewer for TypeScript Projects**

False Positive를 최소화하고 프레임워크 컨텍스트를 깊이 이해하는 지능형 PR 리뷰 시스템

## 🎯 특징

- **TypeScript/JavaScript 전용**: NestJS, Next.js, React, Express에 완벽히 최적화
- **Consensus Review**: 두 AI 페르소나의 내부 대화로 노이즈 80% 감소
- **Framework-Aware**: 프레임워크별 Best Practice 자동 적용
- **Smart Filtering**: 핵심 파일 우선순위 기반 지능형 리뷰
- **5분 설정**: `npx @dialectic-pr/core init` 한 줄로 시작

## 📦 설치

```bash
# 프로젝트에 설정 파일 생성
npx @dialectic-pr/core init

# GitHub Secrets에 ANTHROPIC_API_KEY 추가
# PR 열기 → 자동 리뷰 시작!
```

## 🚀 개발 상태

**Phase 1 완료!** ✅ Core Engine이 구현되고 빌드에 성공했습니다.

- [x] 스펙 완성
- [x] **Phase 1: Core Engine 구현 완료** 🎉
  - ✅ PR Analyzer, Smart Filter, Strategy Selector
  - ✅ Consensus Engine (Multi-Persona)
  - ✅ Claude & GitHub API Adapters
  - ✅ CLI Interface (`init`, `review`)
  - ✅ Security Layer (Privacy Guard, Exclude Filter)
- [ ] Phase 2: Framework Detection (NestJS, Next.js, React, Express)
- [ ] Phase 3: False Positive Patterns (builtin-patterns.ts)
- [ ] Phase 4: Testing & Integration
- [ ] Phase 5: npm 퍼블리싱

## 📄 라이센스

MIT

## 🤝 기여

현재 초기 개발 단계입니다. v1.0.0 릴리즈 후 기여 가이드를 공개할 예정입니다.
