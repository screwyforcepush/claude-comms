# NPX Installer - Implementation Code Patterns

## Pattern 1: Updated GitHub Fetcher with Complete File List

### For BenjaminAura - Update `_fetchWithRawUrls` method

```javascript
// src/fetcher/github.js - lines 228-260
async _fetchWithRawUrls(path, options) {
  // Complete file list for .claude directory and CLAUDE.md
  const completeFileList = [
    // Core configuration
    '.claude/settings.json',
    '.claude/settings.local.json',
    
    // Agent core definitions
    '.claude/agents/core/agent-orchestrator.md',
    '.claude/agents/core/architect.md',
    '.claude/agents/core/business-analyst.md',
    '.claude/agents/core/deep-researcher.md',
    '.claude/agents/core/designer.md',
    '.claude/agents/core/engineer.md',
    '.claude/agents/core/gatekeeper.md',
    '.claude/agents/core/planner.md',
    
    // Meta agent
    '.claude/agents/meta-agent-builder.md',
    
    // Commands
    '.claude/commands/cook.md',
    '.claude/commands/new-agents.md',
    
    // Communication hooks
    '.claude/hooks/comms/get_unread_messages.py',
    '.claude/hooks/comms/register_subagent.py',
    '.claude/hooks/comms/send_message.py',
    '.claude/hooks/comms/update_subagent_completion.py',
    
    // Other hooks
    '.claude/hooks/context/repo_map.py',
    '.claude/hooks/observability/send_event.py',
    
    // Root documentation
    'CLAUDE.md'
  ];
  
  const files = [];
  const errors = [];
  
  for (const filePath of completeFileList) {
    // Filter based on requested path
    if (path === '.claude' && !filePath.startsWith('.claude')) {
      continue; // Skip CLAUDE.md when fetching .claude directory
    }
    if (path === 'CLAUDE.md' && filePath !== 'CLAUDE.md') {
      continue; // Skip .claude files when fetching CLAUDE.md
    }
    
    try {
      const content = await this._fetchSingleFileRaw(filePath, options);
      files.push(content);
      
      this.emit('progress', {
        task: 'fetch_directory',
        current: Math.round((files.length / completeFileList.length) * 100),
        message: `Fetched ${filePath}`,
        status: 'running'
      });
    } catch (error) {
      errors.push({ path: filePath, error });
      console.warn(`Failed to fetch ${filePath}: ${error.message}`);
    }
  }
  
  if (files.length === 0) {
    throw new GitHubAPIError(
      `Failed to fetch any files for path: ${path}`,
      { path, strategy: 'raw_urls', errors }
    );
  }
  
  // Log if we couldn't fetch all files
  if (errors.length > 0) {
    console.warn(`Warning: Could not fetch ${errors.length} files`);
  }
  
  return this._buildFileTree(path, files);
}
```

## Pattern 2: Trees API Path Filtering Fix

### For BenjaminAura - Fix filtering logic

```javascript
// src/fetcher/github.js - lines 164-187
async _fetchWithTrees(path, options) {
  const { version } = options;
  const url = `${this.config.baseUrl}/repos/${this.repository.owner}/${this.repository.repo}/git/trees/${version}?recursive=1`;
  
  const response = await this._makeRequest(url);
  const data = await response.json();
  
  if (data.truncated) {
    throw new GitHubAPIError(
      'Repository tree is too large for Trees API',
      { url, truncated: true }
    );
  }
  
  // Improved filtering logic for .claude directory
  let filteredFiles;
  
  if (path === '.claude') {
    // Get all files under .claude directory
    filteredFiles = data.tree.filter(item => 
      item.type === 'blob' && item.path.startsWith('.claude/')
    );
  } else if (path === 'CLAUDE.md') {
    // Get just the CLAUDE.md file
    filteredFiles = data.tree.filter(item => 
      item.type === 'blob' && item.path === 'CLAUDE.md'
    );
  } else {
    // Generic path filtering
    filteredFiles = data.tree.filter(item => {
      if (item.type !== 'blob') return false;
      
      // Match exact file or files under directory
      return item.path === path || 
             item.path.startsWith(path + '/');
    });
  }
  
  // Fetch file contents in parallel batches
  const files = await this._fetchFilesBatch(filteredFiles, options);
  
  return this._buildFileTree(path, files);
}
```

## Pattern 3: Completeness Validation

### For ChloeMatrix - Add to installer

```javascript
// src/orchestrator/installer.js - add after line 265
/**
 * Validate fetched files are complete
 */
_validateFetchedFiles(fetchedFiles) {
  const requiredFiles = require('../utils/constants').FILE_PATHS.REQUIRED_FILES;
  const fetchedPaths = new Set();
  
  // Extract all fetched file paths
  function extractPaths(obj, basePath = '') {
    if (obj.type === 'file') {
      fetchedPaths.add(obj.path);
    } else if (obj.files) {
      obj.files.forEach(file => fetchedPaths.add(file.path));
    } else if (obj.children) {
      obj.children.forEach(child => extractPaths(child, obj.path));
    }
  }
  
  Object.values(fetchedFiles).forEach(item => extractPaths(item));
  
  // Check for missing required files
  const missingFiles = requiredFiles.filter(
    required => !fetchedPaths.has(required)
  );
  
  if (missingFiles.length > 0) {
    this.logger.warn(`Warning: Missing ${missingFiles.length} required files:`);
    missingFiles.forEach(file => this.logger.warn(`  - ${file}`));
    
    // Decide whether to continue or fail
    if (missingFiles.length > requiredFiles.length * 0.5) {
      throw new InstallerError(
        `Critical: More than 50% of required files are missing. Installation cannot continue.`,
        ErrorCode.GITHUB_API_ERROR,
        { missing: missingFiles, fetched: Array.from(fetchedPaths) }
      );
    }
  }
  
  return {
    valid: missingFiles.length === 0,
    missing: missingFiles,
    fetched: Array.from(fetchedPaths)
  };
}

// Use in _fetchInstallationFiles method
async _fetchInstallationFiles() {
  this.state = InstallationState.FETCHING;
  this._emitProgress('Fetching files from GitHub...', 30);
  
  this.logger.info(`Fetching files from version: ${this.options.version}`);
  
  try {
    // Fetch .claude directory structure
    const claudeFiles = await this.fetcher.fetchDirectory('.claude', {
      version: this.options.version,
      useCache: this.options.cache,
      retryCount: 3
    });
    
    // Fetch CLAUDE.md file
    const claudeMd = await this.fetcher.fetchFile('CLAUDE.md', {
      version: this.options.version,
      useCache: this.options.cache
    });
    
    const fetchedFiles = {
      '.claude': claudeFiles,
      'CLAUDE.md': claudeMd
    };
    
    // Validate completeness
    const validation = this._validateFetchedFiles(fetchedFiles);
    if (!validation.valid) {
      this.logger.warn(`Installation may be incomplete: ${validation.missing.length} files missing`);
      
      // Optionally prompt user to continue
      if (!this.options.force) {
        throw new InstallerError(
          `Incomplete fetch: missing ${validation.missing.length} required files. Use --force to continue anyway.`,
          ErrorCode.GITHUB_API_ERROR,
          validation
        );
      }
    }
    
    // Calculate total files for progress tracking
    this.progress.total = this._countFiles(fetchedFiles);
    
    this.logger.info(`Fetched ${this.progress.total} files successfully`);
    return fetchedFiles;
    
  } catch (error) {
    throw new InstallerError(
      `Failed to fetch files from GitHub: ${error.message}`,
      ErrorCode.GITHUB_API_ERROR,
      { version: this.options.version }
    );
  }
}
```

## Pattern 4: Manifest-Based Fetching (Future Enhancement)

### For future implementation

```javascript
// src/fetcher/github.js - new method
async _fetchWithManifest(path, options) {
  try {
    // First, fetch the manifest file
    const manifestUrl = `${this.config.rawUrl}/${this.repository.owner}/${this.repository.repo}/${options.version}/.claude-manifest.json`;
    const manifestResponse = await this._makeRequest(manifestUrl);
    const manifest = await manifestResponse.json();
    
    // Filter files based on requested path
    let filesToFetch = manifest.files;
    
    if (path === '.claude') {
      filesToFetch = manifest.files.filter(f => f.startsWith('.claude/'));
    } else if (path !== '.') {
      filesToFetch = manifest.files.filter(f => 
        f === path || f.startsWith(path + '/')
      );
    }
    
    // Fetch all files in parallel batches
    const files = [];
    const batchSize = 10;
    
    for (let i = 0; i < filesToFetch.length; i += batchSize) {
      const batch = filesToFetch.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (filePath) => {
        try {
          return await this._fetchSingleFileRaw(filePath, options);
        } catch (error) {
          console.warn(`Failed to fetch ${filePath}: ${error.message}`);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      files.push(...batchResults.filter(Boolean));
      
      // Progress update
      this.emit('progress', {
        task: 'fetch_directory',
        current: Math.round((i + batchSize) / filesToFetch.length * 100),
        message: `Fetched ${Math.min(i + batchSize, filesToFetch.length)}/${filesToFetch.length} files`,
        status: 'running'
      });
    }
    
    return this._buildFileTree(path, files);
    
  } catch (error) {
    // Manifest not available, throw to trigger next strategy
    throw new GitHubAPIError(
      `Manifest-based fetch failed: ${error.message}`,
      { strategy: 'manifest', error }
    );
  }
}
```

## Pattern 5: Error Recovery and Retry

### Enhanced error handling

```javascript
// src/fetcher/github.js - enhance fetchDirectory
async fetchDirectory(path, options = {}) {
  const fetchOptions = this._prepareFetchOptions(options);
  const maxStrategyRetries = 2;
  
  const strategies = [
    { name: 'Trees API', method: () => this._fetchWithTrees(path, fetchOptions) },
    { name: 'Contents API', method: () => this._fetchWithContents(path, fetchOptions) },
    { name: 'Manifest', method: () => this._fetchWithManifest(path, fetchOptions) },
    { name: 'Raw URLs', method: () => this._fetchWithRawUrls(path, fetchOptions) }
  ];
  
  const errors = [];
  
  for (const strategy of strategies) {
    for (let attempt = 1; attempt <= maxStrategyRetries; attempt++) {
      try {
        this.emit('progress', {
          task: 'fetch_directory',
          current: 0,
          message: `Trying ${strategy.name} (attempt ${attempt}/${maxStrategyRetries})`,
          status: 'running'
        });
        
        const result = await strategy.method();
        
        // Validate result has minimum required content
        if (this._validateMinimumContent(result, path)) {
          this.emit('progress', {
            task: 'fetch_directory',
            current: 100,
            message: `Successfully fetched using ${strategy.name}`,
            status: 'complete'
          });
          
          return result;
        } else {
          throw new Error(`${strategy.name} returned incomplete results`);
        }
        
      } catch (error) {
        errors.push({
          strategy: strategy.name,
          attempt,
          error: error.message
        });
        
        console.warn(`${strategy.name} attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < maxStrategyRetries) {
          // Wait before retry
          await this._sleep(1000 * attempt);
        }
      }
    }
  }
  
  // All strategies failed
  throw new GitHubAPIError(
    'All fetch strategies failed after retries',
    { path, errors }
  );
}

_validateMinimumContent(result, path) {
  if (!result || !result.files) return false;
  
  // Minimum content validation
  if (path === '.claude') {
    // Should have at least settings.json and some agent files
    const hasCriticalFiles = result.files.some(f => 
      f.path.includes('settings.json')
    ) && result.files.some(f => 
      f.path.includes('agents/')
    );
    
    return hasCriticalFiles && result.files.length >= 10;
  }
  
  return result.files.length > 0;
}
```

## Testing Patterns

### For EllaQuantum - Test scenarios

```javascript
// test/integration/complete-installation.test.js
describe('Complete Installation Test', () => {
  it('should install all required files', async () => {
    const targetDir = path.join(__dirname, 'temp-install');
    
    const installer = new Installer({
      fetcher: new GitHubFetcher(),
      writer: new FileWriter(),
      logger: new Logger({ silent: true })
    });
    
    const result = await installer.install({
      targetDir,
      version: 'main',
      force: true
    });
    
    // Verify all required files exist
    const requiredFiles = [
      '.claude/settings.json',
      '.claude/agents/core/architect.md',
      '.claude/hooks/comms/send_message.py',
      'CLAUDE.md'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(targetDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
    
    // Verify Python scripts have correct permissions
    const pythonScripts = result.filesInstalled.filter(f => f.endsWith('.py'));
    for (const script of pythonScripts) {
      const stats = fs.statSync(script);
      expect(stats.mode & 0o100).toBeTruthy(); // Check executable bit
    }
  });
});
```