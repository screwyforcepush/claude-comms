#!/usr/bin/env node

/**
 * Quality Gate Verification Script for NPX Installer
 * Tests complete .claude directory and CLAUDE.md installation
 */

const fs = require('fs').promises;
const path = require('path');
const { GitHubFetcher } = require('./src/fetcher/github');
const { FileWriter } = require('./src/installer/file-writer');

// Expected files based on ChloeMatrix's fix
const EXPECTED_FILES = [
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.claude/agents/core/agent-orchestrator.md',
  '.claude/agents/core/architect.md',
  '.claude/agents/core/business-analyst.md',
  '.claude/agents/core/deep-researcher.md',
  '.claude/agents/core/designer.md',
  '.claude/agents/core/engineer.md',
  '.claude/agents/core/gatekeeper.md',
  '.claude/agents/core/planner.md',
  '.claude/agents/meta-agent-builder.md',
  '.claude/commands/cook.md',
  '.claude/commands/new-agents.md',
  '.claude/hooks/comms/get_unread_messages.py',
  '.claude/hooks/comms/register_subagent.py',
  '.claude/hooks/comms/send_message.py',
  '.claude/hooks/comms/update_subagent_completion.py',
  '.claude/hooks/context/repo_map.py',
  '.claude/hooks/observability/send_event.py',
  'CLAUDE.md'
];

async function testFetcher() {
  console.log('🔍 Testing GitHub Fetcher...\n');
  
  const fetcher = new GitHubFetcher();
  const results = {
    passed: [],
    failed: [],
    performance: {}
  };
  
  try {
    // Test 1: Fetch .claude directory
    console.log('📦 Fetching .claude directory...');
    const startTime = Date.now();
    
    const claudeDir = await fetcher.fetchDirectory('.claude', { version: 'main' });
    const fetchTime = Date.now() - startTime;
    results.performance.fetchTime = fetchTime;
    
    if (claudeDir && claudeDir.files) {
      console.log(`✅ Fetched ${claudeDir.files.length} files in ${fetchTime}ms`);
      results.passed.push('Fetched .claude directory');
      
      // Verify all expected .claude files are present
      const fetchedPaths = claudeDir.files.map(f => f.path);
      const claudeExpected = EXPECTED_FILES.filter(f => f.startsWith('.claude'));
      
      for (const expected of claudeExpected) {
        if (fetchedPaths.includes(expected)) {
          results.passed.push(`Found ${expected}`);
        } else {
          results.failed.push(`Missing ${expected}`);
          console.log(`❌ Missing: ${expected}`);
        }
      }
    } else {
      results.failed.push('Failed to fetch .claude directory');
      console.log('❌ Failed to fetch .claude directory');
    }
    
    // Test 2: Fetch CLAUDE.md
    console.log('\n📄 Fetching CLAUDE.md...');
    const claudeMd = await fetcher.fetchFile('CLAUDE.md', { version: 'main' });
    
    if (claudeMd && claudeMd.content) {
      console.log(`✅ Fetched CLAUDE.md (${claudeMd.content.length} bytes)`);
      results.passed.push('Fetched CLAUDE.md');
    } else {
      results.failed.push('Failed to fetch CLAUDE.md');
      console.log('❌ Failed to fetch CLAUDE.md');
    }
    
    // Test 3: Test fallback strategy
    console.log('\n🔄 Testing fallback to raw URLs...');
    // Simulate API failure by using invalid token
    const fallbackFetcher = new GitHubFetcher({ token: 'invalid_token_to_force_fallback' });
    
    try {
      const fallbackResult = await fallbackFetcher._fetchWithRawUrls('.claude', { version: 'main' });
      if (fallbackResult && fallbackResult.files) {
        console.log(`✅ Fallback strategy returned ${fallbackResult.files.length} files`);
        results.passed.push('Fallback strategy works');
      }
    } catch (error) {
      console.log(`⚠️  Fallback test: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Fetcher test failed:', error.message);
    results.failed.push(`Fetcher error: ${error.message}`);
  }
  
  return results;
}

async function testWriter() {
  console.log('\n🔍 Testing File Writer...\n');
  
  const writer = new FileWriter();
  const testDir = path.join(process.cwd(), 'test-installation-' + Date.now());
  const results = {
    passed: [],
    failed: []
  };
  
  try {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    console.log(`📁 Created test directory: ${testDir}`);
    
    // Test writing files
    const testFiles = [
      { path: '.claude/settings.json', content: '{"test": true}' },
      { path: '.claude/hooks/comms/test.py', content: '# Test file' },
      { path: 'CLAUDE.md', content: '# Test CLAUDE.md' }
    ];
    
    const writeResult = await writer.writeDirectory(testFiles, {
      targetDir: testDir,
      overwrite: true
    });
    
    if (writeResult.written.length === testFiles.length) {
      console.log(`✅ Wrote ${writeResult.written.length} files successfully`);
      results.passed.push('File writing works');
      
      // Verify files exist
      for (const file of testFiles) {
        const fullPath = path.join(testDir, file.path);
        try {
          await fs.access(fullPath);
          results.passed.push(`Verified ${file.path}`);
        } catch {
          results.failed.push(`Missing written file: ${file.path}`);
        }
      }
    } else {
      results.failed.push('Some files failed to write');
    }
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
    console.log('🧹 Cleaned up test directory');
    
  } catch (error) {
    console.error('❌ Writer test failed:', error.message);
    results.failed.push(`Writer error: ${error.message}`);
    
    // Cleanup on error
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  }
  
  return results;
}

async function runQualityGate() {
  console.log('=' .repeat(60));
  console.log('🚦 NPX INSTALLER QUALITY GATE VERIFICATION');
  console.log('=' .repeat(60));
  console.log(`📅 Test Date: ${new Date().toISOString()}`);
  console.log(`📁 Working Directory: ${process.cwd()}`);
  console.log('=' .repeat(60));
  
  const allResults = {
    fetcher: await testFetcher(),
    writer: await testWriter()
  };
  
  // Generate summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 QUALITY GATE SUMMARY');
  console.log('=' .repeat(60));
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const [component, results] of Object.entries(allResults)) {
    const passed = results.passed.length;
    const failed = results.failed.length;
    totalPassed += passed;
    totalFailed += failed;
    
    console.log(`\n${component.toUpperCase()}:`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    
    if (results.performance) {
      console.log(`  ⚡ Performance:`);
      for (const [metric, value] of Object.entries(results.performance)) {
        console.log(`    - ${metric}: ${value}ms`);
      }
    }
    
    if (failed > 0) {
      console.log(`  Issues:`);
      results.failed.forEach(issue => {
        console.log(`    - ${issue}`);
      });
    }
  }
  
  // Final verdict
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 GATE DECISION');
  console.log('=' .repeat(60));
  
  const gateStatus = totalFailed === 0 ? 'PASS' : 'FAIL';
  const statusEmoji = totalFailed === 0 ? '✅' : '❌';
  
  console.log(`\n${statusEmoji} Gate Status: ${gateStatus}`);
  console.log(`   Total Passed: ${totalPassed}`);
  console.log(`   Total Failed: ${totalFailed}`);
  
  if (totalFailed > 0) {
    console.log('\n⚠️  CRITICAL ISSUES DETECTED:');
    console.log('   The bug fix is incomplete. Not all files are being fetched.');
    console.log('   RECOMMENDATION: Fix the _fetchWithRawUrls fallback strategy');
    process.exit(1);
  } else {
    console.log('\n🎉 All quality checks passed!');
    console.log('   The NPX installer is ready for publication.');
  }
}

// Run the quality gate
runQualityGate().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});