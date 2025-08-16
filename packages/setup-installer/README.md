# @claude-code/setup-installer

NPX-installable package to set up Claude multi-agent orchestration in any project.

## Installation & Usage

### Quick Start
```bash
npx @claude-code/setup-installer
```

### Options
```bash
# Install to specific directory
npx @claude-code/setup-installer --dir ./my-project

# Install specific version
npx @claude-code/setup-installer --version v1.2.0

# Force overwrite existing files
npx @claude-code/setup-installer --force

# Skip Python/uv dependency check
npx @claude-code/setup-installer --no-python-check

# Development mode with verbose logging
npx @claude-code/setup-installer --dev

# Verify mode (no changes)
npx @claude-code/setup-installer --verify

# Dry run (show what would be done)
npx @claude-code/setup-installer --dry-run
```

## What Gets Installed

- `.claude/` directory with hooks, agents, and configuration
- `CLAUDE.md` project instructions file
- `settings.local.json` template for local configuration

## Development

### Package Structure
```
packages/setup-installer/
├── bin/claude-setup.js      # NPX executable entry point
├── src/
│   ├── index.js            # Main orchestrator
│   ├── cli/                # Command-line interface
│   ├── fetcher/            # GitHub API integration
│   ├── installer/          # File writing & validation
│   └── utils/              # Shared utilities
├── templates/              # Configuration templates
└── test/                   # Test suites
```

### Scripts
```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration # Integration tests
npm run test:coverage    # Coverage report
npm run lint          # ESLint
npm run dev           # Development mode
```

## Architecture

This package implements a hybrid GitHub API strategy for optimal performance:

1. **GitHub Trees API** for efficient recursive directory fetching
2. **Contents API** for individual files
3. **Fallback strategies** for rate limiting scenarios
4. **Atomic operations** with rollback on failure

## Requirements

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Internet connection for GitHub access

## License

MIT