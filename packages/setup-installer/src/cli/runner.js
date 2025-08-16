/**
 * CLI Runner - Main orchestrator for @claude-code/setup-installer
 *
 * Coordinates the complete installation flow:
 * - CLI argument parsing
 * - User interaction prompts
 * - Progress indicators
 * - Mock GitHub operations (for early development)
 * - File installation coordination
 * - Error handling and recovery
 */

const ora = require('ora');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;

const { parseArguments, displayHelp } = require('./parser');
const { runInstallationPrompts, setupInterruptHandler } = require('./prompts');

/**
 * Main CLI entry point
 * @param {string[]} argv - Command line arguments
 * @returns {Promise<void>}
 */
async function run(argv = process.argv) {
  setupInterruptHandler();

  try {
    // Parse command line arguments
    const parseResult = parseArguments(argv);

    if (!parseResult.success) {
      console.error(chalk.red(`Error: ${parseResult.error}`));
      displayHelp(parseResult.command);
      process.exit(1);
    }

    const { options } = parseResult;

    // Show help if requested
    if (options.help) {
      displayHelp(parseResult.command);
      return;
    }

    // Show version if requested
    if (options.version) {
      console.log('1.0.0');
      return;
    }

    // Run installation flow
    await runInstallationFlow(options);

  } catch (error) {
    handleUnexpectedError(error);
    process.exit(1);
  }
}

/**
 * Main installation flow orchestrator
 * @param {Object} options - Parsed CLI options
 */
async function runInstallationFlow(options) {
  console.log(chalk.cyan.bold('🚀 Claude Code Setup Installer v1.0.0'));
  console.log(chalk.gray('Installing multi-agent orchestration setup\n'));

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No files will be modified\n'));
  }

  // Step 1: User interaction and confirmation
  const promptResult = await runInstallationPrompts(options);

  if (!promptResult.confirmed) {
    console.log(chalk.yellow('\n❌ Installation cancelled'));
    return;
  }

  // Step 2: Pre-installation checks
  await runPreInstallationChecks(promptResult);

  // Step 3: Fetch files (mocked for now)
  const fetchedFiles = await fetchInstallationFiles(promptResult, options);

  // Step 4: Install files
  await installFiles(fetchedFiles, promptResult, options);

  // Step 5: Post-installation tasks
  await runPostInstallationTasks(promptResult, options);

  // Step 6: Success message
  displaySuccessMessage(promptResult);
}

/**
 * Run pre-installation validation checks
 * @param {Object} promptResult - User prompt responses
 */
async function runPreInstallationChecks(promptResult) {
  const spinner = ora('Running pre-installation checks...').start();

  try {
    // Check target directory
    await validateTargetDirectory(promptResult.targetDir);
    spinner.text = 'Validating target directory...';

    // Check Python dependencies if requested
    if (promptResult.pythonCheck) {
      await checkPythonDependencies();
      spinner.text = 'Checking Python dependencies...';
    }

    // Check disk space
    await checkDiskSpace(promptResult.targetDir);
    spinner.text = 'Checking available disk space...';

    spinner.succeed('Pre-installation checks completed');
  } catch (error) {
    spinner.fail(`Pre-installation check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch installation files (MOCKED for early development)
 * @param {Object} promptResult - User prompt responses
 * @param {Object} options - CLI options
 * @returns {Promise<Array>} Fetched files data
 */
async function fetchInstallationFiles(promptResult, options) {
  const spinner = ora('Fetching files from GitHub...').start();

  try {
    // MOCK: Simulate fetching from GitHub
    spinner.text = 'Connecting to GitHub API...';
    await mockDelay(1000);

    spinner.text = 'Fetching .claude directory structure...';
    await mockDelay(1500);

    spinner.text = 'Downloading hooks and agents...';
    await mockDelay(2000);

    spinner.text = 'Downloading configuration files...';
    await mockDelay(1000);

    // MOCK: Return simulated file structure
    const mockFiles = generateMockFileStructure(options.tag);

    spinner.succeed(`Fetched ${mockFiles.length} files from ${options.tag}`);

    if (options.verbose) {
      console.log(chalk.gray('Files to install:'));
      mockFiles.forEach(file => {
        console.log(chalk.gray(`  • ${file.path}`));
      });
    }

    return mockFiles;
  } catch (error) {
    spinner.fail(`Failed to fetch files: ${error.message}`);
    throw error;
  }
}

/**
 * Install fetched files to target directory
 * @param {Array} files - Files to install
 * @param {Object} promptResult - User prompt responses
 * @param {Object} options - CLI options
 */
async function installFiles(files, promptResult, options) {
  const spinner = ora('Installing files...').start();

  try {
    let installed = 0;
    let skipped = 0;
    let backed_up = 0;

    for (const file of files) {
      const targetPath = path.join(promptResult.targetDir, file.path);

      spinner.text = `Installing ${file.path}...`;

      if (options.dryRun) {
        console.log(chalk.gray(`[DRY RUN] Would install: ${file.path}`));
        continue;
      }

      // Handle existing files based on strategy
      const exists = await fileExists(targetPath);
      if (exists) {
        switch (promptResult.overwriteStrategy) {
        case 'skip':
          skipped++;
          continue;
        case 'backup':
          await createBackup(targetPath);
          backed_up++;
          break;
        case 'overwrite':
          // Will overwrite below
          break;
        }
      }

      // Create directory if needed
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      // Write file content (MOCKED)
      await fs.writeFile(targetPath, file.content, { mode: file.mode });
      installed++;

      // Show progress for verbose mode
      if (options.verbose) {
        console.log(chalk.green(`  ✓ ${file.path}`));
      }
    }

    const message = `Installed ${installed} files` +
                   (skipped > 0 ? `, skipped ${skipped}` : '') +
                   (backed_up > 0 ? `, backed up ${backed_up}` : '');

    spinner.succeed(message);
  } catch (error) {
    spinner.fail(`Installation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Run post-installation tasks
 * @param {Object} promptResult - User prompt responses
 * @param {Object} options - CLI options
 */
async function runPostInstallationTasks(promptResult, _options) {
  const spinner = ora('Completing setup...').start();

  try {
    // Generate settings.local.json
    await generateSettingsFile(promptResult);
    spinner.text = 'Creating settings.local.json...';

    // Set executable permissions on hooks
    await setExecutablePermissions(promptResult.targetDir);
    spinner.text = 'Setting executable permissions...';

    // Validate installation
    await validateInstallation(promptResult.targetDir);
    spinner.text = 'Validating installation...';

    spinner.succeed('Setup completed successfully');
  } catch (error) {
    spinner.fail(`Post-installation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Display success message and next steps
 * @param {Object} promptResult - User prompt responses
 */
function displaySuccessMessage(_promptResult) {
  console.log(chalk.green.bold('\n✅ Installation Complete!'));
  console.log(chalk.gray('\nClaude multi-agent orchestration setup has been installed.'));

  console.log(chalk.blue('\n📋 Next Steps:'));
  console.log(chalk.gray('1. Review .claude/settings.local.json for configuration'));
  console.log(chalk.gray('2. Ensure Python and uv are installed for hooks functionality'));
  console.log(chalk.gray('3. Start the observability server (optional)'));
  console.log(chalk.gray('4. Open your project in Claude Code'));

  console.log(chalk.blue('\n🔗 Resources:'));
  console.log(chalk.gray('• Documentation: /docs/project/guides/installation-guide.md'));
  console.log(chalk.gray('• Troubleshooting: /docs/project/guides/troubleshooting.md'));
  console.log(chalk.gray('• GitHub: https://github.com/alexsavage/claude-code-hooks-multi-agent-observability'));

  console.log(chalk.cyan('\nHappy coding with Claude! 🤖\n'));
}

// ============================================================================
// MOCK IMPLEMENTATIONS (Replace with real implementations in future WPs)
// ============================================================================

/**
 * Generate mock file structure for testing
 * @param {string} tag - Git tag/branch
 * @returns {Array} Mock file structure
 */
function generateMockFileStructure(_tag) {
  return [
    {
      path: '.claude/settings.json',
      content: JSON.stringify({
        version: '1.0.0',
        observability_server: 'http://localhost:4000',
        hooks_enabled: true
      }, null, 2),
      mode: 0o644
    },
    {
      path: '.claude/hooks/comms/send_message.py',
      content: '#!/usr/bin/env python3\n# Mock hook for team communication\nprint("Mock hook: send_message")\n',
      mode: 0o755
    },
    {
      path: '.claude/hooks/comms/get_unread_messages.py',
      content: '#!/usr/bin/env python3\n# Mock hook for message retrieval\nprint("Mock hook: get_unread_messages")\n',
      mode: 0o755
    },
    {
      path: '.claude/agents/engineer.md',
      content: '# Engineer Agent\n\nImplementation specialist for code development.\n',
      mode: 0o644
    },
    {
      path: '.claude/agents/architect.md',
      content: '# Architect Agent\n\nSystem design and architecture specialist.\n',
      mode: 0o644
    },
    {
      path: 'CLAUDE.md',
      content: '# Claude Code Setup\n\nThis project has been configured for Claude multi-agent orchestration.\n',
      mode: 0o644
    }
  ];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function mockDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function validateTargetDirectory(targetDir) {
  try {
    await fs.access(targetDir);
  } catch (error) {
    await fs.mkdir(targetDir, { recursive: true });
  }
}

async function checkPythonDependencies() {
  // MOCK: In real implementation, check for python and uv
  await mockDelay(500);
  // For now, assume they exist
}

async function checkDiskSpace(_targetDir) {
  // MOCK: In real implementation, check available disk space
  await mockDelay(300);
  // Assume sufficient space
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

async function createBackup(filePath) {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  await fs.copyFile(filePath, backupPath);
}

async function generateSettingsFile(promptResult) {
  const settingsPath = path.join(promptResult.targetDir, '.claude/settings.local.json');
  const settings = {
    observability_server: promptResult.configUrl,
    installation_date: new Date().toISOString(),
    installation_mode: 'npx-installer'
  };

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

async function setExecutablePermissions(targetDir) {
  const hookFiles = [
    '.claude/hooks/comms/send_message.py',
    '.claude/hooks/comms/get_unread_messages.py'
  ];

  for (const hookFile of hookFiles) {
    const hookPath = path.join(targetDir, hookFile);
    try {
      await fs.chmod(hookPath, 0o755);
    } catch (error) {
      // Hook file may not exist, continue
    }
  }
}

async function validateInstallation(targetDir) {
  const requiredFiles = [
    '.claude/settings.json',
    'CLAUDE.md'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(targetDir, file);
    await fs.access(filePath);
  }
}

function handleUnexpectedError(error) {
  console.error(chalk.red('\n💥 Unexpected error occurred:'));
  console.error(chalk.red(error.message));

  if (process.env.NODE_ENV === 'development') {
    console.error(chalk.gray('\nStack trace:'));
    console.error(chalk.gray(error.stack));
  }

  console.error(chalk.yellow('\nPlease report this issue at:'));
  console.error(chalk.blue('https://github.com/alexsavage/claude-code-hooks-multi-agent-observability/issues'));
}

module.exports = {
  run,
  runInstallationFlow,
  runPreInstallationChecks,
  fetchInstallationFiles,
  installFiles,
  runPostInstallationTasks,
  displaySuccessMessage,
  generateMockFileStructure
};
