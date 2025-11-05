#!/usr/bin/env node

/**
 * Build script for claude-comms
 * Creates optimized production build and syncs required files
 */

const fs = require('fs');
const path = require('path');

console.log('🔨 Building claude-comms...');

// For now, just ensure directories exist
const dirs = [
  'dist',
  'dist/bin',
  'dist/lib',
  'dist/src'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Sync .claude directory and CLAUDE.md from project root
console.log('📋 Syncing .claude directory and CLAUDE.md...');

const projectRoot = path.join(__dirname, '..', '..', '..');
const packageRoot = path.join(__dirname, '..');

// Copy .claude directory
const claudeSrc = path.join(projectRoot, '.claude');
const claudeDest = path.join(packageRoot, '.claude');

if (fs.existsSync(claudeSrc)) {
  // Remove existing .claude directory if it exists
  if (fs.existsSync(claudeDest)) {
    fs.rmSync(claudeDest, { recursive: true, force: true });
  }
  
  // Copy the directory recursively
  fs.cpSync(claudeSrc, claudeDest, { recursive: true });
  console.log('✅ Synced .claude directory');
} else {
  console.warn('⚠️  .claude directory not found in project root');
}

// Copy CLAUDE.md
const claudeMdSrc = path.join(projectRoot, 'CLAUDE.md');
const claudeMdDest = path.join(packageRoot, 'CLAUDE.md');

if (fs.existsSync(claudeMdSrc)) {
  fs.copyFileSync(claudeMdSrc, claudeMdDest);
  console.log('✅ Synced CLAUDE.md');
} else {
  console.warn('⚠️  CLAUDE.md not found in project root');
}

// Copy AGENTS.md
const agentsMdSrc = path.join(projectRoot, 'AGENTS.md');
const agentsMdDest = path.join(packageRoot, 'AGENTS.md');

if (fs.existsSync(agentsMdSrc)) {
  fs.copyFileSync(agentsMdSrc, agentsMdDest);
  console.log('✅ Synced AGENTS.md');
} else {
  console.warn('⚠️  AGENTS.md not found in project root');
}

console.log('✅ Build complete - directories created and files synced');
console.log('Note: Full build process will be implemented in production phase');