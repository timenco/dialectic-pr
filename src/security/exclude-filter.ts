import { minimatch } from "minimatch";

/**
 * Exclude Filter
 * 민감 파일 및 리뷰 불필요 파일 제외 필터
 */
export class ExcludeFilter {
  private readonly defaultExcludes = [
    // 민감한 파일
    "**/.env*",
    "**/secrets/**",
    "**/*.pem",
    "**/*.key",
    "**/*.p12",
    "**/*.pfx",
    "**/id_rsa*",

    // Lock 파일
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/bun.lockb",
    "**/Pipfile.lock",
    "**/poetry.lock",

    // 빌드 결과물
    "**/*.min.js",
    "**/*.min.css",
    "**/*.bundle.js",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/.nuxt/**",

    // 의존성
    "**/node_modules/**",
    "**/.venv/**",
    "**/venv/**",

    // Python cache/build
    "**/__pycache__/**",
    "**/*.pyc",
    "**/.mypy_cache/**",
    "**/.pytest_cache/**",

    // 바이너리/이미지 파일
    "**/*.svg",
    "**/*.png",
    "**/*.jpg",
    "**/*.jpeg",
    "**/*.gif",
    "**/*.ico",
    "**/*.woff",
    "**/*.woff2",
    "**/*.ttf",
    "**/*.eot",

    // 생성된 파일
    "**/*.generated.ts",
    "**/*.generated.js",
    "**/generated/**",
    "**/__generated__/**",

    // 기타
    "**/.DS_Store",
    "**/Thumbs.db",
  ];

  private readonly allExcludes: string[];

  constructor(customExcludes: string[] = []) {
    this.allExcludes = [...this.defaultExcludes, ...customExcludes];
  }

  /**
   * 파일이 제외되어야 하는지 확인
   * @param filePath 파일 경로
   * @returns 제외되어야 하면 true
   */
  shouldExclude(filePath: string): boolean {
    return this.allExcludes.some((pattern) =>
      minimatch(filePath, pattern, { dot: true })
    );
  }

  /**
   * 제외된 파일 목록 반환
   * @param files 전체 파일 경로 배열
   * @returns 제외된 파일들
   */
  getExcludedFiles(files: string[]): string[] {
    return files.filter((f) => this.shouldExclude(f));
  }
}


