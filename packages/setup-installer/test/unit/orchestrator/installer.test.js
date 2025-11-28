/**
 * Unit tests for Installation Orchestrator - WP06
 *
 * Tests the core orchestrator functionality including:
 * - Dependency injection
 * - Installation flow coordination
 * - Error handling and rollback
 * - Progress reporting
 * - State management
 */

const { Installer, InstallationState, ErrorCode } = require('../../../src/orchestrator/installer');
const { InstallationError } = require('../../../src/utils/errors');

describe('Installer', () => {
  let installer;
  let mockFetcher;
  let mockWriter;
  let mockLogger;
  let mockValidator;

  beforeEach(() => {
    // Create mock dependencies
    mockFetcher = {
      fetchDirectory: jest.fn(),
      fetchFile: jest.fn(),
      validateConnection: jest.fn().mockResolvedValue(true)
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Track which files have been "written" for realistic pathExists behavior
    const writtenFiles = new Set();

    mockValidator = {
      validateTargetDirectory: jest.fn().mockResolvedValue(null),
      validatePythonEnvironment: jest.fn().mockResolvedValue(null),
      checkExistingFiles: jest.fn().mockResolvedValue(null),
      validateNetworkAccess: jest.fn().mockResolvedValue(null),
      // For most tests, paths exist except user-customizable files (which we want to write)
      pathExists: jest.fn().mockImplementation((pathArg) => {
        // repo.md should not exist (so we copy it)
        if (pathArg.includes('repo.md')) return Promise.resolve(false);
        // chrome-devtools config.json should not exist (so we copy it)
        if (pathArg.includes('chrome-devtools/config.json')) return Promise.resolve(false);
        // For settings.local.json, check if it was "written"
        if (pathArg.includes('settings.local.json')) {
          return Promise.resolve(writtenFiles.has('settings.local.json'));
        }
        return Promise.resolve(true);
      }),
      _writtenFiles: writtenFiles  // expose for test manipulation
    };

    mockWriter = {
      writeFile: jest.fn().mockImplementation((filePath) => {
        if (filePath.includes('settings.local.json')) {
          writtenFiles.add('settings.local.json');
        }
        return Promise.resolve({ path: filePath });
      }),
      writeDirectory: jest.fn(),
      backup: jest.fn(),
      rollback: jest.fn(),
      removeFile: jest.fn()
    };

    installer = new Installer({
      fetcher: mockFetcher,
      writer: mockWriter,
      logger: mockLogger,
      validator: mockValidator
    });
  });

  describe('constructor', () => {
    it('should initialize with injected dependencies', () => {
      expect(installer.fetcher).toBe(mockFetcher);
      expect(installer.writer).toBe(mockWriter);
      expect(installer.logger).toBe(mockLogger);
      expect(installer.validator).toBe(mockValidator);
    });

    it('should initialize with default state', () => {
      expect(installer.state).toBe(InstallationState.IDLE);
      expect(installer.installedFiles).toEqual([]);
      expect(installer.errors).toEqual([]);
      expect(installer.backups.size).toBe(0);
    });

    it('should create mock dependencies when none provided', () => {
      const installerWithMocks = new Installer();
      expect(installerWithMocks.fetcher).toBeDefined();
      expect(installerWithMocks.writer).toBeDefined();
      expect(installerWithMocks.logger).toBeDefined();
      expect(installerWithMocks.validator).toBeDefined();
    });
  });

  describe('install', () => {
    const validOptions = {
      targetDir: '/test/target',
      version: 'main',
      force: false,
      skipPythonCheck: false,
      verbose: false,
      cache: true,
      dryRun: false
    };

    beforeEach(() => {
      // Setup successful mock responses
      mockFetcher.fetchDirectory.mockResolvedValue({
        path: '.claude',
        type: 'dir',
        children: [
          {
            path: 'settings.json',
            type: 'file',
            content: '{"version": "1.0.0"}',
            encoding: 'utf-8'
          }
        ]
      });

      mockFetcher.fetchFile.mockResolvedValue({
        path: 'CLAUDE.md',
        content: '# Claude Setup',
        encoding: 'utf-8'
      });

      mockWriter.writeDirectory.mockResolvedValue({
        written: ['/test/target/.claude/settings.json', '/test/target/CLAUDE.md'],
        skipped: [],
        backed_up: new Map(),
        errors: []
      });
    });

    it('should complete successful installation', async () => {
      const result = await installer.install(validOptions);

      expect(result.success).toBe(true);
      expect(result.filesInstalled).toHaveLength(3); // 2 from writeDirectory + 1 settings.local.json
      expect(result.errors).toHaveLength(0);
      expect(installer.state).toBe(InstallationState.COMPLETED);
    });

    it('should emit progress events during installation', async () => {
      const progressEvents = [];
      installer.on('progress', (event) => progressEvents.push(event));

      await installer.install(validOptions);

      expect(progressEvents).toHaveLength(7); // Start + 6 phases (including completion)
      expect(progressEvents[0].current).toBe(0);
      expect(progressEvents[progressEvents.length - 1].current).toBe(100);
    });

    it('should handle dry-run mode', async () => {
      const dryRunOptions = { ...validOptions, dryRun: true };

      const result = await installer.install(dryRunOptions);

      expect(result.success).toBe(true);
      // In dry-run mode, writeDirectory is not called - the function returns early
      // and just logs what would be installed
      expect(mockWriter.writeDirectory).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('DRY RUN')
      );
    });

    it('should validate options before starting', async () => {
      await expect(installer.install(null)).rejects.toThrow(InstallationError);
      await expect(installer.install({})).resolves.toBeDefined();
    });

    it('should call all installation phases in correct order', async () => {
      await installer.install(validOptions);

      // Verify validation was called
      expect(mockValidator.validateTargetDirectory).toHaveBeenCalled();
      expect(mockValidator.validatePythonEnvironment).toHaveBeenCalled();

      // Verify fetching was called
      expect(mockFetcher.fetchDirectory).toHaveBeenCalledWith('.claude', expect.any(Object));
      expect(mockFetcher.fetchFile).toHaveBeenCalledWith('CLAUDE.md', expect.any(Object));

      // Verify writing was called
      expect(mockWriter.writeDirectory).toHaveBeenCalled();
      expect(mockWriter.writeFile).toHaveBeenCalled(); // settings.local.json
    });

    it('should skip Python check when skipPythonCheck is true', async () => {
      const optionsSkipPython = { ...validOptions, skipPythonCheck: true };

      await installer.install(optionsSkipPython);

      expect(mockValidator.validatePythonEnvironment).not.toHaveBeenCalled();
    });
  });

  describe('error handling and rollback', () => {
    const validOptions = {
      targetDir: '/test/target',
      version: 'main'
    };

    it('should handle fetcher errors and rollback', async () => {
      const fetchError = new Error('GitHub API failure');
      mockFetcher.fetchDirectory.mockRejectedValue(fetchError);

      const result = await installer.install(validOptions);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ErrorCode.GITHUB_API_ERROR);
      expect(installer.state).toBe(InstallationState.FAILED);
    });

    it('should handle writer errors and rollback', async () => {
      // Setup fetcher to succeed
      mockFetcher.fetchDirectory.mockResolvedValue({
        path: '.claude',
        type: 'dir',
        children: []
      });
      mockFetcher.fetchFile.mockResolvedValue({
        path: 'CLAUDE.md',
        content: '# Test'
      });

      // Make writer fail
      const writeError = new Error('Permission denied');
      mockWriter.writeDirectory.mockRejectedValue(writeError);

      const result = await installer.install(validOptions);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(installer.state).toBe(InstallationState.FAILED);
    });

    it('should rollback changes when installation fails', async () => {
      // Setup partial success scenario
      mockFetcher.fetchDirectory.mockResolvedValue({
        path: '.claude',
        type: 'dir',
        children: []
      });
      mockFetcher.fetchFile.mockResolvedValue({
        path: 'CLAUDE.md',
        content: '# Test'
      });

      // Writer succeeds initially but post-installation fails
      mockWriter.writeDirectory.mockResolvedValue({
        written: ['/test/target/.claude/settings.json'],
        skipped: [],
        backed_up: new Map([['/test/target/existing.txt', '/test/target/existing.txt.backup']]),
        errors: []
      });

      mockWriter.writeFile.mockRejectedValue(new Error('Post-install failure'));

      const result = await installer.install(validOptions);

      expect(result.success).toBe(false);

      // Verify rollback was attempted
      expect(mockWriter.removeFile).toHaveBeenCalledWith('/test/target/.claude/settings.json');
      expect(mockWriter.rollback).toHaveBeenCalledWith(
        '/test/target/existing.txt.backup',
        '/test/target/existing.txt'
      );
    });
  });

  describe('validateEnvironment', () => {
    const validOptions = {
      targetDir: '/test/target',
      skipPythonCheck: false
    };

    it('should return valid result when all checks pass', async () => {
      const result = await installer.validateEnvironment(validOptions);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should return invalid result when validation fails', async () => {
      mockValidator.validateTargetDirectory.mockResolvedValue({
        code: ErrorCode.INVALID_TARGET_DIR,
        message: 'Target directory is not writable',
        severity: 'error'
      });

      const result = await installer.validateEnvironment(validOptions);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe(ErrorCode.INVALID_TARGET_DIR);
    });

    it('should skip Python check when skipPythonCheck is true', async () => {
      const optionsSkipPython = { ...validOptions, skipPythonCheck: true };

      await installer.validateEnvironment(optionsSkipPython);

      expect(mockValidator.validatePythonEnvironment).not.toHaveBeenCalled();
    });
  });

  describe('progress tracking', () => {
    it('should track progress throughout installation', async () => {
      const options = { targetDir: '/test/target' };

      // Setup mocks for successful installation
      mockFetcher.fetchDirectory.mockResolvedValue({
        path: '.claude',
        type: 'dir',
        children: []
      });
      mockFetcher.fetchFile.mockResolvedValue({
        path: 'CLAUDE.md',
        content: '# Test'
      });
      mockWriter.writeDirectory.mockResolvedValue({
        written: [],
        skipped: [],
        backed_up: new Map(),
        errors: []
      });

      const progressUpdates = [];
      installer.on('progress', (event) => progressUpdates.push(event));

      await installer.install(options);

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].current).toBe(0);
      expect(progressUpdates[progressUpdates.length - 1].current).toBe(100);

      // Check that progress increases monotonically
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].current).toBeGreaterThanOrEqual(progressUpdates[i - 1].current);
      }
    });

    it('should provide accurate progress information via getProgress()', async () => {
      const progress = installer.getProgress();

      expect(progress).toHaveProperty('current');
      expect(progress).toHaveProperty('state');
      expect(progress).toHaveProperty('hasErrors');
      expect(progress.state).toBe(InstallationState.IDLE);
      expect(progress.hasErrors).toBe(false);
    });
  });

  describe('file operations', () => {
    it('should correctly flatten file tree structure', () => {
      const fetchedFiles = {
        '.claude': {
          path: '.claude',
          type: 'dir',
          children: [
            {
              path: 'settings.json',
              type: 'file',
              content: '{"test": true}',
              encoding: 'utf-8'
            },
            {
              path: 'hooks',
              type: 'dir',
              children: [
                {
                  path: 'test.py',
                  type: 'file',
                  content: 'print("test")',
                  encoding: 'utf-8'
                }
              ]
            }
          ]
        },
        'CLAUDE.md': {
          content: '# Test',
          encoding: 'utf-8'
        }
      };

      const flattened = installer._flattenFiles(fetchedFiles);

      expect(flattened).toHaveLength(3);
      expect(flattened.find(f => f.path === '.claude/settings.json')).toBeDefined();
      expect(flattened.find(f => f.path === '.claude/hooks/test.py')).toBeDefined();
      expect(flattened.find(f => f.path === 'CLAUDE.md')).toBeDefined();
    });

    it('should correctly count files in fetch result', () => {
      const fetchedFiles = {
        '.claude': {
          path: '.claude',
          type: 'dir',
          children: [
            { path: 'file1.json', type: 'file' },
            { path: 'file2.py', type: 'file' }
          ]
        },
        'CLAUDE.md': { content: '# Test' }
      };

      const count = installer._countFiles(fetchedFiles);
      expect(count).toBe(3); // 2 files in .claude + 1 CLAUDE.md
    });
  });

  describe('option validation', () => {
    it('should validate and normalize options correctly', () => {
      const options = {
        targetDir: 'relative/path',
        version: 'v1.0.0',
        force: 'true', // string instead of boolean
        skipPythonCheck: 1, // number instead of boolean
        cache: false
      };

      const normalized = installer._validateOptions(options);

      expect(normalized.targetDir).toMatch(/^\/.*relative\/path$/); // Should be absolute
      expect(normalized.version).toBe('v1.0.0');
      expect(normalized.force).toBe(true);
      expect(normalized.skipPythonCheck).toBe(true);
      expect(normalized.cache).toBe(false);
    });

    it('should set default values for missing options', () => {
      const options = { targetDir: '/test' };

      const normalized = installer._validateOptions(options);

      expect(normalized.version).toBe('main');
      expect(normalized.force).toBe(false);
      expect(normalized.skipPythonCheck).toBe(false);
      expect(normalized.verbose).toBe(false);
      expect(normalized.cache).toBe(false);
      expect(normalized.dryRun).toBe(false);
    });

    it('should throw error for invalid options', () => {
      expect(() => installer._validateOptions(null)).toThrow(InstallationError);
      expect(() => installer._validateOptions('invalid')).toThrow(InstallationError);
    });
  });
});
