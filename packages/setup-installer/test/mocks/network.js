/**
 * Network Mock Implementation
 * Provides comprehensive mocking for network requests and HTTP operations
 */

const nock = require('nock');

class NetworkMock {
  constructor() {
    this.interceptors = [];
    this.defaultHeaders = {
      'user-agent': 'claude-setup-installer/1.0.0',
      'accept': 'application/json'
    };
  }

  /**
   * Mock successful network response
   */
  mockSuccess(url, response = { success: true }, statusCode = 200, headers = {}) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .reply(statusCode, response, headers);

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock network timeout
   */
  mockTimeout(url, delay = 10000) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .delay(delay)
      .reply(200, { timeout: true });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock connection refused error
   */
  mockConnectionRefused(url) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .replyWithError({
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock DNS resolution failure
   */
  mockDNSFailure(url) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .replyWithError({
        code: 'ENOTFOUND',
        message: 'DNS lookup failed'
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock HTTP error responses
   */
  mockHTTPError(url, statusCode = 500, errorMessage = 'Internal Server Error') {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .reply(statusCode, {
        error: errorMessage,
        status: statusCode
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock slow response for performance testing
   */
  mockSlowResponse(url, delay = 5000, response = { slow: true }) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .delay(delay)
      .reply(200, response);

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock intermittent failures (succeeds after N failures)
   */
  mockIntermittentFailure(url, failureCount = 2, finalResponse = { success: true }) {
    // First N attempts fail
    for (let i = 0; i < failureCount; i++) {
      const urlObj = new URL(url);
      const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
        .get(urlObj.pathname + (urlObj.search || ''))
        .reply(500, { error: 'Temporary failure' });

      this.interceptors.push(interceptor);
    }

    // Final attempt succeeds
    return this.mockSuccess(url, finalResponse);
  }

  /**
   * Mock rate limiting response
   */
  mockRateLimit(url, retryAfter = 60) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .reply(429, {
        error: 'Rate limit exceeded',
        message: 'Too many requests'
      }, {
        'retry-after': retryAfter.toString(),
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': Math.floor((Date.now() + retryAfter * 1000) / 1000).toString()
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock redirect responses
   */
  mockRedirect(originalUrl, redirectUrl, statusCode = 302) {
    const urlObj = new URL(originalUrl);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .reply(statusCode, '', {
        'location': redirectUrl
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock HTTPS certificate errors
   */
  mockSSLError(url) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .replyWithError({
        code: 'CERT_UNTRUSTED',
        message: 'SSL certificate verification failed'
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock large response for memory testing
   */
  mockLargeResponse(url, sizeInMB = 10) {
    const content = 'x'.repeat(sizeInMB * 1024 * 1024);
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .reply(200, content, {
        'content-length': content.length.toString(),
        'content-type': 'text/plain'
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock binary content download
   */
  mockBinaryDownload(url, binaryData = Buffer.from('binary content')) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .reply(200, binaryData, {
        'content-type': 'application/octet-stream',
        'content-length': binaryData.length.toString()
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock chunked transfer encoding
   */
  mockChunkedResponse(url, chunks = ['chunk1', 'chunk2', 'chunk3']) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''))
      .reply(200, chunks.join(''), {
        'transfer-encoding': 'chunked'
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock POST request
   */
  mockPost(url, expectedBody = {}, response = { success: true }, statusCode = 200) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .post(urlObj.pathname + (urlObj.search || ''), expectedBody)
      .reply(statusCode, response);

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock PUT request
   */
  mockPut(url, expectedBody = {}, response = { success: true }, statusCode = 200) {
    const urlObj = new URL(url);
    const interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .put(urlObj.pathname + (urlObj.search || ''), expectedBody)
      .reply(statusCode, response);

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock with custom headers validation
   */
  mockWithHeaders(url, requiredHeaders = {}, response = { success: true }) {
    const urlObj = new URL(url);
    let interceptor = nock(`${urlObj.protocol}//${urlObj.host}`)
      .get(urlObj.pathname + (urlObj.search || ''));

    // Add header matching
    for (const [key, value] of Object.entries(requiredHeaders)) {
      interceptor = interceptor.matchHeader(key, value);
    }

    interceptor = interceptor.reply(200, response);
    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock network with bandwidth throttling simulation
   */
  mockThrottledResponse(url, response = { success: true }, bytesPerSecond = 1024) {
    const responseSize = JSON.stringify(response).length;
    const delay = (responseSize / bytesPerSecond) * 1000; // Convert to milliseconds

    return this.mockSlowResponse(url, delay, response);
  }

  /**
   * Setup complete scenario for dependency checking
   */
  mockDependencyCheckScenario() {
    // Mock Python version check
    this.mockSuccess('https://www.python.org/api/version', {
      version: '3.9.0',
      latest: '3.11.0'
    });

    // Mock uv availability check
    this.mockSuccess('https://pypi.org/pypi/uv/json', {
      info: {
        version: '0.1.0'
      }
    });

    // Mock observability server health check
    this.mockSuccess('http://localhost:4000/health', {
      status: 'healthy',
      version: '1.0.0'
    });
  }

  /**
   * Setup failure scenario for dependency checking
   */
  mockDependencyFailureScenario() {
    // Python not found
    this.mockConnectionRefused('https://www.python.org/api/version');

    // uv not available
    this.mock404('https://pypi.org/pypi/uv/json');

    // Observability server down
    this.mockConnectionRefused('http://localhost:4000/health');
  }

  /**
   * Mock proxy scenarios
   */
  mockProxyScenario(proxyUrl, targetUrl, response = { proxied: true }) {
    const proxyObj = new URL(proxyUrl);
    const interceptor = nock(`${proxyObj.protocol}//${proxyObj.host}`)
      .get('/')
      .query({ url: targetUrl })
      .reply(200, response);

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Verify all network calls were made
   */
  verify() {
    const pending = nock.pendingMocks();
    if (pending.length > 0) {
      throw new Error(`Unused network mocks: ${pending.join(', ')}`);
    }
  }

  /**
   * Get network request statistics
   */
  getStats() {
    return {
      totalInterceptors: this.interceptors.length,
      pendingMocks: nock.pendingMocks().length,
      isActive: nock.isActive()
    };
  }

  /**
   * Clean up all network mocks
   */
  cleanup() {
    this.interceptors.forEach(interceptor => {
      if (interceptor.isDone && !interceptor.isDone()) {
        interceptor.done();
      }
    });
    this.interceptors = [];
    nock.cleanAll();
  }

  /**
   * Enable/disable real network calls
   */
  enableRealNetworking() {
    nock.enableNetConnect();
  }

  disableRealNetworking() {
    nock.disableNetConnect();
  }

  /**
   * Mock offline scenario (no network available)
   */
  mockOfflineScenario() {
    nock.disableNetConnect();

    // Mock all common requests to fail
    const commonUrls = [
      'https://api.github.com',
      'https://raw.githubusercontent.com',
      'https://pypi.org',
      'http://localhost:4000'
    ];

    commonUrls.forEach(url => {
      this.mockConnectionRefused(`${url}/test`);
    });
  }
}

module.exports = NetworkMock;
