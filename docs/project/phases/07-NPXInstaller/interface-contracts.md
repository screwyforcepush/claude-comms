# NPX Installer Interface Contracts

## Module Interface Definitions

This document defines the interface contracts between modules in the @claude-code/setup-installer package. All modules must adhere to these contracts to ensure proper integration.

## Core Interfaces

### 1. CLI → Orchestrator Interface

```typescript
// CLI calls orchestrator with parsed options
interface InstallOptions {
  targetDir: string;           // Absolute path to installation directory
  version?: string;            // Git tag/commit to fetch (default: 'main')
  force?: boolean;             // Overwrite existing files without prompting
  skipPythonCheck?: boolean;   // Skip Python/uv dependency check
  verbose?: boolean;           // Enable verbose logging
  cache?: boolean;             // Use local cache if available
}

interface OrchestratorAPI {
  install(options: InstallOptions): Promise<InstallResult>;
  validateEnvironment(options: InstallOptions): Promise<ValidationResult>;
}

interface InstallResult {
  success: boolean;
  filesInstalled: string[];
  warnings: string[];
  errors?: Error[];
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
```

### 2. Orchestrator → GitHub Fetcher Interface

```typescript
interface FetcherAPI {
  fetchDirectory(path: string, options: FetchOptions): Promise<FileTree>;
  fetchFile(path: string, options: FetchOptions): Promise<FileContent>;
  validateConnection(): Promise<boolean>;
}

interface FetchOptions {
  version: string;              // Git ref (branch/tag/commit)
  useCache?: boolean;           // Check cache first
  retryCount?: number;          // Number of retry attempts
  timeout?: number;             // Request timeout in ms
}

interface FileTree {
  path: string;
  type: 'dir' | 'file';
  children?: FileTree[];
  sha?: string;                 // Git SHA for caching
  size?: number;
}

interface FileContent {
  path: string;
  content: string;              // Base64 or UTF-8 content
  encoding: 'base64' | 'utf-8';
  sha: string;
}
```

### 3. Orchestrator → File Writer Interface

```typescript
interface WriterAPI {
  writeFile(path: string, content: string, options?: WriteOptions): Promise<void>;
  writeDirectory(files: FileWrite[], options?: WriteOptions): Promise<WriteResult>;
  backup(path: string): Promise<string>;
  rollback(backupPath: string): Promise<void>;
}

interface WriteOptions {
  overwrite?: boolean;          // Overwrite existing files
  backup?: boolean;             // Create backup before overwriting
  preservePermissions?: boolean; // Maintain file permissions
  dryRun?: boolean;             // Simulate without writing
}

interface FileWrite {
  path: string;                 // Relative path from target directory
  content: string;
  encoding?: 'utf-8' | 'binary';
  permissions?: number;         // Unix file permissions
}

interface WriteResult {
  written: string[];
  skipped: string[];
  backed_up: Map<string, string>; // original path → backup path
  errors: Array<{path: string, error: Error}>;
}
```

### 4. Error Handling Interface

```typescript
// All modules must use standardized errors
class InstallerError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: any,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'InstallerError';
  }
}

enum ErrorCode {
  // Network errors (E1xx)
  NETWORK_ERROR = 'E101',
  GITHUB_RATE_LIMIT = 'E102',
  GITHUB_API_ERROR = 'E103',
  
  // File system errors (E2xx)
  FILE_WRITE_ERROR = 'E201',
  FILE_READ_ERROR = 'E202',
  PERMISSION_DENIED = 'E203',
  DISK_FULL = 'E204',
  
  // Validation errors (E3xx)
  INVALID_TARGET_DIR = 'E301',
  DEPENDENCY_MISSING = 'E302',
  INVALID_VERSION = 'E303',
  
  // User errors (E4xx)
  USER_CANCELLED = 'E401',
  INVALID_INPUT = 'E402',
}

interface ErrorHandler {
  handle(error: InstallerError): Promise<ErrorResolution>;
  canRecover(error: InstallerError): boolean;
}

interface ErrorResolution {
  action: 'retry' | 'skip' | 'abort' | 'fallback';
  message?: string;
}
```

### 5. Progress Reporting Interface

```typescript
interface ProgressReporter {
  start(task: string, total?: number): void;
  update(current: number, message?: string): void;
  complete(message?: string): void;
  fail(error: Error): void;
}

interface ProgressEvent {
  task: string;
  current: number;
  total?: number;
  percentage?: number;
  message?: string;
  status: 'running' | 'complete' | 'failed';
}

// All modules emit progress events
interface ProgressEmitter {
  on(event: 'progress', handler: (event: ProgressEvent) => void): void;
  emit(event: 'progress', data: ProgressEvent): void;
}
```

### 6. Logger Interface

```typescript
interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error): void;
  success(message: string): void;
  
  // Formatting helpers
  bold(text: string): string;
  dim(text: string): string;
  colorize(text: string, color: LogColor): string;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogColor = 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan';
```

### 7. Configuration Interface

```typescript
interface Config {
  repository: RepositoryConfig;
  defaults: DefaultOptions;
  cache: CacheConfig;
  api: APIConfig;
}

interface RepositoryConfig {
  owner: string;
  repo: string;
  branch: string;
  paths: {
    claudeDir: string;
    claudeMd: string;
  };
}

interface DefaultOptions {
  targetDir: string;
  version: string;
  retryCount: number;
  timeout: number;
}

interface CacheConfig {
  enabled: boolean;
  ttl: number;                  // Time to live in seconds
  maxSize: number;               // Max cache size in bytes
  location: string;              // Cache directory path
}

interface APIConfig {
  githubBaseUrl: string;
  githubApiVersion: string;
  userAgent: string;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
}
```

## Module Communication Patterns

### 1. Synchronous Command Flow
```
CLI.parse() 
  → Orchestrator.validate()
  → Orchestrator.install()
    → Fetcher.fetchDirectory()
    → Writer.writeDirectory()
    → Orchestrator.postInstall()
  → CLI.displayResult()
```

### 2. Asynchronous Progress Updates
```
All modules emit progress events:
  Module.emit('progress', event)
    → ProgressReporter.update()
    → CLI.displayProgress()
```

### 3. Error Propagation
```
Module throws InstallerError
  → Caught by caller
  → ErrorHandler.handle()
    → Retry/Skip/Abort/Fallback
  → Result propagated to CLI
```

## Contract Validation Rules

### Input Validation
1. All paths must be absolute before module boundaries
2. Options must be validated at entry point (CLI)
3. Types must be enforced at module boundaries

### Output Guarantees
1. Promises must resolve with defined types or reject with InstallerError
2. Progress events must include task identification
3. File operations must be atomic (all or nothing)

### Error Handling
1. All errors must be InstallerError instances
2. Error codes must be from defined enum
3. Recoverable errors must set recoverable flag

### State Management
1. Modules must be stateless between calls
2. Cache must be managed centrally
3. Rollback must restore original state

## Testing Requirements

### Unit Test Mocks
Each interface must have corresponding mock implementations:
- `MockFetcher` implements `FetcherAPI`
- `MockWriter` implements `WriterAPI`
- `MockLogger` implements `Logger`
- `MockProgressReporter` implements `ProgressReporter`

### Integration Test Contracts
- CLI → Orchestrator integration must handle all error cases
- Fetcher → Writer integration must maintain data integrity
- Progress events must flow through entire stack

### Contract Tests
- Each module must have contract tests validating interface compliance
- Breaking changes to interfaces require major version bump
- All interface changes must be documented in CHANGELOG

## Implementation Guidelines

### Module Boundaries
1. **CLI Module**: User interaction, argument parsing, display
2. **Orchestrator Module**: Coordination, workflow, validation
3. **Fetcher Module**: GitHub API, caching, network operations
4. **Writer Module**: File system operations, backup, rollback
5. **Utils Module**: Shared utilities, no business logic

### Dependency Rules
- Modules can only depend on interfaces, not implementations
- Circular dependencies are forbidden
- Utils can be used by all modules
- Config is read-only after initialization

### Performance Constraints
- Fetcher must batch API requests when possible
- Writer must use streaming for large files (>1MB)
- Progress updates must be throttled (max 10/second)
- Cache lookups must be O(1) average case

## Version Compatibility

### Breaking Changes
Changes to these interfaces constitute breaking changes:
- Removing or renaming interface methods
- Changing required parameters
- Modifying return types
- Altering error codes

### Non-Breaking Changes
These changes are backwards compatible:
- Adding optional parameters
- Adding new methods to interfaces
- Adding new error codes
- Extending types with optional fields

## Compliance Checklist

Before implementation, ensure:
- [ ] Module implements all required interfaces
- [ ] Error handling follows InstallerError pattern
- [ ] Progress events are emitted for long operations
- [ ] All paths are validated and absolute
- [ ] Mock implementations created for testing
- [ ] Interface documentation is complete
- [ ] Contract tests are written