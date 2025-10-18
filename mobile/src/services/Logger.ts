// Production-Safe Logger Service
// Reduces console.log statements in production builds

class Logger {
  private static instance: Logger;
  private isDevelopment = __DEV__;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // Only log in development
  log(...args: any[]) {
    if (this.isDevelopment) {
      console.log(...args);
    }
  }

  // Always log errors
  error(...args: any[]) {
    console.error(...args);
  }

  // Only log warnings in development
  warn(...args: any[]) {
    if (this.isDevelopment) {
      console.warn(...args);
    }
  }

  // Only log info in development
  info(...args: any[]) {
    if (this.isDevelopment) {
      console.info(...args);
    }
  }

  // Debug logs (only in development)
  debug(...args: any[]) {
    if (this.isDevelopment) {
      console.debug(...args);
    }
  }

  // Performance logs (only in development)
  time(label: string) {
    if (this.isDevelopment) {
      console.time(label);
    }
  }

  timeEnd(label: string) {
    if (this.isDevelopment) {
      console.timeEnd(label);
    }
  }

  // Group logs (only in development)
  group(label: string) {
    if (this.isDevelopment) {
      console.group(label);
    }
  }

  groupEnd() {
    if (this.isDevelopment) {
      console.groupEnd();
    }
  }
}

export const logger = Logger.getInstance();
export default logger;
