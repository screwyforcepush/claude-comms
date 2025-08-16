/**
 * Interactive Prompts for @claude-code/setup-installer
 *
 * Handles user interaction through prompts for:
 * - Installation confirmation
 * - Directory selection
 * - Overwrite warnings
 * - Configuration options
 */

const prompts = require('prompts');
const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');

/**
 * Main prompt orchestrator for installation flow
 * @param {Object} options - Parsed CLI options
 * @returns {Promise<Object>} User responses and validated settings
 */
async function runInstallationPrompts(options) {
  const responses = {};

  console.log(chalk.cyan('🚀 Claude Code Setup Installer'));
  console.log(chalk.gray('Setting up multi-agent orchestration in your project\n'));

  // Skip prompts if force mode
  if (options.force) {
    return {
      confirmed: true,
      targetDir: options.targetDir,
      overwriteStrategy: 'overwrite',
      configUrl: options.configUrl || 'http://localhost:4000',
      pythonCheck: options.pythonCheck
    };
  }

  // Confirm installation location
  const dirConfirmation = await confirmTargetDirectory(options.targetDir);
  if (!dirConfirmation.confirmed) {
    return { confirmed: false, cancelled: true };
  }
  responses.targetDir = dirConfirmation.targetDir;

  // Check for existing files
  const existingFiles = await checkExistingFiles(responses.targetDir);
  if (existingFiles.hasConflicts) {
    const overwriteResponse = await handleExistingFiles(existingFiles);
    if (!overwriteResponse.confirmed) {
      return { confirmed: false, cancelled: true };
    }
    responses.overwriteStrategy = overwriteResponse.strategy;
  } else {
    responses.overwriteStrategy = 'none';
  }

  // Configuration options
  const configResponse = await promptConfigurationOptions(options);
  responses.configUrl = configResponse.configUrl;
  responses.pythonCheck = configResponse.pythonCheck;

  // Final confirmation
  const finalConfirmation = await promptFinalConfirmation(responses);
  if (!finalConfirmation) {
    return { confirmed: false, cancelled: true };
  }

  return {
    confirmed: true,
    ...responses
  };
}

/**
 * Confirm target directory for installation
 * @param {string} defaultDir - Default directory path
 * @returns {Promise<Object>} Directory confirmation result
 */
async function confirmTargetDirectory(defaultDir) {
  try {
    await fs.access(defaultDir);
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Directory ${defaultDir} does not exist.`));

    const createResponse = await prompts({
      type: 'confirm',
      name: 'create',
      message: 'Would you like to create it?',
      initial: true
    });

    if (!createResponse.create) {
      return { confirmed: false };
    }
  }

  const dirResponse = await prompts({
    type: 'text',
    name: 'targetDir',
    message: 'Installation directory:',
    initial: defaultDir,
    validate: (value) => {
      if (!value.trim()) return 'Directory path cannot be empty';
      return true;
    }
  });

  if (!dirResponse.targetDir) {
    return { confirmed: false };
  }

  return {
    confirmed: true,
    targetDir: path.resolve(dirResponse.targetDir)
  };
}

/**
 * Check for existing files that would conflict
 * @param {string} targetDir - Target installation directory
 * @returns {Promise<Object>} Conflict detection result
 */
async function checkExistingFiles(targetDir) {
  const conflictFiles = [];
  const checkFiles = [
    '.claude',
    'CLAUDE.md',
    '.claude/settings.json',
    '.claude/hooks',
    '.claude/agents'
  ];

  for (const file of checkFiles) {
    const filePath = path.join(targetDir, file);
    try {
      await fs.access(filePath);
      conflictFiles.push(file);
    } catch (error) {
      // File doesn't exist, no conflict
    }
  }

  return {
    hasConflicts: conflictFiles.length > 0,
    conflictFiles
  };
}

/**
 * Handle existing files through user prompts
 * @param {Object} existingFiles - Existing file detection result
 * @returns {Promise<Object>} User decision on handling conflicts
 */
async function handleExistingFiles(existingFiles) {
  console.log(chalk.yellow('\n⚠️  Found existing Claude setup files:'));
  existingFiles.conflictFiles.forEach(file => {
    console.log(chalk.gray(`  • ${file}`));
  });

  const strategy = await prompts({
    type: 'select',
    name: 'strategy',
    message: 'How would you like to handle existing files?',
    choices: [
      {
        title: 'Backup and replace',
        description: 'Create .backup files and install fresh setup',
        value: 'backup'
      },
      {
        title: 'Skip existing files',
        description: 'Only install missing files, keep existing ones',
        value: 'skip'
      },
      {
        title: 'Overwrite all',
        description: 'Replace all existing files (no backup)',
        value: 'overwrite'
      },
      {
        title: 'Cancel installation',
        description: 'Exit without making changes',
        value: 'cancel'
      }
    ]
  });

  if (!strategy.strategy || strategy.strategy === 'cancel') {
    return { confirmed: false };
  }

  return {
    confirmed: true,
    strategy: strategy.strategy
  };
}

/**
 * Prompt for configuration options
 * @param {Object} options - CLI options
 * @returns {Promise<Object>} Configuration responses
 */
async function promptConfigurationOptions(options) {
  console.log(chalk.blue('\n⚙️  Configuration Options'));

  const configUrl = await prompts({
    type: 'text',
    name: 'url',
    message: 'Observability server URL (optional):',
    initial: options.configUrl || 'http://localhost:4000',
    validate: (value) => {
      if (!value.trim()) return true; // Optional field
      try {
        new URL(value);
        return true;
      } catch (error) {
        return 'Please enter a valid URL';
      }
    }
  });

  const pythonCheck = await prompts({
    type: 'confirm',
    name: 'check',
    message: 'Check for Python and uv dependencies?',
    initial: options.pythonCheck !== false
  });

  return {
    configUrl: configUrl.url || 'http://localhost:4000',
    pythonCheck: pythonCheck.check
  };
}

/**
 * Final confirmation before installation
 * @param {Object} responses - Collected user responses
 * @returns {Promise<boolean>} Final confirmation
 */
async function promptFinalConfirmation(responses) {
  console.log(chalk.green('\n📋 Installation Summary:'));
  console.log(chalk.gray(`  Directory: ${responses.targetDir}`));
  console.log(chalk.gray(`  Overwrite strategy: ${responses.overwriteStrategy}`));
  console.log(chalk.gray(`  Config URL: ${responses.configUrl}`));
  console.log(chalk.gray(`  Python check: ${responses.pythonCheck ? 'Yes' : 'No'}`));

  const confirmation = await prompts({
    type: 'confirm',
    name: 'proceed',
    message: 'Proceed with installation?',
    initial: true
  });

  return confirmation.proceed;
}

/**
 * Handle user interruption (Ctrl+C)
 */
function setupInterruptHandler() {
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n⚠️  Installation cancelled by user'));
    process.exit(0);
  });
}

/**
 * Prompt for specific installation scenarios
 */
const scenarios = {
  /**
   * Prompt for force mode confirmation when destructive
   */
  async confirmForceMode(conflictFiles) {
    console.log(chalk.red('\n⚠️  Force mode will overwrite:'));
    conflictFiles.forEach(file => {
      console.log(chalk.gray(`  • ${file}`));
    });

    return await prompts({
      type: 'confirm',
      name: 'proceed',
      message: 'Continue with force installation?',
      initial: false
    });
  },

  /**
   * Prompt for Python installation if missing
   */
  async promptPythonInstall() {
    console.log(chalk.yellow('\n⚠️  Python or uv not found'));
    console.log(chalk.gray('The Claude hooks require Python and uv to function properly.'));

    return await prompts({
      type: 'select',
      name: 'action',
      message: 'How would you like to proceed?',
      choices: [
        { title: 'Continue anyway', value: 'continue' },
        { title: 'Open installation guide', value: 'guide' },
        { title: 'Cancel installation', value: 'cancel' }
      ]
    });
  }
};

module.exports = {
  runInstallationPrompts,
  confirmTargetDirectory,
  checkExistingFiles,
  handleExistingFiles,
  promptConfigurationOptions,
  promptFinalConfirmation,
  setupInterruptHandler,
  scenarios
};
