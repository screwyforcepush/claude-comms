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

## Session Review Agent Integration

### Hook-Based Session Interception Architecture

This section defines the architecture for intercepting `getCurrentSessionId.sh` calls and enabling AI-powered session review through a dedicated review agent.

#### Architectural Decision Records (ADRs)

##### ADR-004: Command Interception via PATH Manipulation

**Decision**: Use PATH manipulation to intercept `getCurrentSessionId.sh` calls
**Rationale**:
- Non-invasive - no modification to Claude Code or original scripts
- Transparent to the calling process
- Easy to enable/disable via environment configuration
- Allows injection of review logic without breaking existing functionality
**Trade-offs**:
- Requires careful PATH management
- Must ensure wrapper script maintains original behavior

##### ADR-005: Event-Driven Review Triggering

**Decision**: Trigger session reviews based on configurable event patterns
**Rationale**:
- Flexible review criteria (time-based, event count, error detection)
- Asynchronous processing doesn't block main workflow
- Supports both automatic and manual review triggers
**Trade-offs**:
- Requires event correlation logic
- May introduce slight delay in review availability

##### ADR-006: Dedicated Review Agent with Specialized Prompts

**Decision**: Create a specialized review agent type with structured analysis prompts
**Rationale**:
- Focused analysis capabilities
- Consistent review output format
- Reusable across different session types
- Integrates with existing agent infrastructure
**Trade-offs**:
- Requires new agent type definition
- Prompt engineering complexity

### Implementation Architecture

#### 1. Command Interception Layer

```bash
# ~/.claude/hooks/wrappers/getCurrentSessionId.sh
#!/bin/bash
# Wrapper script for getCurrentSessionId.sh interception

# Store original session ID retrieval
ORIGINAL_SESSION_ID=$(/usr/bin/env bash -c 'echo $CLAUDE_SESSION_ID')

# Trigger session review if conditions met
python3 $CLAUDE_PROJECT_DIR/.claude/hooks/review/check_review_trigger.py \
  --session-id "$ORIGINAL_SESSION_ID" &

# Return original session ID to maintain compatibility
echo "$ORIGINAL_SESSION_ID"
```

#### 2. Review Trigger Logic

```python
# .claude/hooks/review/check_review_trigger.py
class ReviewTriggerService:
    def should_trigger_review(self, session_id: str) -> bool:
        """
        Determine if session should be reviewed based on:
        - Time since last review
        - Event count threshold
        - Error/warning patterns
        - Manual review request
        """
        session_data = self.fetch_session_metrics(session_id)
        
        triggers = [
            self.check_time_threshold(session_data),
            self.check_event_count(session_data),
            self.check_error_patterns(session_data),
            self.check_manual_flag(session_id)
        ]
        
        return any(triggers)
    
    def trigger_review(self, session_id: str):
        # Queue review request
        review_request = {
            'session_id': session_id,
            'trigger_time': datetime.now(),
            'trigger_reason': self.get_trigger_reason(),
            'priority': self.calculate_priority()
        }
        
        # Send to review queue or spawn review agent
        self.queue_review(review_request)
```

#### 3. Session Data Fetching Architecture

```typescript
// API endpoint for comprehensive session data
interface SessionReviewAPI {
  // Fetch complete session data for review
  GET '/api/sessions/review/:sessionId': {
    response: {
      metadata: SessionMetadata;
      events: HookEvent[];
      agents: SubagentData[];
      messages: AgentMessage[];
      timeline: TimelineSegment[];
      metrics: SessionMetrics;
    };
    cache: '5m';
  };
  
  // Stream session transcript for AI processing
  GET '/api/sessions/review/:sessionId/transcript': {
    query: {
      format: 'json' | 'markdown' | 'structured';
      include_system?: boolean;
      redact_sensitive?: boolean;
    };
    response: SessionTranscript;
  };
  
  // Post review results
  POST '/api/sessions/review/:sessionId/results': {
    body: ReviewResults;
    response: { success: boolean; review_id: string };
  };
}
```

#### 4. Review Agent Architecture

```typescript
// Review agent configuration
interface ReviewAgent {
  type: 'session-reviewer';
  
  capabilities: {
    analyze_patterns: boolean;
    detect_anomalies: boolean;
    generate_insights: boolean;
    score_performance: boolean;
    recommend_improvements: boolean;
  };
  
  prompts: {
    initial_analysis: string;
    deep_dive: string;
    pattern_detection: string;
    recommendation_generation: string;
  };
  
  output_format: {
    summary: string;
    scores: Record<string, number>;
    insights: Insight[];
    recommendations: Recommendation[];
    anomalies: Anomaly[];
  };
}
```

#### 5. Review Prompt Engineering

```typescript
const REVIEW_PROMPTS = {
  initial_analysis: `
You are analyzing a Claude Code session with ID: {session_id}

Session Context:
- Duration: {duration}
- Agent Count: {agent_count}
- Event Count: {event_count}
- Error Count: {error_count}

Your analysis should cover:
1. Overall session effectiveness
2. Agent coordination quality
3. Error handling and recovery
4. Performance bottlenecks
5. Communication patterns

Provide structured output with:
- Executive summary (2-3 sentences)
- Key metrics and scores
- Top 3 insights
- Top 3 recommendations
`,

  pattern_detection: `
Analyze the following session timeline for patterns:

{timeline_data}

Identify:
1. Recurring error patterns
2. Inefficient agent batching
3. Communication bottlenecks
4. Unnecessary retries or loops
5. Optimization opportunities

For each pattern found, provide:
- Pattern description
- Frequency/impact
- Root cause hypothesis
- Recommended solution
`,

  scoring_rubric: `
Score the session on these dimensions (0-100):

1. Task Completion: Did the session achieve its objectives?
2. Efficiency: Was the task completed with minimal steps?
3. Error Handling: Were errors handled gracefully?
4. Agent Coordination: Did agents work well together?
5. Resource Usage: Was the session resource-efficient?

Provide scores with brief justifications.
`
};
```

### Integration Points

#### 1. Hook Configuration Extension

```json
{
  "hooks": {
    "SessionReview": [
      {
        "triggers": {
          "time_interval": "30m",
          "event_count": 100,
          "error_threshold": 5,
          "patterns": ["SubagentStop", "Error"]
        },
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/review/trigger_review.py"
          }
        ]
      }
    ]
  }
}
```

#### 2. Database Schema Extensions for Reviews

```sql
-- Session review results storage
CREATE TABLE IF NOT EXISTS session_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  review_timestamp INTEGER NOT NULL,
  trigger_reason TEXT,
  reviewer_agent TEXT,
  
  -- Scores
  score_completion REAL,
  score_efficiency REAL,
  score_error_handling REAL,
  score_coordination REAL,
  score_resources REAL,
  overall_score REAL,
  
  -- Analysis results
  summary TEXT,
  insights JSON,
  recommendations JSON,
  patterns JSON,
  anomalies JSON,
  
  -- Metadata
  processing_time_ms INTEGER,
  model_used TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  
  FOREIGN KEY (session_id) REFERENCES events(session_id),
  INDEX idx_reviews_session (session_id),
  INDEX idx_reviews_timestamp (review_timestamp)
);

-- Review trigger history
CREATE TABLE IF NOT EXISTS review_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trigger_time INTEGER NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_metadata JSON,
  review_id INTEGER,
  
  FOREIGN KEY (review_id) REFERENCES session_reviews(id),
  INDEX idx_triggers_session (session_id)
);
```

#### 3. UI Components for Review Display

```vue
<!-- SessionReviewPanel.vue -->
<template>
  <div class="session-review-panel">
    <div class="review-header">
      <h3>Session Review: {{ sessionId }}</h3>
      <div class="review-scores">
        <ScoreCard 
          v-for="score in reviewScores"
          :key="score.name"
          :score="score"
        />
      </div>
    </div>
    
    <div class="review-content">
      <TabView>
        <TabPanel header="Summary">
          <ReviewSummary :data="reviewData.summary" />
        </TabPanel>
        
        <TabPanel header="Insights">
          <InsightsList :insights="reviewData.insights" />
        </TabPanel>
        
        <TabPanel header="Recommendations">
          <RecommendationsList 
            :recommendations="reviewData.recommendations" 
          />
        </TabPanel>
        
        <TabPanel header="Patterns">
          <PatternAnalysis :patterns="reviewData.patterns" />
        </TabPanel>
        
        <TabPanel header="Timeline">
          <ReviewTimeline 
            :events="sessionEvents"
            :annotations="reviewData.annotations"
          />
        </TabPanel>
      </TabView>
    </div>
  </div>
</template>
```

### Performance Considerations

1. **Asynchronous Review Processing**
   - Reviews run in background without blocking main workflow
   - Queue-based processing for multiple review requests
   - Configurable concurrency limits

2. **Caching Strategy**
   - Cache review results for 24 hours
   - Incremental review updates for long sessions
   - Compressed storage for large transcripts

3. **Resource Management**
   - Token usage tracking and limits
   - Automatic transcript summarization for large sessions
   - Selective data inclusion based on review type

### Security & Privacy

1. **Data Redaction**
   - Automatic PII detection and redaction
   - Configurable sensitive pattern matching
   - Audit trail for redacted content

2. **Access Control**
   - Review results access based on session ownership
   - Configurable review visibility levels
   - Audit logging for review access

### Testing Strategy

1. **Unit Tests**
   - Command wrapper functionality
   - Trigger logic evaluation
   - Prompt generation
   - Score calculation

2. **Integration Tests**
   - End-to-end review flow
   - API endpoint validation
   - Database operations
   - WebSocket notifications

3. **Performance Tests**
   - Review processing latency
   - Concurrent review handling
   - Large session analysis
   - Memory usage monitoring

## Conclusion

The Session Introspection View architecture, enhanced with the Session Review Agent integration, provides a comprehensive solution for both real-time monitoring and intelligent session analysis. The hook-based interception mechanism enables seamless integration without modifying core Claude Code functionality, while the review agent architecture leverages AI to provide actionable insights and recommendations.

The design prioritizes:
- **Non-invasive integration** through PATH manipulation and hook scripts
- **Scalable analysis** with asynchronous processing and intelligent caching
- **Actionable insights** through structured AI analysis and scoring
- **Privacy preservation** with configurable redaction and access controls
- **Extensibility** for future enhancements and custom review criteria

This modular architecture allows for incremental implementation and positions the system for advanced features like pattern detection, anomaly analysis, cross-session comparisons, and automated optimization recommendations.