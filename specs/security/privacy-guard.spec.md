# Privacy Guard

## Purpose

Protects sensitive data by validating environment variables, displaying data privacy notices, and detecting secrets in code diffs before they're sent to external APIs.

## Location

[src/security/privacy-guard.ts](../../src/security/privacy-guard.ts)

## Dependencies

```yaml
internal:
  - core/types.spec.md (ValidationError)
external: []
```

## Core Responsibility

- Display data privacy disclaimer about sending code to Claude API
- Validate required environment variables are present
- Scan diffs for common secret patterns before API submission
- Block review if secrets detected
- Provide clear security error messages

## Key Interface

```typescript
export class PrivacyGuard {
  displayDisclaimer(): void;
  validateEnvironment(requiredVars: string[]): void;
  validateNoSecrets(diff: string): void;
}
```

## Secret Detection Patterns

Scans for common secret indicators:
- API keys, tokens, passwords in variable assignments
- Private keys (RSA, DSA, EC, OpenSSH)
- OpenAI-style keys (`sk-*`)
- GitHub personal access tokens (`ghp_*`)

Throws security error immediately if any pattern matches, aborting the review.

## Privacy Disclaimer

Displays a prominent notice that:
- Code will be sent to Anthropic's Claude API
- Users can configure `exclude_patterns` to skip sensitive files
- Links to privacy documentation

## Related Specs

- [exclude-filter.spec.md](./exclude-filter.spec.md) - File-level exclusion (complementary to secret detection)
- [types.spec.md](../core/types.spec.md) - ValidationError type
