/**
 * Output Capture Utilities
 * Provides tools for capturing and analyzing console output, streams, and process output
 */

const EventEmitter = require('events');
const { Writable } = require('stream');

class OutputCapture extends EventEmitter {
  constructor(options = {}) {
    super();
    this.capturedOutput = [];
    this.capturedErrors = [];
    this.isCapturing = false;
    this.originalMethods = {};
    this.options = {
      captureConsole: true,
      captureProcess: true,
      captureStreams: true,
      preserveColors: false,
      ...options
    };
  }

  /**
   * Start capturing output
   */
  start() {
    if (this.isCapturing) {
      throw new Error('Output capture is already active');
    }

    this.capturedOutput = [];
    this.capturedErrors = [];
    this.isCapturing = true;

    if (this.options.captureConsole) {
      this._captureConsole();
    }

    if (this.options.captureProcess) {
      this._captureProcess();
    }

    if (this.options.captureStreams) {
      this._captureStreams();
    }

    this.emit('capture-started');
    return this;
  }

  /**
   * Stop capturing and return results
   */
  stop() {
    if (!this.isCapturing) {
      throw new Error('Output capture is not active');
    }

    this._restoreMethods();
    this.isCapturing = false;

    const results = {
      output: [...this.capturedOutput],
      errors: [...this.capturedErrors],
      combined: this._getCombinedOutput(),
      stats: this._getOutputStats()
    };

    this.emit('capture-stopped', results);
    return results;
  }

  /**
   * Get current captured output without stopping
   */
  getOutput() {
    return {
      output: [...this.capturedOutput],
      errors: [...this.capturedErrors],
      combined: this._getCombinedOutput()
    };
  }

  /**
   * Clear captured output without stopping capture
   */
  clear() {
    this.capturedOutput = [];
    this.capturedErrors = [];
    this.emit('capture-cleared');
    return this;
  }

  /**
   * Capture console methods
   */
  _captureConsole() {
    const methods = ['log', 'info', 'warn', 'error', 'debug'];

    methods.forEach(method => {
      this.originalMethods[`console.${method}`] = console[method];
      console[method] = (...args) => {
        this._recordOutput(method, args, 'console');

        // Optionally call original method
        if (this.options.passthrough) {
          this.originalMethods[`console.${method}`](...args);
        }
      };
    });
  }

  /**
   * Capture process stdout/stderr
   */
  _captureProcess() {
    // Capture process.stdout.write
    if (process.stdout.write) {
      this.originalMethods['process.stdout.write'] = process.stdout.write;
      process.stdout.write = (chunk, encoding, callback) => {
        this._recordOutput('stdout', [chunk], 'process');

        if (this.options.passthrough) {
          return this.originalMethods['process.stdout.write'].call(
            process.stdout, chunk, encoding, callback
          );
        }

        if (typeof encoding === 'function') {
          encoding();
        } else if (typeof callback === 'function') {
          callback();
        }
        return true;
      };
    }

    // Capture process.stderr.write
    if (process.stderr.write) {
      this.originalMethods['process.stderr.write'] = process.stderr.write;
      process.stderr.write = (chunk, encoding, callback) => {
        this._recordOutput('stderr', [chunk], 'process');

        if (this.options.passthrough) {
          return this.originalMethods['process.stderr.write'].call(
            process.stderr, chunk, encoding, callback
          );
        }

        if (typeof encoding === 'function') {
          encoding();
        } else if (typeof callback === 'function') {
          callback();
        }
        return true;
      };
    }
  }

  /**
   * Capture custom streams
   */
  _captureStreams() {
    // This is a placeholder for custom stream capture
    // Can be extended for specific stream capturing needs
  }

  /**
   * Record captured output
   */
  _recordOutput(method, args, source) {
    const timestamp = Date.now();
    const formattedArgs = args.map(arg => this._formatArgument(arg));

    const entry = {
      timestamp,
      method,
      source,
      args: formattedArgs,
      raw: args,
      text: formattedArgs.join(' ')
    };

    if (method === 'error' || method === 'stderr') {
      this.capturedErrors.push(entry);
    } else {
      this.capturedOutput.push(entry);
    }

    this.emit('output-captured', entry);
  }

  /**
   * Format individual arguments
   */
  _formatArgument(arg) {
    if (typeof arg === 'string') {
      return this.options.preserveColors ? arg : this._stripColors(arg);
    }

    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}`;
    }

    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (error) {
        return '[Object object]';
      }
    }

    return String(arg);
  }

  /**
   * Strip ANSI color codes
   */
  _stripColors(text) {
    // Strip ANSI color codes using split/join to avoid control character regex
    const esc = '\u001b[';
    const parts = text.split(esc);
    if (parts.length === 1) return text;

    let result = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const mIndex = part.indexOf('m');
      if (mIndex !== -1) {
        result += part.substring(mIndex + 1);
      } else {
        result += esc + part;
      }
    }
    return result;
  }

  /**
   * Get combined output in chronological order
   */
  _getCombinedOutput() {
    const all = [...this.capturedOutput, ...this.capturedErrors];
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Generate output statistics
   */
  _getOutputStats() {
    const all = this._getCombinedOutput();

    const stats = {
      totalEntries: all.length,
      outputEntries: this.capturedOutput.length,
      errorEntries: this.capturedErrors.length,
      byMethod: {},
      bySource: {},
      timespan: 0,
      averageInterval: 0
    };

    // Count by method and source
    all.forEach(entry => {
      stats.byMethod[entry.method] = (stats.byMethod[entry.method] || 0) + 1;
      stats.bySource[entry.source] = (stats.bySource[entry.source] || 0) + 1;
    });

    // Calculate timespan
    if (all.length > 1) {
      stats.timespan = all[all.length - 1].timestamp - all[0].timestamp;
      stats.averageInterval = stats.timespan / (all.length - 1);
    }

    return stats;
  }

  /**
   * Restore original methods
   */
  _restoreMethods() {
    Object.entries(this.originalMethods).forEach(([key, method]) => {
      const [object, prop] = key.split('.');
      if (object === 'console') {
        console[prop] = method;
      } else if (object === 'process' && prop.includes('.')) {
        const [stream, streamProp] = prop.split('.');
        process[stream][streamProp] = method;
      }
    });

    this.originalMethods = {};
  }

  /**
   * Search captured output
   */
  search(pattern, options = {}) {
    const {
      regex = false,
      caseSensitive = false,
      includeErrors = true
    } = options;

    const searchData = includeErrors ?
      this._getCombinedOutput() :
      this.capturedOutput;

    const searchPattern = regex ?
      pattern :
      new RegExp(
        pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        caseSensitive ? 'g' : 'gi'
      );

    return searchData.filter(entry =>
      searchPattern.test(entry.text)
    );
  }

  /**
   * Get output within time range
   */
  getOutputInRange(startTime, endTime) {
    return this._getCombinedOutput().filter(entry =>
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }

  /**
   * Get output by method type
   */
  getOutputByMethod(method) {
    return this._getCombinedOutput().filter(entry =>
      entry.method === method
    );
  }

  /**
   * Get formatted output as string
   */
  toString(options = {}) {
    const {
      includeTimestamps = false,
      includeMethod = false,
      includeSource = false,
      separator = '\n'
    } = options;

    return this._getCombinedOutput()
      .map(entry => {
        let line = entry.text;

        if (includeSource) {
          line = `[${entry.source}] ${line}`;
        }

        if (includeMethod) {
          line = `[${entry.method}] ${line}`;
        }

        if (includeTimestamps) {
          const timestamp = new Date(entry.timestamp).toISOString();
          line = `${timestamp} ${line}`;
        }

        return line;
      })
      .join(separator);
  }

  /**
   * Export captured output to file
   */
  async exportToFile(filePath, options = {}) {
    const fs = require('fs').promises;
    const content = this.toString(options);

    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  /**
   * Create a scoped capture for specific operations
   */
  static async capture(operation, options = {}) {
    const capture = new OutputCapture(options);
    capture.start();

    try {
      const result = await operation();
      const output = capture.stop();

      return {
        result,
        output: output.output,
        errors: output.errors,
        combined: output.combined,
        stats: output.stats
      };
    } catch (error) {
      const output = capture.stop();

      throw Object.assign(error, {
        capturedOutput: output.output,
        capturedErrors: output.errors
      });
    }
  }
}

/**
 * Stream-based output capture
 */
class StreamCapture extends Writable {
  constructor(options = {}) {
    super(options);
    this.captured = [];
    this.options = options;
  }

  _write(chunk, encoding, callback) {
    this.captured.push({
      timestamp: Date.now(),
      chunk: chunk.toString(),
      encoding
    });

    if (this.options.passthrough && this.options.destination) {
      this.options.destination.write(chunk, encoding, callback);
    } else {
      callback();
    }
  }

  getOutput() {
    return this.captured;
  }

  toString() {
    return this.captured.map(item => item.chunk).join('');
  }

  clear() {
    this.captured = [];
  }
}

module.exports = {
  OutputCapture,
  StreamCapture
};
