/**
 * Installation Orchestrator - WP06
 *
 * Core orchestrator class that coordinates the complete installation flow:
 * - Pre-flight validation and checks
 * - GitHub fetching via injected FetcherAPI
 * - File writing via injected WriterAPI
 * - Progress aggregation and state management
 * - Transaction-like behavior with rollback support
 * - Error handling and recovery
 *
 * Uses dependency injection for testing and modularity.
 */

const EventEmitter = require('events');
const path = require('path');
const { InstallerError } = require('../utils/errors');

// Error codes enum - matches interface contracts
const ErrorCode = {
  // Network errors (E1xx)
  NETWORK_ERROR: 'E101',
  GITHUB_RATE_LIMIT: 'E102',
  GITHUB_API_ERROR: 'E103',

  // File system errors (E2xx)
  FILE_WRITE_ERROR: 'E201',
  FILE_READ_ERROR: 'E202',
  PERMISSION_DENIED: 'E203',
  DISK_FULL: 'E204',

  // Validation errors (E3xx)
  INVALID_TARGET_DIR: 'E301',
  DEPENDENCY_MISSING: 'E302',
  INVALID_VERSION: 'E303',

  // User errors (E4xx)
  USER_CANCELLED: 'E401',
  INVALID_INPUT: 'E402',

  // Installation errors (E5xx)
  VALIDATION_ERROR: 'E501',
  CONFIGURATION_FAILED: 'E502',
  VERIFICATION_FAILED: 'E503'
};

/**
 * Installation state constants
 */
const InstallationState = {
  IDLE: 'idle',
  VALIDATING: 'validating',
  FETCHING: 'fetching',
  WRITING: 'writing',
  CONFIGURING: 'configuring',
  VERIFYING: 'verifying',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ROLLING_BACK: 'rolling_back'
};

/**
 * Main Installation Orchestrator
 *
 * Coordinates the complete installation flow with dependency injection
 * for fetcher, writer, and logger modules.
 */
class Installer extends EventEmitter {
  constructor(dependencies = {}) {
    super();

    // Injected dependencies (replaced with real implementations by WP03/04)
    this.fetcher = dependencies.fetcher || this._createMockFetcher();
    this.writer = dependencies.writer || this._createMockWriter();
    this.logger = dependencies.logger || this._createMockLogger();
    this.validator = dependencies.validator || this._createMockValidator();

    // Installation state
    this.state = InstallationState.IDLE;
    this.options = null;
    this.backups = new Map(); // path -> backup info
    this.installedFiles = [];
    this.errors = [];

    // Progress tracking
    this.progress = {
      current: 0,
      total: 0,
      stage: '',
      message: ''
    };
  }

  /**
   * Main installation entry point
   * @param {InstallOptions} options - Installation configuration
   * @returns {Promise<InstallResult>}
   */
  async install(options) {
    this.options = this._validateOptions(options);
    this.state = InstallationState.VALIDATING;

    try {
      this.logger.info('Starting Claude Code installation...');
      this._emitProgress('Starting installation...', 0);

      // Phase 1: Pre-flight validation
      await this._runPreFlightChecks();

      // Phase 2: Fetch files from GitHub
      const fetchedFiles = await this._fetchInstallationFiles();

      // Phase 3: Install files with transaction support
      await this._installFilesWithTransaction(fetchedFiles);

      // Phase 4: Post-installation configuration
      await this._runPostInstallationTasks();

      // Phase 5: Final verification
      await this._verifyInstallation();

      this.state = InstallationState.COMPLETED;
      this._emitProgress('Installation completed successfully', 100);

      return this._buildInstallResult(true);

    } catch (error) {
      this.state = InstallationState.FAILED;
      this.errors.push(error);

      this.logger.error('Installation failed:', error.message);

      // Attempt rollback if we wrote any files
      if (this.installedFiles.length > 0 || this.backups.size > 0) {
        await this._rollbackChanges();
      }

      return this._buildInstallResult(false);
    }
  }

  /**
   * Validate installation environment without making changes
   * @param {InstallOptions} options - Installation configuration
   * @returns {Promise<ValidationResult>}
   */
  async validateEnvironment(options) {
    this.options = this._validateOptions(options);

    try {
      this.logger.info('Validating environment...');

      const issues = [];

      // Check target directory
      const targetDirIssue = await this.validator.validateTargetDirectory(this.options.targetDir);
      if (targetDirIssue) issues.push(targetDirIssue);

      // Check dependencies if requested
      if (!this.options.skipPythonCheck) {
        const pythonIssue = await this.validator.validatePythonEnvironment();
        if (pythonIssue) issues.push(pythonIssue);
      }

      // Check for existing files
      const existingIssue = await this.validator.checkExistingFiles(this.options.targetDir);
      if (existingIssue) issues.push(existingIssue);

      // Check network connectivity
      const networkIssue = await this.validator.validateNetworkAccess();
      if (networkIssue) issues.push(networkIssue);

      return {
        valid: issues.length === 0,
        issues
      };

    } catch (error) {
      return {
        valid: false,
        issues: [{
          code: ErrorCode.VALIDATION_ERROR,
          message: `Validation failed: ${error.message}`,
          severity: 'error'
        }]
      };
    }
  }

  /**
   * Get current installation progress
   * @returns {ProgressEvent}
   */
  getProgress() {
    return {
      ...this.progress,
      state: this.state,
      hasErrors: this.errors.length > 0
    };
  }

  // ============================================================================
  // PRIVATE METHODS - Installation Flow
  // ============================================================================

  /**
   * Run pre-flight validation checks
   */
  async _runPreFlightChecks() {
    this.state = InstallationState.VALIDATING;
    this._emitProgress('Running pre-flight checks...', 10);

    this.logger.info('Running pre-flight validation...');

    const validation = await this.validateEnvironment(this.options);
    if (!validation.valid) {
      const errorIssues = validation.issues.filter(issue => issue.severity === 'error');
      if (errorIssues.length > 0) {
        const errorMessage = errorIssues.map(issue => issue.message).join('; ');
        throw new InstallerError(
          `Pre-flight validation failed: ${errorMessage}`,
          ErrorCode.VALIDATION_ERROR
        );
      }
    }

    // Log warnings but continue
    const warnings = validation.issues.filter(issue => issue.severity === 'warning');
    warnings.forEach(warning => this.logger.warn(warning.message));

    this.logger.info('Pre-flight checks completed');
  }

  /**
   * Fetch installation files from GitHub
   */
  async _fetchInstallationFiles() {
    this.state = InstallationState.FETCHING;
    this._emitProgress('Fetching files from GitHub...', 30);

    this.logger.info(`Fetching files from version: ${this.options.version}`);

    try {
      // Try tarball approach first if fetcher supports it
      if (this.fetcher.fetchAsTarball) {
        this.logger.info('Using optimized tarball fetch strategy');

        try {
          const fetchedFiles = await this.fetcher.fetchAsTarball({
            version: this.options.version,
            useCache: this.options.cache,
            retryCount: 3
          });

          // Calculate total files for progress tracking
          this.progress.total = this._countFiles(fetchedFiles);

          this.logger.info(`Fetched ${this.progress.total} files successfully via tarball`);
          return fetchedFiles;

        } catch (tarballError) {
          this.logger.warn(`Tarball fetch failed: ${tarballError.message}`);
          this.logger.info('Falling back to individual file fetch strategy');
        }
      }

      // Fallback to individual file fetching
      this.logger.info('Using individual file fetch strategy');

      // Fetch .claude directory structure
      const claudeFiles = await this.fetcher.fetchDirectory('.claude', {
        version: this.options.version,
        useCache: this.options.cache,
        retryCount: 3
      });

      // Fetch .agents directory structure
      const agentsFiles = await this.fetcher.fetchDirectory('.agents', {
        version: this.options.version,
        useCache: this.options.cache,
        retryCount: 3
      });

      // Fetch CLAUDE.md file
      const claudeMd = await this.fetcher.fetchFile('CLAUDE.md', {
        version: this.options.version,
        useCache: this.options.cache
      });

      const fetchedFiles = {
        '.claude': claudeFiles,
        '.agents': agentsFiles,
        'CLAUDE.md': claudeMd
      };

      // Calculate total files for progress tracking
      this.progress.total = this._countFiles(fetchedFiles);

      this.logger.info(`Fetched ${this.progress.total} files successfully via individual fetch`);
      return fetchedFiles;

    } catch (error) {
      throw new InstallerError(
        `Failed to fetch files from GitHub: ${error.message}`,
        ErrorCode.GITHUB_API_ERROR,
        { version: this.options.version }
      );
    }
  }

  /**
   * Install files with transaction-like behavior
   */
  async _installFilesWithTransaction(fetchedFiles) {
    this.state = InstallationState.WRITING;
    this._emitProgress('Installing files...', 50);

    if (this.options.dryRun) {
      this.logger.info('DRY RUN: Would install files to:', this.options.targetDir);
      this._simulateInstallation(fetchedFiles);
      return;
    }

    try {
      // Validate fetched files structure
      const validationResult = this._validateFetchedFiles(fetchedFiles);
      if (!validationResult.complete) {
        this.logger.warn('Incomplete file structure detected:');
        validationResult.issues.forEach(issue => {
          this.logger.warn(`  - ${issue.message}`);
        });
      }

      // Create backups if files exist
      await this._createBackupsIfNeeded(fetchedFiles);

      // Flatten files and filter out user-customizable files if they already exist
      let filesToWrite = this._flattenFiles(fetchedFiles);

      // Files that should not be overwritten if they exist (user customizations)
      const preserveIfExists = [
        { path: '.claude/settings.local.json', fullPath: path.join(this.options.targetDir, '.claude', 'settings.local.json') },
        { path: '.agents/repo.md', fullPath: path.join(this.options.targetDir, '.agents', 'repo.md') },
        { path: '.agents/tools/chrome-devtools/config.json', fullPath: path.join(this.options.targetDir, '.agents', 'tools', 'chrome-devtools', 'config.json') }
      ];

      for (const file of preserveIfExists) {
        const exists = await this.validator.pathExists(file.fullPath);
        if (exists) {
          this.logger.info(`${file.path} already exists, skipping (preserving user customizations)`);
          filesToWrite = filesToWrite.filter(f => f.path !== file.path);
        }
      }

      // Write files using injected writer (overwrite existing, no backups)
      const writeResult = await this.writer.writeDirectory(
        filesToWrite,
        {
          targetDir: this.options.targetDir,
          overwrite: true,
          backup: false,
          preservePermissions: true,
          dryRun: this.options.dryRun
        }
      );

      // Track installed files for potential rollback
      this.installedFiles = writeResult.written;

      // Store backup information
      writeResult.backed_up.forEach((backupPath, originalPath) => {
        this.backups.set(originalPath, { backupPath, timestamp: Date.now() });
      });

      this.logger.info(`Installed ${writeResult.written.length} files`);
      this.logger.info(`Created ${writeResult.directoriesCreated?.length || 0} directories`);

      if (writeResult.errors.length > 0) {
        const errorSummary = writeResult.errors.map(err => `${err.path}: ${err.error.message}`).join('; ');
        throw new InstallerError(
          `Some files failed to install: ${errorSummary}`,
          ErrorCode.FILE_WRITE_ERROR
        );
      }

    } catch (error) {
      throw new InstallerError(
        `File installation failed: ${error.message}`,
        ErrorCode.FILE_WRITE_ERROR
      );
    }
  }

  /**
   * Run post-installation configuration tasks
   */
  async _runPostInstallationTasks() {
    this.state = InstallationState.CONFIGURING;
    this._emitProgress('Configuring installation...', 80);

    // settings.local.json is user-owned and never generated or overwritten.
    // All needed files come from the GitHub fetch in Phase 2.
    this.logger.info('Post-installation configuration completed');
  }

  /**
   * Verify installation was successful
   */
  async _verifyInstallation() {
    this.state = InstallationState.VERIFYING;
    this._emitProgress('Verifying installation...', 90);

    if (this.options.dryRun) {
      this.logger.info('DRY RUN: Would verify installation');
      return;
    }

    const requiredPaths = [
      path.join(this.options.targetDir, '.claude'),
      path.join(this.options.targetDir, '.agents'),
      path.join(this.options.targetDir, 'CLAUDE.md')
    ];

    const missingPaths = [];
    for (const requiredPath of requiredPaths) {
      const exists = await this.validator.pathExists(requiredPath);
      if (!exists) {
        missingPaths.push(requiredPath);
      }
    }

    // Use the file writer's validation method for completeness check
    if (this.writer.validateInstallationCompleteness) {
      const completenessResult = await this.writer.validateInstallationCompleteness(
        this.options.targetDir,
        ['CLAUDE.md']
      );

      if (!completenessResult.complete) {
        this.logger.warn('Installation completeness issues detected:');
        completenessResult.issues.forEach(issue => {
          this.logger.warn(`  - ${issue.message}`);
        });
      }
    }

    if (missingPaths.length > 0) {
      throw new InstallerError(
        `Installation verification failed: missing ${missingPaths.join(', ')}`,
        ErrorCode.VERIFICATION_FAILED
      );
    }

    this.logger.info('Installation verification completed');
  }

  /**
   * Rollback changes if installation fails
   */
  async _rollbackChanges() {
    this.state = InstallationState.ROLLING_BACK;
    this.logger.warn('Rolling back installation changes...');

    try {
      // Remove newly installed files
      for (const filePath of this.installedFiles) {
        try {
          await this.writer.removeFile(filePath);
        } catch (error) {
          this.logger.warn(`Failed to remove file during rollback: ${filePath}`);
        }
      }

      // Restore backed up files
      for (const [originalPath, backupInfo] of this.backups) {
        try {
          await this.writer.rollback(backupInfo.backupPath, originalPath);
        } catch (error) {
          this.logger.warn(`Failed to restore backup during rollback: ${originalPath}`);
        }
      }

      this.logger.info('Rollback completed');

    } catch (error) {
      this.logger.error('Rollback failed:', error.message);
    }
  }

  // ============================================================================
  // PRIVATE METHODS - Utilities
  // ============================================================================

  /**
   * Validate and normalize installation options
   */
  _validateOptions(options) {
    if (!options || typeof options !== 'object') {
      throw new InstallerError('Invalid options provided', ErrorCode.INVALID_INPUT);
    }

    return {
      targetDir: path.resolve(options.targetDir || process.cwd()),
      version: options.version || 'main',
      force: Boolean(options.force),
      skipPythonCheck: Boolean(options.skipPythonCheck),
      verbose: Boolean(options.verbose),
      cache: Boolean(options.cache),
      dryRun: Boolean(options.dryRun)
    };
  }

  /**
   * Emit progress update event
   */
  _emitProgress(message, current) {
    this.progress = {
      ...this.progress,
      current,
      message,
      stage: this.state
    };

    this.emit('progress', {
      task: 'installation',
      current,
      total: 100,
      percentage: current,
      message,
      status: this.state === InstallationState.FAILED ? 'failed' : 'running'
    });
  }

  /**
   * Build final installation result
   */
  _buildInstallResult(success) {
    return {
      success,
      filesInstalled: this.installedFiles,
      warnings: [], // TODO: Collect warnings during installation
      errors: this.errors,
      backups: Array.from(this.backups.entries()).map(([path, info]) => ({
        originalPath: path,
        backupPath: info.backupPath,
        timestamp: info.timestamp
      }))
    };
  }

  /**
   * Count total number of files in fetch result
   */
  _countFiles(fetchedFiles) {
    let count = 0;

    function countRecursive(item) {
      if (item.type === 'file') {
        count++;
      } else if (item.children) {
        item.children.forEach(countRecursive);
      }
    }

    Object.values(fetchedFiles).forEach(item => {
      if (typeof item === 'object' && item.type) {
        countRecursive(item);
      } else {
        count++; // Single file
      }
    });

    return count;
  }

  /**
   * Flatten file tree structure for writer
   */
  _flattenFiles(fetchedFiles) {
    const flattened = [];

    function flattenRecursive(item, basePath = '') {
      if (item.type === 'file') {
        // Construct proper path: if basePath exists and item.path doesn't already include it
        let filePath;
        if (basePath && !item.path.startsWith(basePath)) {
          filePath = path.join(basePath, item.path);
        } else {
          filePath = item.path;
        }

        flattened.push({
          path: filePath,
          content: item.content,
          encoding: item.encoding || 'utf-8',
          permissions: item.permissions
        });
      } else if (item.type === 'dir' && item.children) {
        // For directory recursion, construct the new basePath from current basePath and item's path
        const newBasePath = basePath && !item.path.startsWith(basePath) ?
          path.join(basePath, item.path) : item.path;

        item.children.forEach(child => {
          flattenRecursive(child, newBasePath);
        });
      }
    }

    Object.entries(fetchedFiles).forEach(([rootPath, item]) => {
      if (typeof item === 'object' && item.type) {
        // CRITICAL FIX: Handle .files array from tarball extraction FIRST
        if (item.type === 'dir' && item.files) {
          console.log(`DEBUG: Processing ${item.files.length} files from ${rootPath}.files array`);
          item.files.forEach(file => {
            flattened.push({
              path: file.path,
              content: file.content,
              encoding: file.encoding || 'utf-8',
              permissions: file.permissions
            });
          });
        } else if (item.type === 'dir' && item.children) {
          // For directory trees like .claude, start recursion with the rootPath as basePath
          item.children.forEach(child => {
            flattenRecursive(child, rootPath);
          });
        } else if (item.type === 'file') {
          // Single file - use item.path directly if it's already properly prefixed, otherwise use rootPath
          const filePath = item.path.startsWith(rootPath) ? item.path : rootPath;
          flattened.push({
            path: filePath,
            content: item.content,
            encoding: item.encoding || 'utf-8',
            permissions: item.permissions
          });
        }
      } else if (typeof item === 'object' && item.content) {
        // Single file like CLAUDE.md - use rootPath as the target path
        flattened.push({
          path: rootPath,
          content: item.content,
          encoding: item.encoding || 'utf-8'
        });
      } else if (typeof item === 'string') {
        // Direct content string
        flattened.push({
          path: rootPath,
          content: item,
          encoding: 'utf-8'
        });
      }
    });

    return flattened;
  }

  /**
   * Simulate installation for dry-run mode
   */
  _simulateInstallation(fetchedFiles) {
    this.logger.info('DRY RUN: Files that would be installed:');

    const flattened = this._flattenFiles(fetchedFiles);
    flattened.forEach(file => {
      const targetPath = path.join(this.options.targetDir, file.path);
      this.logger.info(`  • ${targetPath}`);
    });

    this.logger.info(`DRY RUN: Would install ${flattened.length} files`);
  }

  /**
   * Log info about existing files that will be overwritten
   */
  async _createBackupsIfNeeded(_fetchedFiles) {
    // Check for existing directories and files that will be overwritten
    const claudeDir = path.join(this.options.targetDir, '.claude');
    const agentsDir = path.join(this.options.targetDir, '.agents');
    const claudeMd = path.join(this.options.targetDir, 'CLAUDE.md');

    const existingPaths = [];
    if (await this.validator.pathExists(claudeDir)) {
      existingPaths.push('.claude/');
    }
    if (await this.validator.pathExists(agentsDir)) {
      existingPaths.push('.agents/');
    }
    if (await this.validator.pathExists(claudeMd)) {
      existingPaths.push('CLAUDE.md');
    }

    if (existingPaths.length > 0) {
      this.logger.info(`Existing files will be overwritten: ${existingPaths.join(', ')}`);
    }
  }

  /**
   * Validate fetched files structure for completeness
   */
  _validateFetchedFiles(fetchedFiles) {
    const issues = [];

    // Check for essential components
    if (!fetchedFiles['.claude']) {
      issues.push({
        type: 'missing_component',
        component: '.claude',
        message: 'Missing .claude directory structure'
      });
    }

    if (!fetchedFiles['.agents']) {
      issues.push({
        type: 'missing_component',
        component: '.agents',
        message: 'Missing .agents directory structure'
      });
    }

    if (!fetchedFiles['CLAUDE.md']) {
      issues.push({
        type: 'missing_component',
        component: 'CLAUDE.md',
        message: 'Missing CLAUDE.md file'
      });
    }

    // Check .claude structure if present
    if (fetchedFiles['.claude'] && fetchedFiles['.claude'].children) {
      const claudeChildren = fetchedFiles['.claude'].children;
      const expectedDirs = ['hooks', 'agents', 'commands'];

      for (const expectedDir of expectedDirs) {
        const hasDir = claudeChildren.some(child =>
          child.path === expectedDir && child.type === 'dir'
        );
        if (!hasDir) {
          issues.push({
            type: 'missing_directory',
            directory: expectedDir,
            message: `Missing ${expectedDir} directory in .claude structure`
          });
        }
      }
    }

    return {
      complete: issues.length === 0,
      issues
    };
  }

  // ============================================================================
  // MOCK IMPLEMENTATIONS - To be replaced by real modules from WP03/04
  // ============================================================================

  _createMockFetcher() {
    return {
      async fetchDirectory(path, _options) {
        return {
          path,
          type: 'dir',
          children: [
            {
              path: 'settings.json',
              type: 'file',
              content: '{"version": "1.0.0"}',
              encoding: 'utf-8'
            }
          ]
        };
      },

      async fetchFile(path, _options) {
        return {
          path,
          content: `# Claude Code Setup\n\nInstalled from ${this.options?.version || 'main'}`,
          encoding: 'utf-8'
        };
      },

      async validateConnection() {
        return true;
      }
    };
  }

  _createMockWriter() {
    return {
      async writeFile(path, content, options = {}) {
        if (options.dryRun) return;
        // Mock implementation - real writer will handle actual file operations
      },

      async writeDirectory(files, options = {}) {
        return {
          written: files.map(f => path.join(options.targetDir || '', f.path)),
          skipped: [],
          backed_up: new Map(),
          errors: [],
          directoriesCreated: files.map(f => path.dirname(path.join(options.targetDir || '', f.path))).filter((v, i, a) => a.indexOf(v) === i)
        };
      },

      async validateInstallationCompleteness(_targetDir, _expectedFiles = []) {
        return {
          complete: true,
          issues: []
        };
      },

      async backup(path) {
        return `${path}.backup-${Date.now()}`;
      },

      async rollback(_backupPath, _originalPath) {
        // Mock implementation
      },

      async removeFile(_path) {
        // Mock implementation
      }
    };
  }

  _createMockLogger() {
    return {
      info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
      debug: (msg, ...args) => console.log(`[DEBUG] ${msg}`, ...args)
    };
  }

  _createMockValidator() {
    return {
      async validateTargetDirectory(_targetDir) {
        // Mock validation - always pass
        return null;
      },

      async validatePythonEnvironment() {
        // Mock validation - always pass
        return null;
      },

      async checkExistingFiles(_targetDir) {
        // Mock validation - no existing files
        return null;
      },

      async validateNetworkAccess() {
        // Mock validation - always pass
        return null;
      },

      async pathExists(_path) {
        // Mock - assume path exists for verification
        return true;
      }
    };
  }
}

module.exports = {
  Installer,
  InstallationState,
  ErrorCode
};
