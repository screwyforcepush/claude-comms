# Event Indicators Architecture for Timeline

**Author:** RachelArchitect  
**Date:** 2025-08-14  
**Status:** Complete  
**Version:** 1.0

## Executive Summary

This architecture document defines the design for adding UserPromptSubmit and Notification event indicators to the interactive sessions timeline. These indicators will appear on the orchestrator line, providing clickable interaction points that display detailed information in a side panel.

## 1. System Architecture Overview

### 1.1 High-Level Data Flow

```
Events Table (DB) → API Endpoint → Data Composable → Timeline Component → SVG Rendering
       ↓                                    ↓                              ↓
UserPromptSubmit                    Transform & Filter               Event Indicators
  Notification                         Session Events                  Click Handlers
                                                                           ↓
                                                                      Side Panel
```

### 1.2 Component Architecture

```
InteractiveSessionsTimeline.vue
├── SVG Timeline Canvas
│   ├── Orchestrator Line (per session)
│   │   ├── UserPromptSubmit Indicators (clickable dots)
│   │   └── Notification Indicators (alert icons)
│   ├── Agent Paths
│   └── Messages
├── EventDetailPanel.vue (NEW)
│   ├── Prompt Display Section
│   └── Notification Details Section
└── TimelineTooltip.vue (existing)
```

## 2. Data Model Extensions

### 2.1 Event Types in Database

The events table already stores hook events with the following relevant types:
- `UserPromptSubmit` - User submits a prompt to the orchestrator
- `Notification` - Orchestrator needs help or attention

### 2.2 Extended Timeline Data Model

```typescript
// Extend existing TimelineData interface
interface SessionTimelineData {
  // Existing fields...
  orchestratorEvents: OrchestratorEvent[];  // Enhanced
  userPrompts: UserPrompt[];                // Already exists
  notifications: NotificationEvent[];        // NEW
}

interface OrchestratorEvent {
  id: string;
  timestamp: number;
  type: 'start' | 'spawn' | 'wait' | 'complete' | 'error' | 'user_prompt' | 'notification';
  sessionId: string;
  metadata?: {
    promptText?: string;        // For user_prompt type
    notificationLevel?: string;  // For notification type
    agentRequesting?: string;   // Agent that triggered notification
    [key: string]: any;
  };
  eventId?: number;  // Reference to events table
}

interface NotificationEvent {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'help';
  message: string;
  source: string;  // orchestrator or agent name
  sessionId: string;
  eventId: number;
  resolved?: boolean;
}
```

## 3. API Design

### 3.1 Enhanced Events Endpoint

```typescript
// Extend existing endpoint to include event filtering
GET /api/sessions/:sessionId/events
Query Parameters:
  - types?: string[]  // Filter by event types ['UserPromptSubmit', 'Notification']
  - start?: number    // Time window start
  - end?: number      // Time window end

Response:
{
  events: Array<{
    id: number;
    hook_event_type: string;
    timestamp: number;
    payload: any;
    summary?: string;
    chat?: any;
  }>;
  orchestratorEvents: OrchestratorEvent[];
  notifications: NotificationEvent[];
}
```

### 3.2 Batch Events Endpoint for Multiple Sessions

```typescript
POST /api/sessions/events/batch
Body: {
  sessionIds: string[];
  eventTypes: string[];
  timeWindow?: { start: number; end: number; };
}

Response: {
  sessions: Array<{
    sessionId: string;
    events: Array<Event>;
  }>;
}
```

## 4. Component Design

### 4.1 Timeline Component Modifications

```vue
<!-- InteractiveSessionsTimeline.vue modifications -->
<template>
  <div class="sessions-timeline-container">
    <!-- Existing timeline SVG -->
    <svg ref="sessionsSvg">
      <!-- Per session lane -->
      <g v-for="session in visibleSessions" :key="session.sessionId">
        <!-- Orchestrator line with event indicators -->
        <g class="orchestrator-events">
          <!-- UserPromptSubmit indicators -->
          <g v-for="prompt in session.userPrompts" :key="prompt.id">
            <circle 
              :cx="getTimeX(prompt.timestamp)"
              :cy="getSessionOrchestratorY(sessionIndex)"
              r="8"
              fill="#3b82f6"
              stroke="#ffffff"
              stroke-width="2"
              class="user-prompt-indicator cursor-pointer"
              @click="selectPrompt(prompt, session)"
              @mouseenter="showPromptTooltip(prompt, $event)"
              @mouseleave="hideTooltip"
            />
            <!-- Pulse animation for recent prompts -->
            <circle 
              v-if="isRecentPrompt(prompt)"
              :cx="getTimeX(prompt.timestamp)"
              :cy="getSessionOrchestratorY(sessionIndex)"
              r="8"
              fill="#3b82f6"
              opacity="0.3"
              class="animate-ping"
            />
          </g>
          
          <!-- Notification indicators -->
          <g v-for="notification in session.notifications" :key="notification.id">
            <g :transform="`translate(${getTimeX(notification.timestamp)}, ${getSessionOrchestratorY(sessionIndex)})`">
              <!-- Alert icon -->
              <path 
                d="M-6,-8 L6,-8 L0,4 Z"
                :fill="getNotificationColor(notification.level)"
                stroke="#ffffff"
                stroke-width="1.5"
                class="notification-indicator cursor-pointer"
                @click="selectNotification(notification, session)"
                @mouseenter="showNotificationTooltip(notification, $event)"
                @mouseleave="hideTooltip"
              />
              <!-- Exclamation mark -->
              <text 
                x="0" 
                y="-2" 
                text-anchor="middle"
                fill="#ffffff"
                font-size="8"
                font-weight="bold"
              >!</text>
            </g>
          </g>
        </g>
      </g>
    </svg>
    
    <!-- Event Detail Panel (slides in from right) -->
    <EventDetailPanel
      v-if="selectedEvent"
      :event="selectedEvent"
      :session="selectedSession"
      @close="clearEventSelection"
      @navigate-to-time="navigateToTime"
    />
  </div>
</template>
```

### 4.2 Event Detail Panel Component

```vue
<!-- EventDetailPanel.vue (NEW) -->
<template>
  <div class="event-detail-panel" :class="{ 'panel-open': isOpen }">
    <div class="panel-header">
      <h3>{{ eventTitle }}</h3>
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>
    
    <div class="panel-content">
      <!-- For UserPromptSubmit -->
      <div v-if="isPromptEvent" class="prompt-section">
        <div class="timestamp">
          {{ formatTimestamp(event.timestamp) }}
        </div>
        <div class="prompt-text">
          <h4>User Prompt:</h4>
          <pre>{{ promptText }}</pre>
        </div>
        <div class="prompt-metadata">
          <div class="metadata-item">
            <span class="label">Session:</span>
            <span>{{ session.displayName }}</span>
          </div>
          <div class="metadata-item">
            <span class="label">Response Time:</span>
            <span>{{ responseTime }}ms</span>
          </div>
          <div class="metadata-item">
            <span class="label">Spawned Agents:</span>
            <span>{{ spawnedAgentCount }}</span>
          </div>
        </div>
        <div class="related-agents">
          <h4>Agents Spawned:</h4>
          <ul>
            <li v-for="agent in relatedAgents" :key="agent.id">
              {{ agent.name }} ({{ agent.type }})
            </li>
          </ul>
        </div>
      </div>
      
      <!-- For Notification -->
      <div v-if="isNotificationEvent" class="notification-section">
        <div class="timestamp">
          {{ formatTimestamp(event.timestamp) }}
        </div>
        <div class="notification-level" :class="`level-${event.level}`">
          {{ event.level.toUpperCase() }}
        </div>
        <div class="notification-message">
          <h4>Message:</h4>
          <p>{{ event.message }}</p>
        </div>
        <div class="notification-source">
          <span class="label">Source:</span>
          <span>{{ event.source }}</span>
        </div>
        <div v-if="event.resolved" class="resolution-status">
          <span class="resolved-badge">RESOLVED</span>
        </div>
      </div>
    </div>
    
    <div class="panel-actions">
      <button @click="navigateToEvent" class="action-btn primary">
        Go to Event
      </button>
      <button @click="copyEventDetails" class="action-btn">
        Copy Details
      </button>
    </div>
  </div>
</template>

<style scoped>
.event-detail-panel {
  position: fixed;
  right: -400px;
  top: 0;
  width: 400px;
  height: 100vh;
  background: #1a1a1a;
  border-left: 1px solid #3b82f6;
  transition: right 0.3s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.panel-open {
  right: 0;
}

.panel-header {
  padding: 1rem;
  border-bottom: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.prompt-text pre {
  background: #0a0a0a;
  padding: 1rem;
  border-radius: 4px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.notification-level {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: bold;
  margin: 0.5rem 0;
}

.level-info { background: #3b82f6; }
.level-warning { background: #f59e0b; }
.level-error { background: #ef4444; }
.level-help { background: #8b5cf6; }
</style>
```

## 5. Data Transformation Pipeline

### 5.1 Enhanced Data Composable

```typescript
// useMultiSessionData.ts modifications
class MultiSessionDataService {
  async buildSessionTimelineData(
    sessionInfo: any,
    events: HookEvent[],
    agents: any[],
    messages: any[],
    sessionIndex: number
  ): Promise<SessionTimelineData> {
    // Extract UserPromptSubmit and Notification events
    const userPrompts = this.extractUserPrompts(events);
    const notifications = this.extractNotifications(events);
    const orchestratorEvents = this.buildOrchestratorEvents(events, userPrompts, notifications);
    
    return {
      // ... existing fields
      orchestratorEvents,
      userPrompts,
      notifications,
    };
  }
  
  private extractUserPrompts(events: HookEvent[]): UserPrompt[] {
    return events
      .filter(e => e.hook_event_type === 'UserPromptSubmit')
      .map(e => ({
        id: `prompt-${e.id}`,
        timestamp: e.timestamp!,
        content: e.payload?.prompt || e.summary || '',
        sessionId: e.session_id,
        eventId: e.id!,
        responseTime: this.calculateResponseTime(e, events),
        agentCount: this.countSpawnedAgents(e, events)
      }));
  }
  
  private extractNotifications(events: HookEvent[]): NotificationEvent[] {
    return events
      .filter(e => e.hook_event_type === 'Notification')
      .map(e => ({
        id: `notif-${e.id}`,
        timestamp: e.timestamp!,
        level: this.determineNotificationLevel(e.payload),
        message: e.payload?.message || e.summary || '',
        source: e.payload?.source || 'orchestrator',
        sessionId: e.session_id,
        eventId: e.id!,
        resolved: e.payload?.resolved || false
      }));
  }
  
  private buildOrchestratorEvents(
    events: HookEvent[],
    prompts: UserPrompt[],
    notifications: NotificationEvent[]
  ): OrchestratorEvent[] {
    const orchestratorEvents: OrchestratorEvent[] = [];
    
    // Add user prompt events
    prompts.forEach(prompt => {
      orchestratorEvents.push({
        id: `orch-prompt-${prompt.id}`,
        timestamp: prompt.timestamp,
        type: 'user_prompt',
        sessionId: prompt.sessionId,
        metadata: {
          promptText: prompt.content,
          eventId: prompt.eventId
        }
      });
    });
    
    // Add notification events
    notifications.forEach(notif => {
      orchestratorEvents.push({
        id: `orch-notif-${notif.id}`,
        timestamp: notif.timestamp,
        type: 'notification',
        sessionId: notif.sessionId,
        metadata: {
          notificationLevel: notif.level,
          message: notif.message,
          source: notif.source,
          eventId: notif.eventId
        }
      });
    });
    
    // Sort by timestamp
    return orchestratorEvents.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  private calculateResponseTime(promptEvent: HookEvent, allEvents: HookEvent[]): number {
    // Find first agent spawn after this prompt
    const nextSpawn = allEvents.find(e => 
      e.timestamp! > promptEvent.timestamp! &&
      e.hook_event_type === 'SubagentStart'
    );
    
    return nextSpawn ? nextSpawn.timestamp! - promptEvent.timestamp! : 0;
  }
  
  private countSpawnedAgents(promptEvent: HookEvent, allEvents: HookEvent[]): number {
    // Count agents spawned within 10 seconds of prompt
    const timeWindow = 10000; // 10 seconds
    return allEvents.filter(e => 
      e.hook_event_type === 'SubagentStart' &&
      e.timestamp! > promptEvent.timestamp! &&
      e.timestamp! < promptEvent.timestamp! + timeWindow
    ).length;
  }
  
  private determineNotificationLevel(payload: any): 'info' | 'warning' | 'error' | 'help' {
    if (payload?.level) return payload.level;
    if (payload?.severity) {
      switch (payload.severity) {
        case 'high': return 'error';
        case 'medium': return 'warning';
        case 'low': return 'info';
        default: return 'info';
      }
    }
    return 'help'; // Default for orchestrator help requests
  }
}
```

## 6. Interaction Patterns

### 6.1 Click Handling

```typescript
// Event selection and panel management
const selectedEvent = ref<OrchestratorEvent | null>(null);
const selectedSession = ref<SessionData | null>(null);
const eventPanelOpen = ref(false);

const selectPrompt = (prompt: UserPrompt, session: SessionData) => {
  selectedEvent.value = {
    type: 'user_prompt',
    ...prompt
  };
  selectedSession.value = session;
  eventPanelOpen.value = true;
  
  // Emit for parent components
  emit('prompt-selected', prompt, session);
  
  // Log analytics
  trackEvent('timeline_prompt_clicked', {
    sessionId: session.sessionId,
    promptId: prompt.id
  });
};

const selectNotification = (notification: NotificationEvent, session: SessionData) => {
  selectedEvent.value = {
    type: 'notification',
    ...notification
  };
  selectedSession.value = session;
  eventPanelOpen.value = true;
  
  emit('notification-selected', notification, session);
};

const clearEventSelection = () => {
  selectedEvent.value = null;
  eventPanelOpen.value = false;
};

// Navigate timeline to event time
const navigateToTime = (timestamp: number) => {
  const buffer = 30000; // 30 seconds before/after
  const newWindow = {
    start: timestamp - buffer,
    end: timestamp + buffer,
    duration: buffer * 2
  };
  
  setTimeWindow(newWindow);
  
  // Animate pan to center event
  animatePanToTime(timestamp);
};
```

### 6.2 Visual Feedback

```typescript
// Hover effects and tooltips
const showPromptTooltip = (prompt: UserPrompt, event: MouseEvent) => {
  const preview = prompt.content.substring(0, 100) + (prompt.content.length > 100 ? '...' : '');
  
  tooltip.value = {
    visible: true,
    type: 'prompt',
    data: {
      title: 'User Prompt',
      timestamp: formatTimestamp(prompt.timestamp),
      preview,
      agentCount: prompt.agentCount,
      responseTime: `${prompt.responseTime}ms`
    },
    position: { x: event.clientX, y: event.clientY }
  };
};

const showNotificationTooltip = (notification: NotificationEvent, event: MouseEvent) => {
  tooltip.value = {
    visible: true,
    type: 'notification',
    data: {
      title: 'Orchestrator Notification',
      level: notification.level,
      message: notification.message,
      source: notification.source,
      timestamp: formatTimestamp(notification.timestamp)
    },
    position: { x: event.clientX, y: event.clientY }
  };
};
```

## 7. Performance Optimizations

### 7.1 Event Caching Strategy

```typescript
class EventCache {
  private cache = new Map<string, CachedEvents>();
  private maxCacheSize = 100; // Max sessions to cache
  private ttl = 60000; // 1 minute TTL
  
  async getSessionEvents(sessionId: string): Promise<SessionEvents> {
    const cached = this.cache.get(sessionId);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }
    
    // Fetch fresh data
    const events = await this.fetchEvents(sessionId);
    this.cache.set(sessionId, {
      data: events,
      timestamp: Date.now()
    });
    
    // Evict old entries if cache is too large
    if (this.cache.size > this.maxCacheSize) {
      this.evictOldest();
    }
    
    return events;
  }
  
  invalidateSession(sessionId: string) {
    this.cache.delete(sessionId);
  }
}
```

### 7.2 Rendering Optimization

```typescript
// Only render visible events
const visibleEvents = computed(() => {
  const { start, end } = timeRange.value;
  
  return {
    prompts: session.userPrompts.filter(p => 
      p.timestamp >= start && p.timestamp <= end
    ),
    notifications: session.notifications.filter(n => 
      n.timestamp >= start && n.timestamp <= end
    )
  };
});

// Throttle rendering for high-frequency updates
const renderEventIndicators = throttle(() => {
  requestAnimationFrame(() => {
    updateEventPositions();
    renderIndicators();
  });
}, 16); // 60fps max
```

## 8. Real-time Updates

### 8.1 WebSocket Event Handling

```typescript
// Handle real-time event updates
const handleWebSocketMessage = (message: any) => {
  if (message.type === 'event') {
    const event = message.data;
    
    if (event.hook_event_type === 'UserPromptSubmit') {
      addPromptIndicator(event);
    } else if (event.hook_event_type === 'Notification') {
      addNotificationIndicator(event);
    }
    
    // Invalidate cache for affected session
    eventCache.invalidateSession(event.session_id);
  }
};

const addPromptIndicator = (event: HookEvent) => {
  const sessionIndex = visibleSessions.value.findIndex(
    s => s.sessionId === event.session_id
  );
  
  if (sessionIndex >= 0) {
    const prompt = transformToUserPrompt(event);
    visibleSessions.value[sessionIndex].userPrompts.push(prompt);
    
    // Animate new indicator
    animateNewIndicator(prompt.id, 'prompt');
  }
};
```

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
describe('Event Indicators', () => {
  it('should extract UserPromptSubmit events correctly', () => {
    const events = [
      { hook_event_type: 'UserPromptSubmit', timestamp: 1000, payload: { prompt: 'Test' } },
      { hook_event_type: 'Other', timestamp: 2000 }
    ];
    
    const prompts = extractUserPrompts(events);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].content).toBe('Test');
  });
  
  it('should handle click on prompt indicator', async () => {
    const { wrapper } = renderTimeline();
    const promptIndicator = wrapper.find('.user-prompt-indicator');
    
    await promptIndicator.trigger('click');
    
    expect(wrapper.emitted('prompt-selected')).toBeTruthy();
    expect(wrapper.find('.event-detail-panel').exists()).toBe(true);
  });
});
```

## 10. Migration Path

### Phase 1: Data Layer (Day 1)
- [ ] Extend database queries to fetch UserPromptSubmit and Notification events
- [ ] Add event extraction methods to data service
- [ ] Create event cache implementation

### Phase 2: API Integration (Day 1)
- [ ] Create batch events endpoint
- [ ] Update session data fetching to include events
- [ ] Add WebSocket handlers for real-time events

### Phase 3: Component Implementation (Day 2)
- [ ] Add event indicators to timeline SVG
- [ ] Create EventDetailPanel component
- [ ] Implement click handlers and selection state

### Phase 4: Interaction & Polish (Day 2)
- [ ] Add tooltips for event indicators
- [ ] Implement panel animations
- [ ] Add keyboard navigation support
- [ ] Create visual feedback for recent events

### Phase 5: Testing & Documentation (Day 1)
- [ ] Write unit tests
- [ ] Create integration tests
- [ ] Update user documentation
- [ ] Performance testing with many events

## 11. Success Metrics

- **Performance**: Maintain 60fps with 100+ event indicators per session
- **Responsiveness**: Click-to-panel < 100ms
- **Memory**: < 10MB additional memory for event data
- **Accuracy**: 100% event capture and display
- **Usability**: 50% reduction in time to find user prompts

## Conclusion

This architecture leverages the existing timeline infrastructure while adding focused enhancements for event indicators. The design maintains performance through caching and selective rendering while providing rich interaction through the detail panel. The implementation is achievable within 5 days with parallel work on data and UI layers.