# WP4: Event Transformation API Documentation

## Overview

WP4 delivers the Event Transformation system that converts WebSocket HookEvents into Matrix drop visualizations. This document provides the complete API specification and integration guide for the next implementation batch.

## Core Interfaces

### EventToDropTransformer

The primary interface for event transformation:

```typescript
interface EventToDropTransformer {
  // Core transformation methods
  transform(event: HookEvent): MatrixDrop;
  transformBatch(events: HookEvent[]): MatrixDrop[];
  
  // Configuration management
  updateConfig(config: Partial<TransformerConfig>): void;
  getConfig(): TransformerConfig;
  
  // Column management
  getColumnForSession(sessionId: string, sourceApp: string): number;
  getAvailableColumns(): number[];
  releaseColumn(column: number): void;
}
```

### MatrixDrop Structure

Complete drop specification for canvas rendering:

```typescript
interface MatrixDrop {
  id: string;                    // Unique identifier
  column: number;                // Column index (0-based)
  position: number;              // Y position in pixels
  speed: number;                 // Fall speed (px/second)
  characters: string[];          // Character sequence (head to tail)
  brightness: number[];          // Brightness per character (0-1)
  headColor: string;             // Head character color (hex)
  trailColor: string;            // Trail characters color (hex)
  sourceEvent?: HookEvent;       // Original event data
  createdAt: number;             // Creation timestamp
  type: MatrixDropType;          // Drop classification
  effects?: MatrixDropEffect[];  // Visual effects to apply
  trailLength: number;           // Visible trail length
  isActive: boolean;             // Animation state
}
```

## Integration Points

### WebSocket Integration

The transformer integrates with the existing WebSocket system through useTimelineWebSocket:

```typescript
// In useTimelineWebSocket.ts - extend existing handleEvent
const handleEvent = (message: WebSocketMessage) => {
  if (matrixMode.isEnabled.value) {
    // Route to Matrix transformer
    const drop = transformer.transform(message.data);
    matrixRenderer.addDrop(drop);
  } else {
    // Normal timeline processing
    processTimelineEvent(message);
  }
};
```

### Canvas Renderer Integration

The transformer output feeds directly to the canvas renderer:

```typescript
// Canvas renderer consumes MatrixDrop[]
interface MatrixRenderer {
  addDrop(drop: MatrixDrop): void;
  removeDrop(id: string): void;
  updateDrop(id: string, updates: Partial<MatrixDrop>): void;
  getActiveDroos(): MatrixDrop[];
}
```

## Character Mapping System

### Agent Names → Katakana

```typescript
// Agent name conversion
"SaraPixel" → ['サ', 'ラ', 'ピ'] // First 3 katakana chars
"JohnDoe"   → ['ジ', 'ョ', 'ン'] // Phonetic approximation
```

### Session IDs → Alphanumeric

```typescript
// Session ID styling  
"session-abc123" → ['A', 'B', 'C', '1', '2', '3'] // Last 6 chars
```

### Event Types → Symbols

```typescript
const eventSymbolMap = {
  'start': '◢',
  'complete': '◆',
  'error': '⚠',
  'spawn': '↕',
  'in_progress': '◐',
  'pending': '⧗'
};
```

### Timestamps → Numeric

```typescript
// Timestamp encoding
1642781234567 → ['4', '5', '6', '7'] // Last 4 digits
```

## Column Assignment Algorithm

### Deterministic Assignment

```typescript
// Consistent column assignment for sessions
function assignColumn(sessionId: string, sourceApp: string): number {
  const sessionKey = `${sessionId}-${sourceApp}`;
  const hash = hashString(sessionKey);
  return hash % totalColumns;
}
```

### Column Management

- **Session Consistency**: Same session always gets same column
- **Collision Handling**: Linear probing for occupied columns
- **Load Distribution**: Hash-based assignment distributes load evenly
- **Column Release**: Automatic cleanup when drops complete

## Speed Calculation

### Multi-factor Speed Calculation

```typescript
function calculateDropSpeed(event: HookEvent, dropType: MatrixDropType): number {
  const baseSpeed = 80; // pixels/second
  
  // Event type multiplier
  const typeMultiplier = speedMap[event.hook_event_type] || 1.0;
  
  // Drop type multiplier
  const dropMultiplier = dropTypeMultipliers[dropType] || 1.0;
  
  // Age-based speed (recent events fall faster)
  const ageMultiplier = calculateAgeFactor(event.timestamp);
  
  return baseSpeed * typeMultiplier * dropMultiplier * ageMultiplier;
}
```

### Speed Mapping

- **Error events**: 1.8x base speed (faster, urgent)
- **Spawn events**: 2.0x base speed (dramatic entrance)
- **Completion**: 1.3x base speed (satisfying finish)
- **Normal events**: 1.0x base speed
- **Pending events**: 0.8x base speed (slower, waiting)

## Visual Effects System

### Effect Types

```typescript
type EffectType = 'pulse' | 'glow' | 'flash' | 'pause' | 'accelerate';

interface MatrixDropEffect {
  type: EffectType;
  duration: number;    // milliseconds
  intensity: number;   // 0-1
  startTime: number;   // when effect begins
}
```

### Effect Presets

- **Spawn Effect**: Flash (300ms) + Pulse (800ms)
- **Error Effect**: Glow (1000ms) + Accelerate (500ms)  
- **Completion Effect**: Pause (500ms) + Flash (200ms)
- **Status Change**: Pulse (600ms)

## Configuration Management

### Transformer Configuration

```typescript
interface TransformerConfig {
  canvasWidth: number;           // Canvas dimensions
  canvasHeight: number;
  columnWidth: number;           // Column spacing (20px default)
  totalColumns: number;          // Calculated: width / columnWidth
  maxDrops: number;              // Memory limit (1000 default)
  defaultTrailLength: number;    // Characters per drop (15 default)
  speedMultiplier: number;       // Global speed adjustment (1.0 default)
  characterSets: CharacterSets;  // Available characters
  colorSchemes: ColorSchemes;    // Color palettes
  effectPresets: EffectPresets;  // Effect configurations
}
```

### Runtime Configuration Updates

```typescript
// Update configuration without recreating transformer
transformer.updateConfig({
  speedMultiplier: 1.5,        // Increase global speed
  defaultTrailLength: 20,      // Longer trails
  maxDrops: 1500              // Higher memory limit
});
```

## Error Handling

### Graceful Degradation

```typescript
// Handle malformed events
try {
  const drop = transformer.transform(event);
  renderer.addDrop(drop);
} catch (error) {
  console.warn('Failed to transform event:', error);
  // Continue with other events
}
```

### Memory Management

```typescript
// Automatic drop cleanup
if (activeDroos.length > config.maxDrops) {
  const oldestDrop = findOldestDrop(activeDroos);
  renderer.removeDrop(oldestDrop.id);
  transformer.releaseColumn(oldestDrop.column);
}
```

## Performance Considerations

### Batch Processing

```typescript
// Process multiple events efficiently
const newEvents = getNewEvents();
const drops = transformer.transformBatch(newEvents);
drops.forEach(drop => renderer.addDrop(drop));
```

### Object Pooling Ready

The MatrixDrop interface is designed for object pooling:

```typescript
// Drop objects can be reused
interface DropPool {
  acquire(): MatrixDrop;
  release(drop: MatrixDrop): void;
}
```

### Column Caching

- Session-to-column mapping cached for performance
- Hash calculations cached for repeated sessions
- Column availability tracked efficiently

## Testing API

### Unit Test Support

```typescript
// Create test transformer
const transformer = createEventToDropTransformer(800, 600, 20);

// Mock event for testing
const mockEvent: HookEvent = {
  id: 'test-1',
  session_id: 'test-session',
  source_app: 'test-app',
  hook_event_type: 'test_event',
  payload: { agentName: 'TestAgent' },
  timestamp: Date.now()
};

// Transform and verify
const drop = transformer.transform(mockEvent);
expect(drop.characters.length).toBeGreaterThan(0);
expect(drop.column).toBeGreaterThanOrEqual(0);
```

### Integration Test Support

```typescript
// Test WebSocket integration
const handleTestEvent = (event: HookEvent) => {
  if (matrixMode.isEnabled.value) {
    const drop = transformer.transform(event);
    expect(drop.sourceEvent).toBe(event);
    return drop;
  }
};
```

## Next Batch Implementation

### Required Files

1. **composables/useMatrixMode.ts** - State management composable
2. **components/MatrixModeToggle.vue** - Toggle button component
3. **components/MatrixRainCanvas.vue** - Canvas component wrapper
4. **composables/useMatrixCanvasRenderer.ts** - Canvas rendering logic

### Integration Steps

1. **Import transformer in matrix composable**:
   ```typescript
   import { createEventToDropTransformer } from '../utils/eventToMatrix';
   ```

2. **Initialize transformer with canvas dimensions**:
   ```typescript
   const transformer = createEventToDropTransformer(width, height);
   ```

3. **Connect to WebSocket events**:
   ```typescript
   watch(newEvents, (events) => {
     events.forEach(event => {
       const drop = transformer.transform(event);
       addDropToRenderer(drop);
     });
   });
   ```

4. **Handle configuration updates**:
   ```typescript
   watch(canvasDimensions, ({ width, height }) => {
     transformer.updateConfig({ canvasWidth: width, canvasHeight: height });
   });
   ```

## File References

- **Types**: `src/types/matrix-mode.ts` - Complete interface definitions
- **Implementation**: `src/utils/eventToMatrix.ts` - Full transformer implementation
- **Integration**: `src/composables/useTimelineWebSocket.ts` - WebSocket connection point
- **Testing**: Tests should import from both files above

## Success Criteria

✅ **Interface Design Complete**
- All interfaces defined with comprehensive properties
- Clear separation between transformation and rendering concerns
- Performance-optimized data structures

✅ **Transformation Logic Complete**  
- Event-to-drop mapping implemented
- Character generation system functional
- Column assignment algorithm working
- Speed and effect calculation complete

✅ **Integration Ready**
- Compatible with existing HookEvent interface
- Clean integration points for WebSocket and Canvas
- Configuration management implemented
- Error handling and memory management included

**Ready for Canvas Implementation**: The transformation system is fully specified and implemented, ready for the Canvas renderer to consume MatrixDrop objects and render them as falling Matrix rain.