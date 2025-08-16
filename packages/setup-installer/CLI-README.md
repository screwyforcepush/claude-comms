# CLI Interface Implementation - WP05

## Overview

This document describes the CLI interface implementation for the @claude-code/setup-installer NPX package. The CLI provides the user-facing interface for installing Claude multi-agent orchestration setup into projects.

## Architecture

### Module Structure

```
lib/cli/
├── index.js           # Main entry point
├── parser.js          # Argument parsing with commander.js
├── prompts.js         # Interactive user prompts
├── runner.js          # Main orchestrator with progress indicators
└── interfaces.js      # Contracts for future integration
```

### Key Components

#### 1. Parser (`parser.js`)
- **Purpose**: Command-line argument parsing and validation
- **Framework**: commander.js
- **Features**:
  - `--force`: Skip confirmations, overwrite existing files
  - `--verbose`: Enable detailed logging
  - `--target-dir <path>`: Specify installation directory
  - `--tag <version>`: Install specific version/tag
  - `--no-python-check`: Skip Python/uv dependency checks
  - `--dry-run`: Show changes without executing
  - `--backup`: Create backups before overwriting
  - `--config-url <url>`: Custom observability server URL

#### 2. Prompts (`prompts.js`)
- **Purpose**: Interactive user interface for installation flow
- **Framework**: prompts package
- **Features**:
  - Installation directory confirmation
  - Existing file conflict resolution (backup/skip/overwrite)
  - Configuration options (server URL, Python checks)
  - Final confirmation with summary
  - Ctrl+C interrupt handling

#### 3. Runner (`runner.js`)
- **Purpose**: Main orchestrator coordinating the installation flow
- **Framework**: ora for progress indicators
- **Features**:
  - Progress spinners with detailed status
  - Mock GitHub operations (for early development)
  - File installation coordination
  - Post-installation tasks
  - Comprehensive error handling
  - Success message with next steps

#### 4. Interfaces (`interfaces.js`)
- **Purpose**: Define contracts for future module integration
- **Features**:
  - GitHub fetcher interface (WP03)
  - File writer interface (WP04)
  - Dependency checker interface
  - Mock implementations for testing
  - Service factory for dependency injection

## Interface Contracts

### CLI → Orchestrator Interface
```javascript
interface InstallOptions {
  targetDir: string;           // Absolute path
  version: string;             // Git tag/commit
  force: boolean;              // Skip prompts
  verbose: boolean;            // Detailed logging
  pythonCheck: boolean;        // Check dependencies
  dryRun: boolean;             // Simulate only
  configUrl: string;           // Server URL
}
```

### Progress Reporting
```javascript
interface ProgressEvent {
  task: string;
  current: number;
  total?: number;
  message?: string;
  status: 'running' | 'complete' | 'failed';
}
```

### Error Handling
```javascript
class InstallerError extends Error {
  constructor(message, code, details, recoverable)
}

// Error codes: E101-E199 (network), E201-E299 (filesystem), 
//              E301-E399 (validation), E401-E499 (user)
```

## Mock Implementation

The current implementation includes mock operations for:

1. **GitHub Fetching**: Simulates API calls with realistic delays
2. **File Installation**: Creates mock `.claude/` directory structure
3. **Dependency Checking**: Assumes Python/uv are available
4. **Progress Reporting**: Shows realistic installation flow

### Mock File Structure
```
.claude/
├── settings.json              # Core configuration
├── settings.local.json        # Generated local settings
├── hooks/
│   └── comms/
│       ├── send_message.py    # Team communication
│       └── get_unread_messages.py
├── agents/
│   ├── engineer.md
│   └── architect.md
└── CLAUDE.md                  # Project documentation
```

## Integration Points

### For AlexPrime (WP01 - Package Setup)
- **Required Dependencies**: 
  - `commander` for argument parsing
  - `prompts` for user interaction
  - `ora` for progress indicators
  - `chalk` for colored output
  - `fs-extra` for file operations
- **Bin Script Entry**: `lib/cli/index.js` exports `run()` function
- **Package Scripts**: Test script should call `test-cli.js`

### For BettyQuantum (WP02 - Infrastructure)
- **Logger Integration**: CLI uses structured logging interface
- **Error Handling**: All errors follow InstallerError pattern
- **Platform Detection**: CLI validates target directory cross-platform
- **Configuration**: CLI generates `settings.local.json`

### For Future WPs
- **WP03 (GitHub API)**: Replace mock fetcher with real GitHub integration
- **WP04 (File Writer)**: Replace mock writer with real file operations
- **WP06 (Orchestrator)**: CLI serves as entry point to main orchestrator

## Testing

### Test Coverage
- [x] Argument parsing with various option combinations
- [x] Help display and version information
- [x] Invalid argument validation
- [x] Dry-run mode functionality
- [x] Mock installation flow
- [ ] Interactive prompt scenarios (requires prompts package)
- [ ] Error handling and recovery (requires full dependencies)

### Test Execution
```bash
# Basic tests (no dependencies required)
node test-cli.js

# Full tests (requires npm install)
npm test
```

## Command Examples

```bash
# Basic installation
npx @claude-code/setup-installer

# Custom directory
npx @claude-code/setup-installer --target-dir ./my-project

# Force overwrite with specific version
npx @claude-code/setup-installer --force --tag v1.2.0

# Dry run to see what would be installed
npx @claude-code/setup-installer --dry-run --verbose

# Custom configuration
npx @claude-code/setup-installer --config-url http://localhost:4000 --backup
```

## Success Criteria ✅

- [x] CLI can be invoked and shows help
- [x] Arguments properly parsed and validated
- [x] Interactive prompts functional (implemented, needs testing)
- [x] Progress indicators working (mocked)
- [x] Clean interface definitions for integration
- [x] Error handling with proper codes
- [x] Cross-platform path handling
- [x] Dry-run mode implemented
- [x] Integration contracts defined

## Next Steps

1. **Dependency Installation**: Wait for AlexPrime's package.json
2. **Real Testing**: Full test suite with all dependencies
3. **Integration**: Connect with real GitHub fetcher (WP03) and file writer (WP04)
4. **Validation**: Test with actual installation scenarios
5. **Documentation**: Complete user-facing documentation

## Team Coordination

### Dependencies
- **Blocked by**: WP01 (package.json and dependencies)
- **Blocks**: WP06 (installation orchestrator needs CLI entry point)
- **Collaborates with**: WP02 (error handling), WP03 (GitHub API), WP04 (file operations)

### Integration Notes
- CLI interfaces are ready for WP03/WP04 integration
- Error handling follows EthanCosmos' standardized pattern
- Progress reporting supports real-time updates
- Mock implementations provide immediate testing capability