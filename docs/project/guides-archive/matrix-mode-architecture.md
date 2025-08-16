# Matrix Mode Technical Architecture

## Executive Summary

This document outlines the technical architecture for integrating a Matrix-style digital rain visualization mode into the existing EventTimeline component. The design prioritizes performance, visual impact, and minimal disruption to existing functionality.

## Rendering Approach Decision

### Selected: Canvas 2D with WebGL Fallback

After analyzing the requirements and existing architecture:

1. **Primary Renderer: Canvas 2D**
   - Optimal for our event count (typically <1000 simultaneous events)
   - Easier integration with Vue.js components
   - Lower implementation complexity
   - Sufficient performance for 60fps with proper optimizations

2. **Fallback: WebGL** (for high-load scenarios)
   - Activate when event count exceeds 5000
   - Use instanced rendering for massive parallelization
   - Implement as progressive enhancement

3. **Why Not CSS Animations**
   - Poor performance with thousands of DOM elements
   - Limited control over individual character animations
   - Memory overhead from DOM node management

## Component Architecture

### Layer Separation

```
┌─────────────────────────────────────┐
│        EventTimeline.vue            │
│    (Container & Mode Controller)     │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐ ┌───────▼───────┐
│ StandardMode│ │  MatrixMode   │
│  Component  │ │   Component   │
└─────────────┘ └───────┬───────┘
                        │
                ┌───────┴────────┐
                │                │
        ┌───────▼──────┐ ┌──────▼──────┐
        │ MatrixCanvas │ │ MatrixWebGL │
        │   Renderer   │ │  Renderer   │
        └──────────────┘ └─────────────┘
```

### New Components

1. **MatrixModeToggle.vue**
   - Toggle button with transition animation
   - State management for mode switching

2. **MatrixRainCanvas.vue**
   - Canvas-based Matrix rain renderer
   - Handles character positioning and animation
   - Integrates with event stream

3. **MatrixWebGLRenderer.ts** (composable)
   - WebGL implementation for high-performance scenarios
   - Shader-based character rendering
   - GPU-accelerated animations

## State Management

### Mode Toggle State

```typescript
// composables/useMatrixMode.ts
interface MatrixModeState {
  isEnabled: boolean;
  renderMode: 'canvas' | 'webgl';
  config: MatrixConfig;
}

interface MatrixConfig {
  columnWidth: number;      // 20px default
  dropSpeed: number;        // 30-120 chars/sec
  trailLength: number;      // 10-20 characters
  colorScheme: 'classic' | 'blue' | 'custom';
  characterSet: string[];   // Matrix characters
  glowIntensity: number;    // 0-1
}
```

### Integration with Existing State

```typescript
// EventTimeline.vue modifications
const matrixMode = useMatrixMode();
const { events, filters } = props;

// Conditional rendering based on mode
const displayMode = computed(() => 
  matrixMode.isEnabled.value ? 'matrix' : 'standard'
);
```

## Data Transformation Pipeline

### Event to Matrix Character Mapping

```typescript
interface MatrixDrop {
  column: number;
  position: number;
  speed: number;
  characters: string[];
  brightness: number[];
  sourceEvent?: HookEvent;
}

class EventToMatrixTransformer {
  transform(event: HookEvent): MatrixDrop {
    // Map event properties to Matrix characteristics
    return {
      column: this.hashToColumn(event.session_id),
      speed: this.mapEventTypeToSpeed(event.hook_event_type),
      characters: this.generateCharacters(event),
      brightness: this.calculateBrightness(event.timestamp),
      sourceEvent: event
    };
  }
  
  private generateCharacters(event: HookEvent): string[] {
    // Extract meaningful characters from event data
    const chars = [];
    
    // Use event type abbreviation
    chars.push(event.hook_event_type[0].toUpperCase());
    
    // Extract numbers from agent_id
    const numbers = event.agent_id?.match(/\d/g) || [];
    chars.push(...numbers);
    
    // Add random Matrix characters
    const matrixChars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ012345789';
    while (chars.length < 10) {
      chars.push(matrixChars[Math.floor(Math.random() * matrixChars.length)]);
    }
    
    return chars;
  }
}
```

## Performance Optimization Strategy

### Canvas Optimization Techniques

1. **Layer Separation**
   - Background layer (static grid)
   - Character layer (animated drops)
   - Glow effect layer (composite)

2. **Batch Rendering**
   ```typescript
   class MatrixCanvasRenderer {
     private batchBuffer: MatrixDrop[] = [];
     private rafId: number;
     
     render() {
       // Batch all drops in single frame
       this.rafId = requestAnimationFrame(() => {
         this.ctx.clearRect(0, 0, this.width, this.height);
         
         // Render all drops in one pass
         for (const drop of this.batchBuffer) {
           this.renderDrop(drop);
         }
         
         this.batchBuffer = [];
       });
     }
   }
   ```

3. **Object Pooling**
   ```typescript
   class DropPool {
     private pool: MatrixDrop[] = [];
     
     acquire(): MatrixDrop {
       return this.pool.pop() || this.createDrop();
     }
     
     release(drop: MatrixDrop): void {
       this.resetDrop(drop);
       this.pool.push(drop);
     }
   }
   ```

### WebGL Optimization (Fallback)

1. **Instanced Rendering**
   ```glsl
   // Vertex shader for instanced characters
   attribute vec2 position;
   attribute float characterIndex;
   attribute float brightness;
   attribute float column;
   attribute float yOffset;
   
   uniform float time;
   uniform sampler2D fontTexture;
   
   void main() {
     vec2 pos = position;
     pos.x += column * 20.0;
     pos.y += yOffset - mod(time * dropSpeed, screenHeight);
     
     gl_Position = projectionMatrix * vec4(pos, 0.0, 1.0);
   }
   ```

2. **Texture Atlas for Characters**
   - Pre-render all Matrix characters to texture
   - Single draw call for all characters

## Integration Points

### WebSocket Integration

```typescript
// Extend useTimelineWebSocket.ts
const handleMatrixEvent = (event: TimelineWebSocketUpdate) => {
  if (matrixMode.isEnabled.value) {
    // Transform and add to Matrix renderer
    const drop = transformer.transform(event.data);
    matrixRenderer.addDrop(drop);
  } else {
    // Normal event handling
    processStandardEvent(event);
  }
};
```

### Transition Handling

```typescript
class ModeTransitionManager {
  async transitionToMatrix() {
    // 1. Fade out standard timeline
    await this.fadeOut('.event-timeline', 300);
    
    // 2. Initialize Matrix canvas
    this.initializeMatrixCanvas();
    
    // 3. Convert existing events to drops
    const drops = this.convertEventsToDrops(currentEvents);
    
    // 4. Fade in Matrix view
    await this.fadeIn('.matrix-canvas', 500);
    
    // 5. Start animation loop
    this.startMatrixAnimation();
  }
}
```

## Performance Targets

### Metrics
- **Frame Rate**: Maintain 60fps with up to 1000 active drops
- **Memory Usage**: < 50MB additional memory for Matrix mode
- **Transition Time**: < 500ms mode switch
- **CPU Usage**: < 30% on average hardware

### Adaptive Quality

```typescript
class QualityController {
  adjustQuality(metrics: PerformanceMetrics) {
    if (metrics.frameRate < 30) {
      // Reduce quality
      this.config.trailLength = Math.max(5, this.config.trailLength - 2);
      this.config.glowIntensity *= 0.8;
      
      if (metrics.frameRate < 20 && this.mode === 'canvas') {
        // Switch to WebGL for better performance
        this.switchToWebGL();
      }
    } else if (metrics.frameRate > 55) {
      // Increase quality
      this.config.trailLength = Math.min(20, this.config.trailLength + 1);
      this.config.glowIntensity = Math.min(1, this.config.glowIntensity * 1.1);
    }
  }
}
```

## Implementation Status

### ✅ COMPLETED: Foundation & Architecture (Phase 10: Matrix Mode)
1. **Type System** - Complete interface definitions in `types/matrix.ts`
2. **State Management** - `useMatrixMode` composable with reactive state 
3. **Event Transformation** - `utils/eventToMatrix.ts` with character mapping
4. **WebSocket Integration** - Dual-mode subscription pattern designed
5. **Test Framework** - TDD utilities and performance benchmarks ready
6. **Visual Effects System** - Character sets and effect utilities defined

### 🚧 IN PROGRESS: Component Implementation
1. **Canvas Renderer** - `MatrixRainCanvas` component and rendering logic
2. **WebSocket Routing** - Event flow integration with existing timeline
3. **Visual Polish** - Glow effects, trail animations, color schemes
4. **EventTimeline Integration** - Mode toggle and conditional rendering

### 📋 REMAINING: Final Assembly
1. Component integration testing
2. Performance optimization and tuning
3. WebGL fallback implementation (if needed)
4. Accessibility and user preferences
5. Visual regression testing

### Key Architectural Decisions Implemented
- **Canvas 2D Primary**: Validated as optimal for expected event volumes (<1000)
- **Object Pooling**: Pre-allocated drop objects with 50MB memory limit
- **Deterministic Columns**: Session-based column assignment for visual consistency
- **Reactive State**: Vue 3 composition API with TypeScript interfaces
- **Performance Monitoring**: Real-time FPS and memory tracking with adaptive quality

## Risk Mitigation

### Performance Risks
- **Mitigation**: Adaptive quality system, WebGL fallback
- **Monitoring**: Built-in performance metrics

### Browser Compatibility
- **Canvas 2D**: 100% support in modern browsers
- **WebGL**: 97% support with fallback to Canvas

### Memory Management
- **Object pooling** for drop instances
- **Automatic garbage collection** for old drops
- **Memory limit enforcement** (50MB cap)

## Testing Strategy

### Performance Testing
```typescript
describe('Matrix Mode Performance', () => {
  it('maintains 60fps with 1000 drops', async () => {
    const renderer = new MatrixCanvasRenderer();
    const monitor = new PerformanceMonitor();
    
    // Add 1000 drops
    for (let i = 0; i < 1000; i++) {
      renderer.addDrop(createTestDrop());
    }
    
    // Run for 5 seconds
    await runAnimation(5000);
    
    expect(monitor.getAverageFPS()).toBeGreaterThan(55);
  });
});
```

### Visual Regression Testing
- Capture screenshots at key frames
- Compare with baseline images
- Test across different screen sizes

## Conclusion

This architecture provides a performant, visually impressive Matrix mode while maintaining the stability and functionality of the existing EventTimeline. The layered approach allows for progressive enhancement and ensures graceful degradation on lower-end devices.