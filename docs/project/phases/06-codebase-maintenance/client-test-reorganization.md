# Client Test Files Reorganization Plan

## Current State

**Location:** `/apps/client/` (root level)  
**File Count:** 8 test files mixed with application code

### Files to Reorganize

1. **Playwright Tests** (3 files)
   - `playwright-sessions-test.js`
   - `tests/playwright/playwright-visual-test.js`
   - `sessions-visual-validation.js`

2. **Unit/Integration Tests** (3 files)
   - `test-branch-fixes.js`
   - `test-virtual-scrolling.js`
   - `timeline-validation.spec.ts`

3. **UI Validation** (2 files)
   - `sessions-ui-validation.js`
   - `sessions-visual-validation.js`

## Target Structure

```
apps/client/
├── src/                    (existing)
├── public/                 (existing)
├── tests/                  (NEW)
│   ├── playwright/
│   │   ├── playwright-sessions-test.js
│   │   ├── playwright-visual-test.js
│   │   └── sessions-visual-validation.js
│   ├── unit/
│   │   ├── test-branch-fixes.js
│   │   ├── test-virtual-scrolling.js
│   │   └── timeline-validation.spec.ts
│   ├── visual/
│   │   ├── sessions-ui-validation.js
│   │   └── sessions-visual-validation.js
│   └── README.md          (test documentation)
├── README.md              (updated with test info)
└── package.json           (update test scripts)
```

## Implementation Steps

### Step 1: Create Test Directory Structure

```bash
# Create test directories
mkdir -p apps/client/tests/playwright
mkdir -p apps/client/tests/unit  
mkdir -p apps/client/tests/visual
```

### Step 2: Move Files with Git

```bash
# Move Playwright tests
git mv apps/client/playwright-sessions-test.js apps/client/tests/playwright/
git mv apps/client/playwright-visual-test.js apps/client/tests/playwright/ # COMPLETED
git mv apps/client/sessions-visual-validation.js apps/client/tests/playwright/

# Move unit tests
git mv apps/client/test-branch-fixes.js apps/client/tests/unit/
git mv apps/client/test-virtual-scrolling.js apps/client/tests/unit/
git mv apps/client/timeline-validation.spec.ts apps/client/tests/unit/

# Move visual validation
git mv apps/client/sessions-ui-validation.js apps/client/tests/visual/
git mv apps/client/sessions-visual-validation.js apps/client/tests/visual/
```

### Step 3: Update Import Paths

#### Files that may need updates:
- `package.json` test scripts
- Any test configuration files
- CI/CD pipelines
- Documentation references

#### Example package.json updates:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:playwright": "playwright test tests/playwright",
    "test:visual": "node tests/visual/sessions-ui-validation.js"
  }
}
```

### Step 4: Create Test Documentation

Create `apps/client/tests/README.md`:

```markdown
# Client Application Tests

## Test Structure

### /playwright
End-to-end tests using Playwright for UI automation.
- Full user flow testing
- Visual regression testing
- Cross-browser compatibility

### /unit
Unit and integration tests for components and utilities.
- Component logic testing
- Store/state management tests
- Utility function tests

### /visual
Visual validation and screenshot comparison tests.
- UI consistency checks
- Design compliance validation
- Layout verification

## Running Tests

\`\`\`bash
# All tests
npm test

# Specific suites
npm run test:unit
npm run test:playwright
npm run test:visual
\`\`\`

## Writing Tests

See [Testing Guide](../../../docs/project/guides/testing.md) for conventions.
```

### Step 5: Update Client README

Add test section to `apps/client/README.md`:

```markdown
## Testing

Tests are organized in the `tests/` directory:

- `tests/playwright/` - E2E tests
- `tests/unit/` - Unit tests  
- `tests/visual/` - Visual tests

Run with: `npm test`
```

## Verification Checklist

- [ ] All test files moved to correct subdirectories
- [ ] Git history preserved with `git mv`
- [ ] Import paths updated in moved files
- [ ] Package.json scripts updated
- [ ] Test commands still work
- [ ] CI/CD pipelines updated if needed
- [ ] Documentation updated
- [ ] No files left in client root

## Benefits

1. **Clear Organization**: Tests separated from source code
2. **Easy Discovery**: Developers know where to find/add tests
3. **Better Tooling**: Test runners can target specific directories
4. **Maintainability**: Clear test categories
5. **Professional Structure**: Industry-standard organization

## Risk Mitigation

1. **Import Path Issues**
   - Search for all imports before moving
   - Update systematically
   - Run tests after each move

2. **CI/CD Breakage**
   - Review pipeline configurations
   - Update test paths
   - Test in branch first

3. **Lost Files**
   - Use `git mv` exclusively
   - Verify git status after moves
   - Keep backup branch

## Success Metrics

- All tests passing after reorganization
- No broken imports
- Improved test execution time (targeted runs)
- Positive developer feedback
- Clear test documentation