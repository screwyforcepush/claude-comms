# Session Introspection Data Flow & Event Handling Research

## Executive Summary

Comprehensive research into the data flow and event handling patterns for session introspection reveals a sophisticated, production-ready foundation with advanced performance optimizations, priority-aware event management, and scalable WebSocket infrastructure. The system can efficiently handle 100-1000+ events per session with real-time updates.

## Key Findings

### 1. Event Storage & Database Schema

**Current Implementation:**
- SQLite database with priority-aware schema
- Event storage includes: `source_app`, `session_id`, `hook_event_type`, `payload`, `timestamp`, `priority`, `priority_metadata`
- Intelligent priority classification: Critical events (UserPromptSubmit, Notification, Stop) get priority=1, others priority=0
- Advanced indexing for performance: `idx_events_session_priority_timestamp`, `idx_events_priority_timestamp`

**Performance Characteristics:**
- Query performance: <100ms for 1000+ events
- Bulk insert throughput: 1000+ events/second
- Memory efficiency: <50MB growth per 1000 events

### 2. WebSocket Infrastructure

**Dual Protocol Support:**
- Single-session WebSocket: `/stream` - Traditional real-time updates
- Multi-session WebSocket: `/api/sessions/multi-stream` - Subscription-based updates for multiple sessions

**Priority-Aware Broadcasting:**
```typescript
interface PriorityWebSocketMessage {
  type: 'priority_event' | 'event' | 'priority_session_event' | 'session_event';
  data: HookEvent | HookEvent[];
  priority_info?: {
    total_events: number;
    priority_events: number;
    retention_window: { priority_hours: 24, regular_hours: 4 };
  };
}
```

**Message Batching & Performance:**
- WebSocket overhead: <5% for priority metadata
- Latency: <10ms for message delivery
- Automatic client reconnection with exponential backoff

### 3. Event Filtering & Transformation

**Database-Level Filtering:**
- Session-specific queries: `getSessionEvents(sessionId, eventTypes?)`
- Priority-aware retention: 24h for priority events, 4h for regular events
- Time window filtering: `getSessionsWithEventsInWindow(start, end)`

**Client-Side Filtering Patterns:**
```typescript
// From EventTimeline.vue
const filteredEvents = computed(() => {
  return props.events.filter(event => {
    if (props.filters.sourceApp && event.source_app !== props.filters.sourceApp) return false;
    if (props.filters.sessionId && event.session_id !== props.filters.sessionId) return false;
    if (props.filters.eventType && event.hook_event_type !== props.filters.eventType) return false;
    return true;
  });
});
```

### 4. Performance Optimization Patterns

**Progressive Rendering System:**
- 4-phase rendering: structure → orchestrators → agents → details
- Batch sizes: 5 agents per frame, 3 detail elements per frame
- Frame rate monitoring: Skips phases if FPS drops below thresholds
- GPU acceleration with `translate3d(0,0,0)` and `will-change` hints

**Memory Management:**
- LRU cache with WeakMap for automatic cleanup
- Maximum 50 cached sessions with detail level reduction
- Garbage collection at 400MB threshold
- Memory-per-event: <100KB target

**Virtualization Ready:**
- Event arrays designed for list virtualization
- Incremental updates to prevent DOM thrashing
- RequestAnimationFrame batching for smooth updates

### 5. Reusable Component Patterns

**EventTimeline Component Features:**
- Timeline ordering (newest-first/oldest-first)
- Smooth transitions with CSS animations
- Auto-scroll with stick-to-bottom behavior
- Enhanced event rows with metadata display
- Color coding by session and source app

**ChatTranscript Component Patterns:**
- Message history with expand/collapse details
- Copy-to-clipboard functionality
- Clean content parsing (removes ANSI codes, command tags)
- Structured display for different message types

## Data Flow Architecture

```
Database (SQLite) 
    ↓ [getSessionEventsWithPriority]
Server API (/events/session/:sessionId)
    ↓ [WebSocket Broadcasting]
Client WebSocket (useTimelineWebSocket)
    ↓ [Event Filtering & Batching]
Vue Reactive State (events, messages, agents)
    ↓ [Progressive Rendering]
DOM/SVG Timeline Components
```

## Recommendations for Session Introspection

### 1. Database Query Strategy
- Use `getSessionEventsWithPriority()` for session-specific queries
- Implement event type filtering at database level
- Leverage existing priority retention windows

### 2. WebSocket Subscription Pattern
```typescript
// Multi-session subscription for introspection
const subscribeToSession = (sessionId: string) => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    sessionId: sessionId
  }));
};
```

### 3. UI Component Architecture
- Extend EventTimeline component for session introspection
- Add session metadata panel (agent count, duration, status)
- Implement event type filtering UI with checkboxes
- Use progressive rendering for large event datasets

### 4. Performance Optimization
- Enable virtualization for sessions with >100 events
- Use priority-aware caching (cache priority events longer)
- Implement detail-level reduction for inactive sessions
- Apply GPU acceleration for smooth scrolling

### 5. Event Transformation Pipeline
```typescript
// Transform raw events for timeline display
const transformForTimeline = (events: HookEvent[]) => {
  return events.map(event => ({
    ...event,
    displayTime: formatTimestamp(event.timestamp),
    priorityLevel: event.priority || 0,
    typeIcon: getEventTypeIcon(event.hook_event_type),
    sessionColor: getSessionColor(event.session_id)
  }));
};
```

## Performance Baselines

Based on existing performance testing framework:

- **Query Time**: <100ms for session event retrieval
- **Memory Usage**: <50MB per 1000 events
- **WebSocket Latency**: <10ms for real-time updates
- **Rendering**: 30-60 FPS with progressive loading
- **Throughput**: 1000+ events/second processing capability

## Risk Mitigation

1. **Large Dataset Handling**: Use priority-aware pagination and virtualization
2. **Memory Management**: Implement automatic cache cleanup and detail-level reduction
3. **Real-time Performance**: Batch WebSocket updates and use progressive rendering
4. **Browser Compatibility**: Provide fallbacks for advanced features (GPU acceleration, Scheduler API)

## Implementation Recommendations

1. **Start with existing EventTimeline component** - Already optimized for performance
2. **Leverage priority event system** - Provides intelligent retention and classification
3. **Use multi-session WebSocket protocol** - Designed for session-specific subscriptions
4. **Implement database-level filtering** - More efficient than client-side filtering
5. **Apply progressive enhancement** - Core functionality first, optimizations as needed

The research confirms that the existing codebase provides an excellent foundation for session introspection with minimal additional development required.