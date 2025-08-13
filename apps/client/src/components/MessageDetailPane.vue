<template>
  <div 
    v-if="visible" 
    class="message-detail-pane fixed right-0 top-0 h-full w-96 bg-gray-800 border-l border-gray-600 shadow-2xl transform transition-transform duration-300 ease-out z-50"
    :class="{ 'translate-x-full': !visible }"
  >
    <!-- Header -->
    <div class="flex items-center justify-between bg-gradient-to-r from-gray-700 to-gray-600 px-4 py-3 border-b border-gray-600">
      <h3 class="text-white font-bold text-lg">Message Details</h3>
      <button
        @click="close"
        class="text-gray-400 hover:text-white transition-colors p-1 rounded"
        aria-label="Close message details"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div v-if="selectedMessage" class="p-4 overflow-y-auto h-full">
      <!-- Message Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-blue-400 font-semibold text-lg">{{ selectedMessage.sender }}</span>
          <span class="text-gray-400 text-sm">
            {{ formatTimestamp(selectedMessage.created_at) }}
          </span>
        </div>
        
        <!-- Message Type Badge -->
        <div class="mb-3" v-if="getMessageType(selectedMessage)">
          <span 
            class="inline-block px-3 py-1 rounded-full text-xs font-medium"
            :class="getMessageTypeClass(getMessageType(selectedMessage))"
          >
            {{ getMessageTypeLabel(getMessageType(selectedMessage)) }}
          </span>
        </div>
      </div>

      <!-- Message Content -->
      <div class="mb-6">
        <h4 class="text-white font-semibold mb-3">Content</h4>
        <div class="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <pre class="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">{{ formatMessageContent(selectedMessage.message) }}</pre>
        </div>
      </div>

      <!-- Recipients -->
      <div v-if="getMessageRecipients(selectedMessage).length > 0" class="mb-6">
        <h4 class="text-white font-semibold mb-3">Recipients</h4>
        <div class="flex flex-wrap gap-2">
          <span 
            v-for="recipient in getMessageRecipients(selectedMessage)" 
            :key="recipient"
            class="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm"
          >
            {{ recipient }}
          </span>
        </div>
      </div>

      <!-- Read Status -->
      <div v-if="selectedMessage.notified && selectedMessage.notified.length > 0" class="mb-6">
        <h4 class="text-white font-semibold mb-3">Read by</h4>
        <div class="space-y-2">
          <div 
            v-for="reader in selectedMessage.notified" 
            :key="reader"
            class="flex items-center justify-between bg-gray-700 rounded-lg p-2"
          >
            <span class="text-gray-300">{{ reader }}</span>
            <span class="text-green-400 text-xs">✓ Read</span>
          </div>
        </div>
      </div>

      <!-- Related Agents -->
      <div v-if="relatedAgents.length > 0" class="mb-6">
        <h4 class="text-white font-semibold mb-3">Related Agents</h4>
        <div class="space-y-2">
          <div 
            v-for="agent in relatedAgents" 
            :key="agent.id"
            class="flex items-center justify-between bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors"
            @click="selectAgent(agent)"
          >
            <div>
              <div class="text-white font-medium">{{ agent.name }}</div>
              <div class="text-gray-400 text-sm">{{ agent.subagent_type }}</div>
            </div>
            <div class="flex items-center space-x-2">
              <span 
                class="w-2 h-2 rounded-full"
                :class="getAgentStatusColor(agent.status)"
              ></span>
              <span class="text-gray-400 text-xs">{{ agent.status || 'pending' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Message Timeline Position -->
      <div class="mb-6">
        <h4 class="text-white font-semibold mb-3">Timeline Context</h4>
        <div class="bg-gray-700 rounded-lg p-3">
          <div class="flex items-center justify-between mb-2">
            <span class="text-gray-300 text-sm">Position in timeline</span>
            <span class="text-blue-400 text-sm">{{ getTimelinePosition() }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-300 text-sm">Session duration</span>
            <span class="text-gray-400 text-sm">{{ getSessionDuration() }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="pt-4 border-t border-gray-600">
        <div class="flex space-x-2">
          <button
            @click="copyMessage"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Copy Message
          </button>
          <button
            @click="highlightOnTimeline"
            class="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm font-medium"
          >
            Show on Timeline
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="p-4 flex items-center justify-center h-full">
      <div class="text-center text-gray-400">
        <div class="text-4xl mb-2">💬</div>
        <div class="text-lg mb-2">No message selected</div>
        <div class="text-sm">Click on a message dot in the timeline to view details</div>
      </div>
    </div>

    <!-- Keyboard Shortcut Hint -->
    <div class="absolute bottom-4 left-4 right-4">
      <div class="text-center text-gray-500 text-xs">
        Press <kbd class="px-1 bg-gray-700 rounded">Esc</kbd> to close
      </div>
    </div>
  </div>

  <!-- Overlay (for mobile) -->
  <div 
    v-if="visible" 
    class="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
    @click="close"
  ></div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { SubagentMessage, AgentStatus } from '../types';

// Component Props
const props = defineProps<{
  visible: boolean;
  selectedMessage: SubagentMessage | null;
  agents?: AgentStatus[];
  sessionId?: string;
}>();

// Component Events
const emit = defineEmits<{
  'close': [];
  'agent-selected': [agent: AgentStatus];
  'highlight-timeline': [messageId: string];
}>();

// Reactive state
const isClosing = ref(false);

// Computed properties
const relatedAgents = computed(() => {
  if (!props.selectedMessage || !props.agents) return [];
  
  const messageSender = props.selectedMessage.sender;
  const recipients = getMessageRecipients(props.selectedMessage);
  const notified = props.selectedMessage.notified || [];
  
  const relatedNames = new Set([messageSender, ...recipients, ...notified]);
  
  return props.agents.filter(agent => relatedNames.has(agent.name));
});

// Methods
const close = () => {
  isClosing.value = true;
  setTimeout(() => {
    isClosing.value = false;
    emit('close');
  }, 300);
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatMessageContent = (message: any): string => {
  if (typeof message === 'string') {
    return message;
  }
  return JSON.stringify(message, null, 2);
};

// Helper to determine message type from content
const getMessageType = (message: SubagentMessage): string => {
  if (typeof message.message === 'string') {
    const content = message.message.toLowerCase();
    if (content.includes('broadcast') || content.includes('team')) return 'broadcast';
    if (content.includes('error') || content.includes('fail')) return 'error';
    if (content.includes('status') || content.includes('complete')) return 'status';
  }
  return 'message';
};

const getMessageRecipients = (_message: SubagentMessage): string[] => {
  // Since SubagentMessage doesn't have recipients field, infer from message content or return empty
  return [];
};

const getMessageTypeLabel = (type?: string): string => {
  switch (type) {
    case 'broadcast': return 'Broadcast';
    case 'direct': return 'Direct Message';
    case 'status': return 'Status Update';
    case 'error': return 'Error';
    default: return 'Message';
  }
};

const getMessageTypeClass = (type?: string): string => {
  switch (type) {
    case 'broadcast': return 'bg-blue-600 text-white';
    case 'direct': return 'bg-green-600 text-white';
    case 'status': return 'bg-yellow-600 text-white';
    case 'error': return 'bg-red-600 text-white';
    default: return 'bg-gray-600 text-white';
  }
};

const getAgentStatusColor = (status?: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-400';
    case 'in_progress': return 'bg-blue-400';
    case 'error': return 'bg-red-400';
    default: return 'bg-gray-400';
  }
};

const selectAgent = (agent: AgentStatus) => {
  emit('agent-selected', agent);
};

const copyMessage = async () => {
  if (!props.selectedMessage) return;
  
  const content = formatMessageContent(props.selectedMessage.message);
  try {
    await navigator.clipboard.writeText(content);
    // TODO: Show toast notification
  } catch (error) {
    console.error('Failed to copy message:', error);
  }
};

const highlightOnTimeline = () => {
  if (!props.selectedMessage) return;
  
  const messageId = `msg-${props.selectedMessage.created_at}-${props.selectedMessage.sender}`;
  emit('highlight-timeline', messageId);
};

const getTimelinePosition = (): string => {
  if (!props.selectedMessage || !props.agents || props.agents.length === 0) return 'Unknown';
  
  const messageTime = props.selectedMessage.created_at;
  const firstAgent = props.agents.reduce((earliest, agent) => 
    agent.created_at < earliest.created_at ? agent : earliest
  );
  
  const sessionStart = firstAgent.created_at;
  const elapsed = messageTime - sessionStart;
  
  if (elapsed < 1000) return `${elapsed}ms from start`;
  if (elapsed < 60000) return `${(elapsed / 1000).toFixed(1)}s from start`;
  return `${(elapsed / 60000).toFixed(1)}min from start`;
};

const getSessionDuration = (): string => {
  if (!props.agents || props.agents.length === 0) return 'Unknown';
  
  const times = props.agents.map(agent => agent.created_at);
  const completionTimes = props.agents
    .map(agent => agent.completion_timestamp)
    .filter(t => t !== null && t !== undefined) as number[];
  
  const start = Math.min(...times);
  const end = completionTimes.length > 0 ? Math.max(...completionTimes) : Date.now();
  
  const duration = end - start;
  
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${(duration / 60000).toFixed(1)}min`;
};

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.visible) {
    close();
  }
};

// Watch for visibility changes
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    // Focus management for accessibility
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.message-detail-pane {
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.message-detail-pane.translate-x-full {
  transform: translateX(100%);
}

kbd {
  font-family: inherit;
  font-size: inherit;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .message-detail-pane {
    width: 100vw;
  }
}

/* Scrollbar styling for dark theme */
.message-detail-pane ::-webkit-scrollbar {
  width: 6px;
}

.message-detail-pane ::-webkit-scrollbar-track {
  background: #374151;
}

.message-detail-pane ::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 3px;
}

.message-detail-pane ::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>