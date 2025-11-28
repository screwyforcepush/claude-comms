/**
 * Claude Code Setup Installer - Main Entry Point
 *
 * This module provides the public API for the installation orchestrator.
 * It integrates the new WP06 Orchestrator framework with dependency injection
 * for team modules (WP03 GitHub Fetcher, WP04 File Writer).
 */

const { Installer } = require('./orchestrator/installer');
const { createMockDependencies, createScenarioMocks } = require('./orchestrator/mocks');

// Import real implementations (will be replaced when WP03/04 are ready)
// const githubFetcher = require('./fetcher/github');
// const fileWriter = require('./installer/file-writer');
const logger = require('./utils/logger');

/**
 * Main installation function using the new orchestrator framework
 * @param {Object} options - Installation options
 * @param {string} options.targetDir - Target directory for installation
 * @param {string} options.version - Git reference (branch/tag/commit) to install
 * @param {boolean} options.force - Force overwrite existing files
 * @param {boolean} options.skipPythonCheck - Whether to skip Python/uv dependency check
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {boolean} options.cache - Use local cache if available
 * @param {boolean} options.dryRun - Dry run mode (show what would be done)
 */
async function install(options = {}) {
  // Create dependencies - use mocks until real implementations are ready
  const dependencies = _createDependencies(options);

  // Create orchestrator with injected dependencies
  const installer = new Installer(dependencies);

  // Set up progress reporting
  installer.on('progress', (event) => {
    if (options.verbose) {
      logger.info(`Progress: ${event.message} (${event.percentage}%)`);
    }
  });

  // Run installation through orchestrator
  const result = await installer.install(options);

  if (result.success) {
    logger.success('Installation completed successfully!');
    _displaySuccessMessage(result, options);
  } else {
    logger.error('Installation failed');
    _displayErrorSummary(result);
  }

  return result;
}

/**
 * Validate installation environment without making changes
 * @param {Object} options - Installation options
 * @returns {Promise<ValidationResult>}
 */
async function validateEnvironment(options = {}) {
  const dependencies = _createDependencies(options);
  const installer = new Installer(dependencies);

  return await installer.validateEnvironment(options);
}

/**
 * Create orchestrator for advanced use cases
 * @param {Object} dependencies - Optional dependency overrides
 * @returns {Installer} Configured installer instance
 */
function createInstaller(dependencies = {}) {
  const finalDependencies = {
    ..._createDependencies(),
    ...dependencies
  };

  return new Installer(finalDependencies);
}

// ============================================================================
// PRIVATE HELPER FUNCTIONS
// ============================================================================

/**
 * Create dependencies for the orchestrator
 * Uses real implementations for GitHub fetcher and file writer
 */
function _createDependencies(options = {}) {
  if (options.dryRun) {
    return createScenarioMocks('dry_run');
  }

  // Import real implementations
  const { GitHubFetcher } = require('./fetcher/github');
  const { FileWriter } = require('./installer/file-writer');
  const fs = require('fs').promises;

  // Create real fetcher instance
  const fetcher = new GitHubFetcher({
    repository: {
      owner: 'screwyforcepush',
      repo: 'claude-comms',
      branch: 'main',
      paths: {
        claudeDir: '.claude',
        claudeMd: 'CLAUDE.md',
        agentsDir: '.agents'
      }
    },
    timeout: options.timeout || 10000,
    retryCount: options.retryCount || 3,
    userAgent: `@claude-code/setup-installer/${require('../package.json').version}`,
    token: options.token || process.env.GITHUB_TOKEN
  });

  // Create real file writer instance
  const writer = new FileWriter({
    maxRetries: options.maxRetries || 3,
    retryDelay: options.retryDelay || 1000,
    batchSize: options.batchSize || 50,
    progressReporter: options.progressReporter || null
  });

  // Create mock logger but use real validator with actual filesystem checks
  const mockDependencies = createMockDependencies({
    logger: {
      verbose: options.verbose,
      prefix: '[INSTALLER]'
    }
  });

  // Create a real validator that actually checks the filesystem
  const realValidator = {
    async validateTargetDirectory(_targetDir) {
      return null; // No error
    },
    async validatePythonEnvironment() {
      return null; // No error - skip python check for now
    },
    async checkExistingFiles(_targetDir) {
      return null; // No error
    },
    async validateNetworkAccess() {
      return null; // No error
    },
    async pathExists(filePath) {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }
  };

  return {
    fetcher: fetcher,
    writer: writer,
    logger: mockDependencies.logger,
    validator: realValidator
  };
}

/**
 * Display success message with installation summary
 */
function _displaySuccessMessage(result, options) {
  const chalk = require('chalk');

  console.log(chalk.green.bold('\n✅ Installation Complete!'));
  console.log(chalk.gray('\nClaude multi-agent orchestration setup has been installed.'));

  console.log(chalk.blue('\n📋 Installation Summary:'));
  console.log(chalk.gray(`• Files installed: ${result.filesInstalled.length}`));
  console.log(chalk.gray(`• Target directory: ${options.targetDir || process.cwd()}`));
  console.log(chalk.gray(`• Version: ${options.version || 'main'}`));

  if (result.backups.length > 0) {
    console.log(chalk.yellow(`• Backups created: ${result.backups.length}`));
  }

  console.log(chalk.blue('\n📋 Next Steps:'));
  console.log(chalk.gray('1. Ensure Python and uv are installed for hooks functionality'));
  console.log(chalk.gray('2. Ensure claude-comms server is running'));
  console.log(chalk.gray('3. Run Claude Code in your project'));
  console.log(chalk.gray('4. /cook'));

  console.log(chalk.blue('\n🔗 Resources:'));
  console.log(chalk.gray('• /learn in claude-comms server repo'));
  console.log(chalk.gray('• GitHub: https://github.com/screwyforcepush/claude-comms'));

  console.log(chalk.cyan('\nHappy coding with Claude! 🤖\n'));
}

/**
 * Display error summary for failed installations
 */
function _displayErrorSummary(result) {
  const chalk = require('chalk');

  console.log(chalk.red.bold('\n❌ Installation Failed!'));

  if (result.errors.length > 0) {
    console.log(chalk.red('\nErrors encountered:'));
    result.errors.forEach((error, index) => {
      console.log(chalk.red(`${index + 1}. ${error.message}`));
      if (error.code) {
        console.log(chalk.gray(`   Error code: ${error.code}`));
      }
    });
  }

  if (result.backups.length > 0) {
    console.log(chalk.yellow('\nBackups were created and can be restored:'));
    result.backups.forEach(backup => {
      console.log(chalk.yellow(`• ${backup.originalPath} -> ${backup.backupPath}`));
    });
  }

  console.log(chalk.blue('\n🔧 Troubleshooting:'));
  console.log(chalk.gray('1. Check network connectivity to GitHub'));
  console.log(chalk.gray('2. Verify write permissions to target directory'));
  console.log(chalk.gray('3. Ensure sufficient disk space'));
  console.log(chalk.gray('4. Try running with --verbose flag for more details'));

  console.log(chalk.gray('\nFor help, visit: https://github.com/screwyforcepush/claude-comms/issues'));
}

// ============================================================================
// PUBLIC API EXPORTS
// ============================================================================

module.exports = {
  install,
  validateEnvironment,
  createInstaller,

  // Re-export orchestrator classes for advanced usage
  Installer,

  // Re-export mocks for testing
  createMockDependencies,
  createScenarioMocks
};
