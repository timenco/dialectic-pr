# Logger

## Purpose

Provides structured console logging with configurable log levels and consistent emoji-prefixed output formatting.

## Location

[src/utils/logger.ts](../../src/utils/logger.ts)

## Dependencies

```yaml
external: []
internal: []
```

## Core Responsibility

- Output formatted log messages to console
- Support multiple log levels (debug, info, warn, error)
- Filter messages based on configured log level
- Provide semantic logging methods (success, section)
- Use consistent emoji prefixes for visual scanning

## Key Interface

```typescript
export class Logger {
  setLogLevel(level: LogLevel): void;

  debug(message: string): void;    // 🔍
  info(message: string): void;     // ℹ️
  warn(message: string): void;     // ⚠️
  error(message: string): void;    // ❌
  success(message: string): void;  // ✅
  section(title: string): void;    // ====
}

export const logger: Logger;

type LogLevel = "debug" | "info" | "warn" | "error";
```

## Log Level Behavior

- **debug**: Shows all messages (debug, info, warn, error)
- **info**: Shows info, warn, error (suppresses debug)
- **warn**: Shows warn, error (suppresses debug, info)
- **error**: Shows only error messages

Default level is `info`.

## Related Specs

Used throughout the codebase for consistent logging. No specific dependencies.
