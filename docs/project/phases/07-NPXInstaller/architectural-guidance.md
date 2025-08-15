# NPX Installer Bug Fix - Architectural Guidance

## Executive Summary

The claude-comms package has a critical bug where it only installs `.claude/hooks/comms` instead of the complete `.claude` directory structure and `CLAUDE.md` file. This document provides architectural guidance for fixing this issue.

## Root Cause Analysis

### Primary Issue
The `GitHubFetcher` class in `src/fetcher/github.js` has a flawed fallback strategy (`_fetchWithRawUrls`) that contains a hardcoded, incomplete file list:

```javascript
// Lines 229-236 - PROBLEMATIC CODE
const commonFiles = [
  '.claude/settings.json',
  '.claude/hooks/install.py',
  '.claude/agents/agent-orchestrator.py',
  'CLAUDE.md'
];
```

This hardcoded list is missing most of the actual files in the repository, causing incomplete installations when the primary GitHub APIs (Trees/Contents) fail.

### Cascading Failures

1. **Trees API Failure**: When recursive tree fetch fails (rate limiting, large repos)
2. **Contents API Failure**: When directory enumeration fails (permissions, API limits)
3. **Raw URL Fallback**: Falls back to hardcoded list that's incomplete

## Architectural Solution

### Strategy 1: Dynamic File Discovery (Recommended)

Instead of hardcoded file lists, implement dynamic discovery:

```javascript
class GitHubFetcher {
  async _fetchWithRawUrls(path, options) {
    // Option 1: Use a manifest file
    const manifest = await this._fetchManifest(options);
    const files = manifest.files.filter(f => 
      f.startsWith(path) || (path === '.claude' && f.startsWith('.claude'))
    );
    
    // Option 2: Try multiple known entry points
    const entryPoints = await this._discoverEntryPoints(path, options);
    const files = await this._crawlFromEntryPoints(entryPoints, options);
    
    return this._fetchFilesFromList(files, options);
  }
  
  async _fetchManifest(options) {
    // Fetch a manifest.json that lists all files
    const manifestUrl = `${this.config.rawUrl}/${options.version}/.claude-manifest.json`;
    const response = await this._makeRequest(manifestUrl);
    return await response.json();
  }
}
```

### Strategy 2: Comprehensive Static List

If dynamic discovery isn't feasible, maintain a complete static list:

```javascript
const CLAUDE_FILE_STRUCTURE = {
  '.claude': {
    'settings.json': 'file',
    'settings.local.json': 'file',
    'agents': {
      'core': {
        'agent-orchestrator.md': 'file',
        'architect.md': 'file',
        'business-analyst.md': 'file',
        'deep-researcher.md': 'file',
        'designer.md': 'file',
        'engineer.md': 'file',
        'gatekeeper.md': 'file',
        'planner.md': 'file'
      },
      'meta-agent-builder.md': 'file'
    },
    'commands': {
      'cook.md': 'file',
      'new-agents.md': 'file'
    },
    'hooks': {
      'comms': {
        'get_unread_messages.py': 'file',
        'register_subagent.py': 'file',
        'send_message.py': 'file',
        'update_subagent_completion.py': 'file'
      },
      'context': {
        'repo_map.py': 'file'
      },
      'observability': {
        'send_event.py': 'file'
      },
      'safety': {} // Empty directory
    }
  },
  'CLAUDE.md': 'file'
};
```

### Strategy 3: Hybrid Approach (Most Robust)

Combine multiple strategies with graceful degradation:

```javascript
class GitHubFetcher {
  async fetchDirectory(path, options = {}) {
    const strategies = [
      () => this._fetchWithTrees(path, options),      // Fastest
      () => this._fetchWithContents(path, options),   // Reliable
      () => this._fetchWithManifest(path, options),   // New: manifest-based
      () => this._fetchWithArchive(path, options),    // New: download full archive
      () => this._fetchWithStaticList(path, options)  // Last resort: comprehensive static
    ];
    
    for (const [index, strategy] of strategies.entries()) {
      try {
        const result = await strategy();
        if (this._validateCompleteness(result, path)) {
          return result;
        }
      } catch (error) {
        this._logStrategyFailure(index, error);
      }
    }
    
    throw new GitHubAPIError('All fetch strategies failed');
  }
  
  _validateCompleteness(result, path) {
    // Ensure we have minimum required files
    const requiredPaths = FILE_PATHS.REQUIRED_FILES;
    const fetchedPaths = this._extractPaths(result);
    return requiredPaths.every(req => fetchedPaths.includes(req));
  }
}
```

## Implementation Architecture

### Module Responsibilities

1. **GitHubFetcher Enhancement**
   - Add manifest support
   - Implement archive download strategy
   - Maintain comprehensive file list
   - Add completeness validation

2. **Installer Orchestrator Update**
   - Validate fetched content completeness
   - Report missing files clearly
   - Add retry logic for incomplete fetches

3. **File Writer Adaptation**
   - Handle nested directory creation
   - Preserve file permissions (especially for Python scripts)
   - Atomic installation (all or nothing)

### Error Handling Strategy

```javascript
class FetchCompletionError extends InstallerError {
  constructor(missing, fetched) {
    super(
      `Incomplete fetch: missing ${missing.length} required files`,
      ErrorCode.GITHUB_API_ERROR,
      { missing, fetched },
      true // recoverable
    );
  }
}
```

### Testing Strategy

1. **Unit Tests**
   - Mock each fetch strategy independently
   - Test fallback progression
   - Validate completeness checks

2. **Integration Tests**
   - Test against real GitHub API
   - Simulate API failures
   - Verify complete installation

3. **E2E Tests**
   - Full installation flow
   - Verify all files present
   - Check file permissions

## File Conflict Resolution

### Strategy Pattern for Conflicts

```javascript
class ConflictResolver {
  constructor(strategy = 'backup') {
    this.strategies = {
      backup: new BackupStrategy(),
      merge: new MergeStrategy(),
      overwrite: new OverwriteStrategy(),
      skip: new SkipStrategy()
    };
    this.strategy = this.strategies[strategy];
  }
  
  async resolve(existingFile, newFile, options) {
    return await this.strategy.resolve(existingFile, newFile, options);
  }
}

class BackupStrategy {
  async resolve(existingPath, newContent, options) {
    const backupPath = `${existingPath}.backup-${Date.now()}`;
    await fs.rename(existingPath, backupPath);
    await fs.writeFile(existingPath, newContent);
    return { action: 'backed_up', backupPath };
  }
}
```

## Performance Optimization

### Parallel Fetching
```javascript
async _fetchFilesBatch(fileItems, options, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < fileItems.length; i += batchSize) {
    const batch = fileItems.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => this._fetchWithRetry(item, options))
    );
    results.push(...batchResults);
    
    // Rate limit between batches
    if (i + batchSize < fileItems.length) {
      await this._rateLimitDelay();
    }
  }
  
  return results;
}
```

### Caching Strategy
```javascript
class CachedFetcher extends GitHubFetcher {
  constructor(options) {
    super(options);
    this.cache = new Map();
  }
  
  async fetchFile(path, options) {
    const cacheKey = `${path}:${options.version}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_CONFIG.DEFAULT_TTL) {
        return cached.data;
      }
    }
    
    const result = await super.fetchFile(path, options);
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }
}
```

## Migration Path

### Phase 1: Immediate Fix
1. Update hardcoded file list to be comprehensive
2. Add validation to ensure all required files are fetched
3. Improve error messages to indicate missing files

### Phase 2: Enhanced Reliability
1. Implement manifest-based fetching
2. Add archive download strategy
3. Implement comprehensive testing

### Phase 3: Optimization
1. Add caching layer
2. Implement parallel fetching
3. Add progress reporting for large installations

## Team Implementation Guidance

### For AliceCortex (Bug Investigation)
- Validate that the hardcoded list is the root cause
- Test API failure scenarios to confirm fallback behavior
- Document any additional edge cases discovered

### For BenjaminAura (GitHub API Fix)
- Implement the comprehensive file list immediately
- Add manifest support as secondary strategy
- Ensure backward compatibility with existing API

### For ChloeMatrix (Installation Fix)
- Update installer to validate completeness
- Add retry logic for incomplete fetches
- Implement proper error reporting

### For EllaQuantum (Verification)
- Create test suite for completeness validation
- Add integration tests for all fetch strategies
- Verify file permissions are preserved

## Success Criteria

1. **Complete Installation**: All files from `.claude/` and `CLAUDE.md` are installed
2. **Graceful Degradation**: System works even when primary APIs fail
3. **Clear Error Reporting**: Users understand what went wrong
4. **Performance**: Installation completes in < 30 seconds on average
5. **Reliability**: 99% success rate for installations

## Risk Mitigation

1. **API Rate Limiting**: Implement exponential backoff and caching
2. **Large Repository**: Use archive download for repos > 100 files
3. **Network Failures**: Implement retry with different strategies
4. **Incomplete State**: Atomic installation with rollback capability

## Conclusion

The fix requires updating the `GitHubFetcher` to either:
1. Maintain a complete file list (immediate fix)
2. Implement dynamic discovery (long-term solution)
3. Use hybrid approach with multiple strategies (most robust)

The architecture should prioritize completeness validation and clear error reporting to prevent silent failures.