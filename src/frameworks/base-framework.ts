import {
  FrameworkName,
  FalsePositivePattern,
  PriorityRule,
  CRITICAL_MODULE_PATTERN,
} from "../core/types.js";
import {
  isTestFile,
  isSchemaFile,
  isConfigFile,
} from "../utils/file-classifier.js";

/**
 * Framework Interface
 * 각 프레임워크별 특화 룰, FP 패턴, 우선순위 규칙을 정의
 */
export interface Framework {
  /** 프레임워크 이름 */
  readonly name: FrameworkName;

  /**
   * 프레임워크별 리뷰 지침 (YAML 형식)
   * 이 지침은 Claude API 프롬프트에 포함됩니다.
   */
  getReviewInstructions(): string;

  /**
   * 프레임워크 특화 False Positive 패턴
   * AI가 이 패턴에 해당하는 이슈를 제기하면 FP로 간주됩니다.
   */
  getFalsePositivePatterns(): FalsePositivePattern[];

  /**
   * 영향받는 영역 감지
   * 변경된 파일을 기반으로 영향받는 아키텍처 영역을 식별합니다.
   */
  detectAffectedAreas(files: string[]): string[];

  /**
   * 프레임워크별 파일 우선순위 규칙
   * 어떤 파일이 리뷰에서 더 중요한지 결정합니다.
   */
  getPriorityRules(): PriorityRule[];

  /**
   * 특정 파일이 Critical 모듈인지 확인
   */
  isCriticalModule(filePath: string): boolean;

  /**
   * 프레임워크 특화 컨텍스트 플래그 추출
   */
  extractContextFlags(files: string[]): FrameworkContextFlags;
}

/**
 * Framework-specific context flags
 */
export interface FrameworkContextFlags {
  /** 테스트 파일 변경 여부 */
  testChanged: boolean;
  /** 스키마/엔티티 변경 여부 */
  schemaChanged: boolean;
  /** Critical 모듈 변경 여부 */
  criticalModule: boolean;
  /** 설정 파일만 변경 여부 */
  configOnly: boolean;
  /** 프레임워크별 추가 플래그 */
  [key: string]: boolean;
}

/**
 * Base Framework Implementation
 * 모든 프레임워크의 기본 구현을 제공합니다.
 */
export abstract class BaseFramework implements Framework {
  abstract readonly name: FrameworkName;

  abstract getReviewInstructions(): string;

  /**
   * 기본 False Positive 패턴 (공통)
   */
  getFalsePositivePatterns(): FalsePositivePattern[] {
    return [
      {
        id: "console-log-intentional",
        category: "logging",
        explanation: "Console.log in development/debug code may be intentional",
        falsePositiveIndicators: [
          "console.log should be removed",
          "use proper logging",
        ],
      },
      {
        id: "any-type-intentional",
        category: "validation",
        explanation: "Some 'any' types are intentional for flexibility",
        falsePositiveIndicators: [
          "avoid using any",
          "use proper type",
        ],
      },
    ];
  }

  /**
   * 기본 영향 영역 감지 (공통)
   */
  detectAffectedAreas(files: string[]): string[] {
    const areas: string[] = [];

    // Common critical areas
    if (files.some((f) => f.includes("/auth/"))) {
      areas.push("🔐 Auth");
    }
    if (files.some((f) => f.includes("/payments/") || f.includes("/billing/"))) {
      areas.push("💳 Payments");
    }
    if (files.some((f) => f.includes("/security/"))) {
      areas.push("🔒 Security");
    }
    if (files.some((f) => f.includes("/api/"))) {
      areas.push("🔌 API");
    }
    if (files.some((f) => isTestFile(f))) {
      areas.push("🧪 Tests");
    }

    return areas;
  }

  /**
   * 기본 우선순위 규칙 (공통)
   */
  getPriorityRules(): PriorityRule[] {
    return [
      // Critical: Security-related
      {
        pattern: CRITICAL_MODULE_PATTERN,
        priority: "critical",
        reason: "Security-critical module",
      },
      // High: Source code
      {
        pattern: /src\/.*\.(ts|tsx|js|jsx)$/,
        priority: "high",
        reason: "Source code",
      },
      // Normal: General code
      {
        pattern: /\.(ts|tsx|js|jsx)$/,
        priority: "normal",
        reason: "Code file",
      },
      // Low: Tests and configs
      {
        pattern: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
        priority: "low",
        reason: "Test file",
      },
      {
        pattern: /\.(json|yaml|yml|md)$/,
        priority: "low",
        reason: "Config/Doc file",
      },
    ];
  }

  /**
   * Critical 모듈 확인 (기본)
   */
  isCriticalModule(filePath: string): boolean {
    return (
      CRITICAL_MODULE_PATTERN.test(filePath) ||
      /\.(guard|middleware)\.(ts|js)$/.test(filePath)
    );
  }

  /**
   * 컨텍스트 플래그 추출 (기본)
   */
  extractContextFlags(files: string[]): FrameworkContextFlags {
    return {
      testChanged: files.some((f) => isTestFile(f)),
      schemaChanged: files.some((f) => isSchemaFile(f)),
      criticalModule: files.some((f) => this.isCriticalModule(f)),
      configOnly: files.every((f) => isConfigFile(f)),
    };
  }
}

/**
 * Framework Registry
 * 사용 가능한 모든 프레임워크 구현체를 관리합니다.
 */
export class FrameworkRegistry {
  private static frameworks: Map<FrameworkName, Framework> = new Map();

  /**
   * 프레임워크 등록
   */
  static register(framework: Framework): void {
    this.frameworks.set(framework.name, framework);
  }

  /**
   * 프레임워크 가져오기
   */
  static get(name: FrameworkName): Framework | undefined {
    return this.frameworks.get(name);
  }

  /**
   * 모든 등록된 프레임워크 이름 가져오기
   */
  static getRegisteredNames(): FrameworkName[] {
    return Array.from(this.frameworks.keys());
  }

  /**
   * 프레임워크가 등록되어 있는지 확인
   */
  static has(name: FrameworkName): boolean {
    return this.frameworks.has(name);
  }
}
