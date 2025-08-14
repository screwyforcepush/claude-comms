<template>
  <teleport to="body">
    <div
      v-if="visible && detailData"
      class="detail-panel fixed z-[10000] max-w-lg bg-gray-900 border border-gray-600 rounded-lg shadow-2xl"
      :class="{ 'pointer-events-none': !visible }"
      :style="panelStyle"
      @mousedown.stop
      @click.stop
    >
      <!-- Panel Header with Close Button -->
      <div class="detail-header bg-gradient-to-r from-gray-800 to-gray-700 px-4 py-3 rounded-t-lg border-b border-gray-600">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div 
              class="w-4 h-4 rounded-full flex-shrink-0"
              :class="getHeaderIconClass()"
              :style="getHeaderIconStyle()"
            >
              <div v-if="detailData.type === 'message'" class="w-full h-full flex items-center justify-center">
                <svg class="w-2.5 h-2.5 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
              </div>
              <div v-else-if="detailData.type === 'agent'" class="w-full h-full flex items-center justify-center">
                <div class="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>
            <div>
              <h3 class="text-white font-semibold text-sm">{{ getHeaderTitle() }}</h3>
              <p class="text-gray-400 text-xs">{{ getHeaderSubtitle() }}</p>
            </div>
          </div>
          <button
            @click="closePanel"
            class="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
            title="Close (Esc)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Panel Content -->
      <div class="detail-content p-4 max-h-96 overflow-y-auto">
        <!-- Agent Details -->
        <div v-if="detailData.type === 'agent'" class="space-y-4">
          <!-- Agent Status and Metrics -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-3">
              <div>
                <label class="text-gray-500 text-xs uppercase tracking-wide">Status</label>
                <div class="flex items-center space-x-2 mt-1">
                  <div 
                    class="w-3 h-3 rounded-full"
                    :class="getAgentStatusClass(detailData.data.status)"
                  ></div>
                  <span 
                    class="font-medium text-sm"
                    :class="getStatusTextColor(detailData.data.status)"
                  >
                    {{ capitalizeStatus(detailData.data.status) }}
                  </span>
                </div>
              </div>
              
              <div>
                <label class="text-gray-500 text-xs uppercase tracking-wide">Type</label>
                <div class="mt-1">
                  <span 
                    class="inline-block px-2 py-1 rounded text-xs font-medium"
                    :style="{ 
                      backgroundColor: `${detailData.data.color}20`, 
                      color: detailData.data.color,
                      border: `1px solid ${detailData.data.color}40`
                    }"
                  >
                    {{ capitalizeType(detailData.data.type) }}
                  </span>
                </div>
              </div>
            </div>
            
            <div class="space-y-3">
              <div>
                <label class="text-gray-500 text-xs uppercase tracking-wide">Duration</label>
                <div class="text-white font-medium text-sm mt-1">
                  {{ formatDuration(detailData.data.duration) }}
                </div>
              </div>
              
              <div>
                <label class="text-gray-500 text-xs uppercase tracking-wide">Session</label>
                <div class="text-white font-medium text-sm mt-1 truncate">
                  {{ detailData.data.sessionName || 'Unknown Session' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Timeline Information -->
          <div class="bg-gray-800/50 rounded-lg p-3">
            <h4 class="text-white font-medium text-sm mb-3">Timeline Information</h4>
            <div class="space-y-2 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-400">Started:</span>
                <span class="text-white">{{ formatTimestamp(detailData.data.startTime) }}</span>
              </div>
              <div v-if="detailData.data.endTime" class="flex justify-between">
                <span class="text-gray-400">Ended:</span>
                <span class="text-white">{{ formatTimestamp(detailData.data.endTime) }}</span>
              </div>
              <div v-else class="flex justify-between">
                <span class="text-gray-400">Running for:</span>
                <span class="text-blue-400">{{ formatDuration(Date.now() - detailData.data.startTime) }}</span>
              </div>
              <div v-if="detailData.data.batchNumber" class="flex justify-between">
                <span class="text-gray-400">Batch:</span>
                <span class="text-white">#{{ detailData.data.batchNumber }}</span>
              </div>
            </div>
          </div>

          <!-- Progress Bar for Active Agents -->
          <div v-if="detailData.data.status === 'in_progress'" class="bg-gray-800/50 rounded-lg p-3">
            <h4 class="text-white font-medium text-sm mb-3">Progress</h4>
            <div class="space-y-2">
              <div class="flex justify-between text-xs">
                <span class="text-gray-400">Estimated completion</span>
                <span class="text-blue-400">{{ getEstimatedCompletion() }}</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2">
                <div 
                  class="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  :style="{ width: `${getProgressPercentage()}%` }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Agent Messages -->
          <div v-if="detailData.data.messageCount > 0" class="bg-gray-800/50 rounded-lg p-3">
            <h4 class="text-white font-medium text-sm mb-3">Communication</h4>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="text-center p-2 bg-blue-600/20 rounded">
                <div class="text-blue-400 font-semibold">{{ detailData.data.messageCount }}</div>
                <div class="text-gray-400">Messages</div>
              </div>
              <div class="text-center p-2 bg-green-600/20 rounded">
                <div class="text-green-400 font-semibold">{{ detailData.data.responsesCount || 0 }}</div>
                <div class="text-gray-400">Responses</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Message Details -->
        <div v-else-if="detailData.type === 'message'" class="space-y-4">
          <!-- Message Header Info -->
          <div class="bg-gray-800/50 rounded-lg p-3">
            <h4 class="text-white font-medium text-sm mb-3">Message Details</h4>
            <div class="space-y-2 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-400">From:</span>
                <span class="text-white font-medium">{{ detailData.data.sender }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Timestamp:</span>
                <span class="text-white">{{ formatTimestamp(detailData.data.timestamp) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Session:</span>
                <span class="text-white font-medium truncate">{{ detailData.data.sessionName || 'Unknown Session' }}</span>
              </div>
              <div v-if="detailData.data.readStatus" class="flex justify-between">
                <span class="text-gray-400">Read Status:</span>
                <span 
                  class="font-medium"
                  :class="getMessageReadStatusColor(detailData.data.readStatus)"
                >
                  {{ getMessageReadStatusText(detailData.data.readStatus) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Recipients -->
          <div v-if="detailData.data.recipients && detailData.data.recipients.length > 0" class="bg-gray-800/50 rounded-lg p-3">
            <h4 class="text-white font-medium text-sm mb-3">Recipients</h4>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="recipient in detailData.data.recipients"
                :key="recipient"
                class="inline-block px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs"
              >
                {{ recipient }}
              </span>
            </div>
          </div>

          <!-- Message Content -->
          <div class="bg-gray-800/50 rounded-lg p-3">
            <h4 class="text-white font-medium text-sm mb-3">Content</h4>
            <div class="bg-gray-900/50 rounded p-3 max-h-48 overflow-y-auto">
              <pre class="text-gray-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">{{ detailData.data.content }}</pre>
            </div>
          </div>

          <!-- Message Metadata -->
          <div v-if="detailData.data.metadata" class="bg-gray-800/50 rounded-lg p-3">
            <h4 class="text-white font-medium text-sm mb-3">Metadata</h4>
            <div class="bg-gray-900/50 rounded p-3 max-h-32 overflow-y-auto">
              <pre class="text-gray-400 text-xs whitespace-pre-wrap font-mono">{{ JSON.stringify(detailData.data.metadata, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel Footer -->
      <div class="detail-footer bg-gray-800 px-4 py-2 rounded-b-lg border-t border-gray-600">
        <div class="flex items-center justify-between text-xs">
          <div class="text-gray-500">
            {{ detailData.type === 'agent' ? 'Agent Details' : 'Message Details' }}
          </div>
          <div class="flex items-center space-x-3">
            <span class="text-gray-500">Press</span>
            <kbd class="px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">Esc</kbd>
            <span class="text-gray-500">to close</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Backdrop -->
    <div
      v-if="visible"
      class="fixed inset-0 z-[9999] bg-black/20 backdrop-blur-sm"
      @click="closePanel"
    ></div>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Types
interface DetailData {
  type: 'agent' | 'message';
  data: any;
  position: { x: number; y: number };
}

// Component Props
const props = defineProps<{
  visible: boolean;
  detailData: DetailData | null;
}>();

// Component Events
const emit = defineEmits<{
  'close': [];
}>();

// Computed styles for panel positioning
const panelStyle = computed(() => {
  if (!props.detailData) return {};

  const { x, y } = props.detailData.position;
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };

  // Calculate optimal position
  const panelWidth = 512; // max-w-lg approximation (32rem = 512px)
  const panelHeight = 400; // estimated height
  const margin = 20;

  let left = x + 20;
  let top = y - 50;

  // Adjust horizontal position
  if (left + panelWidth > viewport.width - margin) {
    left = x - panelWidth - 20;
  }
  if (left < margin) {
    left = margin;
  }

  // Adjust vertical position
  if (top + panelHeight > viewport.height - margin) {
    top = viewport.height - panelHeight - margin;
  }
  if (top < margin) {
    top = margin;
  }

  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: 'translateZ(0)',
  };
});

// Helper functions
const closePanel = () => {
  emit('close');
};

const getHeaderTitle = (): string => {
  if (!props.detailData) return '';
  
  if (props.detailData.type === 'agent') {
    return props.detailData.data.name || 'Unknown Agent';
  } else if (props.detailData.type === 'message') {
    return `Message from ${props.detailData.data.sender}`;
  }
  return 'Detail Panel';
};

const getHeaderSubtitle = (): string => {
  if (!props.detailData) return '';
  
  if (props.detailData.type === 'agent') {
    return `${capitalizeType(props.detailData.data.type)} • ${capitalizeStatus(props.detailData.data.status)}`;
  } else if (props.detailData.type === 'message') {
    return formatTimestamp(props.detailData.data.timestamp);
  }
  return '';
};

const getHeaderIconClass = (): string => {
  if (!props.detailData) return '';
  
  if (props.detailData.type === 'agent') {
    const status = props.detailData.data.status;
    if (status === 'in_progress') return 'animate-pulse';
  } else if (props.detailData.type === 'message') {
    return 'bg-yellow-400';
  }
  return '';
};

const getHeaderIconStyle = () => {
  if (!props.detailData) return {};
  
  if (props.detailData.type === 'agent') {
    return { backgroundColor: props.detailData.data.color };
  }
  return {};
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString([], { 
    month: 'short',
    day: 'numeric',
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

const capitalizeStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
};

const capitalizeType = (type: string): string => {
  return type.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const getStatusTextColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'text-green-400';
    case 'in_progress': return 'text-blue-400';
    case 'failed':
    case 'error': return 'text-red-400';
    case 'pending': return 'text-yellow-400';
    default: return 'text-gray-400';
  }
};

const getAgentStatusClass = (status: string): string => {
  const baseClass = '';
  if (status === 'in_progress') {
    return baseClass + ' animate-pulse';
  }
  return baseClass;
};

const getProgressPercentage = (): number => {
  if (!props.detailData || props.detailData.type !== 'agent') return 0;
  
  const duration = Date.now() - props.detailData.data.startTime;
  const minutes = Math.floor(duration / 60000);
  
  // Simple progress estimation
  return Math.min(Math.max(minutes * 15, 10), 90);
};

const getEstimatedCompletion = (): string => {
  const progress = getProgressPercentage();
  if (progress < 30) return '3-5 minutes';
  if (progress < 60) return '1-2 minutes';
  return 'Soon';
};

const getMessageReadStatusColor = (readStatus: any): string => {
  if (!readStatus) return 'text-gray-400';
  
  const { readCount, totalRecipients } = readStatus;
  if (readCount === 0) return 'text-orange-400';
  if (readCount < totalRecipients) return 'text-yellow-400';
  return 'text-green-400';
};

const getMessageReadStatusText = (readStatus: any): string => {
  if (!readStatus) return 'Unknown';
  
  const { readCount, totalRecipients } = readStatus;
  if (readCount === 0) return 'Unread';
  if (readCount < totalRecipients) return `${readCount}/${totalRecipients} read`;
  return 'All read';
};
</script>

<style scoped>
.detail-panel {
  animation: panelSlideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(8px);
}

@keyframes panelSlideIn {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.95) translateZ(0);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1) translateZ(0);
  }
}

.detail-content {
  scrollbar-width: thin;
  scrollbar-color: #4b5563 #374151;
}

.detail-content::-webkit-scrollbar {
  width: 6px;
}

.detail-content::-webkit-scrollbar-track {
  background: #374151;
  border-radius: 3px;
}

.detail-content::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 3px;
}

.detail-content::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
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
  .detail-panel {
    background: #000;
    border-color: #fff;
  }
  
  .detail-header {
    background: #000;
    border-color: #fff;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .detail-panel {
    animation: none;
  }
  
  .animate-pulse {
    animation: none;
  }
  
  .transition-all {
    transition: none;
  }
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .detail-panel {
    max-width: calc(100vw - 2rem);
    margin: 1rem;
  }
  
  .grid-cols-2 {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>