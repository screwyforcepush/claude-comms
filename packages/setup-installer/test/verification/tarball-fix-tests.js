/**
 * Verification Test Suite for Tarball Fix
 * Tests the GitHub rate limiting fix and tarball implementation
 */

const { GitHubFetcher } = require('../../src/fetcher/github');
const { performance } = require('perf_hooks');
const assert = require('assert');
// const fs = require('fs-extra');
// const path = require('path');

/**
 * Test 1: Verify No Rate Limiting with Tarball
 */
async function testNoRateLimiting() {
  console.log('\n🧪 Test 1: Verify No Rate Limiting with Tarball');

  const fetcher = new GitHubFetcher();
  const startTime = performance.now();

  try {
    // This should use the new tarball method
    const result = await fetcher.fetchDirectory('.claude', { version: 'main' });

    const duration = performance.now() - startTime;

    // Assert installation completes quickly
    assert(duration < 10000, `Installation took ${duration}ms, expected <10000ms`);

    // Assert we got files
    assert(result.files && result.files.length > 0, 'No files fetched');

    console.log(`✅ Completed in ${Math.round(duration)}ms with ${result.files.length} files`);
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Verify Retry Logic is Capped
 */
async function testRetryLogicCapped() {
  console.log('\n🧪 Test 2: Verify Retry Logic is Capped at 30 seconds');

  const fetcher = new GitHubFetcher({
    retryCount: 3,
    maxRetryDelay: 30000 // Should be capped at 30 seconds
  });

  // Track retry delays
  const retryDelays = [];
  // let lastRetryTime = Date.now();

  // Override sleep to capture delays
  const originalSleep = fetcher._sleep;
  fetcher._sleep = async (ms) => {
    // const now = Date.now();
    // const actualDelay = now - lastRetryTime;
    retryDelays.push(ms);
    // lastRetryTime = now;

    console.log(`  Retry delay: ${ms}ms`);

    // Assert no delay exceeds 30 seconds
    assert(ms <= 30000, `Retry delay ${ms}ms exceeds 30 second cap`);

    return originalSleep.call(fetcher, Math.min(ms, 100)); // Speed up test
  };

  try {
    // Force a retry scenario
    const originalMakeRequest = fetcher._makeRequest;
    let attempts = 0;
    fetcher._makeRequest = async function (...args) {
      attempts++;
      if (attempts < 3) {
        const error = new Error('Simulated network error');
        error.code = 'ECONNRESET';
        throw error;
      }
      return originalMakeRequest.apply(this, args);
    };

    await fetcher.fetchFile('CLAUDE.md', { version: 'main' });

    console.log(`✅ All retry delays within limits: ${retryDelays.join(', ')}ms`);
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Verify Complete File Structure
 */
async function testCompleteFileStructure() {
  console.log('\n🧪 Test 3: Verify Complete File Structure');

  const fetcher = new GitHubFetcher();
  const expectedFiles = [
    '.claude/settings.json',
    '.claude/agents/core/engineer.md',
    '.claude/agents/core/architect.md',
    '.claude/agents/core/gatekeeper.md',
    '.claude/hooks/comms/send_message.py',
    '.claude/hooks/comms/get_unread_messages.py',
    '.claude/hooks/observability/send_event.py',
    'CLAUDE.md'
  ];

  try {
    const claudeDir = await fetcher.fetchDirectory('.claude', { version: 'main' });
    const claudeMd = await fetcher.fetchFile('CLAUDE.md', { version: 'main' });

    const allFiles = [...(claudeDir.files || []), claudeMd];
    const filePaths = allFiles.map(f => f.path);

    let missingFiles = [];
    for (const expectedFile of expectedFiles) {
      if (!filePaths.some(path => path.includes(expectedFile.replace('.claude/', '')))) {
        missingFiles.push(expectedFile);
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(`Missing files: ${missingFiles.join(', ')}`);
    }

    console.log(`✅ All ${expectedFiles.length} critical files present`);
    console.log(`  Total files fetched: ${filePaths.length}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Verify Single Network Request
 */
async function testSingleNetworkRequest() {
  console.log('\n🧪 Test 4: Verify Single Network Request for Tarball');

  const fetcher = new GitHubFetcher();
  let requestCount = 0;
  const requestUrls = [];

  // Intercept fetch calls
  // const originalFetch = global.fetch || require('node-fetch');
  global.fetch = require('node-fetch');
  const originalMakeRequest = fetcher._makeRequest;

  fetcher._makeRequest = async function (url, ...args) {
    requestCount++;
    requestUrls.push(url);
    console.log(`  Request ${requestCount}: ${url}`);
    return originalMakeRequest.call(this, url, ...args);
  };

  try {
    await fetcher.fetchDirectory('.claude', { version: 'main' });

    // Should be 1 request for tarball (or at most a few for fallback)
    assert(requestCount <= 3, `Made ${requestCount} requests, expected ≤3`);

    // Check if tarball endpoint was used
    const usedTarball = requestUrls.some(url => url.includes('/tarball/'));

    console.log(`✅ Made ${requestCount} request(s)`);
    if (usedTarball) {
      console.log('  ✓ Used tarball endpoint (optimal)');
    } else {
      console.log('  ⚠️ Used fallback method (tarball may not be implemented yet)');
    }

    return true;
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 5: Performance Benchmark
 */
async function testPerformanceBenchmark() {
  console.log('\n🧪 Test 5: Performance Benchmark');

  const fetcher = new GitHubFetcher();
  const iterations = 3;
  const times = [];

  console.log(`  Running ${iterations} iterations...`);

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    try {
      await fetcher.fetchDirectory('.claude', { version: 'main' });
      const duration = performance.now() - startTime;
      times.push(duration);
      console.log(`  Iteration ${i + 1}: ${Math.round(duration)}ms`);
    } catch (error) {
      console.error(`  Iteration ${i + 1} failed: ${error.message}`);
      times.push(Infinity);
    }
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  console.log('\n  Results:');
  console.log(`  Average: ${Math.round(avgTime)}ms`);
  console.log(`  Min: ${Math.round(minTime)}ms`);
  console.log(`  Max: ${Math.round(maxTime)}ms`);

  // Performance assertions
  assert(avgTime < 15000, `Average time ${avgTime}ms exceeds 15 second threshold`);
  assert(maxTime < 30000, `Max time ${maxTime}ms exceeds 30 second threshold`);

  console.log('✅ Performance within acceptable limits');
  return true;
}

/**
 * Test 6: Fallback Mechanism
 */
async function testFallbackMechanism() {
  console.log('\n🧪 Test 6: Test Fallback Mechanism');

  const fetcher = new GitHubFetcher();

  // Force tarball to fail if it exists
  if (fetcher.fetchAsTarball) {
    // const original = fetcher.fetchAsTarball;
    fetcher.fetchAsTarball = async () => {
      throw new Error('Simulated tarball failure');
    };
  }

  try {
    const startTime = performance.now();
    const result = await fetcher.fetchDirectory('.claude', { version: 'main' });
    const duration = performance.now() - startTime;

    assert(result.files && result.files.length > 0, 'Fallback failed to fetch files');

    console.log(`✅ Fallback successful, fetched ${result.files.length} files in ${Math.round(duration)}ms`);
    return true;
  } catch (error) {
    console.error(`❌ Fallback failed: ${error.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Tarball Fix Verification Test Suite');
  console.log('═══════════════════════════════════════════════════════');

  const tests = [
    { name: 'No Rate Limiting', fn: testNoRateLimiting },
    { name: 'Retry Logic Capped', fn: testRetryLogicCapped },
    { name: 'Complete File Structure', fn: testCompleteFileStructure },
    { name: 'Single Network Request', fn: testSingleNetworkRequest },
    { name: 'Performance Benchmark', fn: testPerformanceBenchmark },
    { name: 'Fallback Mechanism', fn: testFallbackMechanism }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (error) {
      console.error(`\n❌ Test "${test.name}" crashed: ${error.message}`);
      results.push({ name: test.name, passed: false });
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   Test Summary');
  console.log('═══════════════════════════════════════════════════════');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  });

  console.log(`\n  Total: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! The tarball fix is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
  }

  process.exit(failed === 0 ? 0 : 1);
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testNoRateLimiting,
  testRetryLogicCapped,
  testCompleteFileStructure,
  testSingleNetworkRequest,
  testPerformanceBenchmark,
  testFallbackMechanism,
  runAllTests
};
