# WP5: WebSocket Integration Design - Matrix Mode

## Architecture Overview

### Current System Analysis

**Existing WebSocket Infrastructure:**
- `useWebSocket.ts`: Handles basic event/initial message types with 100 event limit
- `useTimelineWebSocket.ts`: Manages agent/message updates with batching and deduplication
- Event types: `subagent_registered`, `subagent_message`, `agent_status_update`
- Performance features: requestAnimationFrame batching, memory management

**Matrix Mode Integration Strategy:**
- **Non-disruptive design**: Matrix mode will subscribe to existing WebSocket without modifying current event flow
- **Event filtering layer**: Create Matrix-specific event processing pipeline
- **Dual subscription model**: Both normal timeline and Matrix mode can receive same events

## WebSocket Integration Interfaces

### Core Matrix WebSocket Types

```typescript
// Matrix-specific event subscription interface
export interface MatrixEventSubscription {
  isActive: boolean;
  eventTypes: Set<string>;
  sessionFilter?: string;
  maxEventHistory: number; // 1000 for performance
  transformOptions: MatrixTransformOptions;
}

// Matrix event processing pipeline
export interface MatrixEventProcessor {
  processInitialEvents(events: HookEvent[]): MatrixDrop[];
  processNewEvent(event: HookEvent): MatrixDrop | null;
  updateEventStatus(event: HookEvent): MatrixDropUpdate | null;
  cleanupOldEvents(maxAge: number): void;
}

// Matrix drop representation (transformed from HookEvent)
export interface MatrixDrop {
  id: string;
  column: number; // 0-based column index (0-119 for 120 columns)
  character: string; // Rendered character (katakana/symbol)
  speed: number; // pixels per frame (1-8)
  brightness: number; // 0.3-1.0
  trail: string[]; // Previous characters in trail (8-15 chars)
  color: MatrixColor; // Green variants or special colors
  age: number; // milliseconds since creation
  eventType: string; // Original hook_event_type
  agentName?: string; // For agent-related events
  sessionId: string;
  metadata: MatrixDropMetadata;
}

export interface MatrixDropMetadata {
  originalEvent: HookEvent;
  spawnTime: number;
  lastUpdate: number;
  isNewEvent: boolean; // For glow effects
  isCompleting: boolean; // For completion effects
  hasError: boolean; // For error highlighting
}

// Matrix color system
export type MatrixColor = 'primary' | 'agent' | 'user' | 'error' | 'complete' | 'new';

export interface MatrixColorPalette {
  primary: string; // Classic green #00ff41
  agent: string; // Blue-green for agent events
  user: string; // Bright green for user prompts
  error: string; // Red tint for errors
  complete: string; // Yellow-green for completions
  new: string; // Bright white for new events
}
```

### Event Filtering and Transformation

```typescript
// Event filtering for Matrix display
export interface MatrixEventFilter {
  includeEventTypes: Set<string>;
  excludeSessionIds?: Set<string>;
  maxAge: number; // Events older than this (ms) are excluded
  priorityEvents: Set<string>; // Events that get special visual treatment
}

// Event-to-Matrix transformation options
export interface MatrixTransformOptions {
  columnCount: number; // 120 columns for 1920px width (16px per column)
  characterSets: MatrixCharacterSets;
  speedMapping: EventSpeedMapping;
  colorMapping: EventColorMapping;
  trailLength: number; // 8-15 characters
}

export interface MatrixCharacterSets {
  katakana: string[]; // Primary character set for agent names
  symbols: string[]; // Special symbols for event types
  alphanumeric: string[]; // Fallback characters
  statusSymbols: string[]; // Status indicators (✓, ⚡, ❌, etc.)
}

export interface EventSpeedMapping {
  new_event: number; // Fastest speed (6-8 pixels/frame)
  agent_spawn: number; // Fast speed (4-6 pixels/frame)
  message: number; // Medium speed (2-4 pixels/frame)
  status_update: number; // Slow speed (1-3 pixels/frame)
  default: number; // Base speed (2 pixels/frame)
}

export interface EventColorMapping {
  user_prompt: MatrixColor;
  agent_spawn: MatrixColor;
  agent_complete: MatrixColor;
  subagent_message: MatrixColor;
  error_event: MatrixColor;
  status_update: MatrixColor;
}
```

## Connection Management Architecture

### Dual-Mode WebSocket Handling

```typescript
// Enhanced WebSocket composable for Matrix mode
export interface UseMatrixWebSocketOptions {
  normalMode: boolean; // Continue normal event handling
  matrixMode: boolean; // Enable Matrix event processing
  sharedConnection: boolean; // Use existing WebSocket connection
  eventHistory: number; // Events to maintain in Matrix buffer
}

// Matrix WebSocket integration composable
export function useMatrixWebSocket(
  wsConnection: WebSocket | null,
  matrixEnabled: Ref<boolean>,
  options: UseMatrixWebSocketOptions = {}
) {
  const matrixEvents = ref<MatrixDrop[]>([]);
  const eventProcessor = ref<MatrixEventProcessor>();
  const subscription = ref<MatrixEventSubscription>();
  
  // Event stream management
  const matrixEventStream = computed(() => 
    matrixEvents.value
      .filter(drop => drop.age < options.eventHistory)
      .sort((a, b) => b.spawnTime - a.spawnTime)
  );
  
  return {
    matrixEvents: readonly(matrixEvents),
    matrixEventStream,
    subscription: readonly(subscription),
    // ... other reactive properties and methods
  };
}
```

### Non-Disruptive Integration Pattern

**Strategy:**
1. **Passive Listening**: Matrix mode subscribes to existing WebSocket without interfering
2. **Event Cloning**: Each WebSocket message is processed by both normal timeline and Matrix mode
3. **Independent State**: Matrix mode maintains separate event buffer and processing queue
4. **Performance Isolation**: Matrix processing runs in separate requestAnimationFrame cycle

```typescript
// Integration pattern implementation
class MatrixWebSocketIntegration {
  private normalHandler: (event: MessageEvent) => void;
  private matrixHandler: (event: MessageEvent) => void;
  
  constructor(
    normalWebSocket: ReturnType<typeof useTimelineWebSocket>,
    matrixWebSocket: ReturnType<typeof useMatrixWebSocket>
  ) {
    // Preserve existing normal handler
    this.normalHandler = normalWebSocket.handleWebSocketMessage;
    
    // Create Matrix-specific handler
    this.matrixHandler = this.createMatrixHandler(matrixWebSocket);
  }
  
  // Combined message handler that routes to both systems
  handleMessage(event: MessageEvent) {
    // Always process normal timeline
    this.normalHandler(event);
    
    // Process for Matrix mode if enabled
    if (this.matrixEnabled.value) {
      this.matrixHandler(event);
    }
  }
}
```

## Event Flow Documentation

### Normal Mode → Matrix Mode Event Pipeline

```
WebSocket Message → JSON Parse → Event Validation
                                      ↓
                            ┌─── Normal Timeline ───┐
                            │   (existing flow)     │
                            └─────────────────────────┘
                                      ↓
                              Matrix Mode Enabled?
                                      ↓ (Yes)
                            ┌─── Matrix Filter ────┐
                            │  - Event type check  │
                            │  - Session filter    │
                            │  - Age validation    │
                            └─────────────────────────┘
                                      ↓
                            ┌─── Event Transform ──┐
                            │  - Agent → Katakana  │
                            │  - Type → Symbol     │
                            │  - Speed calculation │
                            │  - Column assignment │
                            └─────────────────────────┘
                                      ↓
                            ┌─── Matrix Drop ──────┐
                            │  - Add to buffer     │
                            │  - Update canvas     │
                            │  - Trigger animation │
                            └─────────────────────────┘
```

### Event Type Processing

| Hook Event Type | Matrix Character | Speed Multiplier | Color | Trail Length |
|-----------------|------------------|------------------|-------|--------------|
| `user_prompt` | ユ (user katakana) | 1.5x | user | 12 |
| `subagent_registered` | エ (agent katakana) | 1.0x | agent | 10 |
| `agent_status_update` | ス (status katakana) | 0.8x | primary | 8 |
| `subagent_message` | メ (message katakana) | 1.2x | primary | 15 |
| `error` | ❌ (error symbol) | 2.0x | error | 8 |
| `complete` | ✓ (complete symbol) | 1.5x | complete | 12 |

## Performance Optimization Strategy

### Memory Management
- **Event Buffer Limit**: Maximum 1000 MatrixDrop objects in memory
- **Cleanup Strategy**: Remove drops older than 60 seconds
- **Object Pooling**: Reuse MatrixDrop objects to reduce GC pressure

### Rendering Optimization
- **Separate RAF Cycle**: Matrix rendering runs independently from normal timeline
- **Adaptive Quality**: Reduce trail length and effects under high load
- **Canvas Optimization**: Use single canvas with efficient clearing/drawing

### WebSocket Performance
- **Batched Processing**: Group multiple WebSocket messages into single Matrix update
- **Throttled Updates**: Limit Matrix processing to 60fps even with high event volume
- **Priority Queue**: Process critical events (errors, completions) before status updates

```typescript
// Performance configuration
export const MATRIX_PERFORMANCE_CONFIG = {
  maxDrops: 1000,
  maxAge: 60000, // 60 seconds
  targetFPS: 60,
  batchSize: 10, // Events per batch
  throttleMs: 16, // ~60fps
  adaptiveQuality: {
    highLoad: { trailLength: 6, effects: false },
    normalLoad: { trailLength: 12, effects: true },
    lowLoad: { trailLength: 15, effects: true }
  }
} as const;
```

## Integration Testing Strategy

### Unit Tests
- Event filtering logic
- Character transformation accuracy
- Column assignment distribution
- Speed/color mapping correctness

### Integration Tests
- Dual-mode WebSocket handling
- Memory management under load
- Performance metrics validation
- Event processing pipeline end-to-end

### Performance Tests
- 1000+ event stress testing
- Memory leak detection
- Frame rate consistency
- WebSocket message throughput

## Implementation Dependencies

### From JohnState (State Management)
- Matrix mode toggle state
- User preferences (speed, effects)
- Session filter state

### From DaveTransform (Event Transformation)
- HookEvent → MatrixDrop transformation logic
- Character mapping algorithms
- Column distribution functions

### From Team Coordination
- Canvas renderer interfaces (MarkCanvas)
- Character system definitions (SusanVisual)
- Testing frameworks (NancyTest)
- Architecture validation (PaulArch)

## Risk Mitigation

### Performance Risks
- **Memory Leaks**: Implemented cleanup cycles and object pooling
- **Frame Rate Impact**: Separate RAF cycle prevents interference with normal timeline
- **WebSocket Overload**: Throttling and batching prevent overwhelming the UI

### Integration Risks
- **State Conflicts**: Matrix mode uses independent state management
- **Event Loss**: Passive listening ensures no disruption to existing event flow
- **Compatibility**: Non-breaking changes to existing WebSocket handling

This design ensures Matrix mode integrates seamlessly with existing WebSocket infrastructure while maintaining optimal performance and user experience.