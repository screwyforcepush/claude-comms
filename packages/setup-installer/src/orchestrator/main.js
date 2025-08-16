/**
 * Claude Code Setup Installer - Main Module
 *
 * This module orchestrates the complete installation flow:
 * 1. Validates target directory and dependencies
 * 2. Fetches latest setup files from GitHub
 * 3. Installs .claude directory and CLAUDE.md
 * 4. Configures local settings
 * 5. Provides post-installation guidance
 */

const path = require('path');
const fs = require('fs-extra');
const ora = require('ora');

// Import core modules (these will be implemented in WP02-06)
const logger = require('./utils/logger');
const { InstallationError } = require('./utils/errors');
const fetcher = require('./fetcher/github');
const fileWriter = require('./installer/file-writer');
const dependencyChecker = require('./installer/dependency-check');
const prompts = require('./cli/prompts');

/**
 * Main installation function
 * @param {Object} options - Installation options
 * @param {string} options.targetDir - Target directory for installation
 * @param {string} options.gitRef - Git reference (branch/tag/commit) to install
 * @param {boolean} options.force - Force overwrite existing files
 * @param {boolean} options.checkPython - Whether to check Python/uv dependencies
 * @param {boolean} options.dev - Development mode with verbose logging
 * @param {boolean} options.verify - Verification mode (no changes)
 * @param {boolean} options.dryRun - Dry run mode (show what would be done)
 */
async function install(options = {}) {
  const {
    targetDir = process.cwd(),
    gitRef = 'main',
    force = false,
    checkPython = true,
    dev = false,
    verify = false,
    dryRun = false
  } = options;

  // Configure logger for development mode
  logger.configure({ verbose: dev, verify, dryRun });

  try {
    logger.info('Starting Claude Code installation...');

    // Phase 1: Pre-installation validation
    await validateEnvironment(targetDir, checkPython);

    // Phase 2: Handle existing files
    await handleExistingFiles(targetDir, force, verify, dryRun);

    // Phase 3: Fetch setup files from GitHub
    const setupFiles = await fetchSetupFiles(gitRef);

    // Phase 4: Install files to target directory
    await installFiles(setupFiles, targetDir, verify, dryRun);

    // Phase 5: Post-installation configuration
    await configureLocalSettings(targetDir, verify, dryRun);

    // Phase 6: Verify installation
    await verifyInstallation(targetDir);

    logger.success('Installation completed successfully!');

  } catch (error) {
    logger.error('Installation failed:', error.message);
    throw error;
  }
}

/**
 * Validate installation environment
 */
async function validateEnvironment(targetDir, checkPython) {
  const spinner = ora('Validating environment...').start();

  try {
    // Check target directory exists and is writable
    await fs.ensureDir(targetDir);
    await fs.access(targetDir, fs.constants.W_OK);

    // Check dependencies if requested
    if (checkPython) {
      await dependencyChecker.validatePythonEnvironment();
    }

    spinner.succeed('Environment validation complete');

  } catch (error) {
    spinner.fail('Environment validation failed');
    throw new InstallationError(`Environment validation failed: ${error.message}`, 'ENV_VALIDATION_FAILED');
  }
}

/**
 * Handle existing .claude directory and CLAUDE.md
 */
async function handleExistingFiles(targetDir, force, verify, dryRun) {
  const claudeDir = path.join(targetDir, '.claude');
  const claudeMd = path.join(targetDir, 'CLAUDE.md');

  const existingFiles = [];
  if (await fs.pathExists(claudeDir)) existingFiles.push('.claude/');
  if (await fs.pathExists(claudeMd)) existingFiles.push('CLAUDE.md');

  if (existingFiles.length === 0) {
    logger.info('No existing files found - proceeding with fresh installation');
    return;
  }

  if (verify || dryRun) {
    logger.info(`Found existing files: ${existingFiles.join(', ')}`);
    return;
  }

  if (force) {
    logger.info(`Force mode enabled - will overwrite: ${existingFiles.join(', ')}`);
    return;
  }

  // Interactive prompt for handling existing files
  const action = await prompts.handleExistingFiles(existingFiles);

  switch (action) {
  case 'backup':
    await fileWriter.backupExistingFiles(targetDir, existingFiles);
    break;
  case 'skip':
    logger.info('Skipping existing files');
    break;
  case 'cancel':
    throw new InstallationError('Installation cancelled by user', 'USER_CANCELLED');
  default:
    // Overwrite - no action needed
    break;
  }
}

/**
 * Fetch setup files from GitHub repository
 */
async function fetchSetupFiles(gitRef) {
  const spinner = ora(`Fetching setup files from GitHub (${gitRef})...`).start();

  try {
    const files = await fetcher.fetchClaudeSetup(gitRef);

    spinner.succeed(`Fetched ${Object.keys(files).length} files from GitHub`);
    logger.debug('Fetched files:', Object.keys(files));

    return files;

  } catch (error) {
    spinner.fail('Failed to fetch setup files');
    throw new InstallationError(`GitHub fetch failed: ${error.message}`, 'GITHUB_FETCH_FAILED');
  }
}

/**
 * Install files to target directory
 */
async function installFiles(setupFiles, targetDir, verify, dryRun) {
  const spinner = ora('Installing files...').start();

  try {
    const stats = await fileWriter.writeSetupFiles(setupFiles, targetDir, { verify, dryRun });

    if (verify || dryRun) {
      spinner.succeed(`Would install ${stats.fileCount} files (${stats.totalSize} bytes)`);
    } else {
      spinner.succeed(`Installed ${stats.fileCount} files (${stats.totalSize} bytes)`);
    }

  } catch (error) {
    spinner.fail('File installation failed');
    throw new InstallationError(`File installation failed: ${error.message}`, 'FILE_INSTALL_FAILED');
  }
}

/**
 * Configure local settings file
 */
async function configureLocalSettings(targetDir, verify, dryRun) {
  const spinner = ora('Configuring local settings...').start();

  try {
    const settingsPath = path.join(targetDir, '.claude', 'settings.local.json');

    if (verify || dryRun) {
      spinner.succeed('Would create settings.local.json');
      return;
    }

    // Create basic local settings template
    const defaultSettings = {
      'observability': {
        'server_url': 'http://localhost:3001',
        'enabled': true
      },
      'hooks': {
        'enabled': true,
        'python_path': 'python3'
      },
      'agents': {
        'max_concurrent': 10,
        'timeout': 300
      }
    };

    await fs.writeJson(settingsPath, defaultSettings, { spaces: 2 });

    spinner.succeed('Local settings configured');

  } catch (error) {
    spinner.fail('Settings configuration failed');
    throw new InstallationError(`Settings configuration failed: ${error.message}`, 'SETTINGS_CONFIG_FAILED');
  }
}

/**
 * Verify installation was successful
 */
async function verifyInstallation(targetDir) {
  const spinner = ora('Verifying installation...').start();

  try {
    const claudeDir = path.join(targetDir, '.claude');
    const claudeMd = path.join(targetDir, 'CLAUDE.md');
    const settingsPath = path.join(claudeDir, 'settings.local.json');

    // Check required files exist
    const checks = [
      { path: claudeDir, name: '.claude directory' },
      { path: claudeMd, name: 'CLAUDE.md' },
      { path: settingsPath, name: 'settings.local.json' }
    ];

    for (const check of checks) {
      if (!(await fs.pathExists(check.path))) {
        throw new Error(`Missing ${check.name}`);
      }
    }

    spinner.succeed('Installation verification complete');

  } catch (error) {
    spinner.fail('Installation verification failed');
    throw new InstallationError(`Installation verification failed: ${error.message}`, 'VERIFICATION_FAILED');
  }
}

module.exports = {
  install,
  validateEnvironment,
  handleExistingFiles,
  fetchSetupFiles,
  installFiles,
  configureLocalSettings,
  verifyInstallation
};
