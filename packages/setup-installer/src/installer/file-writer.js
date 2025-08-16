/**
 * File writer module for installing Claude setup files
 * Handles file writing, conflict resolution, backup, and rollback
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const {
  ValidationError,
  ErrorFactory
} = require('../utils/errors');
const platformUtils = require('../utils/platform');

/**
 * File Writer class implementing WriterAPI interface
 */
class FileWriter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      backupDir: options.backupDir || null, // null = same directory as original
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      batchSize: options.batchSize || 50,
      streaming: options.streaming || false,
      progressReporter: options.progressReporter || null,
      platformUtils: options.platformUtils || platformUtils,
      ...options
    };

    this.rollbackStack = [];
    this.activeOperations = new Map();
  }

  /**
   * Write a single file with options for backup, permissions, etc.
   * Implements WriterAPI.writeFile interface
   */
  async writeFile(filePath, content, options = {}) {
    const opts = { ...this.options, ...options };

    // Validate inputs
    this.validatePath(filePath, opts.targetDir);

    if (opts.dryRun) {
      return { path: filePath, dryRun: true, size: Buffer.byteLength(content) };
    }

    // Emit progress start
    if (opts.progressReporter) {
      opts.progressReporter.start('Writing file', 1);
    }

    try {
      const absolutePath = this.resolvePath(filePath, opts.targetDir);
      const dirPath = path.dirname(absolutePath);

      // Ensure directory exists
      await this.ensureDirectory(dirPath);

      // Check if file exists and handle backup
      let backupPath = null;
      const fileExists = await this.fileExists(absolutePath);

      if (fileExists && opts.backup) {
        backupPath = await this.backup(absolutePath);
        this.rollbackStack.push({ type: 'restore', backupPath, originalPath: absolutePath });
      } else if (fileExists && !opts.overwrite) {
        if (opts.progressReporter) {
          opts.progressReporter.complete('File skipped (already exists)');
        }
        return { path: filePath, skipped: true, reason: 'exists' };
      }

      // Write file atomically
      await this.writeFileAtomic(absolutePath, content, opts);

      // Track for potential rollback
      if (!fileExists) {
        this.rollbackStack.push({ type: 'delete', path: absolutePath });
      }

      if (opts.progressReporter) {
        opts.progressReporter.update(1, `Wrote ${path.basename(absolutePath)}`);
        opts.progressReporter.complete('File written successfully');
      }

      return {
        path: filePath,
        absolutePath,
        size: Buffer.byteLength(content),
        backup: backupPath
      };

    } catch (error) {
      if (opts.progressReporter) {
        opts.progressReporter.fail(error);
      }
      throw ErrorFactory.fromCaught(error, `writing file ${filePath}`);
    }
  }

  /**
   * Write multiple files to a directory
   * Implements WriterAPI.writeDirectory interface
   */
  async writeDirectory(files, options = {}) {
    const opts = { ...this.options, ...options };
    const targetDir = opts.targetDir;

    if (!targetDir) {
      throw new ValidationError('targetDir is required for writeDirectory', 'targetDir');
    }

    // Validate files array
    if (!Array.isArray(files)) {
      throw new ValidationError('files must be an array', 'files');
    }

    const result = {
      written: [],
      skipped: [],
      backed_up: new Map(),
      errors: [],
      directoriesCreated: []
    };

    // Emit progress start
    if (opts.progressReporter) {
      opts.progressReporter.start('Writing files', files.length);
    }

    // Pre-flight validation
    if (opts.atomic) {
      this.createCheckpoint();
    }

    try {
      // Process files in batches to manage memory
      const batchSize = opts.batchSize || 50;

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        if (opts.atomic) {
          // For atomic operations, process sequentially
          for (const file of batch) {
            await this.processFileForDirectory(file, targetDir, opts, result, i + batch.indexOf(file) + 1);
          }
        } else {
          // For non-atomic, can process in parallel
          await Promise.all(
            batch.map((file, idx) =>
              this.processFileForDirectory(file, targetDir, opts, result, i + idx + 1)
                .catch(error => {
                  result.errors.push({ path: file.path, error });
                })
            )
          );
        }
      }

      if (opts.progressReporter) {
        opts.progressReporter.complete(`Wrote ${result.written.length} files successfully`);
      }

      // Log installation summary for debugging
      this.emit('installationSummary', {
        filesWritten: result.written.length,
        filesSkipped: result.skipped.length,
        directoriesCreated: result.directoriesCreated.length,
        errors: result.errors.length
      });

      return result;

    } catch (error) {
      if (opts.atomic) {
        // Rollback all changes
        await this.rollbackToCheckpoint();
      }

      if (opts.progressReporter) {
        opts.progressReporter.fail(error);
      }

      throw ErrorFactory.fromCaught(error, 'writing directory');
    }
  }

  /**
   * Create a backup of a file or directory
   * Implements WriterAPI.backup interface
   */
  async backup(sourcePath, options = {}) {
    const opts = { ...this.options, ...options };

    try {
      const absoluteSource = this.resolvePath(sourcePath);

      // Check if source exists
      const stats = await fs.stat(absoluteSource);

      // Generate backup path with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sourceName = path.basename(absoluteSource);
      const backupName = `${sourceName}.backup.${timestamp}`;

      const backupDir = opts.backupDir || path.dirname(absoluteSource);
      const backupPath = path.join(backupDir, backupName);

      // Ensure backup directory exists
      await this.ensureDirectory(path.dirname(backupPath));

      if (stats.isDirectory()) {
        // Recursive directory copy
        await this.copyDirectory(absoluteSource, backupPath);
      } else {
        // File copy with permission preservation
        await fs.copyFile(absoluteSource, backupPath);
        await fs.chmod(backupPath, stats.mode);
      }

      return backupPath;

    } catch (error) {
      throw ErrorFactory.fromCaught(error, `backing up ${sourcePath}`);
    }
  }

  /**
   * Restore from backup
   * Implements WriterAPI.rollback interface
   */
  async rollback(backupPath, _options = {}) {
    try {
      const absoluteBackup = this.resolvePath(backupPath);

      // Extract original path from backup name
      const backupName = path.basename(absoluteBackup);
      const match = backupName.match(/(.+)\.backup\.([\d-T]+.*?)$/);

      if (!match) {
        throw new ValidationError('Invalid backup file name format', 'backupPath');
      }

      const originalName = match[1];
      const originalPath = path.join(path.dirname(absoluteBackup), originalName);

      const backupStats = await fs.stat(absoluteBackup);

      if (backupStats.isDirectory()) {
        // Remove current directory and restore backup
        try {
          await fs.rm(originalPath, { recursive: true, force: true });
        } catch (error) {
          // Directory might not exist, which is OK
        }
        await this.copyDirectory(absoluteBackup, originalPath);
      } else {
        // Restore file
        await fs.copyFile(absoluteBackup, originalPath);
        await fs.chmod(originalPath, backupStats.mode);
      }

      // Clean up backup file
      await fs.rm(absoluteBackup, { recursive: true, force: true });

      return originalPath;

    } catch (error) {
      throw ErrorFactory.fromCaught(error, `rolling back from ${backupPath}`);
    }
  }

  /**
   * Validate target directory and permissions
   */
  async validateTarget(targetDir) {
    try {
      const absoluteTarget = this.resolvePath(targetDir);

      // Check if target exists
      const exists = await this.fileExists(absoluteTarget);

      if (exists) {
        const stats = await fs.stat(absoluteTarget);
        if (!stats.isDirectory()) {
          return false; // Target exists but is not a directory
        }
      }

      // Test write permissions
      return await this.options.platformUtils.isWritable(absoluteTarget);

    } catch (error) {
      return false;
    }
  }

  /**
   * Validate that installation was complete by checking expected structure
   */
  async validateInstallationCompleteness(targetDir, expectedFiles = []) {
    const issues = [];

    // Check for essential .claude structure
    const essentialPaths = [
      '.claude',
      '.claude/settings.json',
      '.claude/hooks',
      '.claude/hooks/comms',
      '.claude/agents',
      '.claude/agents/core'
    ];

    for (const relativePath of essentialPaths) {
      const fullPath = path.join(targetDir, relativePath);
      const exists = await this.fileExists(fullPath);
      if (!exists) {
        issues.push({
          type: 'missing_essential',
          path: relativePath,
          message: `Essential path missing: ${relativePath}`
        });
      }
    }

    // Check expected files if provided
    for (const expectedFile of expectedFiles) {
      const fullPath = path.join(targetDir, expectedFile);
      const exists = await this.fileExists(fullPath);
      if (!exists) {
        issues.push({
          type: 'missing_expected',
          path: expectedFile,
          message: `Expected file missing: ${expectedFile}`
        });
      }
    }

    return {
      complete: issues.length === 0,
      issues
    };
  }

  /**
   * Check available disk space
   */
  async checkDiskSpace(targetDir, requiredBytes) {
    try {
      const spaceInfo = await this.options.platformUtils.getDiskSpace(targetDir);
      if (!spaceInfo) {
        return true; // Can't determine, assume OK
      }

      return spaceInfo.free >= requiredBytes;

    } catch (error) {
      return true; // Can't determine, assume OK
    }
  }

  /**
   * Validate file path for security
   */
  validatePath(filePath, basePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new ValidationError('File path must be a non-empty string', 'filePath');
    }

    if (basePath && !this.options.platformUtils.isSafePath(filePath, basePath)) {
      throw new ValidationError('File path escapes target directory', 'filePath');
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /\.\.[\\/]/, // Directory traversal
      /^[\\/]/, // Absolute paths when basePath is provided
      /[<>:"|*?]/ // Invalid filename characters on Windows
    ];

    if (basePath) {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(filePath)) {
          throw new ValidationError('File path contains invalid characters', 'filePath');
        }
      }
    }
  }

  // PRIVATE HELPER METHODS

  async processFileForDirectory(file, targetDir, opts, result, currentIndex) {
    try {
      const fileOptions = {
        ...opts,
        targetDir,
        permissions: file.permissions,
        encoding: file.encoding
      };

      // Track directory creation for reporting
      const dirPath = path.dirname(path.join(targetDir, file.path));
      if (!result.directoriesCreated.includes(dirPath)) {
        result.directoriesCreated.push(dirPath);
      }

      const writeResult = await this.writeFile(file.path, file.content, fileOptions);

      if (writeResult.skipped) {
        result.skipped.push(file.path);
      } else {
        result.written.push(file.path);
        if (writeResult.backup) {
          result.backed_up.set(writeResult.absolutePath, writeResult.backup);
        }
      }

      if (opts.progressReporter) {
        opts.progressReporter.update(currentIndex, `Processed ${file.path}`);
      }

    } catch (error) {
      result.errors.push({ path: file.path, error });

      if (opts.atomic) {
        throw error; // Stop processing in atomic mode
      }
    }
  }

  async writeFileAtomic(filePath, content, options) {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;

    try {
      // Write to temporary file first
      if (options.encoding === 'binary' || Buffer.isBuffer(content)) {
        await fs.writeFile(tempPath, content);
      } else {
        const processedContent = options.normalizeLineEndings
          ? this.options.platformUtils.convertFileContent(content)
          : content;
        await fs.writeFile(tempPath, processedContent, 'utf8');
      }

      // Set permissions if specified
      if (options.permissions) {
        await fs.chmod(tempPath, options.permissions);
      }

      // Atomic rename
      await fs.rename(tempPath, filePath);

    } catch (error) {
      // Clean up temp file on failure
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return dirPath;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      return dirPath;
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  resolvePath(filePath, basePath = null) {
    if (basePath) {
      return this.options.platformUtils.getAbsolutePath(filePath, basePath);
    }
    return this.options.platformUtils.getAbsolutePath(filePath);
  }

  async copyDirectory(src, dest) {
    await this.ensureDirectory(dest);
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
        const stats = await fs.stat(srcPath);
        await fs.chmod(destPath, stats.mode);
      }
    }
  }

  createCheckpoint() {
    this.rollbackStack = [];
  }

  async rollbackToCheckpoint() {
    // Rollback in reverse order
    for (let i = this.rollbackStack.length - 1; i >= 0; i--) {
      const operation = this.rollbackStack[i];

      try {
        if (operation.type === 'delete') {
          await fs.unlink(operation.path);
        } else if (operation.type === 'restore') {
          await this.rollback(operation.backupPath);
        }
      } catch (error) {
        // Log but continue rollback
        console.warn(`Rollback operation failed: ${error.message}`);
      }
    }

    this.rollbackStack = [];
  }

  async createRollbackPoint(targetDir) {
    const timestamp = Date.now();
    const rollbackId = `rollback-${timestamp}`;

    // Create snapshot of current state
    const snapshot = {
      id: rollbackId,
      timestamp,
      targetDir,
      files: await this.snapshotDirectory(targetDir)
    };

    return snapshot;
  }

  async rollbackToPoint(rollbackInfo) {
    // Restore directory to snapshot state
    await this.restoreFromSnapshot(rollbackInfo);
  }

  async snapshotDirectory(dirPath) {
    const snapshot = new Map();

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          const content = await fs.readFile(fullPath);
          const stats = await fs.stat(fullPath);
          snapshot.set(fullPath, { content, mode: stats.mode, type: 'file' });
        } else if (entry.isDirectory()) {
          snapshot.set(fullPath, { type: 'directory' });
          const subSnapshot = await this.snapshotDirectory(fullPath);
          for (const [subPath, subData] of subSnapshot) {
            snapshot.set(subPath, subData);
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    return snapshot;
  }

  async restoreFromSnapshot(rollbackInfo) {
    const { targetDir, files } = rollbackInfo;

    // Remove all current files
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }

    // Restore from snapshot
    for (const [filePath, fileData] of files) {
      if (fileData.type === 'directory') {
        await this.ensureDirectory(filePath);
      } else if (fileData.type === 'file') {
        await this.ensureDirectory(path.dirname(filePath));
        await fs.writeFile(filePath, fileData.content);
        await fs.chmod(filePath, fileData.mode);
      }
    }
  }
}

// Legacy function exports for backward compatibility
async function writeSetupFiles(setupFiles, targetDir, options = {}) {
  const writer = new FileWriter(options);
  const files = setupFiles.map(file => ({
    path: file.path || file.name,
    content: file.content,
    encoding: file.encoding,
    permissions: file.permissions
  }));

  return writer.writeDirectory(files, { targetDir, ...options });
}

async function backupExistingFiles(targetDir, files) {
  const writer = new FileWriter();
  const backups = new Map();

  for (const file of files) {
    const filePath = path.join(targetDir, file.path || file.name);
    try {
      if (await writer.fileExists(filePath)) {
        const backupPath = await writer.backup(filePath);
        backups.set(filePath, backupPath);
      }
    } catch (error) {
      // Continue with other files
    }
  }

  return backups;
}

module.exports = {
  FileWriter,
  writeSetupFiles,
  backupExistingFiles
};
