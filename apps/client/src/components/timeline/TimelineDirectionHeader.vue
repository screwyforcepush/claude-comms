<template>
  <div class="timeline-direction-header">
    <div class="chronological-indicator">
      <span class="timeline-direction-arrow" :aria-label="ariaDirectionLabel">{{ directionArrow }}</span>
      <span class="direction-text">{{ directionLabel }}</span>
      <span class="relative-time-text">{{ timeContext }}</span>
    </div>
    
    <button 
      @click="toggleOrder"
      class="order-toggle-button"
      :title="toggleTooltip"
      :aria-label="toggleTooltip"
      type="button"
    >
      {{ toggleLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface TimelineOrder {
  order: 'newest-first' | 'oldest-first';
}

const props = defineProps<{
  currentOrder: 'newest-first' | 'oldest-first';
  eventCount: number;
  timeRange?: string;
}>();

const emit = defineEmits<{
  'order-changed': [order: 'newest-first' | 'oldest-first'];
}>();

const directionArrow = computed(() => 
  props.currentOrder === 'newest-first' ? '↓' : '↑'
);

const directionLabel = computed(() => 
  props.currentOrder === 'newest-first' 
    ? 'Latest events at top' 
    : 'Oldest events at top'
);

const ariaDirectionLabel = computed(() => 
  props.currentOrder === 'newest-first' 
    ? 'Timeline showing newest events first, arrow pointing down'
    : 'Timeline showing oldest events first, arrow pointing up'
);

const timeContext = computed(() => {
  const eventText = props.eventCount === 1 ? 'event' : 'events';
  const baseText = `${props.eventCount} ${eventText}`;
  return props.timeRange ? `${baseText} • ${props.timeRange}` : baseText;
});

const toggleLabel = computed(() => 
  props.currentOrder === 'newest-first' 
    ? 'Show Oldest First' 
    : 'Show Latest First'
);

const toggleTooltip = computed(() => 
  `Switch to ${props.currentOrder === 'newest-first' ? 'chronological' : 'reverse chronological'} order`
);

const toggleOrder = () => {
  const newOrder = props.currentOrder === 'newest-first' ? 'oldest-first' : 'newest-first';
  emit('order-changed', newOrder);
};
</script>

<style scoped>
.timeline-direction-header {
  position: sticky;
  top: 0;
  background: rgba(18, 8, 7, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 2px solid rgba(176, 30, 33, 0.45);
  padding: 12px 16px;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.55);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.chronological-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-accent-gold);
  letter-spacing: 0.08em;
}

.timeline-direction-arrow {
  font-size: 18px;
  color: var(--theme-accent-ember);
  text-shadow: 0 0 10px rgba(176, 30, 33, 0.4);
  animation: direction-pulse 2s ease-in-out infinite;
  user-select: none;
  line-height: 1;
}

.direction-text {
  font-family: system-ui, -apple-system, sans-serif;
  color: var(--theme-text-secondary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.relative-time-text {
  color: var(--theme-text-tertiary);
  font-size: 11px;
  font-weight: 500;
  font-family: 'SF Mono', 'Monaco', monospace;
  letter-spacing: 0.25px;
}

.order-toggle-button {
  background: linear-gradient(135deg, rgba(176, 30, 33, 0.65) 0%, rgba(208, 138, 63, 0.55) 100%);
  border: 1px solid rgba(208, 138, 63, 0.45);
  color: var(--theme-text-primary);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms ease;
  user-select: none;
  min-height: 32px;
  display: flex;
  align-items: center;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.order-toggle-button:hover {
  background: linear-gradient(135deg, rgba(176, 30, 33, 0.75) 0%, rgba(214, 168, 96, 0.65) 100%);
  border-color: rgba(214, 168, 96, 0.6);
  transform: scale(1.03);
  box-shadow: 0 0 12px rgba(214, 168, 96, 0.45);
}

.order-toggle-button:focus-visible {
  outline: 2px solid rgba(214, 168, 96, 0.65);
  outline-offset: 2px;
  box-shadow: 0 0 10px rgba(214, 168, 96, 0.5);
}

.order-toggle-button:active {
  transform: scale(0.98);
}

/* Animation for direction arrow pulse */
@keyframes direction-pulse {
  0%, 100% { 
    opacity: 0.8; 
    transform: translateY(0); 
  }
  50% { 
    opacity: 1; 
    transform: translateY(-2px); 
  }
}

/* Mobile responsive adjustments */
@media (max-width: 699px) {
  .timeline-direction-header {
    padding: 8px 12px;
  }
  
  .chronological-indicator {
    gap: 6px;
    font-size: 12px;
  }
  
  .timeline-direction-arrow {
    font-size: 16px;
  }
  
  .relative-time-text {
    font-size: 10px;
  }
  
  .order-toggle-button {
    padding: 4px 8px;
    font-size: 11px;
    min-height: 28px;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .timeline-direction-header {
    background: rgba(0, 0, 0, 0.95);
    border-bottom-color: #ffffff;
  }
  
  .chronological-indicator,
  .direction-text,
  .timeline-direction-arrow {
    color: #ffffff;
  }
  
  .order-toggle-button {
    border-color: #ffffff;
    color: #ffffff;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .timeline-direction-arrow {
    animation: none;
  }
  
  .order-toggle-button {
    transition: none;
  }
  
  .order-toggle-button:hover {
    transform: none;
  }
}
</style>
