/**
 * CLI Entry Point for @claude-code/setup-installer
 *
 * Main entry point that orchestrates CLI parsing, user interaction,
 * and installation flow with proper error handling.
 */

const { run } = require('./runner');

/**
 * CLI entry point - can be called directly or used as module
 */
async function main() {
  try {
    await run(process.argv);
  } catch (error) {
    console.error('CLI execution failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  run,
  main
};
