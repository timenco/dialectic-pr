/**
 * File Classification Utilities
 * 파일 유형 판별을 위한 단일 진실 공급원 (Single Source of Truth)
 */

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"];

const TEST_INDICATORS = [".test.", ".spec.", "/__tests__/", "/tests/"];

/** Python 테스트 파일 패턴 (test_*.py, *_test.py, conftest.py) */
const PYTHON_TEST_PATTERNS = [/test_.*\.py$/, /_test\.py$/, /conftest\.py$/];

const SCHEMA_INDICATORS = [".entity.", ".schema.", ".model.", "/migrations/", "/models.py", "/alembic/"];

const CONFIG_EXTENSIONS = [".json", ".yaml", ".yml", ".toml", ".ini", ".md"];
const CONFIG_NAMES = [
  "package.json",
  "tsconfig.json",
  "jest.config",
  "vite.config",
  "next.config",
  "nest-cli.json",
  ".eslintrc",
  ".prettierrc",
  "pyproject.toml",
  "requirements.txt",
];

/**
 * TypeScript/JavaScript 소스 파일인지 확인
 */
export function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

/**
 * 테스트 파일인지 확인
 */
export function isTestFile(filePath: string): boolean {
  return (
    TEST_INDICATORS.some((indicator) => filePath.includes(indicator)) ||
    PYTHON_TEST_PATTERNS.some((pattern) => pattern.test(filePath))
  );
}

/**
 * 스키마/엔티티 파일인지 확인
 */
export function isSchemaFile(filePath: string): boolean {
  return SCHEMA_INDICATORS.some((indicator) => filePath.includes(indicator));
}

/**
 * 설정 파일인지 확인
 */
export function isConfigFile(filePath: string): boolean {
  return (
    CONFIG_EXTENSIONS.some((ext) => filePath.endsWith(ext)) ||
    CONFIG_NAMES.some((name) => filePath.includes(name))
  );
}
