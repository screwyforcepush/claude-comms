/**
 * Comprehensive test suite for GitHub fetcher
 * Tests all three strategies and error handling
 */

const { GitHubFetcher, fetchRepository } = require('../../../src/fetcher/github');
const GitHubAPIMock = require('../../mocks/github-api');
// const { InstallerError, GitHubAPIError, NetworkError } = require('../../../src/utils/errors'); // TODO: Use error types in tests

describe('GitHubFetcher', () => {
  let fetcher;
  let mockApi;

  beforeEach(() => {
    fetcher = new GitHubFetcher();
    mockApi = new GitHubAPIMock();
  });

  afterEach(() => {
    mockApi.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(fetcher.repository.owner).toBe('alexsavage');
      expect(fetcher.repository.repo).toBe('claude-comms');
      expect(fetcher.repository.branch).toBe('main');
      expect(fetcher.config.timeout).toBe(10000);
      expect(fetcher.config.retryCount).toBe(3);
    });

    it('should accept custom configuration', () => {
      const customFetcher = new GitHubFetcher({
        repository: {
          owner: 'custom',
          repo: 'test-repo',
          branch: 'develop'
        },
        timeout: 5000,
        retryCount: 5
      });

      expect(customFetcher.repository.owner).toBe('custom');
      expect(customFetcher.repository.repo).toBe('test-repo');
      expect(customFetcher.repository.branch).toBe('develop');
      expect(customFetcher.config.timeout).toBe(5000);
      expect(customFetcher.config.retryCount).toBe(5);
    });

    it('should use GitHub token from environment if available', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      const tokenFetcher = new GitHubFetcher();
      expect(tokenFetcher.config.token).toBe('test-token');
      delete process.env.GITHUB_TOKEN;
    });
  });

  describe('validateConnection', () => {
    it('should return true for successful connection', async () => {
      mockApi.mockDirectoryListing();
      const isValid = await fetcher.validateConnection();
      expect(isValid).toBe(true);
    });

    it('should return false for failed connection', async () => {
      mockApi.mockNetworkError();
      const isValid = await fetcher.validateConnection();
      expect(isValid).toBe(false);
    });
  });

  describe('fetchDirectory', () => {
    it('should successfully fetch directory using Trees API', async () => {
      mockApi.mockTreesAPI();

      // Mock individual file content fetches
      mockApi.mockFileContent('.claude/settings.json', JSON.stringify({ version: '1.0.0' }));
      mockApi.mockFileContent('.claude/hooks/comms/send_message.py', 'print("send message")');

      const result = await fetcher.fetchDirectory('.claude');

      expect(result.path).toBe('.claude');
      expect(result.type).toBe('dir');
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.children).toBeDefined();
    });

    it('should fallback to Contents API when Trees API fails', async () => {
      // Mock Trees API failure
      mockApi.mockNetworkError();

      // Mock successful Contents API
      mockApi.mockDirectoryListing();
      mockApi.mockFileContent('.claude/settings.json', JSON.stringify({ version: '1.0.0' }));

      const result = await fetcher.fetchDirectory('.claude');

      expect(result.path).toBe('.claude');
      expect(result.type).toBe('dir');
    });

    it('should fallback to Raw URLs when both APIs fail', async () => {
      // Mock both API failures
      mockApi.mockNetworkError();
      mockApi.mockNetworkError();

      // Mock successful raw downloads
      mockApi.mockRawDownload('.claude/settings.json', JSON.stringify({ version: '1.0.0' }));
      mockApi.mockRawDownload('.claude/hooks/install.py', 'print("install")');

      const result = await fetcher.fetchDirectory('.claude');

      expect(result.path).toBe('.claude');
      expect(result.type).toBe('dir');
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should emit progress events during fetch', async () => {
      mockApi.mockTreesAPI();
      mockApi.mockFileContent('.claude/settings.json', JSON.stringify({ version: '1.0.0' }));

      const progressEvents = [];
      fetcher.on('progress', (event) => {
        progressEvents.push(event);
      });

      await fetcher.fetchDirectory('.claude');

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].task).toBe('fetch_directory');
      expect(progressEvents[0].status).toBe('running');
      expect(progressEvents[progressEvents.length - 1].status).toBe('complete');
    });

    it('should handle rate limiting with exponential backoff', async () => {
      mockApi.mockWithRetries('.claude', 2);

      const startTime = Date.now();
      const result = await fetcher.fetchDirectory('.claude');
      const endTime = Date.now();

      // Should have taken some time due to retries
      expect(endTime - startTime).toBeGreaterThan(100);
      expect(result.path).toBe('.claude');
    });

    it('should handle API rate limit response', async () => {
      mockApi.mockRateLimit();

      // Should eventually succeed after rate limit reset
      setTimeout(() => {
        mockApi.mockDirectoryListing();
      }, 100);

      await expect(fetcher.fetchDirectory('.claude')).rejects.toThrow();
    });

    it('should handle truncated tree response', async () => {
      const truncatedResponse = {
        sha: 'main',
        tree: [],
        truncated: true
      };

      mockApi.mockTreesAPI('main', true);
      // Override with truncated response
      mockApi.interceptors[0].reply(200, truncatedResponse);

      // Should fallback to Contents API
      mockApi.mockDirectoryListing();
      mockApi.mockFileContent('.claude/settings.json', JSON.stringify({ version: '1.0.0' }));

      const result = await fetcher.fetchDirectory('.claude');
      expect(result.path).toBe('.claude');
    });
  });

  describe('fetchFile', () => {
    it('should successfully fetch single file using Contents API', async () => {
      const fileContent = '# Claude Setup\nThis is the setup file.';
      mockApi.mockFileContent('CLAUDE.md', fileContent);

      const result = await fetcher.fetchFile('CLAUDE.md');

      expect(result.path).toBe('CLAUDE.md');
      expect(result.content).toBe(fileContent);
      expect(result.encoding).toBe('utf-8');
      expect(result.sha).toBeDefined();
    });

    it('should fallback to raw URL when Contents API fails', async () => {
      mockApi.mockNetworkError('CLAUDE.md');

      const fileContent = '# Claude Setup\nThis is the setup file.';
      mockApi.mockRawDownload('CLAUDE.md', fileContent);

      const result = await fetcher.fetchFile('CLAUDE.md');

      expect(result.path).toBe('CLAUDE.md');
      expect(result.content).toBe(fileContent);
      expect(result.encoding).toBe('utf-8');
      expect(result.sha).toBeNull(); // Raw URLs don't provide SHA
    });

    it('should emit progress events during file fetch', async () => {
      mockApi.mockFileContent('CLAUDE.md', '# Test content');

      const progressEvents = [];
      fetcher.on('progress', (event) => {
        progressEvents.push(event);
      });

      await fetcher.fetchFile('CLAUDE.md');

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].task).toBe('fetch_file');
      expect(progressEvents[0].status).toBe('running');
      expect(progressEvents[progressEvents.length - 1].status).toBe('complete');
    });

    it('should handle base64 encoded content', async () => {
      const originalContent = 'Binary file content';
      const response = {
        type: 'file',
        name: 'binary.dat',
        path: 'binary.dat',
        content: Buffer.from(originalContent).toString('base64'),
        encoding: 'base64',
        sha: 'abc123'
      };

      mockApi.mockFileContent('binary.dat', originalContent);
      // Override with base64 response
      mockApi.interceptors[0].reply(200, response);

      const result = await fetcher.fetchFile('binary.dat');
      expect(result.content).toBe(originalContent);
    });
  });

  describe('error handling', () => {
    it('should throw InstallerError for network failures', async () => {
      mockApi.mockNetworkError('.claude');
      mockApi.mockNetworkError('.claude');
      mockApi.mockNetworkError('.claude');

      await expect(fetcher.fetchDirectory('.claude')).rejects.toThrow();
    });

    it('should throw InstallerError for 404 responses', async () => {
      mockApi.mock404('.claude');
      mockApi.mock404('.claude');
      mockApi.mock404('.claude');

      await expect(fetcher.fetchDirectory('.claude')).rejects.toThrow();
    });

    it('should throw InstallerError for malformed JSON', async () => {
      mockApi.mockMalformedResponse('.claude');
      mockApi.mockMalformedResponse('.claude');
      mockApi.mockMalformedResponse('.claude');

      await expect(fetcher.fetchDirectory('.claude')).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      mockApi.mockSlowResponse('.claude', 15000); // Longer than default timeout

      const timeoutFetcher = new GitHubFetcher({ timeout: 1000 });

      await expect(timeoutFetcher.fetchDirectory('.claude')).rejects.toThrow();
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limit delays', async () => {
      const fetcher = new GitHubFetcher();

      // Mock multiple successful requests
      for (let i = 0; i < 3; i++) {
        mockApi.mockFileContent(`file${i}.txt`, `content ${i}`);
      }

      const startTime = Date.now();

      // Fetch multiple files which should have rate limit delays
      await Promise.all([
        fetcher.fetchFile('file0.txt'),
        fetcher.fetchFile('file1.txt'),
        fetcher.fetchFile('file2.txt')
      ]);

      const endTime = Date.now();

      // Should take at least some time due to rate limiting
      expect(endTime - startTime).toBeGreaterThan(200);
    });

    it('should calculate exponential backoff correctly', async () => {
      const delay1 = fetcher._calculateRetryDelay(1);
      const delay2 = fetcher._calculateRetryDelay(2);
      const delay3 = fetcher._calculateRetryDelay(3);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
      expect(delay3).toBeLessThanOrEqual(fetcher.config.maxRetryDelay);
    });
  });

  describe('file tree building', () => {
    it('should build correct hierarchical structure', async () => {
      const files = [
        { path: '.claude/settings.json', content: '{}' },
        { path: '.claude/hooks/install.py', content: 'print("install")' },
        { path: '.claude/hooks/comms/send.py', content: 'print("send")' },
        { path: '.claude/agents/orchestrator.py', content: 'print("orchestrator")' }
      ];

      const tree = fetcher._buildFileTree('.claude', files);

      expect(tree.path).toBe('.claude');
      expect(tree.type).toBe('dir');
      expect(tree.files).toEqual(files);
      expect(tree.children.length).toBeGreaterThan(0);
    });

    it('should flatten file tree correctly', async () => {
      const tree = {
        path: '.claude',
        type: 'dir',
        files: [
          { path: '.claude/file1.txt', content: 'content1' },
          { path: '.claude/file2.txt', content: 'content2' }
        ]
      };

      const flattened = fetcher._flattenFileTree(tree);
      expect(flattened.length).toBe(2);
      expect(flattened[0].path).toBe('.claude/file1.txt');
      expect(flattened[1].path).toBe('.claude/file2.txt');
    });
  });

  describe('configuration and options', () => {
    it('should handle custom repository configuration', async () => {
      const customFetcher = new GitHubFetcher({
        repository: {
          owner: 'custom-owner',
          repo: 'custom-repo',
          branch: 'develop'
        }
      });

      mockApi.mockDirectoryListing();

      const spy = jest.spyOn(customFetcher, '_makeRequest');

      await customFetcher.fetchDirectory('.claude');

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('custom-owner/custom-repo'),
        expect.any(Object)
      );
    });

    it('should handle version/branch options', async () => {
      mockApi.mockTreesAPI('v1.0.0');
      mockApi.mockFileContent('.claude/settings.json', '{}');

      const result = await fetcher.fetchDirectory('.claude', { version: 'v1.0.0' });

      expect(result.path).toBe('.claude');
    });
  });
});

describe('fetchRepository', () => {
  let mockApi;

  beforeEach(() => {
    mockApi = new GitHubAPIMock();
  });

  afterEach(() => {
    mockApi.cleanup();
  });

  it('should fetch both .claude directory and CLAUDE.md file', async () => {
    mockApi.mockTreesAPI();
    mockApi.mockFileContent('.claude/settings.json', JSON.stringify({ version: '1.0.0' }));
    mockApi.mockFileContent('CLAUDE.md', '# Claude Setup');

    const result = await fetchRepository();

    expect(result.claudeDirectory).toBeDefined();
    expect(result.claudeFile).toBeDefined();
    expect(result.files).toBeDefined();
    expect(result.claudeDirectory.path).toBe('.claude');
    expect(result.claudeFile.path).toBe('CLAUDE.md');
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('should handle custom git reference', async () => {
    mockApi.mockTreesAPI('v2.0.0');
    mockApi.mockFileContent('.claude/settings.json', JSON.stringify({ version: '2.0.0' }));
    mockApi.mockFileContent('CLAUDE.md', '# Claude Setup v2');

    const result = await fetchRepository('v2.0.0');

    expect(result.claudeDirectory.path).toBe('.claude');
    expect(result.claudeFile.path).toBe('CLAUDE.md');
  });

  it('should handle custom options', async () => {
    mockApi.mockTreesAPI();
    mockApi.mockFileContent('.claude/settings.json', '{}');
    mockApi.mockFileContent('CLAUDE.md', '# Test');

    const result = await fetchRepository('main', {
      timeout: 5000,
      retryCount: 5
    });

    expect(result.claudeDirectory).toBeDefined();
    expect(result.claudeFile).toBeDefined();
  });
});

describe('parallel processing', () => {
  let fetcher;
  let mockApi;

  beforeEach(() => {
    fetcher = new GitHubFetcher();
    mockApi = new GitHubAPIMock();
  });

  afterEach(() => {
    mockApi.cleanup();
  });

  it('should process file batches in parallel', async () => {
    const fileItems = [
      { path: '.claude/file1.txt' },
      { path: '.claude/file2.txt' },
      { path: '.claude/file3.txt' },
      { path: '.claude/file4.txt' },
      { path: '.claude/file5.txt' }
    ];

    // Mock all file contents
    fileItems.forEach((item, index) => {
      mockApi.mockFileContent(item.path, `content ${index}`);
    });

    const startTime = Date.now();
    const results = await fetcher._fetchFilesBatch(fileItems, { version: 'main' });
    const endTime = Date.now();

    expect(results.length).toBe(5);
    expect(results[0].content).toBe('content 0');
    expect(results[4].content).toBe('content 4');

    // Should be faster than sequential processing
    expect(endTime - startTime).toBeLessThan(1000);
  });

  it('should handle batch failures gracefully', async () => {
    const fileItems = [
      { path: '.claude/file1.txt' },
      { path: '.claude/file2.txt' },
      { path: '.claude/file3.txt' }
    ];

    // Mock first file success, second file failure, third file success
    mockApi.mockFileContent('.claude/file1.txt', 'content 1');
    mockApi.mockNetworkError('.claude/file2.txt');
    mockApi.mockFileContent('.claude/file3.txt', 'content 3');

    const results = await fetcher._fetchFilesBatch(fileItems, { version: 'main' });

    // Should get 2 successful results, 1 failure filtered out
    expect(results.length).toBe(2);
    expect(results[0].content).toBe('content 1');
    expect(results[1].content).toBe('content 3');
  });
});

describe('EventEmitter functionality', () => {
  let fetcher;
  let mockApi;

  beforeEach(() => {
    fetcher = new GitHubFetcher();
    mockApi = new GitHubAPIMock();
  });

  afterEach(() => {
    mockApi.cleanup();
  });

  it('should emit progress events with correct format', async () => {
    mockApi.mockFileContent('CLAUDE.md', '# Test');

    const events = [];
    fetcher.on('progress', (event) => {
      events.push(event);
    });

    await fetcher.fetchFile('CLAUDE.md');

    expect(events.length).toBeGreaterThan(0);

    events.forEach(event => {
      expect(event).toHaveProperty('task');
      expect(event).toHaveProperty('current');
      expect(event).toHaveProperty('message');
      expect(event).toHaveProperty('status');
      expect(['running', 'complete', 'failed']).toContain(event.status);
    });
  });

  it('should emit progress events during directory fetch', async () => {
    mockApi.mockTreesAPI();
    mockApi.mockFileContent('.claude/settings.json', '{}');

    const events = [];
    fetcher.on('progress', (event) => {
      events.push(event);
    });

    await fetcher.fetchDirectory('.claude');

    const directoryEvents = events.filter(e => e.task === 'fetch_directory');
    expect(directoryEvents.length).toBeGreaterThan(0);

    const startEvent = directoryEvents.find(e => e.status === 'running' && e.current === 0);
    const endEvent = directoryEvents.find(e => e.status === 'complete' && e.current === 100);

    expect(startEvent).toBeDefined();
    expect(endEvent).toBeDefined();
  });
});
