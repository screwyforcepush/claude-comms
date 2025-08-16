/**
 * File Writer Unit Tests
 * Tests for atomic file operations, backup, and rollback functionality
 */

const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const FileSystemMock = require('../../mocks/file-system');
const {
  FileSystemError,
  ValidationError
  // ErrorFactory // TODO: Use ErrorFactory in tests
} = require('../../../src/utils/errors');

// Import the file writer module
const { FileWriter } = require('../../../src/installer/file-writer');

describe('FileWriter', () => {
  let fileSystemMock;
  let fileWriter;
  let mockProgressReporter;

  beforeEach(() => {
    fileSystemMock = new FileSystemMock();
    fileSystemMock.setup();

    // Mock progress reporter
    mockProgressReporter = new EventEmitter();
    mockProgressReporter.start = jest.fn();
    mockProgressReporter.update = jest.fn();
    mockProgressReporter.complete = jest.fn();
    mockProgressReporter.fail = jest.fn();

    fileWriter = new FileWriter({ progressReporter: mockProgressReporter });
  });

  afterEach(() => {
    fileSystemMock.cleanup();
  });

  describe('constructor', () => {
    it('should create FileWriter instance with default options', () => {
      const writer = new FileWriter();
      expect(writer).toBeInstanceOf(FileWriter);
      expect(writer.options).toBeDefined();
    });

    it('should create FileWriter instance with custom options', () => {
      const options = {
        progressReporter: mockProgressReporter,
        backupDir: '/custom/backup',
        maxRetries: 5
      };
      const writer = new FileWriter(options);
      expect(writer.options.backupDir).toBe('/custom/backup');
      expect(writer.options.maxRetries).toBe(5);
    });
  });

  describe('writeFile', () => {
    const targetPath = '/target/directory/test-file.txt';
    const content = 'test file content';

    it('should write file to target path', async () => {
      await fileWriter.writeFile(targetPath, content);

      const actualContent = await fs.readFile(targetPath, 'utf8');
      expect(actualContent).toBe(content);
    });

    it('should create intermediate directories if they do not exist', async () => {
      const nestedPath = '/target/directory/nested/deep/file.txt';

      await fileWriter.writeFile(nestedPath, content);

      const actualContent = await fs.readFile(nestedPath, 'utf8');
      expect(actualContent).toBe(content);
    });

    it('should preserve file permissions when specified', async () => {
      const options = { permissions: 0o755 };

      await fileWriter.writeFile(targetPath, '#!/bin/bash\necho "test"', options);

      const stats = await fs.stat(targetPath);
      expect(stats.mode & 0o777).toBe(0o755);
    });

    it('should handle binary content correctly', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
      const options = { encoding: 'binary' };

      await fileWriter.writeFile(targetPath, binaryContent, options);

      const actualContent = await fs.readFile(targetPath);
      expect(actualContent).toEqual(binaryContent);
    });

    it('should create backup when overwriting existing file', async () => {
      // Create existing file
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, 'original content');

      const options = { backup: true };
      await fileWriter.writeFile(targetPath, content, options);

      // Check new content
      const newContent = await fs.readFile(targetPath, 'utf8');
      expect(newContent).toBe(content);

      // Check backup exists
      const backupFiles = await fs.readdir(path.dirname(targetPath));
      const backupFile = backupFiles.find(file => file.includes('test-file.txt.backup'));
      expect(backupFile).toBeDefined();

      const backupPath = path.join(path.dirname(targetPath), backupFile);
      const backupContent = await fs.readFile(backupPath, 'utf8');
      expect(backupContent).toBe('original content');
    });

    it('should handle dry-run mode without writing files', async () => {
      const options = { dryRun: true };

      const result = await fileWriter.writeFile(targetPath, content, options);

      expect(result).toBeDefined();
      expect(result.dryRun).toBe(true);

      // File should not exist
      await expect(fs.access(targetPath)).rejects.toThrow();
    });

    it('should throw ValidationError for invalid file path', async () => {
      const invalidPath = '';

      await expect(fileWriter.writeFile(invalidPath, content))
        .rejects.toThrow(ValidationError);
    });

    it('should throw FileSystemError when permission denied', async () => {
      fileSystemMock.setupPermissionDeniedScenario();
      const restrictedPath = '/restricted/project/file.txt';

      await expect(fileWriter.writeFile(restrictedPath, content))
        .rejects.toThrow(FileSystemError);
    });

    it('should emit progress events during file writing', async () => {
      await fileWriter.writeFile(targetPath, content);

      expect(mockProgressReporter.start).toHaveBeenCalledWith('Writing file');
      expect(mockProgressReporter.complete).toHaveBeenCalled();
    });
  });

  describe('writeDirectory', () => {
    const files = [
      { path: 'file1.txt', content: 'content 1' },
      { path: 'subdir/file2.js', content: 'console.log("test");' },
      { path: 'binary.bin', content: Buffer.from([0x00, 0xFF]), encoding: 'binary' }
    ];
    const targetDir = '/target/directory';

    it('should write multiple files to target directory', async () => {
      const result = await fileWriter.writeDirectory(files, { targetDir });

      expect(result.written).toHaveLength(3);
      expect(result.errors).toHaveLength(0);

      // Verify files were written
      for (const file of files) {
        const filePath = path.join(targetDir, file.path);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    it('should create nested directory structure', async () => {
      const nestedFiles = [
        { path: 'level1/level2/level3/deep-file.txt', content: 'deep content' },
        { path: 'level1/sibling.txt', content: 'sibling content' }
      ];

      const result = await fileWriter.writeDirectory(nestedFiles, { targetDir });

      expect(result.written).toHaveLength(2);

      const deepFile = path.join(targetDir, 'level1/level2/level3/deep-file.txt');
      const content = await fs.readFile(deepFile, 'utf8');
      expect(content).toBe('deep content');
    });

    it('should backup existing files when overwrite is enabled', async () => {
      // Setup existing files
      fileSystemMock.setupExistingClaudeDirectory(targetDir);

      const claudeFiles = [
        { path: '.claude/settings.json', content: '{"new": "config"}' },
        { path: '.claude/new-file.py', content: 'print("new")' }
      ];

      const options = { targetDir, overwrite: true, backup: true };
      const result = await fileWriter.writeDirectory(claudeFiles, options);

      expect(result.written).toHaveLength(2);
      expect(result.backed_up.size).toBeGreaterThan(0);

      // Verify backups were created
      for (const [, backup] of result.backed_up) {
        const backupExists = await fs.access(backup).then(() => true).catch(() => false);
        expect(backupExists).toBe(true);
      }
    });

    it('should skip files that already exist when overwrite is false', async () => {
      // Create existing file
      const existingFile = path.join(targetDir, 'existing.txt');
      await fs.mkdir(path.dirname(existingFile), { recursive: true });
      await fs.writeFile(existingFile, 'original');

      const filesWithConflict = [
        { path: 'existing.txt', content: 'new content' },
        { path: 'new-file.txt', content: 'new file' }
      ];

      const options = { targetDir, overwrite: false };
      const result = await fileWriter.writeDirectory(filesWithConflict, options);

      expect(result.written).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toBe('existing.txt');

      // Original file should be unchanged
      const content = await fs.readFile(existingFile, 'utf8');
      expect(content).toBe('original');
    });

    it('should handle partial failure and collect errors', async () => {
      fileSystemMock.setupPermissionDeniedScenario();

      const filesWithErrors = [
        { path: 'good-file.txt', content: 'good content' },
        { path: '../../../restricted/bad-file.txt', content: 'bad path' }
      ];

      const result = await fileWriter.writeDirectory(filesWithErrors, { targetDir });

      expect(result.written.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);

      const error = result.errors[0];
      expect(error.path).toContain('bad-file.txt');
      expect(error.error).toBeInstanceOf(Error);
    });

    it('should support atomic operations with rollback on failure', async () => {
      const largeFileSet = Array.from({ length: 10 }, (_, i) => ({
        path: `file-${i}.txt`,
        content: `content ${i}`
      }));

      // Mock a failure on the 8th file
      const originalWriteFile = fileWriter.writeFile;
      fileWriter.writeFile = jest.fn().mockImplementation((filePath, content, options) => {
        if (filePath.includes('file-7.txt')) {
          throw new FileSystemError('Simulated failure', { code: 'ENOSPC' });
        }
        return originalWriteFile.call(fileWriter, filePath, content, options);
      });

      const options = { targetDir, atomic: true };

      await expect(fileWriter.writeDirectory(largeFileSet, options))
        .rejects.toThrow(FileSystemError);

      // All files should be rolled back
      for (let i = 0; i < 7; i++) {
        const filePath = path.join(targetDir, `file-${i}.txt`);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(false);
      }
    });

    it('should emit progress events during batch operations', async () => {
      await fileWriter.writeDirectory(files, { targetDir });

      expect(mockProgressReporter.start).toHaveBeenCalledWith('Writing files', files.length);
      expect(mockProgressReporter.update).toHaveBeenCalledTimes(files.length);
      expect(mockProgressReporter.complete).toHaveBeenCalled();
    });
  });

  describe('backup', () => {
    const sourcePath = '/target/directory/important-file.txt';
    const sourceContent = 'important content';

    beforeEach(async () => {
      await fs.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.writeFile(sourcePath, sourceContent);
    });

    it('should create backup with timestamp', async () => {
      const backupPath = await fileWriter.backup(sourcePath);

      expect(backupPath).toMatch(/important-file\.txt\.backup\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);

      const backupContent = await fs.readFile(backupPath, 'utf8');
      expect(backupContent).toBe(sourceContent);
    });

    it('should preserve file permissions in backup', async () => {
      await fs.chmod(sourcePath, 0o755);

      const backupPath = await fileWriter.backup(sourcePath);

      const sourceStats = await fs.stat(sourcePath);
      const backupStats = await fs.stat(backupPath);
      expect(backupStats.mode).toBe(sourceStats.mode);
    });

    it('should handle binary files correctly', async () => {
      const binaryPath = '/target/directory/binary.bin';
      const binaryContent = Buffer.from([0x00, 0x01, 0xFF, 0xFE]);
      await fs.writeFile(binaryPath, binaryContent);

      const backupPath = await fileWriter.backup(binaryPath);

      const backupContent = await fs.readFile(backupPath);
      expect(backupContent).toEqual(binaryContent);
    });

    it('should throw error when backing up non-existent file', async () => {
      const nonExistentPath = '/target/directory/does-not-exist.txt';

      await expect(fileWriter.backup(nonExistentPath))
        .rejects.toThrow(FileSystemError);
    });

    it('should use custom backup directory when specified', async () => {
      const customBackupDir = '/custom/backup/location';
      fileSystemMock.addDirectory(customBackupDir);

      const options = { backupDir: customBackupDir };
      const backupPath = await fileWriter.backup(sourcePath, options);

      expect(backupPath).toMatch(new RegExp(`^${customBackupDir.replace('/', '\\/')}`));
    });
  });

  describe('rollback', () => {
    const originalPath = '/target/directory/rollback-test.txt';
    const originalContent = 'original content';
    const modifiedContent = 'modified content';

    it('should restore file from backup', async () => {
      // Create original file and backup
      await fs.mkdir(path.dirname(originalPath), { recursive: true });
      await fs.writeFile(originalPath, originalContent);
      const backupPath = await fileWriter.backup(originalPath);

      // Modify original file
      await fs.writeFile(originalPath, modifiedContent);

      // Rollback
      await fileWriter.rollback(backupPath);

      // Verify rollback
      const restoredContent = await fs.readFile(originalPath, 'utf8');
      expect(restoredContent).toBe(originalContent);
    });

    it('should restore file permissions during rollback', async () => {
      await fs.mkdir(path.dirname(originalPath), { recursive: true });
      await fs.writeFile(originalPath, originalContent);
      await fs.chmod(originalPath, 0o755);

      const backupPath = await fileWriter.backup(originalPath);

      // Change permissions
      await fs.chmod(originalPath, 0o644);

      // Rollback
      await fileWriter.rollback(backupPath);

      // Verify permissions restored
      const stats = await fs.stat(originalPath);
      expect(stats.mode & 0o777).toBe(0o755);
    });

    it('should handle directory rollback', async () => {
      const dirPath = '/target/directory/test-dir';
      const filePath = path.join(dirPath, 'file.txt');

      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(filePath, 'directory content');

      const backupPath = await fileWriter.backup(dirPath);

      // Remove directory
      await fs.rm(dirPath, { recursive: true });

      // Rollback
      await fileWriter.rollback(backupPath);

      // Verify directory restored
      const restoredContent = await fs.readFile(filePath, 'utf8');
      expect(restoredContent).toBe('directory content');
    });

    it('should throw error when rolling back non-existent backup', async () => {
      const nonExistentBackup = '/backup/does-not-exist.backup';

      await expect(fileWriter.rollback(nonExistentBackup))
        .rejects.toThrow(FileSystemError);
    });

    it('should clean up backup file after successful rollback', async () => {
      await fs.mkdir(path.dirname(originalPath), { recursive: true });
      await fs.writeFile(originalPath, originalContent);
      const backupPath = await fileWriter.backup(originalPath);

      await fs.writeFile(originalPath, modifiedContent);
      await fileWriter.rollback(backupPath);

      // Backup should be cleaned up
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle extremely long file paths', async () => {
      const longPath = '/target/directory/' + 'very-long-name-'.repeat(20) + 'file.txt';
      const content = 'long path content';

      await fileWriter.writeFile(longPath, content);

      const actualContent = await fs.readFile(longPath, 'utf8');
      expect(actualContent).toBe(content);
    });

    it('should handle files with special characters in names', async () => {
      const specialPath = '/target/directory/file with spaces & symbols (1).txt';
      const content = 'special characters content';

      await fileWriter.writeFile(specialPath, content);

      const actualContent = await fs.readFile(specialPath, 'utf8');
      expect(actualContent).toBe(content);
    });

    it('should handle very large files efficiently', async () => {
      const largePath = '/target/directory/large-file.txt';
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB

      const startTime = Date.now();
      await fileWriter.writeFile(largePath, largeContent);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);

      const stats = await fs.stat(largePath);
      expect(stats.size).toBe(largeContent.length);
    });

    it('should handle concurrent file operations safely', async () => {
      const files = Array.from({ length: 10 }, (_, i) => ({
        path: `concurrent-file-${i}.txt`,
        content: `content ${i}`
      }));

      const promises = files.map(file =>
        fileWriter.writeFile(
          path.join('/target/directory', file.path),
          file.content
        )
      );

      await Promise.all(promises);

      // All files should be written successfully
      for (const file of files) {
        const filePath = path.join('/target/directory', file.path);
        const content = await fs.readFile(filePath, 'utf8');
        expect(content).toBe(file.content);
      }
    });

    it('should detect and handle symbolic links', async () => {
      fileSystemMock.setupSymlinkScenarios();

      const symlinkPath = '/link/to/file.txt';
      const newContent = 'new content via symlink';

      // Should follow symlink and update target
      await fileWriter.writeFile(symlinkPath, newContent);

      const realContent = await fs.readFile('/real/file.txt', 'utf8');
      expect(realContent).toBe(newContent);
    });
  });

  describe('pre-flight validation', () => {
    it('should validate target directory permissions', async () => {
      const targetDir = '/target/directory';

      const isValid = await fileWriter.validateTarget(targetDir);
      expect(isValid).toBe(true);
    });

    it('should detect insufficient permissions', async () => {
      fileSystemMock.setupPermissionDeniedScenario();
      const restrictedDir = '/restricted/project';

      const isValid = await fileWriter.validateTarget(restrictedDir);
      expect(isValid).toBe(false);
    });

    it('should check available disk space', async () => {
      const targetDir = '/target/directory';
      const requiredSpace = 1024 * 1024; // 1MB

      const hasSpace = await fileWriter.checkDiskSpace(targetDir, requiredSpace);
      expect(typeof hasSpace).toBe('boolean');
    });

    it('should validate file paths for security', async () => {
      const dangerousPaths = [
        '../../../etc/passwd',
        '/etc/shadow',
        'C:\\Windows\\System32\\config\\SAM'
      ];

      for (const dangerousPath of dangerousPaths) {
        expect(() => fileWriter.validatePath(dangerousPath, '/safe/target'))
          .toThrow(ValidationError);
      }
    });
  });
});
