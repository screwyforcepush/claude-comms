#!/usr/bin/env node

/**
 * Emergency test for v1.0.4 tarball extraction fix
 * Tests the critical bug fix for file extraction
 */

const { GitHubFetcher } = require('./src/fetcher/github.js');

async function testTarballExtraction() {
  console.log('🧪 Testing emergency fix for tarball extraction...\n');
  
  const fetcher = new GitHubFetcher({
    repository: {
      owner: 'screwyforcepush',
      repo: 'claude-comms',
      branch: 'main'
    }
  });

  try {
    // Test the fetchAsTarball method that was broken
    console.log('📦 Fetching tarball with emergency fix...');
    const result = await fetcher.fetchAsTarball({ version: 'main' });
    
    console.log('\n✅ RESULTS:');
    console.log(`- .claude structure: ${result['.claude'] ? 'PRESENT' : 'MISSING'}`);
    console.log(`- .claude files count: ${result['.claude']?.files?.length || 0}`);
    console.log(`- CLAUDE.md: ${result['CLAUDE.md'] ? 'PRESENT' : 'MISSING'}`);
    
    if (result['.claude']?.files?.length > 0) {
      console.log('\n📁 Sample extracted files:');
      result['.claude'].files.slice(0, 5).forEach(file => {
        console.log(`  - ${file.path} (${file.content?.length || 0} bytes)`);
      });
    }
    
    // Verify the critical fix worked
    const totalFiles = (result['.claude']?.files?.length || 0) + (result['CLAUDE.md'] ? 1 : 0);
    
    if (totalFiles >= 18) {
      console.log(`\n🎉 SUCCESS: Extracted ${totalFiles} files (expected 18+)`);
      console.log('✅ Emergency fix WORKS - ready for v1.0.4 release!');
      return true;
    } else {
      console.log(`\n❌ FAILURE: Only extracted ${totalFiles} files (expected 18+)`);
      console.log('🚨 Emergency fix FAILED - DO NOT release v1.0.4!');
      return false;
    }
    
  } catch (error) {
    console.error('\n💥 CRITICAL ERROR during test:');
    console.error(error.message);
    console.error('\n🚨 Emergency fix FAILED - DO NOT release v1.0.4!');
    return false;
  }
}

// Run the test
if (require.main === module) {
  testTarballExtraction()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { testTarballExtraction };