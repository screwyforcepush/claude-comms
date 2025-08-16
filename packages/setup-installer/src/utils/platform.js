/**
 * Platform detection and cross-platform utilities
 * Handles OS detection, path normalization, and platform-specific operations
 */

const path = require('path');
const os = require('os');
const fs = require('fs').promises;

/**
 * Platform information and utilities
 */
class Platform {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.release = os.release();
    this.homedir = os.homedir();
    this.tmpdir = os.tmpdir();
  }

  /**
   * Check if running on Windows
   */
  isWindows() {
    return this.platform === 'win32';
  }

  /**
   * Check if running on macOS
   */
  isMacOS() {
    return this.platform === 'darwin';
  }

  /**
   * Check if running on Linux
   */
  isLinux() {
    return this.platform === 'linux';
  }

  /**
   * Check if running on Unix-like system (Linux or macOS)
   */
  isUnix() {
    return this.isLinux() || this.isMacOS();
  }

  /**
   * Get platform-specific line ending
   */
  getLineEnding() {
    return this.isWindows() ? '\r\n' : '\n';
  }

  /**
   * Get platform-specific path separator
   */
  getPathSeparator() {
    return path.sep;
  }

  /**
   * Normalize path for current platform
   */
  normalizePath(inputPath) {
    if (!inputPath) return inputPath;
    return path.normalize(inputPath);
  }

  /**
   * Resolve path relative to home directory
   */
  resolveHome(inputPath) {
    if (!inputPath) return inputPath;
    if (inputPath.startsWith('~/') || inputPath === '~') {
      return path.join(this.homedir, inputPath.slice(2));
    }
    return inputPath;
  }

  /**
   * Get absolute path, resolving ~ and relative paths
   */
  getAbsolutePath(inputPath, relativeTo = process.cwd()) {
    if (!inputPath) return relativeTo;

    // Resolve home directory
    let resolved = this.resolveHome(inputPath);

    // Make absolute if relative
    if (!path.isAbsolute(resolved)) {
      resolved = path.resolve(relativeTo, resolved);
    }

    return this.normalizePath(resolved);
  }

  /**
   * Check if path is safe (prevent directory traversal)
   */
  isSafePath(inputPath, basePath) {
    try {
      const absolute = this.getAbsolutePath(inputPath);
      const baseAbsolute = this.getAbsolutePath(basePath);
      const relative = path.relative(baseAbsolute, absolute);

      // Check if path escapes base directory
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    } catch {
      return false;
    }
  }

  /**
   * Get user's shell information
   */
  getShellInfo() {
    const shell = process.env.SHELL || (this.isWindows() ? 'cmd' : 'bash');
    const shellName = path.basename(shell);

    return {
      path: shell,
      name: shellName,
      isInteractive: !!process.stdout.isTTY
    };
  }

  /**
   * Check if running in CI environment
   */
  isCI() {
    return !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.BUILD_NUMBER ||
      process.env.GITHUB_ACTIONS ||
      process.env.TRAVIS ||
      process.env.CIRCLECI
    );
  }

  /**
   * Get available disk space for a path
   */
  async getDiskSpace(targetPath) {
    try {
      const stats = await fs.statfs ? fs.statfs(targetPath) : null;
      if (stats) {
        return {
          free: stats.bavail * stats.bsize,
          total: stats.blocks * stats.bsize
        };
      }
    } catch (error) {
      // Fallback: return null if can't determine
    }
    return null;
  }

  /**
   * Check if directory is writable
   */
  async isWritable(dirPath) {
    try {
      const testFile = path.join(dirPath, '.write-test-' + Date.now());
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get platform-specific configuration directory
   */
  getConfigDir(appName = 'claude-code') {
    if (this.isWindows()) {
      return path.join(process.env.APPDATA || this.homedir, appName);
    } else if (this.isMacOS()) {
      return path.join(this.homedir, 'Library', 'Application Support', appName);
    } else {
      return path.join(process.env.XDG_CONFIG_HOME || path.join(this.homedir, '.config'), appName);
    }
  }

  /**
   * Get platform-specific cache directory
   */
  getCacheDir(appName = 'claude-code') {
    if (this.isWindows()) {
      return path.join(process.env.LOCALAPPDATA || this.tmpdir, appName);
    } else if (this.isMacOS()) {
      return path.join(this.homedir, 'Library', 'Caches', appName);
    } else {
      return path.join(process.env.XDG_CACHE_HOME || path.join(this.homedir, '.cache'), appName);
    }
  }

  /**
   * Get platform-specific executable extension
   */
  getExecutableExtension() {
    return this.isWindows() ? '.exe' : '';
  }

  /**
   * Find executable in PATH
   */
  async findExecutable(name) {
    const extension = this.getExecutableExtension();
    const execName = name + extension;

    // Check current directory first
    try {
      const localPath = path.join(process.cwd(), execName);
      await fs.access(localPath, fs.constants.F_OK | fs.constants.X_OK);
      return localPath;
    } catch {
      // Continue to PATH search
    }

    // Search in PATH
    const pathEnv = process.env.PATH || '';
    const pathDirs = pathEnv.split(path.delimiter);

    for (const dir of pathDirs) {
      if (!dir) continue;

      try {
        const execPath = path.join(dir, execName);
        await fs.access(execPath, fs.constants.F_OK | fs.constants.X_OK);
        return execPath;
      } catch {
        // Continue searching
      }
    }

    return null;
  }

  /**
   * Check if a command is available
   */
  async hasCommand(command) {
    return (await this.findExecutable(command)) !== null;
  }

  /**
   * Get environment variable with platform-specific defaults
   */
  getEnvVar(name, defaultValue = null, options = {}) {
    const value = process.env[name];

    if (value !== undefined) {
      if (options.type === 'boolean') {
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
      }
      if (options.type === 'number') {
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
      }
      if (options.type === 'array') {
        const separator = options.separator || (this.isWindows() ? ';' : ':');
        return value.split(separator).filter(Boolean);
      }
      return value;
    }

    return defaultValue;
  }

  /**
   * Get platform-specific temp file path
   */
  getTempFilePath(prefix = 'claude-installer', extension = '') {
    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
    return path.join(this.tmpdir, filename);
  }

  /**
   * Convert file content for platform (handle line endings)
   */
  convertFileContent(content, targetPlatform = null) {
    const target = targetPlatform || this.platform;
    const targetEnding = target === 'win32' ? '\r\n' : '\n';

    // Normalize all line endings to \n first, then convert to target
    return content.replace(/\r\n|\r|\n/g, '\n').replace(/\n/g, targetEnding);
  }

  /**
   * Get platform summary for debugging
   */
  getSummary() {
    return {
      platform: this.platform,
      arch: this.arch,
      release: this.release,
      nodeVersion: process.version,
      isCI: this.isCI(),
      shell: this.getShellInfo(),
      homedir: this.homedir,
      configDir: this.getConfigDir(),
      cacheDir: this.getCacheDir()
    };
  }
}

/**
 * Singleton platform instance
 */
const platform = new Platform();

/**
 * Utility functions using the singleton
 */
const platformUtils = {
  // Platform checks
  isWindows: () => platform.isWindows(),
  isMacOS: () => platform.isMacOS(),
  isLinux: () => platform.isLinux(),
  isUnix: () => platform.isUnix(),
  isCI: () => platform.isCI(),

  // Path utilities
  normalizePath: (path) => platform.normalizePath(path),
  resolveHome: (path) => platform.resolveHome(path),
  getAbsolutePath: (path, relativeTo) => platform.getAbsolutePath(path, relativeTo),
  isSafePath: (path, basePath) => platform.isSafePath(path, basePath),

  // System utilities
  getShellInfo: () => platform.getShellInfo(),
  getDiskSpace: (path) => platform.getDiskSpace(path),
  isWritable: (path) => platform.isWritable(path),

  // Executable utilities
  findExecutable: (name) => platform.findExecutable(name),
  hasCommand: (command) => platform.hasCommand(command),

  // Directory utilities
  getConfigDir: (appName) => platform.getConfigDir(appName),
  getCacheDir: (appName) => platform.getCacheDir(appName),
  getTempFilePath: (prefix, extension) => platform.getTempFilePath(prefix, extension),

  // Environment utilities
  getEnvVar: (name, defaultValue, options) => platform.getEnvVar(name, defaultValue, options),

  // Content utilities
  getLineEnding: () => platform.getLineEnding(),
  convertFileContent: (content, targetPlatform) => platform.convertFileContent(content, targetPlatform),

  // Debug utilities
  getSummary: () => platform.getSummary(),

  // Access to Platform class
  Platform
};

module.exports = platformUtils;
