/**
 * Retry utility with exponential backoff logic
 * Provides resilient operation patterns for network and file system operations
 */

const { ErrorFactory } = require('./errors');

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000,        // 1 second base delay
  maxDelay: 30000,        // 30 seconds max delay
  backoffFactor: 2,       // Exponential factor
  jitter: true,           // Add randomness to prevent thundering herd
  jitterFactor: 0.1,      // 10% jitter
  retryCondition: null,   // Function to determine if error is retryable
  onRetry: null           // Callback function called before each retry
};

/**
 * Retry an async operation with exponential backoff
 */
async function retry(operation, options = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };

  let lastError;
  let attempt = 0;

  while (attempt < config.maxAttempts) {
    attempt++;

    try {
      const result = await operation(attempt);
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!shouldRetry(error, config.retryCondition, attempt, config.maxAttempts)) {
        throw error;
      }

      // Don't delay after the last attempt
      if (attempt >= config.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = calculateDelay(attempt, config);

      // Call retry callback if provided
      if (config.onRetry) {
        await config.onRetry(error, attempt, delay);
      }

      // Wait before next attempt
      await sleep(delay);
    }
  }

  // All attempts exhausted
  throw ErrorFactory.fromCaught(lastError, `Failed after ${config.maxAttempts} attempts`);
}

/**
 * Determine if an error should trigger a retry
 */
function shouldRetry(error, retryCondition, attempt, maxAttempts) {
  // Don't retry if we've exhausted attempts
  if (attempt >= maxAttempts) {
    return false;
  }

  // Use custom retry condition if provided
  if (retryCondition) {
    return retryCondition(error, attempt);
  }

  // Default retry conditions
  if (error.isRecoverable && error.isRecoverable()) {
    return true;
  }

  // Network and GitHub API errors are generally retryable
  const retryableTypes = ['NetworkError', 'GitHubAPIError'];
  if (retryableTypes.includes(error.constructor.name)) {
    return true;
  }

  // Rate limit errors should be retried
  if (error.code === 'GITHUB_RATE_LIMIT' || error.code === 'NETWORK_TIMEOUT') {
    return true;
  }

  // Server errors (5xx) should be retried
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // ECONNRESET, ETIMEDOUT, ENOTFOUND are typically temporary
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt, config) {
  // Base exponential backoff: baseDelay * (backoffFactor ^ (attempt - 1))
  let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);

  // Cap at max delay
  delay = Math.min(delay, config.maxDelay);

  // Add jitter to prevent thundering herd
  if (config.jitter) {
    const jitterRange = delay * config.jitterFactor;
    const jitterOffset = (Math.random() - 0.5) * 2 * jitterRange;
    delay = Math.max(0, delay + jitterOffset);
  }

  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for common operations
 */
class RetryWrapper {
  constructor(config = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Retry an HTTP fetch operation
   */
  async fetch(url, options = {}) {
    return retry(async (_attempt) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': '@claude-code/setup-installer',
          ...options.headers
        }
      });

      // Check for HTTP errors
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }

      return response;
    }, {
      ...this.config,
      retryCondition: (error, _attempt) => {
        // Retry on network errors and 5xx server errors
        return error.status >= 500 || !error.status;
      },
      onRetry: (error, attempt, delay) => {
        if (this.config.logger) {
          this.config.logger.warn(
            `HTTP request failed (attempt ${attempt}), retrying in ${delay}ms: ${error.message}`,
            { url, attempt, delay }
          );
        }
      }
    });
  }

  /**
   * Retry a file system operation
   */
  async fileOperation(operation, operationName = 'file operation') {
    return retry(operation, {
      ...this.config,
      retryCondition: (error, _attempt) => {
        // Retry on temporary file system errors
        const retryableCodes = ['EMFILE', 'ENFILE', 'EAGAIN', 'EBUSY'];
        return error.code && retryableCodes.includes(error.code);
      },
      onRetry: (error, attempt, delay) => {
        if (this.config.logger) {
          this.config.logger.warn(
            `${operationName} failed (attempt ${attempt}), retrying in ${delay}ms: ${error.message}`,
            { operation: operationName, attempt, delay }
          );
        }
      }
    });
  }

  /**
   * Retry with custom configuration
   */
  async withConfig(operation, customConfig) {
    const mergedConfig = { ...this.config, ...customConfig };
    return retry(operation, mergedConfig);
  }
}

/**
 * Pre-configured retry wrappers for common scenarios
 */
const retryPresets = {
  /**
   * GitHub API operations with rate limit handling
   */
  github: new RetryWrapper({
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 60000,
    retryCondition: (error, _attempt) => {
      // Always retry rate limits with longer delays
      if (error.code === 'GITHUB_RATE_LIMIT') {
        return true;
      }
      // Retry server errors and network issues
      return error.status >= 500 || !error.status;
    }
  }),

  /**
   * Network operations with fast retry
   */
  network: new RetryWrapper({
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    retryCondition: (error, _attempt) => {
      const networkCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
      return error.code && networkCodes.includes(error.code);
    }
  }),

  /**
   * File system operations with quick retry
   */
  filesystem: new RetryWrapper({
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    jitterFactor: 0.2,
    retryCondition: (error, _attempt) => {
      const fsCodes = ['EMFILE', 'ENFILE', 'EAGAIN', 'EBUSY'];
      return error.code && fsCodes.includes(error.code);
    }
  })
};

/**
 * Circuit breaker pattern for failing operations
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.monitoringPeriod = options.monitoringPeriod || 60000;

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw ErrorFactory.network('Circuit breaker is OPEN - too many failures');
      }
    }

    try {
      const result = await operation();

      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= 3) {
          this.reset();
        }
      } else {
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a failure and potentially open the circuit
   */
  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    }
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  /**
   * Get current circuit breaker status
   */
  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

module.exports = {
  retry,
  RetryWrapper,
  CircuitBreaker,
  retryPresets,
  calculateDelay,
  shouldRetry,
  sleep,
  DEFAULT_RETRY_CONFIG
};
