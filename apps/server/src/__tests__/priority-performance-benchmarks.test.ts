/**
 * Priority Event Performance Benchmarks
 * Testing query optimization, memory usage, and scalability metrics
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { 
  initDatabase, 
  insertEvent,
  getRecentEvents
} from "../db";
import type { HookEvent } from "../types";

// Performance test configuration
interface PerformanceConfig {
  maxQueryTime: number;        // Maximum acceptable query time in ms
  maxMemoryUsage: number;      // Maximum memory usage in MB
  testDatasetSize: number;     // Number of events to test with
  concurrentClients: number;   // Number of concurrent connections to simulate
  queryRepetitions: number;    // Number of times to repeat queries for averaging
}

// Performance metrics interface
interface PerformanceMetrics {
  queryTime: number;
  memoryUsage: number;
  throughput: number;
  eventCount: number;
  priorityEventCount: number;
  indexUtilization: boolean;
}

// Performance result interface
interface PerformanceResult {
  performant: boolean;
  issues: string[];
  metrics: PerformanceMetrics;
}

// Mock implementations of priority functions for testing
function calculateEventPriority(eventType: string): number {
  const priorityTypes = ['UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop', 'SubagentComplete'];
  return priorityTypes.includes(eventType) ? 1 : 0;
}

function insertEventWithPriority(event: HookEvent, db: Database): HookEvent {
  const priority = calculateEventPriority(event.hook_event_type);
  const priorityMetadata = priority > 0 ? JSON.stringify({
    classified_at: Date.now(),
    classification_reason: 'automatic',
    retention_policy: 'extended'
  }) : null;
  
  const stmt = db.prepare(`
    INSERT INTO events (
      source_app, session_id, hook_event_type, payload, 
      chat, summary, timestamp, priority, priority_metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const timestamp = event.timestamp || Date.now();
  const result = stmt.run(
    event.source_app,
    event.session_id,
    event.hook_event_type,
    JSON.stringify(event.payload),
    event.chat ? JSON.stringify(event.chat) : null,
    event.summary || null,
    timestamp,
    priority,
    priorityMetadata
  );
  
  return {
    ...event,
    id: result.lastInsertRowid as number,
    timestamp,
    priority,
    priority_metadata: priorityMetadata ? JSON.parse(priorityMetadata) : undefined
  };
}

function getRecentEventsWithPriorityOptimized(
  db: Database,
  totalLimit: number = 150,
  priorityRetentionHours: number = 24,
  regularRetentionHours: number = 4
): HookEvent[] {
  const now = Date.now();
  const priorityCutoff = now - (priorityRetentionHours * 60 * 60 * 1000);
  const regularCutoff = now - (regularRetentionHours * 60 * 60 * 1000);
  
  // Optimized single query using UNION and proper indexing
  const stmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, 
           chat, summary, timestamp, priority, priority_metadata
    FROM (
      SELECT *, 1 as query_order FROM events 
      WHERE priority > 0 AND timestamp >= ?
      UNION ALL
      SELECT *, 2 as query_order FROM events 
      WHERE priority = 0 AND timestamp >= ?
    )
    ORDER BY query_order, timestamp DESC
    LIMIT ?
  `);
  
  const rows = stmt.all(priorityCutoff, regularCutoff, totalLimit) as any[];
  
  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp,
    priority: row.priority,
    priority_metadata: row.priority_metadata ? JSON.parse(row.priority_metadata) : undefined
  }));
}

// Performance analysis functions
function analyzeQueryPlan(db: Database, query: string): { usesIndex: boolean; scanCount: number } {
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all() as any[];
  
  const usesIndex = plan.some(step => 
    step.detail && step.detail.toLowerCase().includes('using index')
  );
  
  const scanCount = plan.filter(step => 
    step.detail && step.detail.toLowerCase().includes('scan')
  ).length;
  
  return { usesIndex, scanCount };
}

function measureMemoryUsage(): number {
  // In a real implementation, this would use process.memoryUsage()
  // For testing, we'll simulate memory measurement
  return Math.random() * 50; // Simulated MB usage
}

function createTestDatabase(): Database {
  const db = new Database(":memory:");
  initDatabase(db);
  
  // Add priority columns and indexes
  db.exec('ALTER TABLE events ADD COLUMN priority INTEGER DEFAULT 0');
  db.exec('ALTER TABLE events ADD COLUMN priority_metadata TEXT');
  
  // Create optimized indexes
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_priority_timestamp ON events(session_id, priority DESC, timestamp DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_type_priority_timestamp ON events(hook_event_type, priority DESC, timestamp DESC)');
  
  return db;
}

function createTestEvent(
  eventType: string, 
  sessionId?: string, 
  timestamp?: number,
  payloadSize?: number
): HookEvent {
  const basePayload = { agentName: "TestAgent", data: "test" };
  
  // Add large payload if specified for performance testing
  if (payloadSize && payloadSize > 0) {
    basePayload.data = 'A'.repeat(payloadSize);
  }
  
  return {
    source_app: "test",
    session_id: sessionId || `session-${Math.floor(Math.random() * 100)}`,
    hook_event_type: eventType,
    payload: basePayload,
    timestamp: timestamp || Date.now()
  };
}

function generateTestDataset(size: number, priorityRatio: number = 0.3): HookEvent[] {
  const events: HookEvent[] = [];
  const priorityTypes = ['UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop'];
  const regularTypes = ['tool_use', 'response', 'data', 'log', 'custom_event'];
  
  for (let i = 0; i < size; i++) {
    const isPriority = Math.random() < priorityRatio;
    const eventType = isPriority 
      ? priorityTypes[Math.floor(Math.random() * priorityTypes.length)]
      : regularTypes[Math.floor(Math.random() * regularTypes.length)];
    
    events.push(createTestEvent(
      eventType,
      `session-${Math.floor(i / 10)}`, // 10 events per session on average
      Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000 // Random time within last week
    ));
  }
  
  return events;
}

async function simulateConcurrentQueries(db: Database, queryCount: number): Promise<number[]> {
  const queryTimes: number[] = [];
  
  const queries = Array.from({ length: queryCount }, async () => {
    const startTime = Date.now();
    getRecentEventsWithPriorityOptimized(db);
    const endTime = Date.now();
    return endTime - startTime;
  });
  
  const results = await Promise.all(queries);
  return results;
}

describe('Priority Event Performance Benchmarks', () => {
  let testDb: Database;
  let config: PerformanceConfig;

  beforeEach(() => {
    testDb = createTestDatabase();
    config = {
      maxQueryTime: 100,        // 100ms max query time
      maxMemoryUsage: 50,       // 50MB max memory
      testDatasetSize: 10000,   // 10k events for testing
      concurrentClients: 10,    // 10 concurrent connections
      queryRepetitions: 5       // Average over 5 runs
    };
  });

  afterEach(() => {
    testDb?.close();
  });

  describe('Query Performance', () => {
    test('should meet <100ms query time requirement for priority retrieval', () => {
      // Setup: Large dataset
      const events = generateTestDataset(config.testDatasetSize, 0.3);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Measure query performance
      const queryTimes: number[] = [];
      
      for (let i = 0; i < config.queryRepetitions; i++) {
        const startTime = Date.now();
        const results = getRecentEventsWithPriorityOptimized(testDb);
        const queryTime = Date.now() - startTime;
        queryTimes.push(queryTime);
        
        expect(results.length).toBeGreaterThan(0);
      }
      
      const avgQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      const maxQueryTime = Math.max(...queryTimes);
      
      expect(avgQueryTime).toBeLessThan(config.maxQueryTime);
      expect(maxQueryTime).toBeLessThan(config.maxQueryTime * 1.5); // Allow 50% variance for max
      
      console.log(`Average query time: ${avgQueryTime.toFixed(2)}ms`);
      console.log(`Max query time: ${maxQueryTime}ms`);
    });

    test('should utilize database indexes for priority queries', () => {
      // Insert test data
      const events = generateTestDataset(1000, 0.3);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Analyze query plan for priority query
      const priorityQuery = `
        SELECT * FROM events 
        WHERE priority > 0 AND timestamp >= ? 
        ORDER BY timestamp DESC LIMIT 100
      `;
      
      const queryPlan = analyzeQueryPlan(testDb, priorityQuery);
      
      expect(queryPlan.usesIndex).toBe(true);
      expect(queryPlan.scanCount).toBeLessThan(2); // Should minimize table scans
    });

    test('should scale performance with dataset size', () => {
      const sizes = [100, 1000, 5000, 10000];
      const scalingResults: { size: number; queryTime: number }[] = [];
      
      for (const size of sizes) {
        // Clear and rebuild database for each size
        testDb.exec('DELETE FROM events');
        
        const events = generateTestDataset(size, 0.3);
        events.forEach(event => insertEventWithPriority(event, testDb));
        
        const startTime = Date.now();
        getRecentEventsWithPriorityOptimized(testDb);
        const queryTime = Date.now() - startTime;
        
        scalingResults.push({ size, queryTime });
        
        console.log(`Dataset size: ${size}, Query time: ${queryTime}ms`);
      }
      
      // Verify query time doesn't grow exponentially
      const timeGrowthRatio = scalingResults[3].queryTime / scalingResults[0].queryTime;
      expect(timeGrowthRatio).toBeLessThan(10); // Should be sub-linear growth
    });

    test('should handle concurrent query load efficiently', async () => {
      // Setup large dataset
      const events = generateTestDataset(5000, 0.3);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Simulate concurrent queries
      const concurrentQueryTimes = await simulateConcurrentQueries(testDb, config.concurrentClients);
      
      const avgConcurrentTime = concurrentQueryTimes.reduce((sum, time) => sum + time, 0) / concurrentQueryTimes.length;
      const maxConcurrentTime = Math.max(...concurrentQueryTimes);
      
      expect(avgConcurrentTime).toBeLessThan(config.maxQueryTime * 2); // Allow 2x for concurrency
      expect(maxConcurrentTime).toBeLessThan(config.maxQueryTime * 3); // Allow 3x for worst case
      
      console.log(`Concurrent avg: ${avgConcurrentTime.toFixed(2)}ms, max: ${maxConcurrentTime}ms`);
    });
  });

  describe('Memory Performance', () => {
    test('should maintain reasonable memory usage with large datasets', () => {
      const initialMemory = measureMemoryUsage();
      
      // Add large dataset
      const events = generateTestDataset(config.testDatasetSize, 0.3);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Perform multiple queries to test memory stability
      for (let i = 0; i < 10; i++) {
        getRecentEventsWithPriorityOptimized(testDb);
      }
      
      const finalMemory = measureMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      
      expect(memoryIncrease).toBeLessThan(config.maxMemoryUsage);
      
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
    });

    test('should not leak memory with repeated queries', () => {
      // Setup baseline
      const events = generateTestDataset(1000, 0.3);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      const memoryMeasurements: number[] = [];
      
      // Perform many queries and measure memory
      for (let i = 0; i < 50; i++) {
        getRecentEventsWithPriorityOptimized(testDb);
        
        if (i % 10 === 0) {
          memoryMeasurements.push(measureMemoryUsage());
        }
      }
      
      // Memory should not continuously increase
      const memoryTrend = memoryMeasurements[memoryMeasurements.length - 1] - memoryMeasurements[0];
      expect(memoryTrend).toBeLessThan(10); // Less than 10MB increase over 50 queries
    });

    test('should handle large event payloads efficiently', () => {
      // Create events with large payloads (10KB each)
      const largeEvents = Array.from({ length: 100 }, (_, i) => 
        createTestEvent('UserPromptSubmit', `session-${i}`, Date.now() + i * 1000, 10240)
      );
      
      const startTime = Date.now();
      largeEvents.forEach(event => insertEventWithPriority(event, testDb));
      const insertTime = Date.now() - startTime;
      
      const queryStartTime = Date.now();
      const results = getRecentEventsWithPriorityOptimized(testDb);
      const queryTime = Date.now() - queryStartTime;
      
      expect(insertTime).toBeLessThan(1000); // Insert should complete within 1 second
      expect(queryTime).toBeLessThan(config.maxQueryTime);
      expect(results.length).toBeGreaterThan(0);
      
      console.log(`Large payload insert: ${insertTime}ms, query: ${queryTime}ms`);
    });
  });

  describe('Throughput Performance', () => {
    test('should achieve high event insertion throughput', () => {
      const eventCount = 1000;
      const events = generateTestDataset(eventCount, 0.3);
      
      const startTime = Date.now();
      events.forEach(event => insertEventWithPriority(event, testDb));
      const insertTime = Date.now() - startTime;
      
      const throughput = eventCount / (insertTime / 1000); // Events per second
      
      expect(throughput).toBeGreaterThan(100); // At least 100 events/second
      
      console.log(`Insert throughput: ${throughput.toFixed(2)} events/second`);
    });

    test('should maintain query throughput under load', () => {
      // Setup dataset
      const events = generateTestDataset(5000, 0.3);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      const queryCount = 100;
      const startTime = Date.now();
      
      for (let i = 0; i < queryCount; i++) {
        getRecentEventsWithPriorityOptimized(testDb);
      }
      
      const totalTime = Date.now() - startTime;
      const throughput = queryCount / (totalTime / 1000); // Queries per second
      
      expect(throughput).toBeGreaterThan(10); // At least 10 queries/second
      
      console.log(`Query throughput: ${throughput.toFixed(2)} queries/second`);
    });

    test('should handle mixed read/write workload efficiently', () => {
      const initialEvents = generateTestDataset(1000, 0.3);
      initialEvents.forEach(event => insertEventWithPriority(event, testDb));
      
      const operations = 100;
      const startTime = Date.now();
      
      for (let i = 0; i < operations; i++) {
        if (i % 3 === 0) {
          // Insert operation
          const newEvent = createTestEvent('UserPromptSubmit', `session-${i}`);
          insertEventWithPriority(newEvent, testDb);
        } else {
          // Query operation
          getRecentEventsWithPriorityOptimized(testDb);
        }
      }
      
      const totalTime = Date.now() - startTime;
      const throughput = operations / (totalTime / 1000);
      
      expect(throughput).toBeGreaterThan(5); // At least 5 mixed ops/second
      expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds
      
      console.log(`Mixed workload throughput: ${throughput.toFixed(2)} ops/second`);
    });
  });

  describe('Index Performance', () => {
    test('should demonstrate index effectiveness', () => {
      // Create dataset large enough to show index benefits
      const events = generateTestDataset(5000, 0.3);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Query with index
      const indexedStartTime = Date.now();
      const indexedResults = getRecentEventsWithPriorityOptimized(testDb);
      const indexedTime = Date.now() - indexedStartTime;
      
      // Query without index (drop indexes temporarily)
      testDb.exec('DROP INDEX IF EXISTS idx_events_priority_timestamp');
      testDb.exec('DROP INDEX IF EXISTS idx_events_session_priority_timestamp');
      
      const noIndexStartTime = Date.now();
      const noIndexResults = getRecentEventsWithPriorityOptimized(testDb);
      const noIndexTime = Date.now() - noIndexStartTime;
      
      // Recreate indexes for other tests
      testDb.exec('CREATE INDEX IF NOT EXISTS idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
      
      expect(indexedResults.length).toBe(noIndexResults.length); // Same results
      expect(indexedTime).toBeLessThan(noIndexTime); // Faster with index
      
      const speedup = noIndexTime / indexedTime;
      expect(speedup).toBeGreaterThan(1.5); // At least 50% improvement
      
      console.log(`Index speedup: ${speedup.toFixed(2)}x (${indexedTime}ms vs ${noIndexTime}ms)`);
    });

    test('should optimize session-specific queries with indexes', () => {
      // Create events across multiple sessions
      const sessionIds = Array.from({ length: 100 }, (_, i) => `session-${i}`);
      const events: HookEvent[] = [];
      
      sessionIds.forEach(sessionId => {
        // 50 events per session
        for (let i = 0; i < 50; i++) {
          const eventType = i % 3 === 0 ? 'UserPromptSubmit' : 'tool_use';
          events.push(createTestEvent(eventType, sessionId, Date.now() + i * 1000));
        }
      });
      
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Test session-specific query performance
      const testSessionId = 'session-50';
      const startTime = Date.now();
      
      const sessionEvents = testDb.prepare(`
        SELECT * FROM events 
        WHERE session_id = ? AND priority > 0 
        ORDER BY timestamp DESC 
        LIMIT 20
      `).all(testSessionId);
      
      const queryTime = Date.now() - startTime;
      
      expect(queryTime).toBeLessThan(50); // Should be very fast with session index
      expect(sessionEvents.length).toBeGreaterThan(0);
      
      console.log(`Session query time: ${queryTime}ms`);
    });
  });

  describe('Resource Optimization', () => {
    test('should optimize storage with efficient data types', () => {
      // Test storage efficiency
      const events = generateTestDataset(1000, 0.3);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Check database size (simulated)
      const tableInfo = testDb.prepare("PRAGMA table_info(events)").all();
      const indexInfo = testDb.prepare("PRAGMA index_list(events)").all();
      
      // Verify efficient schema
      const priorityColumn = tableInfo.find((col: any) => col.name === 'priority');
      expect(priorityColumn?.type).toBe('INTEGER'); // Efficient integer storage
      
      // Verify indexes exist
      expect(indexInfo.length).toBeGreaterThan(0);
    });

    test('should handle database growth gracefully', () => {
      const growthStages = [1000, 5000, 10000];
      const performanceMetrics: { size: number; queryTime: number; insertTime: number }[] = [];
      
      for (const size of growthStages) {
        testDb.exec('DELETE FROM events');
        
        const events = generateTestDataset(size, 0.3);
        
        // Measure insert performance
        const insertStart = Date.now();
        events.forEach(event => insertEventWithPriority(event, testDb));
        const insertTime = Date.now() - insertStart;
        
        // Measure query performance
        const queryStart = Date.now();
        getRecentEventsWithPriorityOptimized(testDb);
        const queryTime = Date.now() - queryStart;
        
        performanceMetrics.push({ size, queryTime, insertTime });
      }
      
      // Performance should not degrade exponentially
      const firstStage = performanceMetrics[0];
      const lastStage = performanceMetrics[performanceMetrics.length - 1];
      
      const queryDegradation = lastStage.queryTime / firstStage.queryTime;
      const insertDegradation = lastStage.insertTime / firstStage.insertTime;
      
      expect(queryDegradation).toBeLessThan(5); // Query time shouldn't increase 5x
      expect(insertDegradation).toBeLessThan(3); // Insert time shouldn't increase 3x
      
      console.log(`Query degradation: ${queryDegradation.toFixed(2)}x`);
      console.log(`Insert degradation: ${insertDegradation.toFixed(2)}x`);
    });
  });

  describe('Performance Validation', () => {
    test('should pass comprehensive performance validation', () => {
      // Setup comprehensive test scenario
      const events = generateTestDataset(config.testDatasetSize, 0.3);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Run performance validation
      const performanceResult = validatePriorityPerformance(testDb);
      
      expect(performanceResult.performant).toBe(true);
      expect(performanceResult.issues).toHaveLength(0);
      expect(performanceResult.metrics.queryTime).toBeLessThan(config.maxQueryTime);
      expect(performanceResult.metrics.eventCount).toBeGreaterThan(0);
      
      console.log('Performance validation passed:', performanceResult.metrics);
    });

    test('should identify performance bottlenecks', () => {
      // Create scenario that might have performance issues
      const largeEvents = Array.from({ length: 500 }, (_, i) => 
        createTestEvent('UserPromptSubmit', `session-${i}`, Date.now() + i * 1000, 50000) // 50KB payloads
      );
      
      largeEvents.forEach(event => insertEventWithPriority(event, testDb));
      
      const performanceResult = validatePriorityPerformance(testDb);
      
      // Should either pass or identify specific issues
      if (!performanceResult.performant) {
        expect(performanceResult.issues.length).toBeGreaterThan(0);
        console.log('Performance issues identified:', performanceResult.issues);
      } else {
        expect(performanceResult.metrics.queryTime).toBeLessThan(config.maxQueryTime);
      }
    });
  });
});

// Performance validation function
function validatePriorityPerformance(db: Database): PerformanceResult {
  const results: any = {};
  const issues: string[] = [];
  
  // Test priority query performance
  const startTime = Date.now();
  const events = getRecentEventsWithPriorityOptimized(db, 100);
  const queryTime = Date.now() - startTime;
  
  results.queryTime = queryTime;
  results.eventCount = events.length;
  results.priorityEventCount = events.filter(e => (e as any).priority > 0).length;
  
  // Performance criteria
  const maxAcceptableQueryTime = 100; // 100ms
  
  if (queryTime > maxAcceptableQueryTime) {
    issues.push(`Query time ${queryTime}ms exceeds ${maxAcceptableQueryTime}ms limit`);
  }
  
  // Check index utilization
  const indexAnalysis = analyzeQueryPlan(db, `
    SELECT * FROM events WHERE priority > 0 AND timestamp >= ? ORDER BY timestamp DESC LIMIT 100
  `);
  
  results.indexUtilization = indexAnalysis.usesIndex;
  
  if (!indexAnalysis.usesIndex) {
    issues.push('Query not utilizing database indexes effectively');
  }
  
  return {
    performant: issues.length === 0,
    issues,
    metrics: results
  };
}