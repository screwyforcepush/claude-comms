import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * RECOMMENDED Vitest Configuration
 * Fixes memory issues and improves test isolation
 * 
 * Key improvements:
 * - Thread pool isolation to prevent memory leaks
 * - Single thread execution to prevent race conditions
 * - Proper timeouts and cleanup
 * - Coverage configuration
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    
    // CRITICAL: Enable test isolation
    isolate: true,
    
    // CRITICAL: Use thread pool with limits
    pool: 'threads',
    poolOptions: {
      threads: {
        // Run tests sequentially to prevent memory accumulation
        singleThread: true,
        // Limit maximum parallel threads
        maxThreads: 2,
        // Isolate each test file
        isolate: true,
      }
    },
    
    // Timeouts to prevent hanging tests
    testTimeout: 30000,      // 30 seconds per test
    hookTimeout: 10000,      // 10 seconds for hooks
    teardownTimeout: 1000,   // 1 second for teardown
    
    // Setup files for global configuration
    setupFiles: ['./test-setup.ts'],
    
    // Memory management
    maxConcurrency: 1,       // Run one test suite at a time
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '*.config.*',
        'test-setup.ts'
      ]
    },
    
    // Reporter configuration
    reporters: ['verbose'],
    
    // Clear mocks between tests
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  }
})