# PRIVACY GUARD SPECIFICATION

## DEPENDENCIES
```yaml
internal:
  - core/types.spec.md
external: []
```

## FILE_PATH
```
src/security/privacy-guard.ts
```

## CLASS_INTERFACE
```typescript
export class PrivacyGuard {
  displayDisclaimer(): void;
  validateEnvironment(requiredVars: string[]): void;
  validateNoSecrets(diff: string): void;
}
```

## IMPLEMENTATION
```typescript
import { ValidationError } from "../core/types.js";

export class PrivacyGuard {
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

  validateEnvironment(requiredVars: string[]): void {
    const missing = requiredVars.filter(v => !process.env[v]);
    
    if (missing.length > 0) {
      throw new ValidationError(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }
  }

  validateNoSecrets(diff: string): void {
    const secretPatterns = [
      /['"]?[a-zA-Z_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)['"]?\s*[:=]\s*['"][^'"]+['"]/gi,
      /-----BEGIN (?:RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/,
      /sk-[a-zA-Z0-9]{20,}/,  // OpenAI-style keys
      /ghp_[a-zA-Z0-9]{36}/,  // GitHub personal access tokens
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(diff)) {
        throw new Error(
          "⚠️ SECURITY: Potential secret detected in diff. Review aborted. " +
          "Remove secrets before committing."
        );
      }
    }
  }
}
```

## SECRET_PATTERNS
```yaml
api_keys:
  - API_KEY|SECRET|TOKEN|PASSWORD followed by value
  
private_keys:
  - BEGIN RSA|DSA|EC|OPENSSH PRIVATE KEY
  
tokens:
  - sk-* (OpenAI style)
  - ghp_* (GitHub tokens)
```

## TEST_CASES
```yaml
test_clean_diff:
  input: "console.log('hello');"
  assert: no_exception

test_api_key_detected:
  input: "API_KEY = 'secret123'"
  assert: throws_error

test_private_key_detected:
  input: "-----BEGIN RSA PRIVATE KEY-----"
  assert: throws_error
```

