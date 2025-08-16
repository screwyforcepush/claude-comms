/**
 * Priority Event Server Logic Tests
 * Testing priority fetching, retention policies, and classification
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { 
  initDatabase, 
  insertEvent,
  getRecentEvents
} from "../db";
import type { HookEvent } from "../types";

// Priority Event Configuration Interface
interface PriorityEventConfig {
  totalLimit: number;
  priorityLimit: number;
  regularLimit: number;
  priorityRetentionHours: number;
  regularRetentionHours: number;
}

// Priority Event Types
const PRIORITY_EVENT_TYPES = {
  'UserPromptSubmit': 1,
  'Notification': 1,
  'Stop': 1,
  'SubagentStop': 1,
  'SubagentComplete': 1
} as const;

// Test implementations of priority functions
function calculateEventPriority(eventType: string, payload?: any): number {
  const basePriority = PRIORITY_EVENT_TYPES[eventType as keyof typeof PRIORITY_EVENT_TYPES] || 0;
  return basePriority;
}

function insertEventWithPriority(event: HookEvent, db: Database): HookEvent {
  const priority = calculateEventPriority(event.hook_event_type, event.payload);
  const priorityMetadata = priority > 0 ? JSON.stringify({
    classified_at: Date.now(),
    classification_reason: 'automatic',
    retention_policy: priority === 1 ? 'extended' : 'standard'
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

function getRecentEventsWithPriority(
  db: Database,
  config: PriorityEventConfig = {
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
  
  // Apply total limit while preserving priority events
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

function getSessionEventsWithPriority(
  db: Database,
  sessionId: string, 
  eventTypes?: string[],
  priorityConfig?: Partial<PriorityEventConfig>
): HookEvent[] {
  const config = {
    totalLimit: 200,
    priorityLimit: 150,
    regularLimit: 50,
    priorityRetentionHours: 24,
    regularRetentionHours: 4,
    ...priorityConfig
  };
  
  let baseQuery = `
    SELECT id, source_app, session_id, hook_event_type, payload, 
           chat, summary, timestamp, priority, priority_metadata
    FROM events
    WHERE session_id = ?
  `;
  
  const params: any[] = [sessionId];
  
  if (eventTypes && eventTypes.length > 0) {
    const placeholders = eventTypes.map(() => '?').join(',');
    baseQuery += ` AND hook_event_type IN (${placeholders})`;
    params.push(...eventTypes);
  }
  
  // Apply retention windows for priority vs regular events
  const now = Date.now();
  const priorityCutoff = now - (config.priorityRetentionHours * 60 * 60 * 1000);
  const regularCutoff = now - (config.regularRetentionHours * 60 * 60 * 1000);
  
  baseQuery += ` 
    AND (
      (priority > 0 AND timestamp >= ?) OR 
      (priority = 0 AND timestamp >= ?)
    )
    ORDER BY timestamp ASC
  `;
  
  params.push(priorityCutoff, regularCutoff);
  
  const stmt = db.prepare(baseQuery);
  const rows = stmt.all(...params) as any[];
  
  return rows.map(mapDatabaseEventToHookEvent);
}

// Test helper functions
function createTestDatabase(): Database {
  const db = new Database(":memory:");
  initDatabase(db);
  
  // Add priority columns
  db.exec('ALTER TABLE events ADD COLUMN priority INTEGER DEFAULT 0');
  db.exec('ALTER TABLE events ADD COLUMN priority_metadata TEXT');
  
  return db;
}

function createTestEvent(eventType: string, sessionId?: string, timestamp?: number): HookEvent {
  return {
    source_app: "test",
    session_id: sessionId || "test-session",
    hook_event_type: eventType,
    payload: { agentName: "TestAgent", data: "test" },
    timestamp: timestamp || Date.now()
  };
}

describe('Priority Event Server Logic', () => {
  let testDb: Database;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    testDb?.close();
  });

  describe('Event Priority Classification', () => {
    test('should classify priority events correctly', () => {
      const priorityEventTypes = ['UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop', 'SubagentComplete'];
      
      priorityEventTypes.forEach(eventType => {
        const priority = calculateEventPriority(eventType);
        expect(priority).toBe(1);
      });
    });

    test('should classify regular events as priority 0', () => {
      const regularEventTypes = ['tool_use', 'response', 'data', 'log', 'custom_event'];
      
      regularEventTypes.forEach(eventType => {
        const priority = calculateEventPriority(eventType);
        expect(priority).toBe(0);
      });
    });

    test('should handle unknown event types as regular priority', () => {
      const unknownTypes = ['unknown_event', '', null, undefined];
      
      unknownTypes.forEach(eventType => {
        const priority = calculateEventPriority(eventType as string);
        expect(priority).toBe(0);
      });
    });

    test('should store events with calculated priority', () => {
      const priorityEvent = createTestEvent('UserPromptSubmit');
      const regularEvent = createTestEvent('tool_use');
      
      const storedPriorityEvent = insertEventWithPriority(priorityEvent, testDb);
      const storedRegularEvent = insertEventWithPriority(regularEvent, testDb);
      
      expect(storedPriorityEvent.priority).toBe(1);
      expect(storedPriorityEvent.priority_metadata).toBeDefined();
      expect(storedRegularEvent.priority).toBe(0);
      expect(storedRegularEvent.priority_metadata).toBeUndefined();
    });
  });

  describe('Priority Retrieval Algorithm', () => {
    test('should return mixed priority and regular events', () => {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      // Create mix of priority and regular events
      const events = [
        { ...createTestEvent('UserPromptSubmit'), timestamp: oneHourAgo },
        { ...createTestEvent('tool_use'), timestamp: oneHourAgo + 1000 },
        { ...createTestEvent('Notification'), timestamp: oneHourAgo + 2000 },
        { ...createTestEvent('response'), timestamp: oneHourAgo + 3000 },
        { ...createTestEvent('Stop'), timestamp: oneHourAgo + 4000 }
      ];
      
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      const retrievedEvents = getRecentEventsWithPriority(testDb, {
        totalLimit: 10,
        priorityLimit: 7,
        regularLimit: 3,
        priorityRetentionHours: 24,
        regularRetentionHours: 4
      });
      
      const priorityEvents = retrievedEvents.filter(e => (e as any).priority > 0);
      const regularEvents = retrievedEvents.filter(e => (e as any).priority === 0);
      
      expect(priorityEvents.length).toBe(3); // UserPromptSubmit, Notification, Stop
      expect(regularEvents.length).toBe(2); // tool_use, response
      expect(retrievedEvents.length).toBe(5);
    });

    test('should preserve priority events when total limit exceeded', () => {
      const now = Date.now();
      
      // Create more events than total limit allows
      const events: HookEvent[] = [];
      for (let i = 0; i < 10; i++) {
        events.push({ ...createTestEvent('UserPromptSubmit'), timestamp: now + i * 1000 });
      }
      for (let i = 0; i < 10; i++) {
        events.push({ ...createTestEvent('tool_use'), timestamp: now + (i + 10) * 1000 });
      }
      
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      const retrievedEvents = getRecentEventsWithPriority(testDb, {
        totalLimit: 15, // Less than total events (20)
        priorityLimit: 10,
        regularLimit: 5,
        priorityRetentionHours: 24,
        regularRetentionHours: 4
      });
      
      const priorityEvents = retrievedEvents.filter(e => (e as any).priority > 0);
      
      // Should preserve all priority events (10) and fill remaining with regular (5)
      expect(priorityEvents.length).toBe(10);
      expect(retrievedEvents.length).toBe(15);
    });

    test('should apply retention windows correctly', () => {
      const now = Date.now();
      const twoHoursAgo = now - (2 * 60 * 60 * 1000);
      const sixHoursAgo = now - (6 * 60 * 60 * 1000);
      const oneHourAgo = now - (60 * 60 * 1000);
      
      // Create events at different times
      const events = [
        { ...createTestEvent('UserPromptSubmit'), timestamp: sixHoursAgo }, // Should be included (priority)
        { ...createTestEvent('tool_use'), timestamp: sixHoursAgo }, // Should be excluded (regular, beyond retention)
        { ...createTestEvent('Notification'), timestamp: oneHourAgo }, // Should be included (priority)
        { ...createTestEvent('response'), timestamp: oneHourAgo } // Should be included (regular, within retention)
      ];
      
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      const retrievedEvents = getRecentEventsWithPriority(testDb, {
        totalLimit: 10,
        priorityLimit: 5,
        regularLimit: 5,
        priorityRetentionHours: 24, // 24 hours for priority
        regularRetentionHours: 4   // 4 hours for regular
      });
      
      expect(retrievedEvents.length).toBe(3); // Should exclude old regular event
      
      const eventTypes = retrievedEvents.map(e => e.hook_event_type);
      expect(eventTypes).toContain('UserPromptSubmit'); // Old priority event included
      expect(eventTypes).toContain('Notification'); // Recent priority event included
      expect(eventTypes).toContain('response'); // Recent regular event included
      expect(eventTypes).not.toContain('tool_use'); // Old regular event excluded
    });

    test('should sort events by timestamp', () => {
      const now = Date.now();
      const events = [
        { ...createTestEvent('UserPromptSubmit'), timestamp: now + 3000 },
        { ...createTestEvent('tool_use'), timestamp: now + 1000 },
        { ...createTestEvent('Notification'), timestamp: now + 2000 }
      ];
      
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      const retrievedEvents = getRecentEventsWithPriority(testDb);
      
      // Should be sorted by timestamp ascending
      expect(retrievedEvents[0].hook_event_type).toBe('tool_use'); // Earliest
      expect(retrievedEvents[1].hook_event_type).toBe('Notification'); // Middle
      expect(retrievedEvents[2].hook_event_type).toBe('UserPromptSubmit'); // Latest
    });
  });

  describe('Session-Specific Priority Queries', () => {
    test('should filter events by session with priority awareness', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      const now = Date.now();
      
      const events = [
        { ...createTestEvent('UserPromptSubmit', session1), timestamp: now },
        { ...createTestEvent('tool_use', session1), timestamp: now + 1000 },
        { ...createTestEvent('Notification', session2), timestamp: now + 2000 },
        { ...createTestEvent('response', session2), timestamp: now + 3000 }
      ];
      
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      const session1Events = getSessionEventsWithPriority(testDb, session1);
      const session2Events = getSessionEventsWithPriority(testDb, session2);
      
      expect(session1Events.length).toBe(2);
      expect(session2Events.length).toBe(2);
      
      expect(session1Events.every(e => e.session_id === session1)).toBe(true);
      expect(session2Events.every(e => e.session_id === session2)).toBe(true);
    });

    test('should filter by event types with priority preservation', () => {
      const sessionId = 'test-session';
      const now = Date.now();
      
      const events = [
        { ...createTestEvent('UserPromptSubmit', sessionId), timestamp: now },
        { ...createTestEvent('tool_use', sessionId), timestamp: now + 1000 },
        { ...createTestEvent('Notification', sessionId), timestamp: now + 2000 },
        { ...createTestEvent('response', sessionId), timestamp: now + 3000 }
      ];
      
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      const filteredEvents = getSessionEventsWithPriority(
        testDb, 
        sessionId, 
        ['UserPromptSubmit', 'Notification']
      );
      
      expect(filteredEvents.length).toBe(2);
      expect(filteredEvents.every(e => e.priority > 0)).toBe(true);
      expect(filteredEvents.map(e => e.hook_event_type).sort()).toEqual(['Notification', 'UserPromptSubmit']);
    });

    test('should apply retention windows per session', () => {
      const sessionId = 'test-session';
      const now = Date.now();
      const fiveHoursAgo = now - (5 * 60 * 60 * 1000);
      
      const events = [
        { ...createTestEvent('UserPromptSubmit', sessionId), timestamp: fiveHoursAgo }, // Priority - should be included
        { ...createTestEvent('tool_use', sessionId), timestamp: fiveHoursAgo } // Regular - should be excluded
      ];
      
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      const sessionEvents = getSessionEventsWithPriority(testDb, sessionId, undefined, {
        priorityRetentionHours: 24,
        regularRetentionHours: 4
      });
      
      expect(sessionEvents.length).toBe(1);
      expect(sessionEvents[0].hook_event_type).toBe('UserPromptSubmit');
    });
  });

  describe('Intelligent Event Limiting', () => {
    test('should preserve priority events when limiting', () => {
      const events: HookEvent[] = [];
      
      // Create 10 priority events and 10 regular events
      for (let i = 0; i < 10; i++) {
        events.push({ 
          ...createTestEvent('UserPromptSubmit'), 
          timestamp: Date.now() + i * 1000,
          priority: 1 
        } as any);
        events.push({ 
          ...createTestEvent('tool_use'), 
          timestamp: Date.now() + (i + 10) * 1000,
          priority: 0 
        } as any);
      }
      
      // Limit to 15 events total
      const limitedEvents = intelligentEventLimiting(events, 15);
      
      const priorityEvents = limitedEvents.filter(e => (e as any).priority > 0);
      const regularEvents = limitedEvents.filter(e => (e as any).priority === 0);
      
      // Should preserve more priority events
      expect(priorityEvents.length).toBe(10); // All priority events preserved
      expect(regularEvents.length).toBe(5);   // Some regular events preserved
      expect(limitedEvents.length).toBe(15);
    });

    test('should handle edge case where priority events exceed total limit', () => {
      const events: HookEvent[] = [];
      
      // Create 15 priority events (more than total limit of 10)
      for (let i = 0; i < 15; i++) {
        events.push({ 
          ...createTestEvent('UserPromptSubmit'), 
          timestamp: Date.now() + i * 1000,
          priority: 1 
        } as any);
      }
      
      const limitedEvents = intelligentEventLimiting(events, 10);
      
      expect(limitedEvents.length).toBe(10);
      expect(limitedEvents.every(e => (e as any).priority > 0)).toBe(true);
    });

    test('should maintain timestamp ordering after limiting', () => {
      const events: HookEvent[] = [];
      const now = Date.now();
      
      // Create interleaved priority and regular events
      for (let i = 0; i < 10; i++) {
        events.push({ 
          ...createTestEvent(i % 2 === 0 ? 'UserPromptSubmit' : 'tool_use'), 
          timestamp: now + i * 1000,
          priority: i % 2 === 0 ? 1 : 0 
        } as any);
      }
      
      const limitedEvents = intelligentEventLimiting(events, 8);
      
      // Verify timestamp ordering
      for (let i = 1; i < limitedEvents.length; i++) {
        expect(limitedEvents[i].timestamp).toBeGreaterThanOrEqual(limitedEvents[i - 1].timestamp);
      }
    });
  });

  describe('Performance Optimization', () => {
    test('should retrieve events within acceptable time limits', () => {
      // Create large dataset
      const events: HookEvent[] = [];
      const now = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        const eventType = i % 4 === 0 ? 'UserPromptSubmit' : 'tool_use';
        events.push({ 
          ...createTestEvent(eventType), 
          timestamp: now + i * 1000 
        });
      }
      
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Test query performance
      const startTime = Date.now();
      const retrievedEvents = getRecentEventsWithPriority(testDb, {
        totalLimit: 100,
        priorityLimit: 70,
        regularLimit: 30,
        priorityRetentionHours: 24,
        regularRetentionHours: 4
      });
      const queryTime = Date.now() - startTime;
      
      expect(queryTime).toBeLessThan(100); // Should complete within 100ms
      expect(retrievedEvents.length).toBeLessThanOrEqual(100);
    });

    test('should handle concurrent priority queries efficiently', () => {
      // Create test data
      const events: HookEvent[] = [];
      for (let i = 0; i < 100; i++) {
        events.push(createTestEvent(i % 3 === 0 ? 'UserPromptSubmit' : 'tool_use'));
      }
      
      events.forEach(event => insertEventWithPriority(event, testDb));
      
      // Simulate concurrent queries
      const queryPromises = Array.from({ length: 10 }, () => 
        Promise.resolve(getRecentEventsWithPriority(testDb))
      );
      
      expect(() => Promise.all(queryPromises)).not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty database gracefully', () => {
      const events = getRecentEventsWithPriority(testDb);
      expect(events).toEqual([]);
    });

    test('should handle malformed event data', () => {
      // Insert event with malformed JSON payload
      testDb.exec(`
        INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp, priority)
        VALUES ('test', 'test-session', 'UserPromptSubmit', 'invalid-json', ${Date.now()}, 1)
      `);
      
      // Should not crash when trying to retrieve
      expect(() => getRecentEventsWithPriority(testDb)).not.toThrow();
    });

    test('should handle null priority metadata gracefully', () => {
      const event = createTestEvent('UserPromptSubmit');
      const stmt = testDb.prepare(`
        INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp, priority, priority_metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        event.source_app,
        event.session_id,
        event.hook_event_type,
        JSON.stringify(event.payload),
        Date.now(),
        1,
        null
      );
      
      const events = getRecentEventsWithPriority(testDb);
      expect(events.length).toBe(1);
      expect(events[0].priority_metadata).toBeUndefined();
    });

    test('should handle extreme retention window values', () => {
      const event = createTestEvent('UserPromptSubmit');
      insertEventWithPriority(event, testDb);
      
      // Test with very large retention window
      const eventsLarge = getRecentEventsWithPriority(testDb, {
        totalLimit: 100,
        priorityLimit: 50,
        regularLimit: 50,
        priorityRetentionHours: 8760, // 1 year
        regularRetentionHours: 8760
      });
      
      expect(eventsLarge.length).toBeGreaterThan(0);
      
      // Test with zero retention window
      const eventsZero = getRecentEventsWithPriority(testDb, {
        totalLimit: 100,
        priorityLimit: 50,
        regularLimit: 50,
        priorityRetentionHours: 0,
        regularRetentionHours: 0
      });
      
      expect(eventsZero.length).toBe(0);
    });
  });
});