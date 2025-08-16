/**
 * Constants and default configuration for NPX installer
 * Centralized API endpoints, error codes, and system defaults
 */

/**
 * GitHub Repository Configuration
 */
const REPOSITORY = {
  OWNER: 'alexsavage',
  NAME: 'claude-code-hooks-multi-agent-observability',
  BRANCH: 'main',
  FULL_NAME: 'alexsavage/claude-code-hooks-multi-agent-observability'
};

/**
 * GitHub API Endpoints
 */
const GITHUB_API = {
  BASE_URL: 'https://api.github.com',
  VERSION: '2022-11-28',

  // Repository APIs
  REPO: `/repos/${REPOSITORY.FULL_NAME}`,
  CONTENTS: `/repos/${REPOSITORY.FULL_NAME}/contents`,
  TREES: `/repos/${REPOSITORY.FULL_NAME}/git/trees`,
  COMMITS: `/repos/${REPOSITORY.FULL_NAME}/commits`,
  RELEASES: `/repos/${REPOSITORY.FULL_NAME}/releases`,

  // Archive URLs
  ARCHIVE_TARBALL: `https://github.com/${REPOSITORY.FULL_NAME}/archive/refs/heads/{branch}.tar.gz`,
  ARCHIVE_ZIPBALL: `https://github.com/${REPOSITORY.FULL_NAME}/archive/refs/heads/{branch}.zip`,

  // Raw content URLs
  RAW_BASE: `https://raw.githubusercontent.com/${REPOSITORY.FULL_NAME}`,

  // Rate limiting
  RATE_LIMIT: {
    UNAUTHENTICATED: 60,    // 60 requests per hour
    AUTHENTICATED: 5000,    // 5000 requests per hour
    CORE_RESET_HEADER: 'x-ratelimit-reset',
    REMAINING_HEADER: 'x-ratelimit-remaining',
    LIMIT_HEADER: 'x-ratelimit-limit'
  }
};

/**
 * File paths and patterns
 */
const FILE_PATHS = {
  // Main installation targets
  CLAUDE_DIR: '.claude',
  CLAUDE_MD: 'CLAUDE.md',

  // Claude directory structure
  CLAUDE_SUBDIRS: [
    '.claude/agents',
    '.claude/commands',
    '.claude/hooks',
    '.claude/hooks/comms'
  ],

  // Key files to install
  REQUIRED_FILES: [
    '.claude/settings.json',
    '.claude/hooks/comms/get_unread_messages.py',
    '.claude/hooks/comms/send_message.py',
    'CLAUDE.md'
  ],

  // Configuration files
  CONFIG_FILES: [
    '.claude-installer.json',
    '.claude/settings.local.json'
  ],

  // Exclude patterns
  EXCLUDE_PATTERNS: [
    '.git',
    '.gitignore',
    'node_modules',
    '.DS_Store',
    '*.log',
    '.env',
    '.env.local',
    'dist',
    'build',
    'coverage'
  ]
};

/**
 * Error codes aligned with interface contracts
 */
const ERROR_CODES = {
  // Network errors (E1xx)
  NETWORK_ERROR: 'E101',
  GITHUB_RATE_LIMIT: 'E102',
  GITHUB_API_ERROR: 'E103',
  GITHUB_NOT_FOUND: 'E104',
  GITHUB_SERVER_ERROR: 'E105',
  GITHUB_CONNECTION_ERROR: 'E106',

  // File system errors (E2xx)
  FILE_WRITE_ERROR: 'E201',
  FILE_READ_ERROR: 'E202',
  PERMISSION_DENIED: 'E203',
  DISK_FULL: 'E204',
  FILESYSTEM_ERROR: 'E205',
  FILESYSTEM_NOT_FOUND: 'E206',
  FILESYSTEM_ALREADY_EXISTS: 'E207',
  FILESYSTEM_NO_SPACE: 'E208',
  FILESYSTEM_TOO_MANY_FILES: 'E209',

  // Validation errors (E3xx)
  INVALID_TARGET_DIR: 'E301',
  DEPENDENCY_MISSING: 'E302',
  INVALID_VERSION: 'E303',
  VALIDATION_ERROR: 'E304',

  // User errors (E4xx)
  USER_CANCELLED: 'E401',
  INVALID_INPUT: 'E402',

  // Configuration errors (E5xx)
  CONFIGURATION_ERROR: 'E501',

  // Unknown/Generic errors
  UNKNOWN_ERROR: 'E999'
};

/**
 * HTTP Status Code mappings
 */
const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

/**
 * Retry and timeout configurations
 */
const RETRY_CONFIG = {
  DEFAULT_MAX_ATTEMPTS: 3,
  DEFAULT_BASE_DELAY: 1000,
  DEFAULT_MAX_DELAY: 30000,
  DEFAULT_BACKOFF_FACTOR: 2,
  DEFAULT_JITTER_FACTOR: 0.1,

  // GitHub-specific retry config
  GITHUB: {
    MAX_ATTEMPTS: 5,
    BASE_DELAY: 2000,
    MAX_DELAY: 60000,
    RATE_LIMIT_DELAY: 60000  // 1 minute for rate limits
  },

  // Network operation retry config
  NETWORK: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 500,
    MAX_DELAY: 5000
  },

  // File system operation retry config
  FILESYSTEM: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 100,
    MAX_DELAY: 1000
  }
};

/**
 * File operation configurations
 */
const FILE_CONFIG = {
  DEFAULT_ENCODING: 'utf8',
  BINARY_ENCODING: 'binary',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  CHUNK_SIZE: 64 * 1024,           // 64KB chunks
  CONCURRENT_DOWNLOADS: 5,
  BACKUP_SUFFIX: '.backup',
  TEMP_SUFFIX: '.tmp'
};

/**
 * Logging configuration
 */
const LOG_CONFIG = {
  LEVELS: {
    DEBUG: 0,
    INFO: 1,
    SUCCESS: 2,
    WARN: 3,
    ERROR: 4
  },

  DEFAULT_LEVEL: 'INFO',

  COLORS: {
    DEBUG: 'gray',
    INFO: 'blue',
    SUCCESS: 'green',
    WARN: 'yellow',
    ERROR: 'red',
    SPINNER: 'cyan'
  },

  SYMBOLS: {
    DEBUG: '🔧',
    INFO: 'ℹ️',
    SUCCESS: '✅',
    WARN: '⚠️',
    ERROR: '❌',
    SPINNER: '⏳'
  }
};

/**
 * Progress reporting configuration
 */
const PROGRESS_CONFIG = {
  UPDATE_INTERVAL: 100,     // milliseconds
  THROTTLE_LIMIT: 10,       // max updates per second
  SPINNER_FRAMES: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  SPINNER_INTERVAL: 80      // milliseconds
};

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  DEFAULT_TTL: 3600000,     // 1 hour in milliseconds
  MAX_SIZE: 100 * 1024 * 1024, // 100MB
  CLEANUP_INTERVAL: 300000, // 5 minutes

  CACHE_KEYS: {
    GITHUB_TREES: 'github:trees',
    GITHUB_CONTENTS: 'github:contents',
    FILE_METADATA: 'file:metadata'
  }
};

/**
 * Dependency requirements
 */
const DEPENDENCIES = {
  PYTHON: {
    MINIMUM_VERSION: '3.8.0',
    COMMANDS: ['python3', 'python'],
    VERSION_FLAGS: ['--version', '-V']
  },

  UV: {
    MINIMUM_VERSION: '0.1.0',
    COMMANDS: ['uv'],
    VERSION_FLAGS: ['--version']
  },

  NODE: {
    MINIMUM_VERSION: '18.0.0',
    COMMANDS: ['node'],
    VERSION_FLAGS: ['--version']
  }
};

/**
 * User interface messages and prompts
 */
const UI_MESSAGES = {
  WELCOME: '🚀 Claude Code Setup Installer',
  SUCCESS: '✅ Installation complete!',
  CANCELLED: '❌ Installation cancelled by user',

  PROMPTS: {
    CONFIRM_INSTALL: 'Install Claude setup to this directory?',
    OVERWRITE_CONFIRM: 'Directory contains existing files. Overwrite?',
    BACKUP_CONFIRM: 'Create backup before overwriting?',
    CONTINUE_ON_ERROR: 'Continue installation despite errors?'
  },

  PROGRESS: {
    FETCHING: 'Fetching files from GitHub...',
    DOWNLOADING: 'Downloading repository contents...',
    WRITING: 'Writing files to disk...',
    VALIDATING: 'Validating installation...',
    BACKING_UP: 'Creating backup...',
    CLEANING_UP: 'Cleaning up temporary files...'
  }
};

/**
 * Platform-specific constants
 */
const PLATFORM_CONFIG = {
  WINDOWS: {
    LINE_ENDING: '\r\n',
    PATH_SEPARATOR: '\\',
    EXECUTABLE_EXTENSION: '.exe'
  },

  UNIX: {
    LINE_ENDING: '\n',
    PATH_SEPARATOR: '/',
    EXECUTABLE_EXTENSION: ''
  },

  CONFIG_DIRS: {
    WINDOWS: '%APPDATA%',
    MACOS: '~/Library/Application Support',
    LINUX: '~/.config'
  }
};

/**
 * Package metadata
 */
const PACKAGE_INFO = {
  NAME: '@claude-code/setup-installer',
  VERSION: '1.0.0', // Will be replaced by actual package.json
  USER_AGENT: '@claude-code/setup-installer/1.0.0',
  REPOSITORY: 'https://github.com/alexsavage/claude-code-hooks-multi-agent-observability',
  HOMEPAGE: 'https://claude.ai/code',
  BUGS_URL: 'https://github.com/alexsavage/claude-code-hooks-multi-agent-observability/issues'
};

/**
 * Build complete GitHub URLs
 */
const GITHUB_URLS = {
  // Get repository contents
  getContentsUrl: (path = '', ref = REPOSITORY.BRANCH) =>
    `${GITHUB_API.BASE_URL}${GITHUB_API.CONTENTS}/${path}?ref=${ref}`,

  // Get git tree (recursive directory listing)
  getTreeUrl: (ref = REPOSITORY.BRANCH, recursive = true) =>
    `${GITHUB_API.BASE_URL}${GITHUB_API.TREES}/${ref}${recursive ? '?recursive=1' : ''}`,

  // Get raw file content
  getRawUrl: (path, ref = REPOSITORY.BRANCH) =>
    `${GITHUB_API.RAW_BASE}/${ref}/${path}`,

  // Get archive download
  getArchiveUrl: (format = 'tarball', ref = REPOSITORY.BRANCH) =>
    GITHUB_API[`ARCHIVE_${format.toUpperCase()}`].replace('{branch}', ref),

  // Get rate limit status
  getRateLimitUrl: () =>
    `${GITHUB_API.BASE_URL}/rate_limit`
};

/**
 * Validation patterns and rules
 */
const VALIDATION = {
  // Path validation
  SAFE_PATH_PATTERN: /^[a-zA-Z0-9._/-]+$/,
  MAX_PATH_LENGTH: 260, // Windows limitation
  MAX_PATH_DEPTH: 10,

  // Version patterns
  VERSION_PATTERN: /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/,
  SEMVER_PATTERN: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,

  // File size limits
  MAX_SINGLE_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_TOTAL_SIZE: 500 * 1024 * 1024,      // 500MB

  // GitHub constraints
  MAX_FILES_PER_REQUEST: 100,
  MAX_CONTENT_SIZE: 1024 * 1024 // 1MB for Contents API
};

module.exports = {
  REPOSITORY,
  GITHUB_API,
  GITHUB_URLS,
  FILE_PATHS,
  ERROR_CODES,
  HTTP_STATUS,
  RETRY_CONFIG,
  FILE_CONFIG,
  LOG_CONFIG,
  PROGRESS_CONFIG,
  CACHE_CONFIG,
  DEPENDENCIES,
  UI_MESSAGES,
  PLATFORM_CONFIG,
  PACKAGE_INFO,
  VALIDATION
};
