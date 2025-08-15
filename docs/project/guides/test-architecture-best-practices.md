# Test Architecture Best Practices

## Overview

This guide establishes the test architecture patterns and best practices for preventing memory leaks, zombie processes, and resource exhaustion in our test suite.

## Test Architecture Principles

### 1. Test Isolation
Every test must run in complete isolation to prevent:
- Memory accumulation
- State pollution between tests
- Resource contention

### 2. Resource Management
All resources must be properly managed:
- Components must be unmounted
- Servers must be shut down
- Timers must be cleared
- Mocks must be reset

### 3. Lifecycle Management
Test lifecycle must be explicit:
- Setup phase: Initialize resources
- Execution phase: Run test logic
- Teardown phase: Clean up everything

## Configuration Standards

### Vitest Configuration
```typescript
// Required settings for test isolation
{
  isolate: true,
  pool: 'threads',
  poolOptions: {
    threads: {
      singleThread: true,
      maxThreads: 2,
    }
  },
  maxConcurrency: 1,
}
```

### Playwright Configuration
```typescript
// Required settings for E2E tests
{
  workers: 1,
  fullyParallel: false,
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: !process.env.CI,
  }
}
```

## Test Patterns

### Unit Test Pattern
```typescript
describe('Component', () => {
  let wrapper: VueWrapper;
  
  beforeEach(() => {
    // Setup
    wrapper = mount(Component);
  });
  
  afterEach(() => {
    // CRITICAL: Always cleanup
    wrapper.unmount();
    vi.clearAllMocks();
  });
  
  it('should test behavior', () => {
    // Test logic
  });
});
```

### Integration Test Pattern
```typescript
describe('Integration', () => {
  let server: Server;
  let client: Client;
  
  beforeAll(async () => {
    server = await createTestServer();
    client = createClient(server.url);
  });
  
  afterAll(async () => {
    // CRITICAL: Cleanup connections
    await client.disconnect();
    await server.close();
  });
  
  it('should integrate correctly', async () => {
    // Test logic
  });
});
```

### E2E Test Pattern
```typescript
test('E2E workflow', async ({ page, context }) => {
  // Playwright manages browser lifecycle
  await page.goto('/');
  
  // Test logic
  
  // Context automatically cleaned up
});
```

## Anti-Patterns to Avoid

### ❌ No Cleanup
```typescript
// BAD: No cleanup
it('test', () => {
  const wrapper = mount(Component);
  expect(wrapper).toBeTruthy();
});
```

### ❌ Global State Pollution
```typescript
// BAD: Modifies global state
let sharedState = {};
it('test 1', () => {
  sharedState.value = 1;
});
it('test 2', () => {
  // Depends on test 1
  expect(sharedState.value).toBe(1);
});
```

### ❌ Unmanaged Async
```typescript
// BAD: Doesn't wait for async
it('test', () => {
  someAsyncOperation();
  // Test ends before operation completes
});
```

### ❌ Resource Leaks
```typescript
// BAD: Creates resources without cleanup
it('test', () => {
  const interval = setInterval(() => {}, 1000);
  // Interval never cleared
});
```

## Memory Management

### Object Pooling
For frequently created objects, use pooling:
```typescript
class TestObjectPool {
  private pool: Object[] = [];
  
  get(): Object {
    return this.pool.pop() || new Object();
  }
  
  release(obj: Object): void {
    this.pool.push(obj);
  }
  
  clear(): void {
    this.pool = [];
  }
}
```

### Component Cleanup
Always unmount Vue components:
```typescript
afterEach(() => {
  // Find all mounted components
  document.querySelectorAll('[data-v-]').forEach(el => {
    el.__vueParentComponent?.unmount();
  });
});
```

### Timer Management
Clear all timers after tests:
```typescript
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
```

## Performance Guidelines

### Test Execution Limits
- Unit tests: < 100ms per test
- Integration tests: < 1s per test
- E2E tests: < 10s per test
- Total suite: < 5 minutes

### Memory Limits
- Per test: < 50MB
- Per suite: < 500MB
- Total test run: < 2GB

### Parallel Execution
- CI: Single worker (workers: 1)
- Local: Max 2 workers
- Heavy tests: Sequential only

## Monitoring and Debugging

### Memory Monitoring
```bash
# Monitor test memory usage
while pnpm test; do
  ps aux | grep -E 'node|vitest' | awk '{sum+=$6} END {print "Memory: " sum/1024 " MB"}'
  sleep 1
done
```

### Process Monitoring
```bash
# Check for zombie processes
ps aux | grep -E 'vite|vitest|playwright' | grep -v grep
```

### Cleanup Verification
```bash
# Ensure cleanup after tests
pnpm test && ./scripts/test-cleanup.sh
```

## CI/CD Integration

### Pre-test Checks
```yaml
- name: Clean environment
  run: |
    pkill -f 'vite|vitest|playwright' || true
    rm -rf coverage test-results
```

### Post-test Cleanup
```yaml
- name: Verify cleanup
  if: always()
  run: |
    ps aux | grep -E 'vite|vitest|playwright' | grep -v grep || echo "Clean"
```

### Memory Guards
```yaml
- name: Check memory usage
  run: |
    MEM=$(ps aux | awk '{sum+=$6} END {print sum/1024}')
    if [ $(echo "$MEM > 4000" | bc) -eq 1 ]; then
      echo "Memory usage too high: ${MEM}MB"
      exit 1
    fi
```

## Troubleshooting

### High Memory Usage
1. Check for zombie processes: `ps aux | grep test`
2. Review test cleanup hooks
3. Look for memory leaks in components
4. Verify mock cleanup

### Slow Tests
1. Check for unnecessary waits
2. Review parallel execution settings
3. Look for synchronous operations that could be async
4. Profile with `vitest --reporter=verbose`

### Flaky Tests
1. Ensure proper isolation
2. Check for timing dependencies
3. Review async handling
4. Add explicit waits for conditions

## Team Responsibilities

### Developers
- Write tests with proper cleanup
- Monitor local test performance
- Report memory issues immediately

### Reviewers
- Verify cleanup in test code
- Check for anti-patterns
- Ensure isolation practices

### DevOps
- Monitor CI memory usage
- Implement resource limits
- Alert on test failures

## Migration Plan

### Phase 1: Critical Fixes
1. Apply vitest.config.recommended.ts
2. Add test-setup.ts
3. Kill zombie processes

### Phase 2: Test Updates
1. Update all test files with cleanup
2. Fix Vue lifecycle warnings
3. Add playwright.config.ts

### Phase 3: Monitoring
1. Implement memory monitoring
2. Add CI/CD guards
3. Create dashboards

## Validation Checklist

- [ ] No zombie processes after tests
- [ ] Memory usage < 2GB
- [ ] All tests pass consistently
- [ ] No console warnings
- [ ] Cleanup hooks in place
- [ ] Configuration applied
- [ ] CI/CD updated
- [ ] Team trained

## References

- [Vitest Configuration](https://vitest.dev/config/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Memory Management in Node.js](https://nodejs.org/en/docs/guides/diagnostics/memory)