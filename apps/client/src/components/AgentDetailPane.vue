<template>
  <div 
    v-if="visible" 
    class="agent-detail-pane fixed right-0 top-0 h-full w-96 bg-gray-800 border-l border-gray-600 shadow-2xl transform transition-transform duration-300 ease-out z-50"
    :class="{ 'translate-x-full': !visible }"
  >
    <!-- Header -->
    <div class="flex items-center justify-between bg-gradient-to-r from-gray-700 to-gray-600 px-4 py-3 border-b border-gray-600">
      <h3 class="text-white font-bold text-lg">Agent Details</h3>
      <button
        @click="close"
        class="text-gray-400 hover:text-white transition-colors p-1 rounded"
        aria-label="Close agent details"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div v-if="selectedAgent" class="p-4 overflow-y-auto h-full">
      <!-- Agent Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <div class="text-blue-400 font-semibold text-lg">{{ selectedAgent.name }}</div>
          <span 
            class="px-3 py-1 rounded-full text-xs font-medium"
            :class="getStatusClass(selectedAgent.status)"
          >
            {{ selectedAgent.status || 'pending' }}
          </span>
        </div>
        
        <!-- Agent Type Badge -->
        <div class="mb-3">
          <span 
            class="inline-block px-3 py-1 rounded-full text-xs font-medium bg-purple-600 text-white"
          >
            {{ formatAgentType(selectedAgent.subagent_type) }}
          </span>
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div class="bg-gray-700 rounded-lg p-2">
            <div class="text-gray-400">Duration</div>
            <div class="text-white font-medium">{{ formatDuration(selectedAgent.duration) }}</div>
          </div>
          <div class="bg-gray-700 rounded-lg p-2">
            <div class="text-gray-400">Session</div>
            <div class="text-white font-medium text-xs truncate">{{ sessionId }}</div>
          </div>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div v-if="hasPerformanceData()" class="mb-6">
        <h4 class="text-white font-semibold mb-3">Performance</h4>
        <div class="grid grid-cols-2 gap-3">
          <div v-if="selectedAgent.token_count" class="bg-gray-700 rounded-lg p-3">
            <div class="flex items-center justify-between">
              <span class="text-gray-400 text-sm">Tokens</span>
              <span class="text-blue-400 font-medium">{{ selectedAgent.token_count.toLocaleString() }}</span>
            </div>
          </div>
          <div v-if="selectedAgent.tool_count" class="bg-gray-700 rounded-lg p-3">
            <div class="flex items-center justify-between">
              <span class="text-gray-400 text-sm">Tools</span>
              <span class="text-green-400 font-medium">{{ selectedAgent.tool_count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline Information -->
      <div class="mb-6">
        <h4 class="text-white font-semibold mb-3">Timeline</h4>
        <div class="space-y-3">
          <div class="bg-gray-700 rounded-lg p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-gray-400 text-sm">Started</span>
              <span class="text-gray-300 text-sm">{{ formatTimestamp(selectedAgent.created_at) }}</span>
            </div>
            <div v-if="selectedAgent.completion_timestamp" class="flex items-center justify-between">
              <span class="text-gray-400 text-sm">Completed</span>
              <span class="text-gray-300 text-sm">{{ formatTimestamp(selectedAgent.completion_timestamp) }}</span>
            </div>
            <div v-else class="flex items-center justify-between">
              <span class="text-gray-400 text-sm">Status</span>
              <span class="text-yellow-400 text-sm">{{ selectedAgent.status === 'in_progress' ? 'Running...' : 'Waiting...' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Related Messages -->
      <div v-if="relatedMessages.length > 0" class="mb-6">
        <h4 class="text-white font-semibold mb-3">Messages ({{ relatedMessages.length }})</h4>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          <div 
            v-for="message in relatedMessages" 
            :key="`${message.created_at}-${message.sender}`"
            class="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors"
            @click="selectMessage(message)"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="text-blue-400 text-sm font-medium">{{ message.sender }}</span>
              <span class="text-gray-400 text-xs">{{ formatTimestamp(message.created_at) }}</span>
            </div>
            <div class="text-gray-300 text-sm line-clamp-2">
              {{ formatMessagePreview(message.message) }}
            </div>
            <div v-if="message.notified && message.notified.length > 0" class="mt-1">
              <span class="text-green-400 text-xs">✓ Read by {{ message.notified.length }} agents</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Agent Collaboration -->
      <div v-if="getCollaborators().length > 0" class="mb-6">
        <h4 class="text-white font-semibold mb-3">Collaborating With</h4>
        <div class="space-y-2">
          <div 
            v-for="collaborator in getCollaborators()" 
            :key="collaborator.id"
            class="flex items-center justify-between bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors"
            @click="selectAgent(collaborator)"
          >
            <div>
              <div class="text-white font-medium">{{ collaborator.name }}</div>
              <div class="text-gray-400 text-sm">{{ collaborator.subagent_type }}</div>
            </div>
            <div class="flex items-center space-x-2">
              <span 
                class="w-2 h-2 rounded-full"
                :class="getAgentStatusColor(collaborator.status)"
              ></span>
              <span class="text-gray-400 text-xs">{{ collaborator.status || 'pending' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="pt-4 border-t border-gray-600">
        <div class="flex space-x-2">
          <button
            @click="copyAgentDetails"
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Copy Details
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
        <div class="text-4xl mb-2">🤖</div>
        <div class="text-lg mb-2">No agent selected</div>
        <div class="text-sm">Click on an agent in the timeline to view details</div>
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
import type { AgentStatus, SubagentMessage } from '../types';

// Component Props
const props = defineProps<{
  visible: boolean;
  selectedAgent: AgentStatus | null;
  agents?: AgentStatus[];
  messages?: SubagentMessage[];
  sessionId?: string;
}>();

// Component Events
const emit = defineEmits<{
  'close': [];
  'agent-selected': [agent: AgentStatus];
  'message-selected': [message: SubagentMessage];
  'highlight-timeline': [agentId: number];
}>();

// Reactive state
const isClosing = ref(false);

// Computed properties
const relatedMessages = computed(() => {
  if (!props.selectedAgent || !props.messages) return [];
  
  return props.messages.filter(message => 
    message.sender === props.selectedAgent?.name ||
    (message.notified && message.notified.includes(props.selectedAgent?.name || ''))
  ).sort((a, b) => b.created_at - a.created_at);
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
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatDuration = (duration?: number): string => {
  if (!duration) return 'N/A';
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${(duration / 60000).toFixed(1)}min`;
};

const formatAgentType = (type?: string): string => {
  if (!type) return 'Unknown';
  return type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
};

const formatMessagePreview = (message: any): string => {
  if (typeof message === 'string') {
    return message.length > 100 ? message.substring(0, 100) + '...' : message;
  }
  const str = JSON.stringify(message);
  return str.length > 100 ? str.substring(0, 100) + '...' : str;
};

const getStatusClass = (status?: string): string => {
  switch (status) {
    case 'completed':
      return 'bg-green-600 text-white';
    case 'in_progress':
      return 'bg-blue-600 text-white';
    case 'error':
      return 'bg-red-600 text-white';
    case 'pending':
    default:
      return 'bg-gray-600 text-white';
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

const hasPerformanceData = (): boolean => {
  return !!(props.selectedAgent?.token_count || props.selectedAgent?.tool_count);
};

const getCollaborators = (): AgentStatus[] => {
  if (!props.selectedAgent || !props.agents) return [];
  
  const selectedAgent = props.selectedAgent;
  const sessionAgents = props.agents.filter(agent => 
    agent.id !== selectedAgent.id
  );
  
  // Find agents that communicated with this agent through messages
  const communicatedWith = new Set<string>();
  if (props.messages) {
    props.messages.forEach(message => {
      if (message.sender === selectedAgent.name && message.notified) {
        message.notified.forEach(name => communicatedWith.add(name));
      } else if (message.notified?.includes(selectedAgent.name)) {
        communicatedWith.add(message.sender);
      }
    });
  }
  
  return sessionAgents.filter(agent => 
    communicatedWith.has(agent.name)
  ).slice(0, 5); // Limit to 5 collaborators
};

const selectAgent = (agent: AgentStatus) => {
  emit('agent-selected', agent);
};

const selectMessage = (message: SubagentMessage) => {
  emit('message-selected', message);
};

const copyAgentDetails = async () => {
  if (!props.selectedAgent) return;
  
  const details = [
    `Agent: ${props.selectedAgent.name}`,
    `Type: ${props.selectedAgent.subagent_type}`,
    `Status: ${props.selectedAgent.status || 'pending'}`,
    `Started: ${formatTimestamp(props.selectedAgent.created_at)}`,
    props.selectedAgent.completion_timestamp ? 
      `Completed: ${formatTimestamp(props.selectedAgent.completion_timestamp)}` : '',
    props.selectedAgent.duration ? `Duration: ${formatDuration(props.selectedAgent.duration)}` : '',
    props.selectedAgent.token_count ? `Tokens: ${props.selectedAgent.token_count}` : '',
    props.selectedAgent.tool_count ? `Tools: ${props.selectedAgent.tool_count}` : '',
  ].filter(Boolean).join('\n');
  
  try {
    await navigator.clipboard.writeText(details);
    // TODO: Show toast notification
  } catch (error) {
    console.error('Failed to copy agent details:', error);
  }
};

const highlightOnTimeline = () => {
  if (!props.selectedAgent) return;
  
  emit('highlight-timeline', props.selectedAgent.id);
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
.agent-detail-pane {
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.agent-detail-pane.translate-x-full {
  transform: translateX(100%);
}

kbd {
  font-family: inherit;
  font-size: inherit;
}

/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .agent-detail-pane {
    width: 100vw;
  }
}

/* Scrollbar styling for dark theme */
.agent-detail-pane ::-webkit-scrollbar {
  width: 6px;
}

.agent-detail-pane ::-webkit-scrollbar-track {
  background: #374151;
}

.agent-detail-pane ::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 3px;
}

.agent-detail-pane ::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>