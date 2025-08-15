# Test Architecture Issues Report

## Executive Summary

Critical test infrastructure issues were discovered causing 100GB+ RAM consumption due to zombie processes and improper test configuration.

## Critical Issues Found

### 1. Zombie Playwright Test Servers
- **Issue**: Two playwright test-server processes running since Wednesday (PIDs 7861, 7810)
- **Impact**: Each spawns vite dev servers that never terminate
- **Root Cause**: Missing proper shutdown in playwright test scripts
- **Status**: RESOLVED - Processes killed

### 2. Missing Test Isolation Configuration
- **Issue**: vitest.config.ts lacks critical test isolation settings
- **Missing Configuration**:
  - No `pool` or `threads` settings
  - No `isolate` configuration
  - No `maxConcurrency` limits
  - No resource cleanup hooks

### 3. Test Files with Improper Lifecycle Management
- **Issue**: Multiple test files show Vue lifecycle warnings
- **Evidence**: "onMounted/onUnmounted called without active component instance"
- **Impact**: Memory leaks from uncleaned component instances
- **Files Affected**: 
  - useMultiSessionData.test.ts
  - useMultiSessionData.integration.test.ts

### 4. Playwright Scripts Without Server Management
- **Issue**: Playwright test scripts connect to localhost:5173 but don't manage server lifecycle
- **Files**:
  - tests/playwright/playwright-sessions-test.js
  - tests/playwright/playwright-visual-test.js
- **Problem**: Scripts assume server is running, never spawn or cleanup

### 5. Missing Playwright Configuration
- **Issue**: No playwright.config.js/ts file found in client directory
- **Impact**: Test servers run without proper configuration or limits

## Anti-Patterns Identified

### 1. Test Server Management
```javascript
// ANTI-PATTERN: Scripts assume server exists
await page.goto('http://localhost:5173');

// CORRECT: Manage server lifecycle
const server = await startServer();
await page.goto(server.url);
// ... tests ...
await server.close();
```

### 2. Missing Test Isolation
```typescript
// CURRENT: No isolation settings
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  }
})

// RECOMMENDED: Proper isolation
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Run tests sequentially
        maxThreads: 2,      // Limit parallel execution
      }
    },
    teardownTimeout: 1000,
    hookTimeout: 10000,
  }
})
```

### 3. Component Cleanup
```typescript
// ANTI-PATTERN: No cleanup
it('should test component', () => {
  const wrapper = mount(Component);
  expect(wrapper).toBeTruthy();
});

// CORRECT: Proper cleanup
it('should test component', () => {
  const wrapper = mount(Component);
  expect(wrapper).toBeTruthy();
  wrapper.unmount(); // Always cleanup
});
```

## Memory Impact Analysis

### Before Fix
- 2 zombie playwright servers: ~80MB each
- Multiple vite instances spawned: ~500MB-1GB each
- Uncleaned Vue components: Accumulating over time
- Total observed: 100GB+ RAM usage

### After Fix (Expected)
- Single vite dev server: ~500MB
- Isolated test execution: ~200MB per test suite
- Proper cleanup: No accumulation
- Expected total: <2GB RAM usage

## Recommendations

### Immediate Actions
1. ✅ Kill zombie processes (COMPLETED)
2. Configure test isolation in vitest.config.ts
3. Add proper cleanup to all test files
4. Create playwright.config.ts with proper settings

### Long-term Improvements

#### 1. Test Configuration
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        maxThreads: 2,
      }
    },
    teardownTimeout: 1000,
    hookTimeout: 10000,
    testTimeout: 30000,
    setupFiles: ['./test-setup.ts'],
  }
})
```

#### 2. Global Test Setup
```typescript
// test-setup.ts
import { afterEach, beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Global setup
});

afterEach(() => {
  // Cleanup after each test
  vi.clearAllMocks();
  vi.clearAllTimers();
});

afterAll(() => {
  // Final cleanup
});
```

#### 3. Playwright Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  workers: 1, // Limit parallel execution
  fullyParallel: false,
});
```

#### 4. Test Script Updates
```json
// package.json
{
  "scripts": {
    "test": "vitest --run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:clean": "pkill -f 'playwright|vitest|vite' || true"
  }
}
```

## Prevention Measures

### 1. CI/CD Integration
- Add memory usage monitoring in CI
- Fail builds if test memory exceeds 4GB
- Add test cleanup verification

### 2. Developer Guidelines
- Always unmount Vue components in tests
- Never leave servers running after tests
- Use test:clean script before running new tests
- Monitor system resources during test development

### 3. Monitoring Script
```bash
#!/bin/bash
# monitor-tests.sh
while true; do
  ps aux | grep -E 'vite|vitest|playwright' | grep -v grep
  echo "---"
  sleep 5
done
```

## Validation Steps

1. Run `ps aux | grep -E 'vite|playwright' | grep -v grep` - Should show minimal processes
2. Run `pnpm test` - Should complete without memory spikes
3. Check for console warnings about lifecycle hooks
4. Verify no zombie processes after test completion

## Team Coordination

This issue affects all team members working on tests. Immediate actions:
- BenHelium: Apply vitest.config.ts isolation settings
- SamNeon: Update playwright scripts with proper server management
- All: Review and update test files for proper cleanup

## Conclusion

The 100GB RAM usage was caused by:
1. Zombie playwright test servers from Wednesday
2. Missing test isolation configuration
3. Improper component cleanup in tests
4. No server lifecycle management

With the recommended fixes, memory usage should drop to under 2GB for the entire test suite.