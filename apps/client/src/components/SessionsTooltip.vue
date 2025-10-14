<template>
  <teleport to="body">
    <div
      v-if="visible && tooltipData"
      class="sessions-tooltip fixed z-[9999] max-w-sm"
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

        <!-- Enhanced Session Tooltip -->
        <div v-if="tooltipData.type === 'session'" class="space-y-3">
          <!-- Session Header -->
          <div class="flex items-center space-x-3">
            <div class="relative">
              <div 
                class="w-4 h-4 rounded-full transition-all duration-200"
                :class="getSessionStatusPulseClass(tooltipData.data.status)"
                :style="{ backgroundColor: getSessionStatusColor(tooltipData.data.status) }"
              ></div>
              <div v-if="tooltipData.data.status === 'active'" 
                   class="absolute inset-0 w-4 h-4 rounded-full animate-ping"
                   :style="{ backgroundColor: getSessionStatusColor(tooltipData.data.status) }"
                   style="opacity: 0.3"></div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-white font-semibold text-sm truncate">{{ tooltipData.data.displayName }}</div>
              <div class="text-gray-400 text-xs font-mono">{{ truncateSessionId(tooltipData.data.sessionId) }}</div>
            </div>
          </div>
          
          <!-- Status and Duration -->
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="space-y-1">
              <div class="flex items-center space-x-1">
                <span class="text-gray-500">Status:</span>
                <span class="font-medium" :class="getStatusTextColor(tooltipData.data.status)">
                  {{ capitalizeStatus(tooltipData.data.status) }}
                </span>
              </div>
              <div class="text-gray-400">
                {{ getSessionDurationText(tooltipData.data) }}
              </div>
            </div>
            <div class="space-y-1">
              <div class="text-gray-400">
                Started: {{ formatTimeAgo(tooltipData.data.startTime) }}
              </div>
              <div v-if="tooltipData.data.endTime" class="text-gray-400">
                Ended: {{ formatTimeAgo(tooltipData.data.endTime) }}
              </div>
            </div>
          </div>
          
          <!-- Metrics Cards -->
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-blue-600/20 rounded p-2 text-center">
              <div class="text-blue-400 font-semibold">{{ tooltipData.data.agents?.length || 0 }}</div>
              <div class="text-gray-400 text-xs">Agents</div>
            </div>
            <div class="bg-yellow-600/20 rounded p-2 text-center">
              <div class="text-yellow-400 font-semibold">{{ tooltipData.data.messages?.length || 0 }}</div>
              <div class="text-gray-400 text-xs">Messages</div>
            </div>
            <div class="bg-green-600/20 rounded p-2 text-center">
              <div class="text-green-400 font-semibold">{{ getCompletionRate(tooltipData.data) }}%</div>
              <div class="text-gray-400 text-xs">Complete</div>
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div class="flex items-center justify-between text-xs border-t border-gray-700 pt-2">
            <span class="text-gray-500">Click to select • Double-click to expand</span>
            <div class="flex items-center space-x-1">
              <kbd class="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">Esc</kbd>
              <span class="text-gray-500">clear</span>
            </div>
          </div>
        </div>

        <!-- Enhanced Agent Tooltip -->
        <div v-else-if="tooltipData.type === 'agent'" class="space-y-3">
          <!-- Agent Header -->
          <div class="flex items-center space-x-3">
            <div class="relative">
              <div 
                class="w-4 h-4 rounded-full border-2 border-white/20 transition-all duration-200"
                :class="getAgentStatusPulseClass(tooltipData.data.agent.status)"
                :style="{ backgroundColor: tooltipData.data.color }"
              ></div>
              <div v-if="tooltipData.data.agent.status === 'in_progress'" 
                   class="absolute inset-0 w-4 h-4 rounded-full animate-ping border-2 border-white/10"
                   :style="{ backgroundColor: tooltipData.data.color }"
                   style="opacity: 0.4"></div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2 text-white font-semibold text-sm">
                <img
                  :src="getAgentIconPath(tooltipData.data.agent.type)"
                  :alt="getAgentIconAlt(tooltipData.data.agent.type)"
                  class="w-3.5 h-3.5"
                />
                <span>{{ tooltipData.data.agent.name }}</span>
              </div>
              <div class="text-gray-400 text-xs">
                <span class="inline-block px-2 py-0.5 bg-gray-700/50 rounded text-xs">
                  {{ capitalizeType(tooltipData.data.agent.type) }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Agent Metrics -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500">Status</span>
                <span class="font-medium" :class="getStatusTextColor(tooltipData.data.agent.status)">
                  {{ capitalizeStatus(tooltipData.data.agent.status) }}
                </span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500">Duration</span>
                <span class="text-white">
                  {{ getAgentDurationText(tooltipData.data.agent) }}
                </span>
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-xs">
                <div class="text-gray-500">Session</div>
                <div class="text-white font-medium truncate">{{ tooltipData.data.session.displayName }}</div>
              </div>
              <div class="text-xs">
                <div class="text-gray-500">Started</div>
                <div class="text-gray-400">{{ formatTimeAgo(tooltipData.data.agent.startTime) }}</div>
              </div>
            </div>
          </div>
          
          <!-- Progress Bar (for active agents) -->
          <div v-if="tooltipData.data.agent.status === 'in_progress'" class="space-y-1">
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500">Progress</span>
              <span class="text-gray-400">{{ getAgentProgressText(tooltipData.data.agent) }}</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-1.5">
              <div class="bg-blue-500 h-1.5 rounded-full progress-bar" 
                   :style="{ width: getAgentProgress(tooltipData.data.agent) + '%' }"></div>
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div class="text-xs border-t border-gray-700 pt-2 text-gray-500">
            Click to select agent in timeline
          </div>
        </div>

        <!-- Enhanced Message Tooltip -->
        <div v-else-if="tooltipData.type === 'message'" class="space-y-3">
          <!-- Message Header -->
          <div class="flex items-center space-x-3">
            <div class="relative">
              <div class="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                <svg class="w-2.5 h-2.5 text-yellow-900" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
              </div>
              <div class="absolute inset-0 w-4 h-4 rounded-full animate-ping bg-yellow-400 opacity-30"></div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-white font-semibold text-sm">{{ tooltipData.data.message.sender }}</div>
              <div class="text-yellow-400 text-xs">Inter-agent message</div>
            </div>
          </div>
          
          <!-- Message Details -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500">Session</span>
              <span class="text-white font-medium truncate ml-2">{{ tooltipData.data.session.displayName }}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500">Time</span>
              <span class="text-gray-400">{{ formatTimeAgo(tooltipData.data.message.timestamp) }}</span>
            </div>
            <div v-if="tooltipData.data.message.recipients" class="flex items-start justify-between text-xs">
              <span class="text-gray-500 mt-0.5">To</span>
              <div class="text-right ml-2">
                <div v-for="recipient in tooltipData.data.message.recipients.slice(0, 3)" 
                     :key="recipient" class="text-white">
                  {{ recipient }}
                </div>
                <div v-if="tooltipData.data.message.recipients.length > 3" class="text-gray-400">
                  +{{ tooltipData.data.message.recipients.length - 3 }} more
                </div>
              </div>
            </div>
          </div>
          
          <!-- Message Preview -->
          <div v-if="tooltipData.data.preview" class="bg-gray-800/50 rounded p-2 border-l-2 border-yellow-400">
            <div class="text-gray-300 text-xs leading-relaxed">{{ tooltipData.data.preview }}</div>
            <div v-if="tooltipData.data.message.content.length > 50" class="text-gray-500 text-xs mt-1">
              {{ tooltipData.data.message.content.length - 50 }} more characters...
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div class="text-xs border-t border-gray-700 pt-2 text-gray-500">
            Click to view full message content
          </div>
        </div>

        <!-- Time Window Tooltip -->
        <div v-else-if="tooltipData.type === 'timewindow'" class="space-y-2">
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 bg-green-400 rounded-full"></div>
            <span class="text-green-400 font-semibold">Time Window</span>
          </div>
          <div class="text-gray-400 text-xs">
            Duration: {{ tooltipData.data.duration }}
          </div>
          <div class="text-gray-400 text-xs">
            From: {{ formatTimestamp(tooltipData.data.start) }}
          </div>
          <div class="text-gray-400 text-xs">
            To: {{ formatTimestamp(tooltipData.data.end) }}
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="text-gray-400">
              <span class="text-blue-400">{{ tooltipData.data.sessionCount }}</span> sessions
            </div>
            <div class="text-gray-400">
              <span class="text-green-400">{{ tooltipData.data.agentCount }}</span> agents
            </div>
          </div>
        </div>

        <!-- Generic Tooltip -->
        <div v-else class="space-y-2">
          <div class="text-white font-medium">{{ tooltipData.data.title || 'Sessions Timeline Element' }}</div>
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

// Types for multi-session tooltip data
interface SessionsTooltipData {
  type: 'session' | 'agent' | 'message' | 'timewindow' | 'generic';
  data: any;
  position: { x: number; y: number };
}

// Agent Icon composable
const { getAgentIconPath, getAgentIconAlt } = useAgentIcon();

// Component Props
const props = defineProps<{
  visible: boolean;
  tooltipData: SessionsTooltipData | null;
}>();

// Component Events
const emit = defineEmits<{
  'tooltip-mouse-enter': [];
  'tooltip-mouse-leave': [];
}>();

// Computed styles for tooltip positioning
const tooltipStyle = computed(() => {
  if (!props.tooltipData) return {};

  const { x, y } = props.tooltipData.position;
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };

  // Calculate optimal position to avoid viewport edges
  let left = x + 20;
  let top = y - 15;
  
  // Adjust if tooltip would go off-screen
  const tooltipWidth = 384; // max-w-sm approximation (24rem = 384px)
  const tooltipHeight = 220; // estimated height for sessions data
  const margin = 30;

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
  const tooltipWidth = 384;
  
  // Determine arrow position based on tooltip placement
  if (x + tooltipWidth > viewport.width - 30) {
    return 'right-3 top-3 border-t border-l';
  }
  return 'left-3 top-3 border-b border-r';
});

const arrowStyle = computed(() => {
  if (!props.tooltipData) return {};
  
  const { x } = props.tooltipData.position;
  const viewport = { width: window.innerWidth };
  const tooltipWidth = 384;
  
  // Position arrow based on tooltip placement
  if (x + tooltipWidth > viewport.width - 30) {
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
  if (duration < 3600000) {
    return `${(duration / 60000).toFixed(1)}min`;
  }
  return `${(duration / 3600000).toFixed(1)}hr`;
};

const getStatusTextColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'text-green-400';
    case 'active':
    case 'in_progress': return 'text-blue-400';
    case 'failed':
    case 'error': return 'text-red-400';
    case 'pending': return 'text-yellow-400';
    default: return 'text-gray-400';
  }
};

const getSessionStatusColor = (status: string): string => {
  switch (status) {
    case 'active': return '#22c55e';
    case 'completed': return '#6b7280';
    case 'failed': return '#ef4444';
    default: return '#9ca3af';
  }
};

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Enhanced helper functions
const truncateSessionId = (sessionId: string): string => {
  if (sessionId.length <= 12) return sessionId;
  return sessionId.substring(0, 8) + '...';
};

const capitalizeStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
};

const capitalizeType = (type: string): string => {
  return type.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

const getSessionDurationText = (session: any): string => {
  if (!session.endTime) {
    const duration = Date.now() - session.startTime;
    return `Running ${formatDuration(duration)}`;
  }
  const duration = session.endTime - session.startTime;
  return `Completed in ${formatDuration(duration)}`;
};

const getAgentDurationText = (agent: any): string => {
  if (!agent.endTime) {
    const duration = Date.now() - agent.startTime;
    return formatDuration(duration);
  }
  const duration = agent.endTime - agent.startTime;
  return formatDuration(duration);
};

const getCompletionRate = (session: any): number => {
  if (!session.agents || session.agents.length === 0) return 0;
  const completed = session.agents.filter((agent: any) => 
    agent.status === 'completed'
  ).length;
  return Math.round((completed / session.agents.length) * 100);
};

const getAgentProgressText = (agent: any): string => {
  const duration = Date.now() - agent.startTime;
  const minutes = Math.floor(duration / 60000);
  if (minutes < 1) return 'Starting...';
  if (minutes < 5) return 'In progress';
  return `${minutes}m active`;
};

const getAgentProgress = (agent: any): number => {
  // Simple progress estimation based on duration and status
  const duration = Date.now() - agent.startTime;
  const minutes = Math.floor(duration / 60000);
  
  if (agent.status === 'completed') return 100;
  if (agent.status === 'error' || agent.status === 'failed') return 0;
  if (agent.status === 'pending') return 0;
  
  // Estimate progress for in_progress agents
  return Math.min(Math.max(minutes * 10, 15), 85);
};

const getSessionStatusPulseClass = (status: string): string => {
  const classes = [];
  if (status === 'active') {
    classes.push('animate-pulse');
  }
  if (status === 'failed') {
    classes.push('opacity-70');
  }
  return classes.join(' ');
};

const getAgentStatusPulseClass = (status: string): string => {
  const classes = [];
  if (status === 'in_progress' || status === 'active') {
    classes.push('animate-pulse');
  }
  if (status === 'error' || status === 'failed') {
    classes.push('opacity-70');
  }
  return classes.join(' ');
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
.sessions-tooltip {
  animation: tooltipFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  /* Add a small buffer zone around the tooltip for better hover stability */
  padding: 2px;
  backdrop-filter: blur(8px);
}

.sessions-tooltip .bg-gray-900 {
  background: rgba(17, 24, 39, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(75, 85, 99, 0.3);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95) translateZ(0);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1) translateZ(0);
  }
}

@keyframes progressBar {
  0% {
    width: 0%;
  }
}

.progress-bar {
  animation: progressBar 0.8s ease-out;
  transition: width 0.3s ease;
}

/* Enhanced grid layouts */
.grid-cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.grid-cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* Metric cards styling */
.sessions-tooltip .bg-blue-600\/20,
.sessions-tooltip .bg-yellow-600\/20,
.sessions-tooltip .bg-green-600\/20 {
  transition: all 0.2s ease;
}

.sessions-tooltip .bg-blue-600\/20:hover {
  background: rgba(37, 99, 235, 0.3);
}

.sessions-tooltip .bg-yellow-600\/20:hover {
  background: rgba(217, 119, 6, 0.3);
}

.sessions-tooltip .bg-green-600\/20:hover {
  background: rgba(22, 163, 74, 0.3);
}

/* Keyboard shortcut styling */
kbd {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', monospace;
  font-size: 0.75rem;
  line-height: 1;
  border: 1px solid rgba(75, 85, 99, 0.5);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .sessions-tooltip .bg-gray-900 {
    background: #000;
    border-color: #fff;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .sessions-tooltip {
    animation: none;
  }
  
  .animate-pulse {
    animation: none;
  }
}

/* Enhanced mobile responsiveness */
@media (max-width: 640px) {
  .sessions-tooltip {
    max-width: 18rem;
    font-size: 0.875rem;
  }
  
  .sessions-tooltip .grid-cols-3 {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
  
  .sessions-tooltip .grid-cols-2 {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
}

@media (max-width: 480px) {
  .sessions-tooltip {
    max-width: 16rem;
  }
}
</style>