#!/usr/bin/env node
/**
 * Test script for CLI functionality
 * Tests the CLI interface with various arguments and scenarios
 */

const { createParser, parseArguments } = require('./lib/cli/parser');
const { run } = require('./lib/cli/runner');
const chalk = require('chalk');

async function testParser() {
  console.log(chalk.blue('🧪 Testing CLI Parser\n'));

  const testCases = [
    {
      name: 'Default options',
      argv: ['node', 'test'],
      expected: { force: false, verbose: false, targetDir: process.cwd() }
    },
    {
      name: 'Force mode',
      argv: ['node', 'test', '--force'],
      expected: { force: true }
    },
    {
      name: 'Verbose mode',
      argv: ['node', 'test', '--verbose'],
      expected: { verbose: true }
    },
    {
      name: 'Custom target directory',
      argv: ['node', 'test', '--target-dir', '/tmp/test'],
      expected: { targetDir: '/tmp/test' }
    },
    {
      name: 'Specific tag',
      argv: ['node', 'test', '--tag', 'v1.0.0'],
      expected: { tag: 'v1.0.0' }
    },
    {
      name: 'All options',
      argv: ['node', 'test', '--force', '--verbose', '--target-dir', './test', '--tag', 'v2.0.0'],
      expected: { force: true, verbose: true, targetDir: './test', tag: 'v2.0.0' }
    }
  ];

  for (const testCase of testCases) {
    console.log(chalk.yellow(`Testing: ${testCase.name}`));
    
    try {
      const result = parseArguments(testCase.argv);
      
      if (result.success) {
        console.log(chalk.green('✓ Parsed successfully'));
        
        // Check expected values
        for (const [key, value] of Object.entries(testCase.expected)) {
          const actual = result.options[key];
          if (key === 'targetDir') {
            // For target dir, resolve the path for comparison
            const path = require('path');
            const resolved = path.resolve(value);
            if (actual === resolved) {
              console.log(chalk.gray(`  ✓ ${key}: ${actual}`));
            } else {
              console.log(chalk.red(`  ✗ ${key}: expected ${resolved}, got ${actual}`));
            }
          } else {
            if (actual === value) {
              console.log(chalk.gray(`  ✓ ${key}: ${actual}`));
            } else {
              console.log(chalk.red(`  ✗ ${key}: expected ${value}, got ${actual}`));
            }
          }
        }
      } else {
        console.log(chalk.red(`✗ Parse failed: ${result.error}`));
      }
    } catch (error) {
      console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    console.log();
  }
}

async function testHelp() {
  console.log(chalk.blue('🧪 Testing Help Display\n'));
  
  try {
    const parser = createParser();
    console.log(chalk.yellow('Help output:'));
    parser.outputHelp();
    console.log(chalk.green('\n✓ Help displayed successfully\n'));
  } catch (error) {
    console.log(chalk.red(`✗ Help test failed: ${error.message}\n`));
  }
}

async function testInvalidArguments() {
  console.log(chalk.blue('🧪 Testing Invalid Arguments\n'));

  const invalidCases = [
    {
      name: 'Invalid tag format',
      argv: ['node', 'test', '--tag', 'invalid-tag'],
      expectError: true
    },
    {
      name: 'Invalid URL',
      argv: ['node', 'test', '--config-url', 'not-a-url'],
      expectError: true
    }
  ];

  for (const testCase of invalidCases) {
    console.log(chalk.yellow(`Testing: ${testCase.name}`));
    
    try {
      const result = parseArguments(testCase.argv);
      
      if (testCase.expectError && !result.success) {
        console.log(chalk.green(`✓ Correctly rejected: ${result.error}`));
      } else if (testCase.expectError && result.success) {
        console.log(chalk.red('✗ Should have failed but succeeded'));
      } else {
        console.log(chalk.green('✓ Handled correctly'));
      }
    } catch (error) {
      if (testCase.expectError) {
        console.log(chalk.green(`✓ Correctly threw error: ${error.message}`));
      } else {
        console.log(chalk.red(`✗ Unexpected error: ${error.message}`));
      }
    }
    
    console.log();
  }
}

async function testDryRun() {
  console.log(chalk.blue('🧪 Testing Dry Run Mode\n'));
  
  console.log(chalk.yellow('Running CLI in dry-run mode...'));
  console.log(chalk.gray('This should show what would be installed without making changes.\n'));
  
  // Create test directory for dry run
  const path = require('path');
  const testDir = path.join(process.cwd(), 'test-dry-run');
  
  try {
    // Run CLI with dry-run flag
    await run(['node', 'test-cli.js', '--dry-run', '--force', '--target-dir', testDir]);
    console.log(chalk.green('\n✓ Dry run completed successfully'));
  } catch (error) {
    console.log(chalk.red(`✗ Dry run failed: ${error.message}`));
  }
}

async function runAllTests() {
  console.log(chalk.cyan.bold('🚀 CLI Test Suite\n'));
  
  try {
    await testParser();
    await testHelp();
    await testInvalidArguments();
    await testDryRun();
    
    console.log(chalk.green.bold('✅ All CLI tests completed!\n'));
  } catch (error) {
    console.error(chalk.red.bold('💥 Test suite failed:'), error.message);
    process.exit(1);
  }
}

// Check if we have required dependencies
function checkDependencies() {
  const requiredPackages = ['commander', 'prompts', 'ora', 'chalk'];
  const missing = [];
  
  for (const pkg of requiredPackages) {
    try {
      require(pkg);
    } catch (error) {
      missing.push(pkg);
    }
  }
  
  if (missing.length > 0) {
    console.log(chalk.yellow('⚠️  Missing dependencies for full testing:'));
    missing.forEach(pkg => console.log(chalk.gray(`  • ${pkg}`)));
    console.log(chalk.gray('\nInstall with: npm install ' + missing.join(' ')));
    console.log(chalk.blue('\nRunning tests with available functionality...\n'));
  }
  
  return missing.length === 0;
}

// Main execution
if (require.main === module) {
  console.log(chalk.cyan('Testing CLI Implementation\n'));
  
  const hasAllDeps = checkDependencies();
  if (hasAllDeps) {
    runAllTests();
  } else {
    // Run limited tests without external dependencies
    console.log(chalk.yellow('Running limited tests without external dependencies...\n'));
    testParser().then(() => {
      console.log(chalk.green('✅ Basic parser tests completed!\n'));
    }).catch(error => {
      console.error(chalk.red('Tests failed:'), error.message);
    });
  }
}

module.exports = {
  testParser,
  testHelp,
  testInvalidArguments,
  testDryRun,
  runAllTests
};