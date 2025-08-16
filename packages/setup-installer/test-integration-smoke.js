#!/usr/bin/env node
/**
 * Integration Smoke Test for claude-comms package
 * Validates that real GitHubFetcher and FileWriter are properly integrated
 */

const { GitHubFetcher } = require('./src/fetcher/github');
const { FileWriter } = require('./src/installer/file-writer');
const { Installer } = require('./src/orchestrator/installer');

async function runSmokeTest() {
  console.log('🧪 Running integration smoke test...');
  
  try {
    // Test 1: GitHubFetcher instantiation and interface
    console.log('📡 Testing GitHubFetcher integration...');
    const fetcher = new GitHubFetcher({
      repository: {
        owner: 'screwyforcepush',
        repo: 'claude-code-subagent-bus',
        branch: 'main'
      }
    });
    
    // Verify required methods exist
    if (typeof fetcher.fetchDirectory !== 'function') {
      throw new Error('GitHubFetcher missing fetchDirectory method');
    }
    if (typeof fetcher.fetchFile !== 'function') {
      throw new Error('GitHubFetcher missing fetchFile method');
    }
    if (typeof fetcher.validateConnection !== 'function') {
      throw new Error('GitHubFetcher missing validateConnection method');
    }
    console.log('✅ GitHubFetcher interface validated');

    // Test 2: FileWriter instantiation and interface
    console.log('📁 Testing FileWriter integration...');
    const writer = new FileWriter({
      maxRetries: 2,
      retryDelay: 500
    });
    
    // Verify required methods exist
    if (typeof writer.writeFile !== 'function') {
      throw new Error('FileWriter missing writeFile method');
    }
    if (typeof writer.writeDirectory !== 'function') {
      throw new Error('FileWriter missing writeDirectory method');
    }
    if (typeof writer.backup !== 'function') {
      throw new Error('FileWriter missing backup method');
    }
    if (typeof writer.validateTarget !== 'function') {
      throw new Error('FileWriter missing validateTarget method');
    }
    console.log('✅ FileWriter interface validated');

    // Test 3: Orchestrator with real dependencies
    console.log('🎼 Testing Orchestrator with real dependencies...');
    const installer = new Installer({
      fetcher: fetcher,
      writer: writer,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {}
      },
      validator: {
        validateTargetDirectory: async () => null,
        validatePythonEnvironment: async () => null,
        checkExistingFiles: async () => null,
        validateNetworkAccess: async () => null,
        pathExists: async () => true
      }
    });
    
    // Verify installer can be created with real dependencies
    if (!installer.fetcher) {
      throw new Error('Installer missing fetcher dependency');
    }
    if (!installer.writer) {
      throw new Error('Installer missing writer dependency');
    }
    console.log('✅ Orchestrator integration validated');

    // Test 4: Validate environment check passes
    console.log('🔍 Testing environment validation...');
    const validationResult = await installer.validateEnvironment({
      targetDir: '/tmp',
      skipPythonCheck: true
    });
    
    if (typeof validationResult !== 'object' || typeof validationResult.valid !== 'boolean') {
      throw new Error('Invalid validation result format');
    }
    console.log('✅ Environment validation interface validated');

    console.log('\n🎉 Integration smoke test PASSED!');
    console.log('Real GitHubFetcher and FileWriter are properly integrated.');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Integration smoke test FAILED!');
    console.error('Error:', error.message);
    if (process.env.DEBUG) {
      console.error('Stack:', error.stack);
    }
    return false;
  }
}

// Run smoke test if called directly
if (require.main === module) {
  runSmokeTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runSmokeTest };