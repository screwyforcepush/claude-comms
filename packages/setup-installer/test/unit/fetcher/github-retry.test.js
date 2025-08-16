/**
 * Tests for GitHub fetcher retry logic fixes
 * Ensures rate limit handling doesn't create insane wait times
 */

const { GitHubFetcher } = require('../../../src/fetcher/github');
const fetch = require('node-fetch');

// Mock fetch for controlled testing
jest.mock('node-fetch');
const mockFetch = fetch;

describe('GitHub Fetcher Retry Logic', () => {
  let fetcher;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    fetcher = new GitHubFetcher({
      retryCount: 3,
      retryDelay: 1000,
      maxRetryDelay: 30000 // 30 seconds max
    });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Rate Limit Header Parsing', () => {
    test('should parse X-RateLimit-Reset header correctly', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 10; // 10 seconds from now
      
      mockFetch
        .mockResolvedValueOnce({
          status: 403,
          ok: false,
          headers: {
            get: (header) => {
              if (header === 'x-ratelimit-reset') {
                return futureTimestamp.toString();
              }
              return null;
            }
          }
        });

      const startTime = Date.now();
      
      try {
        await fetcher.fetchFile('.claude/settings.json');
      } catch (error) {
        expect(error.code).toBe('GITHUB_RATE_LIMIT');
        
        // Verify rateLimitReset is set correctly (Unix timestamp in seconds * 1000)
        expect(fetcher.rateLimitReset).toBe(futureTimestamp * 1000);
        
        // Should not cause immediate execution delay in test
        const elapsedTime = Date.now() - startTime;
        expect(elapsedTime).toBeLessThan(15000); // Allow for actual wait time
      }
    }, 20000);

    test('should cap rate limit delays at maximum configured value', async () => {
      // Set rate limit reset to 2 hours in future (would cause 2-hour wait without cap)
      const farFutureTimestamp = Math.floor(Date.now() / 1000) + (2 * 60 * 60);
      
      fetcher.rateLimitReset = farFutureTimestamp * 1000;
      
      const delay = fetcher._calculateRetryDelay(1);
      
      // Should be capped at maxRetryDelay (30 seconds)
      expect(delay).toBeLessThanOrEqual(30000);
    });
  });

  describe('Rate Limit Wait Time Calculation', () => {
    test('should never wait more than 30 seconds for rate limit', async () => {
      // Simulate a rate limit that resets in 2 minutes (under the 5-minute fail-fast threshold)
      const futureTimestamp = Math.floor(Date.now() / 1000) + (2 * 60);
      fetcher.rateLimitReset = futureTimestamp * 1000;
      
      const delay = await fetcher._calculateRateLimitDelay();
      
      // Should be capped at 30 seconds, not 2 minutes
      expect(delay).toBeLessThanOrEqual(30000);
      expect(delay).toBeGreaterThan(0);
    });

    test('should use smart rate limit handling for near-future resets', async () => {
      // Rate limit resets in 5 seconds - should wait exactly that time
      const nearFutureTimestamp = Math.floor(Date.now() / 1000) + 5;
      fetcher.rateLimitReset = nearFutureTimestamp * 1000;
      
      const delay = await fetcher._calculateRateLimitDelay();
      
      // Should wait the actual time since it's under the cap
      expect(delay).toBeLessThanOrEqual(6000); // ~5 seconds + small buffer
      expect(delay).toBeGreaterThan(4000);
    });

    test('should fail fast for very long rate limit resets', async () => {
      // Rate limit resets in 1 hour
      const veryFarFutureTimestamp = Math.floor(Date.now() / 1000) + (60 * 60);
      fetcher.rateLimitReset = veryFarFutureTimestamp * 1000;
      
      expect(() => {
        fetcher._shouldFailFastOnRateLimit();
      }).toThrow(/rate limit reset time too far in future/i);
    });
  });

  describe('Exponential Backoff', () => {
    test('should use reasonable exponential backoff progression', () => {
      // Test progression: 1s, 2s, 4s, 8s, 16s, then cap at 30s
      // Allow for 10% jitter variance
      expect(fetcher._calculateRetryDelay(1)).toBeGreaterThan(900);
      expect(fetcher._calculateRetryDelay(1)).toBeLessThan(1100);
      
      expect(fetcher._calculateRetryDelay(2)).toBeGreaterThan(1800);
      expect(fetcher._calculateRetryDelay(2)).toBeLessThan(2200);
      
      expect(fetcher._calculateRetryDelay(3)).toBeGreaterThan(3600);
      expect(fetcher._calculateRetryDelay(3)).toBeLessThan(4400);
      
      // Should cap at 30 seconds
      expect(fetcher._calculateRetryDelay(6)).toBeLessThanOrEqual(30000);
      expect(fetcher._calculateRetryDelay(10)).toBeLessThanOrEqual(30000);
    });

    test('should include jitter to prevent thundering herd', () => {
      const delays = Array(10).fill(0).map(() => fetcher._calculateRetryDelay(3));
      
      // All delays should be different due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
      
      // All delays should be around 4000ms ±10%
      delays.forEach(delay => {
        expect(delay).toBeGreaterThan(3600); // 4000 - 10%
        expect(delay).toBeLessThan(4400);    // 4000 + 10%
      });
    });
  });

  describe('User Experience', () => {
    test('should provide countdown during rate limit waits', async () => {
      const mockSleep = jest.spyOn(fetcher, '_sleep').mockResolvedValue();
      
      // Short rate limit for testing
      fetcher.rateLimitReset = Date.now() + 5000;
      
      await fetcher._waitForRateLimit();
      
      // Should show countdown messages
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/rate limit.*waiting.*\d+s/i)
      );
      
      mockSleep.mockRestore();
    });

    test('should suggest using GitHub token for rate limit issues', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 403,
        ok: false,
        headers: {
          get: (header) => header === 'x-ratelimit-reset' ? String(Math.floor(Date.now() / 1000) + 3600) : null
        }
      });

      try {
        await fetcher.fetchFile('.claude/settings.json');
      } catch (error) {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringMatching(/github token.*rate limit/i)
        );
      }
    });

    test('should allow user to cancel long waits', async () => {
      // Test that we fail fast instead of long waits
      const veryLongReset = Math.floor(Date.now() / 1000) + (2 * 60 * 60); // 2 hours
      
      mockFetch.mockResolvedValueOnce({
        status: 403,
        ok: false,
        headers: {
          get: (header) => header === 'x-ratelimit-reset' ? veryLongReset.toString() : null
        }
      });

      const startTime = Date.now();
      
      try {
        await fetcher.fetchFile('.claude/settings.json');
      } catch (error) {
        const elapsedTime = Date.now() - startTime;
        
        // Should fail fast, not wait 2 hours
        expect(elapsedTime).toBeLessThan(1000);
        expect(error.message).toMatch(/rate limit.*too long.*cancel/i);
      }
    });
  });

  describe('Integration with Retry Logic', () => {
    test('should integrate properly with existing retry wrapper', async () => {
      mockFetch
        .mockResolvedValueOnce({
          status: 403,
          ok: false,
          headers: { get: () => String(Math.floor(Date.now() / 1000) + 2) }
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve({ type: 'file', content: 'dGVzdA==', encoding: 'base64' })
        });

      const result = await fetcher.fetchFile('.claude/settings.json');
      
      expect(result.content).toBe('test');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('should respect maximum retry attempts', async () => {
      // All requests fail with rate limit
      mockFetch.mockImplementation(() => Promise.resolve({
        status: 403,
        ok: false,
        headers: { get: () => String(Math.floor(Date.now() / 1000) + 1) }
      }));

      try {
        await fetcher.fetchFile('.claude/settings.json');
      } catch (error) {
        // Should have tried 3 times (initial + 2 retries)
        expect(mockFetch).toHaveBeenCalledTimes(3);
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing rate limit headers gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 403,
        ok: false,
        headers: { get: () => null }
      });

      try {
        await fetcher.fetchFile('.claude/settings.json');
      } catch (error) {
        // Should still retry with exponential backoff
        expect(error.code).toBeDefined();
      }
    });

    test('should handle malformed rate limit headers', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 403,
        ok: false,
        headers: { get: () => 'invalid-timestamp' }
      });

      try {
        await fetcher.fetchFile('.claude/settings.json');
      } catch (error) {
        // Should fallback to exponential backoff
        expect(error).toBeDefined();
      }
    });

    test('should handle past rate limit reset times', async () => {
      // Rate limit header shows reset time in the past
      const pastTimestamp = Math.floor(Date.now() / 1000) - 60;
      
      mockFetch
        .mockResolvedValueOnce({
          status: 403,
          ok: false,
          headers: { get: () => pastTimestamp.toString() }
        })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () => Promise.resolve({ type: 'file', content: 'dGVzdA==', encoding: 'base64' })
        });

      const result = await fetcher.fetchFile('.claude/settings.json');
      
      // Should retry immediately since reset time is in the past
      expect(result.content).toBe('test');
    });
  });
});