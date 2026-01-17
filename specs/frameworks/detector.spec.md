# Framework Detector

## Purpose

Automatically detects the web framework used in a codebase by analyzing package.json dependencies and file patterns, enabling framework-specific review strategies.

## Location

[src/frameworks/detector.ts](../../src/frameworks/detector.ts)

## Dependencies

```yaml
internal:
  - core/types.spec.md
  - utils/logger.spec.md
external:
  - fs/promises
```

## Core Responsibility

- Parse package.json to identify framework dependencies
- Analyze file patterns to detect framework-specific conventions
- Extract framework version information
- Prioritize framework detection (NestJS > Next.js > React > Express > Vanilla)
- Return framework metadata with confidence levels
- Default to vanilla TypeScript/JavaScript when no framework detected

## Key Interface

```typescript
export class FrameworkDetector {
  async detect(rootPath: string, files: string[]): Promise<DetectedFramework>;
}

interface DetectedFramework {
  name: "nestjs" | "nextjs" | "react" | "express" | "vanilla";
  confidence: "high" | "medium";
  version?: string;
}
```

## Detection Strategy

Framework detection follows a priority-based approach:

1. **NestJS**: `@nestjs/core` dependency or files matching `.module.ts`, `.controller.ts`, `.service.ts`
2. **Next.js**: `next` dependency or files matching `next.config`, `/app/page.tsx`, `/pages/_app.`
3. **React**: `react` dependency (excluding Next.js) or `.tsx`/`.jsx` files
4. **Express**: `express` dependency
5. **Vanilla**: Default fallback for any TypeScript/JavaScript project

Version extraction strips semver prefixes (`^`, `~`, `>=`) from package.json values.

## Related Specs

- [types.spec.md](../core/types.spec.md) - DetectedFramework type definition
- [consensus-prompt.spec.md](../prompts/consensus-prompt.spec.md) - Uses framework info for tailored instructions
