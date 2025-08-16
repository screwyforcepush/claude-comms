/**
 * Integration test for tarball functionality validation
 * Tests the new tarball fetching approach end-to-end
 */

const { GitHubFetcher, fetchRepository } = require('../../src/fetcher/github');
const { performance } = require('perf_hooks');

describe('Tarball Integration Validation', () => {
  let fetcher;
  let requestLog = [];

  beforeEach(() => {
    fetcher = new GitHubFetcher({
      repository: {
        owner: 'screwyforcepush',
        repo: 'claude-code-subagent-bus',
        branch: 'main'
      }
    });

    requestLog = [];

    // Intercept requests to track them
    const originalMakeRequest = fetcher._makeRequest;
    fetcher._makeRequest = function (url, options) {
      requestLog.push({ url, method: options?.method || 'GET', timestamp: Date.now() });
      return originalMakeRequest.call(this, url, options);
    };
  });

  describe('Direct Tarball Method', () => {
    it('should use fetchAsTarball method for optimal performance', async () => {
      const startTime = performance.now();

      try {
        const result = await fetcher.fetchAsTarball({ version: 'main' });
        const endTime = performance.now();

        console.log(`✓ Tarball fetch completed in ${Math.round(endTime - startTime)}ms`);
        console.log(`✓ Requests made: ${requestLog.length}`);
        console.log(`✓ Files extracted: ${Object.keys(result).length}`);

        // Validate result structure
        expect(result).toHaveProperty('.claude');
        expect(result['.claude']).toHaveProperty('files');
        expect(Array.isArray(result['.claude'].files)).toBe(true);

        // Should be exactly 1 request for tarball download
        expect(requestLog.length).toBe(1);
        expect(requestLog[0].url).toContain('/tarball/');

        // Should complete quickly (tarball approach)
        expect(endTime - startTime).toBeLessThan(10000);

        // Should have core files
        const files = result['.claude'].files;
        expect(files.length).toBeGreaterThan(5);

        const filePaths = files.map(f => f.path);
        expect(filePaths.some(p => p.includes('settings.json'))).toBe(true);
        expect(filePaths.some(p => p.includes('send_message.py'))).toBe(true);

      } catch (error) {
        console.error('Tarball test failed:', error.message);
        throw error;
      }
    });

    it('should extract complete file structure from tarball', async () => {
      try {
        const result = await fetcher.fetchAsTarball({ version: 'main' });

        // Check for .claude directory
        expect(result).toHaveProperty('.claude');
        const claudeDir = result['.claude'];

        // Check structure
        expect(claudeDir).toHaveProperty('files');
        expect(claudeDir).toHaveProperty('children');
        expect(claudeDir.type).toBe('dir');
        expect(claudeDir.path).toBe('.claude');

        // Check for CLAUDE.md
        expect(result).toHaveProperty('CLAUDE.md');
        const claudeMd = result['CLAUDE.md'];
        expect(claudeMd).toHaveProperty('content');
        expect(claudeMd.content).toContain('Claude');

        console.log(`✓ Extracted ${claudeDir.files.length} files from .claude directory`);
        console.log(`✓ CLAUDE.md content length: ${claudeMd.content.length} characters`);

      } catch (error) {
        console.error('Structure test failed:', error.message);
        throw error;
      }
    });
  });

  describe('Repository Fetch Integration', () => {
    it('should use tarball strategy in fetchRepository function', async () => {
      const startTime = performance.now();

      try {
        const result = await fetchRepository('main');
        const endTime = performance.now();

        console.log(`✓ Repository fetch completed in ${Math.round(endTime - startTime)}ms`);
        console.log(`✓ Total requests: ${requestLog.length}`);

        // Validate result
        expect(result).toHaveProperty('claudeDirectory');
        expect(result).toHaveProperty('claudeFile');
        expect(result).toHaveProperty('files');

        // Should prefer tarball (minimal requests)
        expect(requestLog.length).toBeLessThanOrEqual(2); // 1 for tarball, maybe 1 for fallback validation

        // Performance check
        expect(endTime - startTime).toBeLessThan(15000);

        console.log(`✓ Files available: ${result.files.length}`);

      } catch (error) {
        console.error('Repository fetch test failed:', error.message);
        throw error;
      }
    });
  });

  describe('Retry Logic Validation', () => {
    it('should cap retry delays at 30 seconds', () => {
      // Test retry delay calculation
      const delays = [];

      // Simulate rate limit scenario
      fetcher.rateLimitReset = Date.now() + (60 * 1000); // 60 seconds from now

      for (let i = 0; i < 5; i++) {
        const delay = fetcher._calculateRateLimitDelay();
        delays.push(delay);
        console.log(`Attempt ${i + 1}: ${delay}ms delay`);
      }

      // All delays should be capped at 30 seconds
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(30000);
      });

      console.log(`✓ All retry delays capped at 30s: ${delays.join(', ')}ms`);
    });

    it('should fail fast for long rate limit waits', () => {
      // Simulate very long rate limit (over 5 minutes)
      fetcher.rateLimitReset = Date.now() + (10 * 60 * 1000); // 10 minutes from now

      expect(() => {
        fetcher._calculateRateLimitDelay();
      }).toThrow(/Rate limit reset time too far in future/);

      console.log('✓ Correctly fails fast for long rate limit waits');
    });
  });

  describe('Performance Validation', () => {
    it('should complete installation under target time', async () => {
      const targetTime = 10000; // 10 seconds
      const startTime = performance.now();

      try {
        const result = await fetchRepository('main');
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`Installation duration: ${Math.round(duration)}ms (target: ${targetTime}ms)`);
        console.log(`Requests made: ${requestLog.length}`);
        console.log(`Files fetched: ${result.files.length}`);

        expect(duration).toBeLessThan(targetTime);

      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.error(`Installation failed after ${Math.round(duration)}ms: ${error.message}`);
        throw error;
      }
    });
  });

  afterEach(() => {
    // Log request summary
    if (requestLog.length > 0) {
      console.log('\n--- Request Summary ---');
      requestLog.forEach((req, i) => {
        const url = req.url.replace('https://api.github.com/repos/screwyforcepush/claude-code-subagent-bus', '');
        console.log(`${i + 1}. ${req.method} ${url}`);
      });
      console.log(`Total requests: ${requestLog.length}`);
    }
  });
});
