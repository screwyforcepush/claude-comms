# NPX Installer Testing Strategy

## Overview

This document defines the comprehensive testing strategy for the `@claude-code/setup-installer` NPX package, ensuring reliability, cross-platform compatibility, and maintainability.

## Testing Pyramid

```
         ╱╲
        ╱E2E╲       (5%)  - Full installation scenarios
       ╱──────╲
      ╱ Integr ╲    (20%) - Module interactions
     ╱──────────╲
    ╱   Unit     ╲  (75%) - Individual functions
   ╱──────────────╲
```

## Test Coverage Requirements

- **Overall Coverage Target**: 90%
- **Critical Path Coverage**: 100%
- **Error Handling Coverage**: 95%
- **Edge Cases Coverage**: 85%

## Testing Layers

### 1. Unit Tests (75%)

#### Test Structure
```
test/unit/
├── cli/
│   ├── prompts.test.js
│   ├── parser.test.js
│   └── validator.test.js
├── fetcher/
│   ├── github.test.js
│   ├── cache.test.js
│   └── downloader.test.js
├── installer/
│   ├── file-writer.test.js
│   ├── dependency-check.test.js
│   └── post-install.test.js
└── utils/
    ├── logger.test.js
    ├── errors.test.js
    └── platform.test.js
```

#### Key Test Cases

**GitHub Fetcher Module**
```javascript
describe('GitHubFetcher', () => {
  describe('fetchDirectory', () => {
    it('should fetch directory structure from GitHub API');
    it('should handle nested directories recursively');
    it('should fall back to raw URLs on API failure');
    it('should retry on rate limit with exponential backoff');
    it('should validate response structure');
    it('should handle binary files correctly');
    it('should preserve file permissions metadata');
  });

  describe('error handling', () => {
    it('should throw specific error for network failures');
    it('should throw specific error for 404 responses');
    it('should handle malformed JSON responses');
    it('should timeout after configured duration');
  });
});
```

**File Writer Module**
```javascript
describe('FileWriter', () => {
  describe('writeFiles', () => {
    it('should create directory structure');
    it('should write files with correct content');
    it('should preserve file permissions');
    it('should handle existing files based on strategy');
    it('should create backup of existing files when requested');
    it('should rollback on partial failure');
  });

  describe('cross-platform', () => {
    it('should handle Windows path separators');
    it('should normalize line endings');
    it('should handle special characters in filenames');
  });
});
```

### 2. Integration Tests (20%)

#### Test Structure
```
test/integration/
├── installation-flow.test.js
├── github-integration.test.js
├── file-system.test.js
└── error-recovery.test.js
```

#### Key Integration Scenarios

```javascript
describe('Installation Flow', () => {
  it('should complete full installation to empty directory');
  it('should handle installation with existing files');
  it('should fetch and install all required files');
  it('should create valid settings.local.json from template');
  it('should validate Python/uv dependencies when required');
  it('should display appropriate progress messages');
  it('should clean up on cancellation');
});

describe('Error Recovery', () => {
  it('should retry on transient network failures');
  it('should fall back to alternative fetch methods');
  it('should restore original state on installation failure');
  it('should provide actionable error messages');
});
```

### 3. End-to-End Tests (5%)

#### Test Scenarios

```javascript
describe('E2E Installation', () => {
  it('should install via npx in fresh directory');
  it('should install with --force flag overwriting existing');
  it('should install specific version with --tag');
  it('should handle interactive prompts correctly');
  it('should work on Windows/macOS/Linux');
});
```

#### E2E Test Script
```bash
#!/bin/bash
# test/e2e/install.sh

# Test basic installation
npx ../.. --dir ./test-project-1
assert_directory_exists "./test-project-1/.claude"
assert_file_exists "./test-project-1/CLAUDE.md"

# Test force overwrite
npx ../.. --dir ./test-project-2 --force
assert_no_backup_files "./test-project-2"

# Test specific version
npx ../.. --dir ./test-project-3 --tag v1.0.0
assert_version_match "./test-project-3/.claude/VERSION" "1.0.0"
```

## Mock Strategy

### External Dependencies

```javascript
// test/mocks/github-api.js
const nock = require('nock');

function mockGitHubAPI() {
  return nock('https://api.github.com')
    .get('/repos/alexsavage/claude-code-hooks-multi-agent-observability/contents/.claude')
    .reply(200, mockDirectoryListing)
    .get('/repos/alexsavage/claude-code-hooks-multi-agent-observability/contents/.claude/hooks')
    .reply(200, mockHooksListing);
}
```

### File System

```javascript
// test/mocks/file-system.js
const mockFs = require('mock-fs');

function setupMockFileSystem() {
  mockFs({
    '/target/directory': {
      'existing-file.txt': 'existing content'
    },
    '/home/user/.npmrc': 'registry=https://registry.npmjs.org/'
  });
}
```

### User Input

```javascript
// test/mocks/prompts.js
const prompts = require('prompts');

function mockUserInput(responses) {
  prompts.inject(responses);
}

// Usage
mockUserInput([
  true,  // Confirm installation
  'overwrite',  // Handle existing files
  'http://localhost:4000'  // Observability server URL
]);
```

## Test Data Management

### Fixtures

```
test/fixtures/
├── mock-claude-directory/
│   ├── agents/
│   ├── hooks/
│   └── settings.json
├── mock-responses/
│   ├── github-api-success.json
│   ├── github-api-rate-limit.json
│   └── github-api-404.json
└── expected-outputs/
    ├── installed-structure.json
    └── settings-local-template.json
```

### Test Data Generation

```javascript
// test/helpers/data-generator.js
function generateMockFile(size = 1000) {
  return Buffer.alloc(size, 'test-content');
}

function generateDirectoryStructure(depth = 3, filesPerDir = 5) {
  // Generate complex directory structure for stress testing
}
```

## Performance Testing

### Benchmarks

```javascript
// test/performance/benchmarks.js
describe('Performance Benchmarks', () => {
  it('should complete installation in under 30 seconds', async () => {
    const start = Date.now();
    await installer.install();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(30000);
  });

  it('should handle large directory structures efficiently', async () => {
    // Test with 1000+ files
    const metrics = await installer.installWithMetrics(largeStructure);
    expect(metrics.memoryUsage).toBeLessThan(100 * 1024 * 1024); // 100MB
  });
});
```

### Load Testing

```javascript
// test/performance/load.js
describe('Concurrent Installations', () => {
  it('should handle multiple simultaneous installations', async () => {
    const installations = Array(10).fill().map((_, i) => 
      installer.install(`./test-${i}`)
    );
    
    const results = await Promise.allSettled(installations);
    const successful = results.filter(r => r.status === 'fulfilled');
    expect(successful.length).toBeGreaterThan(8); // 80% success rate
  });
});
```

## Cross-Platform Testing

### CI Matrix Configuration

```yaml
# .github/workflows/test.yml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node: [16, 18, 20]
    
runs-on: ${{ matrix.os }}
steps:
  - uses: actions/setup-node@v3
    with:
      node-version: ${{ matrix.node }}
  - run: npm test
```

### Platform-Specific Tests

```javascript
// test/unit/utils/platform.test.js
describe('Platform Compatibility', () => {
  describe.skipIf(process.platform !== 'win32')('Windows', () => {
    it('should handle Windows paths correctly');
    it('should detect Windows line endings');
    it('should find Python in Windows locations');
  });

  describe.skipIf(process.platform !== 'darwin')('macOS', () => {
    it('should handle macOS specific permissions');
    it('should find Python in Homebrew locations');
  });

  describe.skipIf(process.platform !== 'linux')('Linux', () => {
    it('should handle Linux file permissions');
    it('should check standard Linux Python locations');
  });
});
```

## Security Testing

### Input Validation

```javascript
describe('Security - Input Validation', () => {
  it('should prevent directory traversal attacks', () => {
    expect(() => installer.install('../../../etc/passwd'))
      .toThrow(SecurityError);
  });

  it('should sanitize file paths', () => {
    const sanitized = sanitizePath('../../etc/passwd');
    expect(sanitized).toBe('etc/passwd');
  });

  it('should validate GitHub responses', () => {
    const maliciousResponse = { content: 'executable-code' };
    expect(() => validator.validateGitHubResponse(maliciousResponse))
      .toThrow(ValidationError);
  });
});
```

### Dependency Scanning

```json
{
  "scripts": {
    "audit": "npm audit --audit-level=moderate",
    "audit:fix": "npm audit fix",
    "security": "snyk test"
  }
}
```

## Test Execution Strategy

### Local Development

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=unit/fetcher

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Debug mode
npm test -- --inspect-brk
```

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:unit",
      "pre-push": "npm test"
    }
  }
}
```

### Continuous Integration

1. **On Pull Request**: Run unit and integration tests
2. **On Merge to Main**: Run full test suite including E2E
3. **Nightly**: Run extended test suite with performance tests
4. **Release**: Run full test suite + security audit

## Test Reporting

### Coverage Reports

```javascript
// jest.config.js
module.exports = {
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

### Test Results Dashboard

- Integration with GitHub Actions for PR status checks
- Coverage badges in README
- Trend analysis for test execution time
- Flaky test detection and reporting

## Maintenance

### Test Maintenance Guidelines

1. **Keep Tests Simple**: Each test should verify one behavior
2. **Use Descriptive Names**: Test names should explain what and why
3. **Avoid Test Interdependence**: Tests must be runnable in isolation
4. **Regular Cleanup**: Remove obsolete tests and update fixtures
5. **Performance Monitoring**: Track test execution time trends

### Test Review Checklist

- [ ] New features have corresponding tests
- [ ] Edge cases are covered
- [ ] Error scenarios are tested
- [ ] Mocks are properly cleaned up
- [ ] Tests are deterministic (no random failures)
- [ ] Performance impact is acceptable

## Conclusion

This testing strategy ensures the NPX installer is robust, reliable, and maintainable. By following this approach, we achieve high confidence in the package's functionality across different environments while maintaining fast feedback loops for developers.