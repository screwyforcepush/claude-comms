<template>
  <div class="flex-1 mobile:h-[50vh] overflow-hidden flex flex-col" :class="{ 'matrix-mode-transitioning': matrixMode.isTransitioning.value }">
    <!-- Fixed Header -->
    <div class="px-3 py-4 mobile:py-2 bg-gradient-to-r from-gray-800 to-gray-700 relative z-10" style="box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.3), 0 8px 25px -5px rgba(0, 0, 0, 0.2);">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl mobile:text-lg font-bold text-blue-400 drop-shadow-sm flex-1 text-center">
          Agent Event Stream
        </h2>
        
        <!-- Matrix Mode Toggle Button -->
        <button
          data-testid="matrix-toggle-button"
          :class="[
            'matrix-toggle',
            {
              'matrix-toggle--enabled': matrixMode.isEnabled.value,
              'matrix-toggle--disabled': !matrixMode.isEnabled.value,
              'matrix-toggle--transitioning': matrixMode.isTransitioning.value
            }
          ]"
          :disabled="matrixMode.isTransitioning.value"
          :aria-pressed="matrixMode.isEnabled.value ? 'true' : 'false'"
          aria-label="Toggle Matrix mode visualization"
          role="button"
          tabindex="0"
          @click="handleMatrixToggle"
          @keydown.enter="handleMatrixToggle"
          @keydown.space.prevent="handleMatrixToggle"
        >
          <span class="matrix-toggle__icon" aria-hidden="true">
            {{ matrixMode.isTransitioning.value ? '⚡' : (matrixMode.isEnabled.value ? '🟢' : '🔳') }}
          </span>
          <span class="matrix-toggle__label">
            {{ matrixMode.isTransitioning.value ? 'Switching' : (matrixMode.isEnabled.value ? 'Matrix' : 'Normal') }}
          </span>
        </button>
      </div>
      
      <!-- Screen Reader Announcements -->
      <div 
        data-testid="matrix-mode-announcer"
        aria-live="polite" 
        aria-atomic="true" 
        class="sr-only"
      >
        {{ matrixModeAnnouncementText }}
      </div>
    </div>
    
    <!-- Timeline Direction Header (only in normal mode) -->
    <TimelineDirectionHeader
      v-if="!matrixMode.isEnabled.value"
      :current-order="currentOrder.value"
      :event-count="enhancedFilteredEvents.length"
      :time-range="timeRange"
      @order-changed="handleOrderChange"
    />
    
    <!-- Normal Timeline View -->
    <div 
      v-if="!matrixMode.isEnabled.value"
      data-testid="normal-timeline-view"
      ref="scrollContainer"
      class="flex-1 overflow-y-auto px-3 py-3 mobile:px-2 mobile:py-1.5 relative"
      @scroll="handleScroll"
    >
      <TransitionGroup
        name="event"
        tag="div"
        class="space-y-2 mobile:space-y-1.5 timeline-reorder-transition"
        :class="{ 'timeline-order-changing': isOrderChanging }"
      >
        <EnhancedEventRow
          v-for="event in enhancedFilteredEvents"
          :key="`${event.id}-${event.timestamp}`"
          :enhanced-event="event"
          :gradient-class="getGradientForSession(event.session_id)"
          :color-class="getColorForSession(event.session_id)"
          :app-gradient-class="getGradientForApp(event.source_app)"
          :app-color-class="getColorForApp(event.source_app)"
          :app-hex-color="getHexColorForApp(event.source_app)"
          :current-order="currentOrder.value"
          :total-events="enhancedFilteredEvents.length"
          :use-gpu-acceleration="shouldUseGpuAcceleration"
        />
      </TransitionGroup>
      
      <div v-if="enhancedFilteredEvents.length === 0" class="text-center py-8 mobile:py-6 text-gray-400">
        <div class="text-4xl mobile:text-3xl mb-3">🔳</div>
        <p class="text-lg mobile:text-base font-semibold text-blue-400 mb-1.5">No events to display</p>
        <p class="text-base mobile:text-sm">Events will appear here as they are received</p>
      </div>
    </div>
    
    <!-- Matrix Mode View -->
    <div 
      v-if="matrixMode.isEnabled.value"
      class="flex-1 relative"
    >
      <MatrixRainCanvas
        :width="matrixCanvasWidth"
        :height="matrixCanvasHeight"
        :enabled="matrixMode.isEnabled.value"
        :config="matrixMode.config.value"
        @performance-update="handleMatrixPerformanceUpdate"
        @memory-update="handleMatrixMemoryUpdate"
        @quality-warning="handleMatrixQualityWarning"
        @error="handleMatrixError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { HookEvent } from '../types';
import EventRow from './EventRow.vue';
import { useEventColors } from '../composables/useEventColors';
import { useTimelineOrdering, timelineUtils } from '../composables/useTimelineOrdering';
import { timelineComponentUtils } from './timeline/index';
import TimelineDirectionHeader from './timeline/TimelineDirectionHeader.vue';
import EnhancedEventRow from './timeline/EnhancedEventRow.vue';
import MatrixRainCanvas from './MatrixRainCanvas.vue';
import { useMatrixMode } from '../composables/useMatrixMode';
import '../styles/timeline-transitions.css';

const props = defineProps<{
  events: HookEvent[];
  filters: {
    sourceApp: string;
    sessionId: string;
    eventType: string;
  };
  stickToBottom: boolean;
}>();

const emit = defineEmits<{
  'update:stickToBottom': [value: boolean];
}>();

const scrollContainer = ref<HTMLElement>();
const isOrderChanging = ref(false);
const matrixContainer = ref<HTMLElement>();

const { getGradientForSession, getColorForSession, getGradientForApp, getColorForApp, getHexColorForApp } = useEventColors();
const { 
  orderMode: currentOrder, 
  applyOrderingContext, 
  generateTimeRange, 
  setOrderMode, 
  scrollDirection 
} = useTimelineOrdering();

// Matrix Mode Integration
const matrixMode = useMatrixMode();
const lastProcessedEventId = ref<number>(0);

const filteredEvents = computed(() => {
  return props.events.filter(event => {
    if (props.filters.sourceApp && event.source_app !== props.filters.sourceApp) {
      return false;
    }
    if (props.filters.sessionId && event.session_id !== props.filters.sessionId) {
      return false;
    }
    if (props.filters.eventType && event.hook_event_type !== props.filters.eventType) {
      return false;
    }
    return true;
  });
});

const enhancedFilteredEvents = computed(() => {
  return applyOrderingContext(filteredEvents.value);
});

const timeRange = computed(() => {
  return generateTimeRange(filteredEvents.value);
});

const shouldUseGpuAcceleration = computed(() => {
  return timelineComponentUtils.shouldEnableAnimations() && filteredEvents.value.length > 10;
});

// Matrix Mode Computed Properties
const matrixCanvasWidth = computed(() => {
  if (typeof window !== 'undefined') {
    return Math.max(800, window.innerWidth - 32); // Account for padding
  }
  return 800;
});

const matrixCanvasHeight = computed(() => {
  if (typeof window !== 'undefined') {
    return Math.max(400, window.innerHeight - 200); // Account for header and padding
  }
  return 400;
});

const matrixModeAnnouncementText = computed(() => {
  if (matrixMode.isTransitioning.value) {
    return 'Matrix mode switching';
  }
  return matrixMode.isEnabled.value ? 'Matrix mode enabled' : 'Matrix mode disabled';
});

const scrollToTop = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0;
  }
};

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

const handleScroll = () => {
  if (!scrollContainer.value) return;
  
  const { scrollTop } = scrollContainer.value;
  const isAtTop = scrollTop < 50;
  
  if (isAtTop !== props.stickToBottom) {
    emit('update:stickToBottom', isAtTop);
  }
};

const handleOrderChange = async (newOrder: 'newest-first' | 'oldest-first') => {
  isOrderChanging.value = true;
  
  // Brief delay to allow UI transition animation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  setOrderMode(newOrder);
  
  await nextTick();
  
  // Auto-scroll to appropriate end based on new order
  if (scrollContainer.value) {
    if (newOrder === 'newest-first') {
      scrollContainer.value.scrollTop = 0;
    } else {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
  }
  
  // Reset animation state
  setTimeout(() => {
    isOrderChanging.value = false;
  }, 300);
};

// Matrix Mode Functions
const handleMatrixToggle = async () => {
  if (matrixMode.isTransitioning.value) return;
  
  try {
    await matrixMode.toggle();
  } catch (error) {
    console.error('Failed to toggle Matrix mode:', error);
    // Optionally emit error event or show user notification
  }
};

const handleMatrixPerformanceUpdate = (metrics: any) => {
  // Handle performance metrics if needed
  if (metrics.avgFrameRate < 30) {
    console.warn('Matrix mode performance degraded:', metrics);
  }
};

const handleMatrixMemoryUpdate = (metrics: any) => {
  // Handle memory metrics if needed
  if (metrics.memoryUsageMB > 100) {
    console.warn('Matrix mode memory usage high:', metrics);
  }
};

const handleMatrixQualityWarning = () => {
  console.warn('Matrix mode quality reduced due to performance');
};

const handleMatrixError = (error: Error) => {
  console.error('Matrix mode error:', error);
  // Fall back to normal mode on error
  if (matrixMode.isEnabled.value) {
    matrixMode.disable().catch(console.error);
  }
};

const processEventsForMatrix = (events: HookEvent[]) => {
  if (!matrixMode.isEnabled.value) return;
  
  // Process new events that haven't been processed yet
  const newEvents = events.filter(event => event.id > lastProcessedEventId.value);
  
  if (newEvents.length > 0) {
    // Batch process events for better performance
    if (newEvents.length > 10) {
      matrixMode.processEventBatch(newEvents);
    } else {
      newEvents.forEach(event => matrixMode.processEvent(event));
    }
    
    // Update last processed event ID
    lastProcessedEventId.value = Math.max(...newEvents.map(e => e.id));
  }
};

// Matrix mode event processing
watch(() => props.events, (newEvents) => {
  processEventsForMatrix(newEvents);
}, { deep: true });

watch(() => props.events.length, async () => {
  if (props.stickToBottom) {
    await nextTick();
    if (currentOrder.value === 'newest-first') {
      scrollToTop();
    } else {
      scrollToBottom();
    }
  }
});

watch(() => currentOrder.value, async (newOrder) => {
  // When order changes, ensure we maintain stick behavior properly
  if (props.stickToBottom) {
    await nextTick();
    if (newOrder === 'newest-first') {
      scrollToTop();
    } else {
      scrollToBottom();
    }
  }
});

watch(() => props.stickToBottom, (shouldStick) => {
  if (shouldStick) {
    scrollToTop();
  }
});
</script>

<style scoped>
/* Event transitions are now handled by timeline-transitions.css */
.event-enter-active {
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.event-leave-active {
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dynamic transitions based on timeline order */
.event-enter-from {
  opacity: 0;
  transform: translateY(var(--enter-direction, -20px)) scale(0.95);
}

.event-leave-to {
  opacity: 0;
  transform: translateY(var(--leave-direction, 20px)) scale(0.95);
}

/* Matrix Mode Toggle Styles */
.matrix-toggle {
  @apply flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
         transition-all duration-300 ease-in-out
         border border-transparent
         focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-800
         hover:scale-105 active:scale-95;
}

.matrix-toggle--disabled {
  @apply bg-gray-700 text-gray-300 border-gray-600
         hover:bg-gray-600 hover:text-gray-200 hover:border-gray-500;
}

.matrix-toggle--enabled {
  @apply bg-green-600 text-white border-green-500
         hover:bg-green-500 hover:border-green-400
         shadow-lg shadow-green-500/25;
}

.matrix-toggle--transitioning {
  @apply bg-yellow-600 text-white border-yellow-500
         opacity-75 cursor-not-allowed
         animate-pulse;
}

.matrix-toggle__icon {
  @apply text-lg leading-none;
}

.matrix-toggle__label {
  @apply text-xs font-semibold uppercase tracking-wide;
}

/* Matrix Mode Transition Effects */
.matrix-mode-transitioning {
  @apply transition-all duration-500 ease-in-out;
}

.matrix-mode-transitioning .matrix-toggle {
  @apply animate-pulse;
}

/* Screen Reader Only */
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
  clip: rect(0, 0, 0, 0);
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .matrix-toggle {
    @apply px-2 py-1.5 text-xs;
  }
  
  .matrix-toggle__icon {
    @apply text-base;
  }
  
  .matrix-toggle__label {
    @apply text-xs;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .matrix-toggle--disabled {
    @apply border-gray-400 text-gray-100;
  }
  
  .matrix-toggle--enabled {
    @apply border-green-300 bg-green-700;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .matrix-toggle {
    @apply transition-none;
  }
  
  .matrix-mode-transitioning {
    @apply transition-none;
  }
  
  .matrix-toggle--transitioning {
    @apply animate-none;
  }
}
</style>