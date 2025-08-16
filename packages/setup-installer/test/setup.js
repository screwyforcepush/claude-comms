/**
 * Jest setup file for NPX installer tests
 * Configures global test environment, mocks, and utilities
 */

// Global test timeout for network operations
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests unless explicitly testing them
const originalConsole = { ...console };

global.console = {
  ...console,
  log: jest.fn((...args) => {
    if (process.env.TEST_VERBOSE === 'true') {
      originalConsole.log(...args);
    }
  }),
  warn: jest.fn((...args) => {
    if (process.env.TEST_VERBOSE === 'true') {
      originalConsole.warn(...args);
    }
  }),
  error: originalConsole.error, // Always show errors
  info: jest.fn((...args) => {
    if (process.env.TEST_VERBOSE === 'true') {
      originalConsole.info(...args);
    }
  }),
  debug: jest.fn((...args) => {
    if (process.env.TEST_VERBOSE === 'true') {
      originalConsole.debug(...args);
    }
  })
};

// Global test utilities
global.testUtils = {
  // Restore real console for specific tests
  restoreConsole: () => {
    global.console = originalConsole;
  },

  // Mock console for specific tests
  mockConsole: () => {
    global.console = {
      ...console,
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
  },

  // Wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Create temporary test directory
  createTempDir: () => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const tempDir = path.join(os.tmpdir(), `claude-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  },

  // Clean up temporary directory
  cleanupTempDir: (dir) => {
    const fs = require('fs');
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
};

// Environment variables for testing
process.env.NODE_ENV = 'test';
process.env.CI = 'true';
process.env.FORCE_COLOR = '0'; // Disable colors in CI

// Mock external network calls by default
// Tests can override this with nock or by setting TEST_ALLOW_NETWORK=true
if (process.env.TEST_ALLOW_NETWORK !== 'true') {
  const nock = require('nock');

  // Disable all network calls except localhost
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');
  nock.enableNetConnect('localhost');

  // Clean up nock after each test
  afterEach(() => {
    if (!nock.isDone()) {
      console.warn('Nock interceptors not satisfied:', nock.pendingMocks());
    }
    nock.cleanAll();
  });
}

// Global teardown
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();

  // Clear all mocks
  jest.clearAllMocks();

  // Reset modules
  jest.resetModules();
});

// Performance monitoring for tests
const performanceObserver = {
  start: Date.now(),
  testStart: null,

  markTestStart: () => {
    performanceObserver.testStart = Date.now();
  },

  markTestEnd: (testName) => {
    const duration = Date.now() - performanceObserver.testStart;
    if (duration > 5000) { // Warn about slow tests
      console.warn(`⚠️  Slow test detected: ${testName} took ${duration}ms`);
    }
  }
};

beforeEach(() => {
  performanceObserver.markTestStart();
});

afterEach(() => {
  const testName = expect.getState().currentTestName;
  if (testName) {
    performanceObserver.markTestEnd(testName);
  }
});

// Custom matchers
expect.extend({
  toBeValidPath(received) {
    const path = require('path');
    const isValid = path.isAbsolute(received) || path.normalize(received) === received;

    return {
      message: () => `expected ${received} to be a valid file path`,
      pass: isValid
    };
  },

  toBeExecutable(received) {
    const fs = require('fs');
    const isExecutable = fs.existsSync(received) &&
                        (fs.statSync(received).mode & parseInt('111', 8)) !== 0;

    return {
      message: () => `expected ${received} to be an executable file`,
      pass: isExecutable
    };
  },

  toHaveValidGitHubResponse(received) {
    const isValid = received &&
                   typeof received === 'object' &&
                   received.content !== undefined &&
                   received.type !== undefined;

    return {
      message: () => 'expected response to be a valid GitHub API response',
      pass: isValid
    };
  }
});

// Global error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in tests, but log the error
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit in tests, but log the error
});
