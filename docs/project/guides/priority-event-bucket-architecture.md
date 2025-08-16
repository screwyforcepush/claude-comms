# Priority Event Bucket System - Technical Architecture Analysis

## Executive Summary

This document provides a comprehensive analysis of the current event handling architecture and proposes a priority event bucket system that maintains important events (UserPromptSubmit, Notification, Stop) longer than regular events through separate capacity buckets with intelligent overlap handling.

**Key Recommendations:**
1. Implement dual-bucket system in database layer with unified client interface
2. Extend existing WebSocket architecture with priority event streaming
3. Leverage current client-side event management patterns for seamless integration
4. Use database-side priority queuing with configurable retention policies

## Current Event Handling Architecture Analysis

### 1. Event Storage Layer (`apps/server/src/db.ts`)

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  hook_event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  chat TEXT,
  summary TEXT,
  timestamp INTEGER NOT NULL
)
```

**Current Limitations:**
- Single table design with no priority differentiation
- Fixed retention via `LIMIT` clauses in queries
- No built-in event aging/cleanup mechanisms
- Priority events treated identically to regular events

**Storage Operations:**
- `insertEvent()`: Direct insertion with JSON payload serialization
- `getRecentEvents(limit)`: Simple timestamp DESC ordering with limit
- `getSessionEvents()`: Session-specific filtering with optional event type filters
- No priority-based retrieval mechanisms

### 2. WebSocket Event Streaming (`apps/server/src/index.ts`)

**Current WebSocket Flow:**
```
Event Received → Database Insert → Broadcast to All Clients
                                ↓
                     Single-Session: /stream 
                     Multi-Session: /api/sessions/multi-stream
```

**Broadcasting Logic:**
- Immediate broadcast to all connected WebSocket clients
- Separate channels for single-session and multi-session clients
- Session-based subscription filtering for multi-session clients
- No priority-based broadcasting logic

**Configuration:**
- `EVENT_INITIAL_LIMIT`: Default 50 events on connection (configurable via env)
- Recent events sent on WebSocket connection establishment

### 3. Client-Side Event Management

#### Single-Session Client (`apps/client/src/composables/useWebSocket.ts`)

**Event Retention Logic:**
```javascript
const maxEvents = parseInt(import.meta.env.VITE_MAX_EVENTS_TO_DISPLAY || '100');

// Initial load
events.value = initialEvents.slice(-maxEvents);

// New event handling with overflow management
events.value.push(newEvent);
if (events.value.length > maxEvents) {
  events.value = events.value.slice(events.value.length - maxEvents + 10);
}
```

**Key Characteristics:**
- FIFO event management with configurable limits
- Batch removal (10 events) when limit exceeded
- Environment variable configuration (`VITE_MAX_EVENTS_TO_DISPLAY`)
- No priority-aware retention logic

#### Multi-Session Client (`apps/client/src/composables/useMultiSessionData.ts`)

**Advanced Features:**
- Sophisticated caching with TTL (30s sessions, 60s details, 15s time windows)
- WebSocket subscription management for specific sessions
- Real-time update throttling (100ms for same session)
- Intelligent session data transformation and merging

**Event Processing:**
- Session-based event categorization
- Orchestrator events vs user prompts separation
- Agent batch inference from timing patterns
- Message filtering and transformation

### 4. Priority Event Types Analysis

**High-Priority Event Types Identified:**
- `UserPromptSubmit`: User input to Claude Code - Critical for session understanding
- `Notification`: User interactions and system alerts - Important for UX monitoring  
- `Stop`/`SubagentStop`: Agent completion signals - Essential for orchestration tracking

**Usage Patterns:**
- UserPromptSubmit events appear in session-specific timelines
- Notification events trigger UI indicators (orange triangles)
- Stop events mark agent lifecycle completion
- All three types have specialized UI rendering and interaction patterns

## Priority Event Bucket Implementation Recommendations

### 1. Database Layer Extensions

#### Schema Evolution Strategy
```sql
-- Add priority field to existing events table
ALTER TABLE events ADD COLUMN priority INTEGER DEFAULT 0;

-- Create priority-based indexes
CREATE INDEX IF NOT EXISTS idx_events_priority_timestamp ON events(priority DESC, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_session_priority ON events(session_id, priority DESC, timestamp DESC);

-- Priority levels
-- 0: Regular events
-- 1: Important events (UserPromptSubmit, Notification, Stop)
-- 2: Critical events (future extensibility)
```

#### Priority-Aware Storage Functions
```javascript
// Enhanced insertEvent with automatic priority detection
export function insertEvent(event: HookEvent): HookEvent {
  const priority = calculateEventPriority(event.hook_event_type);
  // ... existing logic with priority field
}

function calculateEventPriority(eventType: string): number {
  const priorityMap = {
    'UserPromptSubmit': 1,
    'Notification': 1, 
    'Stop': 1,
    'SubagentStop': 1
  };
  return priorityMap[eventType] || 0;
}
```

#### Bucket-Based Retrieval Functions
```javascript
// Dual-bucket retrieval with intelligent merging
export function getRecentEventsWithPriority(
  totalLimit: number = 100,
  priorityLimit: number = 50,
  regularLimit: number = 50
): HookEvent[] {
  // Get priority events (longer retention)
  const priorityEvents = getPriorityEvents(priorityLimit);
  
  // Get regular events (shorter retention) 
  const regularEvents = getRegularEvents(regularLimit);
  
  // Merge and sort by timestamp, respecting total limit
  return mergeAndLimitEvents(priorityEvents, regularEvents, totalLimit);
}
```

### 2. WebSocket Broadcasting Enhancements

#### Priority-Aware Broadcasting
```javascript
// Enhanced WebSocket message with priority metadata
const message = JSON.stringify({ 
  type: 'event', 
  data: savedEvent,
  priority: savedEvent.priority,
  retention_hint: savedEvent.priority > 0 ? 'high' : 'normal'
});
```

#### Configurable Event Streaming
- Separate priority and regular event streams for high-throughput scenarios
- Client-side subscription to priority-only updates
- Backwards-compatible with existing WebSocket clients

### 3. Client-Side Priority Integration

#### Enhanced useWebSocket Composable
```javascript
// Priority-aware event management
const priorityEvents = ref<HookEvent[]>([]);
const regularEvents = ref<HookEvent[]>([]);

const maxPriorityEvents = parseInt(import.meta.env.VITE_MAX_PRIORITY_EVENTS || '200');
const maxRegularEvents = parseInt(import.meta.env.VITE_MAX_REGULAR_EVENTS || '100');

// Smart event allocation based on priority
function handleNewEvent(event: HookEvent) {
  if (event.priority > 0) {
    addToPriorityBucket(event);
  } else {
    addToRegularBucket(event);
  }
  
  // Update combined view
  updateCombinedEventView();
}
```

#### Bucket Management Strategy
```javascript
// Intelligent bucket overflow handling
function addToPriorityBucket(event: HookEvent) {
  priorityEvents.value.push(event);
  
  if (priorityEvents.value.length > maxPriorityEvents) {
    // Remove oldest regular events if total limit exceeded
    const overflow = priorityEvents.value.length - maxPriorityEvents;
    priorityEvents.value = priorityEvents.value.slice(overflow);
  }
}

function addToRegularBucket(event: HookEvent) {
  regularEvents.value.push(event);
  
  if (regularEvents.value.length > maxRegularEvents) {
    // Aggressive cleanup for regular events
    regularEvents.value = regularEvents.value.slice(-maxRegularEvents + 20);
  }
}
```

### 4. Configuration and Environment Variables

#### Server Configuration (`apps/server/.env`)
```bash
# Priority event retention settings
EVENT_PRIORITY_RETENTION_HOURS=24    # Keep priority events for 24 hours
EVENT_REGULAR_RETENTION_HOURS=4      # Keep regular events for 4 hours
EVENT_PRIORITY_INITIAL_LIMIT=100     # Priority events on connection
EVENT_REGULAR_INITIAL_LIMIT=50       # Regular events on connection
```

#### Client Configuration (`apps/client/.env`)
```bash
# Client-side bucket limits
VITE_MAX_PRIORITY_EVENTS=200         # Priority event display limit
VITE_MAX_REGULAR_EVENTS=100          # Regular event display limit
VITE_TOTAL_EVENT_DISPLAY_LIMIT=250   # Combined display limit
```

## Implementation Extension Points

### 1. Database Layer Extensions
**Files to Modify:**
- `apps/server/src/db.ts`: Add priority-aware functions
- `apps/server/src/types.ts`: Extend HookEvent interface with priority field

**Extension Points:**
- `insertEvent()`: Add priority calculation
- `getRecentEvents()`: Replace with priority-aware retrieval
- `getSessionEvents()`: Add priority filtering options
- Database migration for existing events

### 2. WebSocket Layer Extensions  
**Files to Modify:**
- `apps/server/src/index.ts`: Enhance broadcasting logic

**Extension Points:**
- Event broadcasting: Add priority metadata
- Initial connection: Send priority-aware event batches
- Multi-session subscriptions: Priority-based filtering

### 3. Client Layer Extensions
**Files to Modify:**
- `apps/client/src/composables/useWebSocket.ts`: Priority bucket management
- `apps/client/src/composables/useMultiSessionData.ts`: Priority event categorization
- `apps/client/src/types/index.ts`: Add priority to HookEvent interface

**Extension Points:**
- Event reception: Priority-based bucketing
- Event display: Priority-aware rendering
- Event retention: Bucket-specific limits
- Real-time updates: Priority event highlighting

### 4. UI Integration Points
**Files to Enhance:**
- `apps/client/src/components/InteractiveSessionsTimeline.vue`: Priority event indicators
- `apps/client/src/components/EventDetailPanel.vue`: Priority metadata display
- `apps/client/src/components/PromptDetailPanel.vue`: Enhanced priority event details

## Performance and Scalability Considerations

### Database Performance
- Priority indexing enables efficient priority-based queries
- Separate retention policies prevent priority event loss
- Background cleanup jobs for expired regular events

### Memory Management
- Bucket-based limits prevent unbounded growth
- Intelligent overflow handling maintains user experience
- Configurable limits adapt to different deployment scenarios

### WebSocket Efficiency
- Priority metadata adds minimal overhead
- Backwards-compatible with existing clients
- Optional priority-only subscriptions for high-throughput scenarios

## Migration Strategy

### Phase 1: Database Schema Extension
1. Add priority column with default values
2. Create priority-based indexes
3. Update event insertion to calculate priorities
4. Maintain backwards compatibility

### Phase 2: Server-Side Priority Logic
1. Implement priority-aware retrieval functions
2. Update WebSocket broadcasting with priority metadata  
3. Add configuration for priority retention policies
4. Test with existing client connections

### Phase 3: Client-Side Priority Handling
1. Update event interfaces with priority field
2. Implement dual-bucket management in useWebSocket
3. Enhance multi-session data handling for priorities
4. Add priority-based UI indicators

### Phase 4: Advanced Features
1. Priority-based event filtering in UI
2. Custom priority rules and user preferences
3. Priority event analytics and insights
4. Performance monitoring and optimization

## Risk Assessment and Mitigations

**Risk: Database Performance Impact**
- Mitigation: Proper indexing and retention policies
- Monitoring: Query performance tracking

**Risk: Client Memory Usage Increase**  
- Mitigation: Configurable bucket limits and intelligent overflow
- Monitoring: Client-side memory usage metrics

**Risk: WebSocket Message Volume**
- Mitigation: Optional priority-only subscriptions
- Monitoring: WebSocket throughput and latency metrics

**Risk: Breaking Changes to Existing Clients**
- Mitigation: Backwards-compatible priority field (optional)
- Monitoring: Client connection success rates

## Conclusion

The priority event bucket system can be seamlessly integrated into the existing event handling architecture through incremental enhancements to the database, WebSocket, and client layers. The dual-bucket approach with intelligent overflow handling ensures that critical events (UserPromptSubmit, Notification, Stop) are retained longer while maintaining system performance and backwards compatibility.

The implementation leverages existing patterns and extension points, minimizing architectural disruption while providing significant value for event analysis and system observability.