# NPX Package Research Synthesis: Claude Code Hooks Installer

## Executive Summary

Research into creating an npx-installable package for distributing Claude Code hooks reveals **GitHub API + npm package with bin script** is the optimal approach. This provides fast installation, selective file fetching, and broad compatibility while following 2025 npm/npx best practices.

**Recommended Approach**: Create an npm package with a bin script that uses GitHub Trees API for recursive .claude directory fetching and Contents API for individual files like CLAUDE.md.

## Key Findings

### NPX Package Distribution (2025 Standards)
- **NPX**: Bundled with npm since v5.2.0, executes packages without global installation
- **Node.js 22 LTS** ("Jod") + **npm v10** are current 2025 standards
- **Bin scripts** in package.json with shebang headers enable npx compatibility
- **Cache mechanism**: npx caches downloads in ~/.npm/_npx/ for faster subsequent runs

### File Fetching Methods Analysis

| Method | Best For | Pros | Cons | Recommendation |
|--------|----------|------|------|----------------|
| **GitHub Trees API** | Directories (.claude/) | Single request, recursive up to 100k files | Requires commit SHA lookup | **PRIMARY** |
| **GitHub Contents API** | Individual files (CLAUDE.md) | Direct file access, simple | Multiple requests for directories | **SECONDARY** |
| **Degit-style tar.gz** | Full repository copies | Fastest for large repos | Overkill for selective files | Not suitable |
| **git clone** | Full repository needs | Complete history, standard tooling | Requires git installation, slow | Not suitable |

### Implementation Patterns from Popular Tools

#### create-react-app Architecture
```json
{
  "bin": { "create-react-app": "./index.js" },
  "dependencies": {
    "chalk": "^4.1.2",        // Terminal styling
    "commander": "^4.1.1",     // CLI framework
    "cross-spawn": "^7.0.3",   // Process spawning
    "fs-extra": "^10.0.0",     // Enhanced file operations
    "prompts": "^2.4.2"        // Interactive prompts
  }
}
```

#### create-next-app Architecture
```json
{
  "bin": { "create-next-app": "./dist/index.js" },
  "dependencies": {
    "commander": "12.1.0",     // Latest CLI framework
    "prompts": "2.4.2",        // User input
    "cross-spawn": "7.0.3",    // Process management
    "async-retry": "1.3.1"     // Retry mechanisms
  },
  "engines": { "node": ">=18.18.0" }
}
```

#### degit Approach
- Downloads repositories as tar files to avoid full git history
- Caches locally at `~/.degit/user/repo/commithash.tar.gz`
- Supports multiple git providers (GitHub, GitLab, BitBucket)
- Much faster than git clone for scaffolding

## Recommended Implementation Strategy

### 1. Package Structure
```
claude-code-installer/
├── package.json
├── bin/
│   └── install.js          # Main CLI script
├── src/
│   ├── github-api.js       # GitHub API interactions
│   ├── file-manager.js     # File operations
│   └── installer.js        # Core installation logic
└── README.md
```

### 2. Package.json Configuration
```json
{
  "name": "claude-code-installer",
  "version": "1.0.0",
  "bin": {
    "claude-code-install": "./bin/install.js"
  },
  "engines": {
    "node": ">=18.18.0"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "chalk": "^5.3.0",
    "fs-extra": "^11.2.0",
    "node-fetch": "^3.3.2",
    "prompts": "^2.4.2"
  }
}
```

### 3. Implementation Approach

#### GitHub API Strategy
1. **Get Latest Commit SHA**: `GET /repos/{owner}/{repo}/commits/main`
2. **Fetch .claude Directory**: `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`
3. **Download Individual Files**: `GET /repos/{owner}/{repo}/contents/{path}`
4. **Cache Strategy**: Store API responses temporarily to avoid rate limits

#### CLI Script Structure
```javascript
#!/usr/bin/env node

// 1. Parse arguments (target directory, repository source)
// 2. Validate destination directory
// 3. Fetch repository structure via GitHub API
// 4. Filter for .claude/ and CLAUDE.md files
// 5. Download and write files to destination
// 6. Provide installation feedback
```

### 4. Key Dependencies

#### Essential Dependencies
- **commander**: Modern CLI argument parsing and command structure
- **chalk**: Terminal output styling and colors
- **fs-extra**: Enhanced file system operations with promises
- **node-fetch**: HTTP requests for GitHub API
- **prompts**: Interactive user prompts for configuration

#### Development Dependencies
- **jest**: Testing framework for CLI functionality
- **cross-env**: Environment variable management
- **prettier**: Code formatting

## Technical Considerations

### Rate Limits
- GitHub API: 5,000 requests/hour for authenticated, 60 for unauthenticated
- **Mitigation**: Cache API responses, batch requests, consider auth token support

### Cross-Platform Compatibility
- Use Node.js path module for file paths
- Avoid shell commands, use Node.js APIs
- Test on Windows, macOS, Linux

### Error Handling
- Network failures (retry with exponential backoff)
- File permission issues
- Target directory conflicts
- Invalid repository references

### Security Considerations
- Validate repository URLs
- Sanitize file paths to prevent directory traversal
- Consider file content validation
- Use HTTPS for all API requests

## Usage Examples

```bash
# Install Claude Code hooks in current directory
npx claude-code-installer

# Install from specific repository/branch
npx claude-code-installer --repo user/repo --branch feature-branch

# Install with confirmation prompts
npx claude-code-installer --interactive

# Install to specific directory
npx claude-code-installer --target ./my-project
```

## Performance Expectations

- **Cold Install**: 2-5 seconds (network dependent)
- **Cached Install**: <1 second (npx cache hit)
- **File Count**: Typical .claude directory ~10-50 files
- **Transfer Size**: Usually <1MB for complete installation

## Risk Assessment

### Low Risk
- NPX compatibility (industry standard)
- GitHub API stability (enterprise-grade)
- Cross-platform Node.js support

### Medium Risk
- GitHub API rate limits (mitigated by caching)
- Network connectivity requirements
- Package maintenance overhead

### Mitigation Strategies
- Implement comprehensive error handling
- Provide clear user feedback and troubleshooting
- Consider offline mode with pre-bundled templates
- Maintain compatibility with multiple Node.js versions

## Next Steps for Implementation

1. **Phase 1**: Create basic npm package with GitHub API integration
2. **Phase 2**: Add interactive prompts and configuration options
3. **Phase 3**: Implement caching and offline capabilities
4. **Phase 4**: Add support for custom repositories and authentication

## Confidence Level: High

This recommendation is backed by:
- Analysis of 4+ popular CLI tools (create-react-app, create-next-app, degit)
- Current 2025 npm/npx best practices research
- GitHub API capabilities and limitations assessment
- Cross-platform compatibility considerations
- Performance and security analysis

The proposed approach aligns with modern JavaScript tooling standards while providing the specific functionality needed for Claude Code hooks distribution.