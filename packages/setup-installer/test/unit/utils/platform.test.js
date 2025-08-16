/**
 * Unit tests for platform detection utilities
 * Tests cross-platform compatibility and platform-specific behavior
 */

const { PlatformDetector, Platform } = require('../../../src/utils/platform');
// const { PlatformFeatures } = require('../../../src/utils/platform'); // TODO: Use PlatformFeatures in tests

describe('PlatformDetector', () => {
  let detector;
  let originalPlatform;
  let originalArch;
  let originalEnv;

  beforeEach(() => {
    // Store original values
    originalPlatform = process.platform;
    originalArch = process.arch;
    originalEnv = { ...process.env };

    detector = new PlatformDetector();
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true
    });
    Object.defineProperty(process, 'arch', {
      value: originalArch,
      writable: true
    });
    process.env = originalEnv;
  });

  describe('platform detection', () => {
    it('should detect Windows platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const platform = detector.detectPlatform();
      expect(platform).toBe(Platform.WINDOWS);
    });

    it('should detect macOS platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      const platform = detector.detectPlatform();
      expect(platform).toBe(Platform.MACOS);
    });

    it('should detect Linux platform', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const platform = detector.detectPlatform();
      expect(platform).toBe(Platform.LINUX);
    });

    it('should handle unknown platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'unknown',
        writable: true
      });

      expect(() => detector.detectPlatform()).toThrow('Unsupported platform');
    });
  });

  describe('architecture detection', () => {
    it('should detect x64 architecture', () => {
      Object.defineProperty(process, 'arch', {
        value: 'x64',
        writable: true
      });

      const arch = detector.detectArchitecture();
      expect(arch).toBe('x64');
    });

    it('should detect arm64 architecture', () => {
      Object.defineProperty(process, 'arch', {
        value: 'arm64',
        writable: true
      });

      const arch = detector.detectArchitecture();
      expect(arch).toBe('arm64');
    });

    it('should handle ia32 architecture', () => {
      Object.defineProperty(process, 'arch', {
        value: 'ia32',
        writable: true
      });

      const arch = detector.detectArchitecture();
      expect(arch).toBe('ia32');
    });
  });

  describe('path handling', () => {
    it('should use correct path separator for Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const separator = detector.getPathSeparator();
      expect(separator).toBe('\\');
    });

    it('should use correct path separator for Unix-like systems', () => {
      ['darwin', 'linux'].forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          writable: true
        });

        const separator = detector.getPathSeparator();
        expect(separator).toBe('/');
      });
    });

    it('should normalize paths correctly on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const path = '/some/unix/path';
      const normalized = detector.normalizePath(path);
      expect(normalized).toBe('\\some\\unix\\path');
    });

    it('should normalize paths correctly on Unix systems', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const path = '\\some\\windows\\path';
      const normalized = detector.normalizePath(path);
      expect(normalized).toBe('/some/windows/path');
    });

    it('should handle absolute vs relative paths correctly', () => {
      const absolutePath = detector.isAbsolutePath('/home/user/file');
      const relativePath = detector.isAbsolutePath('./relative/path');

      expect(absolutePath).toBe(true);
      expect(relativePath).toBe(false);
    });

    it('should handle Windows absolute paths', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      expect(detector.isAbsolutePath('C:\\Users\\User')).toBe(true);
      expect(detector.isAbsolutePath('\\\\server\\share')).toBe(true);
      expect(detector.isAbsolutePath('.\\relative')).toBe(false);
    });
  });

  describe('line ending detection', () => {
    it('should return CRLF for Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const lineEnding = detector.getLineEnding();
      expect(lineEnding).toBe('\r\n');
    });

    it('should return LF for Unix-like systems', () => {
      ['darwin', 'linux'].forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          writable: true
        });

        const lineEnding = detector.getLineEnding();
        expect(lineEnding).toBe('\n');
      });
    });

    it('should convert line endings correctly', () => {
      const unixText = 'line1\nline2\nline3';
      const windowsText = 'line1\r\nline2\r\nline3';

      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const converted = detector.convertLineEndings(unixText);
      expect(converted).toBe(windowsText);
    });

    it('should handle mixed line endings', () => {
      const mixedText = 'line1\nline2\r\nline3\r';

      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const normalized = detector.normalizeLineEndings(mixedText);
      expect(normalized).toBe('line1\nline2\nline3\n');
    });
  });

  describe('Python detection', () => {
    const mockExistsSync = jest.fn();
    const mockSpawnSync = jest.fn();

    beforeEach(() => {
      const fs = require('fs');
      const childProcess = require('child_process');

      fs.existsSync = mockExistsSync;
      childProcess.spawnSync = mockSpawnSync;
    });

    it('should find Python on Windows in standard locations', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      mockExistsSync.mockImplementation((path) => {
        return path === 'C:\\Python39\\python.exe';
      });

      const pythonPath = detector.findPython();
      expect(pythonPath).toBe('C:\\Python39\\python.exe');
    });

    it('should find Python on macOS via Homebrew', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      mockExistsSync.mockImplementation((path) => {
        return path === '/opt/homebrew/bin/python3';
      });

      const pythonPath = detector.findPython();
      expect(pythonPath).toBe('/opt/homebrew/bin/python3');
    });

    it('should find Python on Linux in standard locations', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      mockExistsSync.mockImplementation((path) => {
        return path === '/usr/bin/python3';
      });

      const pythonPath = detector.findPython();
      expect(pythonPath).toBe('/usr/bin/python3');
    });

    it('should check Python version', () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: Buffer.from('Python 3.9.7')
      });

      const version = detector.checkPythonVersion('/usr/bin/python3');
      expect(version).toMatch(/3\.9\.7/);
    });

    it('should handle Python version check failure', () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stderr: Buffer.from('python: command not found')
      });

      expect(() => {
        detector.checkPythonVersion('/nonexistent/python');
      }).toThrow('Failed to get Python version');
    });

    it('should validate minimum Python version', () => {
      const isValid = detector.validatePythonVersion('3.9.0', '3.8.0');
      expect(isValid).toBe(true);

      const isInvalid = detector.validatePythonVersion('3.7.0', '3.8.0');
      expect(isInvalid).toBe(false);
    });
  });

  describe('UV detection', () => {
    const mockWhich = jest.fn();

    beforeEach(() => {
      // Mock which command
      global.which = mockWhich;
    });

    it('should find uv in PATH', () => {
      mockWhich.mockReturnValue('/usr/local/bin/uv');

      const uvPath = detector.findUV();
      expect(uvPath).toBe('/usr/local/bin/uv');
    });

    it('should check uv installation', () => {
      mockWhich.mockReturnValue('/usr/local/bin/uv');

      const hasUV = detector.hasUV();
      expect(hasUV).toBe(true);
    });

    it('should handle missing uv', () => {
      mockWhich.mockReturnValue(null);

      const hasUV = detector.hasUV();
      expect(hasUV).toBe(false);
    });
  });

  describe('platform features', () => {
    it('should detect Windows features correctly', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      });

      const features = detector.getPlatformFeatures();

      expect(features.caseSensitiveFileSystem).toBe(false);
      expect(features.supportsSymlinks).toBe(true); // On NTFS
      expect(features.supportsUnixPermissions).toBe(false);
      expect(features.pathSeparator).toBe('\\');
      expect(features.lineEnding).toBe('\r\n');
      expect(features.executable).toBe('.exe');
    });

    it('should detect macOS features correctly', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      });

      const features = detector.getPlatformFeatures();

      expect(features.caseSensitiveFileSystem).toBe(false); // HFS+ default
      expect(features.supportsSymlinks).toBe(true);
      expect(features.supportsUnixPermissions).toBe(true);
      expect(features.pathSeparator).toBe('/');
      expect(features.lineEnding).toBe('\n');
      expect(features.executable).toBe('');
    });

    it('should detect Linux features correctly', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true
      });

      const features = detector.getPlatformFeatures();

      expect(features.caseSensitiveFileSystem).toBe(true);
      expect(features.supportsSymlinks).toBe(true);
      expect(features.supportsUnixPermissions).toBe(true);
      expect(features.pathSeparator).toBe('/');
      expect(features.lineEnding).toBe('\n');
      expect(features.executable).toBe('');
    });
  });

  describe('environment detection', () => {
    it('should detect CI environment', () => {
      process.env.CI = 'true';

      const isCI = detector.isCIEnvironment();
      expect(isCI).toBe(true);
    });

    it('should detect GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';

      const isGitHubActions = detector.isGitHubActions();
      expect(isGitHubActions).toBe(true);
    });

    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';

      const isDev = detector.isDevelopment();
      expect(isDev).toBe(true);
    });

    it('should detect TTY support', () => {
      const originalIsTTY = process.stdout.isTTY;

      process.stdout.isTTY = true;
      expect(detector.supportsTTY()).toBe(true);

      process.stdout.isTTY = false;
      expect(detector.supportsTTY()).toBe(false);

      process.stdout.isTTY = originalIsTTY;
    });
  });

  describe('performance characteristics', () => {
    it('should detect available memory', () => {
      const memory = detector.getAvailableMemory();
      expect(memory).toBeGreaterThan(0);
      expect(typeof memory).toBe('number');
    });

    it('should detect CPU information', () => {
      const cpuInfo = detector.getCPUInfo();
      expect(cpuInfo.cores).toBeGreaterThan(0);
      expect(cpuInfo.model).toBeDefined();
      expect(typeof cpuInfo.speed).toBe('number');
    });

    it('should recommend worker count based on CPU cores', () => {
      const workers = detector.getRecommendedWorkerCount();
      expect(workers).toBeGreaterThan(0);
      expect(workers).toBeLessThanOrEqual(require('os').cpus().length);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle missing environment variables gracefully', () => {
      delete process.env.PATH;

      expect(() => detector.findPython()).not.toThrow();
    });

    it('should handle filesystem access errors', () => {
      const mockFs = require('fs');
      mockFs.existsSync = jest.fn(() => {
        throw new Error('Permission denied');
      });

      expect(() => detector.findPython()).not.toThrow();
    });

    it('should provide fallback values for unknown platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'unknown',
        writable: true
      });

      const features = detector.getPlatformFeatures();
      expect(features).toBeDefined();
      expect(features.pathSeparator).toBeDefined();
    });
  });
});
