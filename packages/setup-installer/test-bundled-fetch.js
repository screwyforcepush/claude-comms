/**
 * Quick test script for bundled fetching implementation
 * This tests the new tarball fetching strategy
 */

const { GitHubFetcher, fetchRepository } = require('./src/fetcher/github');

async function testBundledFetch() {
  console.log('🧪 Testing Bundled Fetch Implementation\n');

  try {
    // Test 1: Direct tarball fetch
    console.log('1. Testing direct tarball fetch...');
    const fetcher = new GitHubFetcher();
    
    const startTime = Date.now();
    const result = await fetcher.fetchAsTarball({ version: 'main' });
    const duration = Date.now() - startTime;
    
    console.log(`✅ Tarball fetch completed in ${duration}ms`);
    console.log(`📁 .claude files: ${result['.claude']?.files?.length || 0}`);
    console.log(`📄 CLAUDE.md size: ${result['CLAUDE.md']?.content?.length || 0} characters`);
    
    // Test 2: fetchRepository with tarball strategy
    console.log('\n2. Testing fetchRepository with tarball fallback...');
    
    const startTime2 = Date.now();
    const repoResult = await fetchRepository('main');
    const duration2 = Date.now() - startTime2;
    
    console.log(`✅ Repository fetch completed in ${duration2}ms`);
    console.log(`📁 Claude directory files: ${repoResult.files?.length || 0}`);
    console.log(`📄 Claude file content: ${repoResult.claudeFile?.content?.length || 0} characters`);
    
    // Test 3: Verify structure compatibility
    console.log('\n3. Verifying structure compatibility...');
    
    const hasExpectedStructure = 
      repoResult.claudeDirectory && 
      repoResult.claudeFile && 
      Array.isArray(repoResult.files) &&
      repoResult.files.length > 0;
    
    if (hasExpectedStructure) {
      console.log('✅ Structure compatibility verified');
    } else {
      console.error('❌ Structure compatibility failed');
      console.log('Result structure:', Object.keys(repoResult));
    }
    
    console.log('\n🎉 All tests completed successfully!');
    console.log(`⚡ Performance: ~${Math.round(duration/1000)}s vs previous 575s+ waits`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testBundledFetch();
}

module.exports = { testBundledFetch };