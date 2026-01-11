/**
 * False Positive Defense System
 * AI 리뷰의 False Positive를 방지하기 위한 패턴 매칭 시스템
 */

// Builtin patterns
export {
  BUILTIN_PATTERNS,
  getPatternsByCategory,
  getPatternById,
  getAllPatternIds,
} from "./builtin-patterns.js";

// Pattern matcher
export { PatternMatcher, PatternMatchResult } from "./pattern-matcher.js";

// Project rules loader
export { ProjectRulesLoader } from "./project-rules-loader.js";
