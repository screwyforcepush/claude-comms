# GitHub Retry Logic Fix - MayaCore

## Problem Fixed
Fixed critical bug causing 575422ms (9.5 minute) wait times during GitHub API rate limiting.

## Root Cause
In `src/fetcher/github.js`, line 591-593:
```javascript
const delay = this.rateLimitReset ?
  Math.max(this.rateLimitReset - Date.now(), 0) :
  this._calculateRetryDelay(attempt);
```

**Issue**: `rateLimitReset` was stored as Unix timestamp in milliseconds, but calculation treated it as absolute timestamp, causing massive delays when rate limit reset time was far in future.

## Fix Implementation

### 1. Smart Rate Limit Delay Calculation
```javascript
_calculateRateLimitDelay() {
  if (!this.rateLimitReset) return 0;
  
  const timeUntilReset = this.rateLimitReset - Date.now();
  
  // Cap at 30 seconds maximum
  const cappedDelay = Math.min(timeUntilReset, 30000);
  
  // Fail fast for long resets (>5 minutes)
  if (timeUntilReset > 5 * 60 * 1000) {
    throw new GitHubAPIError(/* helpful message with GitHub token suggestion */);
  }
  
  return cappedDelay;
}
```

### 2. User Experience Improvements
- **Countdown Display**: Shows remaining wait time in seconds
- **GitHub Token Suggestions**: Recommends setting GITHUB_TOKEN for higher limits
- **Fail-Fast Logic**: Cancels installation for very long rate limit resets
- **Reasonable Caps**: Maximum 30-second waits, no more 9+ minute delays

### 3. Error Code Fix
```javascript
const error = new GitHubAPIError(/*...*/);
error.code = 'GITHUB_RATE_LIMIT'; // Ensures proper retry logic activation
throw error;
```

## Test Coverage
Created comprehensive test suite in `test/unit/fetcher/github-retry.test.js`:
- Rate limit header parsing
- Delay calculation caps
- User experience features
- Integration with existing retry logic
- Edge cases and error handling

## Impact
- ✅ Maximum wait time capped at 30 seconds
- ✅ User-friendly countdown display
- ✅ GitHub token usage suggestions
- ✅ Fail-fast for unreasonable delays
- ✅ Maintains backward compatibility
- ✅ Integrates with team's tarball solution

## Integration Points
This fix complements NateQuantum's tarball solution:
- Tarball API eliminates most rate limit scenarios (1 request vs 21+)
- When rate limits do occur, this fix ensures reasonable wait times
- Combined solution provides optimal performance and user experience

## Files Modified
- `packages/setup-installer/src/fetcher/github.js` - Core fix
- `packages/setup-installer/test/unit/fetcher/github-retry.test.js` - Test suite

## Success Criteria Met
- ✅ No more 575+ second wait times
- ✅ Maximum 30-second delays
- ✅ Clear user feedback
- ✅ GitHub token suggestions
- ✅ Fail-fast for long delays
- ✅ Comprehensive test coverage