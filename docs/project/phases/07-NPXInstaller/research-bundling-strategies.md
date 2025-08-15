# GitHub File Bundling Strategies Research

**Phase:** 07-NPXInstaller  
**Researcher:** KatePrism  
**Date:** 2025-08-15  
**Context:** Critical rate limiting issue with claude-comms installer (575+ second wait times)

## Executive Summary

The current claude-comms installer hits GitHub rate limits due to 21+ individual file requests, causing unacceptable 9+ minute wait times. Research identifies **GitHub's tarball API endpoint** as the optimal immediate solution, providing single-request fetching that completely avoids rate limiting while maintaining reliability.

**Primary Recommendation:** Implement `fetchAsTarball()` method using GitHub's `/repos/:owner/:repo/tarball/:ref` endpoint as the primary strategy, with existing methods as fallback.

## Current Problem Analysis

### Root Cause (Confirmed by MayaCore)
- Individual file fetching: 21+ separate GitHub API requests
- Broken retry logic: Incorrect delay calculation (Unix timestamp confusion)
- Rate limit calculation error in `_executeWithRetry()` line 538-540
- X-RateLimit-Reset header parsing multiplies by 1000, creating massive delays

### Impact
- User experience: 575+ second wait times (9.5 minutes)
- Rate limit exhaustion: 60 requests/hour (unauthenticated) quickly exceeded
- Installation failure: Unacceptable for CLI tool deployment

## Research Findings

### 1. GitHub Tarball API (RECOMMENDED)

**Endpoint:** `GET /repos/:owner/:repo/tarball/:ref`

**Advantages:**
- **Single request** replaces 21+ individual calls
- **Rate limit friendly:** Uses only 1 API call vs 21+
- **Fast performance:** Bundled download, ~150MB/s typical
- **Built-in fallback:** Existing API methods remain as backup
- **Simple implementation:** Minimal code changes required

**Implementation Notes:**
- Returns entire repository as tar.gz stream
- Requires tar extraction (Node.js `tar` package)
- Handles authentication seamlessly
- Supports specific commit/branch/tag references

**Rate Limits:**
- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour
- Archive endpoints follow standard REST API limits

### 2. JSDelivr CDN (EXCELLENT BACKUP)

**URL Pattern:** `https://cdn.jsdelivr.net/gh/:owner/:repo@:ref/path`

**Advantages:**
- **No rate limits:** CDN requests don't count against GitHub API
- **Global performance:** 150+ billion requests/month scale
- **Automatic caching:** Geographic distribution and caching
- **Instant availability:** New commits available immediately
- **Multi-CDN:** Cloudflare + Fastly for redundancy

**Limitations:**
- Public repositories only
- Individual file requests (not bundled)
- Cache invalidation dependency

### 3. GitHub Release Assets (FUTURE ENHANCEMENT)

**Best for:** Pre-bundled installer packages

**Advantages:**
- **No API rate limits:** Asset downloads separate from REST API
- **SHA256 verification:** Automatic checksums (2025 feature)
- **CDN performance:** GitHub's asset CDN optimized for large files
- **Version stability:** Immutable release artifacts

**Implementation Strategy:**
- Automate bundle creation in CI/CD
- Upload .claude directory + CLAUDE.md as tar.gz asset
- Use direct asset download URLs
- Fallback to tarball API for development branches

### 4. Git Sparse Checkout (SPECIALIZED USE)

**Best for:** Large repositories or monorepos

**Advantages:**
- **Zero rate limits:** Uses Git protocol, not REST API
- **Selective fetching:** Only specified directories/files
- **Offline capability:** Full Git functionality after clone
- **Bandwidth efficient:** `--filter=blob:none` optimization

**Limitations:**
- Requires Git CLI installation
- Higher complexity for simple file fetching
- Local disk overhead for Git objects

### 5. NPM Package Bundling (LONG-TERM)

**Best for:** Distribution as installable package

**Advantages:**
- **Native NPM ecosystem:** Standard package management
- **Version management:** Semantic versioning and changelogs
- **Dependency resolution:** Automatic installation
- **TypeScript support:** Modern development practices

**Implementation:**
- Bundle .claude files as NPM package
- Publish to registry or GitHub Packages
- Use as dependency in installer projects

## Comparative Analysis

| Strategy | API Calls | Rate Limit Risk | Speed | Implementation | Reliability |
|----------|-----------|-----------------|--------|----------------|-------------|
| **Current (Individual)** | 21+ | ⚠️ High | 🐌 Slow | ✅ Simple | ❌ Poor |
| **Tarball API** | 1 | ✅ Low | ⚡ Fast | ✅ Simple | ✅ High |
| **JSDelivr CDN** | 21+ | ✅ None | ⚡ Very Fast | ✅ Simple | ✅ High |
| **Release Assets** | 1 | ✅ None | ⚡ Very Fast | ⚠️ Moderate | ✅ High |
| **Sparse Checkout** | 0 | ✅ None | ⚡ Fast | ❌ Complex | ✅ High |
| **NPM Package** | 0 | ✅ None | ⚡ Fast | ❌ Complex | ✅ High |

## Implementation Recommendations

### Immediate Action (Phase 07)
1. **Implement `fetchAsTarball()` method** using GitHub's tarball endpoint
2. **Fix retry logic** based on MayaCore's findings
3. **Add tar extraction** using Node.js `tar` package
4. **Maintain fallback** to existing API methods for edge cases

### Short-term Enhancement
1. **Add JSDelivr CDN option** as secondary strategy
2. **Implement proper error handling** and user feedback
3. **Add progress indicators** for large downloads
4. **Performance monitoring** and metrics collection

### Long-term Strategy
1. **Release asset automation** for stable versions
2. **NPM package distribution** for ecosystem integration
3. **Sparse checkout option** for advanced use cases
4. **Performance optimization** based on real-world usage

## Risk Assessment

### High Priority Risks
- **Tarball size limits:** GitHub repos >2GB may timeout
- **Network failures:** Need robust retry and fallback logic
- **Extraction security:** Validate tar contents before extraction
- **Memory usage:** Large tarballs require streaming extraction

### Mitigation Strategies
- Implement streaming extraction for memory efficiency
- Add file validation and security checks
- Maintain multiple fallback strategies
- Monitor performance and adjust timeouts

## Success Criteria

### Immediate (Phase 07)
- ✅ Single API request replaces 21+ requests
- ✅ Installation time < 30 seconds (vs 575+ seconds)
- ✅ Rate limit issues eliminated
- ✅ Backward compatibility maintained

### Long-term
- ✅ Multiple delivery strategies available
- ✅ Robust error handling and fallbacks
- ✅ Performance monitoring and optimization
- ✅ User experience excellence

## Implementation Notes

### Dependencies
- `tar` package for extraction
- `stream` utilities for memory management
- Enhanced error handling for network issues

### Code Changes
- Add `fetchAsTarball()` method to GitHubFetcher class
- Modify strategy selection logic
- Fix retry delay calculations
- Add progress reporting for large downloads

### Testing Requirements
- Unit tests for tarball extraction
- Integration tests with various repository sizes
- Performance benchmarking
- Error scenario validation

## Related Documentation
- Current implementation: `packages/setup-installer/src/fetcher/github.js`
- Retry logic issues: `packages/setup-installer/src/utils/retry.js`
- GitHub API documentation: https://docs.github.com/en/rest/repos/contents
- JSDelivr documentation: https://www.jsdelivr.com/github