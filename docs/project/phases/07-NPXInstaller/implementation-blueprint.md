# Implementation Blueprint - Bundled Fetch Solution
## Phase 07-NPXInstaller

### Overview
This blueprint provides the detailed implementation specification for transitioning from multi-request fetching (21+ API calls) to single-request bundled fetching using GitHub's tarball API.

### Core Implementation

#### 1. Updated GitHubFetcher Class Structure
```javascript
class GitHubFetcher extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Existing configuration
    this.repository = options.repository || {
      owner: 'screwyforcepush',
      repo: 'claude-code-subagent-bus',
      branch: 'main',
      paths: {
        claudeDir: '.claude',
        claudeMd: 'CLAUDE.md'
      }
    };
    
    // Updated configuration with new options
    this.config = {
      ...existingConfig,
      maxRateLimitWait: options.maxRateLimitWait || 30000, // 30s max wait
      useBundledFetch: options.useBundledFetch !== false, // Default true
      fallbackStrategies: ['tarball', 'releases', 'cdn', 'trees', 'contents', 'raw']
    };
    
    // Add tarball extractor
    this.tarExtractor = new TarballExtractor();
  }
  
  /**
   * Main entry point - now uses bundled fetch by default
   */
  async fetchRepository(gitRef = 'main', options = {}) {
    if (this.config.useBundledFetch) {
      try {
        return await this.fetchAsTarball({ version: gitRef, ...options });
      } catch (error) {
        this.logger.warn(`Tarball fetch failed: ${error.message}, falling back`);
      }
    }
    
    // Fallback to original multi-request approach
    return await this._fetchWithMultipleRequests(gitRef, options);
  }
}
```

#### 2. Tarball Fetching Implementation
```javascript
/**
 * Fetch entire repository as tarball and extract needed files
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Extracted files structure
 */
async fetchAsTarball(options = {}) {
  const { version = 'main' } = options;
  
  this.emit('progress', {
    task: 'fetch_tarball',
    current: 0,
    message: 'Downloading repository archive...',
    status: 'running'
  });
  
  try {
    // Step 1: Download tarball
    const tarballData = await this._downloadTarball(version);
    
    this.emit('progress', {
      task: 'fetch_tarball',
      current: 50,
      message: 'Extracting files...',
      status: 'running'
    });
    
    // Step 2: Extract and filter files
    const extractedFiles = await this._extractTarballFiles(tarballData, {
      filter: (path) => {
        // Only extract .claude directory and CLAUDE.md
        return path.startsWith('.claude/') || path === 'CLAUDE.md';
      }
    });
    
    // Step 3: Build file tree structure
    const result = this._buildFileTreeFromExtracted(extractedFiles);
    
    this.emit('progress', {
      task: 'fetch_tarball',
      current: 100,
      message: 'Repository fetched successfully',
      status: 'complete'
    });
    
    return result;
    
  } catch (error) {
    throw new GitHubAPIError(
      `Tarball fetch failed: ${error.message}`,
      { strategy: 'tarball', version, error }
    );
  }
}

/**
 * Download tarball from GitHub
 * @private
 */
async _downloadTarball(version) {
  const url = `${this.config.baseUrl}/repos/${this.repository.owner}/${this.repository.repo}/tarball/${version}`;
  
  const response = await this._makeRequest(url, {
    headers: {
      'Accept': 'application/vnd.github.v3.tarball'
    },
    // GitHub redirects to CDN for tarball download
    followRedirect: true
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download tarball: ${response.status}`);
  }
  
  // Convert response to buffer for extraction
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extract files from tarball buffer
 * @private
 */
async _extractTarballFiles(tarballBuffer, options = {}) {
  const tar = require('tar');
  const { filter = () => true } = options;
  const extractedFiles = new Map();
  
  return new Promise((resolve, reject) => {
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    
    bufferStream.end(tarballBuffer);
    
    bufferStream
      .pipe(tar.extract({
        // GitHub tarballs have format: owner-repo-sha/
        strip: 1, // Strip the first directory component
        filter: (path, entry) => {
          // Apply custom filter
          return entry.type === 'File' && filter(path);
        },
        onentry: (entry) => {
          const chunks = [];
          entry.on('data', chunk => chunks.push(chunk));
          entry.on('end', () => {
            const content = Buffer.concat(chunks).toString('utf-8');
            extractedFiles.set(entry.path, {
              path: entry.path,
              content: content,
              encoding: 'utf-8',
              mode: entry.mode,
              size: entry.size
            });
          });
        }
      }))
      .on('finish', () => resolve(extractedFiles))
      .on('error', reject);
  });
}
```

#### 3. Fixed Retry Logic Implementation
```javascript
/**
 * Execute function with proper retry and rate limit handling
 * @private
 */
async _executeWithRetry(fn, attempt = 1) {
  try {
    return await fn();
  } catch (error) {
    if (attempt >= this.config.retryCount) {
      throw error;
    }
    
    let delay;
    let shouldRetry = true;
    
    // Handle rate limiting correctly
    if (error.status === 403 || error.status === 429) {
      const remaining = error.headers?.['x-ratelimit-remaining'];
      const resetHeader = error.headers?.['x-ratelimit-reset'];
      
      if (remaining === '0' && resetHeader) {
        // Parse reset time (GitHub provides Unix timestamp in seconds)
        const resetTime = parseInt(resetHeader) * 1000;
        const now = Date.now();
        const waitTime = Math.max(resetTime - now, 0);
        
        // Apply maximum wait cap
        if (waitTime > this.config.maxRateLimitWait) {
          // Don't wait more than configured maximum
          const minutes = Math.ceil(waitTime / 60000);
          throw new GitHubAPIError(
            `Rate limit exceeded. Reset in ${minutes} minutes. ` +
            `Please use a GitHub token or try again later.`,
            { 
              code: 'RATE_LIMIT_EXCEEDED',
              resetTime,
              waitTime,
              suggestion: 'Set GITHUB_TOKEN environment variable'
            }
          );
        }
        
        delay = waitTime;
        
        this.emit('progress', {
          task: 'rate_limit_wait',
          message: `Rate limited. Waiting ${Math.ceil(delay / 1000)} seconds...`,
          delay,
          resetTime
        });
        
      } else if (error.headers?.['retry-after']) {
        // Use Retry-After header if present
        delay = parseInt(error.headers['retry-after']) * 1000;
        delay = Math.min(delay, this.config.maxRateLimitWait);
      } else {
        // No rate limit info, use exponential backoff
        delay = this._calculateExponentialBackoff(attempt);
      }
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      // Network errors - use exponential backoff
      delay = this._calculateExponentialBackoff(attempt);
    } else {
      // Other errors - don't retry
      shouldRetry = false;
    }
    
    if (!shouldRetry) {
      throw error;
    }
    
    this.logger.info(`Retry attempt ${attempt + 1}/${this.config.retryCount} in ${delay}ms`);
    await this._sleep(delay);
    
    return this._executeWithRetry(fn, attempt + 1);
  }
}

/**
 * Calculate exponential backoff delay with jitter
 * @private
 */
_calculateExponentialBackoff(attempt) {
  const base = this.config.retryDelay || 1000;
  const maxDelay = this.config.maxRetryDelay || 10000;
  
  // Exponential backoff: base * 2^(attempt-1)
  const exponentialDelay = base * Math.pow(2, attempt - 1);
  
  // Add jitter (±25% randomization)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  
  // Cap at maximum delay
  return Math.min(exponentialDelay + jitter, maxDelay);
}
```

#### 4. Fallback Strategy Implementation
```javascript
/**
 * Orchestrate fallback through multiple strategies
 * @private
 */
async _fetchWithFallbackCascade(options = {}) {
  const strategies = this.config.fallbackStrategies;
  const errors = [];
  
  for (const strategy of strategies) {
    try {
      this.logger.info(`Attempting fetch with strategy: ${strategy}`);
      
      switch (strategy) {
        case 'tarball':
          return await this.fetchAsTarball(options);
          
        case 'releases':
          return await this._fetchFromReleaseAssets(options);
          
        case 'cdn':
          return await this._fetchFromCDN(options);
          
        case 'trees':
          return await this._fetchWithTrees('.claude', options);
          
        case 'contents':
          return await this._fetchWithContents('.claude', options);
          
        case 'raw':
          return await this._fetchWithRawUrls('.claude', options);
          
        default:
          this.logger.warn(`Unknown strategy: ${strategy}`);
      }
    } catch (error) {
      errors.push({ strategy, error: error.message });
      this.logger.warn(`Strategy ${strategy} failed: ${error.message}`);
      continue;
    }
  }
  
  // All strategies failed
  throw new GitHubAPIError(
    'All fetch strategies failed',
    { strategies: errors }
  );
}
```

### Package Dependencies Update

#### package.json additions:
```json
{
  "dependencies": {
    "tar": "^6.2.0",
    "node-fetch": "^2.7.0",
    "stream": "^0.0.2"
  }
}
```

### Testing Requirements

#### Unit Test Coverage
```javascript
describe('GitHubFetcher - Bundled Fetch', () => {
  describe('Tarball Strategy', () => {
    it('should fetch repository in single request', async () => {
      const scope = nock('https://api.github.com')
        .get('/repos/owner/repo/tarball/main')
        .reply(302, '', {
          'Location': 'https://codeload.github.com/owner/repo/legacy.tar.gz/main'
        });
      
      nock('https://codeload.github.com')
        .get('/owner/repo/legacy.tar.gz/main')
        .replyWithFile(200, __dirname + '/fixtures/test-repo.tar.gz');
      
      const fetcher = new GitHubFetcher();
      const result = await fetcher.fetchAsTarball({ version: 'main' });
      
      expect(scope.isDone()).toBe(true);
      expect(result.files).toHaveLength(21);
      expect(result.claudeDirectory).toBeDefined();
      expect(result.claudeFile).toBeDefined();
    });
    
    it('should handle rate limits gracefully', async () => {
      nock('https://api.github.com')
        .get('/repos/owner/repo/tarball/main')
        .reply(403, { message: 'API rate limit exceeded' }, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 3600
        });
      
      const fetcher = new GitHubFetcher({ maxRateLimitWait: 5000 });
      
      await expect(fetcher.fetchAsTarball())
        .rejects.toThrow('Rate limit exceeded. Reset in 60 minutes');
    });
    
    it('should fall back to alternative strategies on failure', async () => {
      // Mock tarball failure
      nock('https://api.github.com')
        .get('/repos/owner/repo/tarball/main')
        .reply(500, 'Internal Server Error');
      
      // Mock successful trees API fallback
      nock('https://api.github.com')
        .get('/repos/owner/repo/git/trees/main?recursive=1')
        .reply(200, mockTreesResponse);
      
      const fetcher = new GitHubFetcher();
      const result = await fetcher.fetchRepository('main');
      
      expect(result).toBeDefined();
      expect(result.files).toHaveLength(21);
    });
  });
  
  describe('Retry Logic', () => {
    it('should respect maximum wait time for rate limits', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      
      nock('https://api.github.com')
        .get('/repos/owner/repo/tarball/main')
        .reply(403, {}, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': resetTime.toString()
        });
      
      const fetcher = new GitHubFetcher({ 
        maxRateLimitWait: 10000 // 10 seconds max
      });
      
      const startTime = Date.now();
      
      await expect(fetcher.fetchAsTarball())
        .rejects.toThrow('Rate limit exceeded');
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(1000); // Should fail fast
    });
    
    it('should apply exponential backoff for network errors', async () => {
      let attempts = 0;
      
      nock('https://api.github.com')
        .get('/repos/owner/repo/tarball/main')
        .times(3)
        .reply(() => {
          attempts++;
          if (attempts < 3) {
            return [500, 'Network Error'];
          }
          return [200, mockTarballData];
        });
      
      const fetcher = new GitHubFetcher({ retryCount: 3 });
      const result = await fetcher.fetchAsTarball();
      
      expect(attempts).toBe(3);
      expect(result).toBeDefined();
    });
  });
});
```

### Performance Metrics

#### Expected Improvements
| Scenario | Current | New | Improvement |
|----------|---------|-----|-------------|
| Normal Install | 30-60s | 2-5s | 90% faster |
| Rate Limited | 575+s | Fail fast with message | User-friendly |
| Large Repository | 60-120s | 5-10s | 92% faster |
| Poor Network | Multiple retries | Single retry | More reliable |

### Rollout Plan

#### Phase 1: Core Implementation (Immediate)
1. Fix retry logic bug (critical)
2. Add tar dependency
3. Implement fetchAsTarball method
4. Update fetchRepository to use tarball by default

#### Phase 2: Testing & Validation (Day 2)
1. Unit test coverage for new methods
2. Integration testing with real GitHub API
3. Cross-platform testing (Windows, Mac, Linux)
4. Performance benchmarking

#### Phase 3: Release (Day 3)
1. Version bump to 2.0.0 (breaking change in retry behavior)
2. Update documentation
3. Publish to npm
4. Monitor telemetry for success rates

### Monitoring & Telemetry

```javascript
class FetchTelemetry {
  constructor() {
    this.metrics = {
      strategyUsage: {},
      fetchDurations: [],
      rateLimitEncounters: 0,
      fallbackTriggers: 0,
      successRate: { success: 0, failure: 0 }
    };
  }
  
  recordFetch(strategy, duration, success) {
    this.metrics.strategyUsage[strategy] = 
      (this.metrics.strategyUsage[strategy] || 0) + 1;
    
    this.metrics.fetchDurations.push({ strategy, duration });
    
    if (success) {
      this.metrics.successRate.success++;
    } else {
      this.metrics.successRate.failure++;
    }
  }
  
  getReport() {
    return {
      ...this.metrics,
      averageDuration: this.calculateAverageDuration(),
      successPercentage: this.calculateSuccessRate()
    };
  }
}
```

### Conclusion

This implementation blueprint provides a complete solution to the rate limiting problem while maintaining backwards compatibility and improving performance by 90%+. The tarball approach reduces API calls from 21+ to 1, eliminates rate limiting issues, and provides a faster, more reliable installation experience.