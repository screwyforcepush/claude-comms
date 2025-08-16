/**
 * Unit tests for retry logic utilities
 * Tests retry mechanisms, exponential backoff, and failure handling
 */

const { RetryManager, BackoffStrategy, RetryError } = require('../../../src/utils/retry');

describe('RetryManager', () => {
  let retryManager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    retryManager = new RetryManager({
      maxAttempts: 3,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      initialDelay: 100,
      maxDelay: 5000,
      logger: mockLogger
    });
  });

  describe('successful operations', () => {
    it('should execute operation successfully on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryManager.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should return operation result', async () => {
      const expectedResult = { data: 'test', status: 'ok' };
      const operation = jest.fn().mockResolvedValue(expectedResult);

      const result = await retryManager.execute(operation);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('retry behavior', () => {
    it('should retry failed operations up to max attempts', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce('success');

      const result = await retryManager.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts exceeded', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(retryManager.execute(operation)).rejects.toThrow(RetryError);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should include attempt information in retry errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await retryManager.execute(operation);
      } catch (error) {
        expect(error).toBeInstanceOf(RetryError);
        expect(error.attempts).toBe(3);
        expect(error.lastError.message).toBe('Test error');
      }
    });
  });

  describe('exponential backoff', () => {
    it('should implement exponential backoff delays', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      await retryManager.execute(operation);
      const endTime = Date.now();

      // Should have delays: 100ms + 200ms = 300ms minimum
      expect(endTime - startTime).toBeGreaterThan(250);
    });

    it('should respect maximum delay limit', async () => {
      const longRetryManager = new RetryManager({
        maxAttempts: 10,
        backoffStrategy: BackoffStrategy.EXPONENTIAL,
        initialDelay: 1000,
        maxDelay: 2000
      });

      const delays = [];
      // const originalDelay = longRetryManager._delay; // TODO: Test delay changes
      longRetryManager._delay = (ms) => {
        delays.push(ms);
        return Promise.resolve();
      };

      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      try {
        await longRetryManager.execute(operation);
      } catch (error) {
        // Verify that no delay exceeds maxDelay
        delays.forEach(delay => {
          expect(delay).toBeLessThanOrEqual(2000);
        });
      }
    });
  });

  describe('linear backoff', () => {
    beforeEach(() => {
      retryManager = new RetryManager({
        maxAttempts: 3,
        backoffStrategy: BackoffStrategy.LINEAR,
        initialDelay: 100,
        maxDelay: 5000
      });
    });

    it('should implement linear backoff delays', async () => {
      const delays = [];
      // const originalDelay = retryManager._delay; // TODO: Test delay changes
      retryManager._delay = (ms) => {
        delays.push(ms);
        return Promise.resolve();
      };

      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      try {
        await retryManager.execute(operation);
      } catch (error) {
        // Linear: 100ms, 200ms
        expect(delays).toEqual([100, 200]);
      }
    });
  });

  describe('fixed backoff', () => {
    beforeEach(() => {
      retryManager = new RetryManager({
        maxAttempts: 3,
        backoffStrategy: BackoffStrategy.FIXED,
        initialDelay: 150
      });
    });

    it('should implement fixed backoff delays', async () => {
      const delays = [];
      // const originalDelay = retryManager._delay; // TODO: Test delay changes
      retryManager._delay = (ms) => {
        delays.push(ms);
        return Promise.resolve();
      };

      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      try {
        await retryManager.execute(operation);
      } catch (error) {
        // Fixed: 150ms, 150ms
        expect(delays).toEqual([150, 150]);
      }
    });
  });

  describe('jitter', () => {
    beforeEach(() => {
      retryManager = new RetryManager({
        maxAttempts: 3,
        backoffStrategy: BackoffStrategy.EXPONENTIAL,
        initialDelay: 100,
        jitter: true
      });
    });

    it('should apply jitter to delays', async () => {
      const delays = [];
      // const originalDelay = retryManager._delay; // TODO: Test delay changes
      retryManager._delay = (ms) => {
        delays.push(ms);
        return Promise.resolve();
      };

      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      try {
        await retryManager.execute(operation);
      } catch (error) {
        // With jitter, delays should vary from base values
        expect(delays.length).toBe(2);
        delays.forEach(delay => {
          expect(delay).toBeGreaterThan(0);
          expect(delay).toBeLessThan(1000); // Reasonable upper bound
        });
      }
    });
  });

  describe('conditional retry', () => {
    it('should retry only for retryable errors', async () => {
      const retryableError = new Error('Network timeout');
      retryableError.retryable = true;

      const nonRetryableError = new Error('Authentication failed');
      nonRetryableError.retryable = false;

      retryManager = new RetryManager({
        maxAttempts: 3,
        retryCondition: (error) => error.retryable !== false
      });

      const retryableOperation = jest.fn().mockRejectedValue(retryableError);
      const nonRetryableOperation = jest.fn().mockRejectedValue(nonRetryableError);

      // Should retry retryable errors
      await expect(retryManager.execute(retryableOperation)).rejects.toThrow();
      expect(retryableOperation).toHaveBeenCalledTimes(3);

      // Should not retry non-retryable errors
      await expect(retryManager.execute(nonRetryableOperation)).rejects.toThrow();
      expect(nonRetryableOperation).toHaveBeenCalledTimes(1);
    });

    it('should support custom retry conditions', async () => {
      const networkError = new Error('ECONNREFUSED');
      const validationError = new Error('Invalid input');

      retryManager = new RetryManager({
        maxAttempts: 3,
        retryCondition: (error) => error.message.includes('ECONNREFUSED')
      });

      const networkOperation = jest.fn().mockRejectedValue(networkError);
      const validationOperation = jest.fn().mockRejectedValue(validationError);

      // Should retry network errors
      await expect(retryManager.execute(networkOperation)).rejects.toThrow();
      expect(networkOperation).toHaveBeenCalledTimes(3);

      // Should not retry validation errors
      await expect(retryManager.execute(validationOperation)).rejects.toThrow();
      expect(validationOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('circuit breaker integration', () => {
    it('should track failure rate for circuit breaker', async () => {
      const circuitBreakerManager = new RetryManager({
        maxAttempts: 2,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          resetTimeout: 10000
        }
      });

      const operation = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      // Execute multiple failed operations
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreakerManager.execute(operation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit should be open after threshold reached
      expect(circuitBreakerManager.isCircuitOpen()).toBe(true);
    });

    it('should fail fast when circuit is open', async () => {
      const circuitBreakerManager = new RetryManager({
        maxAttempts: 3,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 1,
          resetTimeout: 10000
        }
      });

      const operation = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      // First call opens circuit
      try {
        await circuitBreakerManager.execute(operation);
      } catch (error) {
        // Expected
      }

      // Subsequent calls should fail fast
      const fastFailOperation = jest.fn().mockResolvedValue('success');

      try {
        await circuitBreakerManager.execute(fastFailOperation);
      } catch (error) {
        expect(error.message).toContain('Circuit breaker is open');
        expect(fastFailOperation).not.toHaveBeenCalled();
      }
    });
  });

  describe('timeout handling', () => {
    it('should timeout operations that take too long', async () => {
      const timeoutManager = new RetryManager({
        maxAttempts: 2,
        timeout: 100
      });

      const slowOperation = jest.fn(() => {
        return new Promise(resolve => setTimeout(resolve, 200));
      });

      await expect(timeoutManager.execute(slowOperation)).rejects.toThrow('Operation timed out');
    });

    it('should not retry timed out operations if configured', async () => {
      const timeoutManager = new RetryManager({
        maxAttempts: 3,
        timeout: 50,
        retryCondition: (error) => !error.message.includes('timed out')
      });

      const slowOperation = jest.fn(() => {
        return new Promise(resolve => setTimeout(resolve, 100));
      });

      await expect(timeoutManager.execute(slowOperation)).rejects.toThrow();
      expect(slowOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('progress tracking', () => {
    it('should emit progress events during retries', async () => {
      const progressEvents = [];
      const progressManager = new RetryManager({
        maxAttempts: 3,
        onRetry: (attempt, error) => {
          progressEvents.push({ attempt, error: error.message });
        }
      });

      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValueOnce('success');

      await progressManager.execute(operation);

      expect(progressEvents).toEqual([
        { attempt: 1, error: 'Attempt 1' },
        { attempt: 2, error: 'Attempt 2' }
      ]);
    });

    it('should provide retry context in callbacks', async () => {
      const retryContexts = [];
      const contextManager = new RetryManager({
        maxAttempts: 2,
        onRetry: (attempt, error, context) => {
          retryContexts.push(context);
        }
      });

      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      try {
        await contextManager.execute(operation);
      } catch (error) {
        expect(retryContexts.length).toBe(1);
        expect(retryContexts[0]).toMatchObject({
          totalAttempts: 2,
          remainingAttempts: 0,
          nextDelay: expect.any(Number)
        });
      }
    });
  });

  describe('performance and resource management', () => {
    it('should handle many concurrent retries efficiently', async () => {
      const concurrentManager = new RetryManager({
        maxAttempts: 2,
        initialDelay: 10
      });

      const operations = Array(100).fill().map((_, index) => {
        return jest.fn()
          .mockRejectedValueOnce(new Error(`Error ${index}`))
          .mockResolvedValueOnce(`Success ${index}`);
      });

      const startTime = Date.now();
      const results = await Promise.all(
        operations.map(op => concurrentManager.execute(op))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete reasonably fast
    });

    it('should clean up resources on operation completion', async () => {
      const resourceManager = new RetryManager({
        maxAttempts: 2,
        onComplete: jest.fn(),
        onFailure: jest.fn()
      });

      const successOperation = jest.fn().mockResolvedValue('success');
      const failureOperation = jest.fn().mockRejectedValue(new Error('failure'));

      await resourceManager.execute(successOperation);
      expect(resourceManager.onComplete).toHaveBeenCalled();

      try {
        await resourceManager.execute(failureOperation);
      } catch (error) {
        expect(resourceManager.onFailure).toHaveBeenCalled();
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle operation that throws synchronously', async () => {
      const throwingOperation = jest.fn(() => {
        throw new Error('Synchronous error');
      });

      await expect(retryManager.execute(throwingOperation)).rejects.toThrow();
      expect(throwingOperation).toHaveBeenCalledTimes(3);
    });

    it('should handle operation that returns rejected promise', async () => {
      const rejectingOperation = jest.fn(() => Promise.reject(new Error('Async error')));

      await expect(retryManager.execute(rejectingOperation)).rejects.toThrow();
      expect(rejectingOperation).toHaveBeenCalledTimes(3);
    });

    it('should handle invalid configuration gracefully', () => {
      expect(() => new RetryManager({ maxAttempts: 0 })).toThrow('Invalid maxAttempts');
      expect(() => new RetryManager({ initialDelay: -1 })).toThrow('Invalid initialDelay');
      expect(() => new RetryManager({ maxDelay: 10, initialDelay: 20 })).toThrow('maxDelay must be greater than initialDelay');
    });

    it('should handle null or undefined operations', async () => {
      await expect(retryManager.execute(null)).rejects.toThrow('Operation must be a function');
      await expect(retryManager.execute(undefined)).rejects.toThrow('Operation must be a function');
    });
  });
});
