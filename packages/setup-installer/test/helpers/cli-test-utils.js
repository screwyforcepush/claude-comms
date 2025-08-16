/**
 * CLI Testing Utilities
 * Provides helper functions for testing command-line interface
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class CLITestRunner {
  constructor(options = {}) {
    this.binPath = options.binPath || path.join(__dirname, '../../bin/claude-setup.js');
    this.timeout = options.timeout || 30000;
    this.env = { ...process.env, ...options.env };
    this.cwd = options.cwd || process.cwd();
  }

  /**
   * Execute CLI command and return result
   */
  async run(args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [this.binPath, ...args], {
        cwd: this.cwd,
        env: this.env,
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`CLI command timed out after ${this.timeout}ms`));
      }, this.timeout);

      child.on('close', (code, signal) => {
        clearTimeout(timer);

        resolve({
          exitCode: code,
          signal,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      // Handle input if provided
      if (options.input) {
        child.stdin.write(options.input);
        child.stdin.end();
      }
    });
  }

  /**
   * Execute CLI command synchronously
   */
  runSync(args = [], options = {}) {
    const result = spawnSync('node', [this.binPath, ...args], {
      cwd: this.cwd,
      env: this.env,
      encoding: 'utf8',
      timeout: this.timeout,
      ...options
    });

    return {
      exitCode: result.status,
      signal: result.signal,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim(),
      success: result.status === 0,
      error: result.error
    };
  }

  /**
   * Test help command
   */
  async testHelp() {
    const result = await this.run(['--help']);

    return {
      ...result,
      hasUsage: result.stdout.includes('Usage:'),
      hasOptions: result.stdout.includes('Options:'),
      hasExamples: result.stdout.includes('Examples:')
    };
  }

  /**
   * Test version command
   */
  async testVersion() {
    const result = await this.run(['--version']);

    return {
      ...result,
      version: result.success ? result.stdout.match(/\d+\.\d+\.\d+/)?.[0] : null
    };
  }

  /**
   * Test installation with mock user input
   */
  async testInstallationFlow(targetDir, userInputs = []) {
    const inputs = userInputs.join('\n') + '\n';

    const result = await this.run(['--dir', targetDir], {
      input: inputs
    });

    return {
      ...result,
      installedFiles: this._scanInstalledFiles(targetDir),
      hasClaudeDir: fs.existsSync(path.join(targetDir, '.claude')),
      hasClaudeMd: fs.existsSync(path.join(targetDir, 'CLAUDE.md'))
    };
  }

  /**
   * Test error scenarios
   */
  async testErrorScenario(args, expectedError) {
    const result = await this.run(args);

    return {
      ...result,
      hasExpectedError: result.stderr.includes(expectedError) ||
                        result.stdout.includes(expectedError),
      errorType: this._classifyError(result.stderr || result.stdout)
    };
  }

  /**
   * Test with different options combinations
   */
  async testOptionsMatrix(targetDir, optionsMatrix) {
    const results = [];

    for (const options of optionsMatrix) {
      const args = this._buildArgsFromOptions(options, targetDir);
      const result = await this.run(args);

      results.push({
        options,
        args,
        result,
        success: result.success
      });
    }

    return results;
  }

  /**
   * Test interactive prompts
   */
  async testInteractivePrompts(targetDir, responses = {}) {
    const child = spawn('node', [this.binPath, '--dir', targetDir], {
      cwd: this.cwd,
      env: this.env,
      stdio: 'pipe'
    });

    const prompts = [];
    let currentPrompt = '';
    let stdout = '';
    let stderr = '';

    return new Promise((resolve, reject) => {
      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        currentPrompt += text;

        // Detect prompt patterns
        if (text.includes('?') && (text.includes('(y/N)') || text.includes('(Y/n)'))) {
          const promptText = currentPrompt.trim();
          prompts.push(promptText);

          // Send response
          const response = this._getPromptResponse(promptText, responses);
          child.stdin.write(response + '\n');
          currentPrompt = '';
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          prompts,
          success: code === 0
        });
      });

      child.on('error', reject);

      // Set timeout
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Interactive test timed out'));
      }, this.timeout);
    });
  }

  /**
   * Test CLI with different environments
   */
  async testEnvironments(args, environments) {
    const results = [];

    for (const env of environments) {
      const runner = new CLITestRunner({
        ...this,
        env: { ...this.env, ...env }
      });

      const result = await runner.run(args);
      results.push({
        environment: env,
        result
      });
    }

    return results;
  }

  /**
   * Mock external dependencies
   */
  mockDependencies(mocks = {}) {
    const mockEnv = {};

    if (mocks.noInternet) {
      mockEnv.TEST_NO_INTERNET = 'true';
    }

    if (mocks.noPython) {
      mockEnv.TEST_NO_PYTHON = 'true';
    }

    if (mocks.noUV) {
      mockEnv.TEST_NO_UV = 'true';
    }

    if (mocks.slowNetwork) {
      mockEnv.TEST_SLOW_NETWORK = 'true';
    }

    this.env = { ...this.env, ...mockEnv };
    return this;
  }

  /**
   * Capture and analyze output patterns
   */
  analyzeOutput(output) {
    return {
      hasProgressIndicators: /[▸▹▪▫●○]/.test(output) || /\d+%/.test(output),
      hasColorCodes: output.includes('\u001b['),
      hasTimestamps: /\d{2}:\d{2}:\d{2}/.test(output),
      hasErrorMessages: /error|failed|exception/i.test(output),
      hasWarningMessages: /warning|warn/i.test(output),
      hasSuccessMessages: /success|completed|done/i.test(output),
      lineCount: output.split('\n').length,
      wordCount: output.split(/\s+/).length
    };
  }

  /**
   * Performance testing utilities
   */
  async measurePerformance(args, iterations = 5) {
    const measurements = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const result = await this.run(args);
      const endTime = Date.now();

      measurements.push({
        iteration: i + 1,
        duration: endTime - startTime,
        success: result.success,
        memoryUsage: process.memoryUsage()
      });
    }

    return {
      measurements,
      average: measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length,
      min: Math.min(...measurements.map(m => m.duration)),
      max: Math.max(...measurements.map(m => m.duration)),
      successRate: measurements.filter(m => m.success).length / measurements.length
    };
  }

  // Private helper methods
  _scanInstalledFiles(targetDir) {
    const files = [];

    if (!fs.existsSync(targetDir)) {
      return files;
    }

    const scan = (dir, relative = '') => {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const relativePath = path.join(relative, item);

          if (fs.statSync(fullPath).isDirectory()) {
            scan(fullPath, relativePath);
          } else {
            files.push(relativePath);
          }
        }
      } catch (error) {
        // Ignore scan errors
      }
    };

    scan(targetDir);
    return files;
  }

  _classifyError(errorText) {
    if (errorText.includes('ENOENT')) return 'file_not_found';
    if (errorText.includes('EACCES')) return 'permission_denied';
    if (errorText.includes('ECONNREFUSED')) return 'connection_refused';
    if (errorText.includes('timeout')) return 'timeout';
    if (errorText.includes('rate limit')) return 'rate_limit';
    if (errorText.includes('invalid')) return 'validation_error';
    return 'unknown';
  }

  _buildArgsFromOptions(options, targetDir) {
    const args = ['--dir', targetDir];

    if (options.force) args.push('--force');
    if (options.verbose) args.push('--verbose');
    if (options.skipPythonCheck) args.push('--skip-python-check');
    if (options.version) args.push('--version', options.version);
    if (options.cache === false) args.push('--no-cache');

    return args;
  }

  _getPromptResponse(promptText, responses) {
    // Match against response patterns
    for (const [pattern, response] of Object.entries(responses)) {
      if (promptText.includes(pattern)) {
        return response;
      }
    }

    // Default responses for common prompts
    if (promptText.includes('continue') || promptText.includes('install')) {
      return 'y';
    }

    if (promptText.includes('overwrite')) {
      return 'n';
    }

    return '';
  }
}

/**
 * Mock CLI environment for testing
 */
class MockCLIEnvironment {
  constructor() {
    this.fileSystem = new Map();
    this.networkResponses = new Map();
    this.processExits = [];
    this.consoleOutput = [];
  }

  mockFileSystem(path, content) {
    this.fileSystem.set(path, content);
  }

  mockNetworkResponse(url, response) {
    this.networkResponses.set(url, response);
  }

  captureConsoleOutput() {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      this.consoleOutput.push({ type: 'log', args });
    };

    console.error = (...args) => {
      this.consoleOutput.push({ type: 'error', args });
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }

  getConsoleOutput() {
    return this.consoleOutput;
  }

  reset() {
    this.fileSystem.clear();
    this.networkResponses.clear();
    this.processExits = [];
    this.consoleOutput = [];
  }
}

module.exports = {
  CLITestRunner,
  MockCLIEnvironment
};
