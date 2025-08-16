/**
 * Interface Contracts for @claude-code/setup-installer
 *
 * Defines the contracts and interfaces for future integration with:
 * - GitHub API operations (WP03)
 * - File system operations (WP04)
 * - Installation orchestration (WP06)
 *
 * These interfaces serve as the integration points between CLI and core modules.
 */

/**
 * GitHub Fetcher Interface
 * Will be implemented in WP03 - GitHub API Integration
 */
class GitHubFetcherInterface {
  /**
   * Fetch directory structure from GitHub repository
   * @param {Object} options - Fetch options
   * @param {string} options.owner - Repository owner
   * @param {string} options.repo - Repository name
   * @param {string} options.path - Directory path to fetch
   * @param {string} options.ref - Git reference (branch/tag/commit)
   * @returns {Promise<DirectoryStructure>} Directory structure with files
   */
  async fetchDirectory(_options) {
    throw new Error('GitHubFetcher.fetchDirectory not implemented');
  }

  /**
   * Fetch single file content from GitHub
   * @param {Object} options - Fetch options
   * @param {string} options.owner - Repository owner
   * @param {string} options.repo - Repository name
   * @param {string} options.path - File path
   * @param {string} options.ref - Git reference
   * @returns {Promise<FileContent>} File content and metadata
   */
  async fetchFile(_options) {
    throw new Error('GitHubFetcher.fetchFile not implemented');
  }

  /**
   * Validate GitHub API connectivity and rate limits
   * @returns {Promise<APIStatus>} API status and rate limit info
   */
  async validateConnection() {
    throw new Error('GitHubFetcher.validateConnection not implemented');
  }
}

/**
 * File Writer Interface
 * Will be implemented in WP04 - File Writer Module
 */
class FileWriterInterface {
  /**
   * Write files to target directory with conflict resolution
   * @param {Array<FileSpec>} files - Files to write
   * @param {Object} options - Write options
   * @param {string} options.targetDir - Target directory
   * @param {string} options.strategy - Conflict resolution strategy
   * @param {boolean} options.createBackup - Whether to create backups
   * @param {boolean} options.preservePermissions - Preserve file permissions
   * @returns {Promise<WriteResult>} Write operation results
   */
  async writeFiles(_files, _options) {
    throw new Error('FileWriter.writeFiles not implemented');
  }

  /**
   * Check for existing files that would conflict
   * @param {Array<string>} filePaths - File paths to check
   * @param {string} targetDir - Target directory
   * @returns {Promise<ConflictReport>} Conflict detection report
   */
  async checkConflicts(_filePaths, _targetDir) {
    throw new Error('FileWriter.checkConflicts not implemented');
  }

  /**
   * Create backup of existing files
   * @param {Array<string>} filePaths - Files to backup
   * @param {string} targetDir - Target directory
   * @returns {Promise<BackupResult>} Backup operation results
   */
  async createBackups(_filePaths, _targetDir) {
    throw new Error('FileWriter.createBackups not implemented');
  }

  /**
   * Rollback file operations on failure
   * @param {WriteResult} writeResult - Previous write operation result
   * @returns {Promise<void>} Rollback completion
   */
  async rollback(_writeResult) {
    throw new Error('FileWriter.rollback not implemented');
  }
}

/**
 * Dependency Checker Interface
 * Will be implemented in WP04 - File Writer Module
 */
class DependencyCheckerInterface {
  /**
   * Check for Python installation and version
   * @returns {Promise<PythonStatus>} Python installation status
   */
  async checkPython() {
    throw new Error('DependencyChecker.checkPython not implemented');
  }

  /**
   * Check for uv (Python package manager) installation
   * @returns {Promise<UvStatus>} uv installation status
   */
  async checkUv() {
    throw new Error('DependencyChecker.checkUv not implemented');
  }

  /**
   * Check Node.js version compatibility
   * @returns {Promise<NodeStatus>} Node.js status
   */
  async checkNode() {
    throw new Error('DependencyChecker.checkNode not implemented');
  }

  /**
   * Validate all required dependencies
   * @returns {Promise<DependencyReport>} Complete dependency report
   */
  async validateAll() {
    throw new Error('DependencyChecker.validateAll not implemented');
  }
}

/**
 * Installation Orchestrator Interface
 * Will be implemented in WP06 - Installation Orchestrator
 */
class InstallationOrchestratorInterface {
  /**
   * Run complete installation flow
   * @param {InstallationConfig} config - Installation configuration
   * @returns {Promise<InstallationResult>} Installation results
   */
  async install(_config) {
    throw new Error('InstallationOrchestrator.install not implemented');
  }

  /**
   * Validate installation integrity
   * @param {string} targetDir - Installation directory
   * @returns {Promise<ValidationResult>} Validation results
   */
  async validate(_targetDir) {
    throw new Error('InstallationOrchestrator.validate not implemented');
  }

  /**
   * Generate configuration files
   * @param {Object} options - Configuration options
   * @returns {Promise<Array<FileSpec>>} Generated configuration files
   */
  async generateConfigs(_options) {
    throw new Error('InstallationOrchestrator.generateConfigs not implemented');
  }
}

// ============================================================================
// TYPE DEFINITIONS (for documentation and future TypeScript support)
// ============================================================================

/**
 * @typedef {Object} DirectoryStructure
 * @property {Array<FileSpec>} files - Array of files in directory
 * @property {Array<string>} directories - Subdirectories found
 * @property {Object} metadata - Repository metadata
 * @property {string} metadata.sha - Commit SHA
 * @property {string} metadata.url - API URL used
 */

/**
 * @typedef {Object} FileSpec
 * @property {string} path - Relative file path
 * @property {string} content - File content (string or base64)
 * @property {number} mode - File permissions (octal)
 * @property {number} size - File size in bytes
 * @property {string} encoding - Content encoding ('utf-8' or 'base64')
 * @property {string} sha - File SHA hash
 */

/**
 * @typedef {Object} FileContent
 * @property {string} content - File content
 * @property {string} encoding - Content encoding
 * @property {number} size - File size
 * @property {string} sha - File SHA
 * @property {Object} metadata - File metadata
 */

/**
 * @typedef {Object} WriteResult
 * @property {Array<string>} written - Successfully written files
 * @property {Array<string>} skipped - Skipped files
 * @property {Array<string>} backed_up - Files that were backed up
 * @property {Array<Object>} errors - Write errors encountered
 * @property {Array<string>} rollback_info - Information for potential rollback
 */

/**
 * @typedef {Object} ConflictReport
 * @property {boolean} hasConflicts - Whether conflicts were found
 * @property {Array<string>} conflictFiles - Files that would conflict
 * @property {Array<Object>} details - Detailed conflict information
 */

/**
 * @typedef {Object} InstallationConfig
 * @property {string} targetDir - Target installation directory
 * @property {string} repository - GitHub repository
 * @property {string} ref - Git reference (branch/tag/commit)
 * @property {string} strategy - Conflict resolution strategy
 * @property {boolean} pythonCheck - Whether to check Python dependencies
 * @property {boolean} createBackup - Whether to create backups
 * @property {string} configUrl - Observability server URL
 * @property {boolean} dryRun - Whether to run in dry-run mode
 */

/**
 * @typedef {Object} InstallationResult
 * @property {boolean} success - Whether installation succeeded
 * @property {WriteResult} writeResult - File write results
 * @property {Array<string>} configFiles - Generated configuration files
 * @property {DependencyReport} dependencies - Dependency check results
 * @property {string} installationId - Unique installation ID
 * @property {number} duration - Installation duration in ms
 */

/**
 * @typedef {Object} PythonStatus
 * @property {boolean} installed - Whether Python is installed
 * @property {string} version - Python version string
 * @property {string} executable - Path to Python executable
 * @property {boolean} compatible - Whether version is compatible
 */

/**
 * @typedef {Object} DependencyReport
 * @property {PythonStatus} python - Python status
 * @property {Object} uv - uv status
 * @property {Object} node - Node.js status
 * @property {boolean} allSatisfied - Whether all dependencies are satisfied
 * @property {Array<string>} missing - Missing dependencies
 * @property {Array<string>} warnings - Dependency warnings
 */

// ============================================================================
// MOCK IMPLEMENTATIONS (for testing CLI during early development)
// ============================================================================

/**
 * Mock GitHub Fetcher for CLI testing
 */
class MockGitHubFetcher extends GitHubFetcherInterface {
  async fetchDirectory(_options) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      files: [
        {
          path: '.claude/settings.json',
          content: JSON.stringify({ version: '1.0.0' }, null, 2),
          mode: 0o644,
          size: 50,
          encoding: 'utf-8',
          sha: 'mock-sha-1'
        },
        {
          path: 'CLAUDE.md',
          content: '# Claude Setup\n\nProject configured for Claude.',
          mode: 0o644,
          size: 45,
          encoding: 'utf-8',
          sha: 'mock-sha-2'
        }
      ],
      directories: ['.claude', '.claude/hooks', '.claude/agents'],
      metadata: {
        sha: 'mock-commit-sha',
        url: 'mock-api-url'
      }
    };
  }

  async validateConnection() {
    return {
      connected: true,
      rateLimit: { remaining: 5000, reset: Date.now() + 3600000 }
    };
  }
}

/**
 * Mock File Writer for CLI testing
 */
class MockFileWriter extends FileWriterInterface {
  async writeFiles(files, _options) {
    // Simulate file operations
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      written: files.map(f => f.path),
      skipped: [],
      backed_up: [],
      errors: [],
      rollback_info: []
    };
  }

  async checkConflicts(_filePaths, _targetDir) {
    return {
      hasConflicts: false,
      conflictFiles: [],
      details: []
    };
  }
}

/**
 * Integration factory for creating service instances
 * This will be replaced with real implementations as they become available
 */
class ServiceFactory {
  static createGitHubFetcher(useMock = true) {
    if (useMock) {
      return new MockGitHubFetcher();
    }
    // Will return real implementation when available
    throw new Error('Real GitHubFetcher not yet implemented');
  }

  static createFileWriter(useMock = true) {
    if (useMock) {
      return new MockFileWriter();
    }
    // Will return real implementation when available
    throw new Error('Real FileWriter not yet implemented');
  }

  static createDependencyChecker(useMock = true) {
    if (useMock) {
      return {
        async validateAll() {
          return {
            python: { installed: true, version: '3.9.0', compatible: true },
            uv: { installed: true, version: '0.1.0' },
            node: { installed: true, version: '18.0.0', compatible: true },
            allSatisfied: true,
            missing: [],
            warnings: []
          };
        }
      };
    }
    throw new Error('Real DependencyChecker not yet implemented');
  }
}

module.exports = {
  // Interface classes
  GitHubFetcherInterface,
  FileWriterInterface,
  DependencyCheckerInterface,
  InstallationOrchestratorInterface,

  // Mock implementations
  MockGitHubFetcher,
  MockFileWriter,

  // Service factory
  ServiceFactory
};
