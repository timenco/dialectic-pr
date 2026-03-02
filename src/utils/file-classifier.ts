/**
 * File Classification Utilities
 * 파일 유형 판별을 위한 단일 진실 공급원 (Single Source of Truth)
 */

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

const TEST_INDICATORS = [".test.", ".spec.", "/__tests__/", "/tests/"];

const SCHEMA_INDICATORS = [".entity.", ".schema.", ".model.", "/migrations/"];

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
  return TEST_INDICATORS.some((indicator) => filePath.includes(indicator));
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
