import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  setDatabase,
  initDatabase,
  insertEvent,
  getRecentEventsWithPriority,
  getSessionEventsWithPriority,
  calculateEventPriority,
  validatePriorityImplementation,
  validatePriorityPerformance,
  rollbackPriorityMigration,
  restorePriorityFromBackup,
  collectPriorityMetrics,
  PRIORITY_EVENT_TYPES
} from '../db';
import type { HookEvent } from '../types';

describe('Priority Event Migration System', () => {
  let testDb: Database;

  beforeEach(() => {
    // Use in-memory database for tests
    testDb = new Database(':memory:');
    setDatabase(testDb);
    initDatabase();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('Schema Migration', () => {
    it('should add priority columns during database initialization', () => {
      const columns = testDb.prepare("PRAGMA table_info(events)").all() as any[];
      const hasPriorityColumn = columns.some((col: any) => col.name === 'priority');
      const hasPriorityMetadataColumn = columns.some((col: any) => col.name === 'priority_metadata');

      expect(hasPriorityColumn).toBe(true);
      expect(hasPriorityMetadataColumn).toBe(true);
    });

    it('should create priority-specific indexes', () => {
      const indexes = testDb.prepare("PRAGMA index_list(events)").all() as any[];
      const priorityIndexExists = indexes.some((idx: any) => 
        idx.name === 'idx_events_priority_timestamp'
      );

      expect(priorityIndexExists).toBe(true);
    });

    it('should validate schema migration successfully', () => {
      const validation = validatePriorityImplementation();
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });
  });

  describe('Priority Event Classification', () => {
    it('should classify UserPromptSubmit as priority 1', () => {
      const priority = calculateEventPriority('UserPromptSubmit');
      expect(priority).toBe(1);
    });

    it('should classify Notification as priority 1', () => {
      const priority = calculateEventPriority('Notification');
      expect(priority).toBe(1);
    });

    it('should classify Stop as priority 1', () => {
      const priority = calculateEventPriority('Stop');
      expect(priority).toBe(1);
    });

    it('should classify SubagentStop as priority 1', () => {
      const priority = calculateEventPriority('SubagentStop');
      expect(priority).toBe(1);
    });

    it('should classify SubagentComplete as priority 1', () => {
      const priority = calculateEventPriority('SubagentComplete');
      expect(priority).toBe(1);
    });

    it('should classify unknown event types as priority 0', () => {
      const priority = calculateEventPriority('UnknownEvent');
      expect(priority).toBe(0);
    });

    it('should classify regular events as priority 0', () => {
      const priority = calculateEventPriority('RegularEvent');
      expect(priority).toBe(0);
    });
  });

  describe('Event Insertion with Priority', () => {
    it('should insert priority events with correct priority and metadata', () => {
      const event: HookEvent = {
        source_app: 'test',
        session_id: 'test-session',
        hook_event_type: 'UserPromptSubmit',
        payload: { test: 'data' },
        timestamp: Date.now()
      };

      const insertedEvent = insertEvent(event);

      expect(insertedEvent.priority).toBe(1);
      expect(insertedEvent.priority_metadata).toBeDefined();
      expect(insertedEvent.priority_metadata?.classification_reason).toBe('automatic');
      expect(insertedEvent.priority_metadata?.retention_policy).toBe('extended');
    });

    it('should insert regular events with priority 0', () => {
      const event: HookEvent = {
        source_app: 'test',
        session_id: 'test-session',
        hook_event_type: 'RegularEvent',
        payload: { test: 'data' },
        timestamp: Date.now()
      };

      const insertedEvent = insertEvent(event);

      expect(insertedEvent.priority).toBe(0);
      expect(insertedEvent.priority_metadata).toBeUndefined();
    });

    it('should handle batch insertion of mixed priority events', () => {
      const events: HookEvent[] = [
        {
          source_app: 'test',
          session_id: 'test-session',
          hook_event_type: 'UserPromptSubmit',
          payload: { test: 'priority' },
          timestamp: Date.now() - 1000
        },
        {
          source_app: 'test',
          session_id: 'test-session',
          hook_event_type: 'RegularEvent',
          payload: { test: 'regular' },
          timestamp: Date.now() - 500
        },
        {
          source_app: 'test',
          session_id: 'test-session',
          hook_event_type: 'Notification',
          payload: { test: 'priority2' },
          timestamp: Date.now()
        }
      ];

      const insertedEvents = events.map(event => insertEvent(event));

      expect(insertedEvents[0].priority).toBe(1);
      expect(insertedEvents[1].priority).toBe(0);
      expect(insertedEvents[2].priority).toBe(1);
    });
  });

  describe('Dual-Bucket Retrieval', () => {
    beforeEach(() => {
      // Insert test events with different priorities and timestamps
      const now = Date.now();
      const testEvents = [
        // Priority events (should be retained longer)
        { type: 'UserPromptSubmit', timestamp: now - (20 * 60 * 60 * 1000) }, // 20 hours ago
        { type: 'Notification', timestamp: now - (12 * 60 * 60 * 1000) },     // 12 hours ago
        { type: 'Stop', timestamp: now - (6 * 60 * 60 * 1000) },              // 6 hours ago
        
        // Regular events (shorter retention)
        { type: 'RegularEvent1', timestamp: now - (3 * 60 * 60 * 1000) },     // 3 hours ago
        { type: 'RegularEvent2', timestamp: now - (2 * 60 * 60 * 1000) },     // 2 hours ago
        { type: 'RegularEvent3', timestamp: now - (1 * 60 * 60 * 1000) },     // 1 hour ago

        // Regular events that should be filtered out (too old)
        { type: 'OldRegularEvent', timestamp: now - (5 * 60 * 60 * 1000) },   // 5 hours ago
      ];

      testEvents.forEach(({ type, timestamp }) => {
        insertEvent({
          source_app: 'test',
          session_id: 'test-session',
          hook_event_type: type,
          payload: { test: 'data' },
          timestamp
        });
      });
    });

    it('should retrieve priority events with extended retention', () => {
      const events = getRecentEventsWithPriority({
        totalLimit: 100,
        priorityLimit: 50,
        regularLimit: 25,
        priorityRetentionHours: 24,
        regularRetentionHours: 4
      });

      const priorityEvents = events.filter(e => (e as any).priority > 0);
      const regularEvents = events.filter(e => (e as any).priority === 0);

      // Should have 3 priority events (all within 24 hours)
      expect(priorityEvents).toHaveLength(3);
      
      // Should have 3 regular events (within 4 hours, excluding 5-hour-old event)
      expect(regularEvents).toHaveLength(3);

      // Verify priority event types
      const priorityTypes = priorityEvents.map(e => e.hook_event_type);
      expect(priorityTypes).toContain('UserPromptSubmit');
      expect(priorityTypes).toContain('Notification');
      expect(priorityTypes).toContain('Stop');
    });

    it('should apply intelligent event limiting preserving priority events', () => {
      const events = getRecentEventsWithPriority({
        totalLimit: 4, // Force limiting
        priorityLimit: 10,
        regularLimit: 10,
        priorityRetentionHours: 24,
        regularRetentionHours: 4
      });

      const priorityEvents = events.filter(e => (e as any).priority > 0);
      
      // Should preserve priority events (70% allocation = 2-3 events)
      expect(priorityEvents.length).toBeGreaterThan(0);
      expect(events).toHaveLength(4);
    });

    it('should sort events chronologically', () => {
      const events = getRecentEventsWithPriority();
      
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp!).toBeGreaterThanOrEqual(events[i - 1].timestamp!);
      }
    });
  });

  describe('Session-Specific Priority Queries', () => {
    beforeEach(() => {
      // Insert events across multiple sessions
      const now = Date.now();
      const sessions = ['session-1', 'session-2'];
      
      sessions.forEach(sessionId => {
        ['UserPromptSubmit', 'RegularEvent', 'Notification'].forEach((type, index) => {
          insertEvent({
            source_app: 'test',
            session_id: sessionId,
            hook_event_type: type,
            payload: { session: sessionId, type },
            timestamp: now - (index * 1000)
          });
        });
      });
    });

    it('should retrieve events for specific session with priority awareness', () => {
      const events = getSessionEventsWithPriority('session-1');
      
      expect(events).toHaveLength(3);
      expect(events.every(e => e.session_id === 'session-1')).toBe(true);
      
      const priorityEvents = events.filter(e => (e as any).priority > 0);
      expect(priorityEvents).toHaveLength(2); // UserPromptSubmit and Notification
    });

    it('should filter by event types in session queries', () => {
      const events = getSessionEventsWithPriority(
        'session-1',
        ['UserPromptSubmit', 'Notification']
      );
      
      expect(events).toHaveLength(2);
      expect(events.every(e => (e as any).priority > 0)).toBe(true);
    });

    it('should apply retention windows to session queries', () => {
      // Insert old events
      const veryOldTime = Date.now() - (48 * 60 * 60 * 1000); // 48 hours ago
      
      insertEvent({
        source_app: 'test',
        session_id: 'session-1',
        hook_event_type: 'UserPromptSubmit',
        payload: { old: true },
        timestamp: veryOldTime
      });

      const events = getSessionEventsWithPriority('session-1', undefined, {
        priorityRetentionHours: 24,
        regularRetentionHours: 4
      });

      // The very old priority event should be filtered out
      expect(events.every(e => e.payload.old !== true)).toBe(true);
    });
  });

  describe('Performance Validation', () => {
    beforeEach(() => {
      // Insert larger dataset for performance testing
      const now = Date.now();
      const eventTypes = ['UserPromptSubmit', 'Notification', 'Stop', 'RegularEvent1', 'RegularEvent2'];
      
      for (let i = 0; i < 1000; i++) {
        const eventType = eventTypes[i % eventTypes.length];
        insertEvent({
          source_app: 'test',
          session_id: `session-${Math.floor(i / 100)}`,
          hook_event_type: eventType,
          payload: { index: i },
          timestamp: now - (i * 1000)
        });
      }
    });

    it('should validate query performance meets requirements', () => {
      const performance = validatePriorityPerformance();
      
      expect(performance.performant).toBe(true);
      expect(performance.issues).toHaveLength(0);
      expect(performance.metrics.queryTime).toBeLessThan(100);
    });

    it('should handle large result sets efficiently', () => {
      const startTime = Date.now();
      const events = getRecentEventsWithPriority({
        totalLimit: 500,
        priorityLimit: 300,
        regularLimit: 200,
        priorityRetentionHours: 24,
        regularRetentionHours: 4
      });
      const queryTime = Date.now() - startTime;

      expect(queryTime).toBeLessThan(100); // 100ms threshold
      expect(events.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Rollback and Recovery', () => {
    beforeEach(() => {
      // Insert test data with priority classifications
      const events = [
        { type: 'UserPromptSubmit', session: 'test-1' },
        { type: 'Notification', session: 'test-2' },
        { type: 'RegularEvent', session: 'test-3' }
      ];

      events.forEach(({ type, session }) => {
        insertEvent({
          source_app: 'test',
          session_id: session,
          hook_event_type: type,
          payload: { test: 'rollback' },
          timestamp: Date.now()
        });
      });
    });

    it('should successfully rollback priority migration', () => {
      const result = rollbackPriorityMigration();
      
      expect(result.success).toBe(true);
      expect(result.backupCount).toBe(2); // 2 priority events backed up

      // Verify all events now have priority 0
      const events = testDb.prepare('SELECT priority FROM events').all() as any[];
      expect(events.every((e: any) => e.priority === 0)).toBe(true);
    });

    it('should successfully restore from backup', () => {
      // First rollback
      const rollbackResult = rollbackPriorityMigration();
      expect(rollbackResult.success).toBe(true);

      // Then restore
      const restoreResult = restorePriorityFromBackup();
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredCount).toBe(2);

      // Verify priority events are restored
      const priorityEvents = testDb.prepare(
        'SELECT COUNT(*) as count FROM events WHERE priority > 0'
      ).get() as any;
      expect(priorityEvents.count).toBe(2);
    });

    it('should handle missing backup table gracefully', () => {
      const result = restorePriorityFromBackup();
      expect(result.success).toBe(false);
      expect(result.message).toContain('No backup table found');
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(() => {
      // Insert mixed events for metrics testing
      const now = Date.now();
      const events = [
        { type: 'UserPromptSubmit', time: now - (2 * 60 * 60 * 1000) },  // 2 hours ago
        { type: 'Notification', time: now - (1 * 60 * 60 * 1000) },      // 1 hour ago
        { type: 'RegularEvent1', time: now - (30 * 60 * 1000) },         // 30 minutes ago
        { type: 'RegularEvent2', time: now - (15 * 60 * 1000) },         // 15 minutes ago
        { type: 'Stop', time: now - (5 * 60 * 1000) },                   // 5 minutes ago
      ];

      events.forEach(({ type, time }) => {
        insertEvent({
          source_app: 'test',
          session_id: 'metrics-test',
          hook_event_type: type,
          payload: { metrics: 'test' },
          timestamp: time
        });
      });
    });

    it('should collect comprehensive priority metrics', () => {
      const metrics = collectPriorityMetrics();

      expect(metrics.totalEvents).toBe(5);
      expect(metrics.priorityEvents).toBe(3); // UserPromptSubmit, Notification, Stop
      expect(metrics.regularEvents).toBe(2);
      expect(metrics.priorityPercentage).toBe(60);
    });

    it('should calculate classification accuracy correctly', () => {
      const metrics = collectPriorityMetrics();

      expect(metrics.classificationAccuracy.accuracy).toBe(100);
      expect(metrics.classificationAccuracy.correctlyClassified).toBe(5);
      expect(metrics.classificationAccuracy.totalClassified).toBe(5);
    });

    it('should track retention effectiveness', () => {
      const metrics = collectPriorityMetrics();

      // All events are recent enough to be retained
      expect(metrics.retentionEffectiveness.priorityRetained).toBe(3);
      expect(metrics.retentionEffectiveness.regularRetained).toBe(2);
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle databases without priority columns gracefully', () => {
      // Create a fresh database without priority columns
      const legacyDb = new Database(':memory:');
      
      // Create events table without priority columns
      legacyDb.exec(`
        CREATE TABLE events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_app TEXT NOT NULL,
          session_id TEXT NOT NULL,
          hook_event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);

      setDatabase(legacyDb);

      // Insert an event - should work without priority columns
      const event: HookEvent = {
        source_app: 'test',
        session_id: 'legacy-test',
        hook_event_type: 'UserPromptSubmit',
        payload: { test: 'legacy' },
        timestamp: Date.now()
      };

      expect(() => insertEvent(event)).not.toThrow();

      legacyDb.close();
      setDatabase(testDb); // Restore test database
    });

    it('should maintain existing event structure when priority columns exist', () => {
      const event: HookEvent = {
        source_app: 'test',
        session_id: 'compatibility-test',
        hook_event_type: 'RegularEvent',
        payload: { test: 'compatibility' }
      };

      const insertedEvent = insertEvent(event);

      // Should have all original fields plus priority fields
      expect(insertedEvent.id).toBeDefined();
      expect(insertedEvent.source_app).toBe('test');
      expect(insertedEvent.session_id).toBe('compatibility-test');
      expect(insertedEvent.hook_event_type).toBe('RegularEvent');
      expect(insertedEvent.payload).toEqual({ test: 'compatibility' });
      expect(insertedEvent.timestamp).toBeDefined();
      expect(insertedEvent.priority).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty database gracefully', () => {
      const events = getRecentEventsWithPriority();
      expect(events).toHaveLength(0);
    });

    it('should handle invalid event types', () => {
      const priority = calculateEventPriority('');
      expect(priority).toBe(0);

      const priorityNull = calculateEventPriority(null as any);
      expect(priorityNull).toBe(0);
    });

    it('should handle extreme configuration values', () => {
      const events = getRecentEventsWithPriority({
        totalLimit: 0,
        priorityLimit: 0,
        regularLimit: 0,
        priorityRetentionHours: 0,
        regularRetentionHours: 0
      });

      expect(events).toHaveLength(0);
    });

    it('should handle negative timestamps gracefully', () => {
      const event: HookEvent = {
        source_app: 'test',
        session_id: 'edge-case',
        hook_event_type: 'UserPromptSubmit',
        payload: { test: 'negative' },
        timestamp: -1000
      };

      expect(() => insertEvent(event)).not.toThrow();
    });
  });

  describe('Configuration Integration', () => {
    it('should use environment variables for default configuration', () => {
      // Test will use the default values defined in getDefaultPriorityConfig
      const events = getRecentEventsWithPriority();
      
      // Should not throw and should use default limits
      expect(Array.isArray(events)).toBe(true);
    });

    it('should override defaults with provided configuration', () => {
      const customConfig = {
        totalLimit: 10,
        priorityLimit: 7,
        regularLimit: 3,
        priorityRetentionHours: 48,
        regularRetentionHours: 8
      };

      const events = getRecentEventsWithPriority(customConfig);
      expect(Array.isArray(events)).toBe(true);
    });
  });
});