#!/usr/bin/env node
/**
 * Live Tarball Validation Test
 * Tests the actual tarball implementation against GitHub
 * Run with: node test/live-tarball-test.js
 */

const { GitHubFetcher, fetchRepository } = require('../src/fetcher/github');
const { performance } = require('perf_hooks');

// Test configuration
const PERFORMANCE_TARGET = 10000; // 10 seconds
const MAX_REQUESTS_TARGET = 3; // Should be 1 for tarball, maybe 2-3 for fallback

async function runLiveValidation() {
  console.log('🧪 Starting Live Tarball Validation');
  console.log('======================================');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Direct Tarball Method
  await runTest('Direct Tarball Method', async () => {
    const fetcher = new GitHubFetcher({
      repository: {
        owner: 'screwyforcepush',
        repo: 'claude-comms',
        branch: 'main'
      }
    });

    let requestCount = 0;
    const originalMakeRequest = fetcher._makeRequest;
    fetcher._makeRequest = function (...args) {
      requestCount++;
      const url = args[0];
      console.log(`  Request ${requestCount}: ${url.replace('https://api.github.com/repos/screwyforcepush/claude-comms', '')}`);
      return originalMakeRequest.apply(this, args);
    };

    const startTime = performance.now();
    const result = await fetcher.fetchAsTarball({ version: 'main' });
    const duration = performance.now() - startTime;

    console.log(`  ✓ Completed in ${Math.round(duration)}ms`);
    console.log(`  ✓ Total requests: ${requestCount}`);
    console.log(`  ✓ File groups extracted: ${Object.keys(result).length}`);

    // Validations
    if (requestCount > 1) {
      throw new Error(`Expected 1 request, got ${requestCount} (tarball should be single request)`);
    }

    if (!result['.claude'] || !result['.claude'].files) {
      throw new Error('Missing .claude directory or files');
    }

    if (!result['CLAUDE.md']) {
      throw new Error('Missing CLAUDE.md file');
    }

    if (result['.claude'].files.length < 5) {
      throw new Error(`Expected at least 5 files, got ${result['.claude'].files.length}`);
    }

    console.log(`  ✓ Extracted ${result['.claude'].files.length} files from .claude directory`);
    return { duration, requestCount, fileCount: result['.claude'].files.length };
  }, results);

  // Test 2: Repository Fetch Performance
  await runTest('Repository Fetch Performance', async () => {
    let requestCount = 0;

    // Mock to track requests without modifying the actual fetcher
    const originalFetch = require('node-fetch');
    const trackingFetch = (url, options) => {
      if (url.includes('github.com')) {
        requestCount++;
        console.log(`  Request ${requestCount}: ${url.replace('https://api.github.com/repos/screwyforcepush/claude-comms', '')}`);
      }
      return originalFetch(url, options);
    };

    // Temporarily replace fetch
    require.cache[require.resolve('node-fetch')].exports = trackingFetch;

    const startTime = performance.now();

    try {
      const result = await fetchRepository('main');
      const duration = performance.now() - startTime;

      console.log(`  ✓ Completed in ${Math.round(duration)}ms`);
      console.log(`  ✓ Total requests: ${requestCount}`);
      console.log(`  ✓ Files available: ${result.files.length}`);

      // Performance validation
      if (duration > PERFORMANCE_TARGET) {
        throw new Error(`Performance target missed: ${Math.round(duration)}ms > ${PERFORMANCE_TARGET}ms`);
      }

      // Request efficiency validation
      if (requestCount > MAX_REQUESTS_TARGET) {
        console.warn(`  ⚠️ More requests than target: ${requestCount} > ${MAX_REQUESTS_TARGET}`);
      }

      return { duration, requestCount, fileCount: result.files.length };

    } finally {
      // Restore original fetch
      require.cache[require.resolve('node-fetch')].exports = originalFetch;
    }
  }, results);

  // Test 3: Retry Logic Validation
  await runTest('Retry Logic Validation', async () => {
    const fetcher = new GitHubFetcher();

    // Test delay calculation
    const delays = [];

    // Test various scenarios
    fetcher.rateLimitReset = Date.now() + 45000; // 45 seconds
    delays.push(fetcher._calculateRateLimitDelay());

    fetcher.rateLimitReset = Date.now() + 10000; // 10 seconds
    delays.push(fetcher._calculateRateLimitDelay());

    fetcher.rateLimitReset = Date.now() + 60000; // 60 seconds
    delays.push(fetcher._calculateRateLimitDelay());

    console.log(`  Delay calculations: ${delays.join(', ')}ms`);

    // All delays should be capped at 30 seconds
    const maxDelay = Math.max(...delays);
    if (maxDelay > 30000) {
      throw new Error(`Delay cap failed: ${maxDelay}ms > 30000ms`);
    }

    // Test fail-fast behavior
    try {
      fetcher.rateLimitReset = Date.now() + (10 * 60 * 1000); // 10 minutes
      fetcher._calculateRateLimitDelay();
      throw new Error('Should have failed fast for long rate limit');
    } catch (error) {
      if (!error.message.includes('Rate limit reset time too far in future')) {
        throw error;
      }
      console.log('  ✓ Correctly fails fast for long rate limits');
    }

    return { maxDelay, delays };
  }, results);

  // Test 4: File Structure Validation
  await runTest('File Structure Validation', async () => {
    const result = await fetchRepository('main');

    const expectedFiles = [
      'settings.json',
      'send_message.py',
      'get_unread_messages.py',
      'engineer.md',
      'architect.md'
    ];

    const allFilePaths = result.files.map(f => f.path);
    const missingFiles = [];

    for (const expectedFile of expectedFiles) {
      const found = allFilePaths.some(path => path.includes(expectedFile));
      if (!found) {
        missingFiles.push(expectedFile);
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(`Missing expected files: ${missingFiles.join(', ')}`);
    }

    console.log(`  ✓ All ${expectedFiles.length} critical files found`);
    console.log(`  ✓ Total files: ${result.files.length}`);

    return { totalFiles: result.files.length, expectedFiles: expectedFiles.length };
  }, results);

  // Summary
  console.log('\n======================================');
  console.log('🏁 Live Validation Summary');
  console.log('======================================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Tarball implementation is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed. Implementation needs attention.');
    process.exit(1);
  }
}

async function runTest(name, testFn, results) {
  console.log(`\n🧪 Test: ${name}`);
  console.log('-'.repeat(50));

  try {
    const startTime = performance.now();
    const testResult = await testFn();
    const duration = performance.now() - startTime;

    results.passed++;
    results.tests.push({ name, status: 'passed', duration, result: testResult });

    console.log(`✅ PASSED (${Math.round(duration)}ms)`);

  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });

    console.log(`❌ FAILED: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  runLiveValidation().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runLiveValidation };
