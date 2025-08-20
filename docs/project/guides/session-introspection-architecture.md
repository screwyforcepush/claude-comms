# Session Introspection View - Architectural Blueprint

**Version:** 1.0  
**Author:** MarcusHex (System Architect)  
**Date:** 2025-08-20  
**Status:** Ready for Implementation  

## Executive Summary

This document defines the architecture for adding a Session Introspection View feature to the Multi-Agent Observability System. The feature enables comprehensive historical analysis of completed Claude Code sessions with focus on agent orchestration patterns, communication flows, and performance insights.

## Architecture Decision Records (ADRs)

### ADR-001: Event Sourcing for Session Reconstruction

**Decision**: Use event sourcing pattern leveraging existing event stream
**Rationale**: 
- Complete session history already captured in events table
- Enables accurate replay and analysis without additional storage
- Supports future features like session comparison and pattern detection
**Trade-offs**: 
- Higher query complexity for reconstruction
- Mitigated by caching and materialized views

### ADR-002: Lazy Loading with Progressive Enhancement

**Decision**: Implement lazy loading for timeline data with progressive detail loading
**Rationale**:
- Sessions can contain thousands of events
- Initial load shows overview, details loaded on demand
- Optimizes perceived performance
**Trade-offs**:
- More complex state management
- Multiple API calls required

### ADR-003: Separate Introspection API Namespace

**Decision**: Create dedicated `/api/sessions/introspect/*` endpoints
**Rationale**:
- Clear separation from real-time monitoring APIs
- Enables different caching and rate limiting strategies
- Supports specialized query patterns
**Trade-offs**:
- Some code duplication with existing endpoints
- Justified by different access patterns and optimizations

## Implementation Architecture

### Database Schema Extensions

```sql
-- Add indexes for introspection queries
CREATE INDEX IF NOT EXISTS idx_events_session_type_timestamp 
  ON events(session_id, hook_event_type, timestamp);
  
CREATE INDEX IF NOT EXISTS idx_agents_session_batch 
  ON subagent_registry(session_id, created_at, status);

-- Materialized view for session summaries (future optimization)
CREATE VIEW IF NOT EXISTS session_summaries AS
SELECT 
  session_id,
  MIN(timestamp) as start_time,
  MAX(timestamp) as end_time,
  COUNT(DISTINCT CASE WHEN hook_event_type = 'SubagentStart' THEN payload END) as agent_count,
  COUNT(*) as event_count,
  AVG(CASE WHEN hook_event_type = 'SubagentComplete' THEN 
    json_extract(payload, '$.duration') END) as avg_agent_duration
FROM events
GROUP BY session_id;
```

### API Endpoints Specification

```typescript
// Core Introspection Endpoints
interface IntrospectionAPI {
  // Get session overview with metadata and statistics
  GET '/api/sessions/introspect/:sessionId': {
    response: SessionIntrospectionOverview;
    cache: '5m';
  };
  
  // Get detailed timeline data with resolution control
  GET '/api/sessions/introspect/:sessionId/timeline': {
    query: {
      start?: number;      // Unix timestamp
      end?: number;        // Unix timestamp  
      resolution?: 'high' | 'medium' | 'low';
      includeMessages?: boolean;
    };
    response: TimelineData[];
    cache: '2m';
  };
  
  // Get specific agent details including prompt/response
  GET '/api/sessions/introspect/:sessionId/agents/:agentName': {
    response: AgentIntrospectionData;
    cache: '10m';
  };
  
  // Stream events for replay functionality
  GET '/api/sessions/introspect/:sessionId/replay': {
    query: {
      speed?: '1x' | '2x' | '5x' | '10x';
      from?: number;       // Start timestamp
    };
    response: EventSource;  // Server-Sent Events
  };
  
  // Get session analysis and recommendations
  GET '/api/sessions/introspect/:sessionId/analysis': {
    response: SessionAnalysis;
    cache: '10m';
  };
}
```

### Frontend Component Architecture

```vue
<!-- Main Component Structure -->
SessionIntrospectView/
├── SessionIntrospectView.vue         // Main container
├── components/
│   ├── SessionNavigator.vue          // Session browser/selector
│   ├── ViewModeSelector.vue          // Timeline/Graph/Replay/Analysis tabs
│   ├── SessionTimelineView.vue       // Interactive timeline visualization
│   ├── SessionGraphView.vue          // Node-link agent relationship graph
│   ├── SessionReplayView.vue         // Step-by-step replay player
│   ├── SessionAnalysisView.vue       // Metrics and insights dashboard
│   └── panels/
│       ├── AgentDetailPanel.vue      // Agent deep-dive panel
│       ├── MessageDetailPanel.vue    // Message inspection panel
│       └── EventDetailPanel.vue      // Event details panel
└── composables/
    ├── useSessionIntrospection.ts    // Main data management
    ├── useSessionReplay.ts           // Replay control logic
    └── useSessionAnalysis.ts         // Analysis computations
```

### Data Flow Patterns

```typescript
// Composable for Session Introspection
export function useSessionIntrospection(sessionId: string) {
  const sessionData = ref<SessionIntrospectionData>();
  const timelineData = ref<TimelineEvent[]>([]);
  const isLoading = ref(false);
  const error = ref<string>();
  
  // Progressive data loading
  const loadSessionOverview = async () => {
    isLoading.value = true;
    try {
      const response = await fetch(`/api/sessions/introspect/${sessionId}`);
      sessionData.value = await response.json();
    } catch (e) {
      error.value = e.message;
    } finally {
      isLoading.value = false;
    }
  };
  
  // Lazy load timeline segments
  const loadTimelineSegment = async (start: number, end: number) => {
    const params = new URLSearchParams({
      start: start.toString(),
      end: end.toString(),
      resolution: calculateResolution(end - start)
    });
    
    const response = await fetch(
      `/api/sessions/introspect/${sessionId}/timeline?${params}`
    );
    const segment = await response.json();
    mergeTimelineData(segment);
  };
  
  // Virtual scrolling support
  const visibleTimelineWindow = computed(() => {
    // Calculate visible portion based on scroll position
    return filterTimelineByViewport(timelineData.value);
  });
  
  return {
    sessionData,
    timelineData,
    visibleTimelineWindow,
    loadSessionOverview,
    loadTimelineSegment,
    isLoading,
    error
  };
}
```

## Integration Points

### 1. SubagentComms.vue Integration

Add new tab/button to switch to introspection mode:

```vue
<template>
  <div class="subagent-comms">
    <!-- Existing view selector -->
    <div class="view-selector">
      <button @click="activeView = 'timeline'">Live Timeline</button>
      <button @click="activeView = 'list'">List View</button>
      <button @click="activeView = 'introspect'" class="new-feature">
        📊 Session Introspection
      </button>
    </div>
    
    <!-- View components -->
    <component :is="activeViewComponent" />
  </div>
</template>
```

### 2. Database Access Patterns

```typescript
// Optimized queries for introspection
class SessionIntrospectionService {
  // Get session with all related data in single transaction
  async getFullSession(sessionId: string) {
    return db.transaction(() => {
      const events = db.prepare(`
        SELECT * FROM events 
        WHERE session_id = ? 
        ORDER BY timestamp ASC
      `).all(sessionId);
      
      const agents = db.prepare(`
        SELECT * FROM subagent_registry
        WHERE session_id = ?
        ORDER BY created_at ASC
      `).all(sessionId);
      
      const messages = db.prepare(`
        SELECT m.* FROM subagent_messages m
        JOIN subagent_registry a ON m.sender = a.name
        WHERE a.session_id = ?
        ORDER BY m.created_at ASC
      `).all(sessionId);
      
      return { events, agents, messages };
    });
  }
}
```

### 3. WebSocket Enhancements

```typescript
// Add introspection mode to WebSocket protocol
interface IntrospectionWebSocketMessage {
  action: 'subscribe_introspection' | 'unsubscribe_introspection';
  sessionId: string;
  mode?: 'replay' | 'analyze';
  options?: {
    speed?: number;
    startFrom?: number;
  };
}
```

## Performance Considerations

### Caching Strategy

1. **API Response Caching**: 
   - Session overviews: 5 minutes
   - Timeline segments: 2 minutes
   - Agent details: 10 minutes
   - Analysis results: 10 minutes

2. **Frontend Caching**:
   - IndexedDB for large timeline data
   - Memory cache for active session
   - LRU eviction for multiple sessions

3. **Database Optimization**:
   - Composite indexes on (session_id, timestamp)
   - Partitioned tables for old sessions (future)
   - Query result caching in Bun server

### Scalability Targets

- Handle sessions with up to 10,000 events
- Support 100 concurrent introspection users
- Initial load time < 2 seconds
- Timeline navigation latency < 100ms

## Security & Privacy

### Access Control
```typescript
// Middleware for introspection endpoints
app.use('/api/sessions/introspect/*', async (req, res, next) => {
  // Verify user has permission to view sessions
  const hasAccess = await checkSessionAccess(req.user, req.params.sessionId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});
```

### Data Redaction
```typescript
// Redact sensitive information in prompts/responses
function redactSensitiveData(text: string): string {
  // Redact API keys, passwords, PII
  return text
    .replace(/api[_-]?key[\s]*[:=][\s]*["']?[\w-]+["']?/gi, 'api_key=REDACTED')
    .replace(/password[\s]*[:=][\s]*["']?[^"'\s]+["']?/gi, 'password=REDACTED')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, 'email@REDACTED');
}
```

## Testing Strategy

### Unit Tests
- Query builders and data transformers
- Timeline data aggregation logic
- Cache invalidation logic

### Integration Tests
- API endpoint response validation
- Database query performance
- WebSocket message handling

### E2E Tests
- Full session introspection flow
- Timeline interaction and navigation
- Replay functionality

### Performance Tests
- Load testing with large sessions
- Concurrent user simulation
- Memory usage monitoring

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- Database indexes and queries
- Basic API endpoints
- Session overview component

### Phase 2: Timeline Visualization (Week 2)
- Interactive timeline component
- Progressive data loading
- Agent detail panels

### Phase 3: Advanced Features (Week 3)
- Session replay functionality
- Analysis and insights
- Performance optimizations

### Phase 4: Polish & Testing (Week 4)
- UI/UX refinements
- Comprehensive testing
- Documentation

## Success Metrics

1. **Performance**:
   - Initial load time < 2s for 95% of sessions
   - Timeline scroll lag < 16ms (60 FPS)
   - API response time < 200ms p95

2. **Usability**:
   - User can find specific events within 30s
   - Session replay accuracy 100%
   - Zero data loss in visualization

3. **Adoption**:
   - 80% of users access introspection weekly
   - Average session analysis time > 5 minutes
   - Positive feedback score > 4.5/5

## Conclusion

The Session Introspection View architecture leverages existing infrastructure while introducing targeted enhancements for historical analysis. The design prioritizes performance through lazy loading and caching, ensures data privacy through redaction, and provides rich visualization options for comprehensive session understanding.

The modular architecture allows for incremental implementation and future extensibility, positioning the system for advanced features like pattern detection, anomaly analysis, and cross-session comparisons.