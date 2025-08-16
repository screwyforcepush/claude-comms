/**
 * GitHub API client for fetching Claude setup files
 * Implements the multi-strategy approach from architecture design
 */

const fetch = require('node-fetch');
const tar = require('tar');
const { EventEmitter } = require('events');
const { GitHubAPIError } = require('../utils/errors');
const fs = require('fs');
const path = require('path');
const os = require('os');

class GitHubFetcher extends EventEmitter {
  constructor(options = {}) {
    super();

    this.repository = options.repository || {
      owner: 'screwyforcepush',
      repo: 'claude-code-subagent-bus',
      branch: 'main',
      paths: {
        claudeDir: '.claude',
        claudeMd: 'CLAUDE.md'
      }
    };

    this.config = {
      baseUrl: 'https://api.github.com',
      rawUrl: 'https://raw.githubusercontent.com',
      timeout: options.timeout || 10000,
      retryCount: options.retryCount || 3,
      retryDelay: options.retryDelay || 1000,
      maxRetryDelay: options.maxRetryDelay || 10000,
      userAgent: options.userAgent || '@claude-code/setup-installer/1.0.0',
      token: options.token || process.env.GITHUB_TOKEN
    };

    this.rateLimitReset = null;
    this.requestCount = 0;
  }

  /**
   * Fetch repository files according to FetcherAPI interface
   * @param {string} path - Directory path to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<FileTree>} Directory structure
   */
  async fetchDirectory(path, options = {}) {
    const fetchOptions = this._prepareFetchOptions(options);

    this.emit('progress', {
      task: 'fetch_directory',
      current: 0,
      message: `Fetching directory: ${path}`,
      status: 'running'
    });

    try {
      // Strategy 1: GitHub Trees API (fastest for recursive fetch)
      const result = await this._fetchWithTrees(path, fetchOptions);

      this.emit('progress', {
        task: 'fetch_directory',
        current: 100,
        message: `Successfully fetched ${path}`,
        status: 'complete'
      });

      return result;
    } catch (treesError) {
      console.warn(`Trees API failed: ${treesError.message}`);

      try {
        // Strategy 2: GitHub Contents API (fallback)
        const result = await this._fetchWithContents(path, fetchOptions);

        this.emit('progress', {
          task: 'fetch_directory',
          current: 100,
          message: `Successfully fetched ${path} via Contents API`,
          status: 'complete'
        });

        return result;
      } catch (contentsError) {
        console.warn(`Contents API failed: ${contentsError.message}`);

        // Strategy 3: Raw URLs (last resort)
        const result = await this._fetchWithRawUrls(path, fetchOptions);

        this.emit('progress', {
          task: 'fetch_directory',
          current: 100,
          message: `Successfully fetched ${path} via raw URLs`,
          status: 'complete'
        });

        return result;
      }
    }
  }

  /**
   * Fetch individual file according to FetcherAPI interface
   * @param {string} path - File path to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<FileContent>} File content
   */
  async fetchFile(path, options = {}) {
    const fetchOptions = this._prepareFetchOptions(options);

    this.emit('progress', {
      task: 'fetch_file',
      current: 0,
      message: `Fetching file: ${path}`,
      status: 'running'
    });

    try {
      // Try Contents API first for single files
      const result = await this._fetchSingleFileContent(path, fetchOptions);

      this.emit('progress', {
        task: 'fetch_file',
        current: 100,
        message: `Successfully fetched ${path}`,
        status: 'complete'
      });

      return result;
    } catch (contentsError) {
      console.warn(`Contents API failed for ${path}: ${contentsError.message}`);

      // Fallback to raw URL
      const result = await this._fetchSingleFileRaw(path, fetchOptions);

      this.emit('progress', {
        task: 'fetch_file',
        current: 100,
        message: `Successfully fetched ${path} via raw URL`,
        status: 'complete'
      });

      return result;
    }
  }

  /**
   * Fetch repository as tarball (single request, fastest approach)
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Repository files extracted from tarball
   */
  async fetchAsTarball(options = {}) {
    const fetchOptions = this._prepareFetchOptions(options);

    this.emit('progress', {
      task: 'fetch_tarball',
      current: 0,
      message: 'Downloading repository tarball...',
      status: 'running'
    });

    try {
      // Download tarball from GitHub
      const tarballBuffer = await this._downloadTarball(fetchOptions);

      this.emit('progress', {
        task: 'fetch_tarball',
        current: 50,
        message: 'Extracting files from tarball...',
        status: 'running'
      });

      // Extract and filter files
      const extractedFiles = await this._extractTarballFiles(tarballBuffer, fetchOptions);

      this.emit('progress', {
        task: 'fetch_tarball',
        current: 100,
        message: `Successfully extracted ${Object.keys(extractedFiles).length} file groups`,
        status: 'complete'
      });

      return extractedFiles;

    } catch (error) {
      this.emit('progress', {
        task: 'fetch_tarball',
        current: 0,
        message: `Tarball fetch failed: ${error.message}`,
        status: 'failed'
      });
      throw error;
    }
  }

  /**
   * Validate GitHub connection
   * @returns {Promise<boolean>} Connection status
   */
  async validateConnection() {
    try {
      const url = `${this.config.baseUrl}/repos/${this.repository.owner}/${this.repository.repo}`;
      const response = await this._makeRequest(url, { method: 'HEAD' });
      return response.status === 200;
    } catch (error) {
      console.warn(`GitHub connection validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Strategy 1: GitHub Trees API for recursive directory fetch
   * @private
   */
  async _fetchWithTrees(path, options) {
    const { version } = options;
    const url = `${this.config.baseUrl}/repos/${this.repository.owner}/${this.repository.repo}/git/trees/${version}?recursive=1`;

    const response = await this._makeRequest(url);
    const data = await response.json();

    if (data.truncated) {
      throw new GitHubAPIError(
        'Repository tree is too large for Trees API',
        { url, truncated: true }
      );
    }

    // Filter and structure tree data
    const claudeFiles = data.tree.filter(item => {
      // Include files in the requested path or exact match for root files
      const isInPath = item.path.startsWith(path + '/') || item.path === path;
      const isBlob = item.type === 'blob';
      const shouldSkip = this._shouldSkipFile(item.path.split('/').pop()) ||
                        this._shouldSkipDirectory(item.path.split('/').pop());

      return isInPath && isBlob && !shouldSkip;
    });

    // Fetch file contents in parallel batches
    const files = await this._fetchFilesBatch(claudeFiles, options);

    return this._buildFileTree(path, files);
  }

  /**
   * Strategy 2: GitHub Contents API for directory fetch
   * @private
   */
  async _fetchWithContents(path, options) {
    const { version } = options;
    const url = `${this.config.baseUrl}/repos/${this.repository.owner}/${this.repository.repo}/contents/${path}?ref=${version}`;

    const response = await this._makeRequest(url);
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new GitHubAPIError(
        `Expected directory but got file: ${path}`,
        { path, type: data.type }
      );
    }

    const files = [];

    // Process each item in directory
    for (const item of data) {
      if (item.type === 'file') {
        // Skip binary files and cache files
        if (!this._shouldSkipFile(item.name)) {
          try {
            const content = await this._fetchSingleFileContent(item.path, options);
            files.push(content);
          } catch (error) {
            console.warn(`Failed to fetch file ${item.path}: ${error.message}`);
          }
        }
      } else if (item.type === 'dir') {
        // Skip __pycache__ and other generated directories
        if (!this._shouldSkipDirectory(item.name)) {
          try {
            // Recursively fetch subdirectories
            const subTree = await this._fetchWithContents(item.path, options);
            files.push(...this._flattenFileTree(subTree));
          } catch (error) {
            console.warn(`Failed to fetch directory ${item.path}: ${error.message}`);
          }
        }
      }
    }

    return this._buildFileTree(path, files);
  }

  /**
   * Strategy 3: Raw URLs for direct file access
   * @private
   */
  async _fetchWithRawUrls(path, options) {
    // Complete .claude directory structure based on actual repository
    const knownFiles = [
      // Root configuration
      '.claude/settings.json',
      '.claude/settings.local.json',

      // Core agents
      '.claude/agents/core/agent-orchestrator.md',
      '.claude/agents/core/architect.md',
      '.claude/agents/core/business-analyst.md',
      '.claude/agents/core/deep-researcher.md',
      '.claude/agents/core/designer.md',
      '.claude/agents/core/engineer.md',
      '.claude/agents/core/gatekeeper.md',
      '.claude/agents/core/planner.md',
      '.claude/agents/meta-agent-builder.md',

      // Commands
      '.claude/commands/cook.md',
      '.claude/commands/new-agents.md',

      // Communication hooks
      '.claude/hooks/comms/get_unread_messages.py',
      '.claude/hooks/comms/register_subagent.py',
      '.claude/hooks/comms/send_message.py',
      '.claude/hooks/comms/update_subagent_completion.py',

      // Context hooks
      '.claude/hooks/context/repo_map.py',

      // Observability hooks
      '.claude/hooks/observability/send_event.py',

      // Root CLAUDE.md
      'CLAUDE.md'
    ];

    const files = [];

    for (const filePath of knownFiles) {
      if (filePath.startsWith(path) || (path === '.claude' && filePath.startsWith('.claude')) || (path === 'CLAUDE.md' && filePath === 'CLAUDE.md')) {
        try {
          const content = await this._fetchSingleFileRaw(filePath, options);
          files.push(content);
        } catch (error) {
          // Continue on individual file failures for raw URL strategy
          console.warn(`Failed to fetch ${filePath}: ${error.message}`);
        }
      }
    }

    if (files.length === 0) {
      throw new GitHubAPIError(
        `No files found using raw URL strategy for path: ${path}`,
        { path, strategy: 'raw_urls' }
      );
    }

    return this._buildFileTree(path, files);
  }

  /**
   * Fetch single file content via Contents API
   * @private
   */
  async _fetchSingleFileContent(filePath, options) {
    const { version } = options;
    const url = `${this.config.baseUrl}/repos/${this.repository.owner}/${this.repository.repo}/contents/${filePath}?ref=${version}`;

    const response = await this._makeRequest(url);
    const data = await response.json();

    if (data.type !== 'file') {
      throw new GitHubAPIError(
        `Expected file but got ${data.type}: ${filePath}`,
        { filePath, type: data.type }
      );
    }

    return {
      path: filePath,
      content: data.encoding === 'base64' ?
        Buffer.from(data.content, 'base64').toString('utf-8') :
        data.content,
      encoding: 'utf-8',
      sha: data.sha
    };
  }

  /**
   * Fetch single file via raw URL
   * @private
   */
  async _fetchSingleFileRaw(filePath, options) {
    const { version } = options;
    const url = `${this.config.rawUrl}/${this.repository.owner}/${this.repository.repo}/${version}/${filePath}`;

    const response = await this._makeRequest(url);
    const content = await response.text();

    return {
      path: filePath,
      content: content,
      encoding: 'utf-8',
      sha: null // Not available for raw URLs
    };
  }

  /**
   * Fetch multiple files in parallel batches
   * @private
   */
  async _fetchFilesBatch(fileItems, options, batchSize = 5) {
    const files = [];

    for (let i = 0; i < fileItems.length; i += batchSize) {
      const batch = fileItems.slice(i, i + batchSize);

      const batchPromises = batch.map(async (item) => {
        try {
          return await this._fetchSingleFileContent(item.path, options);
        } catch (error) {
          console.warn(`Failed to fetch ${item.path}: ${error.message}`);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      files.push(...batchResults.filter(Boolean));

      // Update progress
      this.emit('progress', {
        task: 'fetch_directory',
        current: Math.min(100, Math.round((i + batchSize) / fileItems.length * 80)), // 80% for fetching
        message: `Fetched ${Math.min(i + batchSize, fileItems.length)}/${fileItems.length} files`,
        status: 'running'
      });

      // Rate limiting delay between batches
      if (i + batchSize < fileItems.length) {
        await this._rateLimitDelay();
      }
    }

    return files;
  }

  /**
   * Build file tree structure
   * @private
   */
  _buildFileTree(rootPath, files) {
    const tree = {
      path: rootPath,
      type: 'dir',
      children: [],
      files: files
    };

    // Add file tree structure for compatibility
    const filePaths = files.map(f => f.path);
    tree.children = this._buildTreeStructure(filePaths, rootPath);

    return tree;
  }

  /**
   * Build hierarchical tree structure
   * @private
   */
  _buildTreeStructure(filePaths, rootPath) {
    const tree = [];
    const pathMap = new Map();

    filePaths.forEach(filePath => {
      const relativePath = filePath.startsWith(rootPath) ?
        filePath.slice(rootPath.length + 1) : filePath;

      const parts = relativePath.split('/');
      let currentPath = rootPath;

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!pathMap.has(currentPath)) {
          const node = {
            path: currentPath,
            type: index === parts.length - 1 ? 'file' : 'dir',
            sha: null
          };

          pathMap.set(currentPath, node);

          if (index === 0) {
            tree.push(node);
          }
        }
      });
    });

    return tree;
  }

  /**
   * Flatten file tree to file list
   * @private
   */
  _flattenFileTree(tree) {
    if (tree.files) {
      return tree.files;
    }

    const files = [];
    if (tree.children) {
      tree.children.forEach(child => {
        if (child.type === 'file') {
          files.push(child);
        } else {
          files.push(...this._flattenFileTree(child));
        }
      });
    }

    return files;
  }

  /**
   * Make HTTP request with retry logic and rate limiting
   * @private
   */
  async _makeRequest(url, options = {}) {
    const requestOptions = {
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'application/vnd.github.v3+json',
        ...options.headers
      },
      ...options
    };

    if (this.config.token) {
      requestOptions.headers['Authorization'] = `token ${this.config.token}`;
    }

    return await this._executeWithRetry(async () => {
      // Check rate limit before request
      await this._checkRateLimit();

      this.requestCount++;
      const response = await fetch(url, requestOptions);

      // Handle rate limiting
      if (response.status === 403) {
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        if (rateLimitReset) {
          this.rateLimitReset = parseInt(rateLimitReset) * 1000;
          const error = new GitHubAPIError(
            'GitHub API rate limit exceeded',
            { resetTime: this.rateLimitReset, status: 403, headers: response.headers }
          );
          error.code = 'GITHUB_RATE_LIMIT';
          throw error;
        }
      }

      if (!response.ok) {
        throw new GitHubAPIError(
          `GitHub API request failed: ${response.status} ${response.statusText}`,
          { url, status: response.status, statusText: response.statusText }
        );
      }

      return response;
    });
  }

  /**
   * Execute function with exponential backoff retry
   * @private
   */
  async _executeWithRetry(fn, attempt = 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= this.config.retryCount) {
        throw error;
      }

      if (error.code === 'GITHUB_RATE_LIMIT') {
        // Check if we should fail fast
        this._shouldFailFastOnRateLimit();

        // Calculate smart rate limit delay
        const delay = this._calculateRateLimitDelay();

        if (delay > 0) {
          console.warn(`Rate limit exceeded. Waiting ${Math.round(delay / 1000)}s before retry ${attempt + 1}/${this.config.retryCount}`);

          if (!this.config.token) {
            console.warn('💡 Tip: Set GITHUB_TOKEN environment variable to increase rate limits (5,000/hour vs 60/hour)');
          }

          // Show countdown for longer waits
          if (delay > 5000) {
            await this._waitWithCountdown(delay);
          } else {
            await this._sleep(delay);
          }
        }
      } else {
        // Exponential backoff for other errors
        const delay = this._calculateRetryDelay(attempt);
        console.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.retryCount}): ${error.message}`);
        await this._sleep(delay);
      }

      return this._executeWithRetry(fn, attempt + 1);
    }
  }

  /**
   * Calculate exponential backoff delay
   * @private
   */
  _calculateRetryDelay(attempt) {
    const baseDelay = this.config.retryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
    return Math.min(baseDelay + jitter, this.config.maxRetryDelay);
  }

  /**
   * Calculate smart rate limit delay with reasonable caps
   * @private
   */
  _calculateRateLimitDelay() {
    if (!this.rateLimitReset) {
      return 0;
    }

    const now = Date.now();
    const resetTime = this.rateLimitReset;
    const timeUntilReset = resetTime - now;

    // If reset time is in the past, no delay needed
    if (timeUntilReset <= 0) {
      this.rateLimitReset = null;
      return 0;
    }

    // Cap rate limit delays at 30 seconds maximum
    const cappedDelay = Math.min(timeUntilReset, 30000);

    // If original delay would be over 5 minutes, suggest failing fast
    if (timeUntilReset > 5 * 60 * 1000) {
      throw new GitHubAPIError(
        `Rate limit reset time too far in future (${Math.round(timeUntilReset / 1000)}s). Consider using a GitHub token or try again later.`,
        {
          resetTime: this.rateLimitReset,
          delaySeconds: Math.round(timeUntilReset / 1000),
          suggestion: 'Use GITHUB_TOKEN environment variable to increase rate limits'
        }
      );
    }

    return cappedDelay;
  }

  /**
   * Check if we should fail fast on rate limit
   * @private
   */
  _shouldFailFastOnRateLimit() {
    if (!this.rateLimitReset) {
      return false;
    }

    const timeUntilReset = this.rateLimitReset - Date.now();

    // Fail fast if rate limit won't reset for more than 5 minutes
    if (timeUntilReset > 5 * 60 * 1000) {
      throw new GitHubAPIError(
        `Rate limit reset time too far in future (${Math.round(timeUntilReset / 1000)}s). Installation cancelled.`,
        {
          resetTime: this.rateLimitReset,
          delaySeconds: Math.round(timeUntilReset / 1000),
          suggestion: 'Use GITHUB_TOKEN environment variable or try again later'
        }
      );
    }

    return false;
  }

  /**
   * Check and wait for rate limit if necessary
   * @private
   */
  async _checkRateLimit() {
    if (this.rateLimitReset && Date.now() < this.rateLimitReset) {
      // Use smart rate limit delay calculation
      const delay = this._calculateRateLimitDelay();

      if (delay > 0) {
        console.warn(`Rate limit active, waiting ${Math.round(delay / 1000)}s`);

        if (delay > 5000) {
          await this._waitWithCountdown(delay);
        } else {
          await this._sleep(delay);
        }
      }

      this.rateLimitReset = null;
    }
  }

  /**
   * Rate limiting delay between requests
   * @private
   */
  async _rateLimitDelay() {
    // GitHub allows 5000 requests/hour for authenticated users
    // Be conservative with 1 request per 100ms
    await this._sleep(100);
  }

  /**
   * Sleep utility
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait with countdown display for better user experience
   * @private
   */
  async _waitWithCountdown(totalMs) {
    const intervalMs = 1000; // Update every second
    let remainingMs = totalMs;

    while (remainingMs > 0) {
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      process.stdout.write(`\r⏳ Rate limit wait: ${remainingSeconds}s remaining...`);

      const sleepTime = Math.min(intervalMs, remainingMs);
      await this._sleep(sleepTime);
      remainingMs -= sleepTime;
    }

    process.stdout.write('\r✅ Rate limit wait complete.\n');
  }

  /**
   * Wait for rate limit with user feedback
   * @private
   */
  async _waitForRateLimit() {
    const delay = this._calculateRateLimitDelay();

    if (delay > 0) {
      console.warn(`Rate limit active, waiting ${Math.round(delay / 1000)}s`);

      if (delay > 5000) {
        await this._waitWithCountdown(delay);
      } else {
        await this._sleep(delay);
      }
    }
  }

  /**
   * Prepare fetch options with defaults
   * @private
   */
  _prepareFetchOptions(options) {
    return {
      version: options.version || this.repository.branch,
      useCache: options.useCache || false,
      retryCount: options.retryCount || this.config.retryCount,
      timeout: options.timeout || this.config.timeout
    };
  }

  /**
   * Check if file should be skipped during fetch
   * @private
   */
  _shouldSkipFile(filename) {
    const skipPatterns = [
      /\.pyc$/,           // Python bytecode
      /\.pyo$/,           // Python optimized bytecode
      /\.pyd$/,           // Python extension modules
      /\.DS_Store$/,      // macOS metadata
      /Thumbs\.db$/,      // Windows thumbnails
      /\.git/,            // Git files
      /\.svn/,            // SVN files
      /~$/,               // Backup files
      /\.tmp$/,           // Temporary files
      /\.temp$/           // Temporary files
    ];

    return skipPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Check if directory should be skipped during fetch
   * @private
   */
  _shouldSkipDirectory(dirname) {
    const skipDirs = [
      '__pycache__',      // Python cache
      '.git',             // Git directory
      '.svn',             // SVN directory
      'node_modules',     // Node.js modules
      '.vscode',          // VS Code settings
      '.idea',            // IntelliJ settings
      '.DS_Store',        // macOS metadata
      'Thumbs.db'         // Windows thumbnails
    ];

    return skipDirs.includes(dirname);
  }

  /**
   * Download repository tarball from GitHub
   * @private
   */
  async _downloadTarball(options) {
    const { version } = options;
    const url = `${this.config.baseUrl}/repos/${this.repository.owner}/${this.repository.repo}/tarball/${version}`;

    const response = await this._makeRequest(url);

    if (!response.ok) {
      throw new GitHubAPIError(
        `Failed to download tarball: ${response.status} ${response.statusText}`,
        { url, status: response.status }
      );
    }

    // Download tarball as buffer
    const buffer = await response.buffer();

    if (buffer.length === 0) {
      throw new GitHubAPIError(
        'Downloaded tarball is empty',
        { url, size: buffer.length }
      );
    }

    return buffer;
  }

  /**
   * Extract relevant files from tarball buffer
   * @private
   */
  async _extractTarballFiles(tarballBuffer, _options) {
    return new Promise((resolve, reject) => {
      const extractedFiles = {
        '.claude': {
          path: '.claude',
          type: 'dir',
          children: [],
          files: []
        }
      };

      // Create temporary directory for extraction
      const tempDir = path.join(os.tmpdir(), `claude-extract-${Date.now()}-${Math.random().toString(36).slice(2)}`);

      // Track files we want to keep
      const wantedFiles = new Map();
      let rootDirName = null;

      const extractStream = tar.extract({
        cwd: tempDir,
        filter: (filePath, entry) => {
          // Debug logging
          console.log(`DEBUG: Processing ${filePath} (type: ${entry.type})`);

          // Auto-detect root directory from first file/directory path
          if (!rootDirName) {
            // GitHub tarballs typically have format: "owner-repo-hash/path/to/file"
            const pathParts = filePath.split('/');
            if (pathParts.length > 1) {
              rootDirName = pathParts[0];
              console.log(`DEBUG: Auto-detected root directory: ${rootDirName}`);
            }
          }

          // Remove root directory prefix to get actual file path
          const actualPath = rootDirName && filePath.startsWith(rootDirName + '/') ?
            filePath.slice(rootDirName.length + 1) : filePath;

          // Only extract files we care about
          const isClaudeFile = actualPath.startsWith('.claude/') || actualPath === '.claude';
          const isClaudeMd = actualPath === 'CLAUDE.md';

          console.log(`DEBUG: ${actualPath} -> claude: ${isClaudeFile}, md: ${isClaudeMd}, type: ${entry.type}`);

          if ((isClaudeFile || isClaudeMd) && entry.type === 'File') {
            wantedFiles.set(filePath, actualPath);
            console.log(`DEBUG: Will extract: ${filePath} -> ${actualPath}`);
            return true;
          }

          // Also allow .claude directories to be processed for their children
          if (isClaudeFile && entry.type === 'Directory') {
            return true;
          }

          return false;
        }
      });

      extractStream.on('error', (error) => {
        reject(new GitHubAPIError(
          `Tarball extraction failed: ${error.message}`,
          { error: error.message }
        ));
      });

      extractStream.on('finish', async () => {
        try {
          console.log(`DEBUG: Processing ${wantedFiles.size} extracted files`);

          // Process extracted files
          for (const [extractedPath, actualPath] of wantedFiles) {
            const fullPath = path.join(tempDir, extractedPath);

            try {
              const stats = await fs.promises.stat(fullPath);

              if (stats.isFile()) {
                const content = await fs.promises.readFile(fullPath, 'utf-8');
                console.log(`DEBUG: Read ${actualPath} (${content.length} bytes)`);

                if (actualPath === 'CLAUDE.md') {
                  const claudeMdFileObj = {
                    path: 'CLAUDE.md',
                    content: content,
                    encoding: 'utf-8',
                    type: 'file'
                  };
                  extractedFiles['CLAUDE.md'] = claudeMdFileObj;
                  console.log('DEBUG: Added CLAUDE.md to result');
                } else if (actualPath.startsWith('.claude/')) {
                  // Add to .claude files
                  const fileObj = {
                    path: actualPath,
                    content: content,
                    encoding: 'utf-8',
                    type: 'file'
                  };

                  extractedFiles['.claude'].files.push(fileObj);
                  console.log(`DEBUG: Added ${actualPath} to .claude files (${extractedFiles['.claude'].files.length} total)`);

                  // Build directory structure for compatibility
                  const relativePath = actualPath.slice('.claude/'.length);
                  this._addToDirectoryStructure(extractedFiles['.claude'], relativePath, fileObj);
                }
              }
            } catch (fileError) {
              // Skip files that can't be read
              console.warn(`Warning: Could not read extracted file ${fullPath}: ${fileError.message}`);
            }
          }

          console.log(`DEBUG: Final result - .claude has ${extractedFiles['.claude'].files.length} files, CLAUDE.md: ${extractedFiles['CLAUDE.md'] ? 'present' : 'missing'}`);

          // Clean up temp directory
          try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
            // Log but don't fail
            console.warn(`Warning: Could not clean up temp directory ${tempDir}: ${cleanupError.message}`);
          }

          resolve(extractedFiles);

        } catch (processingError) {
          reject(new GitHubAPIError(
            `File processing failed: ${processingError.message}`,
            { error: processingError.message }
          ));
        }
      });

      // Create temp directory and start extraction
      fs.promises.mkdir(tempDir, { recursive: true })
        .then(() => {
          // Pipe tarball buffer to extraction stream
          const { Readable } = require('stream');
          const readable = new Readable();
          readable.push(tarballBuffer);
          readable.push(null);
          readable.pipe(extractStream);
        })
        .catch(reject);
    });
  }

  /**
   * Add file to directory structure for compatibility with existing code
   * @private
   */
  _addToDirectoryStructure(claudeDir, relativePath, _fileObj) {
    const parts = relativePath.split('/');
    let currentLevel = claudeDir.children;
    let currentPath = '.claude';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = `${currentPath}/${part}`;

      if (i === parts.length - 1) {
        // This is the file
        currentLevel.push({
          path: currentPath,
          type: 'file',
          sha: null
        });
      } else {
        // This is a directory
        let dirEntry = currentLevel.find(item => item.path === currentPath && item.type === 'dir');
        if (!dirEntry) {
          dirEntry = {
            path: currentPath,
            type: 'dir',
            children: []
          };
          currentLevel.push(dirEntry);
        }
        currentLevel = dirEntry.children;
      }
    }
  }
}

/**
 * Main function for backwards compatibility
 * @param {string} gitRef - Git reference (branch/tag/commit)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Repository files
 */
async function fetchRepository(gitRef = 'main', options = {}) {
  const fetcher = new GitHubFetcher(options);

  try {
    // Strategy 1: Tarball approach (fastest, single request)
    console.log('Attempting tarball fetch strategy...');
    const tarballFiles = await fetcher.fetchAsTarball({ version: gitRef });

    return {
      claudeDirectory: tarballFiles['.claude'],
      claudeFile: tarballFiles['CLAUDE.md'],
      files: [...(tarballFiles['.claude'].files || []), tarballFiles['CLAUDE.md']]
    };

  } catch (tarballError) {
    console.warn(`Tarball fetch failed: ${tarballError.message}`);
    console.log('Falling back to individual file fetch strategy...');

    try {
      // Strategy 2: Individual file fetch (fallback)
      const [claudeDir, claudeMd] = await Promise.all([
        fetcher.fetchDirectory('.claude', { version: gitRef }),
        fetcher.fetchFile('CLAUDE.md', { version: gitRef })
      ]);

      return {
        claudeDirectory: claudeDir,
        claudeFile: claudeMd,
        files: [...(claudeDir.files || []), claudeMd]
      };

    } catch (fallbackError) {
      console.error('Both tarball and individual fetch strategies failed');
      throw new Error(
        `All fetch strategies failed. Tarball: ${tarballError.message}. Individual: ${fallbackError.message}`
      );
    }
  }
}

module.exports = {
  GitHubFetcher,
  fetchRepository,
  // Backwards compatibility
  fetchClaudeSetup: fetchRepository
};
