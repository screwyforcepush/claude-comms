/**
 * Logger utility for colored console output
 * Provides consistent logging across the NPX installer with chalk-based colors
 */

const chalk = require('chalk');

/**
 * Log levels with corresponding colors and symbols
 */
const LOG_LEVELS = {
  DEBUG: { color: chalk.gray, symbol: '🔧', level: 0 },
  INFO: { color: chalk.blue, symbol: 'ℹ️', level: 1 },
  SUCCESS: { color: chalk.green, symbol: '✅', level: 2 },
  WARN: { color: chalk.yellow, symbol: '⚠️', level: 3 },
  ERROR: { color: chalk.red, symbol: '❌', level: 4 },
  SPINNER: { color: chalk.cyan, symbol: '⏳', level: 1 }
};

/**
 * Logger class with colored output and level filtering
 */
class Logger {
  constructor(options = {}) {
    this.level = options.level || 'INFO';
    this.prefix = options.prefix || '@claude-code/setup-installer';
    this.timestamps = options.timestamps || false;
    this.silent = options.silent || false;
  }

  /**
   * Check if message should be logged based on level
   */
  shouldLog(messageLevel) {
    if (this.silent) return false;
    const currentLevel = LOG_LEVELS[this.level]?.level || 1;
    const msgLevel = LOG_LEVELS[messageLevel]?.level || 1;
    return msgLevel >= currentLevel;
  }

  /**
   * Format a log message with prefix, timestamp, and color
   */
  formatMessage(level, message, data = null) {
    const config = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    const timestamp = this.timestamps ? chalk.gray(`[${new Date().toISOString()}]`) : '';
    const prefix = chalk.bold(`[${this.prefix}]`);
    const symbol = config.symbol;
    const coloredMessage = config.color(message);

    let formatted = `${timestamp} ${prefix} ${symbol} ${coloredMessage}`;

    if (data) {
      formatted += '\n' + this.formatData(data);
    }

    return formatted;
  }

  /**
   * Format additional data for logging
   */
  formatData(data) {
    if (typeof data === 'object') {
      return chalk.gray(JSON.stringify(data, null, 2));
    }
    return chalk.gray(String(data));
  }

  /**
   * Log a debug message
   */
  debug(message, data) {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  /**
   * Log an info message
   */
  info(message, data) {
    if (this.shouldLog('INFO')) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  /**
   * Log a success message
   */
  success(message, data) {
    if (this.shouldLog('SUCCESS')) {
      console.log(this.formatMessage('SUCCESS', message, data));
    }
  }

  /**
   * Log a warning message
   */
  warn(message, data) {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  /**
   * Log an error message
   */
  error(message, data) {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatMessage('ERROR', message, data));
    }
  }

  /**
   * Log a spinner/progress message
   */
  spinner(message, data) {
    if (this.shouldLog('SPINNER')) {
      console.log(this.formatMessage('SPINNER', message, data));
    }
  }

  /**
   * Create a new logger with different options
   */
  child(options) {
    return new Logger({
      level: this.level,
      prefix: this.prefix,
      timestamps: this.timestamps,
      silent: this.silent,
      ...options
    });
  }

  /**
   * Set the log level
   */
  setLevel(level) {
    if (LOG_LEVELS[level]) {
      this.level = level;
    } else {
      this.warn(`Invalid log level: ${level}. Using INFO instead.`);
    }
  }

  /**
   * Enable or disable silent mode
   */
  setSilent(silent) {
    this.silent = silent;
  }
}

/**
 * Default logger instance
 */
const defaultLogger = new Logger();

/**
 * Convenience functions using default logger
 */
const logger = {
  debug: (msg, data) => defaultLogger.debug(msg, data),
  info: (msg, data) => defaultLogger.info(msg, data),
  success: (msg, data) => defaultLogger.success(msg, data),
  warn: (msg, data) => defaultLogger.warn(msg, data),
  error: (msg, data) => defaultLogger.error(msg, data),
  spinner: (msg, data) => defaultLogger.spinner(msg, data),
  setLevel: (level) => defaultLogger.setLevel(level),
  setSilent: (silent) => defaultLogger.setSilent(silent),
  child: (options) => defaultLogger.child(options),
  Logger
};

module.exports = logger;
