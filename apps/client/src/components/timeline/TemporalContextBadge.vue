<template>
  <div class="event-timestamp-indicator">
    <span 
      v-if="position !== 'neutral'"
      :class="badgeClasses"
      :aria-label="badgeAriaLabel"
    >
      {{ badgeText }}
    </span>
    
    <span class="relative-time-text" :title="absoluteTime">
      {{ relativeTime }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface TemporalPosition {
  position: 'latest' | 'recent' | 'older' | 'oldest' | 'neutral';
}

const props = defineProps<{
  timestamp: number;
  position: 'latest' | 'recent' | 'older' | 'oldest' | 'neutral';
  totalEvents: number;
  eventIndex: number;
}>();

const badgeText = computed(() => {
  switch (props.position) {
    case 'latest': return 'Latest';
    case 'recent': return 'Recent';
    case 'older': return 'Older';
    case 'oldest': return 'Oldest';
    default: return '';
  }
});

const badgeClasses = computed(() => [
  'temporal-context-badge',
  props.position,
  {
    'pulse-glow': props.position === 'latest'
  }
]);

const badgeAriaLabel = computed(() => 
  `${badgeText.value} event, ${props.eventIndex + 1} of ${props.totalEvents}`
);

const relativeTime = computed(() => {
  const now = Date.now();
  const eventTime = props.timestamp;
  const diffMs = now - eventTime;
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 5) return `${seconds}s ago`;
  return 'Just now';
});

const absoluteTime = computed(() => {
  const date = new Date(props.timestamp);
  return date.toLocaleString();
});
</script>

<style scoped>
.event-timestamp-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
}

.temporal-context-badge {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  user-select: none;
  line-height: 1.2;
  transition: all 200ms ease;
}

.temporal-context-badge.latest {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
}

.temporal-context-badge.latest.pulse-glow {
  animation: latest-glow 3s ease-in-out infinite;
}

.temporal-context-badge.recent {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  box-shadow: 0 0 6px rgba(96, 165, 250, 0.3);
}

.temporal-context-badge.older {
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
  opacity: 0.9;
}

.temporal-context-badge.oldest {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  opacity: 0.8;
}

.relative-time-text {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 500;
  font-family: 'SF Mono', 'Monaco', monospace;
  letter-spacing: 0.25px;
  user-select: none;
  white-space: nowrap;
}

/* Glow animation for latest events */
@keyframes latest-glow {
  0%, 100% { 
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
  }
  50% { 
    box-shadow: 0 0 16px rgba(59, 130, 246, 0.7);
  }
}

/* Hover effects */
.temporal-context-badge:hover {
  transform: scale(1.05);
  filter: brightness(1.1);
}

/* Mobile responsive adjustments */
@media (max-width: 699px) {
  .event-timestamp-indicator {
    gap: 4px;
  }
  
  .temporal-context-badge {
    padding: 1px 4px;
    font-size: 9px;
    letter-spacing: 0.25px;
  }
  
  .relative-time-text {
    font-size: 10px;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .temporal-context-badge.latest {
    background: #0066ff;
    box-shadow: none;
    border: 1px solid #ffffff;
  }
  
  .temporal-context-badge.recent {
    background: #4080ff;
    border: 1px solid #ffffff;
  }
  
  .temporal-context-badge.older {
    background: #666666;
    border: 1px solid #ffffff;
  }
  
  .temporal-context-badge.oldest {
    background: #333333;
    border: 1px solid #ffffff;
  }
  
  .relative-time-text {
    color: #ffffff;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .temporal-context-badge.latest.pulse-glow {
    animation: none;
  }
  
  .temporal-context-badge:hover {
    transform: none;
  }
}

/* Focus states for accessibility */
.temporal-context-badge:focus {
  outline: 2px solid #00d4ff;
  outline-offset: 2px;
}
</style>