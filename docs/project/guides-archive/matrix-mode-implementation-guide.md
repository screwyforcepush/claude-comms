# Matrix Mode Implementation Guide

## State Management Implementation

### 1. Create Matrix Mode Composable

```typescript
// composables/useMatrixMode.ts
import { ref, computed, watch } from 'vue';
import type { HookEvent } from '../types';

export interface MatrixConfig {
  columnWidth: number;
  dropSpeed: number;
  trailLength: number;
  colorScheme: 'classic' | 'blue' | 'cyber';
  characterSet: string[];
  glowIntensity: number;
  maxDrops: number;
}

export interface MatrixDrop {
  id: string;
  column: number;
  position: number;
  speed: number;
  characters: string[];
  brightness: number[];
  color: string;
  sourceEvent?: HookEvent;
  createdAt: number;
}

const DEFAULT_CONFIG: MatrixConfig = {
  columnWidth: 20,
  dropSpeed: 50,
  trailLength: 15,
  colorScheme: 'classic',
  characterSet: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789'.split(''),
  glowIntensity: 0.8,
  maxDrops: 1000
};

export function useMatrixMode() {
  const isEnabled = ref(false);
  const config = ref<MatrixConfig>({ ...DEFAULT_CONFIG });
  const drops = ref<Map<string, MatrixDrop>>(new Map());
  const renderMode = ref<'canvas' | 'webgl'>('canvas');
  
  // Performance metrics
  const performanceMetrics = ref({
    fps: 60,
    dropCount: 0,
    memoryUsage: 0
  });
  
  // Toggle Matrix mode
  const toggleMatrixMode = () => {
    isEnabled.value = !isEnabled.value;
    if (!isEnabled.value) {
      // Clean up drops when disabling
      drops.value.clear();
    }
  };
  
  // Add event as Matrix drop
  const addEventDrop = (event: HookEvent) => {
    if (!isEnabled.value) return;
    
    const drop = createDropFromEvent(event);
    drops.value.set(drop.id, drop);
    
    // Limit drops to prevent memory issues
    if (drops.value.size > config.value.maxDrops) {
      const oldestDrop = Array.from(drops.value.values())
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      drops.value.delete(oldestDrop.id);
    }
  };
  
  // Create drop from event
  const createDropFromEvent = (event: HookEvent): MatrixDrop => {
    const column = hashToColumn(event.session_id + event.source_app);
    const characters = generateEventCharacters(event);
    
    return {
      id: `${event.id}-${Date.now()}`,
      column,
      position: 0,
      speed: mapEventTypeToSpeed(event.hook_event_type),
      characters,
      brightness: generateBrightness(characters.length),
      color: getEventColor(event),
      sourceEvent: event,
      createdAt: Date.now()
    };
  };
  
  // Helper functions
  const hashToColumn = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % Math.floor(window.innerWidth / config.value.columnWidth);
  };
  
  const mapEventTypeToSpeed = (type: string): number => {
    const speedMap: Record<string, number> = {
      'pre_response': 80,
      'post_response': 60,
      'error': 100,
      'stream_chunk': 70,
      'api_request': 50
    };
    return speedMap[type] || config.value.dropSpeed;
  };
  
  const generateEventCharacters = (event: HookEvent): string[] => {
    const chars: string[] = [];
    
    // Add event type indicator
    chars.push(event.hook_event_type[0].toUpperCase());
    
    // Extract meaningful characters from event data
    if (event.agent_id) {
      const agentChars = event.agent_id.slice(0, 3).toUpperCase();
      chars.push(...agentChars.split(''));
    }
    
    // Add timestamp digits
    const timeDigits = event.timestamp.toString().slice(-4);
    chars.push(...timeDigits.split(''));
    
    // Fill with random Matrix characters
    while (chars.length < config.value.trailLength) {
      const randomChar = config.value.characterSet[
        Math.floor(Math.random() * config.value.characterSet.length)
      ];
      chars.push(randomChar);
    }
    
    return chars.slice(0, config.value.trailLength);
  };
  
  const generateBrightness = (length: number): number[] => {
    return Array.from({ length }, (_, i) => {
      const position = i / length;
      return Math.max(0, 1 - position * 0.8);
    });
  };
  
  const getEventColor = (event: HookEvent): string => {
    const colorMap: Record<string, string> = {
      'error': '#ff0000',
      'success': '#00ff00',
      'warning': '#ffff00',
      'info': '#00ffff'
    };
    
    // Check event type or status for color
    if (event.hook_event_type.includes('error')) return colorMap.error;
    if (event.hook_event_type.includes('success')) return colorMap.success;
    
    // Default Matrix green
    return '#00ff00';
  };
  
  // Auto-switch to WebGL for performance
  watch(() => drops.value.size, (size) => {
    if (size > 5000 && renderMode.value === 'canvas') {
      console.log('Switching to WebGL for better performance');
      renderMode.value = 'webgl';
    } else if (size < 3000 && renderMode.value === 'webgl') {
      renderMode.value = 'canvas';
    }
  });
  
  return {
    isEnabled: computed(() => isEnabled.value),
    config,
    drops: computed(() => drops.value),
    renderMode: computed(() => renderMode.value),
    performanceMetrics: computed(() => performanceMetrics.value),
    toggleMatrixMode,
    addEventDrop,
    updateConfig: (newConfig: Partial<MatrixConfig>) => {
      config.value = { ...config.value, ...newConfig };
    }
  };
}
```

## Component Integration

### 2. Modify EventTimeline.vue

```vue
<!-- EventTimeline.vue modifications -->
<template>
  <div class="flex-1 mobile:h-[50vh] overflow-hidden flex flex-col">
    <!-- Existing header -->
    <div class="px-3 py-4 mobile:py-2 bg-gradient-to-r from-gray-800 to-gray-700 relative z-10">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl mobile:text-lg font-bold text-blue-400 text-center drop-shadow-sm">
          Agent Event Stream
        </h2>
        <!-- Matrix Mode Toggle -->
        <MatrixModeToggle 
          :is-enabled="matrixMode.isEnabled.value"
          @toggle="handleMatrixToggle"
        />
      </div>
    </div>
    
    <!-- Conditional rendering based on mode -->
    <template v-if="!matrixMode.isEnabled.value">
      <!-- Existing timeline content -->
      <TimelineDirectionHeader ... />
      <div ref="scrollContainer" ...>
        <!-- Existing event rows -->
      </div>
    </template>
    
    <!-- Matrix Mode View -->
    <template v-else>
      <MatrixRainCanvas
        :events="filteredEvents"
        :config="matrixMode.config.value"
        :render-mode="matrixMode.renderMode.value"
        @performance-update="handlePerformanceUpdate"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useMatrixMode } from '../composables/useMatrixMode';
import MatrixModeToggle from './MatrixModeToggle.vue';
import MatrixRainCanvas from './MatrixRainCanvas.vue';

// Add Matrix mode composable
const matrixMode = useMatrixMode();

// Handle mode toggle with transition
const handleMatrixToggle = async () => {
  // Add transition animation
  const container = scrollContainer.value;
  if (container) {
    container.style.transition = 'opacity 300ms ease';
    container.style.opacity = '0';
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  matrixMode.toggleMatrixMode();
  
  if (container) {
    await nextTick();
    container.style.opacity = '1';
  }
};

// Feed events to Matrix mode
watch(() => filteredEvents.value, (events) => {
  if (matrixMode.isEnabled.value) {
    // Only add new events
    const latestEvent = events[0];
    if (latestEvent) {
      matrixMode.addEventDrop(latestEvent);
    }
  }
});

// Handle performance updates
const handlePerformanceUpdate = (metrics: any) => {
  // Adjust quality based on performance
  if (metrics.fps < 30) {
    matrixMode.updateConfig({
      trailLength: Math.max(5, matrixMode.config.value.trailLength - 2),
      glowIntensity: matrixMode.config.value.glowIntensity * 0.8
    });
  }
};
</script>
```

### 3. Create Matrix Mode Toggle Component

```vue
<!-- components/MatrixModeToggle.vue -->
<template>
  <button
    @click="$emit('toggle')"
    class="matrix-toggle-btn"
    :class="{ 'active': isEnabled }"
    :aria-label="isEnabled ? 'Disable Matrix Mode' : 'Enable Matrix Mode'"
  >
    <svg 
      class="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g v-if="!isEnabled">
        <!-- Standard view icon -->
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
        <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2"/>
        <line x1="9" y1="9" x2="9" y2="21" stroke="currentColor" stroke-width="2"/>
      </g>
      <g v-else>
        <!-- Matrix view icon -->
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#00ff00" stroke-width="2"/>
        <text x="12" y="16" text-anchor="middle" fill="#00ff00" font-size="12" font-family="monospace">M</text>
      </g>
    </svg>
    <span class="ml-2 text-xs">{{ isEnabled ? 'Standard' : 'Matrix' }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  isEnabled: boolean;
}>();

defineEmits<{
  toggle: [];
}>();
</script>

<style scoped>
.matrix-toggle-btn {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 0.5rem;
  color: #00d4ff;
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.matrix-toggle-btn:hover {
  background: rgba(0, 212, 255, 0.1);
  border-color: #00d4ff;
  transform: scale(1.05);
}

.matrix-toggle-btn.active {
  background: rgba(0, 255, 0, 0.1);
  border-color: #00ff00;
  color: #00ff00;
}

.matrix-toggle-btn:active {
  transform: scale(0.95);
}
</style>
```

## Canvas Renderer Implementation

### 4. Create Matrix Rain Canvas Component

```vue
<!-- components/MatrixRainCanvas.vue -->
<template>
  <div class="matrix-canvas-container" ref="containerRef">
    <canvas 
      ref="canvasRef"
      class="matrix-canvas"
      :width="canvasWidth"
      :height="canvasHeight"
    />
    <div class="matrix-overlay" v-if="showOverlay">
      <div class="performance-stats">
        FPS: {{ Math.round(fps) }} | Drops: {{ dropCount }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useMatrixCanvasRenderer } from '../composables/useMatrixCanvasRenderer';
import type { HookEvent } from '../types';
import type { MatrixConfig } from '../composables/useMatrixMode';

const props = defineProps<{
  events: HookEvent[];
  config: MatrixConfig;
  renderMode: 'canvas' | 'webgl';
}>();

const emit = defineEmits<{
  'performance-update': [metrics: { fps: number; dropCount: number }];
}>();

const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();
const canvasWidth = ref(window.innerWidth);
const canvasHeight = ref(window.innerHeight);

const { 
  startAnimation, 
  stopAnimation, 
  addDrop, 
  updateConfig,
  getMetrics 
} = useMatrixCanvasRenderer(canvasRef);

// Performance monitoring
const fps = ref(60);
const dropCount = ref(0);
const showOverlay = ref(false);

// Handle resize
const handleResize = () => {
  canvasWidth.value = window.innerWidth;
  canvasHeight.value = window.innerHeight;
};

// Watch for new events
watch(() => props.events, (newEvents, oldEvents) => {
  if (newEvents.length > oldEvents?.length) {
    // Add only new events
    const newEventCount = newEvents.length - (oldEvents?.length || 0);
    const latestEvents = newEvents.slice(0, newEventCount);
    
    latestEvents.forEach(event => {
      addDrop(event);
    });
  }
});

// Watch for config changes
watch(() => props.config, (newConfig) => {
  updateConfig(newConfig);
}, { deep: true });

// Performance monitoring loop
let metricsInterval: number;

onMounted(() => {
  window.addEventListener('resize', handleResize);
  startAnimation();
  
  // Monitor performance
  metricsInterval = setInterval(() => {
    const metrics = getMetrics();
    fps.value = metrics.fps;
    dropCount.value = metrics.dropCount;
    
    emit('performance-update', metrics);
  }, 1000);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  stopAnimation();
  clearInterval(metricsInterval);
});
</script>

<style scoped>
.matrix-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}

.matrix-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.matrix-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.performance-stats {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #00ff00;
  font-family: monospace;
  font-size: 12px;
  border: 1px solid #00ff00;
  border-radius: 3px;
}
</style>
```

## Testing Implementation

### 5. Test Suite for Matrix Mode

```typescript
// __tests__/MatrixMode.test.ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { useMatrixMode } from '../composables/useMatrixMode';
import MatrixRainCanvas from '../components/MatrixRainCanvas.vue';

describe('Matrix Mode', () => {
  describe('useMatrixMode composable', () => {
    it('should toggle Matrix mode', () => {
      const { isEnabled, toggleMatrixMode } = useMatrixMode();
      
      expect(isEnabled.value).toBe(false);
      toggleMatrixMode();
      expect(isEnabled.value).toBe(true);
    });
    
    it('should convert events to drops', () => {
      const { addEventDrop, drops } = useMatrixMode();
      
      const mockEvent = {
        id: 'test-1',
        session_id: 'session-1',
        source_app: 'test-app',
        hook_event_type: 'pre_response',
        timestamp: Date.now(),
        payload: {}
      };
      
      addEventDrop(mockEvent);
      
      expect(drops.value.size).toBe(1);
      const drop = Array.from(drops.value.values())[0];
      expect(drop.sourceEvent).toBe(mockEvent);
      expect(drop.characters.length).toBeGreaterThan(0);
    });
    
    it('should limit maximum drops', () => {
      const { addEventDrop, drops, updateConfig } = useMatrixMode();
      
      updateConfig({ maxDrops: 10 });
      
      for (let i = 0; i < 20; i++) {
        addEventDrop({
          id: `test-${i}`,
          session_id: 'session-1',
          source_app: 'test-app',
          hook_event_type: 'test',
          timestamp: Date.now() + i,
          payload: {}
        });
      }
      
      expect(drops.value.size).toBeLessThanOrEqual(10);
    });
  });
  
  describe('MatrixRainCanvas component', () => {
    it('should render canvas element', () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          events: [],
          config: {
            columnWidth: 20,
            dropSpeed: 50,
            trailLength: 15,
            colorScheme: 'classic',
            characterSet: ['M', 'A', 'T', 'R', 'I', 'X'],
            glowIntensity: 0.8,
            maxDrops: 1000
          },
          renderMode: 'canvas'
        }
      });
      
      expect(wrapper.find('canvas').exists()).toBe(true);
    });
    
    it('should emit performance updates', async () => {
      const wrapper = mount(MatrixRainCanvas, {
        props: {
          events: [],
          config: { /* ... */ },
          renderMode: 'canvas'
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(wrapper.emitted('performance-update')).toBeTruthy();
      const metrics = wrapper.emitted('performance-update')[0][0];
      expect(metrics).toHaveProperty('fps');
      expect(metrics).toHaveProperty('dropCount');
    });
  });
});
```

## Migration Path

### Step 1: Feature Flag
Add a feature flag to gradually roll out Matrix mode:

```typescript
// config/features.ts
export const FEATURES = {
  MATRIX_MODE: process.env.VUE_APP_MATRIX_MODE === 'true' || false
};
```

### Step 2: Progressive Enhancement
Start with basic implementation, then add enhancements:

1. Basic character dropping
2. Event integration
3. Visual effects (glow, trails)
4. Performance optimizations
5. WebGL fallback

### Step 3: User Preferences
Store user preference for Matrix mode:

```typescript
// utils/preferences.ts
export const saveMatrixModePreference = (enabled: boolean) => {
  localStorage.setItem('matrix-mode-enabled', enabled.toString());
};

export const getMatrixModePreference = (): boolean => {
  return localStorage.getItem('matrix-mode-enabled') === 'true';
};
```

## Performance Monitoring

Add performance monitoring to track Matrix mode impact:

```typescript
// utils/matrixPerformance.ts
export class MatrixPerformanceMonitor {
  private metrics = {
    frameCount: 0,
    totalRenderTime: 0,
    droppedFrames: 0
  };
  
  trackFrame(renderTime: number) {
    this.metrics.frameCount++;
    this.metrics.totalRenderTime += renderTime;
    
    if (renderTime > 16.67) { // Missed 60fps target
      this.metrics.droppedFrames++;
    }
  }
  
  getReport() {
    return {
      averageFPS: 1000 / (this.metrics.totalRenderTime / this.metrics.frameCount),
      droppedFrameRate: this.metrics.droppedFrames / this.metrics.frameCount,
      totalFrames: this.metrics.frameCount
    };
  }
}
```

## Next Steps

1. Implement the `useMatrixCanvasRenderer` composable
2. Create WebGL renderer for high-performance scenarios
3. Add visual effects (glow, blur, trails)
4. Implement adaptive quality system
5. Add user customization options
6. Create performance benchmarks