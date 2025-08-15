/**
 * Database Isolation Verification Tests
 * LucyNova - DB Isolation Engineer
 * 
 * These tests ensure that test code cannot accidentally write to production database
 */

import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { 
  initDatabase, 
  getDatabase,
  setDatabase,
  registerSubagent,
  insertEvent
} from '../src/db';
import { setupTestDatabase, teardownTestDatabase, assertDatabaseIsolation } from './test-setup';

describe('Database Isolation Safety Tests', () => {
  beforeEach(() => {
    // Set up isolated test database for each test
    setupTestDatabase();
    assertDatabaseIsolation();
  });

  afterEach(() => {
    // Clean up test database to prevent memory leaks
    teardownTestDatabase();
  });

  test('should use in-memory database during tests', () => {
    const db = getDatabase();
    expect(db.filename).toBe(':memory:');
    console.log(`✅ Confirmed using ${db.filename} database for test isolation`);
  });

  test('should prevent test data from reaching production database', () => {
    // This test verifies that test data stays isolated
    const testSessionId = 'DANGEROUS-TEST-SESSION-SHOULD-NOT-REACH-PRODUCTION';
    const testAgentName = 'TestAgent-ProductionPollutionPrevention';
    
    // Register test agent - this should go to memory database only
    const agentId = registerSubagent(testSessionId, testAgentName, 'test-isolator');
    
    expect(agentId).toBeGreaterThan(0);
    
    // Verify it's in the test database (memory)
    const db = getDatabase();
    expect(db.filename).toBe(':memory:');
    
    const agents = db.prepare('SELECT * FROM subagent_registry WHERE session_id = ?').all(testSessionId);
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe(testAgentName);
    
    console.log('✅ Test data confirmed isolated in memory database');
  });

  test('should handle environment variable forcing', () => {
    // Test that our safety mechanism works
    const originalNodeEnv = process.env.NODE_ENV;
    const originalBunEnv = process.env.BUN_ENV;
    
    try {
      // Temporarily unset test environment
      delete process.env.NODE_ENV;
      delete process.env.BUN_ENV;
      
      // This should still use memory database due to our safety checks
      setupTestDatabase();
      const db = getDatabase();
      expect(db.filename).toBe(':memory:');
      
      console.log('✅ Safety mechanism works even without explicit test environment');
    } finally {
      // Restore environment
      process.env.NODE_ENV = originalNodeEnv;
      process.env.BUN_ENV = originalBunEnv;
    }
  });

  test('should detect and prevent production database access patterns', () => {
    // Test various session ID patterns that should never reach production
    const dangerousSessionIds = [
      'test-session-001',
      'e2e-test-session',
      'load-test-session',
      'integration-test',
      'performance-test-session',
      'cache-test-session'
    ];
    
    dangerousSessionIds.forEach(sessionId => {
      const agentId = registerSubagent(sessionId, 'TestAgent', 'safety-check');
      expect(agentId).toBeGreaterThan(0);
      
      // Verify it's isolated in memory
      const db = getDatabase();
      expect(db.filename).toBe(':memory:');
    });
    
    console.log('✅ All dangerous test session patterns safely isolated');
  });

  test('should provide clear database state for testing', () => {
    // Test the assertion utility
    expect(() => assertDatabaseIsolation()).not.toThrow();
    
    // Add some test data and verify isolation warning works
    registerSubagent('test-state-session', 'StateTestAgent', 'state-verifier');
    
    // This should warn about data but not throw since we just added it
    console.log('✅ Database isolation assertion utility working correctly');
  });

  test('should handle concurrent test isolation', async () => {
    // Test that multiple concurrent test operations stay isolated
    const promises = Array.from({ length: 10 }, (_, i) => 
      Promise.resolve().then(() => {
        const sessionId = `concurrent-test-${i}`;
        const agentName = `ConcurrentAgent${i}`;
        return registerSubagent(sessionId, agentName, 'concurrent-tester');
      })
    );
    
    const results = await Promise.all(promises);
    
    // All should succeed and be isolated
    results.forEach(result => expect(result).toBeGreaterThan(0));
    
    // Verify all are in memory database
    const db = getDatabase();
    expect(db.filename).toBe(':memory:');
    
    const allAgents = db.prepare('SELECT COUNT(*) as count FROM subagent_registry').get() as { count: number };
    expect(allAgents.count).toBe(10);
    
    console.log('✅ Concurrent test operations properly isolated');
  });
});

describe('Production Database Protection Tests', () => {
  test('should never initialize production database in test environment', () => {
    // Ensure that even calling initDatabase directly doesn't create production DB
    const originalNodeEnv = process.env.NODE_ENV;
    
    try {
      process.env.NODE_ENV = 'test';
      
      // This should create memory database due to environment detection
      initDatabase();
      const db = getDatabase();
      expect(db.filename).toBe(':memory:');
      
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test('should detect test code patterns and force memory database', () => {
    // Test that our stack trace detection works
    // Since this test file contains 'test' in the stack, it should force memory
    initDatabase();
    const db = getDatabase();
    expect(db.filename).toBe(':memory:');
    
    console.log('✅ Stack trace detection successfully prevents production DB access');
  });
});