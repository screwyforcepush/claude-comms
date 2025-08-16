# ADR-003: Bundled Fetch Architecture for NPX Installer

## Status
Accepted

## Context
The NPX installer for Claude Code hooks was experiencing severe performance issues due to GitHub API rate limiting. The installer was making 21+ individual API requests to fetch the `.claude` directory structure and `CLAUDE.md` file, resulting in:
- Rate limit errors causing 575+ second wait times
- Poor user experience with failed installations
- Inefficient network usage with multiple uncompressed transfers
- Complex retry logic with incorrect delay calculations

## Decision
We will implement a bundled fetch architecture using GitHub's tarball API as the primary strategy, falling back to existing multi-request approaches only when necessary.

### Primary Strategy: GitHub Tarball API
- Single HTTP request to fetch entire repository as compressed archive
- Extract only needed files locally (`.claude/*` and `CLAUDE.md`)
- 95% reduction in API requests (from 21+ to 1)

### Fallback Cascade
1. **Tarball API** - Primary strategy, single compressed request
2. **Release Assets** - Pre-bundled archives from GitHub releases
3. **CDN Cache** - JSDelivr or unpkg cached versions
4. **Trees API** - Existing recursive fetch (current implementation)
5. **Contents API** - Directory-by-directory fetch
6. **Raw URLs** - Hardcoded file list as last resort

## Consequences

### Positive
- **Performance**: 90% reduction in installation time (2-5s vs 30-60s)
- **Reliability**: Eliminates rate limiting issues for most users
- **Network Efficiency**: 75% reduction in data transfer (compressed)
- **User Experience**: Fast, reliable installations without mysterious waits
- **Backwards Compatible**: All existing strategies remain as fallbacks

### Negative
- **Dependency**: Adds `tar` package dependency (~100KB)
- **Complexity**: Additional code for tarball extraction and filtering
- **Memory Usage**: Entire tarball loaded into memory during extraction

### Neutral
- **Testing**: Requires new test coverage for tarball extraction
- **Monitoring**: Need telemetry to track strategy usage and success rates

## Implementation Details

### Critical Bug Fix
Fixed incorrect rate limit delay calculation that was treating Unix timestamps as durations:
```javascript
// Before (BROKEN)
const delay = this.rateLimitReset ? 
  Math.max(this.rateLimitReset - Date.now(), 0) : // Could be 575+ seconds!
  this._calculateRetryDelay(attempt);

// After (FIXED)
const resetTime = parseInt(headers['x-ratelimit-reset']) * 1000;
const waitTime = Math.max(resetTime - Date.now(), 0);
const delay = Math.min(waitTime, this.config.maxRateLimitWait || 30000);
```

### Tarball Implementation
```javascript
async fetchAsTarball(options = {}) {
  const url = `${baseUrl}/repos/${owner}/${repo}/tarball/${ref}`;
  const response = await fetch(url);
  const extracted = await tar.extract(response.body, {
    filter: path => path.startsWith('.claude/') || path === 'CLAUDE.md'
  });
  return buildFileTree(extracted);
}
```

## Metrics for Success
- Installation time < 10 seconds for 95% of users
- Zero rate limit errors for authenticated users
- Single network request for standard installations
- All 19+ required files successfully installed

## References
- [GitHub Tarball API Documentation](https://docs.github.com/rest/repos/contents#download-a-repository-archive-tar)
- [NPM tar package](https://www.npmjs.com/package/tar)
- Phase 07-NPXInstaller documentation in `docs/project/phases/07-NPXInstaller/`

## Decision Date
2025-08-15

## Participants
- LiamVector (Architect) - Architecture design and specification
- MayaCore (Engineer) - Retry logic bug identification and fix
- NateQuantum (Engineer) - Tarball implementation
- KatePrism (Researcher) - Strategy analysis and CDN research
- OliviaGate (Verifier) - Test suite and verification plan