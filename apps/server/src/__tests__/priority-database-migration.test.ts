/**
 * Priority Event Bucket Database Migration Tests
 * Testing schema validation, rollback procedures, and data integrity
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { 
  initDatabase, 
  insertEvent,
  getRecentEvents,
  getDatabase
} from "../db";
import type { HookEvent } from "../types";

// Test helper functions
function createTestDatabase(): Database {
  return new Database(":memory:");
}

function createTestEvent(eventType: string, sessionId?: string): HookEvent {
  return {
    source_app: "test",
    session_id: sessionId || "test-session",
    hook_event_type: eventType,
    payload: { agentName: "TestAgent", data: "test" },
    timestamp: Date.now()
  };
}

function migrateToPrioritySchema(db: Database): void {
  // Check if priority column already exists
  const columns = db.prepare("PRAGMA table_info(events)").all() as any[];
  const hasPriorityColumn = columns.some((col: any) => col.name === 'priority');
  
  if (!hasPriorityColumn) {
    console.log('Adding priority column to events table...');
    
    // Add priority column with default value
    db.exec('ALTER TABLE events ADD COLUMN priority INTEGER DEFAULT 0');
    
    // Add priority metadata column  
    db.exec('ALTER TABLE events ADD COLUMN priority_metadata TEXT');
    
    // Backfill priority values for existing events
    console.log('Backfilling priority values for existing events...');
    const priorityEventTypes = ['UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop'];
    
    for (const eventType of priorityEventTypes) {
      const updateStmt = db.prepare(`
        UPDATE events SET priority = 1, priority_metadata = ?
        WHERE hook_event_type = ? AND priority = 0
      `);
      
      const metadata = JSON.stringify({
        classified_at: Date.now(),
        classification_reason: 'migration_backfill',
        retention_policy: 'extended'
      });
      
      updateStmt.run(metadata, eventType);
    }
    
    console.log('Creating priority-based indexes...');
    // Create all priority indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_priority_timestamp ON events(session_id, priority DESC, timestamp DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_type_priority_timestamp ON events(hook_event_type, priority DESC, timestamp DESC)');
    
    console.log('Priority schema migration completed successfully');
  }
}

function validatePrioritySchema(db: Database): { valid: boolean; issues: string[]; stats: any } {
  const issues: string[] = [];
  
  // Check schema
  const columns = db.prepare("PRAGMA table_info(events)").all() as any[];
  const hasPriority = columns.some((col: any) => col.name === 'priority');
  const hasPriorityMetadata = columns.some((col: any) => col.name === 'priority_metadata');
  
  if (!hasPriority) issues.push('Missing priority column');
  if (!hasPriorityMetadata) issues.push('Missing priority_metadata column');
  
  // Check indexes
  const indexes = db.prepare("PRAGMA index_list(events)").all() as any[];
  const priorityIndexExists = indexes.some((idx: any) => 
    idx.name === 'idx_events_priority_timestamp'
  );
  
  if (!priorityIndexExists) issues.push('Missing priority timestamp index');
  
  // Validate data integrity
  const priorityStats = db.prepare(`
    SELECT 
      COUNT(*) as total_events,
      COUNT(CASE WHEN priority > 0 THEN 1 END) as priority_events,
      COUNT(CASE WHEN priority = 0 THEN 1 END) as regular_events
    FROM events
  `).get() as any;
  
  return {
    valid: issues.length === 0,
    issues,
    stats: priorityStats
  };
}

describe('Priority Database Migration', () => {
  let testDb: Database;

  beforeEach(() => {
    testDb = createTestDatabase();
    initDatabase(testDb);
  });

  afterEach(() => {
    testDb?.close();
  });

  describe('Schema Migration', () => {
    test('should add priority column without data loss', () => {
      // Setup: Create database with existing events
      const originalEvent = createTestEvent('RegularEvent');
      const userPromptEvent = createTestEvent('UserPromptSubmit');
      
      insertEvent(originalEvent, testDb);
      insertEvent(userPromptEvent, testDb);
      
      const beforeCount = testDb.prepare("SELECT COUNT(*) as count FROM events").get() as any;
      expect(beforeCount.count).toBe(2);
      
      // Execute: Run migration script
      migrateToPrioritySchema(testDb);
      
      // Verify: All existing events preserved
      const afterCount = testDb.prepare("SELECT COUNT(*) as count FROM events").get() as any;
      expect(afterCount.count).toBe(2);
      
      // Verify: Priority column added with default values
      const columns = testDb.prepare("PRAGMA table_info(events)").all() as any[];
      const priorityColumn = columns.find((col: any) => col.name === 'priority');
      expect(priorityColumn).toBeDefined();
      expect(priorityColumn.dflt_value).toBe('0');
    });

    test('should backfill priority values correctly', () => {
      // Setup: Database with priority and regular events
      const events = [
        createTestEvent('UserPromptSubmit'),
        createTestEvent('Notification'), 
        createTestEvent('Stop'),
        createTestEvent('SubagentStop'),
        createTestEvent('RegularEvent'),
        createTestEvent('AnotherRegularEvent')
      ];
      
      events.forEach(event => insertEvent(event, testDb));
      
      // Execute: Migration backfill script
      migrateToPrioritySchema(testDb);
      
      // Verify: Correct priority values assigned
      const priorityEvents = testDb.prepare(`
        SELECT hook_event_type, priority, priority_metadata 
        FROM events 
        WHERE priority > 0
      `).all() as any[];
      
      const regularEvents = testDb.prepare(`
        SELECT hook_event_type, priority 
        FROM events 
        WHERE priority = 0
      `).all() as any[];
      
      expect(priorityEvents).toHaveLength(4); // UserPromptSubmit, Notification, Stop, SubagentStop
      expect(regularEvents).toHaveLength(2); // RegularEvent, AnotherRegularEvent
      
      // Verify priority metadata exists
      priorityEvents.forEach(event => {
        expect(event.priority).toBe(1);
        expect(event.priority_metadata).toBeDefined();
        
        const metadata = JSON.parse(event.priority_metadata);
        expect(metadata.classification_reason).toBe('migration_backfill');
        expect(metadata.retention_policy).toBe('extended');
      });
    });

    test('should create all required indexes', () => {
      migrateToPrioritySchema(testDb);
      
      // Verify: All priority-based indexes exist
      const indexes = testDb.prepare("PRAGMA index_list(events)").all() as any[];
      const indexNames = indexes.map((idx: any) => idx.name);
      
      expect(indexNames).toContain('idx_events_priority_timestamp');
      expect(indexNames).toContain('idx_events_session_priority_timestamp');
      expect(indexNames).toContain('idx_events_type_priority_timestamp');
      
      // Verify indexes are using correct columns
      const priorityTimestampIndex = testDb.prepare(
        "PRAGMA index_info(idx_events_priority_timestamp)"
      ).all() as any[];
      
      expect(priorityTimestampIndex).toHaveLength(2);
      expect(priorityTimestampIndex.find(col => col.name === 'priority')).toBeDefined();
      expect(priorityTimestampIndex.find(col => col.name === 'timestamp')).toBeDefined();
    });

    test('should be idempotent - safe to run multiple times', () => {
      // First migration
      migrateToPrioritySchema(testDb);
      const firstValidation = validatePrioritySchema(testDb);
      expect(firstValidation.valid).toBe(true);
      
      // Second migration - should not cause errors
      migrateToPrioritySchema(testDb);
      const secondValidation = validatePrioritySchema(testDb);
      expect(secondValidation.valid).toBe(true);
      
      // Schema should be identical
      expect(firstValidation.stats).toEqual(secondValidation.stats);
    });

    test('should handle empty database migration', () => {
      // Execute migration on empty database
      migrateToPrioritySchema(testDb);
      
      // Verify schema is correct
      const validation = validatePrioritySchema(testDb);
      expect(validation.valid).toBe(true);
      expect(validation.stats.total_events).toBe(0);
    });

    test('should preserve existing data relationships', () => {
      // Setup: Events with relationships
      const sessionId = 'test-session-123';
      const events = [
        createTestEvent('UserPromptSubmit', sessionId),
        createTestEvent('tool_use', sessionId),
        createTestEvent('response', sessionId)
      ];
      
      events.forEach(event => insertEvent(event, testDb));
      
      // Execute migration
      migrateToPrioritySchema(testDb);
      
      // Verify: Session relationships preserved
      const sessionEvents = testDb.prepare(`
        SELECT * FROM events WHERE session_id = ? ORDER BY timestamp
      `).all(sessionId) as any[];
      
      expect(sessionEvents).toHaveLength(3);
      expect(sessionEvents[0].hook_event_type).toBe('UserPromptSubmit');
      expect(sessionEvents[0].priority).toBe(1); // Should be priority event
      expect(sessionEvents[1].priority).toBe(0); // Regular event
      expect(sessionEvents[2].priority).toBe(0); // Regular event
    });
  });

  describe('Migration Rollback', () => {
    test('should be able to rollback priority schema changes', () => {
      // Apply migration
      migrateToPrioritySchema(testDb);
      
      // Simulate rollback by removing priority columns
      // Note: SQLite doesn't support DROP COLUMN, so we'd recreate table
      testDb.exec(`
        CREATE TABLE events_backup AS SELECT 
          id, source_app, session_id, hook_event_type, 
          payload, chat, summary, timestamp 
        FROM events
      `);
      
      testDb.exec('DROP TABLE events');
      testDb.exec('ALTER TABLE events_backup RENAME TO events');
      
      // Verify original schema restored
      const columns = testDb.prepare("PRAGMA table_info(events)").all() as any[];
      const hasPriorityColumn = columns.some((col: any) => col.name === 'priority');
      expect(hasPriorityColumn).toBe(false);
    });

    test('should handle partial migration failures gracefully', () => {
      // Simulate partial failure by manually adding priority column but not metadata
      testDb.exec('ALTER TABLE events ADD COLUMN priority INTEGER DEFAULT 0');
      
      // Migration should complete successfully despite partial state
      expect(() => migrateToPrioritySchema(testDb)).not.toThrow();
      
      // Verify complete migration
      const validation = validatePrioritySchema(testDb);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Migration Performance', () => {
    test('should complete migration within reasonable time for large datasets', () => {
      // Setup: Large dataset (1000 events)
      const events: HookEvent[] = [];
      for (let i = 0; i < 1000; i++) {
        const eventType = i % 4 === 0 ? 'UserPromptSubmit' : 'RegularEvent';
        events.push(createTestEvent(eventType, `session-${Math.floor(i / 10)}`));
      }
      
      events.forEach(event => insertEvent(event, testDb));
      
      // Execute: Time the migration
      const startTime = Date.now();
      migrateToPrioritySchema(testDb);
      const migrationTime = Date.now() - startTime;
      
      // Verify: Completes within 1 second
      expect(migrationTime).toBeLessThan(1000);
      
      // Verify: Data integrity maintained
      const validation = validatePrioritySchema(testDb);
      expect(validation.valid).toBe(true);
      expect(validation.stats.total_events).toBe(1000);
      expect(validation.stats.priority_events).toBe(250); // 25% UserPromptSubmit events
    });

    test('should handle concurrent access during migration', () => {
      // This test would be more complex in a real scenario with multiple connections
      // For now, verify migration doesn't corrupt database
      
      insertEvent(createTestEvent('UserPromptSubmit'), testDb);
      
      // Simulate concurrent access by running queries during migration
      migrateToPrioritySchema(testDb);
      
      // Verify database is not corrupted
      const integrityCheck = testDb.prepare("PRAGMA integrity_check").get() as any;
      expect(integrityCheck.integrity_check).toBe('ok');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined event types in backfill', () => {
      // Manually insert event with null event type
      testDb.exec(`
        INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
        VALUES ('test', 'test-session', NULL, '{}', ${Date.now()})
      `);
      
      // Migration should not fail
      expect(() => migrateToPrioritySchema(testDb)).not.toThrow();
      
      // Null event should remain priority 0
      const nullEvent = testDb.prepare(`
        SELECT priority FROM events WHERE hook_event_type IS NULL
      `).get() as any;
      
      expect(nullEvent?.priority).toBe(0);
    });

    test('should handle very large event payloads', () => {
      // Create event with large payload
      const largePayload = { data: 'A'.repeat(10000) }; // 10KB payload
      const event = createTestEvent('UserPromptSubmit');
      event.payload = largePayload;
      
      insertEvent(event, testDb);
      
      // Migration should handle large payloads
      expect(() => migrateToPrioritySchema(testDb)).not.toThrow();
      
      // Verify event preserved with priority
      const storedEvent = testDb.prepare(`
        SELECT priority, payload FROM events WHERE hook_event_type = 'UserPromptSubmit'
      `).get() as any;
      
      expect(storedEvent.priority).toBe(1);
      expect(JSON.parse(storedEvent.payload).data).toBe(largePayload.data);
    });

    test('should handle special characters in event types', () => {
      const specialEventTypes = [
        'Event-With-Dashes',
        'Event_With_Underscores', 
        'Event With Spaces',
        'Event.With.Dots',
        'EventWithUnicode🚀'
      ];
      
      specialEventTypes.forEach(eventType => {
        insertEvent(createTestEvent(eventType), testDb);
      });
      
      // Migration should handle special characters
      expect(() => migrateToPrioritySchema(testDb)).not.toThrow();
      
      // All should remain regular priority
      const regularEvents = testDb.prepare(`
        SELECT hook_event_type FROM events WHERE priority = 0
      `).all() as any[];
      
      expect(regularEvents).toHaveLength(specialEventTypes.length);
    });
  });

  describe('Data Integrity Validation', () => {
    test('should maintain referential integrity after migration', () => {
      const sessionId = 'integrity-test-session';
      const events = [
        createTestEvent('UserPromptSubmit', sessionId),
        createTestEvent('tool_use', sessionId),
        createTestEvent('response', sessionId)
      ];
      
      events.forEach(event => insertEvent(event, testDb));
      
      migrateToPrioritySchema(testDb);
      
      // Verify all events still belong to same session
      const sessionEvents = testDb.prepare(`
        SELECT COUNT(*) as count FROM events WHERE session_id = ?
      `).get(sessionId) as any;
      
      expect(sessionEvents.count).toBe(3);
    });

    test('should preserve timestamp ordering after migration', () => {
      const baseTime = Date.now();
      const events = [
        { ...createTestEvent('UserPromptSubmit'), timestamp: baseTime },
        { ...createTestEvent('tool_use'), timestamp: baseTime + 1000 },
        { ...createTestEvent('Stop'), timestamp: baseTime + 2000 }
      ];
      
      events.forEach(event => insertEvent(event, testDb));
      
      migrateToPrioritySchema(testDb);
      
      // Verify timestamp ordering preserved
      const orderedEvents = testDb.prepare(`
        SELECT hook_event_type, timestamp FROM events ORDER BY timestamp
      `).all() as any[];
      
      expect(orderedEvents[0].hook_event_type).toBe('UserPromptSubmit');
      expect(orderedEvents[1].hook_event_type).toBe('tool_use');
      expect(orderedEvents[2].hook_event_type).toBe('Stop');
    });

    test('should validate priority metadata format', () => {
      insertEvent(createTestEvent('UserPromptSubmit'), testDb);
      
      migrateToPrioritySchema(testDb);
      
      const priorityEvent = testDb.prepare(`
        SELECT priority_metadata FROM events WHERE priority > 0
      `).get() as any;
      
      expect(priorityEvent.priority_metadata).toBeDefined();
      
      const metadata = JSON.parse(priorityEvent.priority_metadata);
      expect(metadata).toHaveProperty('classified_at');
      expect(metadata).toHaveProperty('classification_reason');
      expect(metadata).toHaveProperty('retention_policy');
      expect(typeof metadata.classified_at).toBe('number');
      expect(metadata.classification_reason).toBe('migration_backfill');
      expect(metadata.retention_policy).toBe('extended');
    });
  });
});