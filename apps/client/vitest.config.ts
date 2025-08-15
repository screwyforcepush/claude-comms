import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Performance optimization to prevent memory leaks and process spawning
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Use single fork to prevent multiple process spawning
        minForks: 1,
        maxForks: 1
      }
    },
    // Process isolation and cleanup
    isolate: true,
    teardownTimeout: 10000,
    // Prevent hanging processes
    hookTimeout: 30000,
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '*.config.*'
      ]
    }
  }
})