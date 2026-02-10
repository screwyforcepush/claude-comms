#!/usr/bin/env node

/**
 * Claude Code Setup Installer
 * NPX-executable script to install Claude multi-agent orchestration setup
 * 
 * Usage:
 *   npx @claude-code/setup-installer
 *   npx @claude-code/setup-installer --dir ./my-project
 *   npx @claude-code/setup-installer --version v1.2.0
 *   npx @claude-code/setup-installer --force
 */

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');

// Import main installer logic
const installer = require('../src/index.js');
const { version } = require('../package.json');

// Configure CLI arguments
program
  .name('claude-setup')
  .description('Install Claude multi-agent orchestration setup into your project')
  .version(version)
  .option('-d, --dir <directory>', 'Target directory for installation', process.cwd())
  .option('-v, --version <version>', 'Specific version/tag to install from GitHub', 'main')
  .option('-f, --force', 'Overwrite existing files without prompting', false)
  .option('--no-python-check', 'Skip Python/uv dependency validation', false)
  .option('--dev', 'Development mode with verbose logging', false)
  .option('--verify', 'Verify installation without making changes', false)
  .option('--dry-run', 'Show what would be installed without executing', false)
  .parse();

const options = program.opts();

// Entry point
async function main() {
  try {
    console.log(chalk.cyan.bold(`\n🚀 Claude Code Setup Installer v${version}\n`));
    
    // Validate target directory
    const targetDir = path.resolve(options.dir);
    console.log(chalk.blue(`📍 Target directory: ${targetDir}`));
    
    // Development mode logging
    if (options.dev) {
      console.log(chalk.yellow('🔧 Development mode enabled'));
      console.log(chalk.gray('Options:', JSON.stringify(options, null, 2)));
    }
    
    // Verification mode
    if (options.verify) {
      console.log(chalk.yellow('🔍 Verification mode - no changes will be made'));
    }
    
    // Dry run mode  
    if (options.dryRun) {
      console.log(chalk.yellow('🏃 Dry run mode - showing what would be installed'));
    }
    
    // Execute installer with options
    await installer.install({
      targetDir,
      gitRef: options.version,
      force: options.force,
      checkPython: options.pythonCheck,
      dev: options.dev,
      verify: options.verify,
      dryRun: options.dryRun
    });
    
    console.log(chalk.green.bold('\n✅ Installation complete!\n'));
    
    // Show next steps
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.white('1. Ensure Python and uv are installed for hooks'));
    console.log(chalk.white('2. Start the observability server (optional)'));
    console.log(chalk.white('3. Open your project in Claude Code'));
    console.log(chalk.cyan('\nHappy coding with Claude! 🤖\n'));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Installation failed:'));
    console.error(chalk.red(error.message));
    
    if (options.dev && error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    
    // Show troubleshooting hints
    console.log(chalk.yellow('\n💡 Troubleshooting:'));
    console.log(chalk.white('• Check network connection for GitHub access'));
    console.log(chalk.white('• Verify write permissions in target directory'));
    console.log(chalk.white('• Try running with --dev for more details'));
    console.log(chalk.white('• Report issues: https://github.com/alexsavage/claude-comms/issues'));
    
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error(chalk.red.bold('\n💥 Unexpected error:'));
  console.error(chalk.red(error.message));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red.bold('\n💥 Unhandled promise rejection:'));
  console.error(chalk.red(reason));
  process.exit(1);
});

// Handle CTRL+C gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️  Installation cancelled by user'));
  process.exit(0);
});

// Execute main function
main().catch((error) => {
  console.error(chalk.red.bold('\n❌ Fatal error:'));
  console.error(chalk.red(error.message));
  process.exit(1);
});