/**
 * Unit tests for logger utility - Fixed version
 * @file logger-fixed.test.js
 */

const loggerModule = require('../../../src/utils/logger');
const { Logger } = loggerModule;
const logger = loggerModule;

describe('Logger Utility', () => {
  let consoleLogSpy, consoleWarnSpy, consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Default Logger', () => {
    test('should log info messages', () => {
      logger.info('Test message');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Test message');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('ℹ️');
    });

    test('should log success messages', () => {
      logger.success('Success message');
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Success message');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('✅');
    });

    test('should log warning messages', () => {
      logger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('Warning message');
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('⚠️');
    });

    test('should log error messages', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error message');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('❌');
    });

    test('should respect log levels', () => {
      logger.setLevel('ERROR');
      logger.info('Should not log');
      logger.error('Should log');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('should support silent mode', () => {
      logger.setSilent(true);
      logger.info('Silent message');
      logger.setSilent(false);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('Logger Class', () => {
    test('should create logger with custom options', () => {
      const customLogger = new Logger({
        level: 'WARN',
        prefix: 'test-prefix',
        timestamps: true
      });

      expect(customLogger.level).toBe('WARN');
      expect(customLogger.prefix).toBe('test-prefix');
      expect(customLogger.timestamps).toBe(true);
    });

    test('should create child loggers', () => {
      const parentLogger = new Logger({ prefix: 'parent' });
      const childLogger = parentLogger.child({ prefix: 'child' });

      expect(childLogger.prefix).toBe('child');
      expect(childLogger.level).toBe(parentLogger.level);
    });

    test('should format messages with data', () => {
      const testLogger = new Logger({ silent: false });
      testLogger.info('Test message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const loggedMessage = consoleLogSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('Test message');
      expect(loggedMessage).toContain('value');
    });
  });

  describe('Log Level Validation', () => {
    test('should handle invalid log levels gracefully', () => {
      // Logger should handle invalid levels without throwing
      expect(() => {
        logger.setLevel('INVALID');
        logger.info('test message');
      }).not.toThrow();
    });

    test('should filter messages based on level hierarchy', () => {
      const testLogger = new Logger({ level: 'WARN' });

      expect(testLogger.shouldLog('DEBUG')).toBe(false);
      expect(testLogger.shouldLog('INFO')).toBe(false);
      expect(testLogger.shouldLog('WARN')).toBe(true);
      expect(testLogger.shouldLog('ERROR')).toBe(true);
    });
  });
});
