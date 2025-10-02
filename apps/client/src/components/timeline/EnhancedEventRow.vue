<template>
  <div 
    class="enhanced-event-container"
    :class="[
      `position-${enhancedEvent.position}`,
      `order-${currentOrder}`,
      { 'timeline-gpu-accelerated': useGpuAcceleration }
    ]"
    :aria-setsize="totalEvents"
    :aria-posinset="enhancedEvent.eventIndex + 1"
  >
    <!-- Timeline Flow Indicators -->
    <TimelineFlowMarkers
      :position="enhancedEvent.position"
      :event-index="enhancedEvent.eventIndex"
      :total-events="totalEvents"
      :current-order="currentOrder"
    />
    
    <!-- Enhanced Event Row with Temporal Context -->
    <div class="event-content-wrapper">
      <!-- Original EventRow component -->
      <EventRow
        :event="enhancedEvent"
        :gradient-class="gradientClass"
        :color-class="colorClass"
        :app-gradient-class="appGradientClass"
        :app-color-class="appColorClass"
        :app-hex-color="appHexColor"
      />
      
      <!-- Temporal Context Overlay -->
      <div class="temporal-context-overlay">
        <TemporalContextBadge
          :timestamp="enhancedEvent.timestamp"
          :position="enhancedEvent.position"
          :total-events="totalEvents"
          :event-index="enhancedEvent.eventIndex"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EventRow from '../EventRow.vue';
import TimelineFlowMarkers from './TimelineFlowMarkers.vue';
import TemporalContextBadge from './TemporalContextBadge.vue';
import type { EnhancedEvent } from '../../composables/useTimelineOrdering';

const props = defineProps<{
  enhancedEvent: EnhancedEvent;
  gradientClass: string;
  colorClass: string;
  appGradientClass: string;
  appColorClass: string;
  appHexColor: string;
  currentOrder: 'newest-first' | 'oldest-first';
  totalEvents: number;
  useGpuAcceleration?: boolean;
}>();

// Helper computed for position-based styling
const positionWeightClass = computed(() => {
  switch (props.enhancedEvent.position) {
    case 'latest': return 'weight-strongest';
    case 'recent': return 'weight-strong';
    case 'older': return 'weight-medium';
    case 'oldest': return 'weight-light';
    default: return 'weight-neutral';
  }
});
</script>

<style scoped>
.enhanced-event-container {
  position: relative;
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}

.event-content-wrapper {
  position: relative;
  margin-left: 16px; /* Space for timeline flow markers */
}

.temporal-context-overlay {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 10;
  pointer-events: none;
}

/* Position-based visual hierarchy - Diablo Theme */
.enhanced-event-container.position-latest {
  filter: drop-shadow(0 0 12px rgba(217, 119, 6, 0.4));
}

.enhanced-event-container.position-latest .event-content-wrapper {
  border-left: 3px solid #d97706;
  padding-left: 8px;
}

.enhanced-event-container.position-recent {
  filter: drop-shadow(0 0 8px rgba(217, 119, 6, 0.2));
}

.enhanced-event-container.position-recent .event-content-wrapper {
  border-left: 2px solid #f59e0b;
  padding-left: 6px;
}

.enhanced-event-container.position-older {
  opacity: 0.9;
}

.enhanced-event-container.position-oldest {
  opacity: 0.8;
}

.enhanced-event-container.position-oldest .event-content-wrapper {
  border-left: 1px solid rgba(120, 113, 108, 0.3);
  padding-left: 4px;
}

/* Order-specific animations */
.enhanced-event-container.order-newest-first {
  --enter-direction: -20px;
  --leave-direction: 20px;
}

.enhanced-event-container.order-oldest-first {
  --enter-direction: 20px;
  --leave-direction: -20px;
}

/* Hover effects for enhanced interactivity */
.enhanced-event-container:hover {
  transform: translateY(-1px);
  z-index: 50;
}

.enhanced-event-container:hover .temporal-context-overlay {
  transform: scale(1.05);
}

/* Focus states for accessibility */
.enhanced-event-container:focus-within {
  outline: 2px solid #00d4ff;
  outline-offset: 2px;
  border-radius: 8px;
}

/* Mobile responsive adjustments */
@media (max-width: 699px) {
  .event-content-wrapper {
    margin-left: 12px;
  }
  
  .temporal-context-overlay {
    top: 6px;
    right: 8px;
  }
  
  .enhanced-event-container.position-latest .event-content-wrapper,
  .enhanced-event-container.position-recent .event-content-wrapper {
    padding-left: 4px;
  }
  
  .enhanced-event-container.position-oldest .event-content-wrapper {
    padding-left: 2px;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .enhanced-event-container.position-latest {
    filter: none;
    border: 2px solid #0066ff;
  }
  
  .enhanced-event-container.position-recent {
    filter: none;
    border: 1px solid #4080ff;
  }
  
  .enhanced-event-container.position-latest .event-content-wrapper,
  .enhanced-event-container.position-recent .event-content-wrapper {
    border-left-color: #ffffff;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .enhanced-event-container {
    transition: opacity 150ms ease;
  }
  
  .enhanced-event-container:hover {
    transform: none;
  }
  
  .enhanced-event-container:hover .temporal-context-overlay {
    transform: none;
  }
}

/* Print styles */
@media print {
  .enhanced-event-container {
    filter: none !important;
    transform: none !important;
    break-inside: avoid;
  }
  
  .temporal-context-overlay {
    position: static;
    margin-top: 4px;
  }
}

/* Dark mode enhancements */
@media (prefers-color-scheme: dark) {
  .enhanced-event-container.position-latest {
    filter: drop-shadow(0 0 16px rgba(59, 130, 246, 0.4));
  }
  
  .enhanced-event-container.position-recent {
    filter: drop-shadow(0 0 12px rgba(96, 165, 250, 0.3));
  }
}

/* Light mode adjustments */
@media (prefers-color-scheme: light) {
  .enhanced-event-container.position-latest {
    filter: drop-shadow(0 2px 8px rgba(59, 130, 246, 0.2));
  }
  
  .enhanced-event-container.position-recent {
    filter: drop-shadow(0 2px 6px rgba(96, 165, 250, 0.15));
  }
  
  .enhanced-event-container.position-oldest {
    opacity: 0.7;
  }
}
</style>