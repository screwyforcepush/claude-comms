# Architectural Decisions for Batch 2 Implementation

## Executive Summary

LiamHologram architectural analysis reveals critical structural issues requiring immediate resolution before implementation can proceed effectively. The dual lib/src directory structure and missing core implementations create blocking architectural debt.

## Critical Architectural Decisions

### Decision 1: Directory Structure Consolidation
**Status**: MANDATORY - Must be resolved immediately
**Decision**: Consolidate to single `src/` directory structure
**Rationale**: 
- Interface contracts specify `src/` paths
- Current dual structure causes import failures
- Test configurations expect `src/` structure
- Package configuration references `src/`

**Action for HenryVector**:
```bash
# Move all lib/ contents to src/ maintaining structure
mv lib/cli src/cli
mv lib/utils src/utils
# Update all import paths in existing files
# Remove empty lib/ directory
```

### Decision 2: Error Propagation Pattern
**Status**: APPROVED - Current implementation excellent
**Pattern**: Standardized InstallerError hierarchy with error codes
**Implementation**: `src/utils/errors.js` fully compliant with interface contracts
**Validation**: All modules MUST use ErrorFactory for consistent error creation

**For IsabelMatrix & JackTensor**:
```javascript
const { ErrorFactory } = require('../utils/errors');

// GitHub API errors
throw ErrorFactory.github('Rate limit exceeded', { status: 403 });

// File system errors  
throw ErrorFactory.filesystem('Permission denied', { code: 'EACCES' });
```

### Decision 3: Progress Event Aggregation
**Status**: DESIGN DEFINED - Implementation needed
**Pattern**: EventEmitter-based progress coordination
**Architecture**:
```javascript
// Each module emits standardized progress events
module.emit('progress', {
  task: 'fetch-github',
  current: 5,
  total: 10,
  message: 'Downloading file 5 of 10'
});

// Orchestrator aggregates and forwards to CLI
```

### Decision 4: Configuration Dependency Injection
**Status**: CRITICAL - Missing implementation
**Pattern**: Centralized configuration with module injection
**Location**: `src/config/` (currently missing)

**Required Implementation**:
```javascript
// src/config/index.js
const config = {
  repository: {
    owner: 'claude-code',
    repo: 'setup-templates',
    branch: 'main'
  },
  api: {
    githubBaseUrl: 'https://api.github.com',
    retryCount: 3,
    timeout: 30000
  }
};
```

## Integration Patterns

### GitHub API Integration (IsabelMatrix)
**Pattern**: Multi-strategy fetching with graceful fallbacks
**Priority Order**:
1. Trees API for directory structure (primary)
2. Contents API for individual files (fallback)
3. Archive download for bulk fetch (emergency fallback)

**Error Handling**:
```javascript
try {
  return await treesAPIFetch(path);
} catch (error) {
  if (error.code === 'GITHUB_RATE_LIMIT') {
    throw ErrorFactory.github('Rate limit - try again later', error.details);
  }
  // Try fallback method
  return await contentsAPIFetch(path);
}
```

### File Operations Integration (JackTensor)
**Pattern**: Atomic operations with rollback capability
**Requirements**:
- All file operations must be atomic (all-or-nothing)
- Backup creation before overwrite
- Rollback capability on any failure
- Cross-platform path handling

**Implementation Contract**:
```javascript
async function writeSetupFiles(setupFiles, targetDir, options = {}) {
  const backups = new Map();
  const written = [];
  
  try {
    for (const [filePath, content] of Object.entries(setupFiles)) {
      if (options.backup && await exists(filePath)) {
        backups.set(filePath, await createBackup(filePath));
      }
      await writeFile(filePath, content);
      written.push(filePath);
    }
    return { written, backed_up: backups };
  } catch (error) {
    // Rollback on any failure
    await rollbackFiles(written, backups);
    throw ErrorFactory.filesystem('Write operation failed', error);
  }
}
```

### Orchestration Design (KarenFractal)
**Pattern**: Phase-based execution with dependency injection
**Architecture**: Main orchestrator coordinates all modules through dependency injection

**Key Integration Points**:
1. **Environment Validation**: Dependency checker → error aggregation
2. **File Conflict Resolution**: User prompts → file writer coordination  
3. **Progress Coordination**: All modules → progress aggregator → CLI display
4. **Error Recovery**: Error detection → recovery strategy → retry/abort

## Quality Standards Enforcement

### Lint Error Resolution Strategy
**Current State**: 40+ lint errors from trailing spaces and unused imports
**Resolution Approach**:
1. **Immediate**: Run `eslint --fix` for auto-fixable issues
2. **Manual**: Remove unused imports (chalk, gitRef variables)
3. **Standards**: Enforce 2-space indentation consistently

### Test Architecture Requirements
**Coverage Target**: 90% for critical paths
**Test Boundaries**:
- Unit tests for individual functions
- Integration tests for module interactions  
- Contract tests for interface compliance
- E2E tests for full installation flow

**Mock Strategy**:
```javascript
// GitHub API Mock
const mockGitHubAPI = {
  fetchClaudeSetup: jest.fn().mockResolvedValue(mockFileTree)
};

// File System Mock  
const mockFileWriter = {
  writeSetupFiles: jest.fn().mockResolvedValue({ written: [], backed_up: new Map() })
};
```

## Cross-Platform Considerations

### Path Handling
**Requirement**: All paths must use Node.js path module
**Implementation**: 
```javascript
const path = require('path');
// Always use path.join(), never string concatenation
const claudeDir = path.join(targetDir, '.claude');
```

### Permission Handling
**Strategy**: Graceful degradation with clear error messages
**Implementation**: Detect permission issues and provide actionable guidance

## Performance Optimization Patterns

### GitHub API Efficiency
**Pattern**: Batch requests where possible
**Implementation**: Use Trees API to fetch directory structure in single request

### File Writing Efficiency  
**Pattern**: Stream large files, batch small files
**Threshold**: Stream files >1MB, batch files <1MB

### Memory Management
**Pattern**: Process files sequentially to avoid memory pressure
**Implementation**: Use streams for large content, limit concurrent operations

## Security Considerations

### Input Validation
**Requirement**: Validate all user inputs at module boundaries
**Implementation**: 
```javascript
// Path validation
if (!path.isAbsolute(targetDir)) {
  throw ErrorFactory.validation('Target directory must be absolute path', 'targetDir');
}

// Git ref validation
if (!/^[a-zA-Z0-9._/-]+$/.test(gitRef)) {
  throw ErrorFactory.validation('Invalid git reference format', 'gitRef');
}
```

### File System Security
**Pattern**: Restrict operations to target directory
**Implementation**: Use path.resolve() and verify paths stay within target

## Team Coordination Requirements

### For HenryVector (Directory Fix)
1. **Priority 1**: Consolidate lib/ to src/ structure
2. **Priority 2**: Update all import paths in existing files
3. **Priority 3**: Verify test configurations point to correct paths
4. **Completion Criteria**: No runtime import errors, consistent structure

### For IsabelMatrix (GitHub API)
1. **Interface**: Implement FetcherAPI contract exactly
2. **Error Handling**: Use ErrorFactory.github for all errors  
3. **Progress**: Emit progress events for long operations
4. **Testing**: Provide comprehensive mocks for offline testing

### For JackTensor (File Writer)
1. **Interface**: Implement WriterAPI contract exactly
2. **Atomicity**: Ensure all-or-nothing file operations
3. **Backup**: Implement rollback capability
4. **Cross-platform**: Handle Windows/Unix path differences

### For KarenFractal (Orchestrator)
1. **Dependency Injection**: Inject all modules through constructor
2. **Error Aggregation**: Collect and present errors consistently
3. **Progress Coordination**: Aggregate progress from all modules
4. **Recovery Logic**: Implement retry strategies per error type

## Validation Checkpoints

### Pre-Implementation
- [ ] Directory structure consolidated to src/
- [ ] All import paths updated and verified
- [ ] Interface contracts reviewed and understood
- [ ] Error handling patterns established

### During Implementation  
- [ ] Interface compliance validated through contract tests
- [ ] Error propagation tested with fault injection
- [ ] Progress events flowing through entire stack
- [ ] Cross-platform paths tested

### Post-Implementation
- [ ] Full integration test passing
- [ ] Lint errors resolved (target: 0 errors)
- [ ] Test coverage >90% on critical paths
- [ ] Performance benchmarks met

## Risk Mitigation

### Technical Risks
1. **Import Path Failures**: Resolved by directory consolidation
2. **Interface Mismatches**: Mitigated by contract tests
3. **Error Handling Gaps**: Addressed by standardized ErrorFactory
4. **Integration Complexity**: Managed through dependency injection

### Quality Risks  
1. **Lint Errors**: Auto-fix + manual review
2. **Test Coverage**: Incremental testing with coverage tracking
3. **Cross-platform Issues**: Explicit testing on multiple OS

## Success Criteria

### Architectural Success
- Single, consistent directory structure (src/)
- All modules implement interfaces exactly
- Error handling standardized across modules
- Progress reporting coordinated through orchestrator

### Quality Success
- Zero lint errors
- 90%+ test coverage on critical paths
- All integration tests passing
- Cross-platform compatibility verified

### Integration Success
- Full installation flow working end-to-end
- Error recovery scenarios tested
- Performance targets met
- User experience validated

## Next Steps

1. **Immediate**: HenryVector consolidates directory structure
2. **Parallel**: IsabelMatrix & JackTensor implement core modules following contracts
3. **Integration**: KarenFractal coordinates module integration
4. **Validation**: Run comprehensive test suite and quality checks
5. **Sign-off**: Architectural review of completed implementation

This architectural foundation provides the team with clear patterns, standards, and integration points needed for successful Batch 2 implementation. All decisions align with interface contracts and quality requirements while addressing the critical structural issues identified in the validation report.