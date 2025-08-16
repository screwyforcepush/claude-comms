/**
 * File Writer Integration Tests
 * Tests for integration with platform utilities, progress reporting, and cross-platform scenarios
 */

const path = require('path');
// const os = require('os'); // TODO: Use OS utilities in integration tests
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const FileSystemMock = require('../../mocks/file-system');
const platformUtils = require('../../../src/utils/platform');
const { mockDirectoryStructure } = require('../../fixtures/mock-data');
// const { mockPlatformScenarios } = require('../../fixtures/mock-data'); // TODO: Test platform scenarios

// Import the file writer module
const { FileWriter } = require('../../../src/installer/file-writer');

describe('FileWriter Integration Tests', () => {
  let fileSystemMock;
  let fileWriter;
  let progressEvents;

  beforeEach(() => {
    fileSystemMock = new FileSystemMock();
    fileSystemMock.setup();

    // Capture progress events
    progressEvents = [];
    const mockProgressReporter = new EventEmitter();
    mockProgressReporter.start = jest.fn((task, total) => {
      progressEvents.push({ type: 'start', task, total });
    });
    mockProgressReporter.update = jest.fn((current, message) => {
      progressEvents.push({ type: 'update', current, message });
    });
    mockProgressReporter.complete = jest.fn((message) => {
      progressEvents.push({ type: 'complete', message });
    });
    mockProgressReporter.fail = jest.fn((error) => {
      progressEvents.push({ type: 'fail', error });
    });

    fileWriter = new FileWriter({
      progressReporter: mockProgressReporter,
      platformUtils
    });
  });

  afterEach(() => {
    fileSystemMock.cleanup();
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle Windows path separators correctly', async () => {
      const winFiles = [
        { path: 'subfolder\\file.txt', content: 'windows content' },
        { path: 'subfolder\\nested\\deep.js', content: 'console.log("windows");' }
      ];
      const targetDir = '/target/directory';

      await fileWriter.writeDirectory(winFiles, { targetDir });

      // Files should be accessible via normalized paths
      const normalizedPath1 = path.join(targetDir, 'subfolder', 'file.txt');
      const normalizedPath2 = path.join(targetDir, 'subfolder', 'nested', 'deep.js');

      const content1 = await fs.readFile(normalizedPath1, 'utf8');
      const content2 = await fs.readFile(normalizedPath2, 'utf8');

      expect(content1).toBe('windows content');
      expect(content2).toBe('console.log("windows");');
    });

    it('should handle Unix hidden files and permissions', async () => {
      const unixFiles = [
        { path: '.hidden-config', content: 'hidden=true', permissions: 0o600 },
        { path: 'bin/script.sh', content: '#!/bin/bash\necho "test"', permissions: 0o755 }
      ];
      const targetDir = '/target/directory';

      await fileWriter.writeDirectory(unixFiles, { targetDir });

      // Check hidden file
      const hiddenPath = path.join(targetDir, '.hidden-config');
      const hiddenStats = await fs.stat(hiddenPath);
      expect(hiddenStats.mode & 0o777).toBe(0o600);

      // Check executable script
      const scriptPath = path.join(targetDir, 'bin', 'script.sh');
      const scriptStats = await fs.stat(scriptPath);
      expect(scriptStats.mode & 0o777).toBe(0o755);
    });

    it('should handle line ending conversions', async () => {
      const contentWithMixedLineEndings = 'line1\r\nline2\nline3\r\nline4';
      const targetPath = '/target/directory/line-endings.txt';

      await fileWriter.writeFile(targetPath, contentWithMixedLineEndings, {
        normalizeLineEndings: true
      });

      const result = await fs.readFile(targetPath, 'utf8');
      const expectedEnding = platformUtils.getLineEnding();
      const expectedContent = contentWithMixedLineEndings
        .replace(/\r\n|\r|\n/g, expectedEnding);

      expect(result).toBe(expectedContent);
    });

    it('should respect platform-specific path length limits', async () => {
      // Test very long path (varies by platform)
      const longFileName = 'a'.repeat(200) + '.txt';
      const longPath = path.join('/target/directory', longFileName);

      // Should either succeed or throw appropriate error based on platform
      try {
        await fileWriter.writeFile(longPath, 'content');

        const exists = await fs.access(longPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      } catch (error) {
        // On platforms with path limits, should get appropriate error
        expect(error.message).toMatch(/path|name|long/i);
      }
    });
  });

  describe('Full Claude Directory Installation', () => {
    it('should install complete .claude directory structure', async () => {
      const targetDir = '/target/directory';
      const claudeFiles = Object.entries(mockDirectoryStructure).flatMap(([rootPath, content]) => {
        if (typeof content === 'string') {
          return [{ path: rootPath, content }];
        }
        return flattenDirectory(rootPath, content);
      });

      function flattenDirectory(basePath, structure) {
        const files = [];
        for (const [name, content] of Object.entries(structure)) {
          const fullPath = path.join(basePath, name);
          if (typeof content === 'string') {
            files.push({ path: fullPath, content });
          } else {
            files.push(...flattenDirectory(fullPath, content));
          }
        }
        return files;
      }

      const result = await fileWriter.writeDirectory(claudeFiles, { targetDir });

      expect(result.errors).toHaveLength(0);
      expect(result.written.length).toBeGreaterThan(10);

      // Verify key files exist
      const settingsPath = path.join(targetDir, '.claude', 'settings.json');
      const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
      const installScriptPath = path.join(targetDir, '.claude', 'hooks', 'install.py');

      const settingsExists = await fs.access(settingsPath).then(() => true).catch(() => false);
      const claudeMdExists = await fs.access(claudeMdPath).then(() => true).catch(() => false);
      const installScriptExists = await fs.access(installScriptPath).then(() => true).catch(() => false);

      expect(settingsExists).toBe(true);
      expect(claudeMdExists).toBe(true);
      expect(installScriptExists).toBe(true);

      // Verify directory structure
      fileSystemMock.verifyDirectoryStructure(targetDir, mockDirectoryStructure);
    });

    it('should handle existing .claude directory with backup', async () => {
      const targetDir = '/target/directory';

      // Setup existing .claude directory
      fileSystemMock.setupExistingClaudeDirectory(targetDir);

      const newClaudeFiles = [
        { path: '.claude/settings.json', content: '{"version": "2.0.0"}' },
        { path: '.claude/new-agent.py', content: 'print("new agent")' }
      ];

      const options = { targetDir, overwrite: true, backup: true };
      const result = await fileWriter.writeDirectory(newClaudeFiles, options);

      expect(result.backed_up.size).toBeGreaterThan(0);
      expect(result.written).toContain('.claude/settings.json');
      expect(result.written).toContain('.claude/new-agent.py');

      // Verify backup exists for overwritten file
      const settingsBackup = Array.from(result.backed_up.keys())
        .find(key => key.includes('settings.json'));
      expect(settingsBackup).toBeDefined();
    });

    it('should handle conflict resolution strategies', async () => {
      const targetDir = '/target/directory';

      // Create conflicting files
      const existingFile = path.join(targetDir, '.claude', 'conflict.py');
      await fs.mkdir(path.dirname(existingFile), { recursive: true });
      await fs.writeFile(existingFile, 'original content');

      const conflictingFiles = [
        { path: '.claude/conflict.py', content: 'new content' },
        { path: '.claude/no-conflict.py', content: 'safe content' }
      ];

      // Test skip strategy
      const skipResult = await fileWriter.writeDirectory(conflictingFiles, {
        targetDir,
        conflictStrategy: 'skip'
      });

      expect(skipResult.skipped).toContain('.claude/conflict.py');
      expect(skipResult.written).toContain('.claude/no-conflict.py');

      // Verify original content preserved
      const originalContent = await fs.readFile(existingFile, 'utf8');
      expect(originalContent).toBe('original content');

      // Test overwrite strategy
      const overwriteResult = await fileWriter.writeDirectory(conflictingFiles, {
        targetDir,
        conflictStrategy: 'overwrite'
      });

      expect(overwriteResult.written).toContain('.claude/conflict.py');

      const newContent = await fs.readFile(existingFile, 'utf8');
      expect(newContent).toBe('new content');
    });
  });

  describe('Progress Reporting Integration', () => {
    it('should emit detailed progress for large installations', async () => {
      const largeFileSet = Array.from({ length: 50 }, (_, i) => ({
        path: `batch/file-${i}.txt`,
        content: `content for file ${i}`
      }));
      const targetDir = '/target/directory';

      await fileWriter.writeDirectory(largeFileSet, { targetDir });

      // Verify progress events
      const startEvent = progressEvents.find(e => e.type === 'start');
      const updateEvents = progressEvents.filter(e => e.type === 'update');
      const completeEvent = progressEvents.find(e => e.type === 'complete');

      expect(startEvent).toBeDefined();
      expect(startEvent.total).toBe(50);
      expect(updateEvents.length).toBe(50);
      expect(completeEvent).toBeDefined();

      // Verify update events have increasing current values
      for (let i = 0; i < updateEvents.length; i++) {
        expect(updateEvents[i].current).toBe(i + 1);
      }
    });

    it('should emit progress events for backup operations', async () => {
      const targetDir = '/target/directory';

      // Setup existing files for backup
      const existingFiles = Array.from({ length: 5 }, (_, i) => `existing-${i}.txt`);
      for (const fileName of existingFiles) {
        const filePath = path.join(targetDir, fileName);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, `existing content ${fileName}`);
      }

      const newFiles = existingFiles.map((fileName, i) => ({
        path: fileName,
        content: `new content ${i}`
      }));

      const options = { targetDir, overwrite: true, backup: true };
      await fileWriter.writeDirectory(newFiles, options);

      // Should have progress events for both backup and write operations
      const backupEvents = progressEvents.filter(e =>
        e.message && e.message.includes('backup')
      );
      expect(backupEvents.length).toBeGreaterThan(0);
    });

    it('should handle progress reporting during failures', async () => {
      fileSystemMock.setupPermissionDeniedScenario();

      const mixedFiles = [
        { path: 'good-file-1.txt', content: 'good' },
        { path: '../../../restricted/bad-file.txt', content: 'bad' },
        { path: 'good-file-2.txt', content: 'good' }
      ];
      const targetDir = '/target/directory';

      const result = await fileWriter.writeDirectory(mixedFiles, { targetDir });

      // Should have failure event for the restricted file
      const failEvents = progressEvents.filter(e => e.type === 'fail');
      expect(failEvents.length).toBeGreaterThan(0);

      // But should still complete successfully overall
      const completeEvent = progressEvents.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.written.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Memory Efficiency', () => {
    it('should handle large files without excessive memory usage', async () => {
      const largePath = '/target/directory/large-file.txt';
      const largeContent = 'x'.repeat(5 * 1024 * 1024); // 5MB

      const initialMemory = process.memoryUsage().heapUsed;

      await fileWriter.writeFile(largePath, largeContent, { streaming: true });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 2x file size)
      expect(memoryIncrease).toBeLessThan(largeContent.length * 2);

      // Verify file was written correctly
      const stats = await fs.stat(largePath);
      expect(stats.size).toBe(largeContent.length);
    });

    it('should batch small files efficiently', async () => {
      const smallFiles = Array.from({ length: 1000 }, (_, i) => ({
        path: `small/file-${i}.txt`,
        content: `small content ${i}`
      }));
      const targetDir = '/target/directory';

      const startTime = Date.now();
      const result = await fileWriter.writeDirectory(smallFiles, {
        targetDir,
        batchSize: 50
      });
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (30 seconds for 1000 files)
      expect(duration).toBeLessThan(30000);
      expect(result.written).toHaveLength(1000);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle concurrent operations safely', async () => {
      const targetDir = '/target/directory';

      // Create multiple concurrent write operations
      const operations = Array.from({ length: 10 }, (_, i) => {
        const files = Array.from({ length: 10 }, (_, j) => ({
          path: `concurrent-${i}/file-${j}.txt`,
          content: `concurrent content ${i}-${j}`
        }));
        return fileWriter.writeDirectory(files, { targetDir });
      });

      const results = await Promise.all(operations);

      // All operations should succeed
      for (const result of results) {
        expect(result.written).toHaveLength(10);
        expect(result.errors).toHaveLength(0);
      }

      // Verify all files exist and have correct content
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          const filePath = path.join(targetDir, `concurrent-${i}`, `file-${j}.txt`);
          const content = await fs.readFile(filePath, 'utf8');
          expect(content).toBe(`concurrent content ${i}-${j}`);
        }
      }
    });
  });

  describe('Error Recovery and Rollback', () => {
    it('should perform complete rollback on atomic operation failure', async () => {
      const targetDir = '/target/directory';
      const snapshot = fileSystemMock.createSnapshot();

      const problematicFiles = [
        { path: 'file-1.txt', content: 'content 1' },
        { path: 'file-2.txt', content: 'content 2' },
        { path: '../../../restricted/file-3.txt', content: 'bad path' }, // This will fail
        { path: 'file-4.txt', content: 'content 4' }
      ];

      const options = { targetDir, atomic: true };

      await expect(fileWriter.writeDirectory(problematicFiles, options))
        .rejects.toThrow();

      // Verify complete rollback - no files should exist
      for (let i = 1; i <= 4; i++) {
        const filePath = path.join(targetDir, `file-${i}.txt`);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(false);
      }

      // Verify directory state is unchanged
      const currentSnapshot = fileSystemMock.createSnapshot();
      expect(currentSnapshot).toEqual(snapshot);
    });

    it('should provide detailed rollback information', async () => {
      const targetDir = '/target/directory';

      // Create some existing files first
      const existingFiles = ['existing-1.txt', 'existing-2.txt'];
      for (const fileName of existingFiles) {
        const filePath = path.join(targetDir, fileName);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, `original ${fileName}`);
      }

      const rollbackInfo = await fileWriter.createRollbackPoint(targetDir);

      // Make changes
      const newFiles = [
        { path: 'existing-1.txt', content: 'modified content 1' },
        { path: 'new-file.txt', content: 'new content' }
      ];

      await fileWriter.writeDirectory(newFiles, { targetDir, overwrite: true });

      // Perform rollback
      await fileWriter.rollbackToPoint(rollbackInfo);

      // Verify rollback
      const file1Content = await fs.readFile(path.join(targetDir, 'existing-1.txt'), 'utf8');
      expect(file1Content).toBe('original existing-1.txt');

      const newFileExists = await fs.access(path.join(targetDir, 'new-file.txt'))
        .then(() => true).catch(() => false);
      expect(newFileExists).toBe(false);
    });
  });
});
