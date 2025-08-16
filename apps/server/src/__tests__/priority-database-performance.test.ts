/**
 * Priority Database Performance Tests
 * 
 * Tests database query performance for priority event system.
 * Validates <100ms query requirement and indexing efficiency.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { 
  setDatabase, 
  initDatabase, 
  insertEvent, 
  getRecentEvents 
} from '../db';
import type { HookEvent } from '../types';

// Performance targets from architecture specification  
const PERFORMANCE_TARGETS = {
  MAX_QUERY_TIME: 100, // 100ms max query time
  MAX_INSERT_TIME: 10,  // 10ms max insert time
  TARGET_EVENTS_PER_SECOND: 1000, // Target throughput
  LARGE_DATASET_SIZE: 10000, // For stress testing
  CONCURRENT_CONNECTIONS: 10, // Concurrent query simulation
  INDEX_EFFECTIVENESS_RATIO: 0.1, // Indexed queries should be 10x faster
};

// Priority event types from architecture
const PRIORITY_EVENT_TYPES = {
  'UserPromptSubmit': 1,
  'Notification': 1,
  'Stop': 1,
  'SubagentStop': 1,
  'SubagentComplete': 1
} as const;

function calculateEventPriority(eventType: string): number {
  return PRIORITY_EVENT_TYPES[eventType as keyof typeof PRIORITY_EVENT_TYPES] || 0;
}

// Enhanced insertEvent function with priority calculation (from architecture spec)
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

// Priority retrieval function from architecture spec
function getRecentEventsWithPriority(
  db: Database,
  config: {
    totalLimit: number;
    priorityLimit: number;
    regularLimit: number;
    priorityRetentionHours: number;
    regularRetentionHours: number;
  } = {
    totalLimit: 150,
    priorityLimit: 100,
    regularLimit: 50,
    priorityRetentionHours: 24,
    regularRetentionHours: 4
  }
): HookEvent[] {
  const now = Date.now();
  const priorityCutoff = now - (config.priorityRetentionHours * 60 * 60 * 1000);
  const regularCutoff = now - (config.regularRetentionHours * 60 * 60 * 1000);
  
  // Get priority events with extended retention
  const priorityStmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, 
           chat, summary, timestamp, priority, priority_metadata
    FROM events
    WHERE priority > 0 AND timestamp >= ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  // Get regular events with standard retention
  const regularStmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, 
           chat, summary, timestamp, priority, priority_metadata
    FROM events
    WHERE priority = 0 AND timestamp >= ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  
  const priorityEvents = priorityStmt.all(priorityCutoff, config.priorityLimit) as any[];
  const regularEvents = regularStmt.all(regularCutoff, config.regularLimit) as any[];
  
  // Merge and sort by timestamp, respecting total limit
  const allEvents = [...priorityEvents, ...regularEvents]
    .map(mapDatabaseEventToHookEvent)
    .sort((a, b) => a.timestamp - b.timestamp);
  
  return intelligentEventLimiting(allEvents, config.totalLimit);
}

function intelligentEventLimiting(events: HookEvent[], totalLimit: number): HookEvent[] {
  if (events.length <= totalLimit) return events;
  
  // Separate priority and regular events
  const priorityEvents = events.filter(e => (e as any).priority > 0);
  const regularEvents = events.filter(e => (e as any).priority === 0);
  
  // Always preserve all priority events within reason
  const maxPriorityPreserve = Math.floor(totalLimit * 0.7); // 70% for priority
  const preservedPriority = priorityEvents.slice(-maxPriorityPreserve);
  
  // Fill remaining space with regular events
  const remainingSpace = totalLimit - preservedPriority.length;
  const preservedRegular = regularEvents.slice(-remainingSpace);
  
  return [...preservedPriority, ...preservedRegular]
    .sort((a, b) => a.timestamp - b.timestamp);
}

function mapDatabaseEventToHookEvent(row: any): HookEvent {
  return {
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
  };
}

function createTestEvent(
  type: string, 
  sessionId: string = 'test-session',
  payloadSize: number = 1024
): HookEvent {
  return {
    source_app: 'performance-test',
    session_id: sessionId,
    hook_event_type: type,
    payload: {
      data: 'x'.repeat(payloadSize),
      timestamp: Date.now(),
      test: true
    },
    timestamp: Date.now(),
    summary: `Test event of type ${type}`
  };
}

function createEventBatch(
  count: number, 
  priorityRatio: number = 0.3,
  sessionCount: number = 5
): HookEvent[] {
  const events: HookEvent[] = [];
  const priorityTypes = Object.keys(PRIORITY_EVENT_TYPES);
  const regularTypes = ['RegularEvent', 'LogEntry', 'StatusUpdate'];
  const sessions = Array.from({ length: sessionCount }, (_, i) => `session-${i}`);
  
  for (let i = 0; i < count; i++) {
    const isPriority = Math.random() < priorityRatio;
    const eventType = isPriority 
      ? priorityTypes[Math.floor(Math.random() * priorityTypes.length)]
      : regularTypes[Math.floor(Math.random() * regularTypes.length)];
    const sessionId = sessions[Math.floor(Math.random() * sessions.length)];
    
    events.push(createTestEvent(eventType, sessionId, 512 + Math.random() * 1024));
  }
  
  return events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

async function setupTestDatabase(): Promise<Database> {
  const db = new Database(':memory:');
  
  // Enable performance optimizations
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA cache_size = 10000');
  db.exec('PRAGMA temp_store = memory');
  
  // Create events table with priority fields
  db.exec(`
    CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_app TEXT NOT NULL,
      session_id TEXT NOT NULL,
      hook_event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      chat TEXT,
      summary TEXT,
      timestamp INTEGER NOT NULL,
      priority INTEGER DEFAULT 0,
      priority_metadata TEXT
    )
  `);
  
  // Create priority-optimized indexes (from architecture spec)
  db.exec('CREATE INDEX idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
  db.exec('CREATE INDEX idx_events_session_priority_timestamp ON events(session_id, priority DESC, timestamp DESC)');
  db.exec('CREATE INDEX idx_events_type_priority ON events(hook_event_type, priority DESC, timestamp DESC)');
  
  return db;
}

function measureQueryPerformance<T>(
  query: () => T,
  description: string = 'Query'
): { result: T; duration: number } {
  const start = performance.now();
  const result = query();
  const end = performance.now();
  const duration = end - start;
  
  console.log(`${description}: ${duration.toFixed(2)}ms`);
  return { result, duration };
}

describe('Priority Database Performance Tests', () => {
  let testDb: Database;

  beforeEach(async () => {
    testDb = await setupTestDatabase();
    setDatabase(testDb);
  });

  afterEach(() => {
    testDb?.close();
  });

  describe('Query Performance Validation', () => {
    it('should retrieve priority events within 100ms limit', () => {
      // Insert test data
      const events = createEventBatch(1000, 0.3, 10);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Test priority query performance
      const { duration } = measureQueryPerformance(
        () => getRecentEventsWithPriority(testDb, {
          totalLimit: 100,
          priorityLimit: 70,
          regularLimit: 30,
          priorityRetentionHours: 24,
          regularRetentionHours: 4
        }),
        'Priority events query (1000 events)'
      );
      
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.MAX_QUERY_TIME);
    });

    it('should handle large datasets efficiently', () => {
      // Insert large dataset
      console.log(`Inserting ${PERFORMANCE_TARGETS.LARGE_DATASET_SIZE} events...`);
      const startInsert = performance.now();
      
      const largeEventBatch = createEventBatch(PERFORMANCE_TARGETS.LARGE_DATASET_SIZE, 0.25, 20);
      largeEventBatch.forEach(event => insertEventWithPriority(event, testDb));
      
      const insertTime = performance.now() - startInsert;
      console.log(`Insert time: ${insertTime.toFixed(2)}ms (${(insertTime / PERFORMANCE_TARGETS.LARGE_DATASET_SIZE).toFixed(3)}ms per event)`);
      
      // Test query performance on large dataset
      const { result, duration } = measureQueryPerformance(
        () => getRecentEventsWithPriority(testDb, {
          totalLimit: 200,
          priorityLimit: 150,
          regularLimit: 50,
          priorityRetentionHours: 24,
          regularRetentionHours: 4
        }),
        `Priority query on ${PERFORMANCE_TARGETS.LARGE_DATASET_SIZE} events`
      );
      
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.MAX_QUERY_TIME);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('should maintain performance with session-specific queries', () => {
      // Insert events across multiple sessions
      const events = createEventBatch(2000, 0.3, 50);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      const testSessionId = 'session-1';
      
      // Test session-specific priority query
      const { duration } = measureQueryPerformance(
        () => {
          const stmt = testDb.prepare(`
            SELECT id, source_app, session_id, hook_event_type, payload, 
                   chat, summary, timestamp, priority, priority_metadata
            FROM events
            WHERE session_id = ? AND (
              (priority > 0 AND timestamp >= ?) OR 
              (priority = 0 AND timestamp >= ?)
            )
            ORDER BY timestamp ASC
          `);
          
          const now = Date.now();
          const priorityCutoff = now - (24 * 60 * 60 * 1000);
          const regularCutoff = now - (4 * 60 * 60 * 1000);
          
          return stmt.all(testSessionId, priorityCutoff, regularCutoff);
        },
        'Session-specific priority query'
      );
      
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.MAX_QUERY_TIME);
    });
  });

  describe('Database Migration Performance', () => {
    it('should add priority column efficiently', () => {
      // Create database without priority column
      const migrationDb = new Database(':memory:');
      
      migrationDb.exec(`
        CREATE TABLE events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_app TEXT NOT NULL,
          session_id TEXT NOT NULL,
          hook_event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          chat TEXT,
          summary TEXT,
          timestamp INTEGER NOT NULL
        )
      `);
      
      // Insert events without priority
      const events = createEventBatch(5000, 0.3);
      const insertStmt = migrationDb.prepare(`
        INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      events.forEach(event => {
        insertStmt.run(
          event.source_app,
          event.session_id,
          event.hook_event_type,
          JSON.stringify(event.payload),
          event.timestamp
        );
      });
      
      // Test migration performance
      const { duration } = measureQueryPerformance(
        () => {
          // Add priority column
          migrationDb.exec('ALTER TABLE events ADD COLUMN priority INTEGER DEFAULT 0');
          migrationDb.exec('ALTER TABLE events ADD COLUMN priority_metadata TEXT');
          
          // Backfill priority values
          const priorityEventTypes = Object.keys(PRIORITY_EVENT_TYPES);
          priorityEventTypes.forEach(eventType => {
            const updateStmt = migrationDb.prepare(`
              UPDATE events SET priority = 1, priority_metadata = ?
              WHERE hook_event_type = ? AND priority = 0
            `);
            
            const metadata = JSON.stringify({
              classified_at: Date.now(),
              classification_reason: 'migration_backfill',
              retention_policy: 'extended'
            });
            
            updateStmt.run(metadata, eventType);
          });
          
          // Create indexes
          migrationDb.exec('CREATE INDEX idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
          migrationDb.exec('CREATE INDEX idx_events_session_priority_timestamp ON events(session_id, priority DESC, timestamp DESC)');
          migrationDb.exec('CREATE INDEX idx_events_type_priority ON events(hook_event_type, priority DESC, timestamp DESC)');
        },
        'Database migration with 5000 events'
      );
      
      // Migration should complete in reasonable time (adjust based on requirements)
      expect(duration).toBeLessThan(30000); // 30 seconds for 5000 events
      
      migrationDb.close();
    });
  });

  describe('Insert Performance', () => {
    it('should insert priority events efficiently', () => {
      const events = createEventBatch(1000, 0.4);
      
      const { duration } = measureQueryPerformance(
        () => {
          events.forEach(event => insertEventWithPriority(event, testDb));
        },
        'Insert 1000 events with priority classification'
      );
      
      const eventsPerSecond = (1000 / (duration / 1000));
      expect(eventsPerSecond).toBeGreaterThan(PERFORMANCE_TARGETS.TARGET_EVENTS_PER_SECOND);
      
      console.log(`Insert throughput: ${Math.round(eventsPerSecond)} events/second`);
    });

    it('should handle concurrent inserts efficiently', async () => {
      const batchSize = 100;
      const concurrentBatches = PERFORMANCE_TARGETS.CONCURRENT_CONNECTIONS;
      
      const insertBatch = (batchIndex: number) => {
        return new Promise<number>((resolve) => {
          const events = createEventBatch(batchSize, 0.3);
          const start = performance.now();
          
          events.forEach(event => insertEventWithPriority(event, testDb));
          
          const duration = performance.now() - start;
          resolve(duration);
        });
      };
      
      const start = performance.now();
      const batchPromises = Array.from(
        { length: concurrentBatches }, 
        (_, i) => insertBatch(i)
      );
      
      const batchDurations = await Promise.all(batchPromises);
      const totalDuration = performance.now() - start;
      
      const totalEvents = batchSize * concurrentBatches;
      const throughput = totalEvents / (totalDuration / 1000);
      
      expect(throughput).toBeGreaterThan(PERFORMANCE_TARGETS.TARGET_EVENTS_PER_SECOND * 0.8); // 80% of target under load
      
      console.log(`Concurrent insert throughput: ${Math.round(throughput)} events/second`);
      console.log(`Average batch time: ${(batchDurations.reduce((a, b) => a + b) / batchDurations.length).toFixed(2)}ms`);
    });
  });

  describe('Index Effectiveness', () => {
    it('should demonstrate index performance benefits', () => {
      // Insert test data
      const events = createEventBatch(5000, 0.3, 10);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Query with indexes
      const { duration: indexedDuration } = measureQueryPerformance(
        () => getRecentEventsWithPriority(testDb),
        'Query with priority indexes'
      );
      
      // Drop indexes and test again
      testDb.exec('DROP INDEX idx_events_priority_timestamp');
      testDb.exec('DROP INDEX idx_events_session_priority_timestamp');
      testDb.exec('DROP INDEX idx_events_type_priority');
      
      const { duration: unindexedDuration } = measureQueryPerformance(
        () => getRecentEventsWithPriority(testDb),
        'Query without indexes'
      );
      
      const performanceRatio = unindexedDuration / indexedDuration;
      expect(performanceRatio).toBeGreaterThan(1 / PERFORMANCE_TARGETS.INDEX_EFFECTIVENESS_RATIO);
      
      console.log(`Index effectiveness: ${performanceRatio.toFixed(1)}x faster with indexes`);
    });

    it('should validate index usage patterns', () => {
      // Insert events
      const events = createEventBatch(2000, 0.3, 5);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Test different query patterns that should use indexes
      const queryPatterns = [
        {
          name: 'Priority events only',
          query: () => testDb.prepare('SELECT * FROM events WHERE priority > 0 ORDER BY timestamp DESC LIMIT 100').all()
        },
        {
          name: 'Session priority events',
          query: () => testDb.prepare('SELECT * FROM events WHERE session_id = ? AND priority > 0 ORDER BY timestamp DESC LIMIT 50').all('session-1')
        },
        {
          name: 'Event type priority',
          query: () => testDb.prepare('SELECT * FROM events WHERE hook_event_type = ? AND priority > 0 ORDER BY timestamp DESC LIMIT 50').all('UserPromptSubmit')
        }
      ];
      
      queryPatterns.forEach(pattern => {
        const { duration } = measureQueryPerformance(
          pattern.query,
          pattern.name
        );
        
        expect(duration).toBeLessThan(PERFORMANCE_TARGETS.MAX_QUERY_TIME);
      });
    });
  });

  describe('Memory Usage', () => {
    it('should maintain reasonable memory usage during operations', () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      const events = createEventBatch(10000, 0.3, 20);
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Run multiple large queries
      for (let i = 0; i < 10; i++) {
        getRecentEventsWithPriority(testDb, {
          totalLimit: 500,
          priorityLimit: 350,
          regularLimit: 150,
          priorityRetentionHours: 24,
          regularRetentionHours: 4
        });
      }
      
      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory growth should be reasonable (under 100MB for this test)
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
      
      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Edge Cases and Stress Testing', () => {
    it('should handle very large payloads efficiently', () => {
      // Create events with large payloads
      const largeEvents = Array.from({ length: 100 }, (_, i) => {
        const event = createTestEvent(
          i % 3 === 0 ? 'UserPromptSubmit' : 'RegularEvent',
          `session-${i % 5}`,
          50 * 1024 // 50KB payload
        );
        
        // Add large chat data
        event.chat = Array.from({ length: 100 }, (_, j) => ({
          role: 'user',
          content: 'x'.repeat(1000) // 1KB per chat message
        }));
        
        return event;
      });
      
      const { duration } = measureQueryPerformance(
        () => {
          largeEvents.forEach(event => insertEventWithPriority(event, testDb));
        },
        'Insert 100 events with large payloads'
      );
      
      // Should handle large payloads without significant performance degradation
      expect(duration).toBeLessThan(5000); // 5 seconds for 100 large events
      
      // Test query performance with large payloads
      const { duration: queryDuration } = measureQueryPerformance(
        () => getRecentEventsWithPriority(testDb),
        'Query with large payload events'
      );
      
      expect(queryDuration).toBeLessThan(PERFORMANCE_TARGETS.MAX_QUERY_TIME * 2); // Allow 2x for large payloads
    });

    it('should handle burst traffic scenarios', () => {
      // Simulate burst of events in short time window
      const burstCount = 5000;
      const events = createEventBatch(burstCount, 0.4, 100); // High session count
      
      // All events in 1-second window
      const burstTime = Date.now();
      events.forEach((event, i) => {
        event.timestamp = burstTime + i; // Spread across 1 second
      });
      
      const { duration } = measureQueryPerformance(
        () => {
          events.forEach(event => insertEventWithPriority(event, testDb));
        },
        `Burst insert: ${burstCount} events`
      );
      
      const throughput = burstCount / (duration / 1000);
      expect(throughput).toBeGreaterThan(PERFORMANCE_TARGETS.TARGET_EVENTS_PER_SECOND * 0.5); // 50% under burst
      
      console.log(`Burst throughput: ${Math.round(throughput)} events/second`);
    });
  });
});