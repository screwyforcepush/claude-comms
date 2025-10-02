/**
 * GitHub API Mock Implementation
 * Provides comprehensive mocking for GitHub Trees and Contents API
 */

const nock = require('nock');

class GitHubAPIMock {
  constructor() {
    this.baseUrl = 'https://api.github.com';
    this.repo = 'alexsavage/claude-comms';
    this.interceptors = [];
  }

  /**
   * Mock successful directory listing response
   */
  mockDirectoryListing(path = '.claude', response = null) {
    const defaultResponse = [
      {
        name: 'agents',
        type: 'dir',
        path: '.claude/agents',
        sha: 'abc123',
        url: `${this.baseUrl}/repos/${this.repo}/contents/.claude/agents`
      },
      {
        name: 'hooks',
        type: 'dir',
        path: '.claude/hooks',
        sha: 'def456',
        url: `${this.baseUrl}/repos/${this.repo}/contents/.claude/hooks`
      },
      {
        name: 'settings.json',
        type: 'file',
        path: '.claude/settings.json',
        sha: 'ghi789',
        size: 256,
        download_url: `https://raw.githubusercontent.com/${this.repo}/main/.claude/settings.json`,
        url: `${this.baseUrl}/repos/${this.repo}/contents/.claude/settings.json`
      }
    ];

    const interceptor = nock(this.baseUrl)
      .get(`/repos/${this.repo}/contents/${path}`)
      .reply(200, response || defaultResponse);

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock hooks directory structure
   */
  mockHooksDirectory() {
    const hooksResponse = [
      {
        name: 'comms',
        type: 'dir',
        path: '.claude/hooks/comms',
        sha: 'comms123'
      },
      {
        name: 'prompt_capture',
        type: 'dir',
        path: '.claude/hooks/prompt_capture',
        sha: 'prompt123'
      },
      {
        name: 'install.py',
        type: 'file',
        path: '.claude/hooks/install.py',
        sha: 'install123',
        size: 1024,
        download_url: `https://raw.githubusercontent.com/${this.repo}/main/.claude/hooks/install.py`
      }
    ];

    return this.mockDirectoryListing('.claude/hooks', hooksResponse);
  }

  /**
   * Mock file content response
   */
  mockFileContent(filePath, content = 'mock file content', _encoding = 'utf-8') {
    const response = {
      type: 'file',
      name: filePath.split('/').pop(),
      path: filePath,
      content: Buffer.from(content).toString('base64'),
      encoding: 'base64',
      size: content.length,
      sha: 'file123',
      download_url: `https://raw.githubusercontent.com/${this.repo}/main/${filePath}`
    };

    const interceptor = nock(this.baseUrl)
      .get(`/repos/${this.repo}/contents/${filePath}`)
      .reply(200, response);

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock rate limit response
   */
  mockRateLimit(resetTime = Date.now() + 3600000) {
    const interceptor = nock(this.baseUrl)
      .get(`/repos/${this.repo}/contents/.claude`)
      .reply(403, {
        message: 'API rate limit exceeded',
        documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
      }, {
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': Math.floor(resetTime / 1000).toString()
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock network error
   */
  mockNetworkError(path = '.claude') {
    const interceptor = nock(this.baseUrl)
      .get(`/repos/${this.repo}/contents/${path}`)
      .replyWithError('Network error: ECONNREFUSED');

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock 404 not found
   */
  mock404(path = '.claude') {
    const interceptor = nock(this.baseUrl)
      .get(`/repos/${this.repo}/contents/${path}`)
      .reply(404, {
        message: 'Not Found',
        documentation_url: 'https://docs.github.com/rest/reference/repos#get-repository-content'
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock malformed JSON response
   */
  mockMalformedResponse(path = '.claude') {
    const interceptor = nock(this.baseUrl)
      .get(`/repos/${this.repo}/contents/${path}`)
      .reply(200, 'invalid json content');

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock trees API for recursive directory fetching
   */
  mockTreesAPI(sha = 'main', recursive = true) {
    const response = {
      sha: sha,
      url: `${this.baseUrl}/repos/${this.repo}/git/trees/${sha}`,
      tree: [
        {
          path: '.claude',
          mode: '040000',
          type: 'tree',
          sha: 'claude123'
        },
        {
          path: '.claude/agents',
          mode: '040000',
          type: 'tree',
          sha: 'agents123'
        },
        {
          path: '.claude/hooks',
          mode: '040000',
          type: 'tree',
          sha: 'hooks123'
        },
        {
          path: '.claude/hooks/comms/send_message.py',
          mode: '100644',
          type: 'blob',
          sha: 'send123',
          size: 2048,
          url: `${this.baseUrl}/repos/${this.repo}/git/blobs/send123`
        },
        {
          path: '.claude/settings.json',
          mode: '100644',
          type: 'blob',
          sha: 'settings123',
          size: 256,
          url: `${this.baseUrl}/repos/${this.repo}/git/blobs/settings123`
        }
      ],
      truncated: false
    };

    const interceptor = nock(this.baseUrl)
      .get(`/repos/${this.repo}/git/trees/${sha}`)
      .query({ recursive: recursive.toString() })
      .reply(200, response);

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock raw file download
   */
  mockRawDownload(filePath, content = 'mock file content') {
    const interceptor = nock('https://raw.githubusercontent.com')
      .get(`/${this.repo}/main/${filePath}`)
      .reply(200, content);

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock binary file download
   */
  mockBinaryDownload(filePath, content = Buffer.from('binary content')) {
    const interceptor = nock('https://raw.githubusercontent.com')
      .get(`/${this.repo}/main/${filePath}`)
      .reply(200, content, {
        'content-type': 'application/octet-stream'
      });

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock slow response for timeout testing
   */
  mockSlowResponse(path = '.claude', delay = 5000) {
    const interceptor = nock(this.baseUrl)
      .get(`/repos/${this.repo}/contents/${path}`)
      .delay(delay)
      .reply(200, []);

    this.interceptors.push(interceptor);
    return interceptor;
  }

  /**
   * Mock successful with retries (fail first N attempts)
   */
  mockWithRetries(path = '.claude', failCount = 2) {
    // First N attempts fail
    for (let i = 0; i < failCount; i++) {
      const interceptor = nock(this.baseUrl)
        .get(`/repos/${this.repo}/contents/${path}`)
        .reply(500, { message: 'Internal Server Error' });

      this.interceptors.push(interceptor);
    }

    // Final attempt succeeds
    const successInterceptor = this.mockDirectoryListing(path);
    return successInterceptor;
  }

  /**
   * Clean up all interceptors
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
   * Verify all mocks were called
   */
  verify() {
    const pending = nock.pendingMocks();
    if (pending.length > 0) {
      throw new Error(`Unused mocks: ${pending.join(', ')}`);
    }
  }

  /**
   * Helper to create a complete installation scenario
   */
  mockFullInstallationScenario() {
    // Main directory listing
    this.mockDirectoryListing();

    // Hooks directory
    this.mockHooksDirectory();

    // Agents directory
    this.mockDirectoryListing('.claude/agents', [
      {
        name: 'agent-orchestrator.py',
        type: 'file',
        path: '.claude/agents/agent-orchestrator.py',
        sha: 'orch123',
        size: 4096,
        download_url: `https://raw.githubusercontent.com/${this.repo}/main/.claude/agents/agent-orchestrator.py`
      }
    ]);

    // Individual file contents
    this.mockFileContent('.claude/settings.json', JSON.stringify({
      version: '1.0.0',
      server_url: 'http://localhost:4000'
    }));

    this.mockRawDownload('.claude/hooks/install.py', 'print("Installing hooks...")');
    this.mockRawDownload('.claude/agents/agent-orchestrator.py', '# Agent orchestrator code');
  }
}

module.exports = GitHubAPIMock;
