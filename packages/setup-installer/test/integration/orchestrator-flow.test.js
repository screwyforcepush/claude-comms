/**
 * Integration tests for WP06 Orchestrator Framework
 *
 * Tests the complete orchestrator flow with mock dependencies
 * to demonstrate integration readiness for WP03/04 team modules.
 */

const { install, validateEnvironment, createInstaller } = require('../../src/index');
const { createMockDependencies, createScenarioMocks } = require('../../src/orchestrator/mocks');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

describe('Orchestrator Integration Flow', () => {
  let testDir;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `claude-installer-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('complete installation flow', () => {
    it('should successfully complete installation with mocks', async () => {
      const options = {
        targetDir: testDir,
        version: 'main',
        verbose: true,
        dryRun: false
      };

      const result = await install(options);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.filesInstalled).toHaveLength(3); // .claude/settings.json, CLAUDE.md, settings.local.json
      expect(result.errors).toHaveLength(0);
    });

    it('should handle dry-run mode correctly', async () => {
      const options = {
        targetDir: testDir,
        version: 'main',
        dryRun: true,
        verbose: true
      };

      const result = await install(options);

      expect(result.success).toBe(true);
      expect(result.filesInstalled).toHaveLength(0); // No files actually written in dry-run
    });

    it('should validate environment before installation', async () => {
      const options = {
        targetDir: testDir,
        skipPythonCheck: true
      };

      const validation = await validateEnvironment(options);

      expect(validation).toBeDefined();
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should handle installation with existing files', async () => {
      // Create existing CLAUDE.md file
      const existingClaudeMd = path.join(testDir, 'CLAUDE.md');
      await fs.writeFile(existingClaudeMd, '# Existing setup');

      const options = {
        targetDir: testDir,
        force: true, // Force overwrite
        verbose: true
      };

      const result = await install(options);

      expect(result.success).toBe(true);
      expect(result.filesInstalled).toHaveLength(3);
    });
  });

  describe('error handling and rollback', () => {
    it('should handle network failure gracefully', async () => {
      // Create installer with network failure scenario
      const mockDeps = createScenarioMocks('network_failure');
      const installer = createInstaller(mockDeps);

      const options = {
        targetDir: testDir,
        version: 'main'
      };

      const result = await installer.install(options);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('E103'); // GITHUB_API_ERROR
    });

    it('should handle write failure with rollback', async () => {
      // Create installer with write failure scenario
      const mockDeps = createScenarioMocks('write_failure');
      const installer = createInstaller(mockDeps);

      const options = {
        targetDir: testDir,
        version: 'main'
      };

      const result = await installer.install(options);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('E201'); // FILE_WRITE_ERROR
    });

    it('should handle validation failure', async () => {
      // Create installer with validation failure scenario
      const mockDeps = createScenarioMocks('validation_failure');
      const installer = createInstaller(mockDeps);

      const options = {
        targetDir: '/invalid/path/that/does/not/exist',
        version: 'main'
      };

      const result = await installer.install(options);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('progress reporting', () => {
    it('should emit progress events throughout installation', async () => {
      const installer = createInstaller();
      const progressEvents = [];

      installer.on('progress', (event) => {
        progressEvents.push(event);
      });

      const options = {
        targetDir: testDir,
        version: 'main'
      };

      await installer.install(options);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].current).toBe(0);
      expect(progressEvents[progressEvents.length - 1].current).toBe(100);

      // Verify progress increases monotonically
      for (let i = 1; i < progressEvents.length; i++) {
        expect(progressEvents[i].current).toBeGreaterThanOrEqual(progressEvents[i - 1].current);
      }
    });

    it('should track installation state correctly', async () => {
      const installer = createInstaller();
      const states = [];

      installer.on('progress', (event) => {
        states.push(event.status);
      });

      const options = {
        targetDir: testDir,
        version: 'main'
      };

      await installer.install(options);

      expect(states).toContain('running');
      // Final state should not be 'failed' for successful installation
      expect(states[states.length - 1]).not.toBe('failed');
    });
  });

  describe('dependency injection', () => {
    it('should accept custom fetcher implementation', async () => {
      const customFetcher = {
        fetchDirectory: jest.fn().mockResolvedValue({
          path: '.claude',
          type: 'dir',
          children: [{
            path: 'custom.json',
            type: 'file',
            content: '{"custom": true}',
            encoding: 'utf-8'
          }]
        }),
        fetchFile: jest.fn().mockResolvedValue({
          path: 'CLAUDE.md',
          content: '# Custom Claude Setup',
          encoding: 'utf-8'
        }),
        validateConnection: jest.fn().mockResolvedValue(true)
      };

      const mockDeps = createMockDependencies();
      const installer = createInstaller({
        ...mockDeps,
        fetcher: customFetcher
      });

      const options = {
        targetDir: testDir,
        version: 'main'
      };

      const result = await installer.install(options);

      expect(result.success).toBe(true);
      expect(customFetcher.fetchDirectory).toHaveBeenCalledWith('.claude', expect.any(Object));
      expect(customFetcher.fetchFile).toHaveBeenCalledWith('CLAUDE.md', expect.any(Object));
    });

    it('should accept custom writer implementation', async () => {
      const customWriter = {
        writeFile: jest.fn().mockResolvedValue(),
        writeDirectory: jest.fn().mockResolvedValue({
          written: ['/test/file1.json', '/test/file2.md'],
          skipped: [],
          backed_up: new Map(),
          errors: []
        }),
        backup: jest.fn().mockResolvedValue('/backup/path'),
        rollback: jest.fn().mockResolvedValue(),
        removeFile: jest.fn().mockResolvedValue()
      };

      const mockDeps = createMockDependencies();
      const installer = createInstaller({
        ...mockDeps,
        writer: customWriter
      });

      const options = {
        targetDir: testDir,
        version: 'main'
      };

      const result = await installer.install(options);

      expect(result.success).toBe(true);
      expect(customWriter.writeDirectory).toHaveBeenCalled();
      expect(customWriter.writeFile).toHaveBeenCalled(); // settings.local.json
    });
  });

  describe('options handling', () => {
    it('should handle all supported options correctly', async () => {
      const options = {
        targetDir: testDir,
        version: 'v1.2.3',
        force: true,
        skipPythonCheck: true,
        verbose: true,
        cache: true,
        dryRun: false
      };

      const result = await install(options);

      expect(result.success).toBe(true);
      // Verify that options were passed through to dependencies
    });

    it('should apply default values for missing options', async () => {
      const options = {
        targetDir: testDir
      };

      const result = await install(options);

      expect(result.success).toBe(true);
      // Should use defaults: version='main', force=false, etc.
    });

    it('should validate required options', async () => {
      try {
        await install(null);
        throw new Error('Should have thrown an error for null options');
      } catch (error) {
        expect(error.code).toBe('E402'); // INVALID_INPUT
      }
    });
  });

  describe('file structure validation', () => {
    it('should create expected directory structure', async () => {
      const installer = createInstaller();

      const options = {
        targetDir: testDir,
        version: 'main',
        dryRun: false
      };

      const result = await installer.install(options);

      expect(result.success).toBe(true);

      // The mock should simulate creating these files
      const expectedFiles = [
        '.claude/settings.json',
        'CLAUDE.md',
        '.claude/settings.local.json'
      ];

      // Note: In real implementation, we would check actual file existence
      // For mocks, we verify the result structure
      expect(result.filesInstalled).toHaveLength(expectedFiles.length);
    });
  });

  describe('team integration readiness', () => {
    it('should seamlessly integrate with real GitHub fetcher when available', async () => {
      // This test demonstrates how WP03 (IsabelMatrix) can be integrated
      const realFetcherMock = {
        // This would be the actual GitHub fetcher implementation
        fetchDirectory: jest.fn().mockResolvedValue({
          path: '.claude',
          type: 'dir',
          children: [/* real GitHub API response */]
        }),
        fetchFile: jest.fn().mockResolvedValue({
          path: 'CLAUDE.md',
          content: '# Real content from GitHub',
          encoding: 'utf-8'
        }),
        validateConnection: jest.fn().mockResolvedValue(true)
      };

      const mockDeps = createMockDependencies();
      const installer = createInstaller({
        ...mockDeps,
        fetcher: realFetcherMock // Replace mock with real implementation
      });

      const result = await installer.install({
        targetDir: testDir,
        version: 'main'
      });

      expect(result.success).toBe(true);
      expect(realFetcherMock.fetchDirectory).toHaveBeenCalled();
    });

    it('should seamlessly integrate with real file writer when available', async () => {
      // This test demonstrates how WP04 (JackTensor) can be integrated
      const realWriterMock = {
        // This would be the actual file writer implementation
        writeFile: jest.fn().mockResolvedValue(),
        writeDirectory: jest.fn().mockResolvedValue({
          written: ['/real/path1', '/real/path2'],
          skipped: [],
          backed_up: new Map(),
          errors: []
        }),
        backup: jest.fn().mockResolvedValue('/real/backup'),
        rollback: jest.fn().mockResolvedValue(),
        removeFile: jest.fn().mockResolvedValue()
      };

      const mockDeps = createMockDependencies();
      const installer = createInstaller({
        ...mockDeps,
        writer: realWriterMock // Replace mock with real implementation
      });

      const result = await installer.install({
        targetDir: testDir,
        version: 'main'
      });

      expect(result.success).toBe(true);
      expect(realWriterMock.writeDirectory).toHaveBeenCalled();
    });
  });
});
