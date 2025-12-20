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
   * 파일 목록 필터링
   * @param files 파일 경로 배열
   * @returns 제외되지 않은 파일들
   */
  filterFiles(files: string[]): string[] {
    return files.filter((f) => !this.shouldExclude(f));
  }

  /**
   * 제외된 파일 목록 반환
   * @param files 전체 파일 경로 배열
   * @returns 제외된 파일들
   */
  getExcludedFiles(files: string[]): string[] {
    return files.filter((f) => this.shouldExclude(f));
  }

  /**
   * TypeScript/JavaScript 소스 파일인지 확인
   * @param filePath 파일 경로
   */
  isSourceFile(filePath: string): boolean {
    const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
    return sourceExtensions.some((ext) => filePath.endsWith(ext));
  }

  /**
   * 테스트 파일인지 확인
   * @param filePath 파일 경로
   */
  isTestFile(filePath: string): boolean {
    return (
      filePath.includes(".test.") ||
      filePath.includes(".spec.") ||
      filePath.includes("/__tests__/") ||
      filePath.includes("/tests/")
    );
  }

  /**
   * 설정 파일인지 확인
   * @param filePath 파일 경로
   */
  isConfigFile(filePath: string): boolean {
    const configExtensions = [".json", ".yaml", ".yml", ".toml", ".ini"];
    const configNames = [
      "package.json",
      "tsconfig.json",
      "jest.config",
      "vite.config",
      "next.config",
      "nest-cli.json",
    ];

    return (
      configExtensions.some((ext) => filePath.endsWith(ext)) ||
      configNames.some((name) => filePath.includes(name))
    );
  }

  /**
   * 제외 패턴 통계
   */
  getExcludeStats(files: string[]): {
    total: number;
    excluded: number;
    included: number;
    excludedByCategory: Record<string, number>;
  } {
    const excluded = this.getExcludedFiles(files);
    const excludedByCategory: Record<string, number> = {
      sensitive: 0,
      lockFiles: 0,
      build: 0,
      binary: 0,
      generated: 0,
      other: 0,
    };

    for (const file of excluded) {
      if (file.includes(".env") || file.includes("secret") || file.includes(".key")) {
        excludedByCategory.sensitive++;
      } else if (file.includes(".lock")) {
        excludedByCategory.lockFiles++;
      } else if (file.includes("/dist/") || file.includes("/build/")) {
        excludedByCategory.build++;
      } else if (
        file.match(/\.(png|jpg|svg|woff|ttf)$/)
      ) {
        excludedByCategory.binary++;
      } else if (file.includes("generated")) {
        excludedByCategory.generated++;
      } else {
        excludedByCategory.other++;
      }
    }

    return {
      total: files.length,
      excluded: excluded.length,
      included: files.length - excluded.length,
      excludedByCategory,
    };
  }
}

