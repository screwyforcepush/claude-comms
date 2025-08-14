# Event Data Structure Research Analysis

## Executive Summary

Research on UserPromptSubmit and Notification event data structures reveals well-defined payload patterns with consistent session correlation mechanisms. The system uses JSON-based event storage with timestamp alignment supporting real-time multi-agent timeline visualization. Integration points are clearly identified for adding event indicators to the orchestrator timeline.

## Event Payload Structure Analysis

### UserPromptSubmit Events

**Structure:**
```typescript
{
  session_id: string;           // Session correlation key
  hook_event_name: "UserPromptSubmit";
  prompt: string;              // User input content
  timestamp: number;           // Unix timestamp (milliseconds)
}
```

**Database Storage:**
- Stored in `events` table with JSON payload serialization
- Fields: `source_app`, `session_id`, `hook_event_type`, `payload`, `timestamp`
- Indexed by `session_id`, `hook_event_type`, and `timestamp` for efficient querying

**Key Characteristics:**
- Represents user interaction initiation points
- Contains full prompt text for context
- Aligned with session lifecycle events
- High correlation value for timeline reconstruction

### Notification Events

**Structure:**
```typescript
{
  session_id: string;           // Session correlation key
  hook_event_name: "Notification";
  message: string;             // System notification content
  timestamp: number;           // Unix timestamp (milliseconds)
}
```

**Database Storage:**
- Same `events` table structure as UserPromptSubmit
- JSON payload contains notification message
- Potentially includes severity levels in extended implementations

**Key Characteristics:**
- System status updates and user-facing notifications
- Provides context for session state changes
- Can indicate waiting states, completions, or errors
- Essential for understanding session flow interruptions

## Session Correlation Mechanisms

### Primary Correlation Key
- **session_id**: Universal identifier linking all events within a session
- Consistent across all event types (UserPromptSubmit, Notification, tool usage, agent lifecycle)
- Enables complete session timeline reconstruction

### Timestamp Alignment
- All events use Unix millisecond timestamps
- Database indexed for efficient temporal queries
- Supports real-time event ordering and timeline visualization
- Consistent with agent registry `created_at` and `completed_at` fields

### Agent Association
- Events can be correlated with active agents via timestamp overlap
- Agent registry tracks session lifecycle: `created_at` to `completed_at`
- Enables mapping events to specific agent activities

## Data Transformation Requirements

### Current System Integration
The system has well-established transformation patterns:

1. **Database to Timeline Transformation**
   - Events retrieved with `getRecentEvents()` function
   - JSON payloads parsed and typed
   - Timestamp conversion for timeline scaling

2. **Existing UserPrompt Integration**
   - Timeline types already include `UserPrompt` interface
   - Transformation from events to timeline objects in `useTimelineData.ts`
   - Rendering support in `useTimelineRenderer.ts`

3. **Required Additions for Event Indicators**
   ```typescript
   // New event indicator types needed
   interface EventIndicator {
     eventId: string;
     eventType: 'UserPromptSubmit' | 'Notification';
     timestamp: number;
     sessionId: string;
     content: string;
     position: Point2D;
     metadata?: {
       severity?: 'info' | 'warning' | 'error';
       source?: string;
       category?: string;
     };
   }
   
   interface OrchestratorEvent {
     // Extend existing type to include event indicators
     eventIndicators?: EventIndicator[];
   }
   ```

## Type Definitions for Event Indicators

### Proposed Type Extensions

```typescript
// Event indicator specific types
export interface EventIndicatorData {
  indicators: EventIndicator[];
  filteredBy: {
    eventTypes: string[];
    sessionIds: string[];
    timeRange?: { start: number; end: number };
  };
}

export interface EventIndicatorConfig {
  showUserPrompts: boolean;
  showNotifications: boolean;
  showOnOrchestratorLine: boolean;
  enableClickableIndicators: boolean;
  maxIndicatorsPerSession: number;
  indicatorStyles: {
    userPrompt: {
      color: string;
      size: number;
      icon: string; // '💬'
    };
    notification: {
      color: string;
      size: number;
      icon: string; // '🔔'
    };
  };
}

// Click handler types
export interface EventIndicatorClickHandler {
  onIndicatorClick: (indicator: EventIndicator, event: MouseEvent) => void;
  onIndicatorHover: (indicator: EventIndicator | null, event: MouseEvent) => void;
}
```

### Integration with Existing Timeline Types

The system already has robust timeline type definitions. Event indicators should integrate as:

1. **Extension of TimelineData**
   ```typescript
   export interface TimelineData {
     // ... existing properties
     eventIndicators?: EventIndicator[];
   }
   ```

2. **Integration with OrchestratorEvent**
   ```typescript
   export interface OrchestratorEvent {
     // ... existing properties  
     associatedEventIndicators?: EventIndicator[];
   }
   ```

## Integration Points

### Database Layer Integration
- **File**: `/apps/server/src/db.ts`
- **Function**: `getRecentEvents()` already retrieves UserPromptSubmit and Notification events
- **No changes required**: Event filtering by type already supported

### Data Transformation Layer
- **File**: `/apps/client/src/composables/useTimelineData.ts`
- **Location**: Line 274-295 (`timelineUserPrompts` computed)
- **Enhancement**: Extend to include event indicators transformation

### Rendering Layer
- **File**: `/apps/client/src/composables/useTimelineRenderer.ts`
- **Location**: Line 224 (`renderUserPrompts` function)
- **Enhancement**: Add `renderEventIndicators` function for orchestrator line

### Session Data Adapter
- **File**: `/apps/client/src/utils/session-data-adapter.ts`
- **Enhancement**: Add event indicator transformation methods

## Implementation Recommendations

### Phase 1: Basic Event Indicators
1. Add event indicator types to timeline type definitions
2. Create transformation functions in `useTimelineData.ts`
3. Add rendering support for orchestrator line indicators
4. Implement basic click handlers for side panel display

### Phase 2: Enhanced Functionality
1. Add filtering and configuration options
2. Implement hover tooltips with event details
3. Add indicator clustering for high-density sessions
4. Integrate with existing emoji system (`useEventEmojis.ts`)

### Phase 3: Advanced Features
1. Add event indicator search and filtering
2. Implement indicator-based session navigation
3. Add indicator analytics and patterns
4. Support custom event indicator types

## Technical Considerations

### Performance Optimization
- Event indicators should be virtualized for sessions with many events
- Consider indicator density thresholds to prevent UI overcrowding
- Implement efficient event-to-position mapping algorithms

### User Experience
- Clear visual distinction between UserPromptSubmit and Notification indicators
- Consistent interaction patterns with existing timeline elements
- Responsive design for different screen sizes and zoom levels

### Data Consistency
- Ensure event timestamps align with agent timeline timestamps
- Handle edge cases where events occur outside agent active periods
- Validate session_id consistency across events and agents

## Conclusion

The event data structure research reveals a robust foundation for integrating UserPromptSubmit and Notification event indicators into the timeline visualization. The existing architecture provides clear integration points and consistent patterns for implementation. The proposed type definitions and transformation requirements support both basic functionality and future enhancements while maintaining system performance and user experience standards.