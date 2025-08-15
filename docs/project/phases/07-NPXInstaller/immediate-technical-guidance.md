# Immediate Technical Guidance - Batch 2 Implementation

## CRITICAL: Directory Structure Fix (HenryVector)

### Current Problem
```
packages/setup-installer/
├── lib/          # Legacy directory with utilities
├── src/          # New directory with orchestrator
└── dist/         # Both lib/ and src/ subdirs exist
```

**Impact**: `src/index.js` imports fail because modules exist in `lib/` not `src/`

### Solution: Consolidate to src/
```bash
# Step 1: Move lib contents to src
cd packages/setup-installer
mv lib/cli src/cli
mv lib/utils src/utils

# Step 2: Update import paths in src/index.js
# Change: require('./utils/logger') 
# To:     require('./utils/logger')  # Already correct

# Step 3: Remove empty lib directory
rm -rf lib/

# Step 4: Update any remaining references
grep -r "lib/" . --exclude-dir=node_modules
```

### Import Path Verification
After consolidation, verify these imports work:
```javascript
// src/index.js should import:
const logger = require('./utils/logger');           // ✓ Will work
const { InstallationError } = require('./utils/errors'); // ✓ Will work  
const fetcher = require('./fetcher/github');        // ✓ Will work
const fileWriter = require('./installer/file-writer'); // ✓ Will work
```

## GitHub API Implementation (IsabelMatrix)

### Interface Contract Compliance
```javascript
// src/fetcher/github.js - Required interface
async function fetchClaudeSetup(gitRef = 'main') {
  // Implementation must return file tree structure
  return {
    '.claude/hooks/': { type: 'dir', files: {...} },
    'CLAUDE.md': { type: 'file', content: '...' }
  };
}
```

### Error Handling Pattern
```javascript
const { ErrorFactory } = require('../utils/errors');

async function fetchFromTreesAPI(path, gitRef) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/claude-code/setup-templates/git/trees/${gitRef}?recursive=1`
    );
    
    if (!response.ok) {
      throw ErrorFactory.github(
        `GitHub API request failed: ${response.statusText}`,
        { status: response.status, gitRef, path }
      );
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof NetworkError) {
      throw error; // Re-throw network errors
    }
    throw ErrorFactory.fromCaught(error, 'github-trees-api');
  }
}
```

### Progress Event Pattern
```javascript
const EventEmitter = require('events');

class GitHubFetcher extends EventEmitter {
  async fetchClaudeSetup(gitRef) {
    this.emit('progress', {
      task: 'fetch-github',
      current: 0,
      total: 100,
      message: 'Connecting to GitHub...'
    });
    
    // Fetch tree structure
    const tree = await this.fetchTreeStructure(gitRef);
    
    this.emit('progress', {
      task: 'fetch-github', 
      current: 30,
      total: 100,
      message: 'Downloading files...'
    });
    
    // Process files...
  }
}
```

## File Writer Implementation (JackTensor)

### Atomic Operations Pattern
```javascript
const fs = require('fs-extra');
const path = require('path');
const { ErrorFactory } = require('../utils/errors');

async function writeSetupFiles(setupFiles, targetDir, options = {}) {
  const backups = new Map();
  const written = [];
  
  try {
    // Phase 1: Create backups if needed
    for (const [relativePath, content] of Object.entries(setupFiles)) {
      const fullPath = path.join(targetDir, relativePath);
      
      if (options.backup && await fs.pathExists(fullPath)) {
        const backupPath = await createBackup(fullPath);
        backups.set(fullPath, backupPath);
      }
    }
    
    // Phase 2: Write files atomically
    for (const [relativePath, content] of Object.entries(setupFiles)) {
      const fullPath = path.join(targetDir, relativePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content, 'utf8');
      written.push(fullPath);
    }
    
    return { 
      written, 
      backed_up: backups,
      skipped: [],
      errors: []
    };
    
  } catch (error) {
    // Rollback on failure
    await rollbackFiles(written, backups);
    throw ErrorFactory.filesystem(
      `File writing failed: ${error.message}`,
      { targetDir, fileCount: Object.keys(setupFiles).length },
      error
    );
  }
}

async function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup-${timestamp}`;
  await fs.copy(filePath, backupPath);
  return backupPath;
}

async function rollbackFiles(written, backups) {
  // Remove newly written files
  for (const filePath of written) {
    try {
      await fs.remove(filePath);
    } catch (error) {
      // Log but don't throw on rollback errors
      console.warn(`Failed to remove ${filePath} during rollback:`, error.message);
    }
  }
  
  // Restore backups
  for (const [originalPath, backupPath] of backups) {
    try {
      await fs.copy(backupPath, originalPath);
      await fs.remove(backupPath);
    } catch (error) {
      console.warn(`Failed to restore ${originalPath} from backup:`, error.message);
    }
  }
}
```

### Cross-Platform Path Handling
```javascript
const path = require('path');

function normalizePath(filePath) {
  // Always use forward slashes for consistency
  return filePath.replace(/\\/g, '/');
}

function validateTargetPath(targetDir, relativePath) {
  const fullPath = path.resolve(targetDir, relativePath);
  const normalizedTarget = path.resolve(targetDir);
  
  // Security: Ensure path stays within target directory
  if (!fullPath.startsWith(normalizedTarget)) {
    throw ErrorFactory.validation(
      'Path traversal detected',
      'relativePath',
      { relativePath, targetDir }
    );
  }
  
  return fullPath;
}
```

## Orchestration Integration (KarenFractal)

### Dependency Injection Pattern
```javascript
class InstallationOrchestrator {
  constructor(dependencies = {}) {
    this.fetcher = dependencies.fetcher || require('./fetcher/github');
    this.writer = dependencies.writer || require('./installer/file-writer'); 
    this.logger = dependencies.logger || require('./utils/logger');
    this.progressReporter = dependencies.progressReporter || new ProgressReporter();
  }
  
  async install(options) {
    // Coordinate all modules through injected dependencies
    const setupFiles = await this.fetcher.fetchClaudeSetup(options.gitRef);
    const result = await this.writer.writeSetupFiles(setupFiles, options.targetDir);
    return result;
  }
}
```

### Progress Aggregation
```javascript
class ProgressAggregator extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
  }
  
  registerModule(module, taskName) {
    module.on('progress', (event) => {
      this.tasks.set(taskName, event);
      this.emit('progress', this.aggregateProgress());
    });
  }
  
  aggregateProgress() {
    const tasks = Array.from(this.tasks.values());
    if (tasks.length === 0) return { overall: 0 };
    
    const overall = tasks.reduce((sum, task) => {
      return sum + (task.current / task.total || 0);
    }, 0) / tasks.length * 100;
    
    return { overall, tasks: Object.fromEntries(this.tasks) };
  }
}
```

## Quality Resolution Strategy

### Lint Error Fix Commands
```bash
# Step 1: Auto-fix what's possible
npm run lint -- --fix

# Step 2: Manual fixes needed
# Remove unused imports:
# - Remove 'chalk' import from src/index.js (line 14)
# - Remove unused 'gitRef' parameter from github.js (line 7)

# Step 3: Fix indentation in src/index.js
# Lines 133-143 need consistent 2-space indentation
```

### Test Infrastructure Setup
```javascript
// test/setup.js - Configure global test environment
const { ErrorFactory } = require('../src/utils/errors');

// Global mocks for testing
global.mockGitHubFetcher = {
  fetchClaudeSetup: jest.fn().mockResolvedValue({
    'CLAUDE.md': { type: 'file', content: '# Claude Setup' },
    '.claude/': { type: 'dir', files: {} }
  })
};

global.mockFileWriter = {
  writeSetupFiles: jest.fn().mockResolvedValue({
    written: ['CLAUDE.md', '.claude/settings.json'],
    backed_up: new Map(),
    errors: []
  })
};
```

## Integration Test Pattern
```javascript
// test/integration/full-installation.test.js
describe('Full Installation Integration', () => {
  test('should complete installation with mocked dependencies', async () => {
    const orchestrator = new InstallationOrchestrator({
      fetcher: mockGitHubFetcher,
      writer: mockFileWriter,
      logger: mockLogger
    });
    
    const result = await orchestrator.install({
      targetDir: '/tmp/test-install',
      gitRef: 'main'
    });
    
    expect(result.written).toContain('CLAUDE.md');
    expect(mockGitHubFetcher.fetchClaudeSetup).toHaveBeenCalledWith('main');
    expect(mockFileWriter.writeSetupFiles).toHaveBeenCalled();
  });
});
```

## Verification Checklist

### HenryVector (Directory Fix)
- [ ] `lib/` directory removed
- [ ] All utilities moved to `src/utils/`
- [ ] All CLI modules moved to `src/cli/`
- [ ] Import paths in `src/index.js` resolve correctly
- [ ] No runtime import errors when running `npm start`

### IsabelMatrix (GitHub API)
- [ ] Interface contract implemented exactly
- [ ] Error handling uses ErrorFactory.github()
- [ ] Progress events emitted for long operations
- [ ] Rate limiting and retry logic included
- [ ] Comprehensive tests with mocks

### JackTensor (File Writer)
- [ ] Atomic file operations implemented
- [ ] Backup and rollback functionality working
- [ ] Cross-platform path handling verified
- [ ] Error handling uses ErrorFactory.filesystem()
- [ ] Tests cover success and failure scenarios

### KarenFractal (Orchestrator)
- [ ] Dependency injection pattern implemented
- [ ] Progress aggregation from all modules
- [ ] Error recovery strategies defined
- [ ] Integration with CLI interface complete
- [ ] End-to-end testing passing

## Success Metrics

### Technical Metrics
- **Lint Errors**: 0 (down from 40+)
- **Test Coverage**: >90% on critical paths
- **Runtime Errors**: 0 import failures
- **Integration**: Full installation flow working

### Quality Metrics
- **Architecture Compliance**: 100% interface contract adherence
- **Error Handling**: Standardized across all modules
- **Documentation**: All patterns and decisions documented
- **Maintainability**: Clean, consistent codebase structure

This guidance provides the specific technical implementation details needed for immediate success in Batch 2 implementation.