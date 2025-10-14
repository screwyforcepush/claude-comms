<template>
  <teleport to="body">
    <div
      v-if="visible && tooltipData"
      class="timeline-tooltip fixed z-[9999] max-w-xs"
      :class="{ 'pointer-events-none': !visible }"
      :style="tooltipStyle"
      @mouseenter="onTooltipMouseEnter"
      @mouseleave="onTooltipMouseLeave"
    >
      <div class="bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-3 text-sm">
        <!-- Tooltip Arrow -->
        <div 
          class="absolute w-2 h-2 bg-gray-900 border-gray-600 transform rotate-45"
          :class="arrowClasses"
          :style="arrowStyle"
        ></div>

        <!-- Agent Tooltip -->
        <div v-if="tooltipData.type === 'agent'" class="space-y-2">
          <div class="flex items-center space-x-2">
            <div
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: tooltipData.data.color }"
            ></div>
            <img
              :src="getAgentIconPath(tooltipData.data.type)"
              :alt="getAgentIconAlt(tooltipData.data.type)"
              class="w-3 h-3"
            />
            <span class="text-white font-semibold">{{ tooltipData.data.name }}</span>
          </div>
          <div class="text-gray-400 text-xs">Type: {{ tooltipData.data.type }}</div>
          <div v-if="tooltipData.data.status" class="flex items-center space-x-1">
            <span class="text-gray-400 text-xs">Status:</span>
            <span 
              class="text-xs font-medium"
              :class="getStatusTextColor(tooltipData.data.status)"
            >
              {{ tooltipData.data.status }}
            </span>
          </div>
          <div v-if="tooltipData.data.duration" class="text-gray-400 text-xs">
            Duration: {{ formatDuration(tooltipData.data.duration) }}
          </div>
          <div class="text-gray-500 text-xs border-t border-gray-700 pt-2">
            Click to view details
          </div>
        </div>

        <!-- Message Tooltip -->
        <div v-else-if="tooltipData.type === 'message'" class="space-y-2">
          <div class="flex items-center space-x-2">
            <div class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span class="text-yellow-400 font-semibold text-xs">Message</span>
          </div>
          <div class="flex items-center space-x-2">
            <img
              v-if="tooltipData.data.agentType"
              :src="getAgentIconPath(tooltipData.data.agentType)"
              :alt="getAgentIconAlt(tooltipData.data.agentType)"
              class="w-3.5 h-3.5"
            />
            <span class="text-white font-medium">{{ tooltipData.data.sender }}</span>
          </div>
          <div class="text-gray-400 text-xs">
            {{ formatTimestamp(tooltipData.data.created_at) }}
          </div>
          <div v-if="tooltipData.data.preview" class="text-gray-300 text-xs">
            {{ tooltipData.data.preview }}
          </div>
          <div class="text-gray-500 text-xs border-t border-gray-700 pt-2">
            Click to view full message
          </div>
        </div>

        <!-- Batch Tooltip -->
        <div v-else-if="tooltipData.type === 'batch'" class="space-y-2">
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 bg-blue-400 rounded-full"></div>
            <span class="text-blue-400 font-semibold">Batch {{ tooltipData.data.batchNumber }}</span>
          </div>
          <div class="text-gray-400 text-xs">
            {{ tooltipData.data.agents.length }} agent{{ tooltipData.data.agents.length !== 1 ? 's' : '' }}
          </div>
          <div class="text-gray-400 text-xs">
            Spawned: {{ formatTimestamp(tooltipData.data.spawnTimestamp) }}
          </div>
          <div v-if="tooltipData.data.agents.length > 0" class="space-y-1">
            <div class="text-gray-500 text-xs">Agents:</div>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="agent in tooltipData.data.agents.slice(0, 3)"
                :key="agent.agentId"
                class="inline-flex items-center space-x-1 px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs"
              >
                <img
                  :src="getAgentIconPath(agent.type)"
                  :alt="getAgentIconAlt(agent.type)"
                  class="w-3 h-3 inline-block"
                />
                <span>{{ agent.name }}</span>
              </span>
              <span 
                v-if="tooltipData.data.agents.length > 3"
                class="inline-block px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs"
              >
                +{{ tooltipData.data.agents.length - 3 }}
              </span>
            </div>
          </div>
          <div class="text-gray-500 text-xs border-t border-gray-700 pt-2">
            Click to highlight batch
          </div>
        </div>

        <!-- Prompt Tooltip -->
        <div v-else-if="tooltipData.type === 'prompt'" class="space-y-2">
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 bg-pink-500 rounded-sm"></div>
            <span class="text-pink-400 font-semibold">User Prompt</span>
          </div>
          <div class="text-gray-400 text-xs">
            {{ formatTimestamp(tooltipData.data.timestamp) }}
          </div>
          <div v-if="tooltipData.data.content" class="text-gray-300 text-xs max-w-48">
            {{ truncateText(tooltipData.data.content, 100) }}
          </div>
          <div class="text-gray-500 text-xs border-t border-gray-700 pt-2">
            Click to view full prompt
          </div>
        </div>

        <!-- Generic Tooltip -->
        <div v-else class="space-y-2">
          <div class="text-white font-medium">{{ tooltipData.data.title || 'Timeline Element' }}</div>
          <div v-if="tooltipData.data.description" class="text-gray-400 text-xs">
            {{ tooltipData.data.description }}
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAgentIcon } from '../composables/useAgentIcon';

// Types
interface TooltipData {
  type: 'agent' | 'message' | 'batch' | 'prompt' | 'generic';
  data: any;
  position: { x: number; y: number };
}

// Agent Icon composable
const { getAgentIconPath, getAgentIconAlt } = useAgentIcon();

// Component Props
const props = defineProps<{
  visible: boolean;
  tooltipData: TooltipData | null;
}>();

// Component Events
const emit = defineEmits<{
  'tooltip-mouse-enter': [];
  'tooltip-mouse-leave': [];
}>();

// Computed styles
const tooltipStyle = computed(() => {
  if (!props.tooltipData) return {};

  const { x, y } = props.tooltipData.position;
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };

  // Calculate optimal position to avoid viewport edges with improved stability
  let left = x + 20;
  let top = y - 15;
  
  // Adjust if tooltip would go off-screen with better boundaries
  const tooltipWidth = 320; // max-w-xs approximation
  const tooltipHeight = 180; // estimated height
  const margin = 30; // increased margin for stability

  if (left + tooltipWidth > viewport.width - margin) {
    left = x - tooltipWidth - 20;
  }
  
  if (top + tooltipHeight > viewport.height - margin) {
    top = y - tooltipHeight + 15;
  }

  if (top < margin) {
    top = y + 30;
  }
  
  // Ensure tooltip doesn't go off left edge
  if (left < margin) {
    left = margin;
  }

  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: 'translateZ(0)', // Force hardware acceleration
  };
});

const arrowClasses = computed(() => {
  if (!props.tooltipData) return '';
  
  const { x } = props.tooltipData.position;
  const viewport = { width: window.innerWidth };
  const tooltipWidth = 320;
  
  // Determine arrow position based on tooltip placement
  if (x + tooltipWidth > viewport.width - 20) {
    return 'right-3 top-3 border-t border-l';
  }
  return 'left-3 top-3 border-b border-r';
});

const arrowStyle = computed(() => {
  if (!props.tooltipData) return {};
  
  const { x } = props.tooltipData.position;
  const viewport = { width: window.innerWidth };
  const tooltipWidth = 320;
  
  // Position arrow based on tooltip placement
  if (x + tooltipWidth > viewport.width - 20) {
    return {
      right: '-4px',
      top: '12px'
    };
  }
  return {
    left: '-4px',
    top: '12px'
  };
});

// Helper functions
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

const formatDuration = (duration: number): string => {
  if (duration < 1000) {
    return `${duration}ms`;
  }
  if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)}s`;
  }
  return `${(duration / 60000).toFixed(1)}min`;
};

const getStatusTextColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'text-green-400';
    case 'in_progress': return 'text-blue-400';
    case 'error': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Mouse event handlers for tooltip hover tolerance
const onTooltipMouseEnter = () => {
  emit('tooltip-mouse-enter');
};

const onTooltipMouseLeave = () => {
  emit('tooltip-mouse-leave');
};
</script>

<style scoped>
.timeline-tooltip {
  animation: tooltipFadeIn 0.15s ease-out;
  /* Add a small buffer zone around the tooltip for better hover stability */
  padding: 2px;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px) translateZ(0);
  }
  to {
    opacity: 1;
    transform: translateY(0) translateZ(0);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .timeline-tooltip .bg-gray-900 {
    background: #000;
    border-color: #fff;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .timeline-tooltip {
    animation: none;
  }
  
  .animate-pulse {
    animation: none;
  }
}
</style>