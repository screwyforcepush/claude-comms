# Matrix Mode Design Specification

## Overview

The Matrix Mode is a creative visualization overlay for the Agent Event Stream that recreates the iconic Matrix digital rain effect while maintaining legitimate observability of real-time event data. This document defines the complete design specifications for implementing Matrix Mode.

## Design Principles

1. **Data Integrity**: Every falling character represents real event data
2. **Performance First**: Maintain 60fps at all times
3. **Smooth Transitions**: Seamless toggle between normal and Matrix modes
4. **Accessibility**: Respect reduced motion preferences and maintain keyboard navigation
5. **Visual Hierarchy**: Important events (errors, completions) get visual emphasis

## Visual Design Specifications

### Matrix Character System

#### Character Types and Data Mapping
```
EVENT DATA → MATRIX CHARACTERS

1. Agent Names → Japanese Katakana (mirrored/rotated)
   - "SaraPixel" → "サラピクセル" (katakana conversion)
   - First 3 characters of agent name become column head sequence

2. Session IDs → Mixed alphanumeric (stylized)
   - Last 8 chars of session ID → flowing down columns
   - Each character gets slight random rotation/distortion

3. Timestamps → Numeric sequences
   - Unix timestamp digits → flowing in dedicated columns
   - Recent events = faster falling speed

4. Event Types → Symbol characters
   - start → ◢
   - complete → ◆
   - error → ⚠
   - spawn → ↕
   - in_progress → ◐

5. Status Updates → Color-coded symbols
   - pending → ⧗ (light green)
   - in_progress → ◐ (bright green/white head)
   - completed → ✓ (white with green trail)
   - error → ⚠ (red with white head)
```

### Color Palette

#### Matrix Color System
```css
/* Core Matrix Colors */
:root {
  /* Primary Matrix green spectrum */
  --matrix-bg: #000000;
  --matrix-green-darkest: #001100;
  --matrix-green-dark: #003300;
  --matrix-green-medium: #00AA00;
  --matrix-green-bright: #00FF00;
  --matrix-white-head: #FFFFFF;
  
  /* Status color overlays */
  --matrix-error: #FF3030;
  --matrix-warning: #FFAA00;
  --matrix-success: #00FFAA;
  --matrix-info: #00AAFF;
  
  /* Character fading levels */
  --matrix-opacity-head: 1.0;
  --matrix-opacity-recent: 0.8;
  --matrix-opacity-medium: 0.5;
  --matrix-opacity-old: 0.2;
  --matrix-opacity-ghost: 0.05;
}
```

#### Character Rendering Rules
1. **Head Character**: Always white (#FFFFFF) for maximum visibility
2. **Trail Characters**: Fade from bright green to dark green over 8-12 positions
3. **Status Characters**: Use status colors for the head, normal fade for trail
4. **Real-time Events**: Pulse effect when new events arrive (white → bright green)

### Animation Specifications

#### Rain Drop Animation
```
COLUMN PROPERTIES:
- Width: 14px (monospace character width)
- Character Height: 20px
- Inter-character Spacing: 2px vertical
- Column Spacing: 16px horizontal

SPEED VARIATIONS:
- Recent Events (< 30s): 100-150px/second
- Medium Age (30s-5m): 80-120px/second  
- Old Events (> 5m): 60-100px/second
- Background Fill: 40-80px/second

TRAIL LENGTH:
- Event Data Streams: 8-15 characters
- Background Streams: 6-20 characters (randomized)
- Status Update Streams: 3-8 characters (shorter, more focused)
```

#### Special Effect Animations

##### New Event Spawn Effect
```
TRIGGER: New HookEvent received via WebSocket
EFFECT: 
1. Character appears at top with bright white flash
2. Pulses white → bright green 3x over 0.8s
3. Transitions to normal falling animation
4. Column gets slight glow effect for 2s
```

##### Error Event Effect
```
TRIGGER: hook_event_type contains "error" or status = "error"
EFFECT:
1. Red tinted head character (⚠)
2. Column background gets subtle red glow
3. Falling speed increases by 50%
4. Trail characters fade red → green instead of white → green
```

##### Completion Event Effect
```
TRIGGER: status = "completed" or hook_event_type = "complete"
EFFECT:
1. Bright white completion symbol (✓)
2. Brief pause at completion (0.5s)
3. Accelerated fade-out with success green
4. Column gets brief success pulse
```

## Technical Implementation Strategy

### Canvas Architecture

#### Render Layers (z-index order)
```
1. Background Layer (z-index: 1)
   - Black background with subtle noise texture
   - Optional grid lines for debugging

2. Background Rain Layer (z-index: 2)  
   - Random character streams for atmosphere
   - 40% of columns, lower opacity
   - Provides "Matrix ambiance" without data

3. Event Data Layer (z-index: 3)
   - Real event data streams
   - 60% of columns, full opacity
   - Primary data visualization

4. Status Overlay Layer (z-index: 4)
   - Error highlights, completion effects
   - Special status indicators
   - Glow effects and pulses

5. UI Overlay Layer (z-index: 5)
   - Matrix mode toggle button
   - Accessibility announcements
   - Performance metrics (debug mode)
```

#### Canvas Optimization Strategy
```javascript
// Performance-first rendering approach
const matrixRenderer = {
  // Double buffering for smooth updates
  frontCanvas: HTMLCanvasElement,
  backCanvas: HTMLCanvasElement,
  
  // Efficient character pre-rendering
  characterCache: Map<string, ImageData>,
  
  // Dirty region tracking
  dirtyColumns: Set<number>,
  
  // Frame rate management
  targetFPS: 60,
  frameTimeMS: 16.67,
  
  // Memory management
  maxTrailLength: 20,
  columnCount: Math.floor(viewportWidth / 16)
};
```

### Data Integration Pipeline

#### Event Processing Flow
```
WebSocket Event → Matrix Transformer → Character Stream → Canvas Renderer

1. WebSocket Listener
   - Receives HookEvent updates
   - Filters for Matrix-relevant data
   - Queues for processing

2. Matrix Transformer
   - Maps event data to characters
   - Assigns to available columns
   - Calculates speeds and effects

3. Character Stream Manager  
   - Manages column states
   - Handles collisions and overlaps
   - Maintains trail histories

4. Canvas Renderer
   - Draws characters efficiently
   - Applies effects and fading
   - Manages frame timing
```

#### Character Mapping Algorithm
```javascript
function mapEventToCharacters(event: HookEvent): MatrixCharacterStream {
  const stream = {
    characters: [],
    speed: calculateSpeedFromAge(event.timestamp),
    column: assignColumn(event.session_id),
    effect: determineEffect(event)
  };
  
  // Agent name → katakana
  if (event.payload?.agentName) {
    stream.characters.push(...convertToKatakana(event.payload.agentName));
  }
  
  // Event type → symbol
  stream.characters.push(getSymbolForEventType(event.hook_event_type));
  
  // Session ID → stylized alphanumeric
  stream.characters.push(...stylizeSessionId(event.session_id));
  
  // Timestamp → numeric sequence
  stream.characters.push(...formatTimestamp(event.timestamp));
  
  return stream;
}
```

## User Experience Design

### Toggle System

#### Matrix Mode Toggle Button
```
LOCATION: Top-right corner of EventTimeline component
DESIGN: Pill-shaped toggle with Matrix-style green glow
STATES:
- Normal Mode: "◉ Matrix" (gray text, subtle border)
- Matrix Mode: "◉ Matrix" (bright green text, green glow)
- Transition: Pulsing animation during mode switch

KEYBOARD: Accessible via Tab navigation, Space/Enter to toggle
SCREEN READER: "Toggle Matrix visualization mode, currently [normal/matrix]"
```

#### Transition Animation Sequence
```
NORMAL → MATRIX (2.0s total):
0.0s - 0.5s: Normal view fades to 50% opacity
0.5s - 1.0s: Black overlay fades in from 0% to 100%
1.0s - 1.5s: Matrix canvas fades in from 0% to 100%  
1.5s - 2.0s: Character streams begin falling animation

MATRIX → NORMAL (1.5s total):
0.0s - 0.5s: Matrix canvas fades to 50% opacity
0.5s - 1.0s: Normal view fades in from 0% to 100%
1.0s - 1.5s: Matrix canvas fades out completely
```

### Accessibility Considerations

#### Motion Sensitivity
```css
@media (prefers-reduced-motion: reduce) {
  .matrix-mode {
    /* Disable all animations */
    animation: none !important;
    transition: opacity 0.2s ease !important;
  }
  
  .matrix-character {
    /* Static positioning only */
    transform: none !important;
  }
  
  .matrix-effect {
    /* Remove all special effects */
    filter: none !important;
    box-shadow: none !important;
  }
}
```

#### Screen Reader Support
```html
<!-- Live region for Matrix mode status -->
<div aria-live="polite" aria-label="Matrix mode status">
  <span class="sr-only">
    Matrix mode active. Showing {eventCount} events as digital rain.
    New events: {recentEventDescription}
  </span>
</div>

<!-- Keyboard navigation hints -->
<div aria-label="Matrix mode controls">
  <button aria-describedby="matrix-help">Toggle Matrix Mode</button>
  <div id="matrix-help" class="sr-only">
    Press M to toggle Matrix mode. ESC to return to normal view.
  </div>
</div>
```

### Performance Monitoring

#### Frame Rate Management
```javascript
const performanceMonitor = {
  targetFPS: 60,
  frameTimeTargetMS: 16.67,
  
  // Adaptive quality system
  qualityLevels: {
    HIGH: { maxColumns: 100, maxTrailLength: 20, effects: true },
    MEDIUM: { maxColumns: 60, maxTrailLength: 15, effects: true },
    LOW: { maxColumns: 40, maxTrailLength: 10, effects: false },
    MINIMAL: { maxColumns: 20, maxTrailLength: 6, effects: false }
  },
  
  // Auto-adjust based on performance
  adjustQuality(avgFrameTime) {
    if (avgFrameTime > 20) this.reduceQuality();
    if (avgFrameTime < 14) this.increaseQuality();
  }
};
```

## Implementation Priorities

### Phase 1: Core Matrix Effect (MVP)
- [ ] Canvas setup and basic character rendering
- [ ] Simple falling animation with fading trails
- [ ] Event data → character mapping
- [ ] Basic toggle between normal/Matrix modes

### Phase 2: Enhanced Visual Effects
- [ ] New event spawn effects (pulse, glow)
- [ ] Error/completion status effects
- [ ] Color-coded character streams
- [ ] Advanced fading and trail effects

### Phase 3: Performance & Polish
- [ ] Adaptive quality system
- [ ] Performance monitoring
- [ ] Accessibility enhancements
- [ ] Mobile responsive optimizations

### Phase 4: Advanced Features
- [ ] Interactive character streams (click to view event details)
- [ ] Matrix code "freezing" on hover
- [ ] Full-screen Matrix mode
- [ ] Matrix-style loading states

## Design Assets Required

### Character Sets
1. **Katakana Set**: For agent names (ア, イ, ウ, エ, オ...)
2. **Symbol Set**: For event types (◆, ⚠, ↕, ◐, ✓...)
3. **Numeric Set**: For timestamps (0-9 with Matrix styling)
4. **Alphanumeric Set**: For session IDs (A-Z, 0-9 stylized)

### Effect Presets
1. **Pulse Effect**: White → bright green transition
2. **Error Effect**: Red tint with accelerated fall
3. **Success Effect**: Green glow with pause
4. **Spawn Effect**: Bright flash with column highlight

## Technical Dependencies

### Required Libraries
- Canvas 2D rendering context (native)
- No external animation libraries (performance reasons)
- Vue 3 reactivity for mode state management

### Browser Support
- Modern browsers with Canvas 2D support
- Hardware acceleration preferred
- Graceful degradation for older browsers

## Success Metrics

### Performance Targets
- Maintain 60fps during active Matrix mode
- < 50ms latency from WebSocket event to visual update
- < 100MB memory usage for 1000+ concurrent events
- Smooth transitions (no visual stuttering)

### User Experience Goals
- Visually stunning Matrix effect that captures the iconic feel
- Clear representation of real event data within the rain
- Intuitive toggle mechanism
- Full accessibility compliance

---

*This specification provides the foundation for implementing a technically sound and visually impressive Matrix mode that enhances rather than obscures the observability value of the event stream.*