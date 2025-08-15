<template>
  <div class="timeline-flow-container">
    <!-- Timeline flow gradient indicator -->
    <div 
      class="timeline-flow-gradient"
      :class="orderClass"
      :aria-hidden="true"
    ></div>
    
    <!-- Event position marker -->
    <div 
      class="event-position-marker"
      :class="positionMarkerClass"
      :aria-label="positionAriaLabel"
      :title="positionTooltip"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  position: 'latest' | 'recent' | 'older' | 'oldest' | 'neutral';
  eventIndex: number;
  totalEvents: number;
  currentOrder: 'newest-first' | 'oldest-first';
}>();

const orderClass = computed(() => 
  props.currentOrder === 'newest-first' ? 'newest-first-flow' : 'oldest-first-flow'
);

const positionMarkerClass = computed(() => [
  props.position,
  {
    'marker-pulse': props.position === 'latest',
    'marker-dimmed': props.position === 'oldest'
  }
]);

const positionAriaLabel = computed(() => {
  const positionText = props.position === 'latest' ? 'Most recent' : 
                      props.position === 'recent' ? 'Recent' :
                      props.position === 'older' ? 'Older' : 
                      props.position === 'oldest' ? 'Oldest' : 'Standard';
  
  return `${positionText} event marker, position ${props.eventIndex + 1} of ${props.totalEvents}`;
});

const positionTooltip = computed(() => {
  const orderContext = props.currentOrder === 'newest-first' ? 'newest first' : 'oldest first';
  return `${props.position.charAt(0).toUpperCase() + props.position.slice(1)} event (${orderContext} order)`;
});
</script>

<style scoped>
.timeline-flow-container {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

/* Timeline flow gradient - shows chronological direction */
.timeline-flow-gradient {
  position: absolute;
  left: 6px;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 2px;
  transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

.timeline-flow-gradient.newest-first-flow {
  background: linear-gradient(
    to bottom,
    #3b82f6 0%,
    rgba(59, 130, 246, 0.8) 25%,
    rgba(59, 130, 246, 0.4) 75%,
    rgba(59, 130, 246, 0.1) 100%
  );
}

.timeline-flow-gradient.oldest-first-flow {
  background: linear-gradient(
    to bottom,
    rgba(59, 130, 246, 0.1) 0%,
    rgba(59, 130, 246, 0.4) 25%,
    rgba(59, 130, 246, 0.8) 75%,
    #3b82f6 100%
  );
}

/* Event position markers */
.event-position-marker {
  position: relative;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(17, 24, 39, 1);
  z-index: 10;
  transition: all 200ms ease;
  pointer-events: auto;
  cursor: help;
}

.event-position-marker.latest {
  background: #3b82f6;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
  transform: scale(1.1);
}

.event-position-marker.recent {
  background: #60a5fa;
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.4);
  transform: scale(1.05);
}

.event-position-marker.older {
  background: #9ca3af;
  box-shadow: 0 0 4px rgba(156, 163, 175, 0.3);
  transform: scale(0.95);
}

.event-position-marker.oldest {
  background: #6b7280;
  box-shadow: 0 0 4px rgba(107, 114, 128, 0.3);
  transform: scale(0.9);
}

.event-position-marker.neutral {
  background: #8b5cf6;
  box-shadow: 0 0 6px rgba(139, 92, 246, 0.3);
}

/* Pulse animation for latest events */
.event-position-marker.marker-pulse {
  animation: marker-pulse 2s ease-in-out infinite;
}

@keyframes marker-pulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
    transform: scale(1.1);
  }
  50% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.9);
    transform: scale(1.15);
  }
}

/* Dimmed state for oldest events */
.event-position-marker.marker-dimmed {
  opacity: 0.7;
}

/* Hover effects */
.event-position-marker:hover {
  transform: scale(1.2) !important;
  filter: brightness(1.2);
}

.event-position-marker:focus {
  outline: 2px solid #00d4ff;
  outline-offset: 2px;
}

/* Mobile responsive adjustments */
@media (max-width: 699px) {
  .timeline-flow-container {
    width: 12px;
  }
  
  .timeline-flow-gradient {
    left: 4px;
    width: 3px;
  }
  
  .event-position-marker {
    width: 12px;
    height: 12px;
    border-width: 1.5px;
  }
  
  .event-position-marker.latest {
    transform: scale(1.08);
  }
  
  .event-position-marker.recent {
    transform: scale(1.03);
  }
  
  .event-position-marker.older {
    transform: scale(0.97);
  }
  
  .event-position-marker.oldest {
    transform: scale(0.92);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .timeline-flow-gradient.newest-first-flow,
  .timeline-flow-gradient.oldest-first-flow {
    background: linear-gradient(to bottom, #ffffff 0%, #666666 100%);
  }
  
  .event-position-marker {
    border-color: #ffffff;
  }
  
  .event-position-marker.latest {
    background: #0066ff;
    box-shadow: none;
  }
  
  .event-position-marker.recent {
    background: #4080ff;
    box-shadow: none;
  }
  
  .event-position-marker.older {
    background: #808080;
    box-shadow: none;
  }
  
  .event-position-marker.oldest {
    background: #404040;
    box-shadow: none;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .event-position-marker.marker-pulse {
    animation: none;
  }
  
  .event-position-marker:hover {
    transform: none !important;
  }
  
  .timeline-flow-gradient,
  .event-position-marker {
    transition: none;
  }
}

/* Focus states for screen readers */
.event-position-marker:focus-visible {
  outline: 2px solid #00d4ff;
  outline-offset: 3px;
  background: #00d4ff !important;
}
</style>