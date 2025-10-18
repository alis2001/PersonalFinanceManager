// Memory Optimization Utilities
// Helps prevent memory leaks and optimize performance

class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private cleanupFunctions: (() => void)[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private timeouts: NodeJS.Timeout[] = [];

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  // Register cleanup function
  registerCleanup(cleanupFn: () => void) {
    this.cleanupFunctions.push(cleanupFn);
  }

  // Register interval for cleanup
  registerInterval(interval: NodeJS.Timeout) {
    this.intervals.push(interval);
    return interval;
  }

  // Register timeout for cleanup
  registerTimeout(timeout: NodeJS.Timeout) {
    this.timeouts.push(timeout);
    return timeout;
  }

  // Create safe interval that gets cleaned up
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const interval = setInterval(callback, delay);
    return this.registerInterval(interval);
  }

  // Create safe timeout that gets cleaned up
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeout = setTimeout(callback, delay);
    return this.registerTimeout(timeout);
  }

  // Clean up all registered resources
  cleanup() {
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Clear all timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts = [];

    // Run all cleanup functions
    this.cleanupFunctions.forEach(cleanupFn => {
      try {
        cleanupFn();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });
    this.cleanupFunctions = [];
  }

  // Debounce function to prevent excessive calls
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = this.setTimeout(() => {
        func(...args);
      }, wait);
    };
  }

  // Throttle function to limit call frequency
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        
        this.setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }

  // Safe JSON parse that won't crash
  safeJsonParse<T>(jsonString: string, fallback: T): T {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('JSON parse error:', error);
      return fallback;
    }
  }

  // Safe JSON stringify that won't crash
  safeJsonStringify(obj: any, fallback: string = '{}'): string {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      console.error('JSON stringify error:', error);
      return fallback;
    }
  }
}

export const memoryOptimizer = MemoryOptimizer.getInstance();
export default memoryOptimizer;
