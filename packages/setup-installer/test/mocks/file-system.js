/**
 * File System Mock Implementation
 * Provides comprehensive mocking for file system operations
 */

const mockFs = require('mock-fs');
const path = require('path');

class FileSystemMock {
  constructor() {
    this.mockConfig = {};
    this.isActive = false;
  }

  /**
   * Setup mock file system with default structure
   */
  setup(customConfig = {}) {
    this.mockConfig = {
      // System directories
      '/tmp': {},
      '/home/user': {},
      '/Users/user': {},
      'C:\\Users\\User': {},

      // Node.js related
      '/usr/bin/node': mockFs.file({
        mode: 0o755,
        content: '#!/usr/bin/env node'
      }),

      // Python installations (for dependency checking)
      '/usr/bin/python3': mockFs.file({
        mode: 0o755,
        content: '#!/usr/bin/env python3'
      }),

      '/usr/local/bin/uv': mockFs.file({
        mode: 0o755,
        content: '#!/usr/bin/env uv'
      }),

      // Mock existing project with some files
      '/existing/project': {
        'package.json': JSON.stringify({
          name: 'existing-project',
          version: '1.0.0'
        }),
        'README.md': '# Existing Project',
        '.git': {},
        '.claude': {
          'old-file.py': 'old content'
        }
      },

      // Empty target directory
      '/target/directory': {},

      // Directory with permission issues
      '/restricted': mockFs.directory({
        mode: 0o000,
        items: {}
      }),

      // npm configuration
      '/home/user/.npmrc': 'registry=https://registry.npmjs.org/',

      ...customConfig
    };

    mockFs(this.mockConfig);
    this.isActive = true;
  }

  /**
   * Add a file to the mock file system
   */
  addFile(filePath, content, options = {}) {
    if (!this.isActive) {
      throw new Error('Mock file system not active. Call setup() first.');
    }

    const config = { ...this.mockConfig };
    const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');

    // Handle nested paths
    const pathParts = normalizedPath.split('/').filter(Boolean);
    let current = config;

    // Create intermediate directories
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (i === 0 && normalizedPath.startsWith('/')) {
        current = config;
        continue;
      }

      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    // Add the file
    const fileName = pathParts[pathParts.length - 1];
    current[fileName] = mockFs.file({
      content: content,
      mode: options.mode || 0o644,
      ...options
    });

    // Update the mock
    this.mockConfig = config;
    mockFs(config);
  }

  /**
   * Add a directory to the mock file system
   */
  addDirectory(dirPath, options = {}) {
    if (!this.isActive) {
      throw new Error('Mock file system not active. Call setup() first.');
    }

    const config = { ...this.mockConfig };
    const normalizedPath = path.normalize(dirPath).replace(/\\/g, '/');

    const pathParts = normalizedPath.split('/').filter(Boolean);
    let current = config;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (i === 0 && normalizedPath.startsWith('/')) {
        current = config;
        continue;
      }

      if (!current[part]) {
        current[part] = mockFs.directory({
          mode: options.mode || 0o755,
          ...options
        });
      }
      current = current[part];
    }

    this.mockConfig = config;
    mockFs(config);
  }

  /**
   * Create a scenario where directory already exists with files
   */
  setupExistingClaudeDirectory(targetDir = '/target/directory') {
    this.addDirectory(`${targetDir}/.claude`);
    this.addFile(`${targetDir}/.claude/settings.json`, JSON.stringify({
      version: '0.9.0',
      server_url: 'http://localhost:3000'
    }));
    this.addFile(`${targetDir}/.claude/old-hook.py`, 'print("old hook")');
    this.addDirectory(`${targetDir}/.claude/agents`);
    this.addFile(`${targetDir}/.claude/agents/old-agent.py`, '# old agent');
  }

  /**
   * Create a scenario with permission denied errors
   */
  setupPermissionDeniedScenario(targetDir = '/restricted/project') {
    this.addDirectory('/restricted', { mode: 0o000 });
    this.addDirectory(targetDir, { mode: 0o000 });
  }

  /**
   * Create a scenario with limited disk space
   */
  setupLimitedSpaceScenario() {
    // Mock file system that will fail after certain size
    // This is handled by creating large dummy files to fill space
    const largeContent = 'x'.repeat(1024 * 1024); // 1MB
    for (let i = 0; i < 100; i++) {
      this.addFile(`/tmp/large-file-${i}.tmp`, largeContent);
    }
  }

  /**
   * Setup cross-platform path testing scenarios
   */
  setupCrossPlatformScenarios() {
    // Windows-style paths
    this.addDirectory('C:\\Program Files\\Node');
    this.addDirectory('C:\\Users\\User\\AppData\\Local');

    // Unix-style paths
    this.addDirectory('/usr/local/bin');
    this.addDirectory('/home/user/.local/bin');

    // macOS-style paths
    this.addDirectory('/Applications');
    this.addDirectory('/Users/user/Library');
  }

  /**
   * Mock binary file handling
   */
  setupBinaryFileScenario(targetDir = '/target/directory') {
    const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]);
    this.addFile(`${targetDir}/binary-file.bin`, binaryContent);

    // Large binary file
    const largeBinary = Buffer.alloc(1024 * 1024); // 1MB of zeros
    this.addFile(`${targetDir}/large-binary.bin`, largeBinary);
  }

  /**
   * Setup symbolic link scenarios
   */
  setupSymlinkScenarios() {
    this.addFile('/real/file.txt', 'real content');
    this.addFile('/link/to/file.txt', mockFs.symlink({
      path: '/real/file.txt'
    }));

    // Broken symlink
    this.addFile('/broken/link.txt', mockFs.symlink({
      path: '/nonexistent/file.txt'
    }));
  }

  /**
   * Mock network drive scenarios (Windows)
   */
  setupNetworkDriveScenario() {
    this.addDirectory('\\\\server\\share');
    this.addFile('\\\\server\\share\\file.txt', 'network file');
  }

  /**
   * Verify file operations
   */
  verifyFileExists(filePath) {
    const fs = require('fs');
    return fs.existsSync(filePath);
  }

  verifyFileContent(filePath, expectedContent) {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const actualContent = fs.readFileSync(filePath, 'utf8');
    if (actualContent !== expectedContent) {
      throw new Error(`Content mismatch in ${filePath}. Expected: ${expectedContent}, Actual: ${actualContent}`);
    }

    return true;
  }

  verifyDirectoryStructure(basePath, expectedStructure) {
    const fs = require('fs');
    const path = require('path');

    function checkStructure(currentPath, structure) {
      for (const [name, value] of Object.entries(structure)) {
        const fullPath = path.join(currentPath, name);

        if (typeof value === 'string') {
          // It's a file
          if (!fs.existsSync(fullPath)) {
            throw new Error(`Expected file missing: ${fullPath}`);
          }

          const content = fs.readFileSync(fullPath, 'utf8');
          if (content !== value) {
            throw new Error(`File content mismatch: ${fullPath}`);
          }
        } else if (typeof value === 'object') {
          // It's a directory
          if (!fs.existsSync(fullPath)) {
            throw new Error(`Expected directory missing: ${fullPath}`);
          }

          if (!fs.statSync(fullPath).isDirectory()) {
            throw new Error(`Expected directory, found file: ${fullPath}`);
          }

          checkStructure(fullPath, value);
        }
      }
    }

    checkStructure(basePath, expectedStructure);
    return true;
  }

  /**
   * Get mock file system stats
   */
  getStats() {
    // const fs = require('fs'); // Mock file system doesn't need direct fs access
    const totalFiles = this._countFiles(this.mockConfig);
    const totalSize = this._calculateSize(this.mockConfig);

    return {
      totalFiles,
      totalSize,
      isActive: this.isActive
    };
  }

  _countFiles(config, count = 0) {
    for (const value of Object.values(config)) {
      if (typeof value === 'string' || Buffer.isBuffer(value)) {
        count++;
      } else if (typeof value === 'object' && value !== null) {
        count = this._countFiles(value, count);
      }
    }
    return count;
  }

  _calculateSize(config, size = 0) {
    for (const value of Object.values(config)) {
      if (typeof value === 'string') {
        size += Buffer.byteLength(value, 'utf8');
      } else if (Buffer.isBuffer(value)) {
        size += value.length;
      } else if (typeof value === 'object' && value !== null) {
        size = this._calculateSize(value, size);
      }
    }
    return size;
  }

  /**
   * Clean up mock file system
   */
  cleanup() {
    if (this.isActive) {
      mockFs.restore();
      this.isActive = false;
      this.mockConfig = {};
    }
  }

  /**
   * Create a snapshot of current file system state
   */
  createSnapshot() {
    const fs = require('fs');
    const path = require('path');

    function walkDirectory(dirPath) {
      const result = {};
      try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            result[item] = walkDirectory(itemPath);
          } else {
            result[item] = fs.readFileSync(itemPath, 'utf8');
          }
        }
      } catch (error) {
        // Directory might not exist or have permission issues
      }
      return result;
    }

    return {
      '/target/directory': walkDirectory('/target/directory'),
      '/existing/project': walkDirectory('/existing/project'),
      timestamp: Date.now()
    };
  }
}

module.exports = FileSystemMock;
