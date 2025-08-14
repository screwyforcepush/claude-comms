# Auto-Pan Feature Architecture

## Overview
The auto-pan feature automatically scrolls the timeline to keep the current time ("NOW" marker) visible, providing a real-time view of ongoing sessions and agent activities. Users can disable auto-pan at any time through manual interaction or explicit controls.

## Architecture Components

### 1. State Management

#### Core State Variables
Add these reactive state variables to `InteractiveSessionsTimeline.vue`:

```typescript
// Auto-pan control state
const autoPanEnabled = ref<boolean>(false);
const currentWindow = ref<number | null>(props.defaultWindow);
const userInteractionFlag = ref<boolean>(false);
const lastAutoPanTime = ref<number>(Date.now());
const autoPanAnimationId = ref<number | null>(null);
const userInteractionTimeout = ref<number | null>(null);
```

#### State Semantics
- `currentWindow === null`: Auto-pan disabled, manual control mode
- `currentWindow === number`: Auto-pan enabled with specified time window
- `userInteractionFlag === true`: Temporary auto-pan pause due to user action

### 2. Animation Loop Architecture

#### RequestAnimationFrame Pattern
```typescript
const autoPanLoop = () => {
  if (!autoPanEnabled.value || userInteractionFlag.value || currentWindow.value === null) {
    autoPanAnimationId.value = null;
    return;
  }
  
  const now = Date.now();
  const nowX = getNowX();
  const viewportRight = containerWidth.value - timelineMargins.right;
  const targetX = viewportRight - nowX - 100; // 100px buffer from right edge
  
  // Smooth interpolation with ease-out
  const delta = targetX - panX.value;
  const smoothingFactor = 0.05; // Adjust for smoothness vs responsiveness
  
  if (Math.abs(delta) > 0.5) {
    panX.value += delta * smoothingFactor;
  }
  
  // Update performance metrics
  lastAutoPanTime.value = now;
  
  // Continue animation loop
  autoPanAnimationId.value = requestAnimationFrame(autoPanLoop);
};

const startAutoPan = () => {
  if (autoPanAnimationId.value === null) {
    autoPanEnabled.value = true;
    autoPanAnimationId.value = requestAnimationFrame(autoPanLoop);
  }
};

const stopAutoPan = () => {
  if (autoPanAnimationId.value !== null) {
    cancelAnimationFrame(autoPanAnimationId.value);
    autoPanAnimationId.value = null;
    autoPanEnabled.value = false;
  }
};
```

### 3. User Interaction Detection

#### Detection Strategy
Distinguish between user-initiated and programmatic changes:

```typescript
const detectUserInteraction = () => {
  userInteractionFlag.value = true;
  
  // Clear existing timeout
  if (userInteractionTimeout.value) {
    clearTimeout(userInteractionTimeout.value);
  }
  
  // Reset flag after 3 seconds of inactivity
  userInteractionTimeout.value = window.setTimeout(() => {
    userInteractionFlag.value = false;
    userInteractionTimeout.value = null;
  }, 3000);
};

// Enhanced mouse handlers
const handleMouseDown = (event: MouseEvent) => {
  if (event.target === sessionsSvg.value) {
    detectUserInteraction();
    currentWindow.value = null; // Disable auto-pan on manual pan
    // ... existing pan logic
  }
};

const handleWheel = (event: WheelEvent) => {
  detectUserInteraction();
  currentWindow.value = null; // Disable auto-pan on manual zoom
  // ... existing zoom logic
};

// Enhanced keyboard handler
const handleKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowDown':
      detectUserInteraction();
      currentWindow.value = null; // Disable on manual pan
      break;
    case '+':
    case '-':
      detectUserInteraction();
      currentWindow.value = null; // Disable on manual zoom
      break;
    // ... existing keyboard logic
  }
};
```

### 4. Time Window Integration

#### Enhanced Time Windows Array
```typescript
const timeWindows: TimeWindow[] = [
  { label: 'Off', value: null },    // Auto-pan disabled
  { label: '15m', value: 15 * 60 * 1000 },
  { label: '1h', value: 60 * 60 * 1000 },
  { label: '6h', value: 6 * 60 * 60 * 1000 },
  { label: '24h', value: 24 * 60 * 60 * 1000 }
];
```

#### Modified setTimeWindow Function
```typescript
const setTimeWindow = (windowSize: number | null, isProgrammatic = true) => {
  const oldWindow = currentWindow.value;
  
  if (oldWindow === windowSize) return;
  
  // Don't set userInteractionFlag for programmatic changes
  if (!isProgrammatic) {
    detectUserInteraction();
  }
  
  currentWindow.value = windowSize;
  
  // Handle auto-pan state
  if (windowSize === null) {
    stopAutoPan();
  } else if (oldWindow === null) {
    startAutoPan();
  }
  
  // ... existing transition animation
  emit('time-window-changed', windowSize);
};
```

### 5. View Reset Enhancement

```typescript
const resetView = (enableAutoPan = false) => {
  // Stop any ongoing animations
  stopAutoPan();
  
  const transitionDuration = 400;
  const startTime = performance.now();
  const startZoom = zoomLevel.value;
  const startPanX = panX.value;
  const startPanY = panY.value;
  
  const animateReset = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / transitionDuration, 1);
    
    // Ease-out cubic
    const easeOut = 1 - Math.pow(1 - progress, 3);
    
    zoomLevel.value = startZoom + (1 - startZoom) * easeOut;
    panX.value = startPanX * (1 - easeOut);
    panY.value = startPanY * (1 - easeOut);
    
    if (progress < 1) {
      requestAnimationFrame(animateReset);
    } else {
      // Reset complete
      if (enableAutoPan && currentWindow.value !== null) {
        startAutoPan();
      }
      emit('zoom-changed', zoomLevel.value);
    }
  };
  
  requestAnimationFrame(animateReset);
};
```

### 6. Performance Optimizations

#### Performance-Aware Auto-Pan
```typescript
const autoPanLoop = () => {
  // Check performance before continuing
  if (performanceMetrics.frameRate < 30) {
    // Throttle updates when performance is poor
    if (Date.now() - lastAutoPanTime.value < 100) {
      autoPanAnimationId.value = requestAnimationFrame(autoPanLoop);
      return;
    }
  }
  
  // ... auto-pan logic
};
```

#### Visibility API Integration
```typescript
onMounted(() => {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoPan();
    } else if (autoPanEnabled.value && currentWindow.value !== null) {
      startAutoPan();
    }
  });
});
```

### 7. UI Integration

#### Auto-Pan Toggle Button
Add to the controls section:
```vue
<button 
  @click="toggleAutoPan"
  class="px-3 py-1 rounded text-sm font-medium transition-all duration-200"
  :class="autoPanEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'"
  :title="autoPanEnabled ? 'Auto-pan enabled (click to disable)' : 'Auto-pan disabled (click to enable)'"
>
  <span v-if="autoPanEnabled" class="animate-pulse">● Auto-Pan ON</span>
  <span v-else>○ Auto-Pan OFF</span>
</button>
```

#### Visual Indicators
```vue
<!-- Auto-pan status indicator -->
<div v-if="autoPanEnabled" class="absolute top-2 right-2 bg-green-600/20 px-2 py-1 rounded text-xs text-green-400">
  <span class="animate-pulse">● AUTO-PAN ACTIVE</span>
</div>

<!-- User interaction indicator -->
<div v-if="userInteractionFlag" class="absolute top-2 left-2 bg-yellow-600/20 px-2 py-1 rounded text-xs text-yellow-400">
  Manual control active
</div>
```

## Testing Scenarios

### Functional Tests
1. Auto-pan keeps NOW marker visible
2. Manual pan/zoom disables auto-pan
3. Time window "Off" selection disables auto-pan
4. Reset view with auto-pan option works
5. Auto-pan resumes after user interaction timeout

### Performance Tests
1. Auto-pan maintains 60fps with 10+ sessions
2. Throttling activates below 30fps
3. No memory leaks from animation loops
4. CPU usage stays below 10% during auto-pan

### Edge Cases
1. Tab switching pauses/resumes correctly
2. Window resize maintains auto-pan position
3. Rapid time window changes handled smoothly
4. Multiple user interactions don't cause conflicts

## Implementation Checklist

- [ ] Add state variables to InteractiveSessionsTimeline.vue
- [ ] Implement autoPanLoop with requestAnimationFrame
- [ ] Add user interaction detection to mouse/keyboard handlers
- [ ] Modify timeWindows array to include "Off" option
- [ ] Update setTimeWindow to handle null value
- [ ] Enhance resetView with auto-pan option
- [ ] Add auto-pan toggle button to UI
- [ ] Implement performance throttling
- [ ] Add visibility API integration
- [ ] Create visual indicators for auto-pan status
- [ ] Write comprehensive tests
- [ ] Update documentation

## Coordination Points

- **SarahButton**: Implement "Off" button with null value for currentWindow
- **JohnInteract**: Use userInteractionFlag pattern for detection
- **MikeState**: Manage currentWindow for both time window and auto-pan state
- **LisaIntegrate**: Follow integration points in sections 5-7
- **PaulTest**: Test scenarios outlined in Testing section