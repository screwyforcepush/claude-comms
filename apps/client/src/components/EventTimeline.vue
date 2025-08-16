<template>
  <div class="flex-1 mobile:h-[50vh] overflow-hidden flex flex-col">
    <!-- Fixed Header -->
    <div class="px-3 py-4 mobile:py-2 bg-gradient-to-r from-gray-800 to-gray-700 relative z-10" style="box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.3), 0 8px 25px -5px rgba(0, 0, 0, 0.2);">
      <div class="flex items-center justify-center">
        <h2 class="text-2xl mobile:text-lg font-bold text-blue-400 drop-shadow-sm">
          Agent Event Stream
        </h2>
      </div>
    </div>
    
    <!-- Timeline Direction Header -->
    <TimelineDirectionHeader
      :current-order="currentOrder.value"
      :event-count="enhancedFilteredEvents.length"
      :time-range="timeRange"
      @order-changed="handleOrderChange"
    />
    
    <!-- Timeline View -->
    <div 
      data-testid="timeline-view"
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

const { getGradientForSession, getColorForSession, getGradientForApp, getColorForApp, getHexColorForApp } = useEventColors();
const { 
  orderMode: currentOrder, 
  applyOrderingContext, 
  generateTimeRange, 
  setOrderMode, 
  scrollDirection 
} = useTimelineOrdering();


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





</style>