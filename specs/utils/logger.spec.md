# LOGGER SPECIFICATION

## DEPENDENCIES
```yaml
external: []
internal: []
```

## FILE_PATH
```
src/utils/logger.ts
```

## CLASS_INTERFACE
```typescript
export class Logger {
  setLogLevel(level: LogLevel): void;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
  section(title: string): void;
}

export const logger: Logger;
```

## IMPLEMENTATION
```typescript
import { LogLevel } from "../core/types.js";

export class Logger {
  private logLevel: LogLevel = "info";
  
  private readonly logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  debug(message: string): void {
    if (this.shouldLog("debug")) {
      console.log(`🔍 ${message}`);
    }
  }

  info(message: string): void {
    if (this.shouldLog("info")) {
      console.log(`ℹ️  ${message}`);
    }
  }

  warn(message: string): void {
    if (this.shouldLog("warn")) {
      console.warn(`⚠️  ${message}`);
    }
  }

  error(message: string): void {
    if (this.shouldLog("error")) {
      console.error(`❌ ${message}`);
    }
  }

  success(message: string): void {
    if (this.shouldLog("info")) {
      console.log(`✅ ${message}`);
    }
  }

  section(title: string): void {
    if (this.shouldLog("info")) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`  ${title}`);
      console.log(`${"=".repeat(60)}\n`);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }
}

export const logger = new Logger();
```

## BEHAVIOR
```yaml
log_level_debug:
  all_messages_printed: true

log_level_info:
  debug_suppressed: true
  info_warn_error_printed: true

log_level_warn:
  debug_info_suppressed: true
  warn_error_printed: true

log_level_error:
  only_error_printed: true
```

