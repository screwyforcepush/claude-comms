/**
 * Mock Data and Test Fixtures
 * Provides realistic test data for various testing scenarios
 */

const mockGitHubDirectoryResponse = [
  {
    name: 'agents',
    type: 'dir',
    path: '.claude/agents',
    sha: 'agents123',
    url: 'https://api.github.com/repos/alexsavage/claude-code-hooks-multi-agent-observability/contents/.claude/agents'
  },
  {
    name: 'hooks',
    type: 'dir',
    path: '.claude/hooks',
    sha: 'hooks456',
    url: 'https://api.github.com/repos/alexsavage/claude-code-hooks-multi-agent-observability/contents/.claude/hooks'
  },
  {
    name: 'settings.json',
    type: 'file',
    path: '.claude/settings.json',
    sha: 'settings789',
    size: 256,
    download_url: 'https://raw.githubusercontent.com/alexsavage/claude-code-hooks-multi-agent-observability/main/.claude/settings.json',
    url: 'https://api.github.com/repos/alexsavage/claude-code-hooks-multi-agent-observability/contents/.claude/settings.json'
  }
];

const mockGitHubHooksResponse = [
  {
    name: 'comms',
    type: 'dir',
    path: '.claude/hooks/comms',
    sha: 'comms123'
  },
  {
    name: 'prompt_capture',
    type: 'dir',
    path: '.claude/hooks/prompt_capture',
    sha: 'prompt123'
  },
  {
    name: 'install.py',
    type: 'file',
    path: '.claude/hooks/install.py',
    sha: 'install123',
    size: 1024,
    download_url: 'https://raw.githubusercontent.com/alexsavage/claude-code-hooks-multi-agent-observability/main/.claude/hooks/install.py'
  }
];

const mockGitHubAgentsResponse = [
  {
    name: 'agent-orchestrator.py',
    type: 'file',
    path: '.claude/agents/agent-orchestrator.py',
    sha: 'orch123',
    size: 4096,
    download_url: 'https://raw.githubusercontent.com/alexsavage/claude-code-hooks-multi-agent-observability/main/.claude/agents/agent-orchestrator.py'
  },
  {
    name: 'planner.py',
    type: 'file',
    path: '.claude/agents/planner.py',
    sha: 'planner123',
    size: 2048,
    download_url: 'https://raw.githubusercontent.com/alexsavage/claude-code-hooks-multi-agent-observability/main/.claude/agents/planner.py'
  }
];

const mockSettingsFileContent = {
  type: 'file',
  name: 'settings.json',
  path: '.claude/settings.json',
  content: Buffer.from(JSON.stringify({
    version: '1.0.0',
    server_url: 'http://localhost:4000',
    observability: {
      enabled: true,
      real_time: true
    },
    agents: {
      max_concurrent: 5,
      timeout: 30000
    }
  }, null, 2)).toString('base64'),
  encoding: 'base64',
  size: 256,
  sha: 'settings789'
};

const mockClaudeMdContent = `# Claude Code Multi-Agent Observability

This project provides real-time observability for Claude Code multi-agent interactions.

## Setup

1. Start the server: \`pnpm dev\`
2. Run agents with observability hooks enabled
3. View real-time interactions in the web interface

## Configuration

Edit \`settings.local.json\` to customize your setup:

\`\`\`json
{
  "server_url": "http://localhost:4000",
  "observability": {
    "enabled": true,
    "real_time": true
  }
}
\`\`\`

## Architecture

- **Server**: FastAPI backend with WebSocket support
- **Client**: Vue.js real-time dashboard
- **Hooks**: Python modules for agent communication capture
- **Agents**: Multi-agent orchestration system

## Development

Run tests: \`pnpm test\`
Start development: \`pnpm dev\`
Build for production: \`pnpm build\`
`;

const mockInstallScriptContent = `#!/usr/bin/env python3
"""
Claude Code Hooks Installation Script
Installs observability hooks for multi-agent systems
"""

import os
import sys
import json
import shutil
from pathlib import Path

def install_hooks():
    """Install observability hooks"""
    print("Installing Claude Code observability hooks...")
    
    # Create necessary directories
    claude_dir = Path('.claude')
    claude_dir.mkdir(exist_ok=True)
    
    # Install communication hooks
    install_comms_hooks()
    
    # Install prompt capture hooks
    install_prompt_hooks()
    
    # Create default configuration
    create_default_config()
    
    print("Installation complete!")

def install_comms_hooks():
    """Install communication hooks"""
    comms_dir = Path('.claude/hooks/comms')
    comms_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy communication scripts
    scripts = [
        'send_message.py',
        'get_unread_messages.py',
        'broadcast_message.py'
    ]
    
    for script in scripts:
        print(f"Installing {script}...")
        # Mock installation - in real scenario would copy files
        
def install_prompt_hooks():
    """Install prompt capture hooks"""
    prompt_dir = Path('.claude/hooks/prompt_capture')
    prompt_dir.mkdir(parents=True, exist_ok=True)
    
    print("Installing prompt capture hooks...")
    # Mock installation

def create_default_config():
    """Create default configuration"""
    config = {
        "version": "1.0.0",
        "server_url": "http://localhost:4000",
        "observability": {
            "enabled": True,
            "real_time": True
        }
    }
    
    with open('.claude/settings.json', 'w') as f:
        json.dump(config, f, indent=2)

if __name__ == '__main__':
    install_hooks()
`;

const mockDirectoryStructure = {
  '.claude': {
    'settings.json': JSON.stringify({
      version: '1.0.0',
      server_url: 'http://localhost:4000'
    }, null, 2),
    'agents': {
      'agent-orchestrator.py': '# Agent orchestrator implementation',
      'planner.py': '# Planner agent implementation'
    },
    'hooks': {
      'install.py': mockInstallScriptContent,
      'comms': {
        'send_message.py': '# Send message implementation',
        'get_unread_messages.py': '# Get messages implementation'
      },
      'prompt_capture': {
        'capture_prompt.py': '# Prompt capture implementation',
        'capture_response.py': '# Response capture implementation'
      }
    }
  },
  'CLAUDE.md': mockClaudeMdContent,
  'settings.local.json': JSON.stringify({
    server_url: 'http://localhost:4000',
    observability: {
      enabled: true,
      real_time: true
    }
  }, null, 2)
};

const mockErrorScenarios = {
  networkTimeout: {
    code: 'ETIMEDOUT',
    message: 'Request timeout',
    details: { timeout: 5000 }
  },
  rateLimited: {
    code: 'E102',
    message: 'GitHub API rate limit exceeded',
    details: {
      retryAfter: 3600,
      limit: 60,
      remaining: 0
    }
  },
  fileNotFound: {
    code: 'ENOENT',
    message: 'File not found',
    details: { path: '/nonexistent/file.txt' }
  },
  permissionDenied: {
    code: 'EACCES',
    message: 'Permission denied',
    details: { path: '/restricted/directory' }
  },
  diskFull: {
    code: 'ENOSPC',
    message: 'No space left on device',
    details: { available: 0, required: 1024000 }
  },
  invalidInput: {
    code: 'E402',
    message: 'Invalid input provided',
    details: { field: 'targetDir', value: '../../../etc' }
  }
};

const mockProgressEvents = [
  {
    task: 'Validation',
    current: 1,
    total: 5,
    percentage: 20,
    message: 'Validating target directory',
    status: 'running'
  },
  {
    task: 'Fetching',
    current: 2,
    total: 5,
    percentage: 40,
    message: 'Fetching .claude directory structure',
    status: 'running'
  },
  {
    task: 'Installing',
    current: 3,
    total: 5,
    percentage: 60,
    message: 'Installing hooks and agents',
    status: 'running'
  },
  {
    task: 'Configuration',
    current: 4,
    total: 5,
    percentage: 80,
    message: 'Creating configuration files',
    status: 'running'
  },
  {
    task: 'Complete',
    current: 5,
    total: 5,
    percentage: 100,
    message: 'Installation completed successfully',
    status: 'complete'
  }
];

const mockCLIScenarios = {
  help: {
    args: ['--help'],
    expectedOutput: [
      'Usage: claude-setup [options]',
      'Options:',
      '--dir, --target-dir <path>',
      '--force',
      '--verbose',
      'Examples:'
    ]
  },
  version: {
    args: ['--version'],
    expectedOutput: ['1.0.0']
  },
  validInstall: {
    args: ['--dir', '/tmp/test-install'],
    expectedOutput: [
      'Installing Claude Code hooks',
      'Installation completed successfully'
    ]
  },
  invalidDir: {
    args: ['--dir', '../../../etc'],
    expectedOutput: ['Error: Invalid target directory'],
    expectedError: true
  },
  forceOverwrite: {
    args: ['--dir', '/tmp/existing', '--force'],
    expectedOutput: [
      'Overwriting existing files',
      'Installation completed'
    ]
  }
};

const mockPlatformScenarios = {
  windows: {
    platform: 'win32',
    paths: {
      separator: '\\',
      python: 'C:\\Python39\\python.exe',
      home: 'C:\\Users\\User'
    },
    features: {
      caseSensitive: false,
      lineEnding: '\r\n',
      executable: '.exe'
    }
  },
  macos: {
    platform: 'darwin',
    paths: {
      separator: '/',
      python: '/usr/bin/python3',
      home: '/Users/user'
    },
    features: {
      caseSensitive: false,
      lineEnding: '\n',
      executable: ''
    }
  },
  linux: {
    platform: 'linux',
    paths: {
      separator: '/',
      python: '/usr/bin/python3',
      home: '/home/user'
    },
    features: {
      caseSensitive: true,
      lineEnding: '\n',
      executable: ''
    }
  }
};

const mockPerformanceData = {
  installation: {
    small: { files: 10, size: '1MB', time: 2000 },
    medium: { files: 50, size: '5MB', time: 8000 },
    large: { files: 200, size: '20MB', time: 25000 }
  },
  network: {
    fast: { latency: 50, bandwidth: '100MB/s' },
    slow: { latency: 500, bandwidth: '1MB/s' },
    mobile: { latency: 200, bandwidth: '5MB/s' }
  },
  memory: {
    baseline: 50 * 1024 * 1024, // 50MB
    peak: 100 * 1024 * 1024,    // 100MB
    limit: 200 * 1024 * 1024    // 200MB
  }
};

module.exports = {
  // GitHub API responses
  mockGitHubDirectoryResponse,
  mockGitHubHooksResponse,
  mockGitHubAgentsResponse,
  mockSettingsFileContent,

  // File contents
  mockClaudeMdContent,
  mockInstallScriptContent,
  mockDirectoryStructure,

  // Error scenarios
  mockErrorScenarios,

  // Progress and events
  mockProgressEvents,

  // CLI scenarios
  mockCLIScenarios,

  // Platform scenarios
  mockPlatformScenarios,

  // Performance data
  mockPerformanceData,

  // Helper functions
  generateMockFile: (size) => 'x'.repeat(size),
  generateMockDirectory: function generateMockDirectory(depth, filesPerDir) {
    const structure = {};
    for (let i = 0; i < filesPerDir; i++) {
      structure[`file-${i}.txt`] = `Content for file ${i}`;
    }
    if (depth > 1) {
      structure[`subdir-${depth}`] = generateMockDirectory(depth - 1, filesPerDir);
    }
    return structure;
  },

  createMockGitHubResponse: (path, type = 'file', content = 'mock content') => ({
    type,
    name: path.split('/').pop(),
    path,
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64',
    size: content.length,
    sha: `mock-sha-${Date.now()}`,
    download_url: `https://raw.githubusercontent.com/mock/repo/main/${path}`
  })
};
