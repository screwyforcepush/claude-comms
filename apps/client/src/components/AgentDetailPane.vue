<template>
  <div
    v-if="visible"
    class="agent-detail-pane fixed right-0 top-0 h-full w-96 bg-stone-950 border-l-2 border-red-900/40 shadow-[0_0_24px_rgba(0,0,0,0.8)] transform transition-transform duration-300 ease-out z-50"
    :class="{ 'translate-x-full': !visible }"
    data-testid="agent-detail-pane"
  >
    <!-- Header -->
    <div class="flex items-center justify-between bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 px-4 py-3 border-b-2 border-red-900/40">
      <h3 class="text-amber-400 font-bold text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] border-b border-amber-900/50 pb-1">Agent Details</h3>
      <button
        @click="close"
        class="text-stone-400 hover:text-amber-300 transition-colors p-1 rounded"
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
          <div class="text-amber-400 font-semibold text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{{ selectedAgent.name }}</div>
          <span
            class="px-3 py-1 rounded text-xs font-medium"
            :class="getStatusClass(selectedAgent.status)"
          >
            {{ selectedAgent.status || 'pending' }}
          </span>
        </div>

        <!-- Agent Type Badge -->
        <div class="mb-3">
          <span
            class="inline-block px-3 py-1 rounded text-xs font-medium bg-orange-950/80 text-orange-300 border border-orange-800/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]"
          >
            {{ formatAgentType(selectedAgent.subagent_type) }}
          </span>
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div class="bg-stone-900/90 rounded p-2 border border-stone-800 shadow-[inset_0_1px_4px_rgba(0,0,0,0.6)]">
            <div class="text-stone-400">Duration</div>
            <div class="text-amber-300 font-medium">{{ formatDuration(selectedAgent.total_duration_ms) }}</div>
          </div>
          <div class="bg-stone-900/90 rounded p-2 border border-stone-800 shadow-[inset_0_1px_4px_rgba(0,0,0,0.6)]">
            <div class="text-stone-400">Session</div>
            <div class="text-amber-300 font-medium text-xs truncate">{{ sessionId }}</div>
          </div>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div v-if="hasPerformanceData()" class="mb-6">
        <h4 class="text-amber-400 font-semibold mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] border-b border-amber-900/50 pb-1">Performance</h4>
        <div class="space-y-3">
          <!-- Total Tokens -->
          <div v-if="selectedAgent.total_tokens" class="bg-stone-900/90 rounded p-3 border border-stone-800 shadow-[inset_0_1px_4px_rgba(0,0,0,0.6)]">
            <div class="flex items-center justify-between mb-2">
              <span class="text-stone-400 text-sm">Total Tokens</span>
              <span class="text-amber-400 font-medium">{{ selectedAgent.total_tokens.toLocaleString() }}</span>
            </div>
            <div v-if="selectedAgent.input_tokens || selectedAgent.output_tokens" class="space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500">Input</span>
                <span class="text-gray-300">{{ (selectedAgent.input_tokens || 0).toLocaleString() }}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500">Output</span>
                <span class="text-gray-300">{{ (selectedAgent.output_tokens || 0).toLocaleString() }}</span>
              </div>
              <div v-if="selectedAgent.cache_creation_input_tokens || selectedAgent.cache_read_input_tokens" class="border-t border-gray-600 pt-1 mt-1">
                <div v-if="selectedAgent.cache_creation_input_tokens" class="flex items-center justify-between text-xs">
                  <span class="text-gray-500">Cache Write</span>
                  <span class="text-purple-400">{{ selectedAgent.cache_creation_input_tokens.toLocaleString() }}</span>
                </div>
                <div v-if="selectedAgent.cache_read_input_tokens" class="flex items-center justify-between text-xs">
                  <span class="text-gray-500">Cache Read</span>
                  <span class="text-purple-400">{{ selectedAgent.cache_read_input_tokens.toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Tool Usage -->
          <div v-if="selectedAgent.total_tool_use_count" class="bg-gray-700 rounded-lg p-3">
            <div class="flex items-center justify-between">
              <span class="text-gray-400 text-sm">Tool Calls</span>
              <span class="text-green-400 font-medium">{{ selectedAgent.total_tool_use_count }}</span>
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

      <!-- Prompt & Response Section -->
      <div v-if="hasPromptOrResponse()" class="mb-6">
        <h4 class="text-white font-semibold mb-3 flex items-center">
          <svg class="w-4 h-4 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/>
          </svg>
          Prompt & Response
        </h4>
        
        <!-- Initial Prompt -->
        <div v-if="selectedAgent.initial_prompt" class="mb-4" data-testid="prompt-section">
          <div class="bg-gray-700/50 rounded-lg p-3 border border-gray-600/50">
            <div class="flex items-center justify-between mb-2">
              <h5 class="text-green-400 font-medium text-sm flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Initial Prompt
                <span class="ml-1 text-xs text-gray-400">({{ getWordCount(selectedAgent.initial_prompt) }} words)</span>
              </h5>
              <button
                @click="copyPrompt"
                class="text-gray-400 hover:text-white transition-colors text-xs"
                title="Copy prompt"
                data-testid="copy-prompt-btn"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </button>
            </div>
            <div class="bg-gray-900/60 border border-gray-600 rounded p-2 max-h-32 overflow-y-auto max-h-96">
              <pre 
                class="text-gray-300 text-xs whitespace-pre-wrap font-mono leading-relaxed break-words"
                data-testid="prompt-content"
                role="textbox"
                aria-readonly="true"
              >{{ formatPromptPreview(selectedAgent.initial_prompt) }}</pre>
            </div>
          </div>
        </div>

        <!-- Final Response -->
        <div v-if="selectedAgent.final_response" class="mb-4" data-testid="response-section">
          <div class="bg-gray-700/50 rounded-lg p-3 border border-gray-600/50">
            <div class="flex items-center justify-between mb-2">
              <h5 class="text-blue-400 font-medium text-sm flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                Final Response
                <span class="ml-1 text-xs text-gray-400">({{ getWordCount(selectedAgent.final_response) }} words)</span>
              </h5>
              <button
                @click="copyResponse"
                class="text-gray-400 hover:text-white transition-colors text-xs"
                title="Copy response"
                data-testid="copy-response-btn"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </button>
            </div>
            <div class="bg-gray-900/60 border border-gray-600 rounded p-2 max-h-32 overflow-y-auto max-h-96">
              <pre 
                class="text-gray-300 text-xs whitespace-pre-wrap font-mono leading-relaxed break-words"
                data-testid="response-content"
                role="textbox"
                aria-readonly="true"
              >{{ formatPromptPreview(selectedAgent.final_response) }}</pre>
            </div>
          </div>
        </div>

        <!-- View Full Button -->
        <div class="flex justify-center">
          <button
            @click="openPromptResponseModal"
            class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center space-x-2"
            data-testid="expand-prompt-response-btn"
            title="View full prompt and response"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
            </svg>
            <span>View Full Details</span>
          </button>
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
  'open-prompt-response-modal': [agent: AgentStatus];
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

const formatDuration = (durationMs?: number): string => {
  // First try the explicit duration field
  if (durationMs && durationMs > 0) {
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}min`;
  }
  
  // Fallback: calculate from timestamps if available
  if (props.selectedAgent?.completion_timestamp && props.selectedAgent?.created_at) {
    const duration = props.selectedAgent.completion_timestamp - props.selectedAgent.created_at;
    if (duration > 0) {
      if (duration < 1000) return `${duration}ms`;
      if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
      return `${(duration / 60000).toFixed(1)}min`;
    }
  }
  
  // Check if agent is still running
  if (props.selectedAgent?.status === 'in_progress' && props.selectedAgent?.created_at) {
    const elapsed = Date.now() - props.selectedAgent.created_at;
    if (elapsed < 1000) return `${elapsed}ms (running)`;
    if (elapsed < 60000) return `${(elapsed / 1000).toFixed(1)}s (running)`;
    return `${(elapsed / 60000).toFixed(1)}min (running)`;
  }
  
  return 'N/A';
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
  return !!(props.selectedAgent?.total_tokens || props.selectedAgent?.total_tool_use_count);
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
    props.selectedAgent.total_duration_ms ? `Duration: ${formatDuration(props.selectedAgent.total_duration_ms)}` : '',
    props.selectedAgent.total_tokens ? `Tokens: ${props.selectedAgent.total_tokens}` : '',
    props.selectedAgent.total_tool_use_count ? `Tools: ${props.selectedAgent.total_tool_use_count}` : '',
    props.selectedAgent.input_tokens ? `Input Tokens: ${props.selectedAgent.input_tokens}` : '',
    props.selectedAgent.output_tokens ? `Output Tokens: ${props.selectedAgent.output_tokens}` : '',
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

// Prompt & Response functions
const hasPromptOrResponse = (): boolean => {
  return !!(props.selectedAgent?.initial_prompt || props.selectedAgent?.final_response);
};

const getWordCount = (text?: string): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

const formatPromptPreview = (text?: string): string => {
  if (!text) return '';
  const maxLength = 300;
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

const copyPrompt = async () => {
  if (!props.selectedAgent?.initial_prompt) return;
  
  try {
    await navigator.clipboard.writeText(props.selectedAgent.initial_prompt);
    // TODO: Show toast notification
  } catch (error) {
    console.error('Failed to copy prompt:', error);
  }
};

const copyResponse = async () => {
  if (!props.selectedAgent?.final_response) return;
  
  try {
    await navigator.clipboard.writeText(props.selectedAgent.final_response);
    // TODO: Show toast notification
  } catch (error) {
    console.error('Failed to copy response:', error);
  }
};

const openPromptResponseModal = () => {
  if (!props.selectedAgent) return;
  emit('open-prompt-response-modal', props.selectedAgent);
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