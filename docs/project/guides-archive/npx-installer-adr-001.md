# ADR-001: NPX Installer Package Design Decisions

## Status
Proposed

## Context
We need to create an NPX-installable package that allows users to quickly set up the Claude multi-agent orchestration system in their projects. The installer must fetch the `.claude` directory and `CLAUDE.md` file from the GitHub repository and install them into the user's current working directory.

## Decision Drivers

1. **User Experience**: One-command installation with minimal friction
2. **Reliability**: Consistent installation across different environments
3. **Maintainability**: Easy to update and maintain
4. **Performance**: Fast installation process
5. **Security**: Safe file fetching and installation
6. **Cross-platform**: Works on Windows, macOS, and Linux

## Considered Options

### Option 1: Bundle Files in NPM Package
- **Pros**: 
  - Fast installation (no network requests)
  - Version locked to package version
  - Works offline after initial download
- **Cons**: 
  - Requires republishing for any file updates
  - Larger package size
  - Version synchronization challenges

### Option 2: GitHub API Fetching (Selected) ✅
- **Pros**: 
  - Always fetches latest from main branch
  - Smaller package size
  - Supports version pinning via tags
  - No republishing needed for content updates
- **Cons**: 
  - Requires network connection
  - Subject to GitHub API rate limits
  - Slightly slower installation

### Option 3: Git Clone Approach
- **Pros**: 
  - Simple implementation
  - Gets entire repository history
- **Cons**: 
  - Requires git to be installed
  - Downloads unnecessary files
  - Harder to extract specific directories

## Decision

We will use **Option 2: GitHub API Fetching** with raw file URL fallback.

### Implementation Details

```javascript
// Primary approach
const response = await fetch('https://api.github.com/repos/alexsavage/claude-code-hooks-multi-agent-observability/contents/.claude');

// Fallback for rate limiting
const fallbackUrl = 'https://raw.githubusercontent.com/alexsavage/claude-code-hooks-multi-agent-observability/main/.claude/...';
```

## Consequences

### Positive
- Users always get the latest setup files
- Package remains lightweight
- No need to republish NPM package for content updates
- Clear separation between installer logic and content

### Negative
- Requires internet connection during installation
- Potential GitHub API rate limiting (mitigated with fallback)
- Slightly slower than bundled approach

### Mitigation Strategies
1. Implement caching for repeated installations
2. Use raw GitHub URLs as fallback
3. Add retry logic with exponential backoff
4. Provide offline installation option in future versions

## Related Decisions

- Package naming: `@claude-code/setup-installer`
- Minimum Node.js version: 16.x
- Testing strategy: Unit + Integration + E2E
- Error handling: Descriptive error codes and messages