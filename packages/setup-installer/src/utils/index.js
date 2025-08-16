/**
 * NPX Installer Utilities Module
 * Centralized export for all utility functions and classes
 */

// Core utilities
const logger = require('./logger');
const errors = require('./errors');
const platform = require('./platform');
const config = require('./config');
const retry = require('./retry');
const constants = require('./constants');

// Re-export all utilities for team integration
module.exports = {
  // Logger utilities
  logger,
  Logger: logger.Logger,

  // Error handling
  ...errors,
  ErrorFactory: errors.ErrorFactory,

  // Platform utilities
  platform,
  Platform: platform.Platform,

  // Configuration management
  config,
  Config: config.Config,

  // Retry mechanisms
  retry: retry.retry,
  RetryWrapper: retry.RetryWrapper,
  CircuitBreaker: retry.CircuitBreaker,
  retryPresets: retry.retryPresets,

  // Constants and configuration
  constants,

  // Convenience exports for common patterns
  GITHUB_URLS: constants.GITHUB_URLS,
  ERROR_CODES: constants.ERROR_CODES,
  FILE_PATHS: constants.FILE_PATHS,
  RETRY_CONFIG: constants.RETRY_CONFIG
};
