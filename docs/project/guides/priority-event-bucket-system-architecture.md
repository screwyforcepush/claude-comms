# Priority Event Bucket System - Complete Architecture Design

## Executive Summary

This document provides the complete system architecture for implementing priority event buckets that maintain critical events (UserPromptSubmit, Notification, Stop) longer than regular events. The design implements a dual-bucket retention system with intelligent overlap handling, building upon SaraMatrix's comprehensive analysis.

**Key Architectural Decisions:**
1. Database-level priority classification with backward-compatible migration
2. Intelligent server-side bucket algorithm returning mixed priority/regular events
3. Client-side dual-bucket management with configurable retention policies
4. Enhanced WebSocket protocol with priority metadata for real-time classification
5. Performance-optimized indexing strategy for priority-based queries

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Priority Event Bucket System                │
├─────────────────────┬─────────────────────┬─────────────────────┤
│   Database Layer    │   Server Layer      │   Client Layer      │
│                     │                     │                     │
│ ┌─────────────────┐ │ ┌─────────────────┐ │ ┌─────────────────┐ │
│ │ events          │ │ │ Priority Event  │ │ │ Dual-Bucket     │ │
│ │ +priority (new) │ │ │ Fetching        │ │ │ Management      │ │
│ │ +indexes        │ │ │ Algorithm       │ │ │                 │ │
│ └─────────────────┘ │ └─────────────────┘ │ └─────────────────┘ │
│                     │                     │                     │
│ ┌─────────────────┐ │ ┌─────────────────┐ │ ┌─────────────────┐ │
│ │ Priority-Based  │ │ │ WebSocket       │ │ │ Priority Event  │ │
│ │ Indexing        │ │ │ Enhancement     │ │ │ Rendering       │ │
│ └─────────────────┘ │ └─────────────────┘ │ └─────────────────┘ │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

## 1. Database Schema Design

### 1.1 Schema Modifications

```sql
-- Add priority field to existing events table
ALTER TABLE events ADD COLUMN priority INTEGER DEFAULT 0;

-- Priority levels:
-- 0: Regular events (default)
-- 1: High priority (UserPromptSubmit, Notification, Stop, SubagentStop)
-- 2: Critical priority (reserved for future use)
-- 3: System priority (reserved for future use)

-- Create priority-optimized indexes
CREATE INDEX IF NOT EXISTS idx_events_priority_timestamp 
  ON events(priority DESC, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_session_priority_timestamp 
  ON events(session_id, priority DESC, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_type_priority 
  ON events(hook_event_type, priority DESC, timestamp DESC);

-- Add metadata field for future extensibility
ALTER TABLE events ADD COLUMN priority_metadata TEXT;
```

### 1.2 Priority Classification Logic

```typescript
// Priority mapping configuration
export const PRIORITY_EVENT_TYPES = {
  'UserPromptSubmit': 1,
  'Notification': 1,
  'Stop': 1,
  'SubagentStop': 1,
  'SubagentComplete': 1  // Added based on system analysis
} as const;

export function calculateEventPriority(eventType: string, payload?: any): number {
  // Base priority from event type
  const basePriority = PRIORITY_EVENT_TYPES[eventType as keyof typeof PRIORITY_EVENT_TYPES] || 0;
  
  // Future: Add payload-based priority modifiers
  // if (payload?.urgency === 'critical') return Math.max(basePriority, 2);
  
  return basePriority;
}
```

### 1.3 Enhanced Event Storage

```typescript
// Enhanced insertEvent function with priority calculation
export function insertEvent(event: HookEvent): HookEvent {
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
```

## 2. Server-Side Priority Event Algorithm

### 2.1 Intelligent Bucket Retrieval

```typescript
export interface PriorityEventConfig {
  totalLimit: number;
  priorityLimit: number;
  regularLimit: number;
  priorityRetentionHours: number;
  regularRetentionHours: number;
}

export function getRecentEventsWithPriority(
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
```

### 2.2 Session-Specific Priority Queries

```typescript
export function getSessionEventsWithPriority(
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
```

## 3. WebSocket Protocol Enhancements

### 3.1 Enhanced Message Format

```typescript
// Enhanced WebSocket message with priority metadata
export interface PriorityWebSocketMessage extends WebSocketMessage {
  type: 'initial' | 'event' | 'priority_event';
  data: HookEvent | HookEvent[];
  priority_info?: {
    total_events: number;
    priority_events: number;
    regular_events: number;
    retention_window: {
      priority_hours: number;
      regular_hours: number;
    };
  };
}

// Server-side broadcasting enhancement
function broadcastEventWithPriority(savedEvent: HookEvent) {
  const message: PriorityWebSocketMessage = {
    type: savedEvent.priority > 0 ? 'priority_event' : 'event',
    data: savedEvent,
    priority_info: savedEvent.priority > 0 ? {
      retention_hint: 'extended',
      classification: 'automatic',
      bucket: 'priority'
    } : {
      retention_hint: 'standard', 
      classification: 'automatic',
      bucket: 'regular'
    }
  };
  
  const messageStr = JSON.stringify(message);
  
  // Broadcast to single-session clients
  wsClients.forEach(client => {
    try {
      client.send(messageStr);
    } catch (err) {
      wsClients.delete(client);
    }
  });
  
  // Broadcast to multi-session clients
  const multiSessionMessage = {
    ...message,
    sessionId: savedEvent.session_id
  };
  
  multiSessionClients.forEach((subscribedSessions, client) => {
    if (subscribedSessions.has(savedEvent.session_id)) {
      try {
        client.send(JSON.stringify(multiSessionMessage));
      } catch (err) {
        multiSessionClients.delete(client);
      }
    }
  });
}
```

### 3.2 Initial Connection Enhancement

```typescript
// Enhanced initial connection with priority-aware data
websocket: {
  open(ws: any) {
    const isMultiSession = (ws.data as any)?.type === 'multi-session';
    
    if (!isMultiSession) {
      // Send priority-aware initial events
      const config = {
        totalLimit: parseInt(process.env.EVENT_INITIAL_LIMIT || '100'),
        priorityLimit: parseInt(process.env.EVENT_PRIORITY_INITIAL_LIMIT || '75'),
        regularLimit: parseInt(process.env.EVENT_REGULAR_INITIAL_LIMIT || '25'),
        priorityRetentionHours: 24,
        regularRetentionHours: 4
      };
      
      const events = getRecentEventsWithPriority(config);
      
      const initialMessage: PriorityWebSocketMessage = {
        type: 'initial',
        data: events,
        priority_info: {
          total_events: events.length,
          priority_events: events.filter(e => (e as any).priority > 0).length,
          regular_events: events.filter(e => (e as any).priority === 0).length,
          retention_window: {
            priority_hours: config.priorityRetentionHours,
            regular_hours: config.regularRetentionHours
          }
        }
      };
      
      ws.send(JSON.stringify(initialMessage));
    }
  }
}
```

## 4. Client-Side Dual-Bucket Implementation

### 4.1 Enhanced Type Definitions

```typescript
// Enhanced HookEvent interface
export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
  priority?: number;
  priority_metadata?: {
    classified_at: number;
    classification_reason: string;
    retention_policy: string;
  };
}

// Priority bucket configuration
export interface PriorityBucketConfig {
  maxPriorityEvents: number;
  maxRegularEvents: number;
  totalDisplayLimit: number;
  priorityOverflowStrategy: 'remove_oldest_regular' | 'remove_oldest_priority' | 'strict_limits';
  enablePriorityIndicators: boolean;
}
```

### 4.2 Dual-Bucket WebSocket Composable

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { HookEvent, PriorityWebSocketMessage, PriorityBucketConfig } from '../types';

export function usePriorityWebSocket(url: string, config?: Partial<PriorityBucketConfig>) {
  const priorityEvents = ref<HookEvent[]>([]);
  const regularEvents = ref<HookEvent[]>([]);
  const isConnected = ref(false);
  const error = ref<string | null>(null);
  
  let ws: WebSocket | null = null;
  let reconnectTimeout: number | null = null;
  
  // Configuration with defaults
  const bucketConfig: PriorityBucketConfig = {
    maxPriorityEvents: parseInt(import.meta.env.VITE_MAX_PRIORITY_EVENTS || '200'),
    maxRegularEvents: parseInt(import.meta.env.VITE_MAX_REGULAR_EVENTS || '100'),
    totalDisplayLimit: parseInt(import.meta.env.VITE_TOTAL_EVENT_DISPLAY_LIMIT || '250'),
    priorityOverflowStrategy: 'remove_oldest_regular',
    enablePriorityIndicators: true,
    ...config
  };
  
  // Combined events for display (computed)
  const allEvents = computed(() => {
    const combined = [...priorityEvents.value, ...regularEvents.value]
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Apply total display limit
    if (combined.length > bucketConfig.totalDisplayLimit) {
      return intelligentDisplayLimiting(combined, bucketConfig);
    }
    
    return combined;
  });
  
  // Priority statistics
  const eventStats = computed(() => ({
    total: allEvents.value.length,
    priority: priorityEvents.value.length,
    regular: regularEvents.value.length,
    priorityPercentage: allEvents.value.length > 0 
      ? (priorityEvents.value.length / allEvents.value.length) * 100 
      : 0
  }));
  
  function intelligentDisplayLimiting(events: HookEvent[], config: PriorityBucketConfig): HookEvent[] {
    const priorityEvts = events.filter(e => (e.priority || 0) > 0);
    const regularEvts = events.filter(e => (e.priority || 0) === 0);
    
    switch (config.priorityOverflowStrategy) {
      case 'remove_oldest_regular':
        // Always preserve priority events, remove oldest regular
        const maxRegularInDisplay = Math.max(0, config.totalDisplayLimit - priorityEvts.length);
        return [
          ...priorityEvts,
          ...regularEvts.slice(-maxRegularInDisplay)
        ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
      case 'remove_oldest_priority':
        // Remove oldest priority events if needed
        return events.slice(-config.totalDisplayLimit);
        
      case 'strict_limits':
        // Respect individual bucket limits strictly
        const limitedPriority = priorityEvts.slice(-config.maxPriorityEvents);
        const limitedRegular = regularEvts.slice(-config.maxRegularEvents);
        return [...limitedPriority, ...limitedRegular]
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          .slice(-config.totalDisplayLimit);
          
      default:
        return events.slice(-config.totalDisplayLimit);
    }
  }
  
  function addToPriorityBucket(event: HookEvent) {
    priorityEvents.value.push(event);
    
    if (priorityEvents.value.length > bucketConfig.maxPriorityEvents) {
      // Remove oldest priority events when limit exceeded
      const overflow = priorityEvents.value.length - bucketConfig.maxPriorityEvents;
      priorityEvents.value = priorityEvents.value.slice(overflow);
    }
  }
  
  function addToRegularBucket(event: HookEvent) {
    regularEvents.value.push(event);
    
    if (regularEvents.value.length > bucketConfig.maxRegularEvents) {
      // More aggressive cleanup for regular events
      const keepCount = Math.max(
        bucketConfig.maxRegularEvents - 20, // Remove batch of 20
        bucketConfig.maxRegularEvents * 0.8  // Keep 80%
      );
      regularEvents.value = regularEvents.value.slice(-keepCount);
    }
  }
  
  function handleNewEvent(event: HookEvent) {
    const priority = event.priority || 0;
    
    if (priority > 0) {
      addToPriorityBucket(event);
    } else {
      addToRegularBucket(event);
    }
  }
  
  function handleInitialEvents(events: HookEvent[]) {
    // Separate initial events by priority
    const priorityEvts = events.filter(e => (e.priority || 0) > 0);
    const regularEvts = events.filter(e => (e.priority || 0) === 0);
    
    // Load into respective buckets with limits
    priorityEvents.value = priorityEvts.slice(-bucketConfig.maxPriorityEvents);
    regularEvents.value = regularEvts.slice(-bucketConfig.maxRegularEvents);
  }
  
  const connect = () => {
    try {
      ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('Priority WebSocket connected');
        isConnected.value = true;
        error.value = null;
      };
      
      ws.onmessage = (event) => {
        try {
          const message: PriorityWebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'initial') {
            const initialEvents = Array.isArray(message.data) ? message.data : [];
            handleInitialEvents(initialEvents);
            
            // Log priority statistics
            if (message.priority_info) {
              console.log('Priority bucket stats:', message.priority_info);
            }
          } else if (message.type === 'event' || message.type === 'priority_event') {
            const newEvent = message.data as HookEvent;
            handleNewEvent(newEvent);
          }
        } catch (err) {
          console.error('Failed to parse priority WebSocket message:', err);
        }
      };
      
      ws.onerror = (err) => {
        console.error('Priority WebSocket error:', err);
        error.value = 'WebSocket connection error';
      };
      
      ws.onclose = () => {
        console.log('Priority WebSocket disconnected');
        isConnected.value = false;
        
        // Attempt to reconnect
        reconnectTimeout = window.setTimeout(() => {
          console.log('Attempting to reconnect priority WebSocket...');
          connect();
        }, 3000);
      };
    } catch (err) {
      console.error('Failed to connect priority WebSocket:', err);
      error.value = 'Failed to connect to server';
    }
  };
  
  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (ws) {
      ws.close();
      ws = null;
    }
  };
  
  // Bucket management utilities
  const clearBuckets = () => {
    priorityEvents.value = [];
    regularEvents.value = [];
  };
  
  const getPriorityEvents = () => priorityEvents.value.slice();
  const getRegularEvents = () => regularEvents.value.slice();
  
  const isPriorityEvent = (event: HookEvent) => (event.priority || 0) > 0;
  
  onMounted(() => {
    connect();
  });
  
  onUnmounted(() => {
    disconnect();
  });
  
  return {
    // Event arrays
    allEvents,
    priorityEvents: computed(() => priorityEvents.value),
    regularEvents: computed(() => regularEvents.value),
    
    // Statistics
    eventStats,
    
    // Connection state
    isConnected,
    error,
    
    // Utilities
    clearBuckets,
    getPriorityEvents,
    getRegularEvents,
    isPriorityEvent,
    
    // Configuration
    bucketConfig: readonly(bucketConfig)
  };
}
```

## 5. Performance and Indexing Strategy

### 5.1 Database Indexes

```sql
-- Primary priority-based index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_events_priority_timestamp 
  ON events(priority DESC, timestamp DESC);

-- Session-specific priority queries
CREATE INDEX IF NOT EXISTS idx_events_session_priority_timestamp 
  ON events(session_id, priority DESC, timestamp DESC);

-- Event type priority analysis
CREATE INDEX IF NOT EXISTS idx_events_type_priority_timestamp
  ON events(hook_event_type, priority DESC, timestamp DESC);

-- Cleanup operations (for maintenance jobs)
CREATE INDEX IF NOT EXISTS idx_events_timestamp_priority
  ON events(timestamp ASC, priority ASC);

-- Composite index for complex filtering
CREATE INDEX IF NOT EXISTS idx_events_session_type_priority
  ON events(session_id, hook_event_type, priority DESC, timestamp DESC);
```

### 5.2 Query Performance Optimization

```typescript
// Prepared statement caching for frequent queries
class PriorityEventCache {
  private static preparedStatements = new Map<string, any>();
  
  static getPreparedStatement(key: string, sql: string, db: Database) {
    if (!this.preparedStatements.has(key)) {
      this.preparedStatements.set(key, db.prepare(sql));
    }
    return this.preparedStatements.get(key);
  }
  
  static getRecentPriorityEvents(db: Database, limit: number, cutoff: number) {
    const stmt = this.getPreparedStatement(
      'recent_priority_events',
      `SELECT * FROM events WHERE priority > 0 AND timestamp >= ? 
       ORDER BY timestamp DESC LIMIT ?`,
      db
    );
    return stmt.all(cutoff, limit);
  }
  
  static getRecentRegularEvents(db: Database, limit: number, cutoff: number) {
    const stmt = this.getPreparedStatement(
      'recent_regular_events', 
      `SELECT * FROM events WHERE priority = 0 AND timestamp >= ? 
       ORDER BY timestamp DESC LIMIT ?`,
      db
    );
    return stmt.all(cutoff, limit);
  }
}
```

### 5.3 Memory Management Strategy

```typescript
// Client-side memory optimization
export class PriorityEventMemoryManager {
  private readonly config: PriorityBucketConfig;
  private lastCleanup: number = 0;
  private readonly cleanupInterval: number = 60000; // 1 minute
  
  constructor(config: PriorityBucketConfig) {
    this.config = config;
  }
  
  shouldPerformCleanup(): boolean {
    return Date.now() - this.lastCleanup > this.cleanupInterval;
  }
  
  optimizeBuckets(priorityEvents: HookEvent[], regularEvents: HookEvent[]): {
    priority: HookEvent[];
    regular: HookEvent[];
  } {
    if (!this.shouldPerformCleanup()) {
      return { priority: priorityEvents, regular: regularEvents };
    }
    
    const now = Date.now();
    const priorityRetention = 24 * 60 * 60 * 1000; // 24 hours
    const regularRetention = 4 * 60 * 60 * 1000;   // 4 hours
    
    // Remove old events based on retention policy
    const freshPriority = priorityEvents.filter(
      e => now - (e.timestamp || 0) < priorityRetention
    );
    
    const freshRegular = regularEvents.filter(
      e => now - (e.timestamp || 0) < regularRetention
    );
    
    this.lastCleanup = now;
    
    return {
      priority: freshPriority.slice(-this.config.maxPriorityEvents),
      regular: freshRegular.slice(-this.config.maxRegularEvents)
    };
  }
}
```

## 6. Configuration and Environment Variables

### 6.1 Server Configuration

```bash
# Priority event retention settings (hours)
EVENT_PRIORITY_RETENTION_HOURS=24
EVENT_REGULAR_RETENTION_HOURS=4

# Initial connection limits
EVENT_PRIORITY_INITIAL_LIMIT=100
EVENT_REGULAR_INITIAL_LIMIT=50
EVENT_TOTAL_INITIAL_LIMIT=150

# Performance tuning
PRIORITY_QUERY_CACHE_SIZE=100
PRIORITY_INDEX_MAINTENANCE_INTERVAL=3600000

# Priority event types (comma-separated)
PRIORITY_EVENT_TYPES=UserPromptSubmit,Notification,Stop,SubagentStop,SubagentComplete
```

### 6.2 Client Configuration

```bash
# Client-side bucket limits
VITE_MAX_PRIORITY_EVENTS=200
VITE_MAX_REGULAR_EVENTS=100
VITE_TOTAL_EVENT_DISPLAY_LIMIT=250

# Priority UI settings
VITE_ENABLE_PRIORITY_INDICATORS=true
VITE_PRIORITY_OVERFLOW_STRATEGY=remove_oldest_regular
VITE_PRIORITY_UI_THEME=enhanced

# Performance settings
VITE_EVENT_CLEANUP_INTERVAL=60000
VITE_PRIORITY_MEMORY_LIMIT=50MB
```

## 7. Migration Strategy

### 7.1 Phase 1: Database Schema Migration

```typescript
export async function migrateToPrioritySchema(db: Database): Promise<void> {
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
      
      const result = updateStmt.run(metadata, eventType);
      console.log(`Updated ${result.changes} ${eventType} events to priority 1`);
    }
    
    console.log('Creating priority-based indexes...');
    // Create all priority indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_priority_timestamp ON events(priority DESC, timestamp DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_session_priority_timestamp ON events(session_id, priority DESC, timestamp DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_type_priority_timestamp ON events(hook_event_type, priority DESC, timestamp DESC)');
    
    console.log('Priority schema migration completed successfully');
  } else {
    console.log('Priority column already exists, skipping migration');
  }
}
```

### 7.2 Phase 2: Server-Side Implementation

```typescript
// Backward-compatible implementation
export function getRecentEventsWithFallback(limit: number = 100): HookEvent[] {
  // Check if priority column exists
  try {
    return getRecentEventsWithPriority({
      totalLimit: limit,
      priorityLimit: Math.floor(limit * 0.7),
      regularLimit: Math.floor(limit * 0.3),
      priorityRetentionHours: 24,
      regularRetentionHours: 4
    });
  } catch (error) {
    // Fallback to original implementation if priority columns don't exist
    console.warn('Priority columns not found, falling back to original implementation');
    return getRecentEvents(limit);
  }
}
```

### 7.3 Phase 3: Client-Side Progressive Enhancement

```typescript
// Progressive enhancement for client
export function createWebSocketComposable(url: string, config?: any) {
  // Try priority WebSocket first
  try {
    return usePriorityWebSocket(url, config);
  } catch (error) {
    console.warn('Priority WebSocket not available, falling back to standard WebSocket');
    return useWebSocket(url);
  }
}
```

## 8. Quality Gates and Validation

### 8.1 Database Validation

```typescript
export function validatePriorityImplementation(db: Database): ValidationResult {
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
  
  if (priorityStats.priority_events === 0) {
    issues.push('No priority events found - classification may not be working');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    stats: priorityStats
  };
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
  stats: any;
}
```

### 8.2 Performance Validation

```typescript
export function validatePriorityPerformance(db: Database): PerformanceResult {
  const results: any = {};
  
  // Test priority query performance
  const startTime = Date.now();
  const events = getRecentEventsWithPriority({
    totalLimit: 100,
    priorityLimit: 70,
    regularLimit: 30,
    priorityRetentionHours: 24,
    regularRetentionHours: 4
  });
  const queryTime = Date.now() - startTime;
  
  results.queryTime = queryTime;
  results.eventCount = events.length;
  results.priorityCount = events.filter(e => (e as any).priority > 0).length;
  
  // Performance criteria
  const maxAcceptableQueryTime = 100; // 100ms
  const performanceIssues: string[] = [];
  
  if (queryTime > maxAcceptableQueryTime) {
    performanceIssues.push(`Query time ${queryTime}ms exceeds ${maxAcceptableQueryTime}ms limit`);
  }
  
  return {
    performant: performanceIssues.length === 0,
    issues: performanceIssues,
    metrics: results
  };
}

interface PerformanceResult {
  performant: boolean;
  issues: string[];
  metrics: any;
}
```

## 9. Monitoring and Observability

### 9.1 Priority Event Metrics

```typescript
export interface PriorityEventMetrics {
  totalEvents: number;
  priorityEvents: number;
  regularEvents: number;
  priorityPercentage: number;
  avgQueryTime: number;
  bucketDistribution: {
    priority: number;
    regular: number;
  };
  retentionEffectiveness: {
    priorityRetained: number;
    regularRetained: number;
  };
}

export function collectPriorityMetrics(db: Database): PriorityEventMetrics {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const fourHoursAgo = now - (4 * 60 * 60 * 1000);
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_events,
      COUNT(CASE WHEN priority > 0 THEN 1 END) as priority_events,
      COUNT(CASE WHEN priority = 0 THEN 1 END) as regular_events,
      COUNT(CASE WHEN priority > 0 AND timestamp >= ? THEN 1 END) as priority_retained,
      COUNT(CASE WHEN priority = 0 AND timestamp >= ? THEN 1 END) as regular_retained
    FROM events
  `).get(oneDayAgo, fourHoursAgo) as any;
  
  return {
    totalEvents: stats.total_events,
    priorityEvents: stats.priority_events,
    regularEvents: stats.regular_events,
    priorityPercentage: (stats.priority_events / stats.total_events) * 100,
    avgQueryTime: 0, // Updated by performance monitoring
    bucketDistribution: {
      priority: stats.priority_events,
      regular: stats.regular_events
    },
    retentionEffectiveness: {
      priorityRetained: stats.priority_retained,
      regularRetained: stats.regular_retained
    }
  };
}
```

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
describe('Priority Event System', () => {
  describe('Event Classification', () => {
    test('should classify UserPromptSubmit as priority 1', () => {
      const priority = calculateEventPriority('UserPromptSubmit');
      expect(priority).toBe(1);
    });
    
    test('should classify regular events as priority 0', () => {
      const priority = calculateEventPriority('RegularEvent');
      expect(priority).toBe(0);
    });
  });
  
  describe('Bucket Management', () => {
    test('should limit priority events correctly', () => {
      const config = { maxPriorityEvents: 5, maxRegularEvents: 3, totalDisplayLimit: 10 };
      // Test bucket limiting logic
    });
    
    test('should preserve priority events when total limit exceeded', () => {
      // Test priority preservation logic
    });
  });
});
```

### 10.2 Integration Tests

```typescript
describe('Priority Event Integration', () => {
  test('should store and retrieve events with priority', async () => {
    const event = createTestEvent('UserPromptSubmit');
    const saved = insertEvent(event);
    expect(saved.priority).toBe(1);
    
    const retrieved = getRecentEventsWithPriority({ totalLimit: 10 });
    expect(retrieved.find(e => e.id === saved.id)?.priority).toBe(1);
  });
  
  test('should apply retention policies correctly', async () => {
    // Test retention window logic
  });
});
```

## 11. Integration Architecture Summary

This architecture provides a comprehensive solution for priority event buckets with:

1. **Backward-compatible database schema** with intelligent migration
2. **Performance-optimized server-side algorithm** for mixed event retrieval  
3. **Sophisticated client-side bucket management** with configurable strategies
4. **Enhanced WebSocket protocol** with priority metadata
5. **Comprehensive monitoring and validation** capabilities

### Integration Guidance Created (Phase 11)

**EthanArch Integration Analysis:**
- **Component Coordination**: Created integration patterns for database-server-client coordination
- **Progressive Enhancement**: Designed client strategy for Batch 2 with graceful fallbacks
- **Validation Framework**: Established comprehensive testing and validation criteria
- **Backward Compatibility**: Ensured existing systems continue functioning during rollout

**Key Integration Documents:**
- `docs/project/phases/11-PriorityEventBuckets/integration-patterns.md`
- `docs/project/phases/11-PriorityEventBuckets/client-integration-strategy.md`  
- `docs/project/phases/11-PriorityEventBuckets/integration-validation-criteria.md`

### Implementation Roadmap

**Batch 1 (Server-Side)**: Database schema migration and server-side changes
**Batch 2 (Client-Side)**: Client-side dual-bucket implementation using progressive enhancement
**Integration Validation**: Continuous validation throughout with defined gates and criteria

The system is designed to be incrementally deployable with fallback mechanisms ensuring zero-downtime deployment and backward compatibility. All integration patterns maintain existing functionality while adding priority bucket capabilities.