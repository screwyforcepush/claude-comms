/**
 * Custom error classes for standardized error handling
 * Provides consistent error codes and messages across the NPX installer
 */

/**
 * Base installer error with error codes and details
 */
class InstallerError extends Error {
  constructor(message, code, details = null, cause = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.cause = cause;
    this.timestamp = new Date().toISOString();

    // Maintain stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/debugging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage() {
    return this.message;
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable() {
    return false; // Override in subclasses
  }
}

/**
 * GitHub API related errors
 */
class GitHubAPIError extends InstallerError {
  constructor(message, details = null, cause = null) {
    const errorCode = GitHubAPIError.getErrorCode(details);
    super(message, errorCode, details, cause);
  }

  static getErrorCode(details) {
    if (details?.status === 403 && details?.headers?.['x-ratelimit-remaining'] === '0') {
      return 'GITHUB_RATE_LIMIT';
    }
    if (details?.status === 404) {
      return 'GITHUB_NOT_FOUND';
    }
    if (details?.status >= 500) {
      return 'GITHUB_SERVER_ERROR';
    }
    if (details?.code === 'ENOTFOUND' || details?.code === 'ECONNREFUSED') {
      return 'GITHUB_CONNECTION_ERROR';
    }
    return 'GITHUB_API_ERROR';
  }

  getUserMessage() {
    switch (this.code) {
    case 'GITHUB_RATE_LIMIT':
      return 'GitHub API rate limit exceeded. Please wait a few minutes and try again, or use a GitHub token for higher limits.';
    case 'GITHUB_NOT_FOUND':
      return 'Repository or file not found on GitHub. Please check the repository URL and try again.';
    case 'GITHUB_SERVER_ERROR':
      return 'GitHub is experiencing server issues. Please try again in a few minutes.';
    case 'GITHUB_CONNECTION_ERROR':
      return 'Unable to connect to GitHub. Please check your internet connection and try again.';
    default:
      return 'Failed to fetch files from GitHub. Please try again or check your internet connection.';
    }
  }

  isRecoverable() {
    return ['GITHUB_RATE_LIMIT', 'GITHUB_SERVER_ERROR', 'GITHUB_CONNECTION_ERROR'].includes(this.code);
  }
}

/**
 * File system operation errors
 */
class FileSystemError extends InstallerError {
  constructor(message, details = null, cause = null) {
    const errorCode = FileSystemError.getErrorCode(details);
    super(message, errorCode, details, cause);
  }

  static getErrorCode(details) {
    if (details?.code === 'EACCES' || details?.code === 'EPERM') {
      return 'FILESYSTEM_PERMISSION_DENIED';
    }
    if (details?.code === 'ENOENT') {
      return 'FILESYSTEM_NOT_FOUND';
    }
    if (details?.code === 'EEXIST') {
      return 'FILESYSTEM_ALREADY_EXISTS';
    }
    if (details?.code === 'ENOSPC') {
      return 'FILESYSTEM_NO_SPACE';
    }
    if (details?.code === 'EMFILE' || details?.code === 'ENFILE') {
      return 'FILESYSTEM_TOO_MANY_FILES';
    }
    return 'FILESYSTEM_ERROR';
  }

  getUserMessage() {
    switch (this.code) {
    case 'FILESYSTEM_PERMISSION_DENIED':
      return 'Permission denied. Please run with appropriate permissions or choose a different directory.';
    case 'FILESYSTEM_NOT_FOUND':
      return 'Directory or file not found. Please check the path and try again.';
    case 'FILESYSTEM_ALREADY_EXISTS':
      return 'File or directory already exists. Use --force to overwrite or choose a different location.';
    case 'FILESYSTEM_NO_SPACE':
      return 'Not enough disk space to complete the installation.';
    case 'FILESYSTEM_TOO_MANY_FILES':
      return 'Too many open files. Please close some applications and try again.';
    default:
      return 'File system operation failed. Please check permissions and available space.';
    }
  }

  isRecoverable() {
    return ['FILESYSTEM_TOO_MANY_FILES'].includes(this.code);
  }
}

/**
 * Network related errors
 */
class NetworkError extends InstallerError {
  constructor(message, details = null, cause = null) {
    const errorCode = NetworkError.getErrorCode(details);
    super(message, errorCode, details, cause);
  }

  static getErrorCode(details) {
    if (details?.code === 'ENOTFOUND') {
      return 'NETWORK_DNS_ERROR';
    }
    if (details?.code === 'ECONNREFUSED') {
      return 'NETWORK_CONNECTION_REFUSED';
    }
    if (details?.code === 'ETIMEDOUT') {
      return 'NETWORK_TIMEOUT';
    }
    if (details?.code === 'CERT_HAS_EXPIRED' || details?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      return 'NETWORK_SSL_ERROR';
    }
    return 'NETWORK_ERROR';
  }

  getUserMessage() {
    switch (this.code) {
    case 'NETWORK_DNS_ERROR':
      return 'DNS resolution failed. Please check your internet connection and DNS settings.';
    case 'NETWORK_CONNECTION_REFUSED':
      return 'Connection refused. The server may be down or unreachable.';
    case 'NETWORK_TIMEOUT':
      return 'Network request timed out. Please check your internet connection and try again.';
    case 'NETWORK_SSL_ERROR':
      return 'SSL certificate error. Please check your system time and certificate store.';
    default:
      return 'Network error occurred. Please check your internet connection and try again.';
    }
  }

  isRecoverable() {
    return ['NETWORK_TIMEOUT', 'NETWORK_CONNECTION_REFUSED'].includes(this.code);
  }
}

/**
 * Input validation errors
 */
class ValidationError extends InstallerError {
  constructor(message, field = null, details = null) {
    super(message, 'VALIDATION_ERROR', { field, ...details });
    this.field = field;
  }

  getUserMessage() {
    if (this.field) {
      return `Invalid ${this.field}: ${this.message}`;
    }
    return `Validation error: ${this.message}`;
  }

  isRecoverable() {
    return true; // User can correct input
  }
}

/**
 * Dependency check errors
 */
class DependencyError extends InstallerError {
  constructor(message, dependency, details = null) {
    super(message, 'DEPENDENCY_ERROR', { dependency, ...details });
    this.dependency = dependency;
  }

  getUserMessage() {
    return `Missing dependency: ${this.dependency}. ${this.message}`;
  }

  isRecoverable() {
    return true; // User can install dependencies
  }
}

/**
 * User cancellation error
 */
class UserCancelledError extends InstallerError {
  constructor(message = 'Installation cancelled by user') {
    super(message, 'USER_CANCELLED');
  }

  getUserMessage() {
    return this.message;
  }

  isRecoverable() {
    return false;
  }
}

/**
 * Configuration errors
 */
class ConfigurationError extends InstallerError {
  constructor(message, configKey = null, details = null) {
    super(message, 'CONFIGURATION_ERROR', { configKey, ...details });
    this.configKey = configKey;
  }

  getUserMessage() {
    if (this.configKey) {
      return `Configuration error in '${this.configKey}': ${this.message}`;
    }
    return `Configuration error: ${this.message}`;
  }

  isRecoverable() {
    return true; // User can fix configuration
  }
}

/**
 * Error factory for creating appropriate error types
 */
class ErrorFactory {
  /**
   * Create an error from a caught exception
   */
  static fromCaught(error, context = null) {
    if (error instanceof InstallerError) {
      return error;
    }

    // Network errors
    if (error.code && ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code)) {
      return new NetworkError(error.message, { code: error.code, context }, error);
    }

    // File system errors
    if (error.code && ['EACCES', 'EPERM', 'ENOENT', 'EEXIST', 'ENOSPC'].includes(error.code)) {
      return new FileSystemError(error.message, { code: error.code, context }, error);
    }

    // GitHub API errors (based on fetch response)
    if (error.status || (context && context.includes('github'))) {
      return new GitHubAPIError(error.message, { status: error.status, context }, error);
    }

    // Generic installer error
    return new InstallerError(error.message, 'UNKNOWN_ERROR', { context }, error);
  }

  /**
   * Create a GitHub API error
   */
  static github(message, details) {
    return new GitHubAPIError(message, details);
  }

  /**
   * Create a file system error
   */
  static filesystem(message, details) {
    return new FileSystemError(message, details);
  }

  /**
   * Create a network error
   */
  static network(message, details) {
    return new NetworkError(message, details);
  }

  /**
   * Create a validation error
   */
  static validation(message, field, details) {
    return new ValidationError(message, field, details);
  }

  /**
   * Create a dependency error
   */
  static dependency(message, dependency, details) {
    return new DependencyError(message, dependency, details);
  }

  /**
   * Create a user cancelled error
   */
  static userCancelled(message) {
    return new UserCancelledError(message);
  }

  /**
   * Create a configuration error
   */
  static configuration(message, configKey, details) {
    return new ConfigurationError(message, configKey, details);
  }
}

module.exports = {
  InstallerError,
  GitHubAPIError,
  FileSystemError,
  NetworkError,
  ValidationError,
  DependencyError,
  UserCancelledError,
  ConfigurationError,
  ErrorFactory
};
