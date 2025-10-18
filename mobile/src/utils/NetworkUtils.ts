// Network Utilities for React Native
// Provides timeout and error handling for network requests

export interface NetworkRequestOptions extends RequestInit {
  timeout?: number; // Timeout in milliseconds, default 30000
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public url?: string
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Creates a timeout promise that rejects after the specified time
 */
function createTimeoutPromise(timeout: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(timeout));
    }, timeout);
  });
}

/**
 * Makes a network request with timeout support for React Native
 */
export async function fetchWithTimeout(
  url: string,
  options: NetworkRequestOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;
  
  // Create timeout promise
  const timeoutPromise = createTimeoutPromise(timeout);
  
  // Create fetch promise
  const fetchPromise = fetch(url, fetchOptions);
  
  try {
    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    // Check if response is ok
    if (!response.ok) {
      throw new NetworkError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response.statusText,
        url
      );
    }
    
    return response;
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw error;
    }
    if (error instanceof NetworkError) {
      throw error;
    }
    // Handle other errors (network connectivity, etc.)
    throw new NetworkError(
      error instanceof Error ? error.message : 'Network request failed',
      undefined,
      undefined,
      url
    );
  }
}

/**
 * Makes a JSON request with timeout support
 */
export async function fetchJsonWithTimeout<T = any>(
  url: string,
  options: NetworkRequestOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  try {
    return await response.json();
  } catch (error) {
    throw new NetworkError(
      'Failed to parse JSON response',
      response.status,
      response.statusText,
      url
    );
  }
}

/**
 * Retry a network request with exponential backoff
 */
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on certain errors
      if (error instanceof NetworkError && error.status && error.status < 500) {
        throw error; // Don't retry client errors (4xx)
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
