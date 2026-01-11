import { ValidationError } from "../core/types.js";

/**
 * Privacy Guard
 * 데이터 전송 경고 및 시크릿 검증
 */
export class PrivacyGuard {
  private readonly secretPatterns: RegExp[] = [
    // API 키, 토큰 패턴
    /['"]?[a-zA-Z_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)['"]?\s*[:=]\s*['"][^'"]+['"]/gi,
    // Private Key 패턴
    /-----BEGIN (?:RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----/,
    // AWS 키
    /AKIA[0-9A-Z]{16}/,
    // Generic 시크릿 (명확한 값 할당)
    /(?:password|secret|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi,
  ];

  /**
   * 데이터 프라이버시 고지사항 출력
   */
  displayDisclaimer(): void {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║  ⚠️  DATA PRIVACY NOTICE                                           ║
║                                                                    ║
║  Your code diff will be sent to Anthropic's Claude API for        ║
║  analysis. By continuing, you acknowledge this data transfer.     ║
║                                                                    ║
║  To exclude sensitive files, configure 'exclude_patterns' in      ║
║  your .github/dialectic-pr.json                                   ║
║                                                                    ║
║  Docs: https://github.com/dialectic-pr/dialectic-pr#privacy       ║
╚════════════════════════════════════════════════════════════════════╝
    `);
  }

  /**
   * Diff에 시크릿이 포함되어 있는지 검증
   * @param diff PR diff 내용
   * @throws ValidationError 시크릿이 감지되면 예외 발생
   */
  validateNoSecrets(diff: string): void {
    for (const pattern of this.secretPatterns) {
      // RegExp를 복제하여 lastIndex 이슈 방지
      const regex = new RegExp(pattern.source, pattern.flags);
      const match = regex.exec(diff);

      if (match) {
        const preview = this.getPreview(match[0]);
        throw new ValidationError(
          `Potential secret detected in diff. Review aborted for security.\nPattern: ${preview}`,
          { pattern: pattern.source, match: preview }
        );
      }
    }
  }

  /**
   * 매칭된 내용의 안전한 미리보기 생성
   */
  private getPreview(match: string): string {
    if (match.length <= 50) {
      return match.substring(0, 30) + "...";
    }
    return match.substring(0, 30) + "...";
  }

  /**
   * CI 환경인지 확인
   */
  isCIEnvironment(): boolean {
    return !!(
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI
    );
  }

  /**
   * 필요한 환경변수가 설정되어 있는지 확인
   */
  validateEnvironment(requiredVars: string[]): void {
    const missing: string[] = [];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      throw new ValidationError(
        `Required environment variables are missing: ${missing.join(", ")}`,
        { missingVars: missing }
      );
    }
  }
}


