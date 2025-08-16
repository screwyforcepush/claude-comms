/**
 * Unit tests for error handling utilities
 * @file errors.test.js
 */

const {
  InstallerError,
  GitHubAPIError,
  FileSystemError,
  NetworkError,
  ValidationError,
  ErrorFactory
} = require('../../../src/utils/errors');

describe('Error Utilities', () => {
  describe('InstallerError Base Class', () => {
    test('should create error with code and details', () => {
      const error = new InstallerError('Test message', 'TEST_CODE', { key: 'value' });

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ key: 'value' });
      expect(error.timestamp).toBeDefined();
      expect(error.name).toBe('InstallerError');
    });

    test('should serialize to JSON', () => {
      const error = new InstallerError('Test', 'CODE');
      const json = error.toJSON();

      expect(json.name).toBe('InstallerError');
      expect(json.message).toBe('Test');
      expect(json.code).toBe('CODE');
      expect(json.timestamp).toBeDefined();
    });

    test('should provide user message', () => {
      const error = new InstallerError('Technical message', 'CODE');
      expect(error.getUserMessage()).toBe('Technical message');
    });

    test('should indicate if recoverable', () => {
      const error = new InstallerError('Test', 'CODE');
      expect(error.isRecoverable()).toBe(false);
    });
  });

  describe('GitHubAPIError', () => {
    test('should detect rate limit errors', () => {
      const error = new GitHubAPIError('Rate limited', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' }
      });

      expect(error.code).toBe('GITHUB_RATE_LIMIT');
      expect(error.isRecoverable()).toBe(true);
    });

    test('should detect not found errors', () => {
      const error = new GitHubAPIError('Not found', { status: 404 });
      expect(error.code).toBe('GITHUB_NOT_FOUND');
    });

    test('should detect server errors', () => {
      const error = new GitHubAPIError('Server error', { status: 500 });
      expect(error.code).toBe('GITHUB_SERVER_ERROR');
      expect(error.isRecoverable()).toBe(true);
    });

    test('should detect connection errors', () => {
      const error = new GitHubAPIError('Connection failed', { code: 'ENOTFOUND' });
      expect(error.code).toBe('GITHUB_CONNECTION_ERROR');
      expect(error.isRecoverable()).toBe(true);
    });

    test('should provide user-friendly messages', () => {
      const rateLimitError = new GitHubAPIError('Rate limited', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' }
      });

      expect(rateLimitError.getUserMessage()).toContain('rate limit');
    });
  });

  describe('FileSystemError', () => {
    test('should detect permission errors', () => {
      const error = new FileSystemError('Permission denied', { code: 'EACCES' });
      expect(error.code).toBe('FILESYSTEM_PERMISSION_DENIED');
      expect(error.getUserMessage()).toContain('Permission denied');
    });

    test('should detect file not found errors', () => {
      const error = new FileSystemError('Not found', { code: 'ENOENT' });
      expect(error.code).toBe('FILESYSTEM_NOT_FOUND');
    });

    test('should detect disk space errors', () => {
      const error = new FileSystemError('No space', { code: 'ENOSPC' });
      expect(error.code).toBe('FILESYSTEM_NO_SPACE');
    });

    test('should detect too many files errors', () => {
      const error = new FileSystemError('Too many files', { code: 'EMFILE' });
      expect(error.code).toBe('FILESYSTEM_TOO_MANY_FILES');
      expect(error.isRecoverable()).toBe(true);
    });
  });

  describe('NetworkError', () => {
    test('should detect DNS errors', () => {
      const error = new NetworkError('DNS failed', { code: 'ENOTFOUND' });
      expect(error.code).toBe('NETWORK_DNS_ERROR');
    });

    test('should detect timeout errors', () => {
      const error = new NetworkError('Timeout', { code: 'ETIMEDOUT' });
      expect(error.code).toBe('NETWORK_TIMEOUT');
      expect(error.isRecoverable()).toBe(true);
    });

    test('should detect SSL errors', () => {
      const error = new NetworkError('SSL error', { code: 'CERT_HAS_EXPIRED' });
      expect(error.code).toBe('NETWORK_SSL_ERROR');
    });
  });

  describe('ValidationError', () => {
    test('should create validation error with field', () => {
      const error = new ValidationError('Invalid input', 'username');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('username');
      expect(error.isRecoverable()).toBe(true);
      expect(error.getUserMessage()).toContain('Invalid username');
    });

    test('should create validation error without field', () => {
      const error = new ValidationError('Invalid data');
      expect(error.getUserMessage()).toContain('Validation error');
    });
  });

  describe('ErrorFactory', () => {
    test('should create GitHub errors', () => {
      const error = ErrorFactory.github('API failed', { status: 404 });
      expect(error).toBeInstanceOf(GitHubAPIError);
      expect(error.code).toBe('GITHUB_NOT_FOUND');
    });

    test('should create filesystem errors', () => {
      const error = ErrorFactory.filesystem('Write failed', { code: 'EACCES' });
      expect(error).toBeInstanceOf(FileSystemError);
      expect(error.code).toBe('FILESYSTEM_PERMISSION_DENIED');
    });

    test('should create network errors', () => {
      const error = ErrorFactory.network('Connection failed', { code: 'ETIMEDOUT' });
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.code).toBe('NETWORK_TIMEOUT');
    });

    test('should create validation errors', () => {
      const error = ErrorFactory.validation('Invalid', 'field');
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.field).toBe('field');
    });

    test('should create from caught exceptions', () => {
      const originalError = new Error('Original');
      originalError.code = 'ENOENT';

      const installerError = ErrorFactory.fromCaught(originalError);
      expect(installerError).toBeInstanceOf(FileSystemError);
      expect(installerError.cause).toBe(originalError);
    });

    test('should pass through existing InstallerError', () => {
      const original = new GitHubAPIError('Test');
      const result = ErrorFactory.fromCaught(original);
      expect(result).toBe(original);
    });
  });
});
