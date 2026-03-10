/**
 * Simple Logger with color support
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  private logLevel: LogLevel = "info";

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.debug(`🔍 [DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.info(`ℹ️  [INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn(`⚠️  [WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(`❌ [ERROR] ${message}`, ...args);
    }
  }

  success(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.log(`✅ [SUCCESS] ${message}`, ...args);
    }
  }

  /**
   * 섹션 헤더
   */
  section(title: string): void {
    if (this.shouldLog("info")) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`  ${title}`);
      console.log(`${"=".repeat(60)}\n`);
    }
  }
}

// Singleton instance
export const logger = new Logger();

/**
 * Extract only the safe error message from an unknown error.
 * Prevents leaking internal state, headers, or credentials
 * that may be embedded in the full error object.
 */
export function safeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}


