/**
 * Configuration management for NPX installer
 * Handles default settings, user preferences, and environment-based configuration
 */

const path = require('path');
const fs = require('fs').promises;
const { ErrorFactory } = require('./errors');
const platform = require('./platform');

/**
 * Configuration manager with defaults, validation, and persistence
 */
class Config {
  constructor(options = {}) {
    this.configPath = options.configPath || null;
    this.defaults = this.getDefaults();
    this.config = { ...this.defaults };
    this.loaded = false;
  }

  /**
   * Get default configuration values
   */
  getDefaults() {
    return {
      // Repository settings
      repository: {
        owner: 'alexsavage',
        name: 'claude-code-hooks-multi-agent-observability',
        branch: 'main',
        baseUrl: 'https://api.github.com',
        rawUrl: 'https://raw.githubusercontent.com'
      },

      // Installation settings
      installation: {
        targetDir: process.cwd(),
        createBackup: true,
        overwriteExisting: false,
        skipExistingFiles: false,
        preservePermissions: true,
        createDirectories: true
      },

      // GitHub API settings
      github: {
        token: null,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        userAgent: '@claude-code/setup-installer'
      },

      // File operations
      files: {
        excludePatterns: ['.git', 'node_modules', '.DS_Store'],
        includePatterns: ['.claude/**/*', 'CLAUDE.md'],
        encoding: 'utf8',
        lineEnding: 'auto', // auto, lf, crlf
        maxFileSize: 10 * 1024 * 1024 // 10MB
      },

      // Logging settings
      logging: {
        level: 'INFO',
        silent: false,
        timestamps: false,
        colors: true
      },

      // Dependency checking
      dependencies: {
        checkPython: true,
        checkUv: true,
        pythonVersion: '3.8',
        uvVersion: '0.1.0'
      },

      // Performance settings
      performance: {
        concurrentDownloads: 5,
        chunkSize: 64 * 1024, // 64KB
        progressUpdateInterval: 100,
        enableCache: true,
        cacheExpiry: 3600000 // 1 hour
      },

      // Security settings
      security: {
        validateChecksums: false,
        allowUnsafeOperations: false,
        restrictPaths: true,
        maxPathDepth: 10
      }
    };
  }

  /**
   * Load configuration from file
   */
  async load(configPath = null) {
    const targetPath = configPath || this.configPath;

    if (!targetPath) {
      this.loaded = true;
      return this.config;
    }

    try {
      const content = await fs.readFile(targetPath, 'utf8');
      const fileConfig = JSON.parse(content);

      // Merge with defaults
      this.config = this.mergeDeep(this.defaults, fileConfig);
      this.loaded = true;

      // Validate configuration
      this.validate();

      return this.config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, use defaults
        this.loaded = true;
        return this.config;
      }

      throw ErrorFactory.configuration(
        `Failed to load configuration from ${targetPath}: ${error.message}`,
        'configFile',
        { path: targetPath, originalError: error }
      );
    }
  }

  /**
   * Save configuration to file
   */
  async save(configPath = null) {
    const targetPath = configPath || this.configPath;

    if (!targetPath) {
      throw ErrorFactory.configuration('No configuration file path specified');
    }

    try {
      // Create directory if needed
      const dir = path.dirname(targetPath);
      await fs.mkdir(dir, { recursive: true });

      // Save configuration (exclude defaults to keep file clean)
      const configToSave = this.getDifferences();
      const content = JSON.stringify(configToSave, null, 2);
      await fs.writeFile(targetPath, content, 'utf8');

      return targetPath;
    } catch (error) {
      throw ErrorFactory.filesystem(
        `Failed to save configuration to ${targetPath}: ${error.message}`,
        { path: targetPath, originalError: error }
      );
    }
  }

  /**
   * Get configuration value with dot notation support
   */
  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Set configuration value with dot notation support
   */
  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let target = this.config;

    // Navigate to parent object
    for (const k of keys) {
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    // Set value
    target[lastKey] = value;
    return this;
  }

  /**
   * Update configuration with partial object
   */
  update(updates) {
    this.config = this.mergeDeep(this.config, updates);
    return this;
  }

  /**
   * Reset configuration to defaults
   */
  reset() {
    this.config = { ...this.defaults };
    return this;
  }

  /**
   * Get differences from defaults (for saving)
   */
  getDifferences() {
    return this.getDifferencesBetween(this.defaults, this.config);
  }

  /**
   * Get differences between two objects
   */
  getDifferencesBetween(base, current, result = {}) {
    for (const key in current) {
      if (!(key in base)) {
        // New key
        result[key] = current[key];
      } else if (typeof current[key] === 'object' && current[key] !== null && !Array.isArray(current[key])) {
        // Nested object
        const nested = this.getDifferencesBetween(base[key], current[key]);
        if (Object.keys(nested).length > 0) {
          result[key] = nested;
        }
      } else if (JSON.stringify(current[key]) !== JSON.stringify(base[key])) {
        // Different value
        result[key] = current[key];
      }
    }
    return result;
  }

  /**
   * Deep merge objects
   */
  mergeDeep(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Validate configuration values
   */
  validate() {
    const errors = [];

    // Validate repository settings
    if (!this.config.repository.owner) {
      errors.push('repository.owner is required');
    }
    if (!this.config.repository.name) {
      errors.push('repository.name is required');
    }

    // Validate installation settings
    if (!this.config.installation.targetDir) {
      errors.push('installation.targetDir is required');
    }

    // Validate GitHub settings
    if (this.config.github.timeout < 1000) {
      errors.push('github.timeout must be at least 1000ms');
    }
    if (this.config.github.retryAttempts < 0 || this.config.github.retryAttempts > 10) {
      errors.push('github.retryAttempts must be between 0 and 10');
    }

    // Validate file settings
    if (this.config.files.maxFileSize < 1024) {
      errors.push('files.maxFileSize must be at least 1KB');
    }

    // Validate performance settings
    if (this.config.performance.concurrentDownloads < 1 || this.config.performance.concurrentDownloads > 20) {
      errors.push('performance.concurrentDownloads must be between 1 and 20');
    }

    if (errors.length > 0) {
      throw ErrorFactory.validation(
        `Configuration validation failed: ${errors.join(', ')}`,
        'config',
        { errors }
      );
    }
  }

  /**
   * Apply environment variable overrides
   */
  applyEnvironmentOverrides() {
    const envMappings = {
      'CLAUDE_GITHUB_TOKEN': 'github.token',
      'CLAUDE_TARGET_DIR': 'installation.targetDir',
      'CLAUDE_LOG_LEVEL': 'logging.level',
      'CLAUDE_SKIP_DEPS': 'dependencies.checkPython',
      'CLAUDE_REPO_BRANCH': 'repository.branch'
    };

    for (const [envVar, configKey] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        // Convert string values appropriately
        let convertedValue = value;
        if (value === 'true') convertedValue = true;
        else if (value === 'false') convertedValue = false;
        else if (/^\d+$/.test(value)) convertedValue = parseInt(value, 10);

        this.set(configKey, convertedValue);
      }
    }

    return this;
  }

  /**
   * Get configuration summary for debugging
   */
  getSummary() {
    return {
      loaded: this.loaded,
      configPath: this.configPath,
      repository: `${this.config.repository.owner}/${this.config.repository.name}@${this.config.repository.branch}`,
      targetDir: this.config.installation.targetDir,
      logLevel: this.config.logging.level,
      hasGitHubToken: !!this.config.github.token,
      differences: Object.keys(this.getDifferences()).length
    };
  }

  /**
   * Create default configuration file template
   */
  static createTemplate(filePath) {
    const template = {
      $schema: 'https://raw.githubusercontent.com/alexsavage/claude-code-hooks-multi-agent-observability/main/packages/setup-installer/config-schema.json',
      repository: {
        branch: 'main'
      },
      installation: {
        createBackup: true,
        overwriteExisting: false
      },
      github: {
        token: '${GITHUB_TOKEN}'
      },
      logging: {
        level: 'INFO'
      }
    };

    return {
      path: filePath,
      content: JSON.stringify(template, null, 2),
      instructions: [
        'Edit this file to customize the installation',
        'Set GITHUB_TOKEN environment variable for API rate limits',
        'Use \'auto\' for platform-specific defaults',
        'Remove unused sections to keep defaults'
      ]
    };
  }
}

/**
 * Create a configured instance with common patterns
 */
function createConfig(options = {}) {
  // Determine config file path
  let configPath = options.configPath;

  if (!configPath && options.useGlobal) {
    configPath = path.join(platform.getConfigDir(), 'installer.json');
  } else if (!configPath && options.useLocal) {
    configPath = path.join(process.cwd(), '.claude-installer.json');
  }

  const config = new Config({ configPath });

  // Apply environment overrides if requested
  if (options.useEnvironment !== false) {
    config.applyEnvironmentOverrides();
  }

  return config;
}

/**
 * Quick access to common configuration patterns
 */
const configUtils = {
  // Create configurations
  create: (options) => createConfig(options),
  createGlobal: () => createConfig({ useGlobal: true }),
  createLocal: () => createConfig({ useLocal: true }),
  createMemory: () => new Config(),

  // Template utilities
  createTemplate: (filePath) => Config.createTemplate(filePath),

  // Direct access to Config class
  Config
};

module.exports = configUtils;
