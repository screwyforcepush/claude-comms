/**
 * Mock Implementations for Team Integration - WP06
 *
 * Provides mock implementations that match the interface contracts
 * for integration with WP03 (GitHub Fetcher) and WP04 (File Writer).
 *
 * These mocks allow the orchestrator to be tested independently
 * while providing clear integration points for the real implementations.
 */

/**
 * Mock Fetcher implementation matching FetcherAPI interface
 * Will be replaced by IsabelMatrix's GitHub fetcher (WP03)
 */
class MockFetcher {
  constructor(options = {}) {
    this.mockData = options.mockData || this._getDefaultMockData();
    this.simulateDelay = options.simulateDelay !== false;
    this.shouldFail = options.shouldFail || false;
  }

  async fetchDirectory(path, _options = {}) {
    if (this.simulateDelay) {
      await this._delay(500);
    }

    if (this.shouldFail) {
      throw new Error(`Mock fetcher: Failed to fetch directory ${path}`);
    }

    return this.mockData.directories[path] || {
      path,
      type: 'dir',
      children: []
    };
  }

  async fetchFile(path, _options = {}) {
    if (this.simulateDelay) {
      await this._delay(200);
    }

    if (this.shouldFail) {
      throw new Error(`Mock fetcher: Failed to fetch file ${path}`);
    }

    return this.mockData.files[path] || {
      path,
      content: `# Mock content for ${path}`,
      encoding: 'utf-8',
      sha: 'mock-sha-' + Date.now()
    };
  }

  async validateConnection() {
    if (this.simulateDelay) {
      await this._delay(100);
    }
    return !this.shouldFail;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _getDefaultMockData() {
    return {
      directories: {
        '.claude': {
          path: '.claude',
          type: 'dir',
          children: [
            {
              path: 'settings.json',
              type: 'file',
              content: JSON.stringify({
                version: '1.0.0',
                observability_server: 'http://localhost:4000',
                hooks_enabled: true
              }, null, 2),
              encoding: 'utf-8'
            },
            {
              path: 'agents',
              type: 'dir',
              children: [
                {
                  path: 'engineer.md',
                  type: 'file',
                  content: '# Engineer Agent\n\nImplementation specialist.',
                  encoding: 'utf-8'
                },
                {
                  path: 'architect.md',
                  type: 'file',
                  content: '# Architect Agent\n\nSystem design specialist.',
                  encoding: 'utf-8'
                }
              ]
            },
            {
              path: 'hooks',
              type: 'dir',
              children: [
                {
                  path: 'comms',
                  type: 'dir',
                  children: [
                    {
                      path: 'send_message.py',
                      type: 'file',
                      content: '#!/usr/bin/env python3\n# Team communication hook\nprint("Send message hook")',
                      encoding: 'utf-8',
                      permissions: 0o755
                    },
                    {
                      path: 'get_unread_messages.py',
                      type: 'file',
                      content: '#!/usr/bin/env python3\n# Message retrieval hook\nprint("Get messages hook")',
                      encoding: 'utf-8',
                      permissions: 0o755
                    }
                  ]
                }
              ]
            }
          ]
        }
      },
      files: {
        'CLAUDE.md': {
          path: 'CLAUDE.md',
          content: '# Claude Code Multi-Agent Setup\n\nThis project is configured for Claude multi-agent orchestration.\n\n## Features\n- Multi-agent team coordination\n- Observability and monitoring\n- Hook-based extensibility\n\n## Getting Started\nReview .claude/settings.local.json for configuration.',
          encoding: 'utf-8',
          sha: 'mock-claude-md-sha'
        }
      }
    };
  }
}

/**
 * Mock Writer implementation matching WriterAPI interface
 * Will be replaced by JackTensor's file writer (WP04)
 */
class MockWriter {
  constructor(options = {}) {
    this.simulateDelay = options.simulateDelay !== false;
    this.shouldFail = options.shouldFail || false;
    this.dryRun = options.dryRun || false;
    this.writtenFiles = new Set();
    this.backups = new Map();
  }

  async writeFile(filePath, content, options = {}) {
    if (this.simulateDelay) {
      await this._delay(100);
    }

    if (this.shouldFail) {
      throw new Error(`Mock writer: Failed to write file ${filePath}`);
    }

    if (options.dryRun || this.dryRun) {
      console.log(`[DRY RUN] Would write file: ${filePath}`);
      return;
    }

    this.writtenFiles.add(filePath);
    console.log(`[MOCK] Wrote file: ${filePath} (${content.length} bytes)`);
  }

  async writeDirectory(files, options = {}) {
    if (this.simulateDelay) {
      await this._delay(300);
    }

    if (this.shouldFail) {
      throw new Error('Mock writer: Failed to write directory');
    }

    const result = {
      written: [],
      skipped: [],
      backed_up: new Map(),
      errors: []
    };

    for (const file of files) {
      const targetPath = options.targetDir
        ? require('path').join(options.targetDir, file.path)
        : file.path;

      if (options.dryRun || this.dryRun) {
        console.log(`[DRY RUN] Would write: ${targetPath}`);
        continue;
      }

      // Simulate backup if file exists and backup is enabled
      if (options.backup && this.writtenFiles.has(targetPath)) {
        const backupPath = `${targetPath}.backup-${Date.now()}`;
        result.backed_up.set(targetPath, backupPath);
        this.backups.set(targetPath, backupPath);
      }

      this.writtenFiles.add(targetPath);
      result.written.push(targetPath);

      console.log(`[MOCK] Wrote: ${targetPath} (${file.content?.length || 0} bytes)`);
    }

    return result;
  }

  async backup(filePath) {
    if (this.simulateDelay) {
      await this._delay(50);
    }

    const backupPath = `${filePath}.backup-${Date.now()}`;
    this.backups.set(filePath, backupPath);

    console.log(`[MOCK] Created backup: ${filePath} -> ${backupPath}`);
    return backupPath;
  }

  async rollback(backupPath, originalPath) {
    if (this.simulateDelay) {
      await this._delay(100);
    }

    console.log(`[MOCK] Rolled back: ${backupPath} -> ${originalPath}`);
    this.writtenFiles.delete(originalPath);
  }

  async removeFile(filePath) {
    if (this.simulateDelay) {
      await this._delay(50);
    }

    console.log(`[MOCK] Removed file: ${filePath}`);
    this.writtenFiles.delete(filePath);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Mock Logger implementation
 */
class MockLogger {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.prefix = options.prefix || '[MOCK]';
  }

  info(message, ...args) {
    console.log(`${this.prefix} [INFO] ${message}`, ...args);
  }

  warn(message, ...args) {
    console.warn(`${this.prefix} [WARN] ${message}`, ...args);
  }

  error(message, ...args) {
    console.error(`${this.prefix} [ERROR] ${message}`, ...args);
  }

  debug(message, ...args) {
    if (this.verbose) {
      console.log(`${this.prefix} [DEBUG] ${message}`, ...args);
    }
  }

  success(message, ...args) {
    console.log(`${this.prefix} [SUCCESS] ${message}`, ...args);
  }
}

/**
 * Mock Validator implementation
 */
class MockValidator {
  constructor(options = {}) {
    this.shouldFail = options.shouldFail || false;
    this.issues = options.issues || [];
  }

  async validateTargetDirectory(_targetDir) {
    if (this.shouldFail) {
      return {
        code: 'E301',
        message: 'Target directory is not writable',
        severity: 'error'
      };
    }
    return null;
  }

  async validatePythonEnvironment() {
    if (this.shouldFail) {
      return {
        code: 'E302',
        message: 'Python or uv not found',
        severity: 'error'
      };
    }
    return null;
  }

  async checkExistingFiles(_targetDir) {
    // Return any pre-configured issues
    return this.issues.find(issue => issue.type === 'existing_files') || null;
  }

  async validateNetworkAccess() {
    if (this.shouldFail) {
      return {
        code: 'E101',
        message: 'Cannot connect to GitHub',
        severity: 'error'
      };
    }
    return null;
  }

  async pathExists(_path) {
    // Mock - assume paths exist unless configured otherwise
    return true;
  }
}

/**
 * Factory function to create a complete set of mock dependencies
 */
function createMockDependencies(options = {}) {
  return {
    fetcher: new MockFetcher(options.fetcher),
    writer: new MockWriter(options.writer),
    logger: new MockLogger(options.logger),
    validator: new MockValidator(options.validator)
  };
}

/**
 * Helper to create mock dependencies that simulate specific scenarios
 */
function createScenarioMocks(scenario) {
  switch (scenario) {
  case 'success':
    return createMockDependencies();

  case 'network_failure':
    return createMockDependencies({
      fetcher: { shouldFail: true },
      validator: { shouldFail: true }
    });

  case 'write_failure':
    return createMockDependencies({
      writer: { shouldFail: true }
    });

  case 'validation_failure':
    return createMockDependencies({
      validator: { shouldFail: true }
    });

  case 'dry_run':
    return createMockDependencies({
      writer: { dryRun: true }
    });

  default:
    return createMockDependencies();
  }
}

module.exports = {
  MockFetcher,
  MockWriter,
  MockLogger,
  MockValidator,
  createMockDependencies,
  createScenarioMocks
};
