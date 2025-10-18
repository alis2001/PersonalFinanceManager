// Global Error Handler Service
// Handles unhandled errors and promise rejections

class ErrorHandler {
  private static instance: ErrorHandler;
  private isInitialized = false;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  initialize() {
    if (this.isInitialized) {
      return;
    }

    // Handle unhandled promise rejections
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    }

    // Handle global errors
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('error', this.handleGlobalError);
    }

    this.isInitialized = true;
    console.log('🛡️ ErrorHandler initialized');
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('🚨 Unhandled Promise Rejection:', event.reason);
    
    // Prevent the default behavior (which would crash the app)
    event.preventDefault();
    
    // Log the error for debugging
    this.logError('Unhandled Promise Rejection', event.reason);
  };

  private handleGlobalError = (event: ErrorEvent) => {
    console.error('🚨 Global Error:', event.error);
    
    // Log the error for debugging
    this.logError('Global Error', event.error);
  };

  private logError(type: string, error: any) {
    const errorInfo = {
      type,
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    };

    console.error('Error Details:', errorInfo);
    
    // In production, you would send this to an error reporting service
    // For now, we'll just log it
  }

  // Safe async wrapper that catches and handles errors
  async safeAsync<T>(asyncFn: () => Promise<T>, fallback?: T): Promise<T | undefined> {
    try {
      return await asyncFn();
    } catch (error) {
      console.error('Safe async error:', error);
      this.logError('Safe Async Error', error);
      return fallback;
    }
  }

  // Safe sync wrapper that catches and handles errors
  safeSync<T>(syncFn: () => T, fallback?: T): T | undefined {
    try {
      return syncFn();
    } catch (error) {
      console.error('Safe sync error:', error);
      this.logError('Safe Sync Error', error);
      return fallback;
    }
  }

  // Cleanup method
  cleanup() {
    if (typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
      window.removeEventListener('error', this.handleGlobalError);
    }
    this.isInitialized = false;
  }
}

export const errorHandler = ErrorHandler.getInstance();
export default errorHandler;
