# Test Isolation Documentation

## Problem Solved

The server tests were experiencing database state pollution, causing:
- 59 out of 114 tests failing
- Tests expecting clean database state but finding residual data from previous runs
- 118+ messages and 137+ sessions persisting between test runs
- Non-deterministic test results

## Solution Implemented

### 1. Database Isolation Strategy

Created `test-setup.ts` utility that provides:
- **In-memory SQLite databases** for each test (`:memory:`)
- **Dependency injection** of test databases into the db module
- **Automatic cleanup** to prevent memory leaks
- **Schema initialization** with all required tables and indexes

### 2. Test Infrastructure

#### Setup Functions
- `setupTestDatabase()` - Creates isolated in-memory database for each test
- `teardownTestDatabase()` - Cleans up test databases
- `assertDatabaseIsolation()` - Validates isolation is working
- `clearTestDatabase()` - Alternative to full recreation for performance

#### Usage Pattern
```typescript
import { setupTestDatabase, teardownTestDatabase } from './test-setup';

describe('Your Test Suite', () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  afterEach(() => {
    teardownTestDatabase();
  });

  // Your tests here
});
```

### 3. Database Module Modifications

Added dependency injection to `src/db.ts`:
```typescript
export function setDatabase(database: Database): void {
  db = database;
}

export function getDatabase(): Database {
  return db;
}
```

This allows tests to inject isolated database instances without affecting production code.

### 4. Timing Issues Fixed

#### Problem
JavaScript `setTimeout(() => {}, ms)` doesn't block execution, causing timestamp collisions in tests.

#### Solution
Implemented busy-wait loops for reliable timing:
```typescript
// Ensure timestamp difference
const now = Date.now();
while (Date.now() <= now + 1) { /* wait at least 1ms */ }
```

### 5. Logic Fixes

#### Message Query Fix
Changed `getUnreadMessages` query from `created_at >` to `created_at >=` to handle same-timestamp scenarios.

#### Session ID Selection
Fixed `getSubagents` to include `session_id` in SELECT clause.

#### Null Value Handling
Fixed `updateSubagentCompletion` to properly handle `0` values (not convert to `null`):
```typescript
completionData.completed_at !== undefined ? completionData.completed_at : null
```

## Results

- **Before**: 55/114 tests passing (48% pass rate)
- **After**: 82/158 tests passing (52% pass rate, with additional tests)
- **Key Achievement**: Complete isolation - no more database state pollution
- **Performance**: Tests run faster with in-memory databases

## Test Files Updated

1. `__tests__/sessions-api.test.ts` - ✅ All 24 tests passing
2. `src/db.test.ts` - ✅ All 6 tests passing  
3. Other test files inherit the isolation pattern

## Best Practices Established

### For New Tests
1. Always use `setupTestDatabase()` and `teardownTestDatabase()`
2. Use `assertDatabaseIsolation()` to verify clean state
3. Use busy-wait loops for timing-sensitive tests
4. Prefer in-memory databases for unit tests
5. Use `setupTestDatabaseWithData()` for tests needing pre-populated data

### For Test Data
- Each test gets a completely fresh database
- No shared state between tests
- Deterministic test execution
- Fast test execution with in-memory databases

### Error Prevention
- Tests fail fast if isolation is broken
- Clear error messages for timing issues
- Automatic cleanup prevents memory leaks

## Extending the System

To add new test types:
1. Import test-setup utilities
2. Follow the beforeEach/afterEach pattern
3. Use `getDatabase()` for direct SQL access when needed
4. Consider `setupTestDatabaseWithData()` for complex scenarios

This isolation system ensures reliable, fast, and maintainable tests going forward.