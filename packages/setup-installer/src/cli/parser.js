/**
 * CLI Argument Parser for @claude-code/setup-installer
 *
 * Uses commander.js to define and parse command-line arguments
 * Supports:
 * - --force: Skip confirmation prompts and overwrite existing files
 * - --verbose: Enable detailed logging
 * - --target-dir: Specify installation directory
 * - --tag: Install specific version tag
 * - --no-python-check: Skip Python/uv dependency checks
 */

const { Command } = require('commander');
const path = require('path');

/**
 * Create and configure the CLI parser
 * @returns {Command} Configured commander instance
 */
function createParser() {
  const program = new Command();

  program
    .name('claude-setup')
    .description('NPX installer for Claude multi-agent orchestration setup')
    .version('1.0.0', '-v, --version', 'Display version number')
    .helpOption('-h, --help', 'Display help for command');

  // Primary options
  program
    .option('--force', 'Skip confirmation prompts and overwrite existing files', false)
    .option('--verbose', 'Enable detailed logging output', false)
    .option('--target-dir <path>', 'Target directory for installation (default: current directory)', process.cwd())
    .option('--tag <version>', 'Install specific version tag from GitHub (default: main branch)', 'main')
    .option('--no-python-check', 'Skip Python and uv dependency validation', false);

  // Advanced options
  program
    .option('--dry-run', 'Show what would be installed without making changes', false)
    .option('--backup', 'Create backup of existing files before overwriting', false)
    .option('--config-url <url>', 'Custom observability server URL for settings.local.json');

  return program;
}

/**
 * Parse command line arguments and validate options
 * @param {string[]} argv - Command line arguments (defaults to process.argv)
 * @returns {ParsedOptions} Parsed and validated options
 */
function parseArguments(argv = process.argv) {
  const program = createParser();

  try {
    program.parse(argv);
    const options = program.opts();

    // Validate and normalize options
    const parsedOptions = validateOptions(options);

    return {
      success: true,
      options: parsedOptions,
      command: program
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      command: program
    };
  }
}

/**
 * Validate and normalize parsed options
 * @param {Object} options - Raw options from commander
 * @returns {ValidatedOptions} Validated options object
 */
function validateOptions(options) {
  const validated = { ...options };

  // Normalize target directory
  if (validated.targetDir) {
    validated.targetDir = path.resolve(validated.targetDir);
  }

  // Validate tag format (basic validation)
  if (validated.tag && validated.tag !== 'main') {
    if (!/^v?\d+\.\d+\.\d+$/.test(validated.tag) && !/^[a-f0-9]{40}$/.test(validated.tag)) {
      throw new Error(`Invalid tag format: ${validated.tag}. Use semantic version (v1.0.0) or commit hash`);
    }
  }

  // Validate config URL if provided
  if (validated.configUrl) {
    try {
      new URL(validated.configUrl);
    } catch (error) {
      throw new Error(`Invalid config URL: ${validated.configUrl}`);
    }
  }

  // Set derived flags
  validated.interactive = !validated.force;
  validated.pythonCheck = !validated.noPythonCheck;

  return validated;
}

/**
 * Display help information
 * @param {Command} program - Commander instance
 */
function displayHelp(program) {
  program.outputHelp();

  console.log('\nExamples:');
  console.log('  npx @claude-code/setup-installer');
  console.log('  npx @claude-code/setup-installer --target-dir ./my-project');
  console.log('  npx @claude-code/setup-installer --force --tag v1.2.0');
  console.log('  npx @claude-code/setup-installer --dry-run --verbose');
  console.log('  npx @claude-code/setup-installer --config-url http://localhost:4000');

  console.log('\nFor more information, visit: https://github.com/alexsavage/claude-code-hooks-multi-agent-observability');
}

/**
 * Interface definitions for TypeScript-style documentation
 */

/**
 * @typedef {Object} ParsedOptions
 * @property {boolean} force - Skip confirmation prompts
 * @property {boolean} verbose - Enable detailed logging
 * @property {string} targetDir - Target installation directory
 * @property {string} tag - Git tag or branch to install
 * @property {boolean} pythonCheck - Whether to check Python dependencies
 * @property {boolean} dryRun - Show changes without executing
 * @property {boolean} backup - Create backup of existing files
 * @property {string} [configUrl] - Custom config URL
 * @property {boolean} interactive - Derived: opposite of force
 */

/**
 * @typedef {Object} ParseResult
 * @property {boolean} success - Whether parsing succeeded
 * @property {ParsedOptions} [options] - Parsed options (if successful)
 * @property {string} [error] - Error message (if failed)
 * @property {Command} command - Commander instance
 */

module.exports = {
  createParser,
  parseArguments,
  validateOptions,
  displayHelp
};
