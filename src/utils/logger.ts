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
   * 진행 상황 로그
   */
  progress(message: string, current: number, total: number): void {
    if (this.shouldLog("info")) {
      const percentage = Math.round((current / total) * 100);
      console.log(`📊 [${current}/${total}] (${percentage}%) ${message}`);
    }
  }

  /**
   * 타이머 시작
   */
  time(label: string): void {
    console.time(`⏱️  ${label}`);
  }

  /**
   * 타이머 종료
   */
  timeEnd(label: string): void {
    console.timeEnd(`⏱️  ${label}`);
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


